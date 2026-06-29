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
- [ ] **Live test** (requires founder config): set `DELEGATE_OUTBOUND_ENABLED=1`, `OPENHANDS_ENDPOINT`, `OPENHANDS_API_KEY`; confirm a delegated task reaches OpenHands behind a human-approval gate; confirm `external_job_id` is recorded in `agent_runs.delegate_meta`; confirm `pollDelegateRun` folds a terminal result back to `mission_steps`.

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

Use All-Hands Cloud (the managed service run by All-Hands AI, the OpenHands creators) to test the delegation seam end-to-end today. No infrastructure setup. This proves the Cadence seam works before committing to any hosting decision. After the test passes, BLD-04 moves to ✅.
