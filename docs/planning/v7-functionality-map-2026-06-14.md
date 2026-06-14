# v7 functionality map: how Circuit behaves, flow by flow

> **What this is.** The behavior reference, not the catalog. For each major flow it gives the inputs, the step-by-step behavior, the four states (loading, empty, error, success), the human-in-the-loop gates, and the data each step reads and writes. It answers "what happens when I click this" rather than "what tables exist." Grounded in a code read of `main` at commit `f515cfb` (2026-06-14).
>
> **Companions.** Route and feature catalog plus the agent roster: [`../strategy/v6-agentic-product-os-2026-06-13.md`](../strategy/v6-agentic-product-os-2026-06-13.md) (engine and IA reference). Positioning and build canon: [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md). Sibling Phase-B docs: [`v7-feature-map-2026-06-14.md`](./v7-feature-map-2026-06-14.md), [`v7-trd-2026-06-14.md`](./v7-trd-2026-06-14.md), [`v7-prd-2026-06-14.md`](./v7-prd-2026-06-14.md). Open bugs and blockers with stable IDs: [`known-issues.md`](./known-issues.md). Sub-feature scope: [`feature-backlog.md`](./feature-backlog.md).
>
> **Honesty contract.** Claim never outruns wiring. Every flow below is tagged Built, Partial, or Missing/Planned, and every Partial names the exact code-verified gap. Verified ground truth: the autonomy, memory, and audit engine is real (deterministic auto-advance via the resume-runs cron, memory_refs threading, outcome-to-memory recall, bounded retry, adaptive budget, the unattended-execution audit, the Today decision card, and the three gauntlet metrics). The real gaps are the live orchestrator slug bug, KI-13 signup 500, connectors wired but not operational, and agents defaulting to observing. The shipped roster is four specialist agents plus the orchestrator, with Critic as an inline LLM call (`runCritic` in `discovery.functions.ts`), not 19 agents.

---

## How to read each flow

Every flow follows the same shape so you can scan:

- **Surface and files**: the route a user is on and the load-bearing server functions.
- **Inputs**: what the user or an upstream event supplies.
- **Behavior**: the ordered steps the system runs.
- **States**: loading, empty, error, success, as the UI actually renders them.
- **Gates**: where a human must approve, reject, or defer before the system proceeds.
- **Data read / written**: the tables and columns touched.
- **Status**: Built, Partial, or Missing/Planned, with the gap named.

---

## A. Signup and onboarding

**Surface and files.** `/signup`, `/onboarding` (`OnboardingFlow`), `_authenticated.tsx` (the gate), `_authenticated.index.tsx` (`Dashboard`, the Today landing).

**Inputs.** Email and password at signup. Nothing else is required before the first screen renders.

**Behavior.**
1. Signup hits Supabase auth. The Postgres trigger `handle_new_user` fires and seeds a profile row, a default workspace, and the starter agent roster (`discovery-scout`, `strategist`, `prd-writer`, `builder`, `orchestrator`).
2. The app shell (`_authenticated.tsx`) reads `profiles.onboarded`. If it is false, the loader redirects to `/onboarding` before any surface paints.
3. `/onboarding` renders `OnboardingFlow` full-viewport with no app chrome. It is the sole first-run surface. On completion it flips `profiles.onboarded` to true and routes to `/`.
4. Today mounts and calls `getColdStart`. If the workspace has zero signals, zero opportunities, and zero PRDs, it renders `ColdStartOnramp` instead of the Needs-You queue. A seeded demo workspace never hits cold state.
5. Today also fires `recordRitualSession` on mount (an upsert keyed to the UTC day, idempotent) so gauntlet Metric B can count this as a day the operator opened the loop.

**States.**
- **Loading**: auth round-trip, then the gate loader. No app shell flash because the redirect runs in `beforeLoad`.
- **Empty**: a brand-new workspace with no seeded data shows `ColdStartOnramp`, the deliberate first-run path.
- **Error**: KI-13: the live `handle_new_user` trigger threw, so signup returned 500 and no account was created. The fix (`20260614140000`) wraps each seed step in its own `BEGIN..EXCEPTION` subtransaction so signup completes even when one seed step fails. The fix is committed but awaits Lovable sync, so on live this is still the active failure mode.
- **Success**: Today renders with either the seeded demo content or the cold-start onramp, and the ritual session is recorded.

**Gates.** None. Onboarding is operator-driven, no agent action.

**Data read / written.** Reads `profiles.onboarded`. Writes `profiles`, the default `workspaces` row, seeded `agents` rows (trigger), and a `ritual_sessions` upsert on Today mount.

**Status: Partial.** Onboarding flow and the gate are Built and functional. Signup itself is blocked on live by KI-13 until the migration syncs.

---

## B. The daily ritual and the Today decision queue

**Surface and files.** `/` (`Dashboard`), `src/lib/today.functions.ts` (`getNeedsYou`), `src/components/today/DecisionCard.tsx`.

**Inputs.** None from the user. Today is a read surface that assembles the calls only the operator should make.

**Behavior.**
1. On mount, `getNeedsYou` runs one round-trip that returns five things:
   - `approvals`: `agent_approvals` where `escalation_state` is `pending` or `expired`, ordered by `expires_at` ascending, limit 10, each enriched with the per-trace `model` and `est_cost_usd` pulled from `ai_events`.
   - `prdCalls`: `prds` where `status = 'review'`, limit 5, including the `critic_review` jsonb.
   - `oppCalls`: `opportunities` where `critic_review->>'verdict'` is `revise` or `kill`, limit 5.
   - `spendTodayUsd`: the sum of `ai_events.est_cost_usd` since midnight.
   - `gateMedianMinutes`: the median raised-to-decided latency over a 7-day window.
2. The hero band renders a calls-cleared SVG ring. As the operator clears cards, a session-local `clearedSession` counter fills the ring.
3. `DecisionCard` renders all three call kinds in one queue. Approvals, PRD-review calls, and Critic-flagged opportunities sit side by side.
4. A "Not now" defer is session-local. It hides the card for this session without writing anything, so the queue stays short without losing context across a reload.
5. The Memory re-score strip pulls the latest closed-loop learning (see flow H) and shows the most recent ICE delta.

**States.**
- **Loading**: the queue skeletons while `getNeedsYou` resolves.
- **Empty**: no pending approvals, no review-status PRDs, no flagged opportunities: the queue shows the cleared state, ring full. A fresh workspace shows cold-start instead (flow A).
- **Error**: if `getNeedsYou` fails, the surface degrades to the daily-brief and agent-rail panels rather than an empty error page.
- **Success**: the three lists render, the spend-today and median-latency chips show real numbers, and clearing a card advances the ring.

**Gates.** Today is itself the gate surface. Every card is a human decision point. Nothing here auto-resolves.

**Data read / written.** Reads `agent_approvals`, `prds`, `opportunities`, `ai_events`. Writes nothing on load except the `ritual_sessions` upsert from flow A. Card actions write through flow C.

**Status: Built. Functional on real data.**

---

## C. Decision card: approve, reject, defer

**Surface and files.** `/` (`DecisionCard.tsx`), `src/lib/governance.functions.ts` (`resolveApproval`), `src/lib/agent_loop.functions.ts` (`decideApproval` for in-mission gates).

**Inputs.** One decision per card: approve, reject, or defer. An approval card optionally carries a note.

**Behavior.**
1. **Approve** on an approval card calls `resolveApproval`. The `agent_approvals` row moves to `approved`, `decided_at` is stamped, and the blocked tool call is released to execute. If the call belongs to a running mission, the mission resumes on the next sweeper tick (flow E).
2. **Reject** sets the row to `rejected` with `decided_at`. The tool call does not run, and the mission step that requested it halts rather than proceeding.
3. **Defer** ("Not now") is session-local only. No write. The card returns on the next load because its underlying state is unchanged.
4. A PRD-review card routes the operator to the PRD detail to accept or send back; an opportunity card flagged by Critic routes to the opportunity. These are navigations, not direct state writes from the card.
5. The cleared-ring counter increments locally on each resolved card so the ritual feels like it closes.

**States.**
- **Loading**: the card shows a pending spinner on the action button while the mutation is in flight.
- **Empty**: no cards, ring full (flow B empty state).
- **Error**: a failed `resolveApproval` surfaces an inline error on the card and leaves the row untouched, so a retry is safe.
- **Success**: the card animates out, the counter ticks, and acceptance feeds gauntlet Metric A (flow D).

**Gates.** This flow is the gate. Approve and reject are the two terminal human decisions; defer is a non-terminal hold.

**Data read / written.** Writes `agent_approvals` (`escalation_state`, `decided_at`, optional note). Reads the enriched approval payload from flow B. In-mission gates write through `decideApproval` against the mission's blocked step.

**Status: Built. Functional on real data.**

---

## D. Gauntlet metrics computation

**Surface and files.** `/govern?tab=gauntlet`, `src/lib/gauntlet.functions.ts`, `src/lib/gauntlet-metrics.ts`.

**Inputs.** None. All three metrics compute from real tables on read.

**Behavior.** Three proof metrics, each with a recent-7-days-versus-prior-7-days trend:

| Metric | Label | Source | Formula |
|---|---|---|---|
| A | Acceptance rate | `agent_approvals` with `decided_at` set | `approved / (approved + rejected)`, where accepted counts `{approved, executed, failed}`, over a 14-day window with a 7-day trend |
| B | Ritual retention | `ritual_sessions` | distinct UTC days Today was opened, over 7, 14, and 30 days, plus current streak |
| C | Autonomy ratio | `tool_calls` (ok=true, side-effecting) versus `agent_approvals` (side-effecting) | `unattended / (unattended + gated)`; a rising number means the loop carries more reversible work on its own |

Each metric computes Bayesian-shrunk where sample size is small, and shows "Not enough data yet" rather than an invented number when the window is sparse.

**States.**
- **Loading**: metric cards skeleton.
- **Empty**: sparse data renders the "Not enough data yet" copy, never a fabricated percentage. Metric B carries a `realData` flag that distinguishes a real account from a demo.
- **Error**: Metric B is pre-migration tolerant: if the `ritual_sessions` table does not yet exist, it degrades to `tableReady: false` instead of throwing.
- **Success**: three numbers with trend arrows, each traceable to its source table.

**Gates.** None. Read-only computation.

**Data read / written.** Reads `agent_approvals`, `ritual_sessions`, `tool_calls`, `ai_events`. Writes nothing.

**Status: Built. Functional on real data.** Metric C reads near zero on new accounts because of the observing-by-default gap (flow J).

---

## E. Mission planning, dispatch, and deterministic auto-advance

**Surface and files.** `/missions` (`MissionsPage`), `/missions/$missionId` (`MissionDetailPage`), `src/lib/orchestrator.functions.ts` (`startOrchestratedMission`, `advanceMission`), `src/lib/ai/tools/orchestrator.server.ts` (`mission.plan`), `src/lib/ai/mission-advance.server.ts` (`advanceMissionCore`), the resume-runs cron sweeper.

**Inputs.** A goal string from the mission composer, optionally scoped to a signal, opportunity, or PRD.

**Behavior.**
1. The composer calls `startOrchestratedMission` with the goal. The orchestrator runs `mission.plan`, which fetches the live specialist roster via `listSpecialistSlugs` (all `enabled=true` agents that are not the orchestrator) and prompts a planner model to emit a step DAG of `{agent_slug, sub_goal, depends_on, rationale}`.
2. `mission.plan` validates every returned `agent_slug` against the live roster. On a mismatch it throws: `mission.plan: step N references unknown slug "X". Valid: ...` and the mission dies at planning (line 177 of `orchestrator.server.ts`).
3. A valid plan creates the mission and its step rows. Each step is a hop.
4. The resume-runs cron sweeper ticks and calls `advanceMissionCore`, capped at `MISSION_BATCH=20` missions per tick (KI-16). This is the deterministic auto-advance: a ready step (dependencies met, no open gate) runs its agent loop, writes its output, and threads a handoff message and `memory_refs` to the next step.
5. `advanceMission` is the operator's manual "push now" lever, the same core path triggered by hand from the cockpit.
6. The cockpit polls every 4 seconds (2 seconds while a hop is live). It shows the hop timeline (a StepDot per step), the MissionGraph DAG (nodes are steps, edges are dependencies), and per-hop thought, tool-call, and final entries with tool-consequence labels and reversibility badges.
7. A failed or halted mission shows a Retry button that re-calls `startOrchestratedMission` with the original goal.
8. Bounded retry and adaptive budget run inside the loop: a step retries a capped number of times and the token budget adapts to the work, both deterministic.

**States.**
- **Loading**: the composer shows a dispatching state; the cockpit skeletons the timeline until the first poll resolves.
- **Empty**: no missions yet shows the composer and an empty list.
- **Error**: the orchestrator slug bug is the live failure here: the orchestrator's stored `agents.system_prompt` names slugs `discovery`, `growth`, `analyst`, none of which are seeded (real slugs are `discovery-scout`, `strategist`, `prd-writer`, `builder`). When the planner follows those examples, `mission.plan` throws at step validation and the mission dies before any hop runs. A single-agent mission can survive if the planner happens to pick a real slug; a multi-agent orchestrated mission reliably hits the bug.
- **Success**: hops advance on their own each tick, handoffs and `memory_refs` thread forward, and the mission completes when the last step finishes and no handoff message is left unconsumed.

**Gates.** A step can carry a governance gate. A `gate`-status hop renders approve and reject inline in the cockpit; `decideApproval` unblocks the run. Gate behavior is governed by the step's resolved approval mode (flow I).

**Data read / written.** Reads `agents` (roster), `missions`, mission step rows, `event_subscriptions` when reactor-dispatched. Writes mission and step rows, `tool_calls` for auto-mode side effects, `agent_approvals` for gated steps, handoff messages, and `memory_refs`.

**Status: Built engine, with a live mission-killer.** The deterministic auto-advance, bounded retry, adaptive budget, and `memory_refs` threading are real and Built. The orchestrator slug bug is open and unresolved in code; fix is to align the orchestrator `system_prompt` to the real slugs or add slug aliasing in `mission.plan` validation. Durable resume across a worker restart is unverified (KI-02).

---

## F. The trust arc and the auto/confirm/review modes

**Surface and files.** `src/lib/ai/trust.server.ts`, `src/lib/trust.functions.ts`, `agent_autonomy` table.

**Inputs.** Mission outcomes, approval decisions, and eval scores accumulated over time. No direct user input beyond optionally moving the arc.

**Behavior.**
1. The trust score is computed on read, not stored as a running total. It blends three Bayesian-shrunk inputs: 0.4 times mission success rate, 0.3 times approval acceptance rate, 0.3 times mean eval score (0 to 100 after the KI-14 scale fix).
2. `suggestArc` maps the score to one of four arcs: fewer than 3 samples is `observing`; score at or above 90 is `ambient`; at or above 75 is `trusted`; at or above 55 is `proving`; otherwise `observing`.
3. The chosen arc is stored in `agent_autonomy`. When no row exists, the fallback is `observing` (line 194 of `trust.server.ts`).
4. `resolveApprovalMode` applies the arc as a safety floor over each tool's declared mode:
   - `review`: is sticky and never relaxes.
   - `ambient`: makes everything `auto`.
   - `trusted`: promotes `confirm` to `auto`.
   - `proving`: demotes `auto` to `confirm`.
   - `observing`: promotes everything, including `auto`-declared tools, to `review`.

**States.**
- **Loading**: the autonomy panel skeletons while the score computes.
- **Empty**: fewer than 3 samples reads as `observing` with the "still proving" framing rather than a fabricated score.
- **Error**: a missing `agent_autonomy` row is not an error; it resolves to the `observing` default by design.
- **Success**: the arc renders with the score and its three component contributions.

**Gates.** This flow defines the gates for every other flow. The resolved mode decides whether a tool call runs inline (auto), prompts (confirm), or queues for the Today queue (review).

**Data read / written.** Reads `missions`, `agent_approvals`, eval scores. Reads and writes `agent_autonomy` (the arc).

**Status: Built, with a structural gap.** The arc math and the safety-floor logic are Built and functional. The observing-by-default fallback means new accounts gate everything, including auto-mode tools, which is the by-design safety stance but blocks the "loop runs itself" claim until the operator advances the dial. See flow J.

---

## G. The Executed-unattended audit

**Surface and files.** `tool_calls` table, `src/lib/gauntlet.functions.ts` (`getAutonomyRatio`), the mission cockpit consequence labels (v6 Phase 2 W2 and W3).

**Inputs.** Every tool call the agent loop makes. No user input.

**Behavior.**
1. Every auto-mode tool call (one that ran inline with no human gate) writes a `tool_calls` row capturing the tool, arguments summary, `ok` result, and whether it was side-effecting.
2. `getAutonomyRatio` reads `tool_calls` where `ok=true` and the call was side-effecting (the unattended numerator) against side-effecting `agent_approvals` (the gated denominator) to produce Metric C.
3. The cockpit annotates each hop's tool calls with a consequence label and a reversibility badge so the operator can audit, after the fact, exactly what ran without their sign-off.
4. This is the receipt for ambient execution: it makes "the loop carried this on its own" inspectable rather than a claim.

**States.**
- **Loading**: the audit view skeletons.
- **Empty**: no unattended calls yet (the new-account norm because of flow J) shows a near-zero ratio with honest copy.
- **Error**: degrades to showing only gated activity if `tool_calls` reads fail.
- **Success**: every unattended side effect is listed with its consequence and reversibility, and the ratio reflects it.

**Gates.** None. The audit is the record of what passed through gates and what did not.

**Data read / written.** Reads `tool_calls`, `agent_approvals`. Writes nothing here; the `tool_calls` rows are written by the agent loop during flow E.

**Status: Built. Functional on real data.** The ratio sits near zero for new accounts until the trust arc advances past observing (flow J).

---

## H. Memory recall and outcome compounding

**Surface and files.** `src/lib/outcome.functions.ts` (`getOutcomeData`, `listLearnings`), `src/lib/ai/outcome-memory.ts` (`buildOutcomeMemory`), `src/lib/ai/memory.server.ts` (`rememberOutcome`), `/knowledge?tab=memory`, the Today Memory strip.

**Inputs.** A completed mission or a moved opportunity. No direct user input.

**Behavior.**
1. **Recall (read side).** When an agent runs, the loop pulls relevant prior outcomes from the memory store and threads them as `memory_refs` into the step context. Recall is what makes the next decision draw on the last one.
2. **Compounding (write side).** A mission completes or an opportunity changes status, and `getOutcomeData` collects the outcome.
3. `buildOutcomeMemory(outcome)` formats a memory payload with a verdict and a summary.
4. `rememberOutcome(supabase, userId, memory)` writes the payload to the memory store and re-scores the linked opportunity's ICE, recording `prior_ice` and `new_ice` on the row.
5. `listLearnings` exposes the re-scored learnings, filtered to rows where both `prior_ice` and `new_ice` are set.
6. Today fetches learnings and renders the most recent ICE delta as the "Memory, the loop closed" strip. This is the visible proof that a recorded outcome changed a future score.

**States.**
- **Loading**: the Memory strip and the `/knowledge` Memory tab skeleton.
- **Empty**: no closed-loop outcomes yet shows the strip in a waiting state rather than inventing a delta.
- **Error**: a failed re-score leaves the prior ICE intact, so the opportunity is never left in a half-scored state.
- **Success**: a recorded outcome appears as a workspace learning, the linked opportunity shows its ICE move, and Today surfaces the delta.

**Gates.** None. Memory writes are a consequence of work already gated upstream.

**Data read / written.** Reads `missions`, `opportunities`, the memory store. Writes the memory store and `opportunities` (`prior_ice`, `new_ice`).

**Status: Built. Functional on real data. This is the moat: the closed loop where recorded outcomes become memory the agents recall and re-score against.**

---

## I. Ingest webhook to reactor to mission

**Surface and files.** `/sync` (`SyncInboxPage`), `src/lib/ingest.functions.ts`, `/api/public/ingest-signals`, `src/lib/reactor.functions.ts`, `/api/public/hooks/event-reactor-tick`, `event_subscriptions` and `ingest_tokens` tables.

**Inputs.** A POST of signal payloads with a Bearer token. Token lifecycle managed by the operator on `/sync`.

**Behavior.**
1. **Token.** The operator rotates a 64-character hex token on `/sync`. It is stored in `ingest_tokens` and is revocable.
2. **Ingest.** A POST to `/api/public/ingest-signals` with the Bearer token validates the token and inserts up to 50 `signals` rows per call.
3. **Reactor fan-out.** `event_subscriptions` maps `signal.created` to a `target_agent_slug` with an `approval_mode` of `auto` or `confirm`. The cron tick at `/api/public/hooks/event-reactor-tick` dispatches `auto`-mode subscriptions immediately and queues `confirm`-mode ones for human approval. A dispatch creates a mission via `createMission` and runs `runAgentLoop`.
4. **Auto-discovery chain.** `signal.created` dispatches Scout, which runs the discovery pipeline, scores an opportunity, emits `opportunity.scored` to the Strategist, and on `prd.approved` hands to Builder. This is the sense-to-build chain running off one inbound signal.

**States.**
- **Loading**: the token panel and sync mappings skeleton on `/sync`.
- **Empty**: no subscriptions means an inbound signal lands but fans out to nothing; the signal still persists for manual triage.
- **Error**: KI-09: the `ingest_tokens` migration (`20260611190000`) is committed but not yet synced, so the token UI renders but the token functions error and the endpoint returns 401 until the migration applies. KI-10: the endpoint has no rate limit, so a leaked token is uncapped cost exposure.
- **Success**: a valid POST inserts signals, the reactor tick dispatches per subscription, and `auto` subscriptions spawn a mission without a human in the path.

**Gates.** Per-subscription `approval_mode`. `auto` runs unattended; `confirm` queues the dispatch as an approval card in the Today queue (flow C).

**Data read / written.** Reads `ingest_tokens`, `event_subscriptions`. Writes `signals`, `missions`, and `agent_approvals` for `confirm`-mode dispatches.

**Status: Partial.** The reactor, subscriptions, and auto-discovery chain are Built. The ingest token UI is live, but the endpoint is blocked on live until KI-09 syncs, and KI-10 (no rate limit) is open.

---

## J. The Studio/Build loop: stage to commit to PR to CI to merge

**Surface and files.** `/build` (`BuildIndexPage`), `/build/$missionId` (`BuildSessionPage`), `src/lib/studio.functions.ts` (`getStudioSession`, `steerStudioSession`, `refreshStudioCi`), `src/components/studio/{SessionTimeline,ChangesPanel,CiPanel,CostPanel}.tsx`, `studio_changesets` table.

> Naming note: internal identifiers were never migrated across the Builder to Studio to Build renames. `agent_slug='builder'`, `studio_changesets`, and `studio.functions.ts` all read as Build.

**Inputs.** A work order (goal, optional PRD link, model choice) from the Build dispatcher composer.

**Behavior.**
1. The dispatcher calls into the Build agent loop with the `builder` slug.
2. The loop stages file changes into `studio_changesets`. The changeset lifecycle is `staged -> committed -> pr_open -> merged -> abandoned`.
3. On commit, the loop opens a PR and writes `pr_url` and `pr_number` onto the changeset.
4. CI is polled via `refreshStudioCi`, surfaced on the PR and CI tab. The refresh is manual on that tab; CI is not continuously streamed.
5. The session detail renders a pipeline journey strip built from live DB fields, plus Changes, PR and CI, and Cost tabs. The page polls every 4 seconds.
6. A Steer mutation (Cmd-Enter) lets the operator redirect a session mid-flight.
7. On green CI, the operator approves the merge gate and Builder closes the loop.

**States.**
- **Loading**: the dispatcher session list polls every 5 seconds; the session detail polls every 4 seconds and skeletons the journey strip until the first poll.
- **Empty**: no sessions shows the composer and PRD picker.
- **Error**: KI-12: the GitHub App is not registered, so PR creation is non-operational on live. The PR and CI tab is wired (`pr_url`, `pr_number`, CI snapshots) but cannot verify until the app secrets exist. An env-var fallback keeps existing `github.issue_close` tool calls working. There is also a pre-migration gate on the changeset tables (KI-12) for the dispatcher.
- **Success**: a work order produces a staged changeset, a PR, a polled CI status, and a merge on operator approval.

**Gates.** The merge gate. The operator approves the merge after CI passes; the Steer mutation is an operator override mid-session.

**Data read / written.** Reads `studio_changesets`, PRDs (when linked), CI snapshots. Writes `studio_changesets` (status, `pr_url`, `pr_number`), `tool_calls`, and `agent_approvals` for the merge gate.

**Status: Partial.** The session lifecycle, journey strip, steer, and the PR and CI and Cost tabs are Built against live DB fields. PR creation and live CI are non-operational until the GitHub App is registered (KI-12). The founder must register the OAuth apps and add the secrets.

---

## K. Chat and research

**Surface and files.** `/chat` (Brain), `src/routes/api/chat.ts` (`callModelStream` via `src/lib/ai/runtime.server.ts`), the brain action handlers.

**Inputs.** A free-text message, a model choice (gateway or BYO key), and an optional mode toggle for research.

**Behavior.**
1. **Chat.** A message streams over SSE through `callModelStream`, the SSR streaming variant of the AI chokepoint. The chokepoint enforces guardrails, tracks cost, routes BYO keys, logs tokens, and runs `humanizeText()` on the output before it reaches the user.
2. The model switcher lets the operator pick a gateway model or a BYO-key model per thread.
3. Brain actions are inline: "Remember this" writes a memory; "Capture decision" creates a decision record. An inline mission cockpit and approval gates let a chat turn spin up and govern a mission without leaving the thread. A threads rail holds history.
4. **Research mode.** A query is decomposed into sub-queries, web search runs in parallel across them, and the result is synthesized into an answer with numbered citations.

**States.**
- **Loading**: tokens stream live; a buffered boundary keeps the sanitizer from splitting a multi-byte sequence.
- **Empty**: a new thread shows the composer and the threads rail.
- **Error**: a guardrail block or a model error surfaces inline in the thread; the chokepoint catches it rather than failing the stream silently.
- **Success**: a streamed reply, optionally with captured memory, a captured decision, or numbered citations in research mode.

**Gates.** Inline approval gates when a chat turn invokes a tool or spins up a mission. Otherwise chat is ungated.

**Data read / written.** Reads thread history, the memory store, model and BYO-key config. Writes chat turns, `ai_events` (cost and tokens), and, on brain actions, memory rows and `decisions` rows.

**Status: Built. Functional on real data.**

---

## Quick status table

| Flow | Status | The gap, named |
|---|---|---|
| A. Signup and onboarding | Partial | KI-13 signup 500 on live until migration syncs |
| B. Today decision queue | Built | none |
| C. Decision card approve/reject/defer | Built | none |
| D. Gauntlet metrics | Built | Metric C reads low on new accounts (see J/flow F) |
| E. Mission planning and auto-advance | Built engine, live bug | orchestrator slug bug kills multi-agent missions; KI-02 durable resume unverified |
| F. Trust arc and modes | Built, structural gap | observing-by-default gates everything new |
| G. Executed-unattended audit | Built | ratio near zero until arc advances |
| H. Memory and outcome compounding | Built | none; this is the moat |
| I. Ingest to reactor to mission | Partial | KI-09 endpoint blocked until migration syncs; KI-10 no rate limit |
| J. Build loop to PR to CI to merge | Partial | KI-12 GitHub App not registered; PR and CI non-operational on live |
| K. Chat and research | Built | none |

---

## Related

- [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md) : positioning and build canon; the claim-never-outruns-wiring stance this map enforces.
- [`../strategy/v6-agentic-product-os-2026-06-13.md`](../strategy/v6-agentic-product-os-2026-06-13.md) : the route and feature catalog and the agent roster that this behavior map sits on top of.
- [`known-issues.md`](./known-issues.md) : the live `KI-` register every Partial above points to.
- [`feature-backlog.md`](./feature-backlog.md) : sub-feature scope and the live status board.
- [`../strategy/session-decisions.md`](../strategy/session-decisions.md) : the 2026-06-14 entries on the orchestrator slug bug and observing-by-default.
- [`../conventions/humanized-output.md`](../conventions/humanized-output.md) : the voice rule this document is written under.
