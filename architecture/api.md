# architecture/api.md: API & interface reference

> **What this is.** The full map of every way something talks to Cadence: the public HTTP routes a browser or a script hits, the internal server-function surface the app calls, the agent-to-agent handoff contract the mesh runs on, and the dual-user interfaces (MCP server plus public API) that are still on the roadmap. Every entry is marked **Built**, **Partial**, or **Missing/Planned** so the claim never outruns the wiring.
>
> Canon: [`../docs/strategy/v7-agentic-product-os-2026-06-14.md`](../docs/strategy/v7-agentic-product-os-2026-06-14.md) (§8 dual-user, §12 M-D). Rules: [`../AGENTS.md`](../AGENTS.md). Voice: [`../docs/conventions/humanized-output.md`](../docs/conventions/humanized-output.md).
>
> This file does not duplicate two siblings. The AI chokepoint contract (`callModel` / `callModelStream`, the governance and budget pipeline) lives in [`runtime.md`](./runtime.md). The connector platform (`resolveProviderAuth`, the credential chain, BYO keys) lives in [`integrations.md`](./integrations.md). Where an interface leans on those, this file links rather than restates.

## How to read the status tags

- **Built:** shipped on `main`, runs today.
- **Partial:** the wiring exists but a gate blocks it from running on real data, or only part of the contract is filled. The gap is named.
- **Missing/Planned:** designed, not built. Mapped to a v7 milestone (M-0 through M-D).

---

## 1. Public HTTP routes

These are the only routes that take a request from outside the authenticated app shell. They live in `src/routes/api/`. Two auth models are in play: a **user bearer token** (Supabase session JWT) for app-facing routes, and a **shared-secret or per-workspace token** for machine callers.

### 1.1 `POST /api/chat`, streaming chat (Built)

`src/routes/api/chat.ts`. The SSR streaming chat endpoint behind the `/chat` surface and the copilot.

- **Method:** `POST` (plus `OPTIONS` for CORS preflight).
- **Purpose:** conversational answers grounded in workspace RAG, optional multi-query web research, agent-loop dispatch, and mission creation. Runs through `callModelStream` with `surface='chat'`.
- **Auth:** `Authorization: Bearer <supabase-jwt>`. The handler builds a per-request Supabase client that acts *as the user*, so RLS applies to everything it reads. No header, no token, or a non-`Bearer` scheme returns `401`.
- **Request:** JSON. The conversation (`messages: {role, content}[]`), the chosen model, the workspace, and research-mode flags. Models that only route through a BYO key (`anthropic/*`, `claude*`, `deepseek/*`, `xai/*`, `grok`, `moonshot/*`) are detected and require the user to have a matching key, otherwise the handler returns a friendly note instead of a hard error.
- **Response:** Server-Sent Events, SSE protocol v2. The order on every path is: zero or more `{"status":{phase,label}}` research-progress events, then token chunks (`choices[0].delta.content`), then exactly one `meta` event, then `[DONE]`. The `meta` event carries `{model, via, latency_ms, tokens_in, tokens_out, cost_usd, sources[], web_used, workspace_chunks, research?}`. Fields may be `0` or empty when unknown; a consumer never blocks on them. The meta block is streamed live only, never persisted (the `messages` table has no metadata column).
- **Notes:** a governance halt (kill switch or mission cap) is emitted as a `status='blocked'` `ai_events` row *before* the stream opens, so a paused workspace never streams a token. See [`runtime.md`](./runtime.md) for the full halt pipeline.

### 1.2 The Build (Studio) chat surface (Partial)

CLAUDE.md and older docs reference a `src/routes/api/studio-chat.ts` route. **It is not on disk.** The Build/Studio surface (`/build`, `/build/$missionId`) does not run a dedicated streaming chat route today. It drives the agent loop directly through the server-function surface (`build.functions.ts`, `studio.functions.ts`) and the `studio.*` engine tools in the tool registry. The streaming-chat interface for Build is **Missing/Planned**; the underlying staging-to-PR engine it would talk to is **Built** (see [`integrations.md`](./integrations.md) and the `studio.stage` / `studio.commit` / `studio.pr.open` / `studio.pr.merge` tools). If a streaming Build chat route lands later, it follows the `chat.ts` reference shape and adds a `studio` `CallSurface`.

### 1.3 `POST /api/public/ingest-signals`, webhook signal ingest (Built)

`src/routes/api/public/ingest-signals.ts`. The continuous-ingest door: turn any external POST (Zapier, a Slack outgoing webhook, a form, a script) into `signals` rows.

- **Method:** `POST`.
- **Purpose:** machine-friendly signal ingest. This is the one SENSE source that runs today without connector OAuth, which is why v7 §2 calls SENSE "webhook-only in practice."
- **Auth:** a per-workspace ingest token, *not* the cron-caller secret. Callers send `Authorization: Bearer <token>` or `x-ingest-token: <token>`. The token is looked up in `ingest_tokens` (where `revoked_at IS NULL`) via the service-role client to resolve `user_id` plus `workspace_id`. A missing token returns `401` with `{ok:false, error:"missing ingest token"}`; an unknown one returns `401` `"invalid ingest token"`. Tokens are minted and revoked in `ingest.functions.ts`.
- **Request:** either a batch `{ signals: [{title, content?, source?}, ...] }` (max 50) or a single bare `{title, content?, source?}`. `title` is required (1 to 500 chars); `content` is optional (max 5000). Unknown keys are stripped. A non-JSON body returns `400 "invalid JSON body"`; a shape mismatch returns `400` with the expected-shape message.
- **Response:** `{ok:true, created:<n>}` on success. Errors return `{ok:false, error}` with the status above; an insert failure returns `500`.
- **Why the explicit workspace stamp matters:** inserted rows stamp `workspace_id` directly, because the column default returns `NULL` without an auth context and the `signals_reactor_fanout` trigger matches on `workspace_id`. The explicit stamp is what lets a webhook signal enter the `signal.created` auto-pipeline (the `event_queue` fan-out).

### 1.4 `GET /api/public/a2a/agents/cadence/card`, A2A agent card (Partial)

`src/routes/api/public/a2a.agents.cadence.card.ts`. The discovery document that describes Cadence as an Agent-to-Agent peer, per the agent2agent.dev spec.

- **Method:** `GET` (plus `OPTIONS`). Unauthenticated, cacheable (`Cache-Control: public, max-age=300`), CORS-open.
- **Purpose:** let another agent discover what Cadence can do and where to send work.
- **Response:** a JSON agent card with `schema_version`, `name`, `version`, `description`, `provider`, `documentation_url`, an `endpoints` block, an `authentication` block (`schemes:["bearer"]`), a `capabilities` block (`streaming:true`, `push_notifications:false`, `multi_turn:true`), declared `skills` (search signals, draft a PRD, propose a sprint, summarize traces), and a `policies` block (`destructive_actions_require_approval:true`, `pii_egress_filtered:true`, `rate_limit_per_minute:60`).
- **Why Partial:** the card advertises three endpoints (`message_send`, `message_stream`, `tasks`) at `/api/public/a2a/*`. **Those endpoints are not built yet** (Missing/Planned, M-D). The card is a published intent; the A2A *server* it points at does not answer. The card should also be served from `/.well-known/agent.json` once that edge route is wired (not yet done).

### 1.5 `GET /api/public/connect/github/callback`, GitHub OAuth callback (Built)

`src/routes/api/public/connect/github/callback.ts`. The GitHub App installation callback. Completes the OAuth installation handshake and writes the `connections` row. Connector mechanics (the `resolveProviderAuth` chain, token minting, the workspace-binding model) live in [`integrations.md`](./integrations.md); this is only the redirect landing route. Note: per the founder ruling, user-facing connectors are OAuth-only, and the connectors are wired but **not yet operational** pending OAuth-client registration (v7 §2, gap 3).

### 1.6 Cron / webhook hooks: `POST /api/public/hooks/*` (Built)

`src/routes/api/public/hooks/`. The background workers that make the loop run itself. Every one is a `POST`, poked by `pg_cron`, and runs on the service-role client (`supabaseAdmin`, RLS-bypassing).

- **Auth (shared for all hooks):** `requireHookCaller` (`hooks/-_auth.server.ts`). The caller must present the Supabase publishable/anon key as a shared secret in `apikey`, `x-cron-key`, or a `Bearer` `Authorization` header. The anon key is already in the browser bundle, so this provisions no new secret; the key acts purely as a "this call came from our cron, not the open internet" gate. A mismatch returns `401`; a missing configured key returns `500`.

| Hook | Schedule | What it does | Status |
|---|---|---|---|
| `resume-runs` | every minute | Promotes `queued` / stale `running` / resolved `waiting_approval` runs (batch 5) via `resumeAgentLoop`, then calls `advanceMissionCore` on up to 20 running missions. This is the heartbeat of "the loop runs itself." Returns `{ok, resumed[], failed[], advanced[]}`. | Built |
| `approvals-tick` | every minute | Executes approved gated tool calls; notifies on denials. | Built |
| `event-reactor-tick` | every minute | Drains `event_queue` rows with `approval_mode='auto'` (batch 10); dispatches each to its target agent. | Built |
| `agent-tick` | scheduled | Runs cron-scheduled agents whose `cron_schedule` is due. | Built |
| `outcome-tick` | hourly | Checks GitHub issue close state for approved PRDs with linked issues; stamps `shipped_at`; distils the shipped outcome into memory. | Built |
| `indexer-tick` | hourly (:07) | Chunks and embeds recent workspace content into `rag_chunks` (idempotent via content hashes). | Built |
| `eval-tick` | scheduled | Picks up to 20 recent `ai_events` lacking an `ai_evals` row; runs the LLM judge over 7 dimensions. | Built |
| `eval-suite-tick` | daily (03:00) | Runs enabled eval suites whose `schedule_cron` is set and `last_run_at` is stale. | Built |
| `drift-tick` | daily (04:00) | Runs `runDriftForUser` for users active in the last 30 days; opens/resolves drift incidents. | Built |
| `memory-tick` | daily | Deletes low-value `agent_memory` (importance ≤ 2 and unused for 30 days). The decay sweep that keeps the moat clean. | Built |

The full halt, budget, eval, and drift behavior these hooks invoke is documented in [`runtime.md`](./runtime.md) and [`orchestration.md`](./orchestration.md). This table is the *interface* (route, method, auth, cadence), not the internals.

---

## 2. Internal server-function surface

This is how the authenticated app talks to itself. It is not a REST API in the usual sense: there are no hand-rolled endpoints. Instead, each domain exposes typed TanStack server functions, and the client calls them like functions.

### 2.1 The pattern (Built)

A feature is two files in lockstep:

1. **Server logic** in `src/lib/<domain>.functions.ts`. Each function is built with `createServerFn({ method })`, declares an input validator (a Zod schema), attaches the auth middleware, and runs a `.handler({context, data})`. There are roughly 50 such modules (`decisions`, `discovery`, `missions`, `today`, `gauntlet`, `trust`, `studio`, `build`, `budgets`, `guardrails`, and the rest).
2. **Consumption** in the matching `src/routes/_authenticated.<domain>.tsx`, through TanStack Query (`useQuery` / `useMutation` with stable `queryKey`s).

A representative shape, from `decisions.functions.ts`:

```ts
export const listDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ /* ... */ }).partial().parse(i ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context; // RLS client, acting as the user
    // ...
  });
```

`createServerFn` generates the transport. The function is imported and called directly from the client; TanStack serializes the call to the server, runs the validator, runs the middleware, then the handler. The validator is the boundary: every input is parsed before the handler sees it.

### 2.2 The auth-header model (Built)

Two middlewares carry the bearer token to the handler:

- **`requireSupabaseAuth`** (`src/integrations/supabase/auth-middleware.ts`, generated): reads `Authorization: Bearer <jwt>` off the request, rejects anything that is missing or not a `Bearer` token, and builds a Supabase client whose global headers carry that token. That client acts *as the user*, so every query inside the handler is RLS-scoped. This is the same token model as `/api/chat`.
- **`attachSupabaseAuth`**: a global server-fn middleware so server functions auto-carry the bearer token without each one re-reading the header (see [`data.md`](./data.md)).

The contract: handlers receive `context.supabase` (the user's RLS client) and never the service-role client. The service-role client (`client.server.ts`) is reserved for the cron hooks and the connector credential chain. No server function reads a provider env var directly; that path goes through `resolveProviderAuth` ([`integrations.md`](./integrations.md)).

### 2.3 Surface inventory (Built)

The module names are the surface. Each maps to one authenticated route and one domain:

- **Sense / discovery:** `discovery`, `ingest`, `reactor`, the signals paths, `themes` / `opportunities`.
- **Decide:** `decisions`, `decisions-share`, `today`, `governance`, `gauntlet`, `trust`.
- **Define / build:** `missions`, `orchestrator`, `swarm`, `studio`, `build`, `docs`, `lineage`.
- **Ship / learn:** `outcome`, `evals`, `drift`, `analytics`, `traces`, `dashboard`.
- **Platform:** `agents`, `agent_loop`, `budgets`, `guardrails`, `prompts`, `profile`, `workspaces`, `connections`, `integrations`, `byokeys`, `ambient`, `onboarding`, plus the per-connector modules (`linear`, `notion`, `gdocs`, `calendar`, `meetings`).

Adding a surface means adding a `*.functions.ts` module and its route, following an existing pair rather than inventing a new data-flow shape. This is an internal interface, not a published one. **It is not stable for external callers.** External integration is the job of the planned MCP server and public API (§4), which wrap a curated subset behind a versioned contract.

---

## 3. The A2A handoff contract

The current agent-facing interface is internal: the typed `HandoffPayload` that one agent hands to the next. This is the seam the v7 moat threads through, so it is documented as a first-class contract even though no external agent can call it yet.

### 3.1 `HandoffPayload` (Built)

`src/lib/ai/handoff.server.ts`. A mission groups several `agent_runs` under one operator intent. Each hop is recorded as an `agent_messages` row with a *structured* payload, never a prompt-stuffed string. When the receiver run starts, the loop calls `consumeInboundHandoff` to fetch the latest unconsumed message and `renderHandoffBlock` to inject it into the receiver's system prompt, the same way the workspace brief is injected.

```ts
export type HandoffPayload = {
  task: string;                                          // the headline the receiver solves next
  context?: Record<string, unknown>;                     // structured context the sender gathered
  artifacts?: { kind: string; id: string; title?: string }[]; // stable IDs the receiver can read with its own tools
  open_questions?: string[];                             // what the sender leaves to the receiver's judgement
  constraints?: string[];                                // hard limits the receiver must respect
  memory_refs?: { id: string; summary?: string }[];      // the moat seam (see below)
};
```

### 3.2 `memory_refs`, the moat seam (Built, threaded)

`memory_refs` is the field added in v6 Phase 0 and now wired end to end. It carries the `agent_memory` ids the sender relied on, plus a short human summary, so the receiver and the trace can both see what informed the handoff. It is the seam through which compounding memory threads across hops.

Two guarantees make it honest:

- **Phantom-guarded at enqueue.** `enqueueHandoff` validates every id against real `agent_memory` rows the user owns before the payload reaches the receiver. A bug or a hand-crafted handoff cannot make the receiver cite a memory that does not exist. On a transient query error it keeps the refs as-is rather than strip valid ones.
- **Populated where recall context exists.** `advanceMissionCore` calls `recallMemoryRefs` for each dispatched step's goal and threads the result into the payload. The field stays optional until the loop fills it, so the claim never outruns the wiring.

### 3.3 Enqueue and consume (Built)

- **`enqueueHandoff`** inserts the `agent_messages` row *and* a `queued` child `agent_runs` row for the receiver. The `resume-runs` sweeper picks the queued run up on its next tick. It also strips phantom `memory_refs`.
- **`consumeInboundHandoff`** fetches the latest unconsumed `kind='handoff'` message addressed to the starting run and marks it consumed atomically (`consumed_by_run_id`), so a message is delivered once.
- **`maybeCompleteMission`** finalizes the mission when no unconsumed messages remain and every step is terminal, and auto-captures a `decisions` row.

`agent_messages` also carries `kind='steer'` operator-guidance messages, read mid-loop and injected as guidance (see [`orchestration.md`](./orchestration.md)).

### 3.4 The live caveat (Partial)

The contract is real and the loop runs on it, **but** the orchestrator prompt names agent slugs that are not seeded (`discovery`, `growth`, `analyst`), while the shipped roster is `discovery-scout`, `strategist`, `prd-writer`, `builder` plus the orchestrator. `mission.plan` validates planned slugs against the seeded roster and throws on a phantom slug, so any multi-agent mission with a sensing step dies before the first handoff. This is the v7 M-0 "fix first" bug: the *contract* is Built; a multi-agent mission running on it is **Partial** until the slug mismatch is fixed. See v7 §2 (gap 1) and §7.

---

## 4. The dual-user surface: MCP server plus public API

v7 §8 commits Cadence to being agent-friendly *and* human-friendly, and v7 §12 M-D scopes the build. None of this exists on `main` yet. It is the external interface that does the most for distribution, and it is pulled forward in the risk plan (v7 §14: the fast-follower window may be 6 to 12 months, so do not wait for M-D to start the MCP/API contract).

### 4.1 MCP server (Missing/Planned, M-D)

`src/routes/api/mcp.ts` (planned). Expose a curated subset of the surface, tasks, PRDs, agents, calendar, discovery, copilot, as MCP tools so an external agent (Claude Desktop, Cursor, ChatGPT) operates Cadence.

- **Auth:** per-user scoped `mcp_tokens`.
- **Telemetry:** every invocation logs `surface='mcp_server'` through the chokepoint, so cost, guardrails, and traces apply identically to MCP calls (no second runtime). This reuses the existing `CallSurface` plumbing in [`runtime.md`](./runtime.md).
- **Safety:** destructive MCP calls reuse the same approval gates as in-app tool calls. Capability scopes per token; per-tool rate limits; prompt-injection guard on results; PII egress check.

### 4.2 Public API (Missing/Planned, M-D)

A documented, versioned HTTP API over the same curated subset, with stable request/response shapes and its own auth (scoped API keys, not the internal bearer model). This is the contract external developers build against, distinct from the internal server-function surface in §2, which is explicitly *not* a stable external interface. Pulling this forward also enables the B2B2B fallback in v7 §14 (embed Cadence's memory/decision layer inside Jira or Linear via MCP if the standalone window closes).

### 4.3 A2A server endpoints (Missing/Planned, M-D)

The three endpoints the agent card in §1.4 already advertises (`message/send`, `message/stream`, `tasks/*`), backed by `a2a_tasks` / `a2a_messages`, plus an A2A client (`delegate_to_agent`, an `a2a_peers` registry) and the `/.well-known/agent.json` edge route. Building these makes the published card answerable and turns the internal `HandoffPayload` contract (§3) into a surface external agents can reach. Deferred behind the standalone-product loop closing on real data (v7 §2, §12).

---

## Related

- [`runtime.md`](./runtime.md): the AI chokepoint, `callModel` / `callModelStream`, governance halts, budgets, guardrails, the `CallSurface` union. Every route and server function here that calls a model passes through it.
- [`integrations.md`](./integrations.md): connectors, the `resolveProviderAuth` credential chain, BYO keys, and the planned agent-interop layer (MCP client, A2A peers).
- [`orchestration.md`](./orchestration.md): the agent loop, mission DAG, trust arc, and the `resume-runs` advance that the §1.6 hooks drive.
- [`data.md`](./data.md): the RLS model, the server boundary, and the tables every interface here reads and writes.
- [`security.md`](./security.md): the kill switch, approval gates, and the threat model behind the auth choices above.
- [`../docs/strategy/v7-agentic-product-os-2026-06-14.md`](../docs/strategy/v7-agentic-product-os-2026-06-14.md): §8 dual-user, §12 M-D, and the gaps (§2) this file marks against.
