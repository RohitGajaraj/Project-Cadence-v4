# F-AGENT-2: Persistent agent memory + self-reflection + trust auto-advance

> _Created: 2026-06-06 · Last updated: 2026-06-14_

> **Status:** ✅ Shipped 2026-06-06 · **Route:** `/agents` (Recent reflections panel) · **Owner agents:** all

## What it does

After every clean run, every agent automatically distils what worked and what to change next time, writes it to its memory store, and that lesson is recalled on future runs alongside semantic matches. Agents that string together enough clean runs without rejections are promoted along the trust arc automatically: Observing → Proving → Trusted.

## Why it exists

Without memory, every run started from scratch and trust never moved. F-AGENT-2 closes the "agents that learn run-over-run and earn autonomy" gap, so the operator's approvals compound into autonomy and the system stops asking about the same things twice. Full rationale: [`../../plan.md`](../../plan.md) §4 entry dated 2026-06-06 (F-AGENT-2).

## Where to find it

- **Nav:** sidebar → **Agents** group → **Agents**.
- **"Recent reflections" panel** on each agent, shows the latest `{lesson, what_worked, what_to_change, importance}` entries with an importance pill.
- The trust arc badge on each agent card reflects auto-advance promotions.

## Demo script (≤ 90 seconds)

1. Sign in as `demo@redcadence.app`.
2. Click **Agents**, open any agent that has run recently.
3. Scroll to **Recent reflections**. "After every clean run the agent distils what worked and what to change. These lessons are recalled on the next run: semantic matches plus the top recent reflections, deduped."
4. Point at the trust arc pill. "When this agent strings together five clean completions with no rejected approvals, it auto-promotes from Observing to Proving. Twenty more clean runs and it reaches Trusted."

## How it works

- **Reflection helper:** `src/lib/ai/reflection.server.ts → autoReflect()` runs through the chokepoint (`surface='agent', surface_ref='reflect:<slug>'`), expects strict JSON `{lesson, what_worked, what_to_change, importance: 1-5}`, writes a `kind='reflection'` row to `agent_memory` with embedding + structured metadata (`run_id`, `trace_id`, `goal`, `what_worked`, `what_to_change`).
- **Loop integration:** `src/lib/ai/loop.server.ts` calls `autoReflect()` + `maybeAutoAdvanceArc()` from **both** finalize paths (fresh run and resumed run) when `!halted`. Halted runs skip reflection by design: a governance halt never becomes a self-confirming lesson without operator review.
- **Recall:** `recallMemory()` merges semantic search (`match_agent_memory`) with `recent_agent_reflections` (importance × recency, top 3), deduped by content, capped at 8.
- **Two new tools** in the registry: `memory.reflect` (on-demand mid-run reflection) and `memory.promote` (escalate scope `agent → global` so all agents recall it).
- **Autonomy RPC:** `auto_advance_agent_arc(p_user_id, p_agent_id)` SECURITY DEFINER promotes Observing→Proving at 5 clean completed runs and Proving→Trusted at 20, blocked by any rejected approval since the last `agent_autonomy.set_at`, never downgrades, never auto-promotes past Trusted (Ambient stays explicit).
- **Daily cron:** `memory-tick-daily` (`/api/public/hooks/memory-tick`, 03:30 UTC) deletes low-importance (≤2) unused (>30d) memories.

## Governance & guardrails

- **Halt-on-rejection.** Trust auto-advance is blocked by any rejected approval since the last arc change. The operator's "no" sticks.
- **No auto-promote to Ambient.** Ambient remains an explicit human decision.
- **Memory promotion is its own tool** (`memory.promote`). Escalating an agent-scoped memory to workspace-global is gated like any other write.
- **RLS:** `agent_memory` is scoped to `auth.uid()` and joined to the owning agent for read.

## Verification checklist

1. Run any agent to clean completion. Within seconds, a `kind='reflection'` row appears in `agent_memory` for that agent.
2. The **Recent reflections** panel on `/agents` shows it with `lesson / what_worked / what_to_change / importance`.
3. After 5 clean completions with no rejected approvals, `agent_autonomy.arc` flips from `observing` to `proving` (visible on the agent card).
4. Reject any approval: the arc no longer auto-advances on subsequent runs until the next `set_at`.
5. `memory.reflect` and `memory.promote` are visible in the tools registry for any user-customisable agent.

## Known limits / out of scope

- No UI to edit or hand-delete an individual memory yet. Pruning is purely time/importance-driven.
- `agent_autonomy` does not yet expose a numeric `trust_score` column; only the arc moves.
- Reflection is single-pass; no multi-perspective "what would another agent have done" comparison yet.

## Related

- [`../../plan.md`](../../plan.md) §4, 2026-06-06 F-AGENT-2 entry
- [`../../architecture/orchestration.md`](../../architecture/orchestration.md), orchestration contract (F-AGENT-2 bullet)
- [`./trust-and-autonomy.md`](./trust-and-autonomy.md), the trust arcs and how they gate approvals
- [`./f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md), [`./f-agent-3-event-reactor.md`](./f-agent-3-event-reactor.md), [`./f-agent-4-swarm-hud.md`](./f-agent-4-swarm-hud.md)
