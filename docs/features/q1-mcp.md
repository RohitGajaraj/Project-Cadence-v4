# Q1-MCP · Read-only Model Context Protocol (MCP) server

> _Created: 2026-06-17 · Last updated: 2026-06-21_

**Status:** ✅ Shipped (Phases 1-4a: backend + token UI + native MCP transport handshake). **Q2 governed-write surface shipped DORMANT 2026-06-25 (lane 1)** — see "Q2 · governed inbound write" below. Remaining Q2 (OAuth auto-discovery, SSE streaming) future-deferred.  
**Lanes:** F (INTEROP / the neutral brain); verified live 2026-06-21 (lane 3)  
**P-tier:** Tier 1 (Build Sequence #11 — the neutral-brain moat)  
**Build commits:** `2c5f6b547c` (Phase 1 foundation), `44a92d06a2` (Phase 2 dispatch), Phase 3 UI 2026-06-17, Phase 4a transport 2026-06-21 (lane 1; token-issuance bug fixed 1f0ace8450), Q2 governed write 2026-06-25 (lane 1)  
**What's next:** the rest of Phase 4b (founder-gated future) — OAuth client registration + auto-discovery, and SSE/streamable-HTTP session streaming. The scoped WRITE half is now built (dormant); flipping it on is a founder call (`admin_set_interop_write_enabled(true)`).

---

## What it is

**Cadence as a neutral brain:** external agents (Claude with MCP, Cursor, ChatGPT, other AI frameworks) can read signals, opportunities, PRDs and append decisions via HTTP, governed by workspace scope, rate limits, and audit logging.

The MCP server exposes **seven read tools** (always in the `tools/list` catalog) plus **one governed write tool** that appears only for an authorized token (see Q2 below):

- **`search_signals`** — keyword search over title/content with pagination (limit/offset)
- **`search_opportunities`** — ICE-filtered search by title/problem
- **`search_decisions`** — decision-brain search, each tagged standing/superseded (INTEROP-V11)
- **`search_prds`** — spec discovery by keyword (title/body) and/or status — the find half of `get_prd` (INTEROP-V11, 2026-06-24)
- **`get_prd`** — fetch a specific PRD spec by ID
- **`get_roadmap`** — opportunities arranged into now/next/later buckets, highest ICE first (INTEROP-V11, 2026-06-24)
- **`export_skillpack`** — a versioned, content-hashed bundle of decision lessons
- **`ingest_signal`** _(governed WRITE; INTEROP-V11 Q2, 2026-06-25)_ — contribute a discovery signal; visible/callable ONLY with the `write:signal` scope AND the global write gate on (dormant by default). See Q2 below.
- **`tools` / `resources`** — legacy MCP discovery endpoints (list available tools)

> The earlier `append_decision` write tool was **removed** 2026-06-24 (it targeted a `decision_queue` table + columns absent from the live schema, so it could never succeed). The Q2 write surface below replaces it with a single tool that reuses a verified-live insert path.

All calls require a bearer token (workspace-scoped), enforce per-token rate limits (default 60 calls/minute), and log to the audit trail (`api_calls` table).

> **Schema-drift repair (2026-06-24, lane 2; KI-40).** A live-schema audit via the Lovable MCP found `search_signals`, `search_opportunities`, and `get_prd` were each selecting columns/tables that don't exist in production (e.g. `summary`→`content`, `predicted_ice`→`ice_score`, table `prd`→`prds`) and would error on the first external call. All three were repaired against the verified prod schema in the same cycle, and every search tool was hardened with `sanitizeIlikeQuery` against PostgREST `.or()` filter-injection (a crafted keyword could otherwise widen results within the caller's own workspace). The tenant boundary (`workspace_id`) was never affected.

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

## INTEROP-V11 floor — read-only decision-brain access (2026-06-24, lane 2)

Added a read-only `search_decisions` MCP tool: external agents (Claude/ChatGPT/Cursor) can now query the workspace decision brain — decisions (safe projection: title, rationale, status, decided-by, created_at) each tagged with the honest **standing/superseded** outcome (reuses the Trust Ledger `supersededChildIds` bitemporal rule, so the MCP read and the in-app ledger never disagree). Workspace-scoped + audited like the existing read tools; catalog entry in `mcp-protocol.ts`, dispatch case in `api/mcp.ts`, helper in `mcp.functions.ts` (`searchDecisions` + the pure `applyDecisionOutcomes`); 4 unit tests + the catalog-integrity tests updated (now 6 tools). **Remaining (INTEROP-V11 ◐):** roadmap/spec read tools + the outward WRITE/A2A scoped-token surface (founder-gated on scopes/audit).

## Q2 · governed inbound WRITE — `ingest_signal` (2026-06-25, lane 1)

The founder lifted the Q2 scopes/audit gate. This is the outward GOVERNED WRITE surface: an external/peer agent can contribute a discovery signal into a workspace through MCP (`tools/call ingest_signal`) and the A2A card's `discovery.ingest_signal` skill. It ships **DORMANT** and **fully reversible**.

**Two independent locks — both must be open for any write:**

1. **Per-token scope** (`mcp_tokens.scopes text[]`, default `{}`): the token must carry the tool's required scope (`write:signal`). Every token already issued — and every new token unless minted with a scope — is `{}` = read-only. `issue_mcp_token` gained an optional `_scopes` arg; `issueMCPToken` constrains it to an allow-list (`write:signal` only).
2. **Global dormant gate** `interop_write_enabled()` (default **false**, reads `app_settings`, flipped only by `admin_set_interop_write_enabled(boolean)` which is `has_role(admin)`-gated — mirrors `credits_enabled()`). Even a correctly write-scoped token **cannot write** until a founder flips the gate on. Flip it back off to disable instantly.

**Why it can't repeat the `append_decision` drift bug:** the single write tool reuses the SAME `signals` insert shape the live F-V5-INGEST-WEBHOOK door uses (verified against the prod schema 2026-06-25), and the SAME injection screen (`screenIngestText`): a structural prompt-injection is **rejected, never stored**; a borderline lexical override is stored **flagged** (`needs-review`). The row is stamped with the **token's** `workspace_id` + `user_id` — never caller-supplied input — so the tenant boundary can't be spoofed (zod strips any extra args).

**Defence in depth:**
- `tools/list` is **scope-filtered** (`toolsForScopes`): a read-only token never even discovers `ingest_signal`.
- `tools/call` **re-checks** authorization (`canCallWriteTool`: gate first, then scope) so a token that guesses the name is still refused.
- The legacy flat-method transport **cannot write** (the read dispatcher has no write case → "Unknown method"), so writes exist only via standard `tools/call`.
- The gate resolver **fails closed** (any error → writes disabled).
- Every attempt is audited to `api_calls` with `result` ∈ `success | error | permission_denied`.

**Files:** migration `20260625140000_interop_write_scopes_gate.sql` (scopes column + `interop_write_enabled()` + `admin_set_interop_write_enabled` + `issue_mcp_token` overload); pure write layer in `mcp-protocol.ts` (`MCP_WRITE_TOOLS`, `WRITE_SCOPE_BY_TOOL`, `toolsForScopes`, `canCallWriteTool`, `isWriteTool`); `ingestSignal` in `mcp.functions.ts`; route enforcement + `dispatchWriteTool` + `resolveWriteEnabled` in `api/mcp.ts`; the A2A `discovery.ingest_signal` skill in `a2a.agents.cadence.card.ts`. Tests: `mcp-protocol.test.ts` (scope filtering + call-time enforcement, +14) and new `mcp.functions.test.ts` (screening, tenant-stamp resistance, insert shape, error propagation).

> **Deploy ordering (hardened):** the route selects `mcp_tokens.scopes` and calls `interop_write_enabled()`. To survive the Lovable/Workers split-deploy (the worker can land before the migration), `validateToken` **degrades gracefully**: if the `scopes` column is absent (PostgREST `42703`) it re-selects without it and treats the token as read-only (`scopes = []`), so the READ tools keep working and writes stay impossible until the migration applies. `resolveWriteEnabled` likewise fails closed. So an out-of-order deploy is safe (read-only), and once the migration applies the gate is still OFF until the founder flips it. _(Adversarial review 2026-06-25 flagged the un-hardened version as a HIGH availability risk — all MCP traffic would 401 — now fixed.)_

**To activate (founder):** apply the migration on publish → mint a token with `scopes: ["write:signal"]` for the trusted peer → run `select admin_set_interop_write_enabled(true);` as an admin. To pause: `select admin_set_interop_write_enabled(false);`.
