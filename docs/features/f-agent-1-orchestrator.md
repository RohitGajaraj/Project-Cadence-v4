# F-AGENT-1: Orchestrator + multi-agent missions

> _Created: 2026-06-06 · Last updated: 2026-06-14_

> **Status:** ✅ Shipped 2026-06-06 · **Routes:** `/missions`, `/missions/$id` · **Owner agent:** `orchestrator` (seeded per user)

## What it does

Turns a single operator goal into a multi-agent mission. The `orchestrator` agent plans the goal into a 1 to 6 step DAG, dispatches the right specialist for each step, observes their progress, and finalises when every step is terminal. Specialists run asynchronously via the existing resume cron, no new infrastructure.

## Why it exists

The substrate (chokepoint, agent runs, A2A handoffs, trust gates) had been in place since Bundle 4, but every "mission" was effectively single-agent, `agent.handoff` was a primitive without a planner above it. Without an orchestrator, "agent-native OS" was a marketing phrase for a single-agent planner-executor. Full rationale: [`../../plan.md`](../../plan.md) §4 entry dated 2026-06-06 (F-AGENT-1).

## Where to find it

- **Nav:** sidebar → **Agents** group → **Missions**.
- **`/missions`**. List of all missions plus an inline **Plan & dispatch** composer (title + goal → one button).
- **`/missions/$id`**. Live DAG with deps + status pills, plus an **Advance** button that re-invokes the orchestrator to dispatch the next ready wave.

## Demo script (≤ 90 seconds)

1. Sign in as `demo@redcadence.app`.
2. Click **Missions** → fill the composer: title "Reduce onboarding drop-off", goal "Investigate signals from the last week, draft a PRD for the top fix, and queue an engineering plan."
3. Click **Plan & dispatch**. "The orchestrator now plans the work into a step graph and dispatches the right specialist for each step."
4. Click into the mission. Show the DAG with status pills. "Each node is a real agent run, each edge is a structured handoff, not a pasted summary."
5. Click **Advance** to push the next ready wave. (Once F-AGENT-3 is active, this happens automatically.)

## How it works

- **Seed:** `seed_orchestrator_agent(p_user_id)` SECURITY DEFINER RPC, idempotent re-seed bumps the system prompt + tool wiring.
- **DAG table:** `mission_steps`: `(mission_id, idx, agent_slug, sub_goal, depends_on int[], status, run_id, message_id, result, error, rationale, dispatched_at, completed_at)`. RLS scoped to `auth.uid()`; unique on `(mission_id, idx)`.
- **SQL helper:** `next_ready_mission_steps(mission_id)` returns the rows whose `depends_on` are all `status='done'`.
- **Four tools** in `src/lib/ai/tools/orchestrator.server.ts`, wired into `src/lib/ai/tools/registry.server.ts`:
  - `mission.plan`. Calls a sub-model with the user's actual specialist roster, asks for strict JSON `{summary, steps:[{agent_slug, sub_goal, depends_on, rationale}]}`, 1 to 6 steps cap, validates every slug.
  - `mission.dispatch`. Reads the SQL helper, calls `enqueueHandoff()` per ready step, marks the step `dispatched`.
  - `mission.observe`. Reflects child run statuses, returns a per-step state + status histogram + `all_terminal` boolean.
  - `mission.finalize`. Requires `all_terminal`, marks the mission `completed` or `completed_with_failures`.
- **Loop cap:** per-agent via `maxStepsFor(agentSlug)`: orchestrator gets 14 (plan + observe/dispatch cycles + finalize), specialists keep 6.
- **Server fns** in `src/lib/orchestrator.functions.ts`: `ensureOrchestrator`, `startOrchestratedMission`, `advanceMission`, `listMissionSteps`.

## Governance & guardrails

- **Arc-gated tools.** The dispatch primitive (`agent.handoff`) is arc-gated like any other write. Observing agents still queue approvals.
- **Per-workspace concurrency cap.** The FND-RUNTIME limit (5 concurrent `running` runs) applies across all missions in the workspace.
- **Failure policy.** Option-b: hop failures stop the mission; the operator re-dispatches manually via **Advance**.

## Verification checklist

1. `/missions` shows the **Plan & dispatch** composer.
2. Submitting a non-trivial goal creates a mission with ≥ 2 `mission_steps` rows.
3. `/missions/$id` shows the DAG; running specialists appear as child runs.
4. **Advance** dispatches the next ready wave (only when prior deps are `done`).
5. The mission transitions to `completed` (or `completed_with_failures`) when every step is terminal.

## Known limits / out of scope

- No automatic re-wake until F-AGENT-3 (event reactor) is wired. Operator clicks **Advance**.
- No explicit `agent.spawn` fan-out tool + parent merge step yet (E4 polish, deferred).
- No per-mission message-cap loop guard (deferred).

## Related

- [`../../plan.md`](../../plan.md) §4, 2026-06-06 F-AGENT-1 entry
- [`../../architecture/orchestration.md`](../../architecture/orchestration.md), orchestration contract (F-AGENT-1 bullet)
- [`./a2a-handoff.md`](./a2a-handoff.md), A2A handoff contract used by `mission.dispatch`
- [`./trust-and-autonomy.md`](./trust-and-autonomy.md), arcs that gate the specialists
- [`./f-agent-2-memory-reflection.md`](./f-agent-2-memory-reflection.md), [`./f-agent-3-event-reactor.md`](./f-agent-3-event-reactor.md), [`./f-agent-4-swarm-hud.md`](./f-agent-4-swarm-hud.md)
