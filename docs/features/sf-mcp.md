# SF-MCP — `mcp_source` Adapter (Hosted MCP Servers as Inbound Signals)

> _Created: 2026-07-01 · Status: ✅ Shipped (lane 1), ships DARK. Activation: founder sets per-server env vars in Lovable project settings._

## What it is

SF-MCP is the Phase 3 `mcp_source` adapter for the Signal Fabric: one generic, vendor-agnostic client that ingests content from hosted (HTTP / Streamable-HTTP) MCP servers as inbound signals. It absorbs four named server slots — Linear, Gong, Granola, Enterpret — but the adapter itself contains zero per-vendor logic. Every slot's server URL, auth token, tool name, and call arguments come exclusively from environment variables the founder controls; nothing about which external host gets called is ever read from a database row or user input.

It ships DARK, exactly like the Phase 2 customer-voice connector fleet (Stripe/Slack/Zendesk/etc.): the code is live, but every `MCP_*` env var is unset, so `ingestMcpSignals` reports `source: "none"` for all four slots until the founder activates one.

**Why it exists.** The Signal Fabric's inside-out lane already pulls from registry-backed providers (`pull_connector`) and outside-in from the Scout (`web_scout`). MCP is a third lane: a growing set of SaaS tools expose a hosted MCP server instead of (or in addition to) a REST API, and a single adapter that speaks the protocol generically scales to any of them without a bespoke integration per vendor. Cadence has no verified live tool schema for Gong, Granola, or Enterpret's hosted MCP servers, so the only honest way to ship this now is fully config-driven — the founder supplies the tool name and arguments once real access exists, and zero code changes are needed to wire a new slot's specifics.

**Where to find it.** Nothing user-facing yet — no settings UI, no connect button. This is engine-only: a server-side ingest path wired into `sense-tick`, the same cron hook that drives the rest of ambient sensing. There is no manual trigger.

## Architecture

```
sense-tick (every 5 min, pg_cron)
  └─ per workspace: ingestMcpSignals(userId, workspaceId)
       └─ for each of the 4 registry slots (linear-mcp / gong / granola / enterpret):
            1. config gate    — urlEnv + toolEnv must resolve, else source:"none", skip
            2. tier gate      — assertConnectorCapability(tier, "inflow"), fail-closed free
            3. rate limit     — mcp_connections row, 6 calls/workspace/server/24h
            4. callMcpTool()  — initialize → tools/call JSON-RPC handshake over HTTP
            5. blocksToCandidates() (pure) → SignalCandidate[] (source_kind:"mcp_source")
            6. writeSignals() — screen(untrusted) → dedup(external_id) → INSERT
            7. recordCall()   — log success/failure to mcp_connections (sanitized only)
```

| Piece | File | Role |
|---|---|---|
| Types | `src/lib/connectors/mcp/types.ts` | `McpServerId`, `McpContentBlock`, `McpServerSpec` — client-safe, no server imports |
| Registry | `src/lib/connectors/mcp/registry.ts` | The 4 server slots, each pointing at its own `urlEnv`/`tokenEnv`/`toolEnv`/`argsEnv` names — no vendor logic |
| Client | `src/lib/connectors/mcp/client.server.ts` | `callMcpTool()` — the generic two-step JSON-RPC handshake (`initialize` then `tools/call`) over HTTP, with SSE and JSON response parsing |
| Ingest | `src/lib/connectors/mcp/ingest.server.ts` | `ingestMcpSignals()` — the per-workspace orchestrator: config gate → tier gate → rate limit → call → write → record |
| Sink | `src/lib/sources/sink.server.ts` | `writeSignals()` — every candidate is `untrusted: true`, so it is screened for prompt injection before being stored |
| Ledger | `supabase/migrations/20260701010000_mcp_connections.sql` | `mcp_connections` — rate-limit + audit telemetry only; never a URL or token |
| Wiring | `src/routes/api/public/hooks/sense-tick.ts` | One explicit `await ingestMcpSignals(...)` call per workspace per tick, alongside the customer-voice fleet |

One misbehaving or unconfigured server slot can never break another or the caller — every step in the loop above is independently wrapped in `try/catch`, and `ingestMcpSignals` never throws.

## The trust & SSRF model

**The core security property: a server's URL, token, and tool name come ONLY from founder-set environment variables — never from a `mcp_connections` row, never from a workspace setting, never from a request body or any user-supplied value.** `registry.ts` stores env var *names* (`urlEnv`, `tokenEnv`, `toolEnv`, `argsEnv`), never values; the actual value is read with `process.env[spec.urlEnv]` at call time inside `ingest.server.ts`. There is no code path, settings form, or API route that lets a workspace member or any external caller influence which host gets fetched or which token is sent.

On top of that boundary, every URL is still checked with `assertSafeBaseUrl()` (the existing SSRF guard, `src/lib/url-safety.ts`) before any fetch — so even a founder typo or a misconfigured env var can't point the client at a private/internal host. `callMcpTool()` also never follows redirects (`redirect: "manual"`): a 3xx `Location` header is unvalidated by `assertSafeBaseUrl()` and could otherwise pivot the token-bearing request to an internal host, so a redirect response is simply treated as a failed handshake.

The `mcp_connections.server_id` column is hard-capped by a CHECK constraint to the four founder-curated slots (`'linear-mcp','gong','granola','enterpret'`); adding a fifth requires both a code change to the registry and a migration to extend the CHECK — never a migration-less runtime value. The table itself holds zero secrets: only a per-(workspace, server) call counter, the rolling-window start, the last-call timestamp, and a sanitized last-error string (`supabase/migrations/20260701010000_mcp_connections.sql`). Thrown errors from the client are generic (`"MCP server error: 404"`, `"MCP tool error: ..."`) and never echo the response body, the server URL, or the token.

Every MCP-sourced candidate is also marked `untrusted: true` and screened for prompt injection by `writeSignals()` before it is stored — third-party MCP content is exactly as untrusted as Scout web content or customer-voice connector text.

## The rate-limit model

At most `MAX_CALLS_PER_DAY = 6` calls per workspace per server slot per rolling 24-hour window, tracked in `mcp_connections` (`readRateState` / `recordCall` in `ingest.server.ts`). This is conservative on purpose: these are third-party hosted servers Cadence doesn't control the cost or rate limits of, and `sense-tick` runs every 5 minutes (~288 ticks/day uncapped). A hit limit reports `source: "rate-limited"` for that slot and the network is never touched — the call is skipped before `callMcpTool()` is ever invoked. A missing row or an expired (>= 24h old) window both read as a fresh window. The ledger write is best-effort: a telemetry write failure never breaks ingestion (`recordCall` swallows its own errors).

Within the client itself, `MAX_RESPONSE_BYTES = 1_000_000` bounds how much of a response body is buffered before parsing, and `MAX_CONTENT_BLOCKS = 20` caps how many text blocks one call can turn into candidates — both guard against a misbehaving or compromised server returning an oversized payload.

## Activation

All four slots ship dark. To activate one, the founder sets that slot's env vars in Lovable project settings — no code change, no migration, no deploy needed beyond the variable itself being picked up at runtime:

| Server | Required env vars |
|---|---|
| Linear | `MCP_LINEAR_URL`, `MCP_LINEAR_TOKEN`, `MCP_LINEAR_TOOL`, `MCP_LINEAR_ARGS` (optional, JSON) |
| Gong | `MCP_GONG_URL`, `MCP_GONG_TOKEN`, `MCP_GONG_TOOL`, `MCP_GONG_ARGS` (optional, JSON) |
| Granola | `MCP_GRANOLA_URL`, `MCP_GRANOLA_TOKEN`, `MCP_GRANOLA_TOOL`, `MCP_GRANOLA_ARGS` (optional, JSON) |
| Enterpret | `MCP_ENTERPRET_URL`, `MCP_ENTERPRET_TOKEN`, `MCP_ENTERPRET_TOOL`, `MCP_ENTERPRET_ARGS` (optional, JSON) |

A slot only activates once both its `_URL` and `_TOOL` vars resolve (the config gate in `ingestMcpSignals`); `_TOKEN` is sent as a Bearer header when present but is not itself required (some hosted servers may not need one). `_ARGS` is an optional JSON-stringified object of static tool call arguments (e.g. `{"limit":20}`); invalid or absent JSON safely defaults to `{}`. Also requires the workspace to be Pro+ tier (the `inflow` capability gate, same as every connector). The migration `20260701010000_mcp_connections.sql` must be applied (additive, idempotent) before any slot can record its rate-limit state.

## Known limits / out of scope

- HTTP / Streamable-HTTP only — no stdio MCP servers (Cloudflare Workers cannot spawn local processes).
- No settings UI / connect button yet — activation is env-var-only, exactly like the dark customer-voice connectors before their UI landed.
- No verified vendor-specific tool schema for Gong, Granola, or Enterpret — the founder supplies the real tool name and argument shape via `MCP_<SERVER>_TOOL` / `MCP_<SERVER>_ARGS` once access exists; nothing vendor-specific is hardcoded.
- Not wired into `BRAIN_AUTO_TRIGGER` / SF-AUTOTRIGGER's reversible-mission auto-promotion — explicitly called out as still-HITL-gated in `sf-autotrigger.md` until separately scoped.
- One tool call per server per tick (not a paginated crawl) — matches the bounded-pull pattern of the rest of the Phase 2 fleet.

## Related files

| File | Role |
|---|---|
| `src/lib/connectors/mcp/types.ts` | Shared types (`McpServerId`, `McpContentBlock`, `McpServerSpec`) |
| `src/lib/connectors/mcp/registry.ts` | The 4-slot, env-var-driven server registry |
| `src/lib/connectors/mcp/client.server.ts` | The generic JSON-RPC-over-HTTP MCP client + SSRF guard call site |
| `src/lib/connectors/mcp/client.test.ts` | 9 unit tests (`parseSseFrames`, `extractTextBlocks`) |
| `src/lib/connectors/mcp/ingest.server.ts` | `ingestMcpSignals()` orchestrator + `blocksToCandidates()` + `hashText()` |
| `src/lib/connectors/mcp/ingest.test.ts` | 11 unit tests (`hashText`, `blocksToCandidates`) |
| `supabase/migrations/20260701010000_mcp_connections.sql` | `mcp_connections` rate-limit/audit table (no URLs/secrets) |
| `src/routes/api/public/hooks/sense-tick.ts` | Wiring: one `ingestMcpSignals(...)` call per workspace, `mcp_servers` result map |
| `src/lib/url-safety.ts` | `assertSafeBaseUrl()` — the SSRF guard this adapter depends on |
| `src/lib/entitlements.ts` | `assertConnectorCapability()` — the tier gate this adapter depends on |
| `docs/features/signal-fabric.md` | Parent spec; Phase 3 section updated |

## See also

- [`signal-fabric.md`](./signal-fabric.md) — the full Signal Fabric architecture (all phases)
- [`sf-autotrigger.md`](./sf-autotrigger.md) — the sibling Phase 3 item (governed auto-promotion); doc style mirrored here
- [`../../architecture/integrations.md`](../../architecture/integrations.md) — the connector platform contract
