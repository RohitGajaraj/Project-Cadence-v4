# Strategic Decisions Log

> **What this is.** A running record of major strategic decisions, tradeoffs evaluated, and facts presented during development sessions. Not a transcript, only decisions that shaped the product direction, architecture, or operating model.
>
> **Who reads this.** Any agent or human starting a new session who needs to understand _why_ things are the way they are without re-reading the full conversation history. This file is a shortcut to institutional reasoning.
>
> **Update rule.** When a session produces a strategic decision, a major tradeoff resolution, or a significant positioning or architecture change, add an entry here in the same session. This is not a one-time activity; it is a constant update obligation. Reference: `docs/strategy/README.md` (cascade rule).
>
> **Cross-references.** Versioned positioning: [`archive/v2-positioning-2026-06-02.md`](./archive/v2-positioning-2026-06-02.md). Feature backlog: [`../planning/feature-backlog.md`](../planning/feature-backlog.md). Operating rules: [`../../AGENTS.md`](../../AGENTS.md).

---

## How to add an entry

```
### YYYY-MM-DD — Short title of the decision
**Decision:** What was decided.
**Why:** The reasoning, constraints, or facts that drove it.
**Tradeoffs considered:** What was ruled out and why.
**Impact:** Which files, features, or behaviors changed as a result.
```

---

## Decision log

### 2026-06-18 · R3 global bell badges the whole Attention feed, not a subset, and keeps the existing Approvals badge

**Decision:** The new global Attention bell in the TopBar (cycle 15) badges the **entire** Attention feed count (approvals + spend alerts + stalled loop) and links to `/govern?tab=attention`. The pre-existing Trust-row "Approvals" badge (`getNeedsYou`, linking to `?tab=approvals`) is kept as-is, not merged into or replaced by the bell.

**Why:** A generic bell icon universally reads as "something needs you," so badging the whole feed keeps its meaning honest and matches the feed it opens. The two indicators are deliberately different surfaces: the Trust-row badge is a count on the Approvals *nav item*; the bell is the global doorway to the *whole* Attention feed. When only approvals exist the two numbers agree (reinforcement, not contradiction); when a spend or stall alert also exists the bell reads higher, correctly signalling there is more than approvals to see.

**Tradeoffs considered:** (1) Badge only the non-approval alerts (budget + health) to avoid any overlap with the Approvals badge, rejected: a bell that ignores approvals under-signals (it could read "all clear" while approvals wait), which is worse than a benign agreement of two counts. (2) Merge the two into one indicator and delete the Approvals badge, rejected: an invasive refactor of working, tested chrome for no real gain, and it violates the surgical "every line traces to the task" rule.

**Impact:** `src/components/cadence/AttentionBell.tsx` (new) + `src/components/cadence/TopBar.tsx`. R3 stays ◐ (remaining: email + digests + per-user prefs). Detail: [`../features/r3-notifications.md`](../features/r3-notifications.md).

### 2026-06-18 · Split F3 by spend posture: ship the always-fresh feed, queue the auto-cluster cron for founder sign-off

**Decision:** Build only the no-spend half of F3 (continuous discovery) unattended — the always-fresh feed (auto-refresh the discovery surface so continuously-ingested signals surface live). Queue the auto-cluster cron (a `discovery-tick` that re-clusters new signals on a schedule) for the founder, rather than enabling it.

**Why:** Signals already ingest continuously (webhook → reactor), but the feed was static and clustering is manual. The always-fresh feed is purely additive (a polling interval), offline-gateable, and costs nothing beyond cheap DB reads — safe to ship. The auto-cluster cron, by contrast, commits **recurring AI spend** for every workspace. The autonomous build contract lists spend as a founder-gated decision, so enabling an always-on cost process unilaterally would violate it, even though it is governed by the existing spend caps + kill-switch and fits the product's "the loop runs itself" model.

**Tradeoffs considered:** (1) Build the cron "gated off" so the founder just wires the schedule — still rejected for an unattended cycle because shipping the always-fresh half first is cleaner and the cron is better built right after an explicit yes (it also pairs with per-product clustering scope, which needs the active-product context plumbed in). (2) Pick a different core item — rejected; F3 is the founder's named top core candidate and its safe half is genuinely valuable.

**Impact:** `src/components/product/SignalsPanel.tsx` (`refetchInterval`). F3 stays ◐. The cron + per-product scope are in the report's "Skipped / queued for the founder" table awaiting a spend-posture yes.

### 2026-06-18 · Build D4's cancellation slice unattended (re-assessing the "too risky to build blind" deferral)

**Decision:** Build the D4 cancellation slice (a "Cancel mission" brake on `/missions/$id`) during the autonomous overnight loop, reversing cycle 8's call that D4 was "NOT gate-verifiable, unsafe to build blind." Reconcile `H1-TASKS` to ✅ (already built). Set the next autonomous pick to `F3` (continuous discovery), the founder's named top core candidate.

**Why:** Cycle 8 deferred D4 as risky, but it judged the whole item (cancellation + replay + checkpoints) at once. Deep recon showed the *cancellation* half is the safe subset: the auto-advance tick already gates on mission status (`advanceMissionCore` early-returns for any non-running mission; the cron selects only `running`/`in_progress`), so cancelling is a pure DB state transition with **zero loop surgery** and is fully deterministic, i.e. fully covered by the `tsc`/build/review gate. No migration (no CHECK on `missions.status`/`agent_runs.status`; `agent_approvals.status` already allows `cancelled`). The "unattended = unsafe" premise was false for this slice. It is also core (loop/mission control), satisfying the founder's core-first ruling.

**Tradeoffs considered:** (1) Hold D4 for founder-supervised runtime testing — rejected: the logic is offline-verifiable and the end-to-end UX simply joins the standard publish-then-verify queue, so holding would waste correct, gate-green work and idle the loop against the founder's "do not idle" ruling. (2) Pivot straight to F3/O1 and skip D4 — rejected because D4 was already built and verified this cycle; instead F3 is queued as the explicit next pick. (3) Cascade depth: cancelling the mission alone is insufficient (the resume cron resumes child runs by their own status), so in-flight `agent_runs` must also flip to `cancelled`; and held `builder_file_claims` must be released explicitly because the terminal-run trigger skips `cancelled` (else file locks orphan and block future builds).

**Impact:** New `cancelMission` (`src/lib/missions.functions.ts`); Cancel control in `_authenticated.missions.$missionId.tsx`; `cancelled` `StatusBadge` in `Primitives.tsx`; `docs/features/d4-mission-cancellation.md`. Dashboard: D4 ◐, H1-TASKS ✅. Pending publish + live verify.

### 2026-06-17 · "Agent manager" framing: reinforce the narrative, no new surface, cost-per-outcome split across surfaces

**Decision:** Adopt "2026 = the year of the agent manager" as a *reinforcing narrative* for the role the product already gives the user (you direct and review a fleet of agents), not a category change and not a new in-app surface. Keep the wedge ("the AI that red-teams your roadmap" + decision memory) as the lead; layer the operating-model frame underneath on the landing page. No surface literally named "Agent Manager." Express the founder's cost / API / time / efficiency ask as **cost-per-outcome**, split across surfaces: light on the calm front (Today / Missions), full per-agent telemetry behind the Engine Room door.

**Why:** The agent-manager shift is real but it is already Cadence's thesis (v10: the PM decides and watches it get built; v9 wedge: be the manager, not the maker), so it amplifies positioning rather than changing it. Leading with "manage your agents" as the category would commoditize Cadence into agent-ops and shift the ICP from PM-on-judgment to platform/eng-on-monitoring. A literally-named "Agent Manager" dashboard of cost / API / efficiency is the Engine-Room Doctrine's named failure mode ("control-room creep"); the capability already exists, outcome-named, in the Engine Room (Activity, Analytics, Loop health, Spend), with Missions for dispatch and Traces for replay, on complete data plumbing (`ai_events`, `agent_runs`, `tool_calls`, `drift_snapshots`).

**Tradeoffs considered:** (a) *Make "Agent Manager" a real in-app surface / landing headline.* Rejected: violates the doctrine and commoditizes the category. (b) *Repoint positioning to agent management.* Rejected: demotes the judgment wedge and muddies the ICP. (c) *Narrative only, no product work.* Folded in: the narrative ships now (Part A, docs); the one genuine capability gap (cost-per-outcome) is queued as the existing backlog item ENG-06 (Part B), not invented as new scope. (d) *Raw cost / token metrics on the calm front.* Rejected per the audience split: the front gets cost-per-outcome, the engine keeps raw telemetry.

**Impact:** Docs only this session (Part A). Updated: this log; [`strategic-inputs-log.md`](./strategic-inputs-log.md) (full reasoning, fundraising-quotable); [`v9-decision-wedge-and-build-next-2026-06-17.md`](./v9-decision-wedge-and-build-next-2026-06-17.md) §2 (operating-model frame added to the wedge's marketing / persona implications); [`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md) (rule 2 worked example: "Agent Manager" to outcomes). Queued (Part B, not started): ENG-06 / F-GOV-COST-SURFACE (cost-per-outcome chip on the calm front + unit-economics roll-up behind the Engine Room door), Lane G; tracked in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md).

### 2026-06-17 · Auth + data backend: stay on Lovable Cloud for now, own it later (runbook parked)

**Decision:** Long-term, Cadence will move auth and data off **Lovable Cloud** (Lovable's managed Supabase) onto **our own Supabase project + our own Google OAuth**. **For now (founder call, 2026-06-17), we stay on Lovable Cloud** to avoid friction before the first demo, and migrate later when ready even if it takes some effort. The full step-by-step is parked and ready: [`../operations/auth-backend-migration-runbook.md`](../operations/auth-backend-migration-runbook.md) (status: DEFERRED).

**Live tax of staying (noted for the eventual go-decision):** the resilient `handle_new_user` auth trigger is reverted to a fragile body every time a Lovable sync regenerates it (KI-13 regression, fixed again in `supabase/migrations/20260617140000_ki13_restore_signup_resilience.sql`). Until we own the backend, signup must be re-verified and the migration re-applied after any Lovable sync that touches the auth trigger. This is the recurring cost the migration eventually removes.

**Why:** Repo audit (2026-06-17) showed we are **already on Supabase Auth**, not a proprietary Lovable engine. The app trusts only Supabase JWTs (`auth-middleware.ts` uses `supabase.auth.getClaims`); the sole Lovable-specific piece is the OAuth broker `@lovable.dev/cloud-auth-js` in `src/integrations/lovable/`, used only in `login.tsx` + `signup.tsx`. So owning auth is ~3 files + repointing five `SUPABASE_*` env vars, and it is free (Supabase + Google OAuth free tiers). The decisive timing factor: the only hard part of a Supabase migration is moving live `auth.users`, and we have ~0 real users today, so the cost is near-zero now and rises with every demo signup.

**Tradeoffs considered:** (a) Migrate now vs after first demo. Now wins because there is no user data to migrate yet and it de-risks the demo onto infra we control. (b) Stay fully on Lovable Cloud. Ruled out for long term given the founder's stated intent to not host on Lovable. Lovable officially supports bring-your-own-Supabase (Project settings → Integrations → Supabase), so we keep the builder while owning the backend.

**Impact:** New planned runbook `docs/operations/auth-backend-migration-runbook.md` (linked from `docs/README.md`). No code changed this session. Execution will touch `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/integrations/lovable/`, env/wrangler secrets, and stand up a new Supabase project from `supabase/migrations/`.

### 2026-06-17 · The master blueprint (v10), the implementation plan, and the doc role map

**Decision:** Produced the granular master execution blueprint [`v10-master-blueprint-2026-06-17.md`](./v10-master-blueprint-2026-06-17.md): it fuses v7 (positioning) + v8 (structure) + v9 (decision lens) with a file-level scan of `main` into an item-by-item plan - tagline, naming/verbatim, IA + navigation, screen-by-screen function, a pain-point map, the analytical engine, the agentic engine, connectors, architecture, pricing, and a **granular feature catalog organized by file-disjoint build lanes (A SENSE, B LEARN/analytics, C DECIDE/wedge, D BUILD/autonomy, E MONETIZE/PLG, F INTEROP, G cockpit/IA) with a priority pick-order (P0/P1/P2/CUT)**. Paired it with [`../planning/v10_implementation-plan.md`](../planning/v10_implementation-plan.md) (the execution mechanics: the per-item build loop, sprints, milestone gates, definition-of-done). Reconciled the [feature dashboard](../planning/feature-dashboard.md) with the priority+lane pick-list and new items (WEDGE, W1-AUTO, MOAT-VIS, MOAT-METRIC, F-SHARE-TEARDOWN, SANDBOX, AMBIENT-ARC, Q1-MCP) + CUT/DEFER marks. Added a **doc role map** to the strategy README as the single arbiter of which doc to pick, and cross-linked v10 + the implementation plan in README, CLAUDE.md, AGENTS.md.

**Why:** The founder asked for a genuinely granular master plan (every feature: why/what/how) plus an implementation plan, and flagged doc sprawl as a confusion risk. v10 carries the granularity; the implementation plan carries the execution; the role map removes ambiguity about which doc is authoritative.

**Tradeoffs considered:** _A v10 at the same altitude as v8/v9_ rejected by founder as insufficient; rewrote it granular (per-feature pain/what/how + lanes + pick-order). _Mass-archiving the overlapping planning docs now_ (strategic-tasks, v7-feature-map, v7-functionality-map, v4-rebuild-handoff) deferred: each is still linked from operational files (AGENTS.md, ENTRY.md, TASKS.md, plan.md, hooks), so a careless move breaks the references the founder wants clean; instead flagged them "superseded, queued for archive" in the role map and recommended a dedicated archive pass (one confirmation). _Inline vs subagents_: scanned the live code with three parallel read-only Explore agents, synthesized the blueprint myself for coherence.

**Impact:** New: `v10-master-blueprint-2026-06-17.md`, `../planning/v10_implementation-plan.md`. Updated: strategy `README.md` (role map + index + how-to-use), `feature-dashboard.md` (pick-list), `CLAUDE.md`, `AGENTS.md`, `README.md`. Done 2026-06-17 (archived to docs/planning/archive/ with banners + all inbound refs updated): `strategic-tasks.md`, `v7-feature-map`, `v7-functionality-map`, `v4-rebuild-handoff`, updating their operational references. Memory: [[strategy-canon-and-inputs-log]], [[feature-dashboard-source-of-truth]].

### 2026-06-17 — Flow mode audio: real recordings, not synthesis
**Decision:** Flow mode's soundscape moved from synthesized Web Audio (filtered white noise) to real, looped recordings dropped into `public/soundscape/*.mp3`, one per preset (Rain / Ocean / Forest / Lo-fi / Heartbeat). Also added a custom-minutes timer field beside the 25/50/90/Open chips.
**Why:** Founder tested the shipped synth and found all presets harsh, which defeats the purpose (calm, focused, enjoyable). The point of the feature is relaxation; harsh noise undoes it.
**Tradeoffs considered:** (1) Better synthesis (brown/pink noise + heartbeat) was offered (file-free, no licensing) but rejected in favor of real audio quality. (2) I could not autonomously source great, no-attribution, loopable audio with verifiable licensing (Pixabay gated/403, Wikimedia Commons quality poor and attribution-encumbered) and cannot audition for quality, so committing scraped audio was ruled out as a legal + quality risk. Files are sourced by the founder (or links handed to me) from royalty-free / CC0 libraries, with per-file license provenance recorded.
**Impact:** Rewrote `src/lib/flow/soundscape.ts` as a real-audio buffer player (gapless loop + crossfade, graceful when a file is missing). Updated presets/timer in `src/lib/flow/session.ts`, the `soundUnavailable` hint in `src/hooks/use-flow-mode.tsx` + `FlowWidget.tsx`, added `public/soundscape/README.md` (sourcing + license table), updated `docs/features/flow-mode.md`. Reverses the original "synthesized in-browser" choice recorded for OPS-01.

### 2026-06-17 · The Decision Wedge, the competitor posture, and the build-next call (v9)

**Decision.** A founder brainstorm (holistic read of Andrew Miklas's "Cursor for Product Managers" essay through operator / PM / investor / marketer lenses, reconciled against the shipped product) settled four things, captured in the new decision-lens canon [`v9-decision-wedge-and-build-next-2026-06-17.md`](./v9-decision-wedge-and-build-next-2026-06-17.md). (1) **Conceptual foundation:** code has a fast oracle and "what to build" does not, so a feedback signal must be *manufactured* by closing the loop and remembering outcomes; this makes "memory is the moat" a first principle, not a preference, and confirms ambient-plus-governed over autopilot. (2) **Launch wedge = the Critic teardown** ("Cadence tells you why your pet feature is wrong, with receipts"): lead with judgment, not PRDs; it is the first-10-minute moment and the shareable artifact for the viral loop; collapse the launch *narrative* to the individual PM (P2) while keeping the dual-persona destination. (3) **Competitor posture map** (integrate / absorb / race / ignore): the existential threat is the workspace incumbents (Linear, Notion, Productboard, Atlassian) bundling the loop, not the foundation labs, so pull a thin read-only MCP surface forward from M-D. (4) **Build call (refined 2026-06-17 after a founder challenge + market check):** own the autonomous *delivery* engine fully for PM-shaped work and push it to full autonomy (it is the USP, and is already built); do **not** aspire to be "Cursor" / chase the senior-eng IDE frontier (the hardest 20%, where even Devin fails most and where a believable 2-week build becomes 12 months); make delegate-out a **BYO-key escape hatch**, not a revenue-split dependency (customer's own Cursor/Devin/Claude key via the model-agnostic chokepoint; default path stays 100% in-platform and 100% revenue). The deciding insight: the integrated, Critic-hardened, cited PRD is the accuracy multiplier for autonomous coding (task-spec quality is the #1 success determinant; Devin ~67% PR-merge on well-scoped vs ~15-30% on vague work), a moat a bolt-on can never have because it requires owning the upstream. The 80/20 is *agent-vs-human*, not easy-vs-hard task. Design rule: autonomy where there is an oracle (code has tests/CI, so BUILD can be fully autonomous), governance where there is not (product judgment, so DECIDE stays gated), the precise form of "agents execute, humans govern." Market grounding: developers run multiple coding tools and are not locked to Cursor (the PM buyer even less so); SaaS consolidation is a 2026 tailwind (McKinsey 20-35% cut by 2027, ~70% consolidating).

**Why.** The biggest risk in the plan was the gap between the maximalist "product org running itself" vision and the honest "70% of a v1." A horizontal everything-platform with no addictive single loop is the common failure mode in this market; a single sharp wedge (Cursor's tab-autocomplete equivalent) de-risks launch. The oracle asymmetry is the deepest available justification for the memory moat and was not stated plainly in v7/v8.

**Tradeoffs considered.** _Lead with signal-to-PRD_ (the essay's pipeline) rejected: demos well but competes head-on with ChatPRD/Productboard and leads with paperwork. _Lead with decision-memory directly_ rejected for launch: strongest long-term but cold-start hurts. _Freeze the in-house Build engine entirely_ rejected: throws away a working, differentiated demo; the narrower "stop competing on the 20%" is correct. _Keep MCP at M-D_ rejected: it is a moat against incumbents, not a late feature.

**Impact.** New doc `v9-decision-wedge-and-build-next-2026-06-17.md`; strategy `README.md` index + how-to-use updated; `CLAUDE.md` read-order pointer updated. Build-next priority (v9 §6) tiers the work: T1 close the loop on real data (SEN-01, LRN-02), T2 package the Critic-teardown wedge (W6, PLG, F-SHARE), T3 thin read-only MCP (slice of Q1), T4 sandbox/preview + delegate-out (v8 Phase 3, BLD-04). Follow-ups: the README/v7 naming pass was completed 2026-06-17 (the product is Cadence everywhere); any feature-backlog re-priority from §6 remains. Memory: [[feature-dashboard-source-of-truth]], [[engine-room-doctrine]].

### 2026-06-16 · Name reverted to Cadence (the 2026-06-10 rebrand is retired)

**Decision:** The product name is **Cadence**, full stop. The 2026-06-10 rebrand to a different name is reverted and retired. Every user-facing reference, doc, comment, code string, config, and memory was swept back to Cadence; the two legacy rename disclaimers were reversed into a single "the name is Cadence, do not reintroduce the old name" note; and the v3 positioning file was renamed. Internal `cadence`-string identifiers (folders, DB tables, slugs) were always Cadence and are left untouched. Fresh-name exploration (space / physics / chemistry / bird directions) is **paused, not abandoned**, see [`../decisions/naming.md`](../decisions/naming.md).

**Why:** Founder directive. The retired name had drifted through the docs as if it were the live product name, and co-dev tools kept reading it wrong and re-injecting it, which created real confusion mid-build. Both names floated so far are contested anyway (Cadence Design Systems on one side; the 2026-06-10 candidate had its own route-planning and domain collisions on the other), so neither is a clean final brand, but carrying two names at once was the actual cost. Collapsing to one working name (Cadence) removes the confusion now; the final brand is a deliberate pre-launch decision, not a mid-build distraction.

**Tradeoffs considered:** _Pick a brand-new name now_ (space/physics/chemistry/bird shortlists were generated) rejected by founder as premature and slow. _Deep-rename the `cadence` code identifiers too_ deferred as needless breakage risk, they were never the source of confusion. _Keep the dual name_ rejected, it was the source of confusion.

**Impact:** Swept ~40 files (~171 brand references) back to Cadence; reversed the disclaimers in `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `README.md`, `ENTRY.md`, `.lovable-config.txt`, `plan.md`, `docs/strategy/README.md`, `TASKS.md`; renamed the v3 positioning file to `v3-positioning-cadence-2026-06-10.md`; updated `docs/decisions/naming.md`. Engineering terms (`short-circuit`, `circuit-breaker`) were deliberately preserved. Build verified green. Memory: [[autonomous-shipping-rhythm]].

### 2026-06-16 · Calm Front, Deep Engine — the Engine-Room Doctrine + two structure forks (founder reflection)

**Decision.** After a founder step-back ("we are overcomplicating; the front feels too technical; I want a Cursor-grade build engine fed by the loop"), the product's structure was settled on one law and two forks, captured in the new structure/build canon [`v8-calm-front-deep-engine-2026-06-16.md`](./v8-calm-front-deep-engine-2026-06-16.md). (1) **Law #1 = the Engine-Room Doctrine** (`docs/conventions/engine-room-doctrine.md`): calm front, deep engine; all machinery behind one Engine Room door, revealed on demand, recessed-not-removed and fully drillable (the audit trail stays first-class); user-facing labels name the outcome, not the mechanism. (2) **Fork 1 — Build = hybrid spine:** Cadence owns a Cursor-feeling build engine for the 80% common path and rents external coding agents (Claude Code / Cursor / Devin) for the heavy 20%; not an IDE rebuild; memory stays the moat. (3) **Fork 2 — two heroes, one loop:** sell on decide (Today), build toward ship (Build); center of gravity decide -> ship.

**Why.** The live surface audit found ~19 top-level surfaces, 12 leaking engine jargon (traces / drift / evals / prompts / guardrails / budgets / agents / swarm). The product had drifted into a technical control room, violating its own constitution ("complexity in the engine, not the experience"). The founder asked to make that principle load-bearing so the system resists the drift, and to set a clean forward structure he can hold in his head.

**Tradeoffs considered.** Build engine: orchestrate-only (thinner "ships here" feeling) vs own a full IDE-grade engine (off-thesis, competes with Cursor, hard on the Worker runtime) vs **hybrid (chosen)**. Hero surface: decide-only (under-plays the build energy) vs build-only (leans hardest on the most-technical part, under-weights the moat) vs **two heroes / one loop (chosen)**. Engine room: remove vs **recess (chosen)** — removing would break enterprise audit/trust, where a complete governed trail is a selling point.

**Impact.** New: `docs/conventions/engine-room-doctrine.md` (Law #1 + the greppable `Engine-Room:` stamp), `docs/strategy/v8-calm-front-deep-engine-2026-06-16.md`. Wired into `AGENTS.md` §3.0, `CLAUDE.md` §1.5 + §1.6, `docs/conventions/README.md`, and this index. Forward build sequencing: Phase 1 calm front + one door (IA regroup + outcome renames), Phase 2 Build-hero polish, Phase 3 sandbox + preview spine, Phase 4 close the loop. Known follow-up: `AGENTS.md` §0 and `README.md` still carry the heavier "Enterprise Product Cockpit / swarm" framing and should be reconciled to the calm-front language in a later positioning pass. Memory: [[engine-room-doctrine]], [[home-ia-and-design-context]].

### 2026-06-16 · "Brain / Ask / Memory" naming + IA (Knowledge→Brain, Chat→Ask, /memory folds into Brain) — market-grounded

**Decision.** Restructured the knowledge/insight surfaces around the word **Brain**, after market research (see below): **(1)** the Knowledge surface (`/knowledge`) becomes **"Brain"** — the product's brain, the one substrate of everything it knows (positioned in copy as "Product brain"; route unchanged). **(2)** the chat surface (`/chat`) is renamed from "Brain" to **"Ask"** — the query interface that interrogates the Brain. **(3)** the compounding agent-recall **moat** (the old top-level `/memory` surface) **folds into Brain as its "Memory" tab**; `/memory` redirects there. Brain's tabs are now **Calendar · Memory · Learnings · Decisions · Docs**, where Memory = what the loop recalls (`agent_memory`) and Learnings = what humans recorded (`learnings`) — two distinct tabs, which is exactly why the earlier Memory→Learnings de-collision was worth doing.

**Why (market research, June 2026).** "Second Brain" is saturated and consumer-coded (Notion/Obsidian/Tana/NotebookLM personal-PKM lane). "Copilot" is fully commoditized ("every vendor has an AI copilot") and collides with our internal "PM Copilot" agent. **"Product Brain / Company Brain"** is the *emerging, ownable* positioning in PM-AI — "AI that compounds knowledge instead of forgetting, maintains organizational memory, knows your product landscape" — which is literally our memory moat. "Memory" is owned by the infra layer (Mem0 "memory as a product", Letta, Zep), so as a *surface* it reads as the moat but the positioning phrase is "product/organizational memory." So: own **Brain** as the substrate, **Memory** as the moat-tab inside it, **Ask** as the differentiated query verb (not "another copilot").

**Tradeoff.** Folding `/memory` into a tab slightly demotes the moat from a top-level nav slot to a tab; accepted because the moat's prominence should come from the Gauntlet's "memory compounds" metric and the Brain framing, not a nav slot — and it removes the "is memory separate from the brain?" confusion. Founder chose "Brain" (short nav, "Product brain" in copy) over the longer "Product Brain"/"Company Brain" labels, and "Ask" over "Research"/"Scout".

**Durable home.** Code across `AppShell`, `/knowledge` (Brain), `/chat` (Ask), `/memory` (redirect), `CommandPalette`, and the learnings deep-link re-points; nav contract in `architecture/frontend.md` ("Brain surface"); build log in `plan.md` §4. Sources: taskade/buildin "second brain" listicles, mem0.ai/agentmarketcap memory-vendor landscape, chatprd/productside PM-AI "product brain" positioning. Related: [[home-ia-and-design-context]].

### 2026-06-16 · Today is an actionable command center (a little live, hand-sketched dashboard), not a passive metrics dump

**Decision.** The home (`/`, "Today") had drifted into ~15 look-alike panels. Two founder rulings reset it: (1) Today is an *actionable command center, not a passive dashboard* — it carries only what a PM acts on in one to three clicks (the calls, a tight pulse of the few vitals they act on, the top priorities to push, what is stuck, what changed) plus the while-away summary; deep analytics, trend explorers, history, and config live on their stations (Govern/Knowledge), one click away. (2) It must read like a *modern, interactive, real-time platform* — pencil-sketch data marks (`SketchLine`/`SketchBar` per `design.md`) and subtle, purposeful motion — never a boring old-school panel.

**Why / tradeoff.** This evolves (does not contradict) the earlier "Today is not a dashboard" rule: the line is *act-on-ability*, not "is it a number." A curated vital that links to its deep home is welcome; a full analytics surface is not. Motion is craft, not absence (an opt-in sketch draw-in + press feedback, gated by `data-motion`/reduced-motion), correcting the old "no animations" wording. The relocate-and-curate rule still holds: nothing was deleted or textualized, every panel moved to its station in its best form (the autonomy stage visual to the Gauntlet intact). The build composes the survivors into a Pulse strip (accept % + autonomy % trend marks, spend, a sketched run-activity sparkline) over an asymmetric action row (ICE bar chart + bottlenecks + what-changed) — deliberately breaking the identical-3-tile grid (`impeccable` AI-slop ban).

**Durable home.** `docs/conventions/home-and-today-ia.md` (rule 1 + placement rubric + two worked examples) and `docs/conventions/design-context.md` (motion is craft); build log in `plan.md` §4; commits `88a0ec65bb` (substance) + `304bc91146` (sketch dashboard). Memory: [[home-ia-and-design-context]].

### 2026-06-14 · Defer the product-wide humanization sweep to a pre-launch gate; build humanized at every level meanwhile

**Decision:** The one-time retroactive fingerprint sweep of EXISTING static product text (UI strings, seed data, components, and any code-level user-facing copy) is parked until the product is at or near a final, stable version, and is run as a pre-launch gate. **Cutoff date: 2026-06-14.** The retroactive sweep covers ONLY work authored before 2026-06-14 (the date this rule and the runtime sanitizer landed). Anything built on or after 2026-06-14 is authored under the rule and passes through `humanizeText()`, so it is treated as already clean and is NOT re-scanned or re-fixed, to save time and tokens. The documentation-level sweep done 2026-06-14 (README, strategy, feature docs) stands. Two things are NOT deferred and continue now: (1) the runtime `humanizeText()` sanitizer already humanizes all platform-GENERATED output at the AI chokepoint; (2) every NEW thing built going forward (code, functions, UI strings, seed data, generated-output prompts) is authored humanized and distinctive from the start: no em or en dashes, no ellipsis or filler-dot patterns, no invisible characters, and a unique, friendly, appealing voice rather than generic AI text. When the product nears final, Claude prompts the founder to run the full-product scan.

**Why:** Screens, functions, and features will still be added and removed before the product stabilizes. Sweeping all static product text now would mean re-sweeping or discarding that work as surfaces churn. Deferring the retroactive pass to a stable version avoids the rework while losing nothing: new work is already built clean and generated output is already sanitized at runtime.

**Tradeoffs considered:** Sweep everything now (rejected: rework as the UI churns) vs. defer the retroactive pass (chosen). Rely on memory alone for the reminder (insufficient) vs. bake it into the roadmap as a pre-launch gate plus a memory (chosen, so it self-surfaces near launch).

**Impact:** `docs/planning/v7-build-status.md` marks the doc sweep done and the full-product sweep deferred to a pre-launch gate (standing queue and the M-C row); `docs/conventions/humanized-output.md` records the deferral and its scope; a session memory carries the reminder duty. No code or product behavior changed by this decision.

### 2026-06-14 · v7 Phase B: the full delivery and architecture doc set, plus the doc-update cadence and the build-status tracker

**Decision:** Produced the complete v7 Phase-B documentation set and two standing process rules. Docs: the feature map, functionality map, TRD, and PRD (`docs/planning/`), plus the architecture diagrams, deployment, api, observability, and threat-model (`architecture/`; Mermaid for the visuals). Process: `docs/conventions/doc-update-cadence.md` (three tiers by rate of change) and `docs/planning/v7-build-status.md` (the always-current "what next" source of truth).

**Why:** The founder asked for the detailed delivery docs after the v7 canon, then expanded to the architecture diagrams and deployment topology, then asked for a documentation cadence (so living docs stay current while structure docs do not churn) and a single authoritative answer to "what are we building next."

**How:** A multi-agent workflow (grounded code discovery, parallel drafting that wrote nine files, one honesty plus consistency plus mermaid plus humanized-voice review). The first run produced nothing because the session was forced back into plan mode mid-flight, so the drafters correctly refused to write; the re-run out of plan mode wrote the set. The review found 2 must-fix and 5 should-fix issues (a brittle migration count, three malformed feature-map rows, a wrong planner-DAG field name, two mermaid parallelogram nodes, a garbled link, a stale `studio-chat.ts` reference in `CLAUDE.md`), all fixed. The fingerprint detector returns zero em/en dashes and zero invisible Unicode across all eleven docs.

**Tradeoffs considered:** Architecture diagrams as Mermaid (text in git) over binary images (anti-bloat). A new `architecture/threat-model.md` that complements `security.md` over editing it in place (lower clobber risk). The cadence doc as the tier registry over per-doc tier labels. Dropping brittle migration counts in favor of stable language.

**Impact:** 9 new Phase-B docs plus the cadence convention plus the build-status tracker; index rows in `docs/README.md` and `docs/conventions/README.md`; `CLAUDE.md` studio-chat.ts staleness fixed. Build-log: [`../../plan.md`](../../plan.md) section 4.

### 2026-06-14, Standing rule: humanized output, zero AI fingerprints (two levels)

**Decision:** No shipped or generated text carries a machine fingerprint. Two mandatory levels: (1) everything we author (code, docs, UI copy, comments, commits, seed data); (2) everything the platform generates for a user via an AI feature (PRDs, drafts, chat, research, rationales). Banned: em/en dashes, invisible Unicode (zero-width, NBSP, BOM, soft hyphen, directional marks), AI-cliche phrasing, over-uniform rhythm. Positive bar: a distinct voice that reads as Cadence, not one in a thousand AI apps. Master convention: [`../conventions/humanized-output.md`](../conventions/humanized-output.md).

**Why:** Trust (AI fingerprints read as low-effort and machine-made, the opposite of the craft a PM pays for) and the product promise (generated output must be usable as-is; em dashes and zero-width spaces betray the machine). Operator ruling; applies to every co-dev tool (Claude Code, Lovable, Gemini, Antigravity) so the standard is uniform across the multi-tool build.

**Tradeoffs considered:** New umbrella doc vs. extending `ui-voice.md` (chose umbrella: scope is broader than UI strings and adds runtime-output enforcement + the invisible-Unicode ban; `ui-voice.md` stays as the UI-string application, cross-linked, to avoid duplication/drift). Prompt directive alone vs. a hard sanitizer (both: the prompt is convenience, the chokepoint sanitizer in `runtime.server.ts` is the boundary, mirroring how guardrails and cost already pass through there). Implement runtime now vs. spec-and-plan (spec-and-plan: it touches the load-bearing AI chokepoint, and the founder framed implementation as forward work; the existing backend gets a separate full sweep).

**Impact:** New `docs/conventions/humanized-output.md`; `ui-voice.md` (+ invisible-Unicode ban); wired into `AGENTS.md` §3 (rule 9a), `CLAUDE.md`/`GEMINI.md` §1.6, `README.md`, `.lovable-config.txt`, the conventions index, and `v7` §13 ruling 8. Level-2 runtime enforcement (`humanizeText()` sanitizer + prompt directive), a build-time hook, and the codebase-wide sweep are specced and tracked, not yet wired. Build-log: [`../../plan.md`](../../plan.md) §4 (2026-06-14 · humanized output).

### 2026-06-14, v7 strategic reset: a new canon supersedes v6 (positioning course-corrections, grounded in a code-verified honesty audit)

**Decision:** A new positioning canon, [`v7-agentic-product-os-2026-06-14.md`](./v7-agentic-product-os-2026-06-14.md), supersedes v6 as the CURRENT source of truth (v6 retained as the engine/IA + market-evidence reference). It commits four course-corrections + a dual-persona beachhead, and replaces estimated gaps with a **code-verified state-of-product**. Founder rulings logged in v7 §13.

**Why:** The founder opened a post-Phase-3 strategic reset (audit-vs-claim · a self-run holistic market study · pricing/GTM/investor narrative · detailed docs to follow). A code truth-audit of `main` (2 verifier agents) **corrected an earlier over-pessimistic read**: the autonomy/memory/audit engine is genuinely wired (auto-advance, `memory_refs` threading, outcome→memory, retry/budget, the unattended-execution audit, the decision card, the gauntlet metrics: all real). The *real* gaps are narrow and fixable: a live orchestrator slug bug (`discovery`/`growth`/`analyst` not seeded → `mission.plan` throws), the migration-sync gate (KI-13 signup still 500s), connectors-not-operational, and observing-by-default.

**Course-corrections committed (founder, 2026-06-14):** (1) **moat = compounding memory**, not orchestration (commoditizing); (2) **ambient + governed**, not "autonomous" (reframes observing-default as a positioning/UX fix, not only a build gap); (3) **hybrid + outcome pricing**, charge for memory+decisions; the >$150/mo team bar is a *hypothesis to validate*, not a set price; (4) **complete the loop on real data before breadth.** Beachhead = **dual-persona** (senior/founding PM @ 50 to 400 B2B SaaS + individual PM/prosumer); GTM sequenced **serial-with-overlap** (P2 PLG first → P1 design partners) to avoid the two-heavy-motions trap the canon itself warns against.

**Tradeoffs considered:** Authored the canon directly (coherence) over a multi-agent drafting workflow (rejected: strategy docs fragment across authors); used a workflow only for the truth-audit + adversarial review. Phased deliverables (canon first → feature/functionality/TRD/PRD) over one all-at-once corpus (lower rework). **Honored the founder's explicit steer** that two supplied GCP reference PDFs are *inputs, not the basis*, led the market section with the independent failure-data baseline (Gartner 40%-cancelled / MIT 95%-fail) and flagged the GCP 88%-ROI as self-reported/vendor-optimistic.

**Impact:** New `docs/strategy/v7-agentic-product-os-2026-06-14.md`; v6 demoted across the index + entry pointers (`docs/strategy/README.md`, `docs/README.md` rule #4, `CLAUDE.md`/`GEMINI.md` §1.5, `.lovable-config.txt`, `README.md`, `Ai_Cofounder.md`). New reference layer: `docs/references/{external-strategy-synthesis-2026-06-14,ai-agent-trends-2026-gcp,future-of-ai-startups-2025-gcp}.md` (indexed). Two adversarial reviews hardened the canon (over-anchoring fix · six-not-five migrations · Critic-is-inline · trusted≠ambient · M-0 emergency-unblock · honest TAM · pricing-as-hypothesis · fast-follower contingency). **Next: Phase B (feature map · functionality map · TRD · PRDs) + M-0 (slug-bug fix + migration sync).** Build-log: [`../../plan.md`](../../plan.md) §4 (2026-06-14 · v7 canon).

### 2026-06-14, Shareable decision links (viral loop): app-layer allow-lists are NOT a security boundary on a public surface

**Decision:** Shipped the §7 viral loop, a public `/d/<share_slug>` route showing one owner-made-public decision, mirroring the prototype-share pattern. Built single-track (no worktree): recon → build → adversarial review → fix. The public read is a hand-built minimal projection (title/rationale/status/who/date, NO joins), private by default, revocable, with a CSPRNG slug.

**Why / the lesson:** the app's first anonymous-read surface inverts the security model (every other query is "see only your own rows"; this is "anyone sees this one row, and nothing else"). The first cut reasoned "the server fn only selects safe fields, so it's safe", WRONG. The anon publishable key ships in the browser bundle, so an attacker skips the app and calls PostgREST directly; **RLS gates rows, GRANT gates columns**, a table-wide anon grant let anon read owner `user_id`/`workspace_id`/`*_id` of every public decision. The adversarial review (8 findings, 3 critical) forced the gates to the DATABASE WIRE: a COLUMN-scoped anon grant, an RLS policy scoped `TO anon` (an unscoped policy ORs into authenticated reads → cross-tenant leak), and dropping the table from the Realtime publication (Realtime broadcasts full WAL rows, ignoring column grants). App-side projections are convenience, never a boundary on a public surface.

**Tradeoffs considered:** A `security_invoker` view (rejected: it would require an anon base-table grant + RLS, back to square one; a definer view trips the Supabase linter). Service-role-in-a-server-fn (rejected: importing the server-only client into a client-referenced `.functions.ts` breaks the client bundle, and CF-Worker env access for the service key is fragile). The column-scoped grant + `TO anon` policy is DB-enforced, view-free, and mirrors a hardened version of the prototype pattern. Showing owner/workspace attribution on the public page (deferred: privacy; opt-in later).

**Impact:** Migration `20260614170000_p3_decisions_share.sql`; `src/lib/decisions-share.functions.ts`; `src/routes/d.$slug.tsx`; `DecisionDetail.tsx`; feature doc. **Logged KI-17:** the older prototype `/p/$slug` surface carries the same pre-existing anon-leak pattern (a verified fast-follow). Applies on the next Lovable sync. **Next: pricing/paywall** (the last Phase-3 build item). Build-log: [`../../plan.md`](../../plan.md) §4 (2026-06-14 · viral loop).

### 2026-06-14, KI-14: standardize the eval score scale on 0 to 100 (decision + the "verify recon against source" lesson)

**Decision:** The suite-eval score scale (`eval_runs.avg_score` / `eval_case_results.score`) is standardized on **0 to 100**, not 0 to 1. Migration-led: widen `numeric(4,3)`→`numeric(6,3)` + rescale existing 0 to 1 rows ×100 across `eval_runs`, `eval_case_results`, and the derived `drift_snapshots.avg_eval_score`. The only app change is a drift UI formatter (render the 0 to 100 integer).

**Why 0 to 100:** it's the live judge's native scale (`eval-runner.server.ts` prompts "0-100" and clamps to it), the scale of `eval_suites.pass_threshold` (INTEGER, default 70 / seeded 80), and what the eval UI already assumes, so it needs the fewest changes. The column was the only thing wrong: `numeric(4,3)` (max 9.999) couldn't hold a real 0 to 100 write (silent overflow) and made the 0 to 1 seeds read "score 1 · below gate 80". 0 to 1 would instead have meant changing the judge prompt, the threshold semantics, the form, and the display.

**The method lesson:** both recon agents flagged `trust.server.ts` and `drift.server.ts` as mandatory consistency edits ("trust wraps to max", "drift breaks"). Reading the actual source disproved both: trust consumes a DIFFERENT table (`ai_evals`, the per-message chat-judge, still 0 to 1) and drift compares via a scale-invariant pct-delta. Acting on the recon's word would have introduced two needless, possibly-breaking edits. **Verify recon claims against source before coding**, recon points you at the files; it doesn't get a vote on the diff.

**Tradeoffs considered:** Reproducing the 354-line `seed_demo_workspace` to fix its six 0 to 1 literals (rejected: it's untestable here, and a transcription error would silently break the official investor-demo provisioner; the review's "it's a 5-number edit" is mechanically wrong since `CREATE OR REPLACE` needs the whole body). Instead the documented re-seed (`demo-credentials.md`) now warns + ships the corrected procedure, fix the operator path, not just the code path. `numeric(5,2)` vs `numeric(6,3)` (chose 6,3: keeps the old 3-decimal scale, so the widen loses no precision). A `CHECK(0..100)` constraint (skipped: `numeric(6,3)` already can't overflow for 0 to 100, and an unseen out-of-range live row would fail the migration apply).

**Impact:** Migration `20260614160000_p3_ki14_eval_score_0to100.sql`; the `DriftPanel`/`DriftSurfaceDetail` formatter; docs (`demo-credentials.md` re-seed, `known-issues.md` KI-14 ✅, the eval-gate threshold restated 0 to 100 across AGENTS/architecture/plan/feature-backlog). Hardened by a 3-lens adversarial review (12 findings, none blocking). Applies on the next Lovable sync. **Next: the shareable-decision viral loop + pricing, gated on the §8 gauntlet.** Build-log: [`../../plan.md`](../../plan.md) §4 (2026-06-14 · KI-14).

### 2026-06-14, v6 Phase 3 opened; slice 1 = "Unblock + Instrument" (sequencing + method)

**Decision:** Phase 3 ("Proof & Launch") is taken in slices, not whole. **Slice 1 = unblock signup (KI-13) + instrument the three north-star gauntlet metrics**, chosen first, and not a close call: Phase 3's entire premise is real design partners on real data (§8 gauntlet), and that was blocked at the door by KI-13 (signup 500s → no new real accounts), and §9 itself says Phase 3 "starts by instrumenting the metrics." Pricing and the viral loop are real but premature before anyone can sign up; "real-data hardening" is reactive (needs partner feedback) and "public launch" is GTM, not a code slice. **Method:** recon-first (3 parallel read-only Explore agents established ground truth: KI-13 root cause, the metrics' data/surfaces, the later workstreams' state, with zero file-conflict risk), then the two file-disjoint tracks built in parallel (Track 2 in a background git worktree while Track 1 went on main), then a 3-lens adversarial-review **workflow** over both diffs (find → independently verify each finding) BEFORE landing on main.

**Why:** Sequencing correctness, building monetization/virality on a welded-shut front door is wasted work; unblock the door first. On method: parallelism pays off with zero risk on *recon* (independent reads can't collide) and on *file-disjoint build tracks* (worktree isolation keeps two agents from stomping one working tree), and the project's claim-never-outruns-wiring rule means the proof metrics must actually be honest, so "build green + lint clean" is not sufficient; an adversarial review is. It earned its keep: 12 confirmed findings, headlined by a Metric-A honesty bug, counting only `status='approved'` dropped every approved-then-executed/failed acceptance (resolveApproval→executeApproval flips approved→executed/failed), so the acceptance rate read artificially low: the exact opposite of honest.

**Tradeoffs considered:** Fanning many agents at the whole phase at once (rejected: Phase 3 isn't a wide independent-feature set; it's ~2 disjoint code tracks plus reactive/GTM work that don't parallelize as blind builds). Trusting the worktree agent's "build green" self-report (rejected: automated checks don't catch logic / RLS / honesty defects). Bundling KI-14 (eval-score scale) into this slice (deferred: it's eval scores, not the three gauntlet metrics; bundling would bloat the slice; it is the recommended next hardening). Resolving the ritual workspace server-side via RPC vs storing null (chose null: the metric is user-wide and unused per-workspace; a wrong default attribution is less honest than null, and it also closes the cross-tenant write).

**Impact:** New `supabase/migrations/20260614140000_p3_ki13_signup_resilience.sql` (resilient `handle_new_user`) and `20260614150000_p3_ritual_sessions.sql`; new `src/lib/gauntlet.functions.ts` + `gauntlet-metrics.ts`(+tests) + `src/components/observe/GauntletMetricsPanel.tsx`; `_authenticated.{govern,index}.tsx` edited; feature doc `docs/features/gauntlet-metrics.md`. Two commits on **main** (`9401ae2` KI-13 · `e6c8b5b` Gauntlet). Both migrations apply on the next Lovable sync. **Next: KI-14, then the viral loop + pricing, gated on the §8 gauntlet.** Build-log: [`../../plan.md`](../../plan.md) §4 (2026-06-14 · slice 1).

### 2026-06-14, v6 Phase 2 completed (W2 + W3): audit unattended work, harden A2A, reuse the OS view

**Decision:** **W2** surfaces autonomy honestly rather than claiming new autonomy: the trust arc already executes write tools inline at trusted/ambient, so we built an "Executed unattended" audit on the mission page (over `tool_calls`, which only the inline/auto path writes) instead of expanding what gets delegated. **W3 (a)** hardens the A2A contract by validating `memory_refs[]` against real `agent_memory` ids in `enqueueHandoff` (artifacts left free-form: validated on use). **W3 (b)**, **reused the existing Swarm HUD** as the "Agents at Work / OS state" surface (the `/swarm` route is mothballed → `/missions?tab=agents`) and enriched it with the moat stat (`outcomes_remembered`), rather than building a redundant `/system` route. The v6 §9 "OS framing/IA" item is satisfied by this enrichment; a deeper IA pass can fold into Phase 3 on real-data feedback.

**Why:** Claim-never-outruns-wiring. W2's audit is *provably honest* (every `tool_calls` row is an inline auto-execution; gated tools queue approvals and `executeApproval` never writes `tool_calls`), so "executed unattended" is a fact, not a claim. Reusing the Swarm HUD honors the anti-rot / don't-rebuild discipline. A review-driven correction added the two genuinely-missing side-effecting tools to the consequence catalogue (so the audit doesn't under-report) and replaced a blanket "each is undoable" line with per-row reversibility.

**Tradeoffs considered:** Expanding delegatable product tools in W2 (deferred: observability of existing delegation is the honest first step; new autonomy claims need the arc to actually perform them). A new `/system` OS dashboard (rejected: the Swarm HUD already integrates live agents/missions/handoffs/approvals/throughput). Hardening artifacts in W3 (deferred: opaque hints validated on use; lower value than memory_refs).

**Impact:** `tool-consequences.ts` (+`isSideEffectingTool`, +2 catalogue entries), `missions.functions.ts`, `_authenticated.missions.$missionId.tsx`, `ai/handoff.server.ts`, `swarm.functions.ts`, `cockpit/AgentsPanel.tsx`. **Phase 2 (W1·W2·W3) is complete; next is Phase 3 (Proof & Launch), gated on the §8 gauntlet.** Build-log: [`../../plan.md`](../../plan.md) §4 (2026-06-14 · W2+W3).

### 2026-06-14, v6 Phase 2 opened; W1 = make the memory moat real (sequencing + approach)

**Decision:** Phase 2 ("The OS / Autonomous Execution") was decomposed (grounded by a code sweep) into three sequenced demoable units: **W1, close the memory-compounding loop** (the moat), **W2, execution-delegation audit trail**, **W3, A2A hardening + an "Agents at Work" OS view**. **Started with W1, and it was not a close call:** it's the founder's literal moat (Pillar 2: the Decision System / compounding memory), the most grounded and lowest-risk, builds directly on Phase 1's memory work, and fixes a **claim-outruns-wiring gap**, v6 §3 claims "every decision + outcome is remembered and re-scores future priorities," but only the *re-score* half was wired; outcomes wrote a `learnings` audit row that **no agent ever reads** (`match_agent_memory` reads `agent_memory`, not `learnings`). **Approach:** distil each recorded outcome into a *global-scope, embedded* `agent_memory` row so `match_agent_memory` returns it to a future run of any agent and Phase-1 threading carries it across hops, the loop now genuinely learns, not just records. **Embed-or-skip** (a null-embedding row is permanently unrecallable and there's no re-embed sweep, so never write a ghost) and idempotent-on-re-record.

**Why:** The moat is the defensible idea; making it *real* (not slideware) is the highest-leverage Phase 2 move and the most honest reading of "claim never outruns wiring." Execution-delegation (W2) is already substantially wired via the trust arc, so it's lower-urgency and riskier to expand; OS/IA (W3) is a presentation layer best built once the moat + delegation are real.

**Tradeoffs considered:** Starting with execution-delegation (rejected: already mostly wired; the gap is narrow tools + observability, not the moat). Starting with the OS dashboard (rejected: a view over capabilities that should be real first). Surfacing outcome memories in a new panel (deferred: the recall path + existing `learnings` Memory panel + trace recalled-memory block are the honest demo surfaces; no new UI needed for the moat to be real). A partial-unique-index upsert for idempotency (deferred: awkward on a jsonb expression via supabase-js; the delete-then-insert is self-healing for single-operator UX).

**Impact:** New `src/lib/ai/outcome-memory.ts`; `memory.server.ts` (+`rememberOutcome`), `outcome.functions.ts` (distil hook). Adversarial review fixed 4 real issues (unrecallable ghost rows, jsonb-filter idiom, false ICE-move display, blast-radius). Full build-log: [`../../plan.md`](../../plan.md) §4 (2026-06-14 · W1). Architecture: [`../../architecture/orchestration.md`](../../architecture/orchestration.md).

### 2026-06-14, v6 Phase 1 "The Loop Runs Itself": four design rulings on how autonomy gets wired

**Decision:** Three operator rulings (via AskUserQuestion) + one engineering decision shaped how Phase 1 closes the claimed↔wired autonomy gap (v6 §9 / Appendix B): **(1) Auto-advance home, fold into the existing `resume-runs` sweeper**, not a dedicated `mission-advance-tick` cron. Rationale: a new tick needs a pg_cron scheduling migration, which waits on the next Lovable sync; folding into the per-minute sweeper that already runs means auto-advance fires the moment code deploys, dodging the recurring migration-apply gate. **(2) Hop-failure retry, bounded, 2 attempts + exponential backoff**, tracked with new `mission_steps.{attempts,max_attempts,next_retry_at}` columns (over "single retry, no schema" and "no auto-retry, surface to operator"). **(3) Adaptive step budget, arc + mission-size aware** (over progress-extended or both): specialists keep the conservative floor, the orchestrator scales with the planned DAG size, trusted/ambient agents earn a little headroom, under a hard ceiling. **(4) Engineering decision, make the advance deterministic and model-free.** `advanceMission` re-invoked the orchestrator *LLM* each wave, but `mission.plan` already rejects re-planning, so that call only ever did mechanical observe→dispatch→finalize. Replacing it with pure DB ops (`advanceMissionCore`) is cheaper, faster, deterministic, concurrency-safe (claim-first CAS), and unit-testable, preserving behavior; the LLM now runs only for the initial plan.

**Why:** The North Star is genuine autonomous end-to-end execution, governed; the discipline is "claim never outruns wiring." Phase 1's job is to make the *autonomous* path real, so the rulings optimize for (a) shipping without the migration gate blocking the headline behavior, (b) reliability under transient failure, and (c) tying autonomy headroom to *earned* trust, not a flat grant.

**Tradeoffs considered:** Dedicated cron (cleaner separation) lost to the sync-gate cost. A model-driven re-advance (could adaptively re-plan) lost because re-planning is already disallowed, pure cost. Unbounded/aggressive retry lost to cost + the risk of masking real failures. A flat budget bump lost to the "earned trust" principle. An adversarial review also surfaced (and we fixed) an orchestrator budget regression, a transient-error caching bug, a stranded-dispatch hang, and the `match_agent_memory` `auth.uid()`-only filter that silently null'd `memory_refs` on the autonomous path; three other findings were verified wrong against source and rejected (one proposed fix would have introduced an infinite retry loop).

**Impact:** New `src/lib/ai/{mission-advance.server,memory.server,budget,retry}.ts`; edits to `loop.server.ts`, `handoff.server.ts` (`maybeCompleteMission` now DAG-aware: fixes a latent premature-completion bug), `tools/orchestrator.server.ts`, `orchestrator.functions.ts`, `resume-runs.ts`; migrations `20260614090000` + `20260614091000`. Full build-log: [`../../plan.md`](../../plan.md) §4 (2026-06-14). Feature page: [`../features/loop-runs-itself.md`](../features/loop-runs-itself.md). Architecture: [`../../architecture/orchestration.md`](../../architecture/orchestration.md).

### 2026-06-13, v6 adopted: Cadence is the **Agentic Product OS**; Phase 0 = the Honest Wedge

**Decision:** Founder rulings (locked, full reasoning in [`v6-agentic-product-os-2026-06-13.md`](./v6-agentic-product-os-2026-06-13.md) §10): (1) **Position = Agentic Product OS (umbrella)**, the autonomous operating system for the whole product lifecycle, with two pillars: **PM Chief of Staff** (felt entry, the daily calls-queue ritual) + **Decision System** (the moat, evidence→decision→compounding memory). The system must *execute end-to-end*, not just advise. (2) **Ship 5 agents met-through-output**, Scout · Strategist · Critic · Scribe · Chief of Staff, at the **display layer only**; the 19-agent mesh stays the engine/expansion map, never a user-facing concept. (3) **Claim never outruns wiring**, at every phase, claim only what is wired; no "fully autonomous" copy anywhere; build real autonomy aggressively, let messaging mature in lockstep. (4) **Delete the human-PM-legacy UI**, sprint button, To-Do/Doing/Done kanban, capacity-hours contradict the pitch. (5) **Defer the agent marketplace / build-your-own-agents, but preserve the A2A `HandoffPayload` contract** (add the missing `memory_refs[]` field now so it is config later, not a rebuild). (6) **Beachhead = senior/founding PM at a 50 to 400-person B2B SaaS.** (7) **No hard date / no August deadline**, continuous, phase-sequenced (P0→P3), demoable milestone ~every 2 weeks, ~45-day envelope as intent. (8) **Cadence is a placeholder name** (Cadence). v6 is the canonical **wedge + positioning** doc; v4 remains the **expansion/engine map**; v5 is folded in.

**Why:** Honest finding from a 3-lens internal audit + 3-stream market research + a 5-seat pressure test: the engine is real and good, but the story over-claims relative to what is wired today and the UI (sprint/kanban) contradicts the story. The market punishes hollow autonomy claims (enterprise AI abandonment 17%→42% in a year; Gartner: 40% of agentic projects cancelled by 2027) and rewards approve-by-exception + opinionated defaults + value in <10 min. The defensible whitespace is the **governed, autonomous closed loop with compounding memory**, owned by no credible player, winnable only as a vertical, opinionated system-of-record, never neutral middleware.

**Tradeoffs considered:** Keeping the org-cockpit as the felt product (rejected: re-exposes the engine-room anatomy the stress test condemned). Claiming full autonomy now to match the ambition (rejected: the claim-never-outruns-wiring rule; trust is the on-ramp, not a cap). Mass-deleting the ~43 mothballed routes (rejected: most already redirect; deleting route files desyncs `routeTree.gen.ts`). Seeding demo agents at `ambient` (rejected: auto-executes everything and removes the calls that ARE the wedge; seed at `trusted`). Renaming DB agent slugs to the 5 names (rejected: rename-disclaimer pattern: internal identifiers stay; map at the display layer).

**Impact:** New canonical strategy `docs/strategy/v6-agentic-product-os-2026-06-13.md` (already landed); read-order pointers in `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`/`.lovable-config.txt`; `active-task.md` = Phase 0 (W1 to W6) tracker. This entry opens the Phase 0 build: W1 deletes the sprint/kanban/capacity surfaces (keeping the `tasks` table Today shares), W2 adds `src/lib/agent-vocabulary.ts`, W3 the decision-first card, W4 the cold-start on-ramp, W5 surfaces the loop-closure re-score + adds `HandoffPayload.memory_refs[]`, W6 seeds the demo account at `arc='trusted'`.

### 2026-06-12, The development surface is named **Build**, and it must read as a station in the pipeline

**Decision:** Founder ruling (voice, screen-9 session): the surface formerly Builder → Studio is now **Build**, user-facing name AND URL (`/build`, `/build/$missionId`; `/studio/*` redirects, reversing the morning's mothball direction). Internal identifiers stay `studio.*` per the standing disclaimer pattern (now BUILDER ➔ STUDIO ➔ BUILD in CLAUDE.md). Two companion mandates: (1) the surface should feel as user-friendly and powerful as a first-class AI coding tool (Cursor / Windsurf / Claude Code / Antigravity), implemented as UX qualities, not new engine features: full transparency (timeline, diff, CI, cost always visible), mid-flight steering, explicit consequence-labeled gates, keyboard affordances, zero dead ends; (2) the pipeline must be legible on the surface, approved specs come in, the build happens under gates, merged work moves on to Releases and the outcome loop re-scores ("the pipeline continues"). Shipped as the detail's journey strip (build → PR → CI → shipped → "lands in Releases"), every stage derived from a real field.

**Why:** "Studio" read as a place; "Build" reads as the station's job and matches the Loop kicker family (Sense / Learn / Ship). The founder's pipeline framing makes the platform's core loop, signals → specs → build → outcomes, visible at the exact point where work becomes code.

**Tradeoffs considered:** Keeping /studio URLs with Build labels only (rejected: the morning rename moved URLs too; half-renames read as drift); porting a spec stage into the journey strip from the session payload (rejected for now: `getStudioSession` returns no prd field; no-filler law. If the payload grows one, add the stage).

**Impact:** routes, AppShell/CommandPalette (frozen-exception commit), cross-surface copy sweep, CLAUDE.md disclaimer, `docs/features/studio.md`. Second rename in one day, if a third is ever proposed, consolidate the disclaimer chain first.

### 2026-06-12, Drill-downs ride search params; one detail surface per artifact; a richer production detail outranks the reference's

**Decision:** Screen 6 (loop-detail drill-downs, Session A) establishes the platform's list→detail contract, which screen 7 (govern-detail) inherits: (1) drill state rides **optional search params** on the existing route (`?signal=` / `?opp=` / `?decision=` / `?learning=` / `?connector=`), never component state, every detail is linkable and back-button-friendly; (2) the detail replaces **only the tab body** (SurfaceHeader + TabRow stay; switching tabs clears the drill because setTab navigates with a fresh search object); (3) **one detail surface per artifact**, the Decisions side sheet retired in favor of the reference DrillHeader layout, production mutations riding along; (4) when production already has a **richer real detail** than the reference mock, production wins, Releases keeps its `/missions/$missionId` deep-link (full cockpit: steps, gates, trace, cost) instead of gaining the reference's semver ReleaseDetail, whose shipped-list/closed-signals/before→after metrics have no production source.

**Why:** Linkable drills make every judgment shareable (founder demo flows, agent citations); a second detail surface per artifact splits truth; and porting the reference's release screen would have required inventing all of its numbers, the no-filler law decides.

**Tradeoffs considered:** Ephemeral `setDrill` state like the reference (rejected: not linkable, breaks back); a `$id` child route per detail (rejected: heavier, regenerates routeTree, and the tab context would be lost); porting ReleaseDetail with only its real fields (rejected: nothing would remain beyond what the mission cockpit already shows).

**Impact:** `?tab=`-contract routes (`product`, `knowledge`, `settings`), six detail components, `DecisionsPanel` sheet removal. Screen 7's govern drill-downs must follow the same param contract.

### 2026-06-12, Onboarding is frictionless: connecting sources is never a gate

**Decision:** Founder ruling (mid-session, screen 8): the first-run flow must never require connecting a source to proceed. Every step is skippable; at zero connections the step-1 primary action IS the skip, "Skip for now · connect anytime in Settings", and the sub copy promises nothing is required. The three steps form one connected journey: whatever the user keeps (connections, staff toggles, the chosen goal) persists as real data into the next phase and into the workspace.

**Why:** A connect-or-stop wall at the first screen is a churn point, the founder called the turn-rate risk explicitly. Cadence works on seeded/demo signals out of the box, so an unconnected workspace is still a working workspace; Settings keeps every connector one click away.

**Tradeoffs considered:** The reference design disables Continue at 0 connections (rejected: production connectors are OAuth-only and env-dependent; a dev or unconfigured workspace would hard-trap). Two side-by-side buttons (ghost skip + primary continue) at 0 connections (rejected: redundant actions, and "Continue · Scout starts listening" would be dishonest with nothing connected).

**Impact:** `src/components/onboarding/OnboardingFlow.tsx` (step-1 footer + sub), first-run gate design in `src/lib/onboarding-gate.ts` already errs open (only an explicit `onboarded === false` redirects; failures never trap).

### 2026-06-12, Verdict chips: the inline annotation pattern is a platform-wide design law

**Decision:** Founder ruling (mid-session, reference image of design-review annotations: `KEEP` / `CORRECT` / `ADD NEXT`): whenever content carries a judgment, Cadence leads with an inline **verdict chip**, a mono-caps outline pill in the role color, instead of burying the verdict in prose. Codified as a standing section in root `DESIGN.md` ("Inline verdict chips: annotate, don't bury"), canonical primitive `VerdictChip` in `src/components/cadence/Primitives.tsx`. Applies to every current and future screen.

**Why:** The founder wants the platform to feel prominent, premium, and edited, information highlighted, judgments legible at a glance, for the end consumer. A chip vocabulary (moss keep · ember correct · indigo next · orchid agent · saffron highlight · madder kill) extends the existing color-role law from live status to rendered judgments without inventing new colors.

**Tradeoffs considered:** Reusing StatusBadge (rejected: dot+pulse means LIVE state; conflating judgment with state would erode the trust mechanism). Applying chips everywhere immediately (rejected: the no-filler rule holds; chips only render real, data-backed verdicts; remaining surfaces adopt on touch: evals, drift, rescore deltas, brief callouts).

**Impact:** `DESIGN.md` (new section + production-mapping row; sync-back to the design project flagged), `Primitives.tsx` (`VerdictChip`), `CriticBadge` (ship/revise/kill), `OutcomeCard` (validated/mixed/missed). Commit `0cd80cabe3`.

### 2026-06-12, Every chat reply gets a judge score; meta is persisted (screen 3 hand-in-hand builds)

**Decision:** While porting Ember screen 3 (Brain/Chat), the AI-footer contract ("judge score · model · latency · tokens · cost · feedback · view-trace · replay-with", DESIGN.md non-negotiable) was made real rather than painted: (1) a post-completion LLM-as-judge call (surface `judge`, fast model, 8s cap, failure-tolerant) scores every chat reply 0 to 100 and rides the existing SSE meta event; (2) "Replay with…" re-asks the preceding question with the chosen model in-thread, with truthful copy ("the reply lands in this thread"; the prototype's "diff lands in thread" promised a diff that doesn't exist); (3) migration `20260612120000` adds `messages.metadata` so footers/citations survive reloads, a pre-migration-tolerant insert keeps the app working until it applies.

**Why:** Founder rule 2 of the migration methodology, never drop a design element because functionality is missing; build the functionality. The judge pill and replay menu were mock-data-only in the prototype.

**Tradeoffs considered:** Omitting the judge pill until a full evals integration (rejected: the contract is non-negotiable and a tolerant cheap-model call suffices); judging inline before the reply streams (rejected: user-visible latency; post-completion only delays the footer); persisting meta in a side table (rejected: one nullable jsonb column on `messages` is the minimal honest shape).

**Impact:** `src/routes/api/chat.ts`, `src/components/chat/MessageMeta.tsx`, migration `20260612120000` (NOT yet applied: supabase MCP read-only/unauthorized this session; applies via the usual sync path). Commit `cc34fee8c2`.

### 2026-06-12, The chat surface is the Brain: company-brain positioning, retention makes it real

**Decision:** The conversational surface (just rebuilt as Perplexity-grade "Research", F-RESEARCH) is renamed and positioned as **Brain**, the company/product brain that captures everything inward (signals, meetings, decisions, specs, learnings, missions) and outward (web research findings), cited and compounding. Founder-ratified alongside the build call: ship the **retention slice** immediately (F-BRAIN), auto-retain research answers + sources into indexed memory so future questions recall past findings; "Remember this" / "Capture as decision" actions on any message; a "what the brain knows" status. Tagline: "Everything inward and outward, captured, cited, compounding."

**Why:** Founder instinct, validated by YC naming knowledge/company brains a key AI area, and it is not a pivot: "Memory compounds" is platform law #6 and "Compounding Product Memory" is moat pillar #4 in the v4 canon; the constitution lists persistent organisational memory as a durable advantage. The honest gap was that the surface had a Perplexity-grade mouth but no hippocampus: findings were discarded after each answer. Retention converts the name into the asset.

**Tradeoffs considered:** Keeping "Research" (activity-framing; Perplexity owns it), rejected for the stronger asset-framing category claim. "Company Brain" (two words, heavier rail), rejected for the rail; available as enterprise positioning language. IA confusion with the Knowledge surface, resolved: the Brain is the intelligence you talk to; Knowledge is where its contents live.

**Impact:** F-BRAIN build (rename + retention + actions + status); `docs/features/brain.md` retitled to Brain; README/demo positioning line available. Embeddings dependency: retention indexes via the Lovable embed API (cloud), locally findings save unindexed/skip gracefully.


### 2026-06-12, Connectors are OAuth-only for end users: one Connect button, no API-key paste

**Decision:** Every user-facing connector is a single **Connect** button → provider OAuth (redirect/popup) → permissions granted → done. The API-key paste path is removed from the UI entirely; storing user-pasted provider keys is rejected. Disabled connectors must show an explanatory "Admin setup required" state naming the missing setup, never a mute disabled button. Mechanism: the Lovable connector gateway's app-user OAuth (the live calendar precedent: tokens stay in the gateway, we store only a connection handle), generalized to Linear/Notion/Google Docs/Figma/Jira; GitHub keeps its GitHub App flow. Firecrawl is removed from the user-facing connector list (platform infrastructure, not a user connector). The AES vault remains for internal/infra use only.

**Why:** Founder ruling, "build the platform for an end user, not just for the demo"; asking users for API keys and keeping them in our database is wrong on both UX and security. Reference bar: Lovable's own integration UX.

**Tradeoffs considered (and the honest constraint):** Every OAuth Connect button requires a **one-time per-provider OAuth app registration by the founder** (that is where the permissions are declared), there is no registration-free OAuth. The gateway removes token custody/refresh burden, not app registration. Per-provider client-ID checklist added to `active-task.md` (`*_APP_USER_CONNECTOR_CLIENT_ID` pattern; Google client covers Calendar + Docs).

**Impact:** `registry.ts` (oauth_gateway primary everywhere, firecrawl de-listed from UI), `connections.functions.ts` (`startGatewayConnect`/`saveGatewayConnection` generalized from the calendar flow; `connectWithApiKey` removed), `ApiKeyConnectDialog` deleted, ProviderCard setup-pending copy. Saved as standing memory rule for all future connector work.

### 2026-06-12, Connector Platform adopted (F-CONN): connect once at account level, bind resources per workspace

**Decision:** Build the integration base the platform was missing: (1) **`connections`**, account-level, user-owned, self-serve connect/disconnect/status in the UI, zero env vars for end users; (2) **`connection_bindings`**, workspace-level resource mapping (which repo/team/database this workspace acts on); (3) **`resolveProviderAuth`**, one credential chokepoint for every external call (workspace binding → user connection → env fallback flagged deprecated → actionable error). Founder-ratified specifics: **GitHub connects via a GitHub App from day one** (installation flow; actions run as the app, not a member; founder registers the app: checklist in `active-task.md`); **secrets vault = app-layer AES-256-GCM** (ciphertext-only `connection_secrets`, service-role-only, `CONNECTOR_SECRETS_KEY`), correcting the docs' pgsodium claim (deprecated; `user_api_keys` was in fact plaintext); **multi-member workspaces share bindings with attribution** until org-owned connections at multi-seat. Full plan: `~/.claude/plans` F-CONN (Phase 1 GitHub exemplar + call-site migration; Phase 2 Linear/Notion/GDocs/Firecrawl + GitHub webhook; Phase 3 calendar fold-in + org entity).

**Why:** Founder directive, enterprises sit on existing stacks; Cadence must ingest/outflow through their tools without replacing them day one, and every connection must be end-user self-serve ("couple of clicks"), not deploy-time secrets. Current state was broken pieces: GitHub/Linear/Notion on env vars, four inconsistent connection tables, no workspace mapping. Also corrected en route: `nango/` was already removed 2026-05-30, CLAUDE.md's vendored-nango claim was stale (fixed in this unit).

**Tradeoffs considered:** PAT-paste-first for GitHub (faster, no app registration), rejected by founder for day-one OAuth polish; Nango as backbone, already rejected 2026-05-30 (separate-service overhead; Lovable gateway + per-provider adapters cover the wedge); Supabase Vault for secrets, rejected (unverified on Lovable-managed Supabase).

**Impact:** New `src/lib/connectors/` namespace (registry, adapters, crypto, resolve chain), `connections.functions.ts`, Settings "Connected accounts" + `/sync` "Workspace bindings" UI, migration (3 tables + `user_api_keys` cipher columns), 9 GitHub call sites migrated (3 server fns, outcome-tick cron, 4 agent tools, callback route). Env fallback preserved so the demo never breaks. Built via 4-agent parallel workflow.

### 2026-06-12, No Slack app: the universal webhook door is the ingest strategy

**Decision:** Retire `F-V5-SLACK` (native Slack OAuth connector). The ingest strategy at the wedge stage is the universal webhook door (`F-V5-INGEST-WEBHOOK`, shipped 2026-06-12): per-workspace token + public `POST /api/public/ingest-signals`; any source that can POST, Slack's own webhook/workflow tools, Zapier, forms, scripts, feeds signals directly into the `signal.created` → Scout auto-pipeline.

**Why:** Founder ruling, building and maintaining a per-vendor OAuth app adds integration overhead with no wedge value when one door covers every source; matches the constitution's build-vs-integrate rule (integration is a bridge, not a dependency).

**Tradeoffs considered:** Native Slack connector gives channel-picking UX + permalink metadata, deferred to expansion (M2+, if customer demand proves it). Webhook door risks logged as KI-10 (rate cap, token hashing) for post-demo hardening.

**Impact:** Backlog board + `active-task.md` + v5 doc Phase C row updated; the Slack-credentials ops task removed. Remaining v5 queue: `F-V5-DEMO` only.

### 2026-06-11, Database stays Lovable-operated until a deliberate migration off

**Decision:** Lovable Cloud remains the sole operator of the Supabase database. Migrations reach production only by Lovable syncing `supabase/migrations/` from GitHub, no direct dashboard applies, no read-write Supabase access from agents; the project-level Supabase MCP stays `--read-only` (`.mcp.json` unchanged). Direct DB administration is deferred until the application is fully built and the founder decides to migrate off Lovable, at which point the accumulated migration files are the portable record.

**Why:** Founder call, evaluate Lovable's capabilities end-to-end first; keep exactly one writer of production state while the same DB serves the hosted demo; avoid platform surgery days before the June 22 demo.

**Tradeoffs considered:** Direct dashboard apply (faster, but creates a second apply path Lovable doesn't know about); flipping the MCP to read-write (lets agents apply reviewed migrations, but weakens a deliberate guard). Both rejected for now; revisit at migration-off time.

**Impact:** KI-08 re-pointed: `F-V5-LOOP-CLOSE` features stay inert until Lovable syncs + applies `20260611161500_f_v5_loop_close_learnings.sql` (made idempotent so any double-apply is harmless). Verification probe: REST `GET /rest/v1/learnings` stops returning PGRST205.

### 2026-06-11, v5 adopted: the PM Chief of Staff wedge (identity · mothball-hard cut · Slack door)

**Decision:** Founder ratified three calls that define the felt product through June 22 and beyond: (1) **Identity = PM Chief of Staff**, Cadence's felt product is the senior PM's daily evidence-to-decision ritual (the Calls queue), not the org-cockpit; the cockpit remains the expansion story. (2) **Cut = mothball hard**, nav collapses to Today · Product · Knowledge · Chat + a Trust drawer; Govern becomes a drawer-accessed Engine Room page; `/build`, `/learn`, agents-config hidden behind redirects (code intact, reversal ≈ 1 day); UI vocabulary = 5 agents (Scout, Strategist, Critic, Scribe, Chief of Staff). (3) **Ingest door = Slack connector** (email-forward/webhook as day-6 fallback). Full thesis + gap analysis + phases A to E (`F-V5-RITUAL`, `F-V5-MOTHBALL`, `F-V5-SLACK`, `F-V5-LOOP-CLOSE`, `F-V5-DEMO`): [`v5-chief-of-staff-2026-06-11.md`](./v5-chief-of-staff-2026-06-11.md). **v4 is not superseded**, it remains the expansion map; v5 governs the wedge/felt product.

**Why:** Founder verdict post-F-IA-V4: still "overwhelming, disconnected, does not play the vital role." Three-agent audit confirmed: the engine (signals → Critic → cited PRD → decision) is real and load-bearing, but ~50 to 70 destinations serve a 19-agent org-OS story the code doesn't deliver; the vital daily ritual, the continuous ingest door, and the loop-closure primitive are the actual gaps. The fix is focus + completion, not rebuild.

**Tradeoffs considered:** Keeping the cockpit as the felt product and only polishing M1, rejected: it re-exposes the engine-room anatomy the stress test already condemned. Narrowing harder to a pure evidence→spec tool, rejected: discards working mission/governance differentiation and lands on ChatPRD's turf. Deleting mothballed code, rejected: burns rebuild days, hard to reverse, v4 expansion needs it.

**Impact:** New `docs/strategy/v5-chief-of-staff-2026-06-11.md`; strategy README index re-scoped (v5 = wedge, v4 = expansion); `plan.md` §1 banner + §4 entry; `README.md` wedge line; `feature-backlog.md` Live status board (F-V5 phases minted, Now building = `F-V5-RITUAL`); `active-task.md` (Phase A checklist + Slack-app ops task); `Ai_Cofounder.md` concordance note; `CLAUDE.md`/`GEMINI.md` read-order 1.5; `.lovable-config.txt`. Deferred items logged in v5 §"Explicitly deferred".

### 2026-06-11, Constitution↔v4 reconciliation ruled: June 22 = M1 at production quality; PM wedge = smallest viable category

**Decision:** The four conflicts flagged at constitution adoption (entry below) are ruled as follows. (1) The constitution's **June 22, 2026 "production-quality MVP"** target is formally read as **the M1 Golden Path at production quality, demo-ready**, acceptance = the M1 proof bar (v4 feature map §9) running end-to-end on the demo accounts, with the storyline; M2 to M5 remain milestone-sequenced with no dates. (2) The constitution's **"smallest viable category" = the PM wedge running the Golden Path**; the Enterprise Product Cockpit is the destination, not the demo, consistent with the PLG-wedge → enterprise GTM ruling. This same reading closes the north-star framing conflict: the PM workspace is the entry experience, the cockpit is the expansion. (3) **Agent-roster reconciliation deferred post-June-22**, `plan.md` §6's shipped "6 durable + ephemeral" model stays reality, the v4 19-agent mesh stays the strategic map, and the constitution's ~15 PM-domain agents absorb as station agents / ephemeral specialists when the docs are reconciled. (4) **KNOWN_ISSUES gap closed**, [`../planning/known-issues.md`](../planning/known-issues.md) created earlier this session. Standing rule unchanged: the v4 canon governs scope; the constitution governs posture and principles.

**Why:** Re-litigating positioning 11 days before the target date burns build time with no new information; the conflicts dissolve once entry-wedge and destination are distinguished. This converts four open questions into focus discipline: no M2+ scope until the M1 proof bar passes.

**Tradeoffs considered:** Treating June 22 as full-scope production quality, rejected as not credible (M2 to M5 are explicitly sequenced after M1; KI-01 calendar OAuth and KI-02 FND-RUNTIME kill-test remain open). Re-opening the category choice, rejected; the 2026-06-11 v4 decision already settled it with founder verdict.

**Impact:** `Ai_Cofounder.md` concordance "Open conflicts" section updated to record the ruling. Next 11 days = M1 demo-readiness QA: walk the Golden Path end-to-end on demo accounts and fix what stumbles; KI-01 and KI-02 are the known landmines on that path.

### 2026-06-11, Ai_Cofounder.md adopted as founding constitution; mapped onto existing canon, not duplicated

**Decision:** Adopt the founder-authored [`Ai_Cofounder.md`](../../Ai_Cofounder.md) as the repo's **founding constitution** (co-founder posture, north star, agentic-first + model-agnostic/BYOK mandates, documentation-first development). Its 13 mandated root-level living documents are satisfied by **concordance, not creation**: a Repo Concordance section inside the constitution maps each mandated doc to its live equivalent (PRODUCT.md → v4 feature map; CHANGELOG.md → plan.md §4; DECISIONS.md → this file + `docs/decisions/`; BACKLOG.md → feature-backlog.md; SESSION.md/TASKS.md → active-task.md + v4 handoff doc; the AGENTS.md name collision documented: the repo's AGENTS.md stays the dev-tool operating manual, product agents live in the v4 mesh). Precedence declared: the constitution governs **posture and principles**; [`v4-feature-map-2026-06-11.md`](./v4-feature-map-2026-06-11.md) remains the strategic source of truth for **scope, agent mesh, IA, and sequencing**. Interlinked from CLAUDE.md + GEMINI.md (read-order 0.5), AGENTS.md header, README.md, ENTRY.md, and the Lovable Knowledge field.

**Why:** The constitution arrived untracked and unreferenced, invisible to Lovable/Antigravity/Gemini and orphaned in the doc graph. Creating its 13 root docs verbatim would have duplicated plan.md, feature-backlog.md, this file, active-task.md, and the architecture/ contracts, violating both the repo's closed-doc-loop anti-duplication rule and the constitution's own "no duplicate knowledge, no orphan documents" principle. Root `TASKS.md` also proved to be a stale redirect into the retired `project-Cadence-v3` repo, following the constitution's session protocol literally would have routed tools out of this codebase (now fixed).

**Tradeoffs considered:** (a) Creating all 13 mandated files as thin root redirects, rejected: root stubs in this repo historically rot into stale v3 pointers (TASKS.md, commits.md, skills.md all did). (b) Moving the constitution into `docs/strategy/`, rejected: it is a cross-tool system-role document like AGENTS.md, not a versioned positioning file; root placement matches its function. (c) Silently editing the constitution's substance to match v4 positioning, rejected: founder-authored mandates deserve explicit ruling, not silent rewrites.

**Open conflicts for founder ruling:** (1) **North star:** "default workspace where product work happens" (PM-first, constitution) vs "B2B Enterprise Product Cockpit, agents execute, humans govern" (v4 canon); the constitution's extensibility caveat partially covers this, but its "smallest viable category" rule tensions with full-lifecycle org scope. (2) **Agent roster:** the constitution's ~15 PM-domain agents vs the v4 19-agent mesh vs plan.md §6's shipped "6 durable + ephemeral" model. (3) **June 22, 2026 production-quality MVP date** vs the no-dates M1 to M5 doctrine, working interpretation until ruled: June 22 = M1 Golden Path at production quality (11 days out; M2 to M5 not plausibly closable in that window). (4) **KNOWN_ISSUES.md** has no true equivalent, considerations.md is a gap register, not a live bug tracker; decide whether to create one.

**Impact:** Edited: `Ai_Cofounder.md` (Repo Concordance added; original content untouched), `CLAUDE.md` + `GEMINI.md` (read-order 0.5), `AGENTS.md` (Rule-of-the-repo header), `README.md` (orientation + Documentation map), `ENTRY.md` (entry-point table + repo tree), `.lovable-config.txt` (Sections 2 + 7: **re-paste into Lovable Settings → Knowledge required**), `TASKS.md` (redirect retargeted to `docs/planning/strategic-tasks.md`), `plan.md` §4 (build-log entry), plus a sweep of **17 more stale v3 redirect stubs** retargeted to live in-repo paths (root `commits.md`/`skills.md`/`memory.md`/`hooks.md`/`subagents.md`/`tools.md`, `docs/agent-ecosystem-plan.md`, and 11 stubs under `docs/`), zero `project-Cadence-v3` file links remain.

### 2026-06-11, v4 strategic rebuild: feature map becomes source of truth; PLG wedge; naming deferred

**Decision:** (1) Adopt [`v4-feature-map-2026-06-11.md`](./v4-feature-map-2026-06-11.md) as the strategic source of truth for scope, agent mesh, IA, and sequencing, superseding v3 positioning for those concerns (personas + closed-loop metaphor remain valid from v3). (2) GTM = **PLG wedge → enterprise**: land with the individual senior PM self-serve; enterprise governance architected from day 1 but sold at M4; founder weighting = pain-point/end-user first, investor framing secondary. (3) **Naming deferred to the final pre-launch activity**; founder rejected Sittella/Tanager/Perihelion/Libration and Rigel/Argon/Osprey; "Cadence" stays interim; fresh directions in [`../decisions/naming.md`](../decisions/naming.md). (4) **Frontier-absorption is a standing design rule**: every station declares native agents, pluggable external-agent slots (MCP/A2A), and the path by which a frontier "PM model" upgrades rather than threatens the platform. (5) No V1/V2 gating, full scope, milestones M1 to M5, each independently demo-able; M1 = the Golden Path demo spine starting `F-IA-V4`.

**Why:** Founder verdict on the current build: substrate strong but "overwhelming, not demo-ready, no storyline." The stress test ([`v4-stress-test-2026-06-11.md`](./v4-stress-test-2026-06-11.md)) confirmed: engine anatomy exposed as 34 nav routes, no golden path, the differentiating right half of the loop is scaffolding, agents configured rather than embodied. Market research ([`../references/competitive-landscape-2026-06-11.md`](../references/competitive-landscape-2026-06-11.md)) confirmed the end-to-end agent-run PM lifecycle is whitespace (June 2026) while both ends commoditize; the window is open but closing (Atlassian×Cycle, Lucid×airfocus).

**Tradeoffs considered:** Enterprise-first GTM rejected for now, slower proof cycle, solo-founder sales mismatch; PLG matches the Lovable/Cursor/Linear precedent. Renaming now rejected, founder unhappy with all candidates; blocking docs on a name stalls everything. Keeping the 8-Pillar framing rejected, pillars described tool analogies ("X for PMs"), not the loop; six stations tell one story.

**Impact:** New: v4 feature map, v4 stress test, [`../references/competitive-landscape-2026-06-11.md`](../references/competitive-landscape-2026-06-11.md), [`../planning/archive/v4-rebuild-handoff-2026-06-11.md`](../planning/archive/v4-rebuild-handoff-2026-06-11.md) (session resume tracker). Edited: `README.md` (stations replace pillars; GTM posture), `plan.md` (§1 banner, §3 → M1 to M5, §4 log), `design.md` (7-surface IA contract), `CLAUDE.md`/`GEMINI.md` (read-order 1.5 → v4), `active-task.md`, `docs/decisions/naming.md`, `docs/planning/feature-backlog.md` (v4 overlay + board), `docs/README.md`, `.lovable-config.txt`.

### 2026-06-06, Approve A→C→B sequence; ship Phase C v3 audit triage

**Decision:** Operator approved the recommended sequence, (A) verify FND-RUNTIME 0.9 substrate + leave the forced-restart playbook operator-runnable, (C) graduate every v3 audit recommendation into addressable backlog F-IDs, then (B) build `F-OUTCOME-SURFACE` (the 5 right-half loop surfaces + `/outcome`, which collapses Proof Platform v1.1 bundles 10 to 12 + REC-07 + LANG-NEW-OUTCOME into one F-ID). Phase A confirmed substrate-complete (no code needed); Phase C shipped this turn, 22 F-IDs minted (8 P0 / 11 P1 / 3 P2), 2 already closed (LANG-07 popups, LANG-10 voice guide). Also opened `F-SEC-REALTIME-RLS` for the deferred realtime-topic finding (operator earlier picked "ignore for now, track as backlog") and marked the scanner finding ignored with that F-ID. Phase B is next-up.

**Why:** Phase 1 (foundation) is still partial, the audit prose alone wasn't actionable, so other tools couldn't pick up parallel work. Triage was the highest-leverage unblock (~30 min of decision work); A was cheaper-than-it-looked because the substrate has been built for weeks; B carries the product narrative.

**Tradeoffs considered:** D (Phase 2 finishing) was lower leverage than A because phase 1 isn't closed. Splitting C across multiple owners was rejected for this pass, the audits are coherent and a single triage avoids contradictions. Reopening Cadence the product name was held (audit §10 Q2), and the operator-grade voice anchor was kept (audit §10 Q4) rather than benchmarked against Linear/Vercel/Paxel.

**Impact:** New addressable index at [`../planning/feature-backlog.md` § v3 Audit Triage](../planning/feature-backlog.md#v3-audit-triage-2026-06-06). Audit docs gained Triage status sections with rec→F-ID maps. `plan.md` §4 + the Live status board reflect Phase B as next-up.

### 2026-06-06, Cross-tool memory: move rules from `mem://` into git-tracked `docs/conventions/`

**Decision:** Treat tool-private memory (Lovable `mem://`, Claude Code project memory, Antigravity rules, etc.) as a _cache_, not a source of truth. Durable rules live in a new git-tracked folder, [`../conventions/`](../conventions/), and are referenced from every tool's entry point (`AGENTS.md` §3 + §5, `CLAUDE.md`, `GEMINI.md`, `.lovable-config.txt`). Tool-private memory may mirror a rule, but only as a thin pointer (≤ 2 lines) that links back to the git file.

**Why:** Earlier the same day I saved 6 memory files under `mem://…` (Lovable's private virtual filesystem). Those files are not in git, so Claude Code, Antigravity, and Gemini never see them, the rules ("no native browser chrome", "no em dashes", voice anchor, etc.) would have silently disappeared the next time any other tool picked up the repo. That directly breaks the cross-tool contract in [`../../AGENTS.md`](../../AGENTS.md) §10: "the git repo is the only shared substrate". Operator caught it.

**Tradeoffs considered:**

- **Fold rules into `AGENTS.md` §3 directly**: rejected. §3 stays scannable; the conventions folder holds the _why_ and _how to apply_ without bloating the operating manual.
- **Use `docs/rules/`**: rejected. Some entries (voice anchor, doc-closure checklist) are more guidance than hard rules; `conventions/` is the softer, more honest noun.
- **Keep `mem://` as the source and add a hook to sync to git**: rejected. Two writeable copies is the drift trap we're trying to escape; one source (git) + thin caches (memory) is simpler and audit-able.
- **Skip `mem://` entirely**: rejected. The auto-injected Core lines in `mem://index.md` are useful as a constant nudge inside Lovable sessions; they just need to point at the git rules, not duplicate them.

**Impact:** New folder `docs/conventions/` with `README.md` + 5 rule files (`ui-chrome`, `ui-voice`, `destructive-actions`, `inline-management`, `doc-closure-checklist`). `AGENTS.md` §3 gained 5 rule one-liners (9b to 9e) and §5 gained 2 matrix rows. `CLAUDE.md` and `GEMINI.md` got a read-order step 1.6 pointing at the folder. `.lovable-config.txt` got a row in SOURCE OF TRUTH HIERARCHY. `docs/README.md` got a Conventions section. `architecture/frontend.md`, `design.md`, and `docs/strategy/archive/v3-audit-language-voice-2026-06-06.md` link to the conventions as the canonical rule. The 6 `mem://` files were reduced to ≤ 3-line pointers; `mem://index.md` Memories list now explicitly says "bodies live in git". Going forward: write the rule in `docs/conventions/` first, then wire entry points, then (optionally) mirror to memory as a pointer.

### 2026-06-06, Documentation closure pass for voice / popups / inline-mgmt

**Decision:** Close the doc loop for the language-voice + popup-ban + inline-workspace-product-management work shipped earlier in the day. Doc + memory only, no product code edits. Extend the audit doc with a "How to use / verify" block, a phased rollout, and a Learnings section. Add the contract entries to `architecture/frontend.md` (Confirmation, toasts & dialogs · Inline workspace & product management), `design.md` (Voice & language), and `architecture/security.md` (owner-gated server fns). Bank durable learnings as project memory under `mem://`.

**Why:** The work shipped, but the doc loop closed only partially, the audit had no "how to verify" block, `architecture/frontend.md` had no rule on which primitive replaces a `confirm()`, and `design.md` had no voice contract. Without those entries the next session will reintroduce `window.confirm`, an em dash, or a settings-page-for-rename. Memory captures the _learnings_ (em dashes are a symptom, not the disease; native chrome is never the answer) so this is the last time we have this conversation.

**Tradeoffs considered:**

- _Roll memory into one big constraint file_: rejected. 6 narrow memories retrieve better on relevance match.
- _Add voice rules to `CLAUDE.md` / `GEMINI.md` / Lovable Knowledge_: rejected. Tool pointers stay thin; rules live in `design.md` once. The pointers already reference `design.md`.
- _Skip the architecture entries, leave them in the audit only_: rejected. Audits get archived; contracts are read every build.

**Impact:** Edited `docs/strategy/archive/v3-audit-language-voice-2026-06-06.md` (+ "How to use / verify", Phased rollout, Learnings, Related). Edited `architecture/frontend.md` (Confirmation/toasts/dialogs + Inline workspace & product management subsections). Edited `design.md` (Voice & language section with length budgets, AI-tell denylist, confirm-copy pattern). Edited `architecture/security.md` (workspace/product owner-gated server fns invariant). Edited `docs/planning/feature-backlog.md` Live status board (Last updated + Recent log). Edited `plan.md` §4 (one-liner). New memory files: `mem://constraint/no-native-browser-chrome`, `mem://constraint/no-em-en-dashes-in-ui`, `mem://preference/voice-anchor`, `mem://preference/destructive-actions`, `mem://feature/inline-workspace-product-mgmt`, `mem://preference/doc-loop-checklist`. Updated `mem://index.md` Core with two new lines.

### 2026-06-06, Commission v3 language / naming / microcopy companion audit

**Decision:** Extend the v3 product audit with a dedicated language workstream covering naming, sidebar/IA copy, page H1s, empty states, buttons, placeholders, tooltips, approval-gate prompts, agent/AI surface vocabulary, governance verbs, and marketing/public copy. Land it as a versioned companion strategy doc ([`archive/v3-audit-language-2026-06-06.md`](./archive/v3-audit-language-2026-06-06.md)), not as backlog tickets, recommendations graduate on operator sign-off.

**Why:** The main v3 audit graded the _what_ (product, UX, IA, competitive position, thesis). It surfaced that the surface had drifted from v2 positioning, most visibly on `/login` ("AI-native product operating system" contradicting v2's "autonomous" framing). The operator asked for the _words_ graded next: naming, verbosity, tooltips, descriptions end-to-end. Doing this as a separate companion (a) keeps the main audit readable, (b) gives copy/IA fixes their own triage queue separate from feature work, and (c) most of the wins are zero-engineering-risk string edits that don't deserve to wait behind feature bundles.

**Tradeoffs considered:**

- **Inline in v3 main audit**: rejected. Would have doubled the doc length and buried naming findings under feature recommendations.
- **Open backlog F-IDs directly**: rejected. Audit-then-triage matches the main v3 contract; some renames (e.g. `Mission` vs `Run`) need an operator call before they're binding.
- **Implement the safest fixes (login tagline + empty states) immediately without an audit doc**: rejected. The whole point is to fix the discipline gap (closed-doc loop breaking at the most-seen surface), not to patch one symptom; a documented voice guide + naming matrix is what stops the next drift.
- **Defer until after the IA rename actually ships**: rejected. The renames _are_ an output of this audit; you can't sequence them before doing it.

**Impact:** New [`./archive/v3-audit-language-2026-06-06.md`](./archive/v3-audit-language-2026-06-06.md). Indexed in [`./README.md`](./README.md) as a v3 companion. Recommendations (LANG-01..10, TOOLTIP-DEL, TOOLTIP-REW, LANG-IA-12, LANG-NEW-OUTCOME, LANG-CHIP) listed in [`../planning/feature-backlog.md`](../planning/feature-backlog.md) Live status board as awaiting operator triage. Headline ask: pick the P0 set (LANG-01 login rewrite, LANG-02 delete Phase/Bundle labels, LANG-06 Today/Swarm empty states, LANG-08 sentence-case H1s) for a week-1 ship, zero engineering risk, fixes the 10-second test the main v3 audit failed. No code or behavior changes in this turn.

### 2026-06-06, Commission v3 end-to-end product & platform audit

**Decision:** Run a full audit of Cadence (product, UX, AI-native posture, IA, competitive position, thesis) and land it as a versioned strategy doc rather than a list of backlog tickets. Output: [`archive/v3-audit-2026-06-06.md`](./archive/v3-audit-2026-06-06.md), supersedes nothing automatically; recommendations graduate to the backlog only on operator sign-off.

**Why:** The product surface had drifted from the v2 positioning faster than the closed-doc loop was catching (login still said "AI-native"; Today still asked the operator to refresh; `/swarm` showed 18 agents on day one). The operator asked for a brutally honest audit that also challenges the thesis. Doing it as a strategy doc (not a feature spec) preserves optionality on which recommendations to action.

**Tradeoffs considered:**

- _Skip the audit, keep shipping bundles_: rejected, the gap between thesis and surface was already costing first-run trust.
- _Audit as in-chat reply only_: rejected, the closed-doc loop requires the next tool/session to be able to read it without scrolling chat.
- _Open new backlog items per recommendation_: rejected, the operator should triage first; landing 20 raw recs into `feature-backlog.md` without triage would pollute the build queue.

**Impact:** New `docs/strategy/archive/v3-audit-2026-06-06.md` (full audit, Top-5/10/20 roadmap, investor scorecard). `docs/strategy/README.md` index extended. `docs/planning/feature-backlog.md` Live status board updated (Recent log + Last updated). No backlog items, no code changes. **Key thesis refinement proposed (not yet adopted):** "autonomous product OS" → "product-org cockpit," same substrate, sharper noun. Awaiting operator decision.

### 2026-06-06, Defer UI/UX revamp; commit to F-AGENT-1→4 agent-ecosystem bundle

**Decision:** Pause Restructure Phases 3 to 4 (Cohere editorial restyle of remaining ~18 routes) and ship the four-step **agent ecosystem bundle** instead: F-AGENT-1 Orchestrator + multi-agent missions → F-AGENT-2 persistent memory + self-reflection + trust auto-advance → F-AGENT-3 event reactor + auto-pipelines → F-AGENT-4 Swarm HUD. Canonical plan: [`../features/agent-ecosystem-plan.md`](../features/agent-ecosystem-plan.md).

**Why:** Ground-truth survey of the running system (10 missions, 17 runs, 28 checkpoints, 9 handoffs, 35 agents, 0 rows in `agent_memory`) found the substrate ~95% complete but the behavior missing, single-agent planner loops, no event reactor, no self-reflection, no swarm-level surface, no meta-agent decomposing goals. Without this bundle the "autonomous product OS" thesis is unproven in product behavior, no matter how polished the UI. Operator explicitly asked to prioritize core agent-ecosystem depth over visual restructure.

**Tradeoffs considered:**

- _Continue Restructure Phases 3 to 4 first_: rejected, visual coherence helps reviewers but does not move the thesis; the published hack-under-review survives on substance.
- _Resume Bundle 9 Slice 2 (Proof Platform v1.1)_: rejected, depends on the orchestrator being real before the Builder loop is worth deepening.
- _Ship a one-off demo-only feature for the review_: rejected, would not compose with the rest of the loop.

**Impact:** F-AGENT-1 shipped same session (orchestrator agent + `mission_steps` DAG + four planner tools + per-agent loop cap + `/missions` composer + DAG panel). F-AGENT-2/3/4 queued. `active-task.md` (root) tracks in-flight sub-steps. Status board in `docs/planning/feature-backlog.md` updated. Plan persisted in `docs/features/agent-ecosystem-plan.md` so any tool can pick it up across sessions. Restructure Phases 3 to 4 resume after the bundle closes.

---

### 2026-06-02, Reposition from "AI-native product OS" to "autonomous product OS"

**Decision:** The product is now positioned as the "autonomous product OS." The word "AI-native" is dropped. The operating model is "agents do, humans govern", not "AI assists human."

**Why:** "AI-native" is table stakes in 2026, every SaaS claims it. "Autonomous" is still differentiated. The framing shift also resolves a deeper product question: agents are the operators, not tools that assist operators. The human role is governor (sets strategy, approves at gates), not operator.

**Tradeoffs considered:** Keeping "AI-native" would have been familiar but generic. "Agent-first" was considered but "autonomous" better captures that agents execute full missions end-to-end, not just first steps.

**Impact:** README.md rewritten. AGENTS.md §0 updated. All tool configs updated. design.md framing updated. "Agents do. Humans govern." is now the core operating statement.

---

### 2026-06-02, Three equal primary personas (no hierarchy)

**Decision:** Three personas are all primary targets with equal priority. No P1 > P2 > P3 ranking. Each has its own pain point and hook.

| Persona                                    | Pain                                | Hook                                                       |
| ------------------------------------------ | ----------------------------------- | ---------------------------------------------------------- |
| Solo / Lead PM at AI-native B2B SaaS       | Mechanical work crowds out judgment | "Your agents handle the process. You handle the judgment." |
| Founder operating as the whole product org | Tool sprawl + being the glue        | "Run the product org you can't afford to hire."            |
| Technical Founder / Indie Hacker           | Everything not coding falls on them | "Your product org, running itself."                        |

**Why:** All three face the same root problem (they are the glue across a fragmented lifecycle) but with different framing needs. Serving all three from day one allows faster validation and prevents premature narrowing.

**Tradeoffs considered:** Narrowing to one persona for a tighter wedge was discussed. Rejected because the product value proposition is identical across all three, only the sales language differs.

**Impact:** README.md "Who Cadence is for" section updated with three equal sections. Persona-specific onboarding tracks added as feature W6 in `docs/planning/feature-backlog.md`.

---

### 2026-06-02, Trust arc is emergent behavior, not a scheduled timeline

**Decision:** The trust arc (Observing → Proving → Trusted → Ambient) describes how the operator-agent relationship evolves as agents earn trust through demonstrated performance. It is NOT a calendar schedule (no "Week 1, Month 1, Month 3, Month 6" prescriptions).

**Why:** Baking specific timeframes into product docs creates wrong expectations. Some operators may reach "Trusted" in days if agents perform well; others may stay in "Observing" for months by preference. The progression is driven by earned trust (Agent Trust Score) and operator choice (Autonomy Dial), not elapsed time.

**Tradeoffs considered:** Keeping the timeline as a UX guide was discussed. Rejected for product docs but the four-stage arc is kept as a UX design directive, it tells designers what states to design for, not when users reach them.

**Impact:** docs/strategy/archive/v2-positioning-2026-06-02.md §7, explicit timeline removed, replaced with emergent trust framing. design.md, trust arc added as a UX directive with design requirements for each stage (Trust Score, Autonomy Dial, Loop Health Monitor).

---

### 2026-06-02, Portability as a first-class feature, not vendor lock-in as a moat

**Decision:** Cadence's moat is compounding value (Product Memory accumulates over time), not vendor lock-in. Full data export in open formats is a first-class feature (U6), not an afterthought.

**Why:** Vendor lock-in is a bad starting USP for a new product. PMs have been burned by Jira, Confluence, and proprietary formats, positioning around portability builds trust faster. "We win by value, not friction."

**Tradeoffs considered:** Positioning lock-in as a moat (like Salesforce) was discussed. Rejected at this stage, the trust required to accept lock-in comes after demonstrated value, not before it. The real switching cost is the accumulated intelligence, not a contract.

**Impact:** README.md "Portability commitment" section added. Feature U6 (Full data portability / export) added to `docs/planning/feature-backlog.md`. docs/strategy/archive/v2-positioning-2026-06-02.md §6 documents the full reasoning.

---

### 2026-06-02, "Agents do. Humans govern." replaces all "human + AI" framing

**Decision:** All language that frames humans as active operators alongside AI is replaced. The correct frame: agents execute missions end-to-end; humans govern at approval gates.

**Retired language:** "AI assists human", "human + AI collaboration", "human in the loop", "stay in the loop", "AI helps you write specs"

**New language:** "Agents do. Humans govern." / "agents execute, human approves" / "governance gates" / "set intent, govern exceptions"

**Why:** The old framing undersells the product and confuses the target user. A PM who thinks they're getting a "smarter Notion" is not the right buyer. The right buyer wants to orchestrate agents, not work alongside them.

**Impact:** All docs updated. The operating model table in README.md reflects this. design.md component and state language updated.

---

### 2026-06-02, Skill-first mandate expanded to skills + agents + plugins + MCPs

**Decision:** The "skill-first" protocol that was previously framed as "scan skills and agents" is now explicitly four categories: skills, agents, plugins, and MCP servers. All four must be scanned before any task.

**Why:** Only scanning skills misses agents that may have specialized capabilities, plugins that extend functionality, and MCP servers that provide real-time tool access. Scanning all four ensures the best available tool is used, not just the most familiar one.

**Tradeoffs considered:** Keeping "skills first" as shorthand was considered. Rejected because the shorthand was causing agents to skip the agent, plugin, and MCP scan.

**Impact:** AGENTS.md Standing Order 1 updated. CLAUDE.md mandatory section updated. GEMINI.md updated. .lovable-config.txt Section 3 updated. load-project-memory.sh hook updated.

---

### 2026-06-02, gstack is one option, not a mandate for commits

**Decision:** commits.md previously said "gstack is required." This is changed to "use a commit skill, gstack-ship and commit-commands:commit are good defaults if available, but scan available skills first." The principle is skill-first for commits, not gstack-first.

**Why:** Mandating gstack creates vendor bias, contradicts the equal-namespace principle established elsewhere, and may not always be the best tool available. The commit discipline (message quality, no --no-verify, no force-push to main) is what matters, not which skill executes it.

**Tradeoffs considered:** Keeping gstack as default was discussed since it does handle commits well. Kept as a "good default if available" but removed as a hard requirement.

**Impact:** commits.md updated. hooks.md table updated. No behavioral change if gstack is available, it still works; it's just no longer the only valid option.

---

### 2026-06-02, Skill-generated documentation must not create duplicate folder structures

**Decision:** When skills (gstack-office-hours, gstack-document-release, etc.) generate documentation, they must not create new folders that duplicate the existing docs/ structure. The rule: check existing docs first, merge if applicable, only create new files when the content is genuinely unique.

**Why:** The gstack-office-hours skill creates a `docs/office-hours/` folder when run. This directly conflicted with the new `docs/strategy/` structure. If skills keep creating arbitrary folders, the docs/ directory becomes fragmented and the closed-loop mechanism breaks down.

**Specific example:** Running `/gstack-office-hours` would create `docs/office-hours/YYYY-MM-DD-design.md`. The correct action is: merge the content into `docs/strategy/vN-positioning-YYYY-MM-DD.md` (a new version) and reference `docs/strategy/README.md`.

**Impact:** AGENTS.md §5 updated with explicit skill-generated docs rule. CLAUDE.md, GEMINI.md, .lovable-config.txt all updated with this rule.

---

### 2026-06-02, docs/strategy/ is the versioned positioning system

**Decision:** All product positioning documents live in `docs/strategy/` as versioned files (v1, v2, v3, ...). The latest version is always the source of truth. New strategic positioning decisions create a new version file.

**Rules:**

1. Always read the LATEST version in `docs/strategy/`, check `docs/strategy/README.md` to find it
2. When a positioning or USP change is significant enough to warrant it, create a new version: `vN-positioning-YYYY-MM-DD.md`
3. Update `docs/strategy/README.md` index
4. Cascade changes to README.md, AGENTS.md §0, tool configs, and feature-backlog.md

**Why:** Point-in-time snapshots allow understanding how thinking evolved. The latest version governs current decisions. Earlier versions give context on why choices were made.

**Tradeoffs considered:** Keeping positioning in README.md only was discussed. Rejected because README is the product face, not a strategic reasoning document.

**Impact:** docs/office-hours/ folder (created by gstack skill) migrated to docs/strategy/. v1 and v2 files created. docs/strategy/README.md index created with cascade rule.

---

### 2026-06-02, HyperAgent tech stack is reference only, existing stack stays

**Decision:** HyperAgent (Airtable's open-source agent platform) was reviewed as a reference. The existing Cadence tech stack is not changed. No migration triggered.

**Facts reviewed:** HyperAgent uses React, Next.js, Radix UI, Zustand, Zod, Recharts, Motion, cmdk, @dnd-kit, @tanstack/react-virtual, lucide-react, all MIT/Apache/ISC licensed.

**Why the existing stack stays:** TanStack Start + Vite + shadcn/ui + Framer Motion + Supabase + Cloudflare Workers is already chosen deliberately. The stack overlap (Radix, cmdk, lucide, dnd-kit, Zod, Recharts) confirms correct choices. Changing the stack would break the Lovable co-development workflow and slow progress significantly.

**Coexistence constraint:** Any tech decision must preserve the Lovable + Claude Code + Antigravity + Gemini co-development model. Stack changes that break any of these are rejected.

**Potential future additions flagged:** `@tanstack/react-virtual` (virtual scrolling for signal feeds) and `fuse.js` (fuzzy search supplement), MIT-licensed, safe to add if a concrete need arises.

**Impact:** `docs/decisions/tech-stack.md` updated with HyperAgent reference note and explicit decision to keep existing stack.

---

### 2026-06-02, Six new features added from autonomous product OS positioning

**Decision:** Six features were added to `docs/planning/feature-backlog.md` derived from the autonomous product OS repositioning.

| ID  | Feature                            | Why added                                                                  |
| --- | ---------------------------------- | -------------------------------------------------------------------------- |
| C5  | Strategic Briefing surface         | Agents need context once, not per-mission. The "brief the team" mechanism. |
| C6  | Agent Trust Score + Autonomy Dial  | Makes trust arc tangible. Governance as policy, not micromanagement.       |
| E8  | Loop Health Monitor                | "Is my product org running?", single view.                                |
| N3  | Mission Compounding View           | Makes Product Memory accumulation visible and rewarding.                   |
| U6  | Full data portability / export     | Anti-lock-in commitment made concrete. Export everything in open formats.  |
| W6  | Persona-specific onboarding tracks | Three tracks for three equal personas. Time-to-value measured per track.   |

**Impact:** docs/planning/feature-backlog.md "New features" section added. All six are linked to the autonomy/trust/portability positioning decisions above.

---

### 2026-06-03, Lock a YC demo cut: 8 capability bundles, A2A as the centerpiece

**Decision:** For the Y Combinator application, ship a focused demo cut composed of 8 capability bundles built from existing backlog IDs. The product scope is unchanged; this is a scope _overlay_ that defines what must be demo-ready first. The centerpiece is bundle #4, agent-to-agent communication, structured messaging, mission handoff across stages, sub-agent spawning, and parallel sessions (E1 to E5), surfaced through a Live Mission Graph (E6).

**Sub-decisions:**

1. **Demo persona = Founder-as-PM** ("run the product org you can't afford to hire"). Strongest YC narrative; justifies the full-lifecycle ambition; the other two personas (Solo PM, Technical Founder) remain equal in the product but are not the demo script.
2. **Defer autonomous Build/Test/Ship (S4 to S6, epics I/J/K) from the demo cut.** Position as "foundation built (chokepoint, trust stack, orchestration); next milestone." A polished partial demo beats an unpolished full one, and reviewers reward focus.
3. **Demo data = real product** (mine or a design partner's), not synthetic. Real signals beat seeded signals every time for YC.
4. **Three new backlog IDs reserved:** C5 Strategic Briefing surface, C6 Agent Trust Score + Autonomy Dial, U6 Full data portability / export.

**Why:** The product backlog already contains everything needed to make the YC pitch, but if every feature is "in progress," nothing is demo-ready. The YC reviewer needs to see _one_ clean 90-second demo that proves the thesis (agents do, humans govern; agents talk to agents and finish missions end-to-end). Bundling existing IDs by demo-readiness rather than by epic forces sequencing discipline without scope creep.

**Tradeoffs considered:**

- _Keep S4 to S6 in the demo cut:_ rejected, too much surface to polish in time; any visible seam in autonomous coding hurts more than it helps.
- _Pick the Solo PM persona for safety:_ rejected, Founder-as-PM is the larger market and the stronger YC story.
- _Ship synthetic demo data for control:_ rejected, reviewers can smell synthetic data, and the Founder-as-PM frame demands a real product behind it.
- _Build a brand-new "YC demo" track separate from the backlog:_ rejected, would create exactly the kind of doc drift §5 of `AGENTS.md` forbids. Overlay instead.

**Impact:** `docs/planning/feature-backlog.md` gained a new top section "▶ YC demo cut" with the 8-bundle table, sequence, deferrals, and three new feature stubs (C5/C6/U6). Live status board "Next up" now points at the YC-cut sequence (still starting with FND-RUNTIME 0.9). `plan.md` §4 logged. `active-task.md` seeded at repo root for the immediate next sub-task (FND-RUNTIME 0.9 scoping). No code, schema, or RLS changes in this session.

---

### 2026-06-03, Reframe "YC demo cut" → "Agentic Proof Platform (v1)"; default seed = Cadence-on-Cadence

**Decision:** Replace the framing "YC demo cut" with **Agentic Proof Platform (v1)**. The 8 capability bundles, the build sequence, the deferrals, and the reserved IDs (C5, C6, U6) are unchanged. What changes: every bundle now ships against an explicit **proof bar**, the minimum end-to-end behavior on real data that makes a claim true, mapped to **four claims** that legacy PM tools (Jira, Linear, Productboard, ProductPlan, Aha) structurally cannot make:

- **C1** Agents operate, humans govern.
- **C2** Agent-to-agent handoff is first-class (no human in the routing path).
- **C3** The whole lifecycle is one governed loop.
- **C4** Trust is earned and visible (dialed, not assumed).

The YC application becomes a by-product of shipping the proof platform, not its primary driver.

**Sub-decisions:**

1. **Default real-data seed = Cadence-on-Cadence** (we run our own roadmap on Cadence). Most credible YC narrative; no dependency on a design partner; if one is signed before bundle 6, their product becomes an additional seed, not a replacement.
2. **Proof bars are the new "done" criterion** for each bundle. "Renders" or "looks demo-able" is not enough; behavior must hold end-to-end on real data.
3. **Public README still does not claim A2A** until bundle 4 hits its proof bar (≥3 hops via the orchestration layer with replayable trace).

**Why:** A 90-second demo can be polished into untruth; a proof bar cannot. Framing the work as a proof platform forces every bundle to deliver something legacy tools cannot do, which is the only honest YC narrative, and the only narrative that survives first contact with a design-partner CTO.

**Tradeoffs considered:**

- _Keep the "YC demo cut" framing:_ rejected, invites demo-driven development (Potemkin screens), which collapses on real-data evaluation.
- _Pull S4 to S6 (Build/Test/Ship) forward to widen the proof surface:_ rejected, same reason the prior decision deferred them; widening surface without depth hurts more than it helps.
- _Wait for a design partner before committing to bundle 6's seed:_ rejected, Cadence-on-Cadence removes the dependency and is the better story regardless.

**Impact:** `docs/planning/feature-backlog.md` reframed: section title `▶ YC demo cut` → `▶ Agentic Proof Platform (v1)`, added four-claims table and per-bundle proof bars, added "Real-data seeding" subsection. Live status board "Next up" + "Progress" updated to reference the proof platform. `plan.md` §4 logged. `active-task.md` unchanged (FND-RUNTIME 0.9 still next; no work in flight is invalidated). No code, schema, or RLS changes in this session.

---

### 2026-06-03, Extend Proof Platform → v1.1: full PM lifecycle on real systems via agentic orchestration

**Decision:** Extend the Agentic Proof Platform from a front-half slice (Discover → Define → Plan) to the **entire product-management lifecycle**: Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn → re-feeds Discover. The previously deferred backlog (S4 Build, S5 Test, S6 Ship, L Launch, M Support) is **un-deferred** for the proof platform, but ships as **thin agentic orchestration over existing tools**, not as new autonomous IDEs / CI / helpdesks.

**Realism rule (the constraint that keeps scope sane):** Agents orchestrate existing tools where the tool already exists; they don't replace them. Concretely:

- Build = Builder opens a **real scoped PR** on the Cadence repo via GitHub MCP (not a new IDE; not Cursor/Devin).
- Test = Builder reads **existing GitHub Actions** results (not a new test runner).
- Ship = approval-gated merge + ingest the **existing deploy webhook** (not a new pipeline).
- Launch = changelog + **one outbound channel** (Slack OR email), send-gated by approval.
- Support = **one inbound channel** (email forward or webhook) → ticket → linked to PRD/opportunity → loops back as a signal.
- Learn = Analyst attaches outcome → re-scores opportunity → next Discovery cycle reflects it.

**Sub-decisions:**

1. **Full-lifecycle by orchestration, not replacement.** The thesis is "agent-native operating _system_", agents drive the existing PM stack. Building our own IDE/CI/helpdesk would dilute the thesis and is out of scope at any depth beyond what's listed above.
2. **Builder agent writes to the Cadence repo itself** (option (a) in the plan). Requires a `GITHUB_TOKEN` runtime secret with `repo` scope, added when Bundle 9 starts (not now). Branch protection on `main` ensures no agent can bypass review; every merge is approval-gated through Cadence's own Decision Queue.
3. **One channel per stage in v1.1.** One outbound channel (Slack OR email) for Launch; one inbound channel for Support. Depth comes after the loop closes, not before.
4. **Proof bars are per-bundle and end-to-end.** Bundle 9 is not "done" until a real PR exists on the Cadence repo for a real planned task. Bundle 10 not "done" until a real merge fires a real deploy that lands in the Mission Graph. Etc.
5. **Seven new reserved IDs:** N1 (GitHub-issues sync), I-thin (Builder scoped PR), J-thin (CI read), K-thin (merge gate + deploy webhook), L-thin (changelog + one channel), M-thin (one inbound channel), Z1 (Analyst learn loop).

**Why:** A half-lifecycle demo (Discover → Plan) does not prove the product to a PM audience, a real PM walks the _whole_ loop every week. v1's demo was credible to a YC reviewer but not yet credible to a design-partner CTO. v1.1 makes the loop close on real systems, so the same artifact (signal → opportunity → PRD → PR → deploy → ticket → re-scored opportunity) is the demo _and_ the daily working surface.

**Tradeoffs considered:**

- _Build a full autonomous coding agent (compete with Cursor/Devin):_ rejected, multi-quarter scope, off-thesis (we're the OS, not the IDE), and the operator-as-judge story is stronger with scoped PRs on a real repo.
- _Keep S4 to S6 deferred and ship v1 as-is:_ rejected, user feedback explicitly: "the complete lifecycle should be covered, not half-baked." Half-lifecycle reads as half-product to a PM audience.
- _Stage launch + support across multiple channels:_ rejected, depth before the loop closes inverts the priority. One channel per stage now; multi-channel after Bundle 12 ships.
- _Use a throwaway demo repo for Builder writes:_ rejected, weakens the Cadence-on-Cadence story; branch protection makes the real-repo choice safe.

**Impact:** `docs/planning/feature-backlog.md` updated: section title `(v1)` → `(v1.1) — full product lifecycle, end-to-end on real systems`, added Realism Rule table (9 lifecycle stages), expanded bundles 8→12 (added 9 Build+Test, 10 Ship, 11 Launch, 12 Support→Learn), expanded build sequence 8→12 steps, added Demo narrative paragraph, expanded Real-data seeding to include repo-write decision, rewrote Explicitly-deferred list to reflect orchestration-not-replacement scope, added 7 new reserved-ID stubs (N1, I-thin, J-thin, K-thin, L-thin, M-thin, Z1), refreshed live status board (Next up + Progress + Recent log). `plan.md` §4 logged. `active-task.md` unchanged, FND-RUNTIME 0.9 is still next; no in-flight work invalidated. No code, schema, RLS, or secret changes in this session.

---

### 2026-06-06, Zero browser popups, full AI-tell sweep, inline workspace + product management

**Decision:** Three coordinated course-corrections, in one pass.

1. **Zero browser-native popups.** `alert`, `confirm`, `prompt`, and unload blockers are banned. Replaced by `useConfirm()` and `usePrompt()` from `src/hooks/use-confirm.tsx` (promise-based, themed shadcn `AlertDialog`/`Dialog`, focus-trapped, with `destructive` styling and `typedConfirm` typed-name guard for irreversible actions). Provider mounted once in `__root.tsx`. ESLint guardrail in `eslint.config.js` makes future regressions fail lint.
2. **The AI-tell list extends beyond em dashes.** Operator called out em dashes as the visible symptom and asked for the full sweep. Doc enumerates: em/en dashes; "not just X, it's Y" / "not only… but also"; preamble fillers ("In today's fast-paced world…"); buzzwords (seamlessly, leverage, empower, robust, powerful, next-gen, AI-native, revolutionary, unlock, unleash, delve, elevate, supercharge, game-changing, cutting-edge); LLM tics ("Let's dive in", "I hope this helps", "As an AI…"); triple-pattern listicles; over-hedging; decorative emoji; Title Case Everywhere; trailing `!`; 🚀/✨/🎉 in toasts. Voice anchor: human, clear, lightly playful, Linear-leaning with warmer empty states. Length budgets: H1 ≤ 6 words, subhead ≤ 14, button ≤ 3, tooltip ≤ 10, toast ≤ 12.
3. **Inline workspace + product management.** Operators never leave the surface they're on to administer. Workspace switcher popover in `AppShell` exposes a Manage section (Rename, Workspace settings, Leave, Delete with typed-name guard). Each product row has a `MoreHorizontal` dropdown (Set active, Rename, Delete with typed-name guard). New server fns `renameWorkspace`/`deleteWorkspace`/`leaveWorkspace`/`listWorkspaceMembers`/`removeWorkspaceMember`; `updateProject` added.

**Why:** operator feedback after the v3 audit and the first language pass: browser popups feel "hard" and off-brand, em dashes leak the machine-written origin, and forcing operators to `/settings` for every rename breaks the cockpit thesis. All three are first-impression failures the v3 audit already graded.

**Tradeoffs considered:**

- _Auto-graduate P0 LANG-VOICE-01..04 into backlog F-IDs:_ deferred to advisory; the audit doc captures them so the operator triages alongside the prior v3 recs.
- _Ship invite-by-email this turn:_ deferred to P2, needs admin lookup of `auth.users` by email via service role and a workspace settings sheet. Marked in the audit.
- _Sweep all 31 routes for em dashes this turn:_ deferred to P1, would inflate the diff and slow review. Audit lists every target route.
- _Per-action confirmation modal vs typed-name guard for destructive flows:_ picked typed-name guard for workspace/product delete (operators delete by accident; typing the name is a 2-second pause that catches the wrong-row case).

**Impact:** new `src/hooks/use-confirm.tsx`, `src/lib/workspaces.functions.ts`, `docs/strategy/archive/v3-audit-language-voice-2026-06-06.md`; edited `src/routes/__root.tsx`, `src/components/cadence/AppShell.tsx`, `src/components/cadence/DocEditor.tsx`, `src/routes/_authenticated.evals.tsx`, `src/routes/_authenticated.guardrails.tsx`, `src/routes/_authenticated.docs.tsx`, `src/lib/projects.functions.ts`, `eslint.config.js`, `docs/strategy/README.md`, `docs/planning/feature-backlog.md`, `plan.md` (§4). No schema changes. RLS unchanged (workspace owner-manage + member-read policies already covered the new server fns).

---

### 2026-06-10, Repositioning to the B2B Enterprise Cockpit & 12-Stage Lifecycle loop (the rebrand was reverted 2026-06-16)

**Decision:** Briefly rebranded the product (to a name later retired, see the 2026-06-16 reversal at the top of this log) and pivoted the strategic positioning to the **B2B Enterprise Product Cockpit**. The core platform thesis was restructured around the closed loop of product development, where customer signals flow unbroken through S1 to S12 to outcomes under human governance. **The product name is and remains Cadence.**

**Sub-decisions:**

1. **Insert Rename Disclaimer:** Added a disclaimer across all root files and pointers (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `README.md`, `.lovable-config.txt`) so co-development tools (Claude Code, Lovable, Antigravity, Gemini CLI) stayed in sync on the working name. **Reverted 2026-06-16:** the disclaimer now points all tooling back at `cadence`/`Cadence`.
2. **Preserve Existing Build:** Group and restructure existing features (discovery, spec editors, roadmaps, builder, traces, outcomes) logically under the new pillars without discarding any written code.
3. **The 12-Stage Lifecycle & 8 Cockpit Pillars:** Map all product development workflows into 12 stages run by specialized agents (Discover, Audio Sync, ICE Prioritization, Spec Draft, Issue Planning, Agentic Build, Visual QA, Safe Release, GTM Launch, Support Triage, Cohort Analytics, and Learn & Reflect) consolidated under 8 simple visual cockpit pillars.
4. **Pluggable Multi-Model Routing:** Route cognitive tasks dynamically based on model strengths (Gemini 1.5 Pro for audio and signal ingestion, Claude 3.5 Sonnet / GPT-4o for reasoning/specs, DeepSeek-Coder-V2 for code, Gemini 1.5 Flash for chat intents) with secure support for encrypted client BYO Keys.
5. **Lovable Co-Development Compatibility:** To prevent automated cloud deployment conflicts, keep Code Sandboxing and Automated Rollbacks as _logical roadmap milestones_ and _agent system prompts_ rather than local system scripts or hooks.
6. **Persona Expansion:** Align the cockpit for the entire cross-functional enterprise team, introducing specific workflows and governance gates for the VP/Director of Product, the PM (Operator), the Tech Lead (Gatekeeper), the UX Designer, the Product Marketer, and the Support Lead.

**Why:** The rebrand was driven by trademark and SEO concerns with the name. It was reverted on 2026-06-16 after the replacement proved to have its own collisions, so the product stays **Cadence** (the reversal entry at the top of this log carries the full reasoning). Pivoting to the B2B Enterprise Cockpit provides a highly defensible category (the governance/trust flight deck for swarms) while avoiding point-tool competition and ensuring Lovable co-development stays clean.

**Tradeoffs considered:**

- _Perform destructive renaming of database tables / columns:_ rejected, would break Lovable's active build paths. Map logical namespaces at the documentation and user levels instead.
- _Widen S6-S8 IDE build scope to replace Cursor/Devin:_ rejected, Cadence remains an orchestration cockpit that drives existing systems, not a replacement IDE.

**Impact:** Updated `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `ENTRY.md`, `.lovable-config.txt` with the Rename Disclaimer and Cadence branding. Created a new positioning document `v3-positioning-cadence-2026-06-10.md` as current, archiving `archive/v2-positioning-2026-06-02.md`. `plan.md` and `docs/planning/feature-backlog.md` queued for updates.

---

### 2026-06-12, F-STUDIO: the in-platform development engine, named **Studio**

**Decision:** Build the in-platform agentic development engine now (full two-door v1), named **Studio** (founder pick over Fab/Foundry/Forge). It replaces the "Send to Builder" human seam: reads the bound GitHub repo, plans, stages **multi-file** changesets, commits to isolated `studio/*` branches, opens PRs, reads CI, self-corrects, and merges behind a `review` gate, model-agnostic via the chokepoint. Spec: [`docs/features/studio.md`](../features/studio.md).

**Sub-decisions:**

1. **Two doors, both first-class.** Usage forecast ~80% agents / ~20% humans is an expectation, not a design hierarchy (founder clarification). Agent door = `dispatchStudioSession` contract + structured outcomes; human door = `/studio` (live timeline, NL steering mid-session, Monaco diffs, inline gates).
2. **Demo posture:** build now; included in the June 22 demo **only if golden-path QA passes**, supersedes the v5 mothball ruling for this surface only.
3. **Rename depth:** display + docs + new code rename to Studio; legacy internals (`agent_slug='builder'`, `builder_file_claims`, `build.functions.ts`) stay and are documented as ≡ Studio (the legacy-rename disclaimer pattern). Full DB migration rejected, demo risk 10 days out.
4. **Naming collision resolved:** internal `CallSurface 'studio'` (Prompt Studio cost bucket) is unrelated and unchanged; the engine adds no new surface literal (loop calls run under `'agent'`).
5. **Design work merged, not separate:** Studio treats UI code as code (design-token-aware prompt, PR preview links in the PR tab). A v0-style visual playground stays deferred to M3.
6. **Tick hardening (KI-02) pulled into scope**, long Studio sessions depend on checkpoint→tick→resume reliability.

**Why:** The founding intent is everything unified in-platform; with Research + Brain shipped, the build seam is the last human-shaped gap in the loop. Recon showed the runtime (chokepoint, loop, approvals, missions, A2A) plus Bundle 9 already carry half the engine, the gaps are repo reads (the agent codes blind today), multi-file commits, in-platform merge, and a human viewport.

**Tradeoffs considered:** _Fab/Foundry_ (silicon tape-out metaphor, strongest Cadence fit), founder ruled Studio for Lovable-grade approachability. _Defer until after June 22_ (the standing v5 ruling), rejected by founder, with the QA gate as the demo-risk control. _Sandboxed execution_, rejected for v1; CI is the test runner (Workers constraints).

**Impact:** new `docs/features/studio.md`, `studio_changesets`/`studio_changes` migration + Studio agent prompt, 7 new registry tools, `src/lib/studio.functions.ts`, `/studio` surface (first Monaco use), Send-to-Studio rename sweep, builder≡studio equivalence note in CLAUDE.md, tick fix, plan.md §4 entry.

---

_This log is maintained as part of the closed documentation loop. Every session that produces a strategic decision adds an entry here. Reference: `docs/strategy/README.md`. Last updated: 2026-06-12._

---

## 2026-06-12, Ember Editorial is the platform's design system; screens migrate one at a time from the runnable reference

**Decision:** Adopt the **"Ember Editorial"** design system (Project Cadence Design v1: warm parchment canvas, cacao ink, ember copper accent, Newsreader/Schibsted Grotesk/JetBrains Mono, exclusive color roles) as the production UI layer, replacing the legacy Cohere-inspired generation (white canvas, Fraunces/Inter). Source of truth: root `DESIGN.md` + `design-reference/` (the frozen runnable prototype, committed as the design of record).

**Sub-decisions:**

1. **Token-level swap first, screens second.** The shared token vocabulary (`--canvas`, `--ink`, `--coral`→ember, `--violet`→orchid, …) flips all surfaces at the chokepoint (`src/styles.css`); per-screen fidelity then lands screen-by-screen.
2. **Aurora theme retired** (founder's Rule 0: nothing mistakable for neon-gradient decoration; orchid is reserved for agent actions). Themes are Light (parchment, default) and Dark (char night); stored `aurora` preferences migrate to dark.
3. **Migration methodology (founder-specified):** one screen at a time, run the reference (`npx serve design-reference`), read its source jsx via `data-screen-label`, port layout/spacing/copy/components exactly (tokens only, translate inline styles, change no values), render side-by-side and fix differences before moving on; where the reference has no state, follow DESIGN.md and list what was invented. **No restyling from memory, no "improvements."**
4. **Reference mock data never ships:** panels whose numbers have no production source (mock product-health metrics, stakeholder pulse) are omitted under DESIGN.md's anti-filler rule and recorded in the port notes, not faked.
5. **Commit at every milestone.** A concurrent tool session wiped the first uncommitted application of this work (and stubbed two route files, since restored). Uncommitted work in this multi-tool repo is at risk by default.

**Status:** token layer + screen 1 (Home·Today) shipped (`0238a3c1fd`, `2d086f9940`); remaining screens: shell, Chat, Missions, Product, Knowledge, Govern, Settings, onboarding.

---

## 2026-06-12, Hand-sketched data marks: every data-series graph renders like pencil, platform-wide

**Decision (founder, during the screen-5 design review):** Any graph of data points, trend lines, sparklines, time-series bars, distributions, renders **hand-sketched**: a pencil-on-paper wobble, deliberately distorted, never a smooth system-generated straight/curved vector. The founder's rationale: machine telemetry should look *authentic and observed* rather than synthetic; the sketch quality is part of the platform's editorial trust language. This is an explicit **platform-wide, going-forward pattern**, any new chart on any current or future screen follows it (the founder repeated this scope in-session).

**Sub-decisions:**

1. **Canonical primitives, never parallel styles:** `src/components/cadence/Sketch.tsx`, `SketchLine` (double-pass jittered stroke + hand-set end dot) and `SketchBar` (jittered outline + diagonal hatch shading). New mark types extend this file.
2. **Deterministic jitter**, seeded from the data series itself, so charts never wobble between renders and the underlying points stay exact. The sketch is a rendering style, not data distortion; the no-filler/honesty law is untouched.
3. **Scope boundary:** data SERIES only. Single-value meters (budget burn, signal strength, eval score bars, progress rings) stay clean utility marks, a meter is an instrument, not an observation.
4. **Role colors still govern**, the sketch changes the stroke, never the color meaning.
5. Codified in `DESIGN.md` ("Hand-sketched data marks") with a production-mapping row; sync back to the design project's DESIGN.md on its next update (same path as the verdict-chip law).

**Applied immediately:** Govern · Drift metric trends (SketchLine), Govern · Analytics daily activity (SketchBar: conversion also fixed its card overflow), Missions · Agents telemetry HUD buckets (SketchBar).

**Companion ruling, the year occupancy grid ends at today:** the Knowledge calendar's year view renders January → today only, GitHub-contribution style (the latest date closes the grid; pending future months never render). Founder rationale: engagement, "the year fills in as it happens."

**Amplitude ruling (founder, same session):** the shipped tuning, "calm amplitude: clearly hand-drawn, never cartoon-loose", is approved as canonical (SketchLine wobble 1.7/1.1 double-pass, SketchBar outline 1.2 + 0.38-opacity hatch; full metric table in DESIGN.md). Do not roughen or retune without a founder ruling; new mark types reuse these numbers.

**Follow-up rulings (same review):** (1) the clamped year grid must FILL the card, fluid 1fr week columns with aspect-ratio cells, month labels anchored to their starting week, growth capped early-year (shipped `fc4779b8aa`); (2) sketch marks apply RETROACTIVELY to all existing screens, not just new work, audit confirmed the three converted charts are the only data-series graphs in production (all other bars are meters, kept clean by the scope rule).

**Status:** shipped `ecd9aebbb9` + `fc4779b8aa` (with the escaped-card-padding fix across Govern/Knowledge panels: root cause: reference `.bento`/`.band-stone` carry default padding, production's don't).

---

## 2026-06-18 · Autonomous overnight build loop adopted (operating-model decision)

**Decision (founder-directed):** the product can be built autonomously during long unattended windows (overnight), not just hand-driven. Codified as a standing, re-invokable operating model, not a one-off. Full contract: [`../operations/autonomous-build-loop.md`](../operations/autonomous-build-loop.md).

- **Modes.** Manual (daytime): founder says `pick <ID>`, options are surfaced for the founder. Autonomous (overnight): one command `/overnight-build`, the loop self-paces and takes the option-calls itself with logged rationale; it defers only founder-gated calls (taste, spend, accounts, irreversible).
- **Scope order:** v10 first, then v9, then v8, then earlier strategy docs; founder-gated items skipped and queued.
- **Per item:** plan, build, gate (`tsc --noEmit` + build + lint), adversarial review, full doc-loop, commit + push.
- **Isolation:** an isolated worktree off `origin/main`, fast-forward push to main, so it never collides with parallel sessions (proven the first night: `origin/main` advanced under it more than once and it rebased-and-retried cleanly each time).
- **Resilience:** a usage limit pauses, not stops, the run (a ~30-minute retry, auto-resume); a real build failure gets a bounded fix then skip-and-queue.
- **Continuity:** context rolls over only at clean boundaries between builds, with a written handoff first.
- **Permissions:** "accept edits on" plus a command allowlist and a destructive-command denylist in `.claude/settings.local.json` is enough to run hands-off; no "bypass" required.
- **Published-app rule:** the loop does NOT test against the live app during a run (changes are not deployed until the founder publishes); items needing live verification are recorded in the report for publish-then-verify.

**Why it matters:** it turns idle overnight hours into shipped, gate-verified, documented progress on `main`, while keeping the honesty rails (no untested claims, no founder-gated calls taken, no collisions). Status: live; first cycle shipped U6 (workspace data export). Live status: [`../planning/overnight-build-report.md`](../planning/overnight-build-report.md).
