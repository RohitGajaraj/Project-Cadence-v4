# v6 Phase 1 — The Loop Runs Itself

> Status · Shipped 2026-06-14 (code on `main`; two migrations apply on the next Lovable sync) · Routes `/missions`, `/missions/$id` · Owner agent `orchestrator` (+ every specialist)

## What it does

A multi-hop orchestrated mission now runs **unattended**. Once the orchestrator plans the DAG and dispatches the first wave, the system carries the mission to completion on its own: it notices when a specialist finishes, dispatches the steps whose dependencies just cleared, retries a hop that failed transiently, and finalizes when every step is terminal — without the operator pressing **Advance** and without re-invoking the orchestrator LLM each wave. This closes the gap the runtime audit named (Appendix B of the [v6 doc](../strategy/v6-agentic-product-os-2026-06-13.md)): *"mid-loop hops need the orchestrator re-invoked; hop failure stops the mission, no retry."*

## Why it exists

Phase 0 made the Chief of Staff real but left autonomy *claimed* ahead of *wired*: missions stalled after wave-0 because nothing re-fired the orchestrator, a single failed hop killed the branch, the step budget was static, and the `memory_refs[]` contract field added in W5 was never populated. Phase 1 wires all four — the honest next step on the North Star (genuine autonomous end-to-end execution under governance), per [`plan.md`](../../plan.md) §4 (2026-06-14 entry) and [v6 §9](../strategy/v6-agentic-product-os-2026-06-13.md).

## Where to find it

- `/missions/$id` — a multi-step mission advances on its own; the **Advance** button is now a manual "push it now" affordance, not a requirement.
- `/swarm` — the Swarm HUD shows steps moving from dispatched → running → done across waves without operator action.
- No new route or panel — this is execution-layer wiring made visible on the existing surfaces.

## Demo script (≤ 90s)

1. On the seeded demo workspace, open `/missions` and start an orchestrated mission with a goal that needs ≥ 2 dependent steps (e.g. "research the off-hours-routing opportunity, then draft a PRD for it").
2. Watch `/missions/$id`: the orchestrator plans a small DAG and dispatches the root step(s). **Do not press Advance.**
3. Within ~1–2 minutes the root specialist completes; the dependent step dispatches itself; the DAG fills in wave by wave.
4. Open a completed hop's handoff payload — it carries a **Memory** section (the memory the sender threaded into the hop).
5. When all steps are terminal the mission finalizes itself (`completed`, or `completed_with_failures` if a hop exhausted its retries).

## How it works

- **Deterministic auto-advance** — `src/lib/ai/mission-advance.server.ts` → `advanceMissionCore`: reflect child outcomes → dispatch every newly-ready step → finalize a terminal DAG. **Model-free** (the orchestrator LLM only does the initial plan; re-planning is already rejected, so re-invoking it added cost without behavior).
- **Trigger** — the existing per-minute `resume-runs` cron (`src/routes/api/public/hooks/resume-runs.ts`) calls `advanceMissionCore` for every running mission. No new pg_cron job, so nothing waits on a migration to start firing.
- **Concurrency safety** — claim-first CAS (`planned→dispatched` before enqueue) so overlapping ticks never double-dispatch; a step stranded `dispatched` with no `run_id` (worker eviction mid-enqueue) is recovered after a 3-min window.
- **Bounded hop retry** — `mission_steps.{attempts,max_attempts,next_retry_at}` (migration `20260614090000`); `next_ready_mission_steps` honours the backoff; pure policy in `src/lib/ai/retry.ts` (default 2 attempts = one auto-retry, exponential backoff).
- **Adaptive step budget** — `src/lib/ai/budget.ts` → `adaptiveStepBudget` replaces the static `maxStepsFor`: role base + earned-trust headroom (`arc`) + orchestrator-scales-with-DAG-size, under a hard ceiling; the orchestrator base keeps the proven 14 so the initial run never regresses.
- **`memory_refs[]` populated** — `src/lib/ai/memory.server.ts` → `recallMemoryRefs` returns the memory `id`s the RPC already exposed; each dispatched hop threads relevant memory into the handoff and writes `agent_memory.last_used_at`. `match_agent_memory` now scopes by `COALESCE(auth.uid(), for_user)` (migration `20260614091000`) so the service-role sweeper path actually matches.
- **Architecture contract:** [`../../architecture/orchestration.md`](../../architecture/orchestration.md) (§ A2A handoff → "The loop runs itself").

## Governance & guardrails

- Auto-advance **dispatches**; it never bypasses approval gates. A specialist hop still runs through the trust arc / `agent_tools.mode` → `resolveApprovalMode`, so a write tool at `observing`/`proving` still queues a review/confirm. Autonomy is earned via the arc, not granted by the loop.
- Retry is **bounded** (default 2 attempts) and backed off — a permanently-failing hop (e.g. missing agent) terminalizes rather than looping.
- The sweeper advances at most 20 running missions per tick; all writes are RLS/workspace-scoped (admin client on the cron path, user client on the manual `advanceMission`).

## Verification checklist

- `bun test` green (pure budget/retry policy).
- `bun run build` green.
- On `/missions/$id`, a ≥ 2-wave mission reaches a terminal state with **no** operator Advance press.
- After the two P1 migrations apply (Lovable sync): a deliberately-failed hop shows a retry (a second child run for the same step) before the mission finalizes; a dispatched hop's handoff payload carries non-empty `memory_refs`.

## Known limits / out of scope

- **Migration-apply gate (unchanged pattern):** `20260614090000` (retry columns) + `20260614091000` (`match_agent_memory` `for_user`) apply on the next Lovable sync. Until then the code degrades gracefully — auto-advance + budgets work; retry is off (a failed hop terminalizes) and `memory_refs` on the autonomous path carries reflections only.
- A zero-step mission with a stale **unconsumed** handoff message can sit `running` (pre-existing; tracked in [`../planning/known-issues.md`](../planning/known-issues.md) KI-15).
- > 20 simultaneously-running missions per tick can be advanced round-robin across ticks (KI-16) — high-scale only.
- Execution-delegation under governance (Phase 2) and pause/steer-from-graph remain out of scope here.

## Related

- [`../../plan.md`](../../plan.md) §4 — 2026-06-14 build-log entry
- [`../../architecture/orchestration.md`](../../architecture/orchestration.md) — orchestration contract
- [`../strategy/v6-agentic-product-os-2026-06-13.md`](../strategy/v6-agentic-product-os-2026-06-13.md) §9 (Phase 1) + Appendix B
- Siblings: [`f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md) · [`f-agent-3-event-reactor.md`](./f-agent-3-event-reactor.md)
