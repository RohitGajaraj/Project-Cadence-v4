# BLD-04 — Delegate-out to external coding agents (DelegateProvider seam)

> Status · ◐ Dormant `DelegateProvider` seam + OpenHands adapter shipped 2026-06-21 (lane 3); off by default, live on the founder configuring a BYO endpoint/key AND a registry-wiring increment · Route(s): none (runtime seam) · Owner: the Build / agent-loop lane

## What it does

Lets a Cadence build mission hand a build task off to an **external coding agent** (OpenHands self-host first; Apache-licensed, free), still **governed** by the existing human-approval / trust dial, instead of running every build step in-house. This increment ships the **seam and the OpenHands adapter, dormant**: the contract, the request/response mapping, the resolver, and the dormancy guarantee are built and unit-tested, but outbound delegation is off until the founder supplies a BYO endpoint + key and a follow-up increment wires the tool into the agent loop.

## Why it exists

A2A-style delegate-out (the inverse of inbound A2A) lets the platform scale build throughput and offer "bring your own coding agent" without re-implementing each agent. It is high blast radius (an external agent runs against the repo), so it must stay behind the same approval gate as any irreversible external action, and it must be impossible to fire by accident. The seam follows the proven SANDBOX `ExecProvider` pattern: scaffold the abstraction + ship a safe floor, reserve the paid/BYO backends behind it, and never provision or enable spend autonomously.

## Where to find it

Runtime seam only — no UI in this increment. `src/lib/delegate/`:

- **`provider.ts`** (pure, client-safe): the `DelegateProvider` interface, `DelegateRequest`/`DelegateVerdict` types, the `nullDelegateProvider` dormant floor, the reserved-id list, and the pure OpenHands request/response mapping (`buildOpenHandsRequest`, `mapOpenHandsResponse`).
- **`openhands.server.ts`** (server-only): `delegateEnabled()` (the `DELEGATE_OUTBOUND_ENABLED` flag), the `openHandsProvider` HTTP adapter, `resolveDelegateProvider()`, and `submitDelegation()` (the entry point the future tool calls).

## How it works

- **Dormancy is structural, not a single check.** `openHandsProvider.available` is true only when BOTH `DELEGATE_OUTBOUND_ENABLED` (=`1`/`true`) AND `OPENHANDS_ENDPOINT` are set. `resolveDelegateProvider()` returns the `nullDelegateProvider` floor whenever no available adapter matches. So with the defaults (nothing configured) every delegation attempt resolves to the floor and returns `{ accepted: false, reason: "…disabled…" }` with **no network call** — proven by a unit test that fails if `fetch` is touched while dormant.
- **Fail-safe transport.** When enabled, `submit()` builds the bounded request (`buildOpenHandsRequest`, task text capped at `DELEGATE_TASK_MAX_CHARS`), POSTs to `<endpoint>/api/v1/tasks` with a 30s timeout, and maps the response. Any non-2xx or transport error returns a refusal verdict; it never throws into the caller.
- **No phantom acceptance.** `mapOpenHandsResponse` accepts only on a known accepted-status (`queued`/`running`/…) AND a present `task_id`; a malformed or empty response is a refusal.
- **Governance posture.** Delegation is an irreversible external action. The governed tool that calls `submitDelegation` (deferred — see below) must be classified high blast radius in `tool-consequences.ts` so the loop floors it to at least human `confirm`; the dormancy flag is the backstop that makes it a safe no-op until then.

## Governance & guardrails

- Dormant by default; outbound delegation requires a founder-supplied endpoint + key + the flag.
- Fail-safe (a transport fault returns a refusal, never breaks the build path) and bounded (timeout + task-size cap).
- Pure contract is client-safe; the env/network adapter is `.server.ts` (never bundled to the client).

## Deferred (the wiring increment — needs the pinned chokepoint files / founder config)

- **Tool registration:** wrap `submitDelegation` in a `delegate.openhands` `ToolDef` and add it to `TOOL_REGISTRY` (`registry.server.ts` is a pinned chokepoint file).
- **Governance classification:** add `delegate.openhands` to `tool-consequences.ts` (`irreversible` + `EXTERNAL_TOOLS`) so `isHighRiskTool` floors it, and to `HIGH_RISK_FORCE_REVIEW` / `PAUSE_ON_APPROVAL_TOOLS` (`loop.server.ts`, pinned) so the run pauses for approval.
- **Persistence + callback:** track the external job id (e.g. a `delegate_meta` column on `agent_runs`) and a poll/webhook path to pull the result back and resume the paused run.
- **Founder:** set `DELEGATE_OUTBOUND_ENABLED=1`, `OPENHANDS_ENDPOINT`, `OPENHANDS_API_KEY`.
- **UI + second adapters** (Devin / Claude-Code / SWE-agent — already reserved ids).

## Persistence + poll/fold increment (lane 2, 2026-06-26)

The `delegate_meta` jsonb column on `agent_runs` + the poll/fold cycle:

- **`src/lib/delegate/poll.server.ts`**: `pollDelegateJob(externalJobId)` (dormant-safe: returns `{status:'disabled'}` with no network call when env is unset; maps OpenHands status to `done/failed/running/unknown`; fail-safe transport). `foldDelegateResult({runId,missionId,...})` writes terminal results back to `mission_steps.result` + `agent_runs.delegate_meta.poll_status`/`status`; best-effort (logs errors, never throws).
- **`src/lib/delegate-poll.functions.ts`**: `pollDelegateRun({run_id})` server function — loads the run's `delegate_meta`, calls `pollDelegateJob`, and calls `foldDelegateResult` on terminal statuses. For a future "check status" UI button or cron.
- **`registry.server.ts`**: `delegate.openhands` tool now persists `delegate_meta = {provider, external_job_id, submitted_at}` to `agent_runs` when a delegation is accepted (non-fatal: if the column is absent the update silently fails until the migration runs).
- **Pending migration** (`supabase/migrations/20260626000000_bld04_delegate_job_persistence.sql`): `ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS delegate_meta jsonb` + sparse index. Prepared; applies once SESSION-ORG releases its `supabase/migrations/` claim.
- **Tests**: `src/lib/delegate/poll.test.ts` — 16 new tests (dormancy×3, terminal×4, in-progress×5, fail-safe×5 including edge cases: empty JSON, unknown status, cancelled). Total: 1585 tests, 0 fail; tsc 0 errors.

## Verification checklist

- [x] `bunx tsc --noEmit` clean (0 errors); `bun test` green (1585 tests, 0 fail). `src/lib/delegate/poll.test.ts` covers dormancy (no-network-when-disabled), terminal statuses (done/failed/cancelled), in-progress (queued/running/pending), and fail-safe transport (ECONNREFUSED/non-2xx/malformed JSON/unknown status).
- [x] On the wiring increment + founder config: `delegate.openhands` tool is in `HIGH_RISK_FORCE_REVIEW` (human approval before any delegation leaves), classified irreversible/external in `tool-consequences.ts`. The tool is a safe no-op while `DELEGATE_OUTBOUND_ENABLED` is unset.
- [x] **Migration applied**: `supabase/migrations/20260626000000_bld04_delegate_job_persistence.sql` — `delegate_meta jsonb` column + sparse index on `agent_runs`.
- [ ] **Live test** (BLOCKED — requires publicly accessible self-hosted OpenHands endpoint): Recommended path is Railway.app deployment (~$5/month, ~10 min setup; see [`docs/operations/openhands-activation.md`](../operations/openhands-activation.md)). Once `OPENHANDS_ENDPOINT` is updated in Lovable, trigger a test mission with evidence steps + an explicit delegation request; confirm `agent_runs.delegate_meta` records `external_job_id`; confirm `pollDelegateRun` folds the terminal result back to `mission_steps`. Note: All-Hands Cloud Individual tier does not work (GitHub OAuth auth model — see [§All-Hands Cloud findings](#all-hands-cloud-integration-attempt-and-findings-2026-06-29) below).

## Deployment model decision (2026-06-29)

### Why OpenHands self-host is not the enterprise model

When a Cadence customer is a large enterprise (B2B target), asking them to self-host OpenHands creates four problems:

1. **Operational burden**: Enterprise IT does not want to run another container/server just to use a SaaS product. Every self-hosted component is a support ticket, a security audit surface, and an ops burden on their team.
2. **Multi-tenant risk**: If Cadence hosted one shared OpenHands for all customers, any bug in tenant isolation could let one customer's coding agent see another's repo. That is a critical security failure for enterprise.
3. **Repo access**: OpenHands needs write access to the customer's codebase. Enterprises are extremely careful about what systems get that access. A third-party open-source tool running on Cadence's infra is a harder sell than their own Devin or Copilot Workspace instance, which their security team has already approved.
4. **Cost opacity**: If Cadence hosts OpenHands and its LLM calls, the per-task cost is unpredictable and hard to pass through cleanly. Enterprises want line-item predictability.

### Two customer segments, two right models

**Segment A — Individual / SMB (solo PM, small product team, no existing coding agent)**

This customer wants end-to-end product lifecycle management in one place. They are not going to buy a $500/month Devin subscription separately just to use Cadence's Build step. For them, the right model is:

> Cadence-managed OpenHands — Cadence hosts OpenHands as part of its managed service. One bill, one platform. The customer's LLM key (already BYO'd in Cadence) or a Cadence-managed usage pool powers the coding. The customer does not need to know OpenHands exists; it is the implementation of the "Build" step.

This is feasible because OpenHands is Apache-licensed (free to run) and the LLM cost is the customer's own BYOK spend or a metered usage charge in a higher Cadence tier.

**Segment B — Enterprise (has existing coding agents: Devin Enterprise, GitHub Copilot Workspace, etc.)**

Two sub-perspectives exist here and both are valid:

- **BYO-first (most common today)**: The enterprise already trusts Devin or Copilot Workspace. Their security team has audited it. Their developer workflow is built around it. They do not want to switch; they want Cadence to govern and orchestrate what they already have. Correct model: BYO endpoint — `OPENHANDS_ENDPOINT` points at their Devin or Copilot instance; Cadence adds the governance, memory, and decision layer.

- **Consolidation-first (emerging preference)**: Some enterprises are rationalizing their AI vendor list. One platform, one security audit, one contract, one line item. If Cadence can credibly offer the coding capability as part of its managed runtime (managed OpenHands, white-labelled), that is a real buying consideration — especially for cost optimization and compliance. This maps to BYO-P5 (the managed end-to-end runtime), which is the longer-term product direction.

### Recommended model architecture (the hybrid)

| Customer type | Coding agent model | Who hosts it | Cadence's role |
|---|---|---|---|
| Individual / SMB | Cadence-managed OpenHands | Cadence | Full stack: govern + execute |
| Enterprise (has Devin/etc.) | BYO endpoint | Customer | Governance + memory layer only |
| Enterprise (wants consolidation) | Cadence-managed OpenHands (white-label) | Cadence | Full stack: govern + execute |

The `DelegateProvider` seam supports all three — it is a configuration question, not an architecture change. The customer either points to their own endpoint or Cadence routes to its internal managed instance.

### Implications for pricing

- Individual tier: Cadence-managed coding agent included (metered by usage / AI spend)
- BYO tier: Customer's coding agent endpoint; no managed agent cost
- Enterprise managed: Premium tier, includes the coding agent runtime

### Immediate next step (the live test)

**All-Hands Cloud is ruled out** (see [§All-Hands Cloud findings](#all-hands-cloud-integration-attempt-and-findings-2026-06-29) below — not a server-to-server API). The fastest path to a live end-to-end test is deploying OpenHands on **Railway.app** (~$5/month, ~10 min setup, permanent public HTTPS URL), then:

1. Set `OPENHANDS_ENDPOINT` in Lovable project settings to the Railway URL
2. Ensure `DELEGATE_OUTBOUND_ENABLED=1` is set (already configured in Lovable)
3. Trigger a test mission: open a mission, gather 2-3 evidence items, then explicitly request "delegate to OpenHands"
4. Confirm `agent_runs.delegate_meta` stores `external_job_id`; confirm `pollDelegateRun` folds the result back

After the live test passes, BLD-04 moves to ✅. Full steps: [`docs/operations/openhands-activation.md`](../operations/openhands-activation.md).

### LLM key decision (2026-06-29, updated)

The original plan was to use Cadence's own Anthropic API key in OpenHands. **That key does not exist** — Cadence currently has no Anthropic key in its env. Cadence's runtime has: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `COHERE_API_KEY`, and the webhook token `OPENHANDS_API_KEY=sk-oh-...` (only valid as auth to the self-hosted OpenHands REST API, not as an LLM key).

The adapter now handles this automatically via `resolveLlmConfig()` (commit `cfaa0d9575`):

| Priority | Env var | Model |
|----------|---------|-------|
| 1 | `ANTHROPIC_API_KEY` | `anthropic/claude-sonnet-4-6` |
| 2 | `OPENAI_API_KEY` | `openai/gpt-4o` |
| 3 | `GEMINI_API_KEY` | `gemini/gemini-2.0-flash` |
| 4 | `COHERE_API_KEY` | `cohere/command-r-plus` |
| none | — | falls back to OpenHands instance-level config |

With `OPENAI_API_KEY` already configured in Lovable, the live test will use `openai/gpt-4o` automatically. No code change needed — just deploy OpenHands and wire the endpoint.

See [`docs/strategy/session-decisions.md`](../strategy/session-decisions.md) 2026-06-29 entry for the full BYOK model-agnostic rationale. Activation steps: [`docs/operations/openhands-activation.md`](../operations/openhands-activation.md).

---

## All-Hands Cloud integration attempt and findings (2026-06-29)

### What was attempted

The founder signed up for All-Hands Cloud Individual plan (`app.all-hands.dev`) expecting it to provide a REST API endpoint compatible with self-hosted OpenHands. The `sk-oh-zZBnvQmzdiengFcSW9UGEW5o8OfTwc5H` key was obtained from the API Keys section of the All-Hands Cloud settings panel and configured in Lovable.

Multiple payload and auth configurations were tested against `https://app.all-hands.dev/api/v1/tasks`:

| Attempt | Auth header | Body | Result |
|---------|------------|------|--------|
| 1 | `Authorization: Bearer sk-oh-...` | standard | 405 Method Not Allowed |
| 2 | `X-User-Token: sk-oh-...` | standard | 401 NoCredentialsError |
| 3 | `Authorization: Bearer sk-oh-...` | with Gemini LLM key inline | 401 NoCredentialsError |
| 4 | `Authorization: Bearer sk-oh-...` | no repo field | 401 NoCredentialsError |

A test mission was also run in the Cadence platform while All-Hands Cloud envvars were set in Lovable. The mission produced 10 queue steps but routed through the Studio pipeline (`studio.commit`, `studio.pr.*` tools) rather than `delegate.openhands`, because the mission goal did not include evidence-gathering steps before delegation.

### Root cause

**All-Hands Cloud uses GitHub OAuth as its auth model, not simple API keys.**

The `sk-oh-` key format is the All-Hands outbound webhook token — it is used when All-Hands Cloud sends events TO a webhook endpoint you register. It is NOT a bearer token for making calls TO the All-Hands Cloud REST API. The All-Hands Cloud web application authenticates users via GitHub OAuth sessions in the browser; there is no equivalent token-based auth for server-to-server REST API calls.

This is a fundamental architectural mismatch. Cadence runs as a Cloudflare Worker (server-side, no browser) and needs to make outbound REST calls. All-Hands Cloud does not expose an authenticated REST API for external services to submit tasks.

### Why the Cloudflare Worker -> localhost gap matters

Even if a local Docker OpenHands instance were running on `localhost:3000`, a Cloudflare Worker running in the cloud edge network cannot reach a `localhost` address. `localhost` in a CF Worker refers to the Worker's own process, which has no OpenHands container. Any self-hosted OpenHands instance must be on a **public HTTPS URL** to be reachable from Cadence.

This rules out:
- Local Docker (no public URL without ngrok/Cloudflare Tunnel)
- All-Hands Cloud Individual (GitHub OAuth, not server-to-server REST)

### Recommended path forward

**Railway.app self-hosted OpenHands** (~$5/month, permanent public HTTPS URL):

1. Connect GitHub to Railway; create a new service from `docker.all-hands.dev/all-hands-ai/openhands:0.39`
2. Set Railway env: `SANDBOX_RUNTIME_CONTAINER_IMAGE=docker.all-hands.dev/all-hands-ai/runtime:0.39-nikolaik`, `PORT=3000`, and LLM vars (`LLM_MODEL=openai/gpt-4o`, `LLM_API_KEY=<same OPENAI_API_KEY>`)
3. Railway auto-provisions a public HTTPS domain like `https://openhands-<hash>.railway.app`
4. Update Lovable: `OPENHANDS_ENDPOINT=https://openhands-<hash>.railway.app`
5. Confirm `DELEGATE_OUTBOUND_ENABLED=1` is set

Other options: Render.com (free tier; cold starts), DigitalOcean App Platform (~$7/month). For local testing only, ngrok or Cloudflare Tunnel can expose `localhost:3000` temporarily.

### What was learned about the Studio vs delegate.openhands routing

During the test mission ("Test Project Cadence"), the agent ran 10 steps but never fired `delegate.openhands`. This happened because:

- The mission goal was framed as a direct build task, not as a request to delegate
- `delegate.openhands` requires `evidence_ids` (pre-collected evidence items) before it can fire — it is an evidence-first tool
- Without an evidence-gathering phase first, the agent defaulted to the Studio pipeline (in-house build path)

For the live test to actually exercise BLD-04, the test mission must:
1. Start with a discovery/research phase that creates 2-3 evidence items in the DB
2. Then explicitly request delegation ("delegate this to OpenHands" in the mission goal or next step)
3. The approval queue should then show `delegate.openhands` awaiting human approval

### Status

- Code: complete, merged, tested (1585 tests, 0 fail; `cfaa0d9575`)
- Env: `DELEGATE_OUTBOUND_ENABLED=1` set in Lovable; `OPENHANDS_ENDPOINT` not yet set (Railway deployment pending)
- Blocker: founder needs to deploy OpenHands to Railway and set `OPENHANDS_ENDPOINT`
- Est. time to unblock: ~10-15 min (Railway signup + Docker service + env var)
