# C4 / E7 · Agent inspector (run history)

> Status · Core shipped 2026-06-18 (autonomous overnight cycle 4) · Route: `/missions?tab=agents` · Owner: operator-facing, read-only

## What it does

On the Agents surface, the **Agent inspector** lets the operator pick any agent and see its recent run history: each run's status, the mission it belonged to, the step, and when it ran. It is the "what has this agent actually been doing" view, read-only.

## Why it exists

Trust in an agent comes from being able to see its track record, not just its current trust score. C4/E7 is that track record. Build note: [`plan.md`](../../plan.md) §4.

## Where to find it

Missions (`/missions`) > the **Agents** tab > the **Agent inspector** card (below the trust dial).

## Demo script (<= 90s)

1. Open Missions, click the **Agents** tab.
2. Scroll to the **Agent inspector** card; pick an agent from the dropdown.
3. Its recent runs list shows status, mission, step, and timestamp, newest first.

## How it works

- `getAgentRuns` server fn in `src/lib/agent-runs.functions.ts`. GET, `requireSupabaseAuth`, input `{ agentId }`.
- Reads `agent_runs` filtered by `user_id` (RLS plus an explicit filter, defense-in-depth) and `agent_id`, newest first, capped at 25. Returns each run's status, mission_id, step_index, and created_at.
- `AgentInspector.tsx` (in `src/components/cockpit/`) takes the agent roster from the swarm HUD, holds the selected agent in local state, and renders the run list with an agent dropdown and a "no runs yet" empty state.

## Governance & guardrails

- Read-only. No writes, no migration.
- RLS-scoped; a user can only ever inspect their own agents' runs.

## Verification checklist

- [x] `tsc --noEmit` clean, `eslint` clean, `bun run build` green (2026-06-18).
- [x] Adversarial review: clean (hooks unconditional, RLS plus explicit user_id filter, schema grounded before build).
- [ ] **Pending published-app verification (needs the founder to publish first):** on the live app, open Missions > Agents, pick an agent, and confirm its recent runs render with the right status/mission/time; confirm the empty state for an agent with no runs.

## Known limits / out of scope

- Run history only. The shared/private memory inspector (what each agent knows) is the documented remainder (the partial mark on the C4/E7 dashboard row); it needs the agent-scope columns on `agent_memory` confirmed against the live schema.
- The inspector is a dropdown-select view, not a per-card click-through; a click-from-the-card drill is a fast-follow.

## Related

- [`plan.md`](../../plan.md) §4 build log · [`agent-runs.functions.ts`](../../src/lib/agent-runs.functions.ts) · `swarm.functions.ts` (agent roster) · [autonomous-build-loop playbook](../operations/autonomous-build-loop.md) (cycle 4).
