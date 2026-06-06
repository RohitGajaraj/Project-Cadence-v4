
## Where we actually are (ground truth, not the docs)

I just surveyed the agent layer. The **substrate is impressively complete** — what's missing is the *behavior* that makes it agent-native instead of agent-shaped.

**Built and working:**
- AI chokepoint (1028 LOC), 6-step agent loop, 25 tools (workspace/tasks/signals/notes/memory/calendar/github/research/prd/backlog/web/handoff)
- 10 missions, 17 agent runs, 28 checkpoints, 9 handoffs, 21 drift snapshots — real data
- Trust arcs, autonomy dial, guardrails (with hits), eval suites, drift incidents, kill-switch, mission caps
- 6 cron hooks (agent-tick, approvals-tick, drift-tick, eval-tick, eval-suite-tick, resume-runs)
- 35 user-created agents (scheduled-cron capable)

**What's missing (the honest gaps that block "agent-native OS"):**

| # | Gap | Why it matters |
|---|---|---|
| 1 | **No Orchestrator agent.** Loop is single-agent. Handoffs exist as a primitive but no meta-agent plans missions or dispatches to specialists. | The "6 durable + ephemeral specialists" roster is a roster, not a swarm. |
| 2 | **`agent_memory` table has 0 rows.** Recall path is wired; *write* path isn't. | Agents have no continuity. Every run starts cold. Trust arcs can't advance on real outcomes. |
| 3 | **No event reactor.** Agents only run on user click or fixed cron. | "Continuous autonomous lifecycle" is actually "manual + schedule." |
| 4 | **No self-reflection.** Runs finish, status flips, done. | No learning loop → evals stay author-curated → drift catches symptoms not causes. |
| 5 | **No swarm HUD.** Today (`/`) is a personal page; there's no "what is the swarm doing right now" view across missions/agents/handoffs/halts. | Operator can't *govern* what they can't see. |
| 6 | **6-step hard cap.** Real missions exceed it. (Bundle 9 starts addressing this, paused.) | Forces premature `final` or queued approval-as-checkpoint. |
| 7 | **Discover → Deliver → Build is not closed.** Each surface works alone. No "Opportunity scored ≥80 → Strategist drafts PRD → on approve, Builder spawns mission." | The flagship demo of an autonomous product OS doesn't exist end-to-end. |

The UI/UX revamp will hit way harder *after* these — there will actually be something to render.

---

## Proposal: three core builds, then a fourth that ties them together

Pick **F-AGENT-1**, **F-AGENT-2**, **F-AGENT-3** as the next bundle. Each is independently shippable in 1–2 sessions. Together they turn the substrate into an actual swarm. **F-AGENT-4** is the operator surface that makes it legible. UI revamp resumes after.

### F-AGENT-1 — Orchestrator agent + real mission decomposition  *(highest leverage)*

A meta-agent that takes a goal and runs the mission *across multiple specialists* via the existing handoff + checkpoint primitives.

- New seed agent `orchestrator` (system prompt: decomposer + dispatcher, not doer).
- New tools in the registry: `mission.plan(goal) → {steps: [{agent_slug, sub_goal, depends_on}]}`, `mission.dispatch(agent_slug, sub_goal)`, `mission.observe(mission_id)`, `mission.finalize(summary)`.
- Loop change: when running `asMission: true` with `agentSlug: "orchestrator"`, the loop runs the planner once, persists the DAG to a new `mission_steps` table, then *spawns child `agent_runs`* via `handoff.server.ts`. Each child completes → reactor (F-AGENT-3) wakes the orchestrator to advance.
- Raise loop cap from 6 → 12 for orchestrator slug only (cheap fix; full Bundle 9 cap-tuning stays scoped separately).
- DB: `mission_steps` (mission_id, idx, agent_slug, sub_goal, status, depends_on int[], result jsonb, run_id), with RLS.

**Why first:** unblocks the entire "swarm" story. Every other gap depends on missions being multi-agent.

### F-AGENT-2 — Persistent agent memory + self-reflection  *(makes agents actually learn)*

Wire the *write* path that the table is waiting for.

- New tool `memory.reflect(run_id)` runs as the **last** loop step on every completed run. Prompts the model with the run trace + final state and asks for: 1 lesson learned, 1 thing that worked, 1 thing to do differently, importance score 1–5. Persists to `agent_memory` with `kind='reflection'`.
- New tool `memory.promote(memory_id)` for the model to escalate important memories to workspace scope.
- Recall improvements in `loop.server.ts`: pull top-K reflections for the same `agent_slug` + workspace + tool combo, not just semantic similarity.
- Trust arc auto-advance: in `trust.server.ts`, count successful runs without approval rejection per agent_slug; advance Observing→Proving→Trusted at thresholds (configurable, default 5/20/100 successful runs).
- Forgetting: weekly cron (`memory-tick.ts`) decays low-importance memories not recalled in 30d.

**Why second:** orchestrator becomes way better when specialists remember.

### F-AGENT-3 — Event reactor + auto-pipelines  *(closes the discover→deliver→ship loop)*

A small in-process reactor that listens for domain events and triggers agent missions via existing approval gates.

- DB: `agent_subscriptions` (agent_slug, event_type, predicate jsonb, approval_mode, enabled). Seed with three:
  - `signal.created` + predicate `source IN ('linear','intercom')` → Discovery agent clusters → emits `opportunity.created` if cluster reaches threshold.
  - `opportunity.scored` + `score >= 80` → Strategist agent drafts PRD (queued for approval by default).
  - `prd.status_changed` to `approved` → Builder spawns mission via Orchestrator.
- Two delivery paths:
  - **Now (simple):** a fan-out function called from existing server fns (`createSignal`, `scoreOpportunity`, `updatePrdStatus`) — no infra needed.
  - **Later (durable):** flip to a `domain_events` table + reactor cron. Designed for it now, not built.
- Per-subscription approval mode means humans still govern; auto-pipelines never bypass guardrails or budgets.

**Why third:** F-AGENT-1+2 give us a swarm that *can* run; this gives it work to do without a human clicking Run.

### F-AGENT-4 — Swarm HUD  *(operator visibility — does not require UI revamp)*

A single new route (`/_authenticated/swarm`, or replace Today's hero band) that renders, server-side, in 4 panels:

1. **Live missions** — mission, current step, current agent, hop_count, halted reason, ETA confidence.
2. **Recent handoffs (last 24h)** — from → to, mission, was it auto or via approval.
3. **Pending decisions** — approvals queue with TTL countdown (already exists, surfaced here).
4. **Auto-pipelines firing** — last 50 events that triggered a subscription, with outcome.

Uses existing tokens (no design work). One server fn per panel.

**Why fourth:** with 1–3 in place, the swarm is invisible without this. Also: every demo of an "autonomous product OS" lives or dies on this screen.

---

## Build order & scope discipline

1. **F-AGENT-1** (Orchestrator) — DB migration + 4 new tools + planner prompt + loop hook → 1 long session.
2. **F-AGENT-2** (Memory write + reflection + trust auto-advance) → 1 session. Independent of 1; can ship first if you'd rather see learning before swarm.
3. **F-AGENT-3** (Reactor + 3 seed subscriptions) → 1 session. Needs 1.
4. **F-AGENT-4** (Swarm HUD) → ½ session. Needs 1 & 3 to have anything to show.

Then resume UI revamp (Phases 3–4) on a swarm that actually has something worth rendering.

---

## What I'm *not* proposing right now (and why)

- **Builder agent actually writing code** — exciting but enormous scope and a hard governance problem; needs its own decision doc.
- **MCP server + A2A external interop** — high strategic value (moat: "build for agents first"), but premature before our *own* swarm runs.
- **Replacing the 6-step loop cap with full durable execution (Bundle 9 Slice 2 finish)** — should happen, but F-AGENT-1 with a soft cap-raise for `orchestrator` unblocks the core feature without it.
- **UI tokens / Cohere restyle of Phases 3–4** — explicitly deferred per your direction.

---

## Decisions I need from you before I start

1. **Order:** ship F-AGENT-1 first (swarm before learning) or F-AGENT-2 first (learning before swarm)?
2. **Auto-pipeline default approval mode:** `confirm` (human approves each Strategist → PRD draft) or `auto` for Trusted-arc agents only?
3. **Swarm HUD placement:** new `/swarm` route, or take over the Today (`/`) homepage so it's the first thing the operator sees?

I'll lock those, then start with the migration + a single end-to-end mission running across two agents to prove the orchestrator path before scaling.
