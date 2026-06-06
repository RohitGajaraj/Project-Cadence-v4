# Active task — Agent ecosystem bundle (F-AGENT-1 → F-AGENT-4)

**Started:** 2026-06-06 · Lovable
**Plan:** `.lovable/plan.md` (this session) · approved by operator
**Why this bundle:** Operator explicitly deferred UI/UX revamp (Restructure Phases 3–4) and asked for core agent-ecosystem depth. Substrate was 95% built; behavior was missing.

## F-AGENT-1 — Orchestrator + multi-agent missions  ✅ DONE
- [x] Migration: `mission_steps` table (mission_id, idx, agent_slug, sub_goal, depends_on int[], status, run_id, message_id, result, error, rationale, dispatched_at, completed_at) + RLS + grants
- [x] SQL helper `next_ready_mission_steps(mission_id)` returns steps whose deps are all `done`
- [x] `seed_orchestrator_agent(p_user_id)` SECURITY DEFINER fn — idempotent bootstrap of orchestrator agent + 6 default tools with required display_name/description
- [x] Tools: `mission.plan`, `mission.dispatch`, `mission.observe`, `mission.finalize` in `src/lib/ai/tools/orchestrator.server.ts`, registered in `registry.server.ts`
- [x] Loop step cap is per-agent (`maxStepsFor`): orchestrator 14, specialists 6
- [x] Server fns: `ensureOrchestrator`, `startOrchestratedMission`, `advanceMission`, `listMissionSteps` (`src/lib/orchestrator.functions.ts`)
- [x] UI: `/missions` "Plan & dispatch" composer; `/missions/$id` "Orchestrator plan" panel + Advance button
- [x] Doc loop: `docs/feature-backlog.md` status board, `plan.md` §4, `architecture/orchestration.md`

## F-AGENT-2 — Persistent memory + self-reflection + trust auto-advance  ☐ NEXT
- [ ] New tool `memory.reflect(run_id)` runs as the **last** loop step on every completed run. Sub-model prompt over the run trace returns `{lesson, what_worked, what_to_change, importance:1-5}`. Persist to `agent_memory` with `kind='reflection'`, scoped to `agent_slug + workspace_id`
- [ ] New tool `memory.promote(memory_id)` for explicit workspace-scope escalation
- [ ] Patch `loop.server.ts`: after `final` action, auto-call `memory.reflect` (skip if loop halted by governance — reflection on a halt should be a separate path)
- [ ] Patch `recallMemory()` to pull top-K reflections matching `agent_slug + tool combo` in addition to semantic similarity
- [ ] `trust.server.ts` auto-advance: count successful runs without approval rejection per `(user_id, agent_id)`; advance Observing→Proving at 5, Proving→Trusted at 20 (configurable; default thresholds). Wire into `agent_runs` completion path
- [ ] New cron `/api/public/hooks/memory-tick.ts` decays low-importance unused memories (>30d, importance ≤2)
- [ ] Operator-visible: `/agents/$slug` (or extend existing) — show "Recent reflections" section
- [ ] Doc loop

## F-AGENT-3 — Event reactor + auto-pipelines  ☐
- [ ] New table `agent_subscriptions` (agent_slug, event_type, predicate jsonb, approval_mode, enabled, last_fired_at)
- [ ] In-process fan-out function `emitDomainEvent(supabase, userId, {type, payload})` called from `signals.functions.ts → createSignal`, `discovery.functions.ts → scoreOpportunity`, `discovery.functions.ts → updatePrdStatus`
- [ ] Seed three subscriptions per user via migration: `signal.created`→discovery (auto), `opportunity.scored`+`score>=80`→strategist (confirm), `prd.status_changed`→`approved`→orchestrator (confirm)
- [ ] `/governance` page: subscriptions table CRUD
- [ ] Doc loop

## F-AGENT-4 — Swarm HUD  ☐
- [ ] New route `/_authenticated/swarm.tsx` with 4 server-fn-backed panels: Live missions / Recent handoffs 24h / Pending approvals with TTL / Auto-pipeline firings
- [ ] Add nav entry to AppShell under Workspace pillar
- [ ] Doc loop

## Restructure Phases 3–4 (UI/UX revamp)  ⏸ DEFERRED (per operator)
Resume after F-AGENT-1..4 ship. Old checklist preserved in git history.

## Gotchas for the next tool
- `mission.plan` rejects if `mission_steps` already exist for the mission — orchestrator plans **once** per mission. If you need to re-plan, build a separate `mission.replan` tool that archives old steps.
- Specialist child runs execute via the existing `resume-runs` cron (every 2 min). For demos, manually invoke `advanceMission` from `/missions/$id` to push the next dispatch round immediately after children complete. F-AGENT-3 auto-wakes this.
- The orchestrator's planner sub-model call goes through `callModel` with `surface:'agent', surface_ref:'orchestrator:plan'` — that surface is new but the chokepoint handles unknown surface refs fine (uses default budget).
- `mission.finalize` writes status `completed_with_failures` when any step failed — no enum constraint exists on `missions.status`; existing UI tones cover `completed`/`running`/`failed`. If you add a constraint later, include this value.
- Per-agent step cap helper is `maxStepsFor(slug)` in `src/lib/ai/loop.server.ts`. Add other slugs that need more steps (`builder`?) here, not by raising the global.
- `reflectStepStatusFromRuns()` in orchestrator.server.ts is the bridge between child `agent_runs.status` and `mission_steps.status` — it runs on every `dispatch`/`observe`/`finalize`. F-AGENT-3 should also call it from the reactor when a child run completes.

## Done criteria for the bundle
- All four F-AGENT-* shipped; `active-task.md` deleted; status board flipped to Restructure Phase 3 or whichever next priority
- Demo: typing "Investigate top churn signals, draft a PRD, and queue a build" into `/missions` "Plan & dispatch" launches a 3+ agent mission that runs end-to-end with no further operator input (excepting governance gates)
