# Q1-MCP · Read-only Model Context Protocol (MCP) server

> _Created: 2026-06-17 · Last updated: 2026-06-21_

**Status:** ✅ Shipped (Phases 1-4a: backend + token UI + native MCP transport handshake; Phase 4b / Q2 future-deferred)  
**Lanes:** F (INTEROP / the neutral brain); verified live 2026-06-21 (lane 3)  
**P-tier:** Tier 1 (Build Sequence #11 — the neutral-brain moat)  
**Build commits:** `2c5f6b547c` (Phase 1 foundation), `44a92d06a2` (Phase 2 dispatch), Phase 3 UI 2026-06-17, Phase 4a transport 2026-06-21 (lane 1; token-issuance bug fixed 1f0ace8450)  
**What's next:** Phase 4b (Q2, founder-gated future) — OAuth client registration + auto-discovery, SSE/streamable-HTTP session streaming, and full write CRUD with per-lane scope.

---

## What it is

**Cadence as a neutral brain:** external agents (Claude with MCP, Cursor, ChatGPT, other AI frameworks) can read signals, opportunities, PRDs and append decisions via HTTP, governed by workspace scope, rate limits, and audit logging.

The MCP server exposes four read-only + one write tool:

- **`search_signals`** — keyword/theme search with pagination (limit/offset)
- **`search_opportunities`** — ICE-filtered search by title/problem
- **`get_prd`** — fetch a specific PRD spec by ID
- **`append_decision`** — write a decision to an opportunity (queues for human approval)
- **`tools` / `resources`** — MCP discovery endpoints (list available tools)

All calls require a bearer token (workspace-scoped), enforce per-token rate limits (default 60 calls/minute), and log to the audit trail (`api_calls` table).

### The moat

If the loop closes on real data, _and_ the data is readable by other agents, then the incumbent threat (a PM using their own Claude instance + Cadence's output) vanishes. The data lives here; other agents are tools, not competitors.

---

## Architecture (Phase 1 + 2)

### Tables (migration `20260617150000`)

**`mcp_tokens`** — issued per workspace + user, revocable, rate-limited.

- `id` (UUID, PK)
- `workspace_id` (FK workspaces) — scopes token to one workspace
- `user_id` (FK auth.users) — who issued the token
- `slug` (TEXT, unique per workspace) — human-readable identifier (e.g., "claude-desktop")
- `secret_hash` (SHA256, unique per workspace) — never stored plaintext
- `rate_limit_per_min` (INT, default 60) — calls per token per minute
- `last_used_at` (TIMESTAMP) — for analytics
- `created_at`, `revoked_at` (TIMESTAMP)
- **RLS:** workspace members can read (SELECT). Service-role only for INSERT/UPDATE/DELETE.

**`api_calls`** — audit trail for all MCP tool calls.

- `id` (UUID, PK)
- `token_id` (FK mcp_tokens, CASCADE)
- `workspace_id` (FK workspaces)
- `tool_name` (TEXT) — which tool was called
- `input_tokens`, `output_tokens`, `cost_usd` (for future cost tracking)
- `result` (VARCHAR: "success" | "rate_limit" | "not_found" | "error" | "permission_denied")
- `error_message` (TEXT, nullable)
- `metadata` (JSONB) — elapsed_ms, source agent, etc.
- `created_at` (TIMESTAMP, indexed DESC)
- **RLS:** workspace members can read. Service-role only for INSERT.

### Route: `POST /api/mcp` (JSON-RPC 2.0)

**Handler flow:**

1. **Parse request** — `{ jsonrpc, method, params, id }`
2. **Extract bearer token** — `Authorization: Bearer <slug>:<secret>`
3. **Hash secret** — SHA256(secret) → compare against `secret_hash` in DB
4. **Validate token** — query `mcp_tokens`, check `revoked_at IS NULL`, retrieve workspace_id + rate_limit
5. **Rate-limit check** — count `api_calls` created in last 60s for this token; reject if >= rate_limit
6. **Dispatch tool** — switch on method name, call the appropriate function
7. **Log the call** — insert into `api_calls` (success/failure/rate-limit)
8. **Return MCP response** — `{ jsonrpc, result, id }` (success) or `{ jsonrpc, error, id }` (error)

**Error codes:**

- `-32003` (Invalid Request) — missing/malformed token (HTTP 401)
- `-32002` (Server Error, rate limit) — rate limit exceeded (HTTP 429)
- `-32601` (Method not found) — unknown method (HTTP 200, request-level error; see below)
- `-32602` (Invalid params) — unknown or missing `tools/call` tool name (HTTP 200)
- `-32600` (Invalid Request) — unsupported `MCP-Protocol-Version` request header (HTTP 400)
- `-32603` (Internal Error) — server exception (HTTP 500)

**HTTP-status convention (Phase 4a):** transport/auth failures use HTTP status codes (401/429/400/500); request-level JSON-RPC errors (unknown method, bad tool name) return **HTTP 200 with a JSON-RPC `error` body** per the MCP-over-HTTP transport, so a client reads the error from the body. A legacy flat-method tool-execution failure still returns HTTP 400 (unchanged). Tool-execution errors from the standard `tools/call` are reported in the result as `{ content, isError: true }` (not a JSON-RPC error), so a calling model can see them.

**Service-role client:** token validation and tool dispatch both use `createClient(SUPABASE_SERVICE_ROLE_KEY)` — no user context. RLS gates reads to the workspace.

### Tool dispatchers

Each tool validates params, calls the corresponding `mcp.functions.ts` function, and returns `{ success, data?, error? }`.

- **`search_signals(workspace_id, query, limit, offset)`** — SELECT signals WHERE workspace_id + full-text match
- **`search_opportunities(workspace_id, query, min_ice, limit, offset)`** — SELECT opps WHERE workspace_id + ICE >= min_ice
- **`get_prd(workspace_id, prd_id)`** — SELECT single PRD WHERE workspace_id + id
- **`append_decision(workspace_id, opp_id, text, metadata)`** — INSERT decision (verdict = "pending") → INSERT decision_queue (external_source = "mcp")

All queries filtered to the workspace; RLS prevents cross-workspace leaks.

### Rate limiting

Per-token, per-minute. Query `api_calls` table for calls created in the last 60 seconds (`created_at >= now() - interval '1 minute'`).

- **Fail gracefully on error** — if the rate-limit check fails (DB error, network), allow the call (fail-open). Log the error.
- **Shared bucket** — all tools share the same rate limit. A burst of searches counts toward the same 60-call window.

### Cost tracking

Placeholder in the schema (`input_tokens`, `output_tokens`, `cost_usd` on `api_calls`). Currently logged as `0`. Phase 3+ will wire up actual token counts from the tool dispatch (e.g., embedding costs for search, LLM costs for append).

---

## Phase 2: Completion checklist

- [x] Migration `20260617150000` — mcp_tokens + api_calls tables + RLS + functions
- [x] `mcp.functions.ts` — token mgmt (issue/revoke/list) + tool functions (search/get/append) + audit logging
- [x] `src/routes/api/mcp.ts` — POST handler with token validation, rate limiting, tool dispatch, error handling
- [x] Bearer token parsing (slug:secret format)
- [x] Token validation against DB (secret hash, revoked_at check)
- [x] Rate-limit enforcement (per-token, per-minute)
- [x] All four tools wired (search_signals, search_opportunities, get_prd, append_decision)
- [x] Audit logging on every call (success/error/rate-limit)
- [x] CORS headers (Access-Control-Allow-Origin: \*)
- [x] OPTIONS preflight support
- [x] Build: tsc clean + bundle succeeds

**Test vector (manual):**

```bash
# Issue a token (via Settings > Integrations in Phase 3, or direct RPC call)
curl -X POST https://<host>/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <slug>:<secret>" \
  -d '{"jsonrpc":"2.0","method":"tools","id":1}'

# Expected: MCP discovery response listing the four tools
```

---

## Phase 3: Settings UI (shipped 2026-06-17)

**Surface:** Settings → **Integrations** tab (`/settings?section=interop`).

**What shipped:**

- **Issue a token:** name input (`slug`) + per-minute rate limit (1-1000, default 60) → `issueMCPToken` → the full `slug:secret` renders once in an ember-tinted box with an explicit "copy it now, it will not be shown again" warning + copy button. The secret is generated server-side, returned once, never persisted plaintext (only the SHA256 hash is stored), and never logged.
- **Active tokens:** `listMCPTokens` table — name, created, last used, rate limit, active/revoked.
- **Revoke:** confirm-gated (destructive `useConfirm`) → `revokeMCPToken` sets `revoked_at`; the row dims to revoked. Any external agent on that token stops immediately.
- **How to connect:** the live endpoint (`<origin>/api/mcp`), the `Authorization: Bearer slug:secret` contract, a copy-paste **working `curl`** example, and the four-method list.

**Honesty note (claim-never-outruns-wiring), updated 2026-06-21:** as of Phase 4a, `/api/mcp` now speaks the native MCP request/response methods (`initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`, `notifications/*`) over JSON-RPC-over-HTTP, so a standards-compliant MCP client that accepts a single `application/json` response and a manually-pasted bearer header (e.g. Claude Desktop with custom headers) completes the handshake. Two MCP transport MUSTs remain Phase 4b, so the claim stays honest: (1) **no SSE/streamable session** (the endpoint always replies in JSON mode; it does not negotiate `text/event-stream` or implement a GET stream), and (2) **no OAuth auto-discovery** (the 401 carries no `WWW-Authenticate` metadata, so connection requires a manually-supplied `Authorization: Bearer <slug>:<secret>`; OAuth client registration is Phase 4b). The legacy flat methods + the working `curl` are unchanged.

**Files:**

- `src/components/settings/IntegrationsTab.tsx` (new) — the whole tab (issue / list / revoke / connect).
- `src/routes/_authenticated.settings.tsx` — `SectionId` adds `"interop"`, one `TABS` entry ("Integrations"), one render branch. No new server fn, no migration (consumes the shipped Phase 1 `mcp.functions.ts`).

---

## Phase 4a (shipped 2026-06-21): native MCP transport handshake

Closes the "full streamable-HTTP transport handshake" half of the Phase 4 fast-follow so a standards-compliant MCP client can connect (the OAuth/CRUD half is Phase 4b, below).

**What shipped:**

- New **pure** `src/lib/mcp-protocol.ts` (32 unit tests): the wire protocol as a side-effect-free layer. `classifyMcpRequest` returns a discriminated union (`initialize` / `ping` / `tools/list` / `resources/list` / `prompts/list` / `tools/call` / `notification` / `legacy` / `error`); `buildInitializeResult` (capabilities + `serverInfo` + version negotiation via `negotiateProtocolVersion`, echo-if-supported else latest); `buildToolsListResult` (single-source tool catalog `MCP_TOOLS`); `buildToolCallResult` (the `{ content: [{type:"text",text}], isError }` envelope); `isNotification` (no `id` OR `notifications/*` => no response); and `jsonRpcResult`/`jsonRpcError` builders.
- `src/routes/api/mcp.ts` now classifies every request and routes standard methods to spec-correct handlers, **before** the unchanged legacy flat-method dispatch. The legacy `tools`/`resources` discovery now reads the same `MCP_TOOLS` catalog (no drift). Notifications get a `202` with no body. An unsupported `MCP-Protocol-Version` request header returns `400`.
- Capabilities advertise only `tools` (not `resources`/`prompts`, which answer empty for tolerance but have no read path until Phase 4b).

**Back-compat (byte-identical for existing callers):** the four legacy flat methods + the legacy discovery are dispatched through the original code path unchanged, including their HTTP statuses. Two observable, more-spec-correct behavior changes: an `id`-less request is now a JSON-RPC **notification** (`202`, no body) and an unknown method now returns **HTTP 200** with a JSON-RPC error body (was 400). No external clients are registered yet (registration is Phase 4b), so there is no production consumer affected.

**Scope boundary (honest):** JSON response mode only (no SSE session), and manual bearer header only (no OAuth discovery). Both are Phase 4b.

---

## Phase 4b (Q2, future): OAuth discovery + SSE streaming + full CRUD

- **Q2** — peer agents discover Cadence + call us with scoped/audited writes
  - OAuth client registration + `WWW-Authenticate` / `.well-known/oauth-protected-resource` metadata for auto-discovery
  - SSE / streamable-HTTP session transport (`Accept: text/event-stream`, GET stream)
  - Full CRUD (signals, opps, PRDs, missions, outcomes) with approval gates
  - Scoped read/write (agent can only touch opps/specs in a specific lane)
- Not in scope for this session; part of the M-D (Launch & Learn) milestone.

---

## Known quirks / next steps

1. **Cost tracking:** placeholder values (0 tokens, $0). Wire up actual counts when cost attribution is live.
2. **Fail-open rate limiting:** if DB query fails, the call proceeds. This is intentional (availability over strictness), but means a DB outage isn't a hard gate.
3. **Approval gate on append_decision:** writes go to decision_queue (pending_review). The human must approve; no auto-execution from external source.
4. **No versioning on tools:** if the tool schema changes (params, return shape), external agents break. Phase 4b will add a `version` param or namespace the tools.

---

## How to test (local dev + hosted)

### Local (no auth needed, stub token validation)

```bash
# Start the dev server
bun run dev

# Mock a token validation (requires DB with migration applied)
# Issue a token via the Supabase dashboard or direct RPC
# Then call the endpoint
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-slug>:<your-secret>" \
  -d '{"jsonrpc":"2.0","method":"search_signals","params":{"query":"api"},"id":1}'
```

### Hosted (Lovable published)

Once the app is deployed (Lovable sync + publish), the `/api/mcp` route is live. External agents (Claude, Cursor) can call it with a token issued from Settings > Integrations (Phase 3).

---

## Cross-references

- **v10 blueprint:** section 15 (Lane F — INTEROP)
- **Feature dashboard:** Q1-MCP row (P1 priority, Lane F)
- **a2a-handoff.md:** sibling A2A contract (internal agent handoffs); MCP is external A2A
- **Spec:** https://modelcontextprotocol.io/specification
