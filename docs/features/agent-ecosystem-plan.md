# Agent ecosystem bundle — F-AGENT-1 → F-AGENT-4

> **What this is.** The canonical plan for the "agent ecosystem" bundle — four sequential builds that turn Cadence's substrate (chokepoint, runs, messages, missions, trust, guardrails) into actual agent-native behavior. Captured here so it survives sessions / tools and can be picked up by anyone (Claude Code · Antigravity · Gemini · Lovable).
>
> **Status (2026-06-06):** F-AGENT-1 ✅ shipped. F-AGENT-2 ☐ next. F-AGENT-3 ☐. F-AGENT-4 ☐. Live cursor lives in [`./feature-backlog.md`](./feature-backlog.md); active sub-steps in `../active-task.md` (root).
>
> **Why this bundle exists.** Ground-truth survey of the running system found the substrate ~95% complete but the _behavior_ missing — single-agent planner loops, an unused `agent_memory` table (0 rows written), no event reactor, no self-reflection, no swarm-level surface, no meta-agent that decomposes a goal into a multi-agent plan. Everything that makes Cadence "agent-native" rather than "AI-assisted" lives in this bundle. Operator explicitly deferred Restructure Phases 3–4 (UI/UX revamp) until this closes.

---

## Sequence (build in this order)

| #         | Name                                                     | Outcome                                                                                                                  | Status                                                                                                         |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| F-AGENT-1 | Orchestrator + multi-agent missions                      | A goal becomes a DAG of specialist hops, dispatched and joined automatically.                                            | ✅ shipped 2026-06-06 — [`features/f-agent-1-orchestrator.md`](./features/f-agent-1-orchestrator.md)           |
| F-AGENT-2 | Persistent memory + self-reflection + trust auto-advance | Specialists actually learn between runs; trust arc advances on real outcomes, not operator clicks.                       | ✅ shipped 2026-06-06 — [`features/f-agent-2-memory-reflection.md`](./features/f-agent-2-memory-reflection.md) |
| F-AGENT-3 | Event reactor + auto-pipelines                           | Discover→Deliver→Ship loop runs without "click Advance" — signals/opportunities/PRD-status changes wake the right agent. | ✅ shipped 2026-06-06 — [`features/f-agent-3-event-reactor.md`](./features/f-agent-3-event-reactor.md)         |
| F-AGENT-4 | Swarm HUD                                                | Single view of live missions, recent handoffs, pending approvals, auto-pipeline firings.                                 | ✅ shipped 2026-06-06 — [`features/f-agent-4-swarm-hud.md`](./features/f-agent-4-swarm-hud.md)                 |

Each step depends on the one above it (you cannot meaningfully react to events without the orchestrator routing them; the HUD reads from all three).

---

## F-AGENT-1 — Orchestrator + multi-agent missions ✅

Full shipped detail: [`feature-backlog.md`](./feature-backlog.md) status board (2026-06-06 entry) and [`../plan.md`](../plan.md) §4. Architecture contract: [`../architecture/orchestration.md`](../architecture/orchestration.md).

Headline:

- New seed agent `orchestrator` (bootstrapped via `seed_orchestrator_agent(p_user_id)`).
- New `mission_steps` table (DAG: `depends_on int[]`, status `planned→dispatched→running→done/failed/skipped`) + `next_ready_mission_steps()` RPC.
- Four new agent tools: `mission.plan` / `mission.dispatch` / `mission.observe` / `mission.finalize`.
- Per-agent loop cap (`maxStepsFor`): orchestrator 14, specialists 6.
- Server fns: `ensureOrchestrator`, `startOrchestratedMission`, `advanceMission`, `listMissionSteps`.
- UI: `/missions` composer + `/missions/$id` DAG panel with **Advance** button (placeholder for the F-AGENT-3 reactor).

---

## F-AGENT-2 — Persistent memory + self-reflection + trust auto-advance ☐ NEXT

**Goal:** specialists carry useful lessons across runs, and the trust arc moves on its own when outcomes warrant it.

**Build:**

1. New tool `memory.reflect(run_id)` — sub-model prompt over the run trace returns `{lesson, what_worked, what_to_change, importance:1-5}`. Persist to `agent_memory` with `kind='reflection'`, scoped to `agent_slug + workspace_id`.
2. New tool `memory.promote(memory_id)` — explicit workspace-scope escalation when a lesson generalizes beyond one agent.
3. Patch `src/lib/ai/loop.server.ts`: after the `final` action on a completed run, auto-call `memory.reflect`. Skip when the loop halted via governance — reflection on a hard halt is a separate (future) path.
4. Patch `recallMemory()` to pull top-K reflections matching `agent_slug + tool combo` in addition to semantic similarity.
5. `src/lib/ai/trust.server.ts` auto-advance: count successful runs without approval rejection per `(user_id, agent_id)`; advance Observing→Proving at 5, Proving→Trusted at 20 (configurable). Wire into the `agent_runs` completion path. Trust score itself stays computed-on-read.
6. New cron `/api/public/hooks/memory-tick.ts` — decays low-importance unused memories (>30d, importance ≤2).
7. Operator-visible: `/agents/$slug` (or extend existing) shows a "Recent reflections" section so the learning is legible.
8. Doc loop: status board, `plan.md` §4, this file, `architecture/orchestration.md`.

**Why now:** without reflection the loop has no learning channel — runs finish, status flips, lessons are lost. Without trust auto-advance, the autonomy dial is a manual knob and the trust arc is decorative.

---

## F-AGENT-3 — Event reactor + auto-pipelines ☐

**Goal:** the Discover→Deliver→Ship loop runs by itself — agents wake on real events, not operator clicks. Removes the "click Advance" friction left over from F-AGENT-1.

**Build:**

1. New table `agent_subscriptions` — `(agent_slug, event_type, predicate jsonb, approval_mode, enabled, last_fired_at)`. RLS scoped to `user_id`.
2. In-process fan-out `emitDomainEvent(supabase, userId, {type, payload})` called from `signals.functions.ts → createSignal`, `discovery.functions.ts → scoreOpportunity`, `discovery.functions.ts → updatePrdStatus`. (Simple synchronous fan-out first; if scale demands it, swap for a durable `domain_events` table without breaking call sites.)
3. Seed three subscriptions per user via migration:
   - `signal.created` → `discovery` (auto)
   - `opportunity.scored` with `score>=80` → `strategist` (confirm)
   - `prd.status_changed` to `approved` → `orchestrator` (confirm)
4. Reactor also re-wakes the orchestrator when a child `agent_run` completes — replaces the manual **Advance** button on `/missions/$id`.
5. `/governance` page: subscriptions table CRUD so the operator sees + edits what's auto-firing.
6. Doc loop.

**Why now:** F-AGENT-1 made the swarm possible; F-AGENT-3 makes it continuous. Until events route, every mission still needs a human poking it forward.

---

## F-AGENT-4 — Swarm HUD ✅ shipped 2026-06-06

**Canonical page:** [`features/f-agent-4-swarm-hud.md`](./features/f-agent-4-swarm-hud.md) — open this for the demo script, the full panel walkthrough, and the verification checklist. Summary kept below for historical context.

**Goal:** a single page that answers "what are my agents doing right now?" — the operator's flight-deck.

**Build:**

1. New route `src/routes/_authenticated.swarm.tsx` with seven panels (header, throughput, attention queue, agents grid, missions, handoff feed, reactor firings):
   - Live missions (orchestrator + child run progress)
   - Recent handoffs (24h, by edge)
   - Pending approvals with TTL
   - Auto-pipeline firings (from `event_queue`)
2. Add nav entry to `AppShell` under the **Agents** pillar (between Missions and Prompt Studio).
3. Reuse existing Cohere editorial tokens — no design work, no UI revamp dependencies.
4. Doc loop.

**Why now:** F-AGENT-1/2/3 generate the activity worth watching; without F-AGENT-4 the operator has to stitch the picture from `/missions`, `/inbox`, and `/agents` individually.

---

## Explicitly out of scope (queued, not part of this bundle)

- Builder agent actually writing the multi-file diff (Bundle 9 Slice 2).
- MCP server + A2A interop (Epic X5 / Q).
- Replacing the loop's step cap with full durable execution (Bundle 9 Slice 3 / FND-RUNTIME deepening).
- UI tokens / Phases 3–4 Cohere restyle — explicitly deferred by the operator until this bundle closes.

---

## Done criteria for the bundle

- All four F-AGENT-\* shipped; `active-task.md` (root) deleted; status board in [`feature-backlog.md`](./feature-backlog.md) flipped to the next priority (Restructure Phases 3–4 or whichever is next-up at that moment).
- Demo: typing `"Investigate top churn signals, draft a PRD, and queue a build"` into `/missions` → orchestrator plans a 3+ agent DAG → specialists run end-to-end without further operator input, except at governance gates → Swarm HUD lights up live → an `opportunity.scored` event automatically wakes the Strategist for the next cycle.

---

## Related

- Live cursor + per-bundle status: [`./feature-backlog.md`](./feature-backlog.md)
- Active sub-steps (deleted on bundle completion): `../active-task.md`
- Build log: [`../plan.md`](../plan.md) §4
- Architecture contract: [`../architecture/orchestration.md`](../architecture/orchestration.md)
- Trust arc + autonomy dial: [`./trust-and-autonomy.md`](./trust-and-autonomy.md)
- A2A handoff primitives this bundle builds on: [`./a2a-handoff.md`](./a2a-handoff.md)
