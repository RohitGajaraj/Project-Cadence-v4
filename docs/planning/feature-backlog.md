# docs/feature-backlog.md — The granular feature backlog (build-ready)

> **SSOT first.** The single front-door tracker is [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (status, build queue, founder rulings, findings, progress). This file is the granular acceptance-criteria and scope ledger (the F-ID detail) it points to, not the tracker to follow day-to-day.

> **What this is.** The exhaustive, sub-feature-level enumeration of _everything Cadence is built to ship_ — the dev-ready expansion of [`../plan.md`](../../plan.md) §2 (granular catalog). Every feature has a **stable ID** (e.g. `F2.3`) so it can become an issue/PR/spec and be referenced by traces, decisions, and the build log without re-describing scope.
>
> **Relationship to other docs (no duplication of rules).** Product thesis + USP/MOAT: [`../README.md`](../README.md). Build _order_: [`../plan.md`](../../plan.md) §3. Cross-cutting non-functional rationale + P0/P1/P2 priorities: [`../docs/considerations.md`](./considerations.md). UI/IA/screen + AI-message contract: [`../design.md`](../../design.md). Architecture contracts: [`../architecture/`](../../architecture/). Operating rules: [`../AGENTS.md`](../../AGENTS.md).
>
> **This file adds detail; it does not replace `plan.md`.** `plan.md` stays the narrative + build order; this is the flat, addressable scope list. Keep both true (closed doc loop, [`../AGENTS.md`](../../AGENTS.md) §5).
>
> **Looking for the next task to pick up?** Jump to the [Build-order rollup](#build-order-rollup-status--build-sequence) at the bottom — it is the canonical task queue. The strategic P0–P3 view is [`../TASKS.md`](../../TASKS.md), which points back here.

---

## ▶ Live status board — the single "where are we right now?" (keep current)

> **Every tool updates this, every session, in the same unit of work as the change** — Claude Code · Antigravity · Gemini · Lovable. This is the live _cursor_; the full append-only history is [`../plan.md`](../../plan.md) §4. Update contract: [`../AGENTS.md`](../../AGENTS.md) §5. Resolution of "Next up" is mechanical — see the [Build-order rollup](#build-order-rollup-status--build-sequence).

| Field                  | Current                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔨 **Now building**    | **LIVE-APP FIX 2026-06-12:** published `/` and `/chat` crashed before auth because the browser bundle lacked public backend URL/key injection; `vite.config.ts` now loads public backend env during the Vite config phase with checked-in public fallbacks, so the next publish bundle can initialize auth. `F-V5-RITUAL` ✅ · `F-V5-MOTHBALL` ✅ · **`F-V5-LOOP-CLOSE` ✅ FOUNDER-VERIFIED e2e on the hosted app 2026-06-11**. **`F-V5-INGEST-WEBHOOK` ✅ code landed 2026-06-12** — per-workspace ingest token + public `POST /api/public/ingest-signals` + Webhook ingest card on `/sync`; reactor fan-out to Scout confirmed; lint + build green. **Gate KI-09: Lovable sync applies its migration + deploys.** `F-V5-SLACK` RETIRED (webhook door is the ingest strategy). **`F-CONN` Phase 1 + OAuth-only correction + settings/connections redesign ✅ code landed & deployed 2026-06-12 — PARKED by founder** (revisit later): everything built and proven (Playwright: rows flip live purely on client-ID env secrets); the ONLY remaining work is founder OAuth app registrations (checklist in `active-task.md`) — each secret enables its provider with zero code changes. Phase 2 (Linear/Notion/GDocs adapters on the chain, GitHub issue-close webhook) queued behind registrations. **`F-CHAT-V2` ✅ shipped 2026-06-12** (incl. the day-one 401 root-cause fix — chat requests never carried the auth header in any prior version). **`F-RESEARCH` ✅ shipped 2026-06-12** (operator doc: `docs/features/brain.md`) **`F-BRAIN` ✅ shipped 2026-06-12** — surface renamed **Brain** (founder + YC company-brain thesis; decision logged); auto-retention of research findings into memory, Remember-this/Capture-decision actions, brain status. — Perplexity-grade upgrade + surface renamed **Research**: query decomposition → parallel web searches → unified numbered citations across web AND workspace sources (deep-linked into the app), structured internal research (roadmap/opportunities/decisions/missions snapshots), research-progress stream, Perplexity-style synthesis. (founder ask 2026-06-12): assistant-grade chat — web-grounded answers (weather/news via webSearch, never raw errors), workspace RAG every turn, in-chat model switcher (gateway + BYO Claude/GPT), design.md AI-message footer (model·via·cost·latency + source chips + feedback), polished thread/composer. `F-V5-DEMO` continues after: **kill-test attempt 1 INCONCLUSIVE** — locally-started Builder run (PRD "Smart Off-Hours Routing", issue #4, `github.pr.open` approved) was NOT picked up by the hosted approvals/resume ticks within 7 min; investigate tick pickup criteria (run status vs stale-checkpoint filter) before re-running the playbook. |
| ⏭️ **Next up**         | `F-V5-DEMO` (Phase E — KI-02 forced-restart kill-test, golden-path walkthrough QA on hosted, demo script against the seeded Lumen workspace; June 22 bar). Post-demo queue: KI-10 (ingest rate cap + token hashing), PRD → engineering task graph, FND-CHOKEPOINT-STREAM. Spec: `docs/strategy/v5-chief-of-staff-2026-06-11.md`. |
| 🚧 **Blocked / stuck** | `F-CALENDAR-PERUSER` connect buttons disabled until workspace admin adds `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` + `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID` — see `active-task.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 📊 **Progress**        | **Agent ecosystem bundle:** F-AGENT-1 ✅ · F-AGENT-2 ✅ · F-AGENT-3 ✅ · F-AGENT-4 ✅. **Restructure** ◑ Phases 1–2/4 shipped, 3–4 deferred. **Bundle 9** ✅. **Step 1 FND-RUNTIME 0.9:** substrate ✅ · playbook ✅ · forced-restart proof ◑ (operator-runnable). **v3 audit triage:** ✅ shipped — 22 F-IDs minted + `F-NAV-ACCORDION` ✅ + `F-IA-MERGE-OBSERVE` ✅ + `F-IA-MERGE-GOVERN` ✅ + `F-IA-RENAMES` ✅ + `F-CHAT-NL-INTENT` ✅ + `F-COCKPIT-MERGE` ✅. **P0 voice + governance batch:** ✅ all 8 shipped. **Proof-platform v1.1 overlay:** bundles 1–6/9/10/11/12 ✅ via `F-OUTCOME-SURFACE`. **Knowledge substrate:** `F-IA-V4` ✅ (Phases 1a–1d + Phase 2 + doc closure). · `F-DECISIONS-CAPTURE` ✅. **M1 Golden Path:** Builder PR+CI ✅ · Approval gates ✅ · Scout (manual ingest) ◑ · Strategist ◑ · **Critic ✅ (DEC-02)** · **Scribe RAG citations ✅ (SCR-01)** · Slack connector ☐ · **PRD→task graph ✅ (H1)** · Release notes ☐ · Outcome card seeding ☐. **Preview:** blank-screen auth bootstrap fix ✅. **Security:** `F-SEC-REALTIME-RLS` ✅ (agent_runs + messages dropped from realtime publication); `prompt_runs_ws_write` user-id check shipped. |

**Last updated:** 2026-06-14 · Lovable — preview fixed again: TanStack middleware/start imports no longer load server-only async storage in the browser, and chat messages no longer broadcast through unrestricted realtime channels.

**Recent log** (newest first; trim to ~5 — full history lives in [`../plan.md`](../../plan.md) §4):

- `2026-06-14` — **Preview bootstrap + messages realtime security fix.** The dev preview blanked because `createMiddleware` / `createStart` re-exports pulled TanStack's server async-storage path into the browser after dependency optimization. Startup/auth middleware now use framework-compatible plain middleware objects, Vite excludes the fragile TanStack core from pre-bundling, and `/login` renders again. Security follow-up: `public.messages` was removed from realtime publication so message rows cannot be broadcast through unrestricted channel subscriptions.

- `2026-06-12` — **Preview root fix.** The dev preview blanked after restart because `/` redirects unauthenticated visitors into `/login`, while the login page was still SSR-rendered and then replaced by a browser-only auth tree during hydration. `/login`, `/signup`, `/forgot-password`, and `/reset-password` now use client-only rendering, matching the existing authenticated route boundary and preventing auth-page hydration mismatches.

- `2026-06-12` — **Live published app fix.** Browser console on `https://cadence-flow-beta.lovable.app/chat` showed the app crashing before auth with missing public backend URL/key values. `vite.config.ts` now loads those public values during config evaluation, keeps deterministic public fallbacks, and preserves the wrapper-specific config shape so protected routes can initialize, redirect, and render normally after the next publish.

- `2026-06-11` — **v5 Chief-of-Staff wedge adopted (docs).** Founder ratified: identity = PM Chief of Staff (the daily Calls-queue ritual is the felt product; cockpit = expansion), mothball-hard cut (4 surfaces + Trust drawer), Slack ingest door. Phases minted: `F-V5-RITUAL` → `F-V5-MOTHBALL` → `F-V5-SLACK` → `F-V5-LOOP-CLOSE` → `F-V5-DEMO`, sequenced to June 22. Thesis + gap analysis + verification bars: `docs/strategy/v5-chief-of-staff-2026-06-11.md`; decision entry in `docs/strategy/session-decisions.md`; Phase A checklist in `active-task.md`.

- `2026-06-11` — **`F-CRITIC-AGENT` + `F-SCRIBE-CITATIONS` shipped (M1 Golden Path middle hops).** New `critic` agent (rose-toned, role-only) seeded per existing user; new `runCritic` helper in `src/lib/discovery.functions.ts` calls Gemini 2.5 Pro with a strict-JSON red-team prompt and writes `{verdict, summary, risks, kill_criteria, missing_evidence, confidence, reviewer_model, reviewed_at}` to `opportunities.critic_review` / `prds.critic_review`. Wired into `promoteThemeToOpportunity`, `promoteSignalToOpportunity`, and `generatePrd` so the verdict lands inline before the operator sees the row. Public `runCriticReview` server fn lets the UI re-run a review. **Citations:** `generatePrd` now calls `retrieve()` from `src/lib/rag/retriever.server.ts` (top-k 8, MMR-diversified), injects the chunks as a `[n]`-numbered CONTEXT block, instructs Gemini to cite inline, and persists the chunk list to `prds.citations`. **UI:** new `src/components/governance/CriticBadge.tsx` (verdict chip with ship/revise/kill tones + side sheet with risks/kill criteria/missing evidence + re-run) rendered on `OpportunitiesPanel` rows and the PRD detail metadata row; new `src/components/product/CitationsCard.tsx` (numbered list with source-kind icons + deep links to Product · Signals, Knowledge · Docs, Knowledge · Calendar with `?meeting=`) rendered under the PRD body. Migration: `critic_review jsonb` on opportunities and prds, `citations jsonb` on prds, Critic agent seed. **WHY:** the M1 demo's hollow middle was Strategist → operator-approves and Scribe → operator-approves: both gates fired with no challenge to the AI's reasoning and no evidence trail. Critic + Citations turns them into "AI red-teams its own work and cites sources; human governs" — the M1 claim. **Files:** new migration; edited `src/lib/discovery.functions.ts`, `src/components/product/OpportunitiesPanel.tsx`, `src/routes/_authenticated.prds.$id.tsx`; new `src/components/governance/CriticBadge.tsx`, `src/components/product/CitationsCard.tsx`, `docs/features/critic-agent.md`, `docs/features/prd-rag-citations.md`; this board, `plan.md`, `architecture/runtime.md`, `architecture/orchestration.md`.

  **How to use / verify.** Find it: Critic verdicts ride along on `/product?tab=opportunities` (chip under each opportunity title) and on `/prds/$id` (chip in the metadata row, just after the issue link). Citations: scroll to the bottom of `/prds/$id` after a PRD is generated; the "Cited evidence · N" card lists numbered sources with deep links. Controls: click any Critic chip → side sheet shows summary, risks, kill criteria, missing evidence; "Re-run Critic" re-invokes the agent. The PRD body itself contains `[1]`-style markers wherever the model drew from a chunk. Server enforcement: `runCritic` is best-effort and never blocks the upstream write (failures are swallowed); RAG retrieval is workspace-scoped via `match_rag_chunks(user_id)`; both columns are read via existing PRD/opportunity RLS policies. Verification checklist: (1) promote a theme via `/product?tab=signals` → open `/product?tab=opportunities` → new row has a verdict chip within ~5s; (2) click the chip → side sheet shows risks/kill criteria/missing evidence; (3) click "Generate PRD" → on the PRD detail page the metadata row has a verdict chip and the bottom has a Citations card with at least 1 numbered source whose icon matches the source kind (signal/doc/meeting); (4) the PRD body markdown contains at least one `[n]` marker matching a citation number; (5) click "Re-run Critic" → toast confirms and the verdict refreshes.

- `2026-06-11` — **`F-DECISIONS-CAPTURE` shipped.** `/knowledge?tab=decisions` replaced its stub with a real Decisions log: source filter chips (All · Meetings · Missions · Specs · Manual), status filter, title search, list with source badge + status pill + age + "Open source" deep link, side sheet with full rationale and approve/reject/pending toggles, and a "Log decision" dialog for manual capture. Schema migration extends `public.decisions` with `mission_id`, `prd_id`, `source_kind` (check-constrained to `meeting|mission|prd|manual`), `decided_by_agent_slug`; existing rows backfilled. **Auto-capture wired (conservative scope):** `maybeCompleteMission` writes an `approved` decision per completed mission (idempotent on `mission_id`, rationale = final hop output); `savePrd` writes an `approved` decision when PRD status flips to `approved` (idempotent on `prd_id`, rationale = first 500 chars of body); `extractMeeting` already wrote — now stamped `source_kind='meeting'`. **Operator capture:** mission detail page gets a "Capture as decision" button under the goal; PRD detail page gets one in the sticky actions bar. Today page "Decisions awaiting you" got a "View all →" link to `/knowledge?tab=decisions`. Same turn closed `F-SEC-REALTIME-RLS`: dropped `public.agent_runs` from the `supabase_realtime` publication (no in-app subscriber existed; raw broadcast leaked rows across users). **WHY:** decisions were piling up inside missions, specs, and meeting extracts with no shared surface to query or audit them — the swarm needs one place to read what's been decided. **Files:** new migration; edited `src/lib/decisions.functions.ts`, `src/lib/ai/handoff.server.ts`, `src/lib/discovery.functions.ts`, `src/lib/meetings.functions.ts`, `src/routes/_authenticated.missions.$missionId.tsx`, `src/routes/_authenticated.prds.$id.tsx`, `src/routes/_authenticated.index.tsx`; rewrote `src/components/knowledge/DecisionsPanel.tsx`; this board, `plan.md`, `architecture/frontend.md`.

  **How to use / verify.** Find it: `/knowledge?tab=decisions` (Knowledge in the pinned rail → Decisions tab). Controls: source-filter chips, status-filter chips, title search, "Log decision" (manual entry with title + rationale), row click opens side sheet, inline ✓/✕ on pending rows. Server enforcement: workspace-scoped RLS (`is_workspace_member(workspace_id)`); writes set `user_id = auth.uid()`; auto-capture inserts are idempotent on the source id. Verification checklist: (1) open `/knowledge?tab=decisions` → existing meeting-sourced rows appear with violet Meeting badge and "Open source" deep-links to `/knowledge?tab=calendar&meeting=…`; (2) approve any PRD via `/prds/$id` → a sky Spec row with the PRD title appears at the top; (3) run any mission to completion → a cyan Mission row appears (no duplicates on repeated completion attempts); (4) click "Log decision" → enter title → row appears with Manual badge; (5) click any row → side sheet shows rationale + approve/reject/pending; (6) source filter and search narrow the list correctly.
- `2026-06-11` — **`F-IA-V4` Phase 2 (operator-directed) shipped.** Pinned workspace rail = **Today · Chat** only. Missions removed from the pinned rail (still reachable in the Agents group). Floating bottom-right Approvals + Calendar dock removed entirely. `/knowledge` now mounts **Calendar · Memory · Decisions · Docs** with Calendar as the default tab; `?meeting=` deep-link preserved through tab changes. `/calendar` flipped to a `beforeLoad` redirect → `/knowledge?tab=calendar` (forwards `?meeting=`). **WHY:** operator owns IA — pin only what's used every minute (Today, Chat); Approvals is one hop via Govern; Calendar belongs with the rest of what the swarm queries (memory/decisions/docs) so future agents can pull threads across the full knowledge substrate. **Files:** edited `src/components/cadence/AppShell.tsx`, `src/routes/_authenticated.knowledge.tsx`; rewrote `src/routes/_authenticated.calendar.tsx` as redirect; this board, `plan.md`, `architecture/frontend.md`.
- `2026-06-11` — **`F-IA-V4` Phase 2 navigation polish: Daily shortcuts relocated.** The Approvals + Calendar quick-access pair no longer floats in the page's top-right corner where it collided with the ambient time/weather strip and page actions like Refresh brief. It now sits as a compact **Daily** icon row in the fixed sidebar footer above budget / mission mode, preserving one-click access without visual dominance. **WHY:** daily governance and calendar access should be reliable but not compete with page headers or ambient chrome. **Files:** edited `src/components/cadence/AppShell.tsx`, `architecture/frontend.md`, this board, `plan.md`.
- `2026-06-11` — **`F-IA-V4` Phase 1d: Knowledge + Learn surfaces live.** New `/knowledge` mounts Calendar · Memory · Decisions · Docs (4 tabs; Memory + Decisions ship as stubs) and forwards `?meeting=<id>` into the Calendar tab to keep the meeting sheet deep-link working. New `/learn` mounts Outcomes · Support · Learnings (3 tabs sourced from `getOutcomeData`). Panels extracted under `src/components/{knowledge,learn}/`. `/calendar`, `/docs`, `/outcome`, `/meetings`, `/meetings/$id` flipped to redirects. Pinned workspace rail: `Calendar` slot replaced by `Knowledge` (Calendar is the default tab); `Outcome` group renamed `Learn`; standalone `Docs` entry dropped. **WHY:** Knowledge as one consolidated find-anything surface (memory + decisions + docs + calendar) matches the user's smart cross-tab AI-search goal; pinning Knowledge while making Calendar its default tab preserves daily muscle memory without re-fragmenting the IA. 7-surface collapse structurally complete. **Files:** new `src/components/knowledge/{Calendar,Memory,Decisions,Docs}Panel.tsx`, `src/components/learn/{Outcomes,Support,Learnings}Panel.tsx`, `src/routes/_authenticated.{knowledge,learn}.tsx`; rewrote `src/routes/_authenticated.{calendar,docs,outcome,meetings,meetings.$id}.tsx` as redirects; edited `src/components/cadence/{AppShell,CommandPalette}.tsx`, `active-task.md`, this board, `plan.md`.
- `2026-06-11` — **`F-IA-V4` Phase 1c: Product surface live.** New `/product` route with `validateSearch` mounts 6 tabs: Signals · Opportunities · Specs · Roadmap · Tasks · Releases. Extracted panel bodies from `/discovery`, `/opportunities`, `/prds`, `/roadmap`, `/tasks`, and the Releases slice of `/outcome` into `src/components/product/{Signals,Opportunities,Specs,Roadmap,Tasks,Releases}Panel.tsx` (no behavior change). `/discovery`, `/opportunities`, `/roadmap`, `/tasks` flipped to `beforeLoad` redirects to `/product?tab=…`. `/prds` was split: parent becomes an `<Outlet/>` layout, new `prds.index.tsx` redirects, so `/prds/$id` still renders. `/outcome` stays put — Launches/Support/Learnings move to `/learn` in Phase 1d. Sidebar: `discover` + `deliver` groups collapsed into one **Product** group with deep-link items; Builder + Docs spun off into a new **Build** group. **WHY:** the discover→deliver loop was scattered across 6 routes and 2 sidebar groups doing one job (turn signals into shipped releases); one surface with 6 tabs lets an operator walk the whole loop without leaving the page. **Files:** new `src/components/product/{Signals,Opportunities,Specs,Roadmap,Tasks,Releases}Panel.tsx`, `src/routes/_authenticated.product.tsx`, `src/routes/_authenticated.prds.index.tsx`; rewrote `src/routes/_authenticated.{discovery,opportunities,roadmap,tasks}.tsx` as redirects and `src/routes/_authenticated.prds.tsx` as an Outlet layout; edited `src/components/cadence/AppShell.tsx`, `active-task.md`, this board, `plan.md`.
- `2026-06-11` — **`F-IA-V4` Phase 1b-2: Prompts + Evals folded into Govern.** Extracted `EvalsPanel` (~617 lines) and `PromptsPanel` (~655 lines) from their inline route files into `src/components/governance/{EvalsPanel,PromptsPanel}.tsx` (no behavior change). `/govern` now mounts **9 tabs**: Controls · Approvals · Guardrails · Budgets · Prompts · Evals · Analytics · Traces · Drift, with the container widened to `max-w-[1400px]` so the prompt diff + eval split layouts breathe. `/evals` and `/prompts` flipped to `beforeLoad` redirects preserving the tab. Sidebar: Prompts moved out of the Agents group and into the Govern group; both Prompts + Evals now deep-link to `/govern?tab=…` (the existing tab-aware active-detection in `AppShell.tsx` handles the highlight correctly). **WHY:** Prompts and Evals are how operators keep the swarm safe just like Controls/Approvals/Guardrails — they belonged on the Govern surface from day one. Two more routes off the rail, zero deep-link regressions. **Files:** new `src/components/governance/EvalsPanel.tsx`, `src/components/governance/PromptsPanel.tsx`; rewrote `src/routes/_authenticated.evals.tsx`, `src/routes/_authenticated.prompts.tsx` as redirects; edited `src/routes/_authenticated.govern.tsx`, `src/components/cadence/AppShell.tsx`, `active-task.md`, this board.
- `2026-06-11` — **`F-IA-V4` Phase 1b: Govern surface live.** New `/govern` route mounts 7 tabs (Controls · Approvals · Guardrails · Budgets · Analytics · Traces · Drift) via `validateSearch`. Extracted the inline ~580-line `ControlsPanel` from `_authenticated.governance.tsx` into `src/components/governance/ControlsPanel.tsx` (same logic, no behavior change). `/governance` and `/observe` flip to `beforeLoad` redirects that preserve their old `?tab` 1:1. Thin redirects `/guardrails`, `/budgets`, `/drift`, `/traces`, `/inbox`, `/analytics` now point directly at `/govern?tab=…`. Sidebar collapses the prior `Run` + `Govern` groups into one `Govern` group (Govern · Evals · Integrations); pause-state footer banner and command palette repointed. **WHY:** the IA had two adjacent groups (`Run` + `Govern`) doing the same operator job — keeping the swarm safe — across 6 routes. One Govern surface with 7 tabs collapses that into a single stop while preserving every deep link. **Files:** new `src/components/governance/ControlsPanel.tsx`, `src/routes/_authenticated.govern.tsx`; rewrote `src/routes/_authenticated.{governance,observe,guardrails,budgets,drift,traces,inbox,analytics}.tsx` as redirects; edited `src/components/cadence/AppShell.tsx`, `src/components/cadence/CommandPalette.tsx`, `active-task.md`, this board.
- `2026-06-11` — **`F-IA-V4` Phase 1a: Missions surface promoted.** `/missions` is now the v4 IA "Missions" station with `?tab=missions|agents`, reusing extracted `MissionsPanel` + `AgentsPanel`. `/cockpit` and `/swarm` flip to `beforeLoad` redirects preserving query params. Sidebar and command palette repointed. **WHY:** first concrete slice of the 7-surface IA collapse, scoped to where panel components already exist (no risky panel extractions in this turn). **Files:** rewrote `src/routes/_authenticated.missions.index.tsx`, `src/routes/_authenticated.cockpit.tsx`, edited `src/routes/_authenticated.swarm.tsx`, `src/components/cadence/AppShell.tsx`, `src/components/cadence/CommandPalette.tsx`, `src/routes/_authenticated.agents.tsx`, `src/routes/_authenticated.missions.$missionId.tsx`, this board.
- `2026-06-11` — **v4 strategic rebuild landed (docs only).** New strategic source of truth: [`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md) — 7 platform laws, 6 stations over the 12-stage engine, 19-agent mesh with HandoffEnvelope contract + HITL gate matrix, 7-surface IA, station feature catalogs (SEN/DEC/DEF/BLD/LCH/LRN/ENG/OPS), milestones M1–M5, frontier-absorption policy. Companions: [`../strategy/v4-stress-test-2026-06-11.md`](../strategy/v4-stress-test-2026-06-11.md) (10 argued verdicts), [`../references/competitive-landscape-2026-06-11.md`](../references/competitive-landscape-2026-06-11.md) (market scan with links), [`./v4-rebuild-handoff-2026-06-11.md`](./archive/v4-rebuild-handoff-2026-06-11.md) (session resume tracker). Decisions: PLG wedge → enterprise; naming deferred (Cadence interim). **WHY:** founder verdict — strong substrate, no storyline, not demo-ready; v4 fixes scope + IA + sequencing in one stress-tested map. **Files:** 4 new docs; edited `README.md`, `plan.md`, `design.md`, `CLAUDE.md`, `GEMINI.md`, `active-task.md`, `docs/decisions/naming.md`, `docs/strategy/session-decisions.md`, `docs/README.md`, `.lovable-config.txt`, this board.
- `2026-06-11` — **`F-COCKPIT-MERGE` shipped: Unified Swarm HUD & Missions Cockpit.** Consolidated `/swarm` (live Swarm HUD) and `/missions` (Missions list) under a single tabbed flight deck `/cockpit` with internal tabs `?tab=agents|missions` and search param validation. Added TanStack Router redirects for `/swarm` and `/missions` index to keep bookmarks working. Updated sidebar navigation and command palette. Repointed deep links and references throughout the app to point to `/cockpit`. **WHY:** Calms the UI by reducing sidebar bloat and context switches, matching the observe/governance layout patterns. **Files:** new `src/routes/_authenticated.cockpit.tsx`, `src/components/cockpit/{AgentsPanel,MissionsPanel}.tsx`; edited `src/routes/_authenticated.swarm.tsx`, `src/routes/_authenticated.missions.index.tsx`, `src/routes/_authenticated.agents.tsx`, `src/routes/_authenticated.missions.$missionId.tsx`, `src/components/cadence/AppShell.tsx`, `src/components/cadence/CommandPalette.tsx`, this status board, `plan.md`.
- `2026-06-07` — **`F-CHAT-NL-INTENT` shipped: Natural Language Intent Detection & Inline Mission progress on Chat.** Chat now automatically intercepts user prompts, detects execution intent via a Gemini classification call, seeds the orchestrator, and asynchronously launches multi-agent missions. Hides agent details by rendering a clean inline progress cockpit directly in the chat window, showing live step progress, inline governance controls (Approve/Reject gates), toggles for raw trace, and links to the full mission cockpit page. Falls back gracefully to regular chat if pre-flight checks fail (e.g. no specialist agents enabled). **WHY:** allows users to control the entire swarm of specialists in natural language without managing agent handoffs, while keeping governance simple and visually calming. **Files:** edited `src/routes/api/chat.ts`, `src/routes/_authenticated.chat.tsx`, this status board, `plan.md`, `design.md`.
- `2026-06-06` — **Global ambient weather visibility fix (UX-only).** The top ambient bar no longer depends only on browser geolocation. It now tries GPS first, falls back to network-derived location, then falls back to timezone-derived city via Open-Meteo geocoding before giving up. Cache moved to `cadence.ambient.v3` and stale weatherless entries are cleared. Weather colors moved into semantic CSS utilities (`.ambient-weather--*`) so the pill stays visible and theme-aligned. Verified in preview: `/calendar` top bar now renders time + location + `20°` weather pill. **WHY:** the prior implementation hid the whole temperature/icon when GPS was blocked or timed out, so users saw only time/location and thought nothing changed. **Files:** edited `src/components/cadence/AmbientChip.tsx`, `src/styles.css`, `architecture/frontend.md`, `plan.md`, this status board.
- `2026-06-06` — **Calendar header polish (no F-ID; UX-only).** Removed the dismissible "Connect your calendar" banner — the header `<Link2>` chip with green/grey status dot is the single connect entry on `/calendar` now. Removed the duplicate Month/Year `<select>` dropdowns from the grid header (left/right + double-chevron nav already does this; "June 2026" is the title only). Added a `WeatherChip` next to the connect icon — browser geolocation → Open-Meteo (no API key, no secret), WMO weather-code → colorful Lucide icon (`Sun`/`Cloud`/`CloudRain`/`CloudSnow`/`CloudLightning`/`CloudFog`) + tonal background + reverse-geocoded city, silently hidden when geo is denied. Calendar account connect/disconnect mirrored into Settings as a new `CalendarAccountsSection` so users can manage providers from their profile (not only `/calendar`). **WHY:** the bar duplicated the icon's job and the dropdowns duplicated the chevrons; both stole vertical space the calendar itself needed. The weather chip adds the small bit of personality the empty calendar was missing without inventing a new data integration. **Files:** edited `src/routes/_authenticated.calendar.tsx` (dropped `ConnectHint` + `CONNECT_HINT_KEY`, dropped month/year selects + `yearOptions`, added `WeatherChip`); edited `src/routes/_authenticated.settings.tsx` (new `CalendarAccountsSection`); this status board.
- `2026-06-06` — **`F-CALENDAR-PERUSER` shipped (Parts B + C).** New `user_calendar_connections` table (RLS owner-only). App-user OAuth helpers added at `src/integrations/lovable/{appUserConnector,appUserConnectorClient}.ts`. New `src/lib/calendar-connections.functions.ts` (start · save · list · disconnect). `syncCalendar` and all CRUD in `src/lib/calendar.functions.ts` now dispatch on the user's connection: Google → `google_calendar` v3, Microsoft → `microsoft_outlook` Graph (`/me/calendarView`, `/me/events`); workspace connector remains as fallback. UI: connection chips strip (Google + Microsoft with × disconnect + disabled-button tooltip when credentials missing), month grid view (month/year nav · Today · up to 3 chips per day + "+N more"), event editor `Dialog` (title · start/end via `datetime-local` · notes · Save → PATCH · Delete → DELETE behind `useConfirm`). Apple dropped — no public OAuth surface. **Pending unlock:** workspace admin adds two backend secrets (`GOOGLE_APP_USER_CONNECTOR_CLIENT_ID`, `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID`); when missing, `startCalendarConnect` throws a clean "Connect setup pending" toast. **WHY:** every real operator needs their own calendar, not the developer's; in-app CRUD eliminates the context switch the platform was built to avoid. Decision doc: [`./decisions/calendar-oauth-credentials.md`](../decisions/calendar-oauth-credentials.md). Active task: `active-task.md`. **Files:** new migration; new `src/lib/calendar-connections.functions.ts`; new `src/integrations/lovable/{appUserConnector,appUserConnectorClient}.ts`; edited `src/lib/calendar.functions.ts`; rewrote `src/routes/_authenticated.calendar.tsx`; new `docs/decisions/calendar-oauth-credentials.md`; new `active-task.md`; `plan.md` §4; this status board.
- `2026-06-06` — **`F-IA-CALENDAR-MERGE` + `F-IA-BRIEFING-SETTINGS` shipped (paired pinned-rail trim).** Pinned workspace rail goes from 6 items to 4 — Today · Approvals · Calendar · Chat — by applying a new Pin test (used daily, entry point for an active workflow, not derivable from another pinned surface). Calendar absorbs Meetings: `/calendar` now has a List view (default — unified chronological feed of meetings + Google Calendar events) and a Grid view toggle (the prior day-grouped event cards); preference persists in `localStorage` (`cadence.calendar.view`). Meeting rows open a right-side `Sheet` rendering the existing transcript / extract / commit flow via a new shared component `src/components/cadence/MeetingDetailBody.tsx`. `?meeting=<id>` is a validated search param so deep-links open the sheet on load. `/meetings` and `/meetings/$id` are now `beforeLoad` redirects (`{ to: "/calendar" }` and `{ to: "/calendar", search: { meeting: id } }`). Briefing absorbed into Settings: `/briefing` is a `beforeLoad` redirect to `/settings?section=brief`; settings page adds a `validateSearch` for `section`, scrolls + ring-highlights the new "Strategic brief" inline section, which reuses `getActiveBrief`/`upsertBrief` unchanged. Command palette: "Meetings" entry repointed to Calendar; `g m` shortcut now goes to `/calendar`. Zero DB or server-fn changes. New convention added: **Pin test** in `docs/conventions/inline-management.md`. **WHY:** the pinned rail was carrying two items that didn't earn their pin — Calendar+Meetings were one mental model split in two, and Briefing was set-once workspace context posing as daily nav. Folding them returns the rail to the daily-use surfaces and matches the inline-management convention (workspace-scoped settings live next to the workspace). **Files:** new `src/components/cadence/MeetingDetailBody.tsx`; rewrote `src/routes/_authenticated.calendar.tsx` (list + grid + sheet); replaced `src/routes/_authenticated.meetings.tsx`, `src/routes/_authenticated.meetings.$id.tsx`, `src/routes/_authenticated.briefing.tsx` with redirects; edited `src/routes/_authenticated.settings.tsx` (validateSearch + WorkspaceBriefSection); edited `src/components/cadence/AppShell.tsx` (pinned rail 6 → 4, dropped `Crosshair`/`Users` imports), `src/components/cadence/CommandPalette.tsx` (Calendar entry + `g m` route); `docs/conventions/inline-management.md` (Pin test rule + Briefing-in-settings row); `docs/feature-backlog.md` (this entry · status board); `plan.md` §4 (one-line WHY); `architecture/frontend.md` (pinned rail list + Calendar sheet pattern + redirect map).
- `2026-06-06` — **`F-IA-MERGE-GOVERN` + `F-IA-RENAMES` shipped (paired).** `/governance` is now a 4-tab surface — Controls (existing kill-switch + missions + stuck approvals + reactor), Approvals (lifted from `/inbox`), Guardrails (lifted from `/guardrails`), Budgets (lifted from `/budgets`) — with `?tab=controls|approvals|guardrails|budgets` via `validateSearch`; panels live in `src/components/governance/{Approvals,Guardrails,Budgets}Panel.tsx`; old `/inbox`, `/guardrails`, `/budgets` are now `beforeLoad`-redirects to the matching tab so bookmarks survive. Sidebar workspace rail's "Approvals" deep-links to `/governance?tab=approvals`; Govern group shrinks from 4 items to 2 (Governance, Integrations). NavRow now passes `search` to `<Link>` and active-state detection is search-tab-aware so the same `/governance` path can have two correctly-highlighted entries. Label sweep: AI Chat→Chat, Build Console→Builder, Swarm HUD→Swarm, Prompt Studio→Prompts, Sync Inbox→Connectors (URLs unchanged; H1, tab title, and CommandPalette entry updated). **WHY:** Govern was 4 sidebar items pointing at one job — _running the swarm safely_. Folding them into tabs makes governance one stop, matches the `/observe` pattern, and lets the workspace-rail Approvals badge live next to Today/Briefing where the operator actually starts. The rename sweep removes the last enterprise-jargon labels per the voice anchor; URLs stayed put because redirecting working URLs has no UX upside and breaks browser history. **Files:** new `src/components/governance/{ApprovalsPanel,GuardrailsPanel,BudgetsPanel}.tsx`; rewrote `src/routes/_authenticated.governance.tsx` (tab shell + inline `ControlsPanel` from the prior body); replaced `src/routes/_authenticated.{inbox,guardrails,budgets}.tsx` with `beforeLoad` redirects; edited `src/components/cadence/AppShell.tsx` (label sweep · workspace Approvals deep-link · Govern group trim · search-tab-aware active state · dropped unused Shield/DollarSign icons); edited `src/components/cadence/CommandPalette.tsx` (Chat label); edited `src/routes/_authenticated.{build,swarm,prompts,sync}.tsx` (page titles + H1s); `docs/feature-backlog.md` (this entry + status board + 2 rows ☑); `plan.md` §4 (one-line WHY).
- `2026-06-06` — **`F-IA-MERGE-OBSERVE` shipped.** Sidebar group `aiops`/`AI Ops` renamed to `run`/`Run` with two items (Observe → `/observe`, Evals → `/evals`). New `/observe` route (`src/routes/_authenticated.observe.tsx`) wraps three tab panels lifted out of the old pages into `src/components/observe/{Analytics,Traces,Drift}Panel.tsx`; tab state lives in `?tab=analytics|traces|drift` via `validateSearch`; Traces tab shows today's trace count, Drift tab shows open-incident count. Old route files at `/analytics`, `/traces` (index only — `/traces/$traceId` deep links preserved), and `/drift` now `throw redirect()` to the matching `/observe?tab=…` so bookmarks survive. Command palette gains an Observe entry. Govern group, server fns, DB, and tokens all untouched. **WHY:** "AI Ops" was 4 items of jargon for what is really one thing — _watching agents work_. One Observe surface with loud tabs makes the question "how are agents performing?" answerable in one click; renaming the group to "Run" matches the verb pattern (Discover · Deliver · Run · Govern) and kills the last enterprise buzzword on the rail. Evals stays its own item because authoring ≠ observation. **Files:** new `src/routes/_authenticated.observe.tsx`, `src/components/observe/{AnalyticsPanel,TracesPanel,DriftPanel}.tsx`; edited `src/routes/_authenticated.{analytics,traces,drift}.tsx` (now redirects), `src/components/cadence/AppShell.tsx` (group rename + 2 items, dropped unused `TrendingUp` import), `src/components/cadence/CommandPalette.tsx` (Observe entry), `docs/feature-backlog.md` (this entry · status board · F-IA-MERGE-OBSERVE row ☑ + How to verify), `plan.md` §4 (one-line WHY), `architecture/frontend.md` (Observe tabs pattern + redirects).
- `2026-06-06` — **P0 voice + governance batch shipped (8 F-IDs).** `F-VOICE-LOGIN`: `/login` subhead now "Your product org, run by a swarm of agents." `F-VOICE-AINATIVE`: scrubbed "AI-native" from operator surfaces (login subhead, briefing placeholder, chat system prompt). `F-VOICE-VERSIONS`: stripped `Phase N`/`Bundle N` kickers from `/build`, `/discovery`, `/opportunities`, `/prds`, `/roadmap`, `/meetings`, `/integrations`. `F-VOICE-EMPTY-TODAY`: rewrote Today empty state (drop "hit refresh") + Swarm empty state (drop "humming"). `F-VOICE-CASE`: dropped `neural-text` serif gradients on `/calendar` (Upcoming meetings) and `/tasks` (All tasks); removed Workstream kicker on `/tasks`. `F-GOV-APPROVAL-COPY`: inbox + governance approval rows now lead with consequence ("Approve · run X" / "Reject · nothing runs"); tooltips spell out the rollback. `F-TODAY-AUTOSEED`: extracted `ensureTodayBrief(supabase, userId)` helper in `src/lib/copilot.functions.ts`; `getDashboard` now auto-generates the brief on first sign-in instead of asking the operator to seed it; Refresh still forces a regen. `F-AGENTS-ROSTER-CUT`: migration cuts `seed_default_agents` from 9 → 4 (Discovery Scout, Strategist, PRD Writer, Builder); Orchestrator is the 5th, seeded separately; all other historically-seeded agents are `enabled = false` for existing users (kept for audit). **Security:** same migration tightens `prompt_runs_ws_write` WITH CHECK to require `user_id = auth.uid()` (Lovable scanner finding `prompt_runs_unauthorized_write` → fixed). **WHY:** the v3 audit landed 8 quick voice/governance wins that every existing surface needed before we layer on more routes; doing them in one batch makes the product speak the v3 thesis end-to-end with zero new routes. **Files:** new migration `<ts>_roster_cut_and_prompt_runs_rls.sql`; edited `src/routes/login.tsx`, `src/routes/_authenticated.briefing.tsx`, `src/routes/api/chat.ts`, `src/routes/_authenticated.build.tsx`, `src/routes/_authenticated.discovery.tsx`, `src/routes/_authenticated.opportunities.tsx`, `src/routes/_authenticated.prds.tsx`, `src/routes/_authenticated.roadmap.tsx`, `src/routes/_authenticated.meetings.tsx`, `src/routes/_authenticated.integrations.tsx`, `src/routes/_authenticated.index.tsx`, `src/routes/_authenticated.swarm.tsx`, `src/routes/_authenticated.calendar.tsx`, `src/routes/_authenticated.tasks.tsx`, `src/routes/_authenticated.inbox.tsx`, `src/routes/_authenticated.governance.tsx`, `src/lib/copilot.functions.ts`, `src/lib/dashboard.functions.ts`, `docs/feature-backlog.md` (this entry · status board · 8 F-ID rows flipped ☑), `plan.md` §4 (one-line WHY).
- `2026-06-06` — **Phase B shipped: `F-OUTCOME-SURFACE`** (`/outcome` with Releases · Launches · Support · Learnings tabs). Read-only roll-up via `getOutcomeData` in `src/lib/outcome.functions.ts` — completed missions + completed agent runs (Releases), approvals on outbound tools `send_slack`/`send_email`/`publish_changelog`/`post_announcement`/`notify_channel` (Launches), signals from `support`/`ticket`/`helpdesk`/`email`/`zendesk`/`intercom`/`freshdesk` (Support), opportunities re-scored after creation (Learnings). All tables RLS-scoped via `requireSupabaseAuth`; no new agent logic; no `runtime.server.ts` bypass; no mocks. Empty states name the loop step + why it lights up. Sidebar got a new **Outcome** group. **WHY:** the right half of the lifecycle (the loop closer Cadence is sold on) had no surface — operators couldn't _see_ the loop they were promised. Now there's one URL that proves the loop exists, even when empty. **Files:** new `src/lib/outcome.functions.ts`, `src/routes/_authenticated.outcome.tsx`; edited `src/components/cadence/AppShell.tsx` (Outcome nav group), `docs/feature-backlog.md` (this entry · status board · F-OUTCOME-SURFACE row · How-to-verify block), `plan.md` §4 (one-line WHY).
- `2026-06-06` — **v3 audit triage shipped (Phase C of A→C→B sequence).** Operator approved the A→C→B plan; this turn closed C. Phase A confirmed substrate-complete (checkpoints + `resumeAgentLoop` + `withIdempotency` + `resume-runs` sweeper all wired; playbook at [`./fnd-runtime-restart-playbook.md`](../operations/fnd-runtime-restart-playbook.md) is operator-runnable in 5 min — flip 0.9 to ✅ requires an operator run that can't happen from inside the dev sandbox). Phase C minted **22 F-IDs** from the two v3 audits across P0/P1/P2 (see new [§ v3 Audit Triage](#v3-audit-triage-2026-06-06)): 8 P0 voice/governance copy + 11 P1 IA/cockpit/surfaces + 3 P2 platform; 2 audit recs already shipped (LANG-07 popups → `useConfirm`, LANG-10 voice guide → `docs/conventions/ui-voice.md`). Also opened **`F-SEC-REALTIME-RLS`** to track the deferred `realtime.messages` finding (operator picked "ignore for now, track as backlog" earlier) and marked the scanner finding ignored with that F-ID. Phase B (`F-OUTCOME-SURFACE` = bundles 10–12 + REC-07 + LANG-NEW-OUTCOME) is now the unambiguous next-up. **WHY:** until the audits were graduated into addressable F-IDs they were prose Claude/Antigravity/Gemini couldn't pick up in parallel; this unblocks every tool. **Files:** edited `docs/feature-backlog.md` (status board · this log line · new triage section), `plan.md` (§4 entry), `docs/strategy/archive/v3-audit-2026-06-06.md` + `docs/strategy/archive/v3-audit-language-2026-06-06.md` (marked triaged with date + F-ID mapping at bottom), `docs/strategy/session-decisions.md` (one-line decision entry).
- `2026-06-06` — **Cross-tool memory fix.** Operator caught that the 6 `mem://` memory files I created earlier in the day were Lovable-private — invisible to Claude Code, Antigravity, and Gemini, breaking the cross-tool contract in `AGENTS.md` §10. Fix: created [`docs/conventions/`](../conventions/) as the git-tracked home for durable rules. New files: `README.md` (index + how to add), `ui-chrome.md`, `ui-voice.md`, `destructive-actions.md`, `inline-management.md`, `doc-closure-checklist.md`. Wired into every tool entry point: `AGENTS.md` §3 (5 new rule one-liners) + §5 (2 new rows in the update-matrix); `CLAUDE.md` and `GEMINI.md` read-order step 1.6; `.lovable-config.txt` SOURCE OF TRUTH HIERARCHY. Reduced all 6 `mem://` files to ≤ 3-line pointers that defer to their git twin; updated `mem://index.md` accordingly. Linked the new conventions from `architecture/frontend.md`, `design.md`, and the audit doc. Updated `docs/README.md` with a Conventions section. **WHY:** tool-private memory creates silent cross-tool drift. The repo is the only shared substrate; rules belong in `git`. **Files:** new `docs/conventions/{README,ui-chrome,ui-voice,destructive-actions,inline-management,doc-closure-checklist}.md`; edited `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.lovable-config.txt`, `docs/README.md`, `architecture/frontend.md`, `design.md`, `docs/strategy/archive/v3-audit-language-voice-2026-06-06.md`, `docs/strategy/session-decisions.md`, `plan.md`, `docs/feature-backlog.md`; reduced 6 `mem://` files + `mem://index.md` to pointers.
- `2026-06-06` — **Doc-closure pass.** Extended `docs/strategy/archive/v3-audit-language-voice-2026-06-06.md` with a "How to use / verify" block (workspace switcher · product row actions · `useConfirm`/`usePrompt` · toasts), a phased rollout (P0 shipped · P1 21-route sweep open · P2 tooltip discipline open), a Learnings section, and a Related cross-link block. Added new subsections to `architecture/frontend.md` (Confirmation, toasts & dialogs · Inline workspace & product management) and `design.md` (Voice & language — length budgets, AI-tell denylist, confirm-copy pattern). Added an owner-gated server-fn invariant to `architecture/security.md`. Banked durable learnings as project memory: `mem://constraint/no-native-browser-chrome`, `mem://constraint/no-em-en-dashes-in-ui`, `mem://preference/voice-anchor`, `mem://preference/destructive-actions`, `mem://feature/inline-workspace-product-mgmt`, `mem://preference/doc-loop-checklist`, plus two new Core lines in `mem://index.md`. **WHY:** the loop only closed partially — the next session would have reintroduced an em dash or a `confirm()` because the contracts didn't say no. **Files:** edited `docs/strategy/archive/v3-audit-language-voice-2026-06-06.md`, `architecture/frontend.md`, `design.md`, `architecture/security.md`, `docs/strategy/session-decisions.md`, `plan.md`, `docs/feature-backlog.md`; new memory files under `mem://`.
- `2026-06-06` — **Zero browser popups + inline workspace/product management shipped.** New `src/hooks/use-confirm.tsx` (`ConfirmProvider` + `useConfirm` + `usePrompt`, promise-based, themed shadcn `AlertDialog`/`Dialog`, focus-trapped, supports `destructive` styling and `typedConfirm` typed-name guard). Provider mounted in `__root.tsx`. ESLint guardrail in `eslint.config.js` blocks `alert`/`confirm`/`prompt`/`window.onbeforeunload`. Replaced 12 popup call sites across `AppShell` (new workspace, new product, delete product), `_authenticated.evals.tsx` (delete suite, delete case), `_authenticated.guardrails.tsx` (delete rule), `_authenticated.docs.tsx` (Google Docs import, icon picker, delete doc), `DocEditor.tsx` (link, figma toolbar + slash). New server fns `renameWorkspace`/`deleteWorkspace`/`leaveWorkspace`/`listWorkspaceMembers`/`removeWorkspaceMember` in `src/lib/workspaces.functions.ts`, plus `updateProject` in `projects.functions.ts`. `AppShell` workspace switcher exposes inline Manage menu (Rename, Workspace settings, Leave, Delete with typed-name guard); each product row gets a `MoreHorizontal` dropdown (Set active, Rename, Delete with typed-name guard). **Files:** new `src/hooks/use-confirm.tsx`, `src/lib/workspaces.functions.ts`, `docs/strategy/archive/v3-audit-language-voice-2026-06-06.md`; edited `src/routes/__root.tsx`, `src/components/cadence/AppShell.tsx`, `src/components/cadence/DocEditor.tsx`, `src/routes/_authenticated.evals.tsx`, `src/routes/_authenticated.guardrails.tsx`, `src/routes/_authenticated.docs.tsx`, `src/lib/projects.functions.ts`, `eslint.config.js`, `plan.md`, `docs/strategy/README.md`, `docs/strategy/session-decisions.md`, `docs/feature-backlog.md`.
- `2026-06-06` — **v3 language companion audit landed.** Full naming/microcopy/tooltip pass on top of the v3 product audit. Findings: `/login` tagline contradicts v2/v3 thesis ("AI-native" vs. "autonomous/cockpit"); sidebar mixes user-time nouns with industry jargon (`AI Ops`, `Eval Harness`, `Swarm HUD`, `Build Console`, `Sync Inbox`); `Phase N`/`Bundle N` internal version labels leak onto 4 operator routes; work-unit noun drift (Mission/Run/Trajectory/Step/Trace); approval surfaces fragmented across 5 places; tooltips paper over weak labels (`Autonomy dial` needs a tooltip to define itself). **Output:** [`./strategy/archive/v3-audit-language-2026-06-06.md`](../strategy/archive/v3-audit-language-2026-06-06.md) — Top-10 fixes, full naming integrity matrix, sidebar 31→12 rename mapping (old→new + redirects), tooltip Keep/Delete/Rewrite/Add audit per route, 5 verbatim rewrites of the most-costly strings, agent/AI vocabulary spec (states, trust stages, approval modes, trace step labels, AI-chip copy), one-page voice guide (operator-grade · reporter · coach; banned words), P0–P3 rewrite roadmap with Impact × Effort × Horizon × Strategic × Benefit. Headline ask: pick LANG-01..LANG-10 for week-1 ship (zero-engineering-risk wins), then LANG-IA-12 to consolidate routes. **No code, no backlog mutations.** **Files:** new `docs/strategy/archive/v3-audit-language-2026-06-06.md`; edited `docs/strategy/README.md` (index row), `docs/strategy/session-decisions.md` (decision-log entry), `docs/feature-backlog.md` (this board), `plan.md` (§4 entry).
- `2026-06-06` — **v3 audit landed.** Brutally honest end-to-end review of Cadence (product, UX, AI-native posture, IA, competitive position, thesis). Method: full doc + code read, live preview walk against seeded demo workspace, three parallel competitive-research subagents (engineering-autonomy lane / product-OS lane / agent-OS + governance lane). Findings: first-impression collapse (login says "AI-native" — contradicts v2; Today asks operator to refresh); 31 routes for a "calm, single-purpose app" (target IA: ~12); 18 seeded agents on day one (target: 5); "watch the agents build" is 4 half-built surfaces (target: 1 cockpit); 4 of 9 lifecycle stages have no UI (Release/Launch/Support/Outcome/Memory Inspector all missing); Builder ships single-file PRs (commodity in 2026); no Machine Mode (the Paxel insight); MCP server unshipped (must-do in 14 days). **Output:** [`./strategy/archive/v3-audit-2026-06-06.md`](../strategy/archive/v3-audit-2026-06-06.md) with Top-5 / Top-10 / Top-20 prioritized roadmap (Impact × Effort × Horizon × Strategic × Benefit on every rec). Headline thesis refinement: "autonomous product OS" → **product-org cockpit** (same substrate, sharper noun) — awaiting operator decision. Investor readiness median 6.5 (Vision 8, AI Readiness 8; UX 4, Differentiation 5 are the blocking dimensions). **No code, no backlog mutations** — recommendations graduate to features only on operator sign-off. **Files:** new `docs/strategy/archive/v3-audit-2026-06-06.md`; edited `docs/strategy/README.md` (index row), `docs/strategy/session-decisions.md` (decision log entry), `docs/feature-backlog.md` (this board).
- `2026-06-06` — **Bundle 9 Slices 2 + 3 shipped — Builder closes its own CI loop and is safe to run in parallel.** Slice 2 adds `github.ci.read` (read/auto, cached by `(pr, head_sha)`) and `github.commit.append` (write/confirm, idempotent on `issue-<n>-fix-<k>`); Builder system prompt now polls CI up to 3× per loop step, on red queues exactly ONE follow-up commit naming the failing check, on green finalizes. `/build` Kanban + `/missions/$id` timeline render a new `CI · green | red · <check> | pending | n/a` chip that links to the failing check. Slice 3 adds `builder_file_claims` (partial unique `(repo, path) WHERE status='held'`) + a `release_claims_for_terminal_run` trigger on `agent_runs`; `github.pr.open` claims the path BEFORE the Contents-API PUT so a second mission targeting the same file hits a typed `BuilderFileConflict` error instead of opening a competing PR. New **Active file claims** panel on `/build` (5s refresh) with Release button (owner-only) via new `releaseBuilderClaim` server fn. **FND-RUNTIME 0.9:** published `docs/fnd-runtime-restart-playbook.md` — the operator-driven 5-minute proof (start Builder mission, restart worker mid-loop, verify sweeper resume + idempotent external writes + single-branch/PR/commit invariant); `docs/foundation-audit.md` row 0.9 flipped ❌ → 🟡 (✅ on a clean playbook pass). **How to use / verify:** see [`./features/bundle-9-builder.md`](../features/bundle-9-builder.md) for the full per-feature page (demo script, verification per slice, governance + limits) and [`./fnd-runtime-restart-playbook.md`](../operations/fnd-runtime-restart-playbook.md) for the playbook. **Files:** new `supabase/migrations/<ts>_builder_ci_loop_tools.sql`, new `supabase/migrations/<ts>_builder_file_claims.sql`, new `docs/features/bundle-9-builder.md`, new `docs/fnd-runtime-restart-playbook.md`; edited `src/lib/ai/tools/registry.server.ts`, `src/lib/build.functions.ts`, `src/routes/_authenticated.build.tsx`, `docs/README.md`, `docs/features/README.md`, `docs/foundation-audit.md`, `architecture/orchestration.md`, `plan.md`.
- `2026-06-06` — **F-AGENT-4 shipped — Swarm HUD live. Agent-ecosystem bundle closed.** New route `/swarm` (nav: Agents → Swarm HUD) is a single read-only governor's cockpit refreshed every 2s: live agents grid (status pill, current input, step k/N, trust arc, "Open mission" jump), missions-in-flight table (with `done/total` step bars), attention queue (inline Approve/Reject for pending `agent_approvals` + inline Dispatch/Skip for pending `confirm` `event_queue` rows — calls the same server fns `/inbox` and `/governance` use), throughput strip (last hour: AI calls, $, p50 latency, 5-min sparkline from `ai_events` + guardrail-hit count), handoff feed (last 50 `agent_messages` with `from → to · kind`), reactor firings (last 50 `event_queue` rows). One server fn `getSwarmHud()` in `src/lib/swarm.functions.ts` parallel-fires every read — no new tables, no new tools, no new mutations. **Docs pattern alongside:** new `docs/features/` folder with one canonical operator/demo page per shipped feature — index + template at `docs/features/README.md`, backfilled `f-agent-1-orchestrator.md` / `f-agent-2-memory-reflection.md` / `f-agent-3-event-reactor.md`, and full `f-agent-4-swarm-hud.md`. Each page is the single doc to open during a demo or to onboard a new operator. `docs/README.md` got a new "Per-feature operator & demo guides" section. **How to use / verify:** see [`./features/f-agent-4-swarm-hud.md`](../features/f-agent-4-swarm-hud.md) — demo script + verification checklist live there. **Files:** new `src/lib/swarm.functions.ts`, new `src/routes/_authenticated.swarm.tsx`, new `docs/features/README.md` + 4 feature pages; edited `src/components/cadence/AppShell.tsx`, `docs/README.md`, `architecture/orchestration.md`, `plan.md`, `docs/feature-backlog.md`.
- `2026-06-06` — **F-AGENT-3 shipped — event reactor + auto-pipelines live. Cadence now reacts.** New `event_subscriptions` table (operator rules: `event_type → target_agent_slug` with `auto|confirm` + jsonb `filter`, RLS workspace-scoped, `is_default` flag) + `event_queue` (idempotent UNIQUE `(subscription_id, source_id)` so re-fires never duplicate; statuses `pending → dispatched|skipped|failed`, carries `mission_id`/`run_id`/`error`). Three SECURITY DEFINER trigger fns on `signals` (insert), `opportunities` (insert or ICE change + `ice_score >= filter.min_score`, default 8.0), `prds` (status transition into `approved`) fan-out matching subs into the queue. New `seed_default_event_subscriptions(uuid)` seeds three defaults per workspace owner — `signal.created → discovery (auto)`, `opportunity.scored → strategist (confirm, min_score 8.0)`, `prd.approved → orchestrator (confirm)`; wired into `handle_new_user` + backfilled. New `src/lib/reactor.functions.ts` with `list/upsert/delete EventSubscription`, `listEventQueue`, `decideEventDispatch`, and shared `dispatchEvent()` (creates mission + runs `runAgentLoop`). New cron route `/api/public/hooks/event-reactor-tick` drains pending `auto`-mode rows (BATCH=10) every minute via pg_cron job `event-reactor-tick`. `/governance` page gained **Auto-pipelines** (rules list + composer) and **Reactor activity** (50 recent events, Dispatch/Skip on pending `confirm` rows, 5s refresh) panels. **Files:** new `supabase/migrations/<ts>_event_reactor_and_subscriptions.sql`, new `src/lib/reactor.functions.ts`, new `src/routes/api/public/hooks/event-reactor-tick.ts`; edited `src/routes/_authenticated.governance.tsx`, `plan.md`, `architecture/orchestration.md`, `docs/feature-backlog.md`.
- `2026-06-06` — **F-AGENT-2 shipped — agents now learn run-over-run and earn autonomy automatically.** Reflection helper (`src/lib/ai/reflection.server.ts`) auto-runs after every clean completion in both fresh and resumed loops; writes `kind='reflection'` rows with embedding + structured metadata. `recallMemory()` augmented with `recent_agent_reflections` so reflections surface even when the embedding store is sparse. Two new memory tools (`memory.reflect`, `memory.promote`). Autonomy auto-advance via new SECURITY DEFINER RPC `auto_advance_agent_arc` — promotes Observing→Proving@5, Proving→Trusted@20, only when no approval was rejected since the last arc change; never downgrades; never auto-promotes to Ambient. New "Recent reflections" panel on `/agents` (lesson + what-worked / what-to-change + importance pill). New daily cron `memory-tick-daily` decays low-importance, unused memories. Missing `agent_memory` PostgREST grants finally added. **Files:** new `src/lib/ai/reflection.server.ts`, new `src/routes/api/public/hooks/memory-tick.ts`, 2 new migrations; edited `src/lib/ai/loop.server.ts`, `src/lib/ai/tools/registry.server.ts`, `src/lib/agents.functions.ts`, `src/routes/_authenticated.agents.tsx`.
- `2026-06-06` — **F-AGENT-1 Orchestrator shipped — Cadence runs real multi-agent missions.** New seed agent `orchestrator` (created on first call via `seed_orchestrator_agent()`); new `mission_steps` table (DAG with `depends_on int[]`, status: planned→dispatched→running→done/failed/skipped, RLS scoped to user + workspace_member read); helper RPC `next_ready_mission_steps(mission_id)` returns the steps whose deps are all `done`. Four new agent tools in the planner registry: `mission.plan` calls a sub-model for a 1–6 step DAG and persists rows; `mission.dispatch` enqueues a child `agent_runs` row per ready step via the existing `enqueueHandoff()`; `mission.observe` reflects child-run status back onto step rows and reports progress; `mission.finalize` records summary + marks the mission completed (or `completed_with_failures`). Loop step cap is per-agent now — orchestrator gets 14, specialists stay at 6 (preserves existing behavior). UI: `/missions` gained an inline "Plan & dispatch" composer; `/missions/$id` shows the live DAG with deps + an **Advance** button that re-invokes the orchestrator to dispatch newly-ready steps (placeholder until F-AGENT-3 reactor wires automatic re-wake). Specialists run async via the existing `resume-runs` cron — no infra changes. **Files:** new `supabase/migrations/<ts>_mission_steps_and_orchestrator.sql` (×2 — initial + seed-fix), new `src/lib/ai/tools/orchestrator.server.ts`, new `src/lib/orchestrator.functions.ts`; edited `src/lib/ai/tools/registry.server.ts`, `src/lib/ai/loop.server.ts`, `src/routes/_authenticated.missions.index.tsx`, `src/routes/_authenticated.missions.$missionId.tsx`, `active-task.md`, `plan.md`, `architecture/orchestration.md`. |
- `2026-06-05` — **Demo credentials doc interlinked across all index + tool-entry files** (`README.md` Try-it section, `docs/README.md` row, `AGENTS.md` §0 pointer, `CLAUDE.md` + `GEMINI.md` read-order, `ENTRY.md` row + file tree). Closes the doc loop for `docs/demo-credentials.md` so any tool reading its standard entry flow finds the demo logins without grep.
- `2026-06-04` — **Demo workspace seeding repaired + credentials documented + favicon added.** `seed_demo_workspace` was silently failing on both demo accounts (`demo@redcadence.app`, `demo2@redcadence.app`) because it hardcoded `slug='demo'` and `workspaces.slug` is globally `UNIQUE`. Patched the seeder to use `'demo-' || substr(user_id::text,1,8)` (with NULL fallback) and re-seeded both accounts — they now sign in to a fully populated Demo workspace (Lumen project, themes, signals, opportunities, PRDs, missions, traces, evals, briefs). New `docs/demo-credentials.md` documents both logins + shared password + seeded content + re-seed instructions. Generated a Cadence brand-mark favicon (violet→magenta `C`), uploaded via `lovable-assets`, wired into `__root.tsx` head links — browser tab now shows the icon on every route including `/login` and the published site. **Files:** new `supabase/migrations/<ts>_restore_seed_demo_workspace.sql`, new `docs/demo-credentials.md`, new `src/assets/favicon.png.asset.json`; edited `src/routes/__root.tsx`, `plan.md`.
- `2026-06-04` — **Restructure Phase 2 shipped — Today / Briefing / Approvals / PRDs restyled to Cohere editorial.** `/` (Today): hero replaced with full-bleed `band-deep-green` block carrying the focus-score readout in canvas-white; ShaderAnimation removed; per-agent gradient palette collapsed to a single neutral stone accent; progress bars switched from violet→cyan gradients to flat `bg-foreground` / `bg-deep-green`; tabs (Overview/Work/Agents/Pulse) and decision/copilot panels rebuilt with `mono-label` headings + `btn-pill` CTAs; Product health card switched to a `band-stone` panel. `/briefing`: editorial header with mono-label tag, larger Instrument Serif H1, `btn-pill` save, cards bumped to 24px padding, verify-hint switched to `band-stone`. `/inbox` (Approvals): list pattern rebuilt as `rule-hairline` rows with mono-label metadata header (`agent / tool / status`), serif rationale typography, `btn-pill`/`btn-pill-outline` Approve/Reject; status badge now shows a deep-green/coral/ink dot + label instead of bright pills; error banner uses a coral left rule. `/prds` list: bento card grid replaced with `rule-hairline` research-table rows, neutral file icon, mono-label metadata (`status / Updated… / #issue`), generator card uses `btn-pill`. `/prds/$id`: sticky actions bar now uses `btn-pill` Save + `btn-pill-outline` GitHub/Builder actions with foreground-inverted Edit/Preview toggle; document mode swapped from `prose-invert` on `bento` to `prose-neutral` on a clean card; metadata row uses mono-label with `link-action` GitHub link. Verified `rg` shows zero remaining `text-violet-*` / `from-violet*` / `neural-gradient` / `prose-invert` uses across these five routes. **Files:** edited `src/routes/_authenticated.index.tsx`, `src/routes/_authenticated.briefing.tsx`, `src/routes/_authenticated.inbox.tsx`, `src/routes/_authenticated.prds.tsx`, `src/routes/_authenticated.prds.$id.tsx`, `active-task.md`, `docs/feature-backlog.md`.
- `2026-06-04` — **Restructure Phase 1 shipped — nav IA + Cohere editorial design system.** Sidebar reorganized into 6 enterprise pillars: always-on **Workspace** rail (Today · Briefing · Approvals · Calendar · Meetings · AI Chat) + collapsible **Discover** · **Deliver** · **Agents** · **AI Ops** · **Govern** + Settings footer. Calendar and Meetings left Discover (they're cross-phase inputs); Sync Inbox moved under Agents; Govern is its own pillar. No route URLs changed. Design tokens in `src/styles.css` fully rewritten from dark Nightshift to the Cohere editorial light system — white canvas, near-black primary, deep-green/dark-navy product bands, soft-stone/pale-green/pale-blue surface washes, coral editorial chip, action-blue links, 8px base radius. New utilities `mono-label`, `btn-pill`, `btn-pill-outline`, `band-deep-green/navy/stone`, `chip-taxonomy`, `link-action`, `rule-hairline`. Display type switched to **Instrument Serif** (Cohere fallback), UI stays Inter, mono labels JetBrains Mono — wired via Google Fonts in `__root.tsx`. Legacy decorative utilities (`neural-gradient`, `animate-aurora`, `ring-glow-violet`, `bento`, `glass`) neutralized to soft light equivalents so old pages don't break before per-page Phase 2–4 restyles. **Files:** edited `src/styles.css`, `src/components/cadence/AppShell.tsx`, `src/routes/__root.tsx`, `active-task.md`, `plan.md`.
- `2026-06-04` — **Build Console accepts free-form input; PRD surfaces fixed.** `/build` now opens with a **Start a build** composer: free-form Goal (required) + optional **Reference PRD** + optional **Reference links** + three issue-resolution modes (use linked PRD issue · explicit issue # · auto-create from goal). New server fn `dispatchBuilderMission` in `src/lib/build.functions.ts` resolves the issue (reusing a PRD's linked issue, taking an explicit number, or opening a fresh issue via GitHub REST with the goal + PRD body + reference links as context), creates a mission, and runs the Builder loop — same single-file / confirm-gated / idempotent contract as before. `/prds` list cards now show **Create GitHub issue / Open issue / Send to Builder** actions inline (plus a `#N` status chip) so you don't need to drill in to wire a PRD up. `/prds/$id` rebuilt as a proper document: thin metadata row + a **sticky actions bar** carrying Edit/Preview, Save, GitHub issue actions, Send to Builder, and AI assist all in one place. Eliminates the prior dead-ends ("I can't find Create issue", "Build Console only takes PRDs"). **Files:** edited `src/lib/build.functions.ts`, `src/lib/discovery.functions.ts` (listPrds now returns `github_issue_url`), `src/routes/_authenticated.prds.tsx`, `src/routes/_authenticated.prds.$id.tsx`, `src/routes/_authenticated.build.tsx`, `active-task.md`, `architecture/orchestration.md`, `plan.md`.
- `2026-06-04` — **Bundle 9 Slice 1 — Builder agent + scoped PR pipeline shipped.** A new `builder` agent is now seeded for every existing profile + every new signup with a tight operator prompt (single file per PR, must read the issue first, idempotency_key = `issue-<n>`, never auto-merges, never touches `.github/`/`supabase/migrations/`/lockfiles). New built-in tool `github.pr.open` (`write/confirm`) in `src/lib/ai/tools/registry.server.ts` implements the REST-only PR pipeline against `${GITHUB_REPO}`: get default branch → create `builder/issue-{n}-{slug}-{rand}` ref → PUT base64-encoded file via Contents API → POST PR with `Closes #N` body. Wrapped in `withIdempotency('github_pr', idempotency_key, …)` so reopening the same approval after a worker restart or sweeper resume returns the cached `{number, url, branch, path}` — never double-opens. Nav: Code Studio renamed to **Prototype Sandbox** and moved out of Build into Discover (route `/studio` unchanged so old links still work); new **Build Console** entry in Build → `/build`. New `/build` route is a 5-column Kanban (In flight · Awaiting you · PR open · Done · Failed) over `agent_runs WHERE agent_slug='builder'`, joined to `tool_calls.result` of `github.pr.open` for the PR chip and to `agent_approvals` (via `trace_id`) for the pending-approval count. Refreshes every 2s. New **Send to Builder** button on `/prds/$id` (visible when `github_issue_url` is set) extracts the issue number from the URL and dispatches a Builder mission with `asMission: true`, then routes you to the mission's Mission Graph. **How to use / verify:** open any PRD that already has a linked GitHub issue → click **Send to Builder** (cyan chip next to the GitHub issue chip) → toast routes you to `/missions/{id}` → Builder hop appears in the Mission Graph → step `tool_call · github.pr.open` lands in the Decision Queue at `confirm` → approve → a real PR opens on `RohitGajaraj/Test-Project-Cadence` from a `builder/issue-<n>-…` branch with **one file changed**, body says `Closes #N`, no merge happens automatically. Open `/build` → mission card appears in the **PR open** column with a `Github · PR #N · path/to/file` chip and a 2s-refreshing status. Re-approve the same gate → cached PR returns, no second branch/PR. **Files:** new migration `supabase/migrations/<ts>_add_builder_agent_and_github_pr_open.sql`; new `src/lib/build.functions.ts`; new `src/routes/_authenticated.build.tsx`; edited `src/lib/ai/tools/registry.server.ts`, `src/components/cadence/AppShell.tsx`, `src/routes/_authenticated.prds.$id.tsx`, `architecture/orchestration.md`, `docs/feature-backlog.md`, `plan.md`. Slices 2–3 tracked in `active-task.md`.
- `2026-06-04` — **GitHub issue approval flow documented + secrets rotated to `RohitGajaraj/Test-Project-Cadence`.** New canonical doc [`./github-issue-approval-flow.md`](../features/github-issue-approval-flow.md) — step-by-step of what Approve does, single-repo POST contract, `withIdempotency` guarantee, failure modes, verification checklist, secret rotation playbook. Cross-linked from `architecture/orchestration.md` (Bundle 6 paragraph), `architecture/integrations.md` (new GitHub connector line), and `docs/README.md`. `GITHUB_REPO` + `GITHUB_TOKEN` rotated via Cloud secrets UI — picked up at next tool call, no redeploy. Closes the doc loop on Bundle 6's governance gate; unblocks operator's real-repo demo.
- `2026-06-04` — **Bundle 6 lifecycle close shipped — Discover→Define→Plan can now exit to a real GitHub issue.** The two tool handlers (`github.issue.create`, `prd.link_issue`) already existed in `src/lib/ai/tools/registry.server.ts` from FND-RUNTIME 0.9 + Bundle 2, but `prd.link_issue` was missing from `seed_pm_lifecycle_tools` and `github.issue.create` was either unseeded for legacy users or seeded at the wrong default mode. New migration rewrites both seed functions: `seed_pm_lifecycle_tools` now also installs `prd.link_issue` (write/confirm), and `seed_default_agent_tools` re-affirms `github.issue.create` at `write/confirm` (was `review`) so the Plan stage can ship under the trust dial; both functions then run inside a backfill loop over every existing `profiles` row so missions starting today have the right `agent_tools` gates. UI: `/prds/$id` now renders a clickable `Github · GitHub issue #N` chip immediately under the back-link when `prds.github_issue_url` is set (parses the issue number from the URL). Idempotency: `github.issue.create` is already wrapped in `withIdempotency('github_issue', idempotency_key, …)`, so re-execution after a worker restart or sweeper-driven resume returns the cached `{ number, url, id, repo }` with `cached: true` — it never double-creates. **How to use / verify:** `/agents` → pick Orchestrator → tick "Start as mission" → dispatch `"Take the highest-ICE backlog opportunity, draft a PRD, and open a GitHub issue for engineering. Use idempotency_key = the PRD id."` → on `/missions/$id` watch hops (Discovery → Strategist → Planner) appear in the Mission Graph with labelled handoff edges → approve `github.issue.create` in the approval card → a real issue is created on `${GITHUB_REPO}` → the Planner immediately calls `prd.link_issue(prd_id, issue_url)` → opening `/prds/$id` shows the `GitHub issue #N` chip linking to GitHub. Re-running the same approval (or the resume sweeper picking up a stalled run) re-uses the same issue. **Files:** new `supabase/migrations/<ts>_seed_github_issue_and_link.sql`; edited `src/routes/_authenticated.prds.$id.tsx`, `docs/feature-backlog.md`, `plan.md`, `architecture/orchestration.md`.
- `2026-06-04` — **Bundle 5 Live Mission Graph (E6) shipped.** New `src/components/cadence/MissionGraph.tsx` renders a pure-SVG DAG above the existing hops list on `/missions/$id`. **Nodes** = one per `agent_runs` row in the mission (status color + glyph from `statusTone`/`StatusGlyph`, agent name, slug, status); **edges** = one per `agent_messages` row, drawn `source_run_id → consumed_by_run_id` with violet bezier paths + arrow markers + the message `kind` label; for in-flight handoffs that haven't been consumed yet, the edge falls back to the earliest later hop matching `to_agent_slug`. Layout = topological (column = BFS depth from any root hop, row = chronological within column) so single-agent missions render as 1 node / 0 edges and a Discovery→Strategist→Builder mission renders as 3 nodes connected by 2 labelled edges. Nodes are real `role="button"` SVG groups with keyboard support; clicking expands the matching hop card (via the existing `expanded` Set) and smooth-scrolls to it (`id="hop-{run_id}"` + `scroll-mt-24`). Re-uses the existing 2s refetch loop so the graph fills in live. Pure read model — no schema change, no new server fn (consumes the existing `getMission` payload). Pattern cross-linked from `architecture/orchestration.md`. **How to use / verify:** dispatch any mission from `/agents` with "Start as mission" ticked → open `/missions/{id}` → the Mission graph card appears above the timeline; single-agent dispatch shows **1 node / 0 edges**; a handoff mission shows nodes for each hop connected by labelled violet edges that update within 2s; clicking a node scrolls to + expands the matching hop card and surfaces the `/traces/$traceId` link. **Files:** new `src/components/cadence/MissionGraph.tsx`; edited `src/routes/_authenticated.missions.$missionId.tsx`, `architecture/orchestration.md`, `docs/feature-backlog.md`, `plan.md`.
- `2026-06-04` — **Mission page: live progress panel + agent timeline.** `/missions/$id` now renders (a) an **Agent timeline** strip at the top — one chip per hop with status icon, agent slug, and elapsed duration, separated by handoff arrows so you can see where the mission started, who touched it, and where it is now; (b) a **live progress panel inside each hop** that lists the agent's `steps[]` (thought / tool_call / final) with per-step status + tool-call args/error preview, plus a **Tool spans** subsection (per-call name + ok/err + latency) sourced from `tool_calls`. Always-visible for live hops (`running`/`queued`); on-demand via Detail toggle for finished hops. Refresh interval tightened to 2s while running. Header now shows live indicator. Each hop card now also exposes a one-click **Trace** link to `/traces/$traceId` for the run. Server side: extended `getMission` to also fetch the latest `agent_run_checkpoints` per run (extracts `traceId` + `steps[]`) and join `tool_calls` by trace id. Also fixed a real bug discovered while shipping this: `web.search` was crashing the agent loop on step 1 with `rows.map is not a function` because Firecrawl v2 returns `{data:{web,news}}` (object) not an array — parser now handles both. **How to verify:** dispatch a mission from `/agents`, open `/missions/{id}` — within ~2s you should see Step 1 (thought) → Step 2 (tool · web.search · executed) → … appearing live, the Agent timeline chip pulsing, and the Tool spans section filling in with latencies. When the mission completes, the panel collapses behind Detail.
- `2026-06-04` — **Web access for agents shipped.** Agents can now reach the public internet through four governed tools: `web.search` (ranked results, optional in-line scrape), `web.fetch` (single URL → markdown), `web.map` (URL discovery), `web.crawl` (bounded, max 25 pages / depth 2). All four sit in `TOOL_REGISTRY` and route through a single helper `src/lib/ai/tools/firecrawl.server.ts` that reads `FIRECRAWL_API_KEY` from `process.env`. Search/fetch/map default to `auto`; `web.crawl` defaults to `confirm` because it spends real credits. Returns are clipped (search snippets 2 KB, fetch markdown 8 KB default / 20 KB max, crawl pages 4 KB each) so token spend stays predictable. Results re-enter the loop as untrusted input — the next `callModel()` already runs them through pre-guardrails (PII / prompt-injection / secret), no new code required. Seeded for new signups via `seed_default_agent_tools`; backfilled for every existing user in the same migration. Connected Firecrawl as a workspace connector. Canonical doc `docs/web-access.md`; cross-linked from `architecture/integrations.md`, `docs/trust-and-autonomy.md`, `docs/a2a-handoff.md`, `docs/README.md`. **How to verify:** open `/agents`, pick Orchestrator, tick "Start as mission", dispatch a goal like _"Scout how Linear's AI triage is positioned (linear.app + recent blog posts), then draft a one-pager + positioning angle that does NOT sound reactive"_. Open `/missions/{id}`: Discovery hop's trace should show real `web.search` + `web.fetch` calls, the logged signals should carry source URLs, and the Strategist's draft should cite ≥2 real URLs (not invented quotes).
- `2026-06-04` — **Bundle 4 Agent-to-Agent handoff (E1–E5 MVP) shipped.** New `missions` table (groups runs under one operator intent; member-read, owner-write RLS; hop counter + current_agent maintained by trigger). New `agent_messages` table (one structured A2A payload per hop — `from/to_agent`, `kind`, `payload jsonb`, source run/trace, consumer run; member-read RLS). `agent_runs.mission_id` added (nullable — single-agent runs still valid). New `src/lib/ai/handoff.server.ts` exports `createMission`, `enqueueHandoff`, `consumeInboundHandoff`, `renderHandoffBlock`, `maybeCompleteMission`. New `agent.handoff` tool (write/confirm; payload = task + context + artifacts + open_questions + constraints) — inserts the message AND enqueues a child `agent_runs` row with the same `mission_id`; the existing resume-runs sweeper picks it up. Agent loop now passes `missionId` + `workspaceId` into `ToolCtx`, and at run start consumes the latest inbound handoff and prepends `renderHandoffBlock` to the system prompt right after the workspace brief (so receiver sees structured payload, never a pasted prompt). Both `runAgentLoop` and `resumeAgentLoop` honor this — including brief block on resume which was missing. Receiver's autonomy arc continues to gate its own tool calls. Failure policy: hop failures stop the mission; operator re-dispatches manually (option-b, documented). New `/missions` (list) and `/missions/$missionId` (hops timeline + collapsible payload viewer + auto-refresh while running). "Start as mission" checkbox added to `/agents` dispatch form. Canonical doc `docs/a2a-handoff.md` covers payload contract, lifecycle, trust interaction, operator playbook. **How to verify:** `/agents` → pick Orchestrator (or any agent) → tick "Start as mission" → dispatch — toast routes you to `/missions` → open the mission → first hop appears; if it calls `agent.handoff` (approve once if `confirm`), the second hop appears within a sweeper tick (~60s) and shows the inbound payload between hops.
- `2026-06-04` — **C6 Trust score gets a qualitative label, rich tooltips, and a canonical doc.** `/agents` Trust chip now reads `Trust 48 · Proving` (label derived from score band: At-risk / Observing / Proving / Trusted / Ambient; `New` until ≥3 samples). Replaced native `title=` strings with Radix Tooltips: the chip's tooltip explains the 0–100 scale + Bayesian shrinkage and shows weighted breakdown (40/30/30) with raw counts; the "Autonomy dial" label has its own tooltip; every arc button has a per-arc tooltip describing exactly what it does to `auto` / `confirm` / `review` tools. Page wrapped in `TooltipProvider`. New canonical doc [`docs/trust-and-autonomy.md`](../features/trust-and-autonomy.md) — score meaning, formula, arc mapping, safety floors, operator playbook — referenced from C6's entry below and from `architecture/orchestration.md`. Files: `src/routes/_authenticated.agents.tsx`, `docs/trust-and-autonomy.md`, `architecture/orchestration.md`.
- `2026-06-04` — **Bundle 3 Agent Trust Score + Autonomy Dial (C6) shipped.** New `agent_autonomy` table (one row per user+agent, arc ∈ observing/proving/trusted/ambient, owner-only RLS). Trust score computed on read from real signals (mission completion rate, approval acceptance rate, eval mean — Bayesian-shrunk toward 0.5 when sample <10). New `src/lib/ai/trust.server.ts` exports `computeAllAgentTrust`, `resolveApprovalMode`, `suggestArc`, `loadAgentArc`. New server fns `getAllAgentTrust` / `setAgentArc` in `src/lib/trust.functions.ts`. Agent loop now calls `resolveApprovalMode(toolMode, arc)` at the gate decision: Observing forces `review` even on `auto` tools; Trusted runs `confirm` tools inline; Ambient runs all inline (except hard-locked `calendar.create` which keeps `confirm`). Safety floor: `review` tools are never downgraded. `/agents` shows a Trust chip (0–100, color-tiered, hover tooltip with formula + breakdown) on every roster button + agent header, and an inline Autonomy Dial (4 buttons + suggested-arc hint) inside the agent detail card. Files: `supabase/migrations/<ts>_agent_autonomy.sql`, `src/lib/ai/trust.server.ts`, `src/lib/trust.functions.ts`, `src/lib/ai/loop.server.ts`, `src/routes/_authenticated.agents.tsx`.
- `2026-06-04` — **Brief injection verifiable end-to-end.** `/agents` page was wired to a legacy single-shot `runAgent` that bypassed the loop, so dispatches produced `ai_events` rows with `trace_id = NULL` (invisible on `/traces`) and the workspace brief never reached the system prompt. Switched the page to `agent_loop.functions.ts → runAgent` (which calls `runAgentLoop`, generates a trace id, loads `workspace_briefs`, and injects `renderBriefBlock`). Dispatches now appear on `/traces`; the first step's system prompt contains the `--- Workspace Strategic Brief ---` block.
- `2026-06-04` — **Briefing save permanent fix.** Root cause: some signed-in accounts could reach `/briefing` before a client-side active workspace existed, while workspace bootstrap was not guaranteed at the database boundary. Fixed at both layers: the database now guarantees every existing and future profile has a default workspace + owner membership; `upsertBrief` resolves a missing workspace server-side; the `/briefing` Save button no longer stays disabled because browser workspace context is late. Verification: edit Current focus → Save button enabled → click Save → server function returns 200 → button returns to Saved; no briefing console errors.
- `2026-06-04` — **Bundle 2 Strategic Briefing (C5) + `prd.link_issue` shipped.** New `workspace_briefs` table (one per workspace; mission / target user / current focus / anti-goals / notes; member-read, owner-write RLS). Server fns `getActiveBrief` + `upsertBrief` in `src/lib/briefs.functions.ts`. Pure `renderBriefBlock()` emits a labelled, fenced text block (skipped when every field is empty). Agent loop reads the brief for the resolved workspace and injects it **between the agent's own system prompt and memory recall** — so Discovery / Strategist / Builder all see the operator's shared context first. New `/_authenticated/briefing` editor (5 textareas + Save + toast) pinned to the sidebar as **"Briefing"**. Also added the small `prd.link_issue` agentic tool (write/confirm, idempotent — sets `prds.github_issue_url`) to close Bundle 6's PRD↔issue link-back; backfilled for every existing user. Verification: edit the brief, run a mission, observe the Strategist honoring Current focus / Anti-goals. Files: `src/lib/briefs.functions.ts`, `src/routes/_authenticated.briefing.tsx`, `src/lib/ai/loop.server.ts`, `src/lib/ai/tools/registry.server.ts`, `src/components/cadence/AppShell.tsx`, plus the migration.
- `2026-06-03` — **PM lifecycle tools landed.** Added 3 agentic tools to `TOOL_REGISTRY` and seeded them for every user (default `confirm` mode): `research.synthesize` (Discover — clusters recent ungrouped signals into themes via the AI chokepoint, writes `themes` rows, links `signals.theme_id`), `prd.draft` (Define — pulls opportunity + theme + top supporting signals, drafts a structured PRD with problem/goals/non-goals/stories/metrics/risks, writes a `prds` row in `draft` status), `backlog.prioritize` (Plan — re-scores ICE on backlog opportunities grounded in supporting-signal counts + recency, returns the new ranked list). All three route through `callModel` (surfaces `discovery` / `prd`) so they show up in traces, hit guardrails + budgets, and respect the agent loop's checkpoint/idempotency layer. Existing agents (Discovery Scout, PRD Writer, Strategist) pick them up automatically — the loop filters `TOOL_REGISTRY` by what the user has enabled, no per-agent assignment needed. Migration `seed_pm_lifecycle_tools(uuid)` backfills every existing user once and is folded into `seed_default_agent_tools(uuid)` for new signups.
- `2026-06-03` — **FND-RUNTIME 0.9 runtime + N1 `github.issue.create` landed.** Added `src/lib/runtime/idempotency.server.ts` (`withIdempotency(scope,key,...)` against the new `idempotency_keys` table — INSERT-then-fallback-to-cached on conflict). Refactored `src/lib/ai/loop.server.ts` into a shared `executeLoop()` body fed by both `runAgentLoop()` (fresh) and new `resumeAgentLoop(runId)` (rehydrates from latest `agent_run_checkpoints` row). Each iteration now upserts a checkpoint BEFORE the provider call (so a `GovernanceHaltError` mid-stream doesn't re-bill on resume) and wraps tool execution in `withIdempotency` keyed by `tool:{runId}:{stepIndex}:{toolName}`. Added per-workspace backpressure (default 5 concurrent `running` runs; over-cap missions insert as `status='queued'`). New `/api/public/hooks/resume-runs` sweeper picks up `queued` runs + `running` runs whose `last_checkpoint_at` is >2 min stale; wired to `pg_cron` every minute. Added `github.issue.create` agentic tool: write category, default `confirm` mode, allow-listed to the single `GITHUB_REPO` env, idempotent via caller-supplied `idempotency_key` (e.g. PRD id) so re-execution never double-creates an issue. Ready for the operator to run the Discover→Define→Plan mission against a real Cadence signal.
- `2026-06-03` — **FND-RUNTIME 0.9 foundation landed.** Wrote `docs/decisions/durable-runtime.md` (chose DB-backed job table over Cloudflare Queues — matches existing `/api/public/hooks/*` + `pg_cron` + tenancy patterns, zero new infra, portable). Applied migration adding `agent_run_checkpoints` (append-only per-step snapshot, UNIQUE on `(run_id, step_index)`) + `idempotency_keys` (scope/key dedup for ticks + tool calls) + `agent_runs.step_index` / `last_checkpoint_at`. Both new tables have GRANTs + RLS scoped to `auth.uid()`. Requested + received `GITHUB_TOKEN` + `GITHUB_REPO` secrets so the next stage (Bundle 6 lifecycle slice + N1 `github.issue.create`) is unblocked. `active-task.md` extended with the loop/resume/sweeper + lifecycle-slice sub-steps and a handoff note.
- `2026-06-03` — Extended Agentic Proof Platform → **v1.1: full PM lifecycle** (Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn → re-feeds Discover). Un-deferred S4–S6, L, M under a **realism rule** (agents orchestrate existing tools — GitHub, CI, deploy, Slack/email, support channel — they don't replace IDEs/CI/helpdesks). Added 4 new bundles (9 Build+Test, 10 Ship, 11 Launch, 12 Support→Learn), 7 new reserved IDs (N1, I-thin, J-thin, K-thin, L-thin, M-thin, Z1), expanded build sequence 8→12 steps, locked Cadence-on-Cadence as default real-data seed including PRs on this repo (`GITHUB_TOKEN` to be added when Bundle 9 starts). Logged in `docs/strategy/session-decisions.md`; `active-task.md` unchanged (FND-RUNTIME 0.9 still next).
- `2026-06-03` — Reframed the YC demo cut into the **Agentic Proof Platform (v1)**: same 8 capability bundles + sequence, but each now ships against an explicit **proof bar** (something legacy PM tools structurally cannot do), mapped to four claims (C1 agents operate/humans govern · C2 A2A handoff is first-class · C3 one governed loop · C4 trust is dialed). YC demo becomes a by-product; the platform is the point. Renamed `§ YC demo cut` → `§ Agentic Proof Platform (v1)`; logged in `docs/strategy/session-decisions.md`; `active-task.md` unchanged (FND-RUNTIME 0.9 still next).
- `2026-06-03` — Locked YC demo cut: 8 capability bundles centered on agent-to-agent comms + handoff (E1–E6), Founder-as-PM persona, autonomous Build/Test/Ship (S4–S6) explicitly deferred, real demo data. _(superseded by 2026-06-03 reframe above; sequence + IDs unchanged.)_

### How to update this board (any tool)

- **Starting work** → set **Now building** to `‹ID› · ‹tool› · ‹branch›`; clear it from **Next up**.
- **Pausing/ending a session** → if work is mid-flight, leave **Now building** set so the next tool/session knows where you stopped; otherwise clear it.
- **Hitting a wall** → add to **Blocked / stuck**: the ID, the blocker, what unblocks it.
- **Finishing a feature** → flip its `[status]`/rollup mark to `☑`, append a one-liner to **Recent log** _and_ [`../plan.md`](../../plan.md) §4, recompute **Progress**, and reset **Next up** from the rollup.
- Always refresh **Last updated** (date · tool · branch).

---

## ▶ v4 Feature Map overlay (2026-06-11) — the binding scope layer

> **The v4 feature map ([`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md)) is now the binding scope source.** This overlay maps its station catalogs onto this backlog. The 8-Pillar grouping below remains as historical organization for existing F-IDs; new work is filed under v4 IDs. Where a v4 ID and a legacy F-ID cover the same thing, the row notes it — do not double-build.

**New v4 feature IDs (station · ID · status · maps-to-legacy):**

| v4 ID | Title | Milestone | Status | Legacy overlap |
| --- | --- | --- | --- | --- |
| F-IA-V4 | Collapse IA to 7 surfaces (Home · Chat · Missions · Product · Knowledge · Learn · Govern + Settings), redirects per established pattern, vocabulary enforcement | M1 | ☐ **next up** | extends F-IA-MERGE-* ✅, absorbs F-COCKPIT-MACHINE-MODE |
| SEN-01 | Connector dock: Slack + GitHub issues + one support tool ingest | M1 | ☐ | extends Pillar 1 ingest rows |
| SEN-04 | Researcher watchtower (competitor crawl briefs) | M2 | ☐ | new |
| SEN-05 | Quant analytics inbound (PostHog/Amplitude/Mixpanel) | M2 | ☐ | Pillar 7 placeholder |
| DEC-02 | Critic adversarial pass on opportunities | M1 | ☐ | new |
| DEF-03 | Critic-on-spec red team (spec lens: ambiguity · untestable criteria · scope creep) | M2 | ✅ 2026-06-14 | extends DEC-02 Critic infra |
| DEF-04 | Designer scaffolds (spec → mockup → sandbox preview, token + a11y check) | M3 | ☐ | Pillar 5 placeholder |
| BLD-04 | Delegate-out to external coding agents under our governance (A2A/Linear-style) | M4 | ☐ | new — strategic |
| BLD-05 | Inspector gate (agent-authored tests + preview before merge proposal) | M2 | ☐ | extends Bundle 9 CI read |
| LCH-01 | Launch kit mission (changelog/blog/email/social/docs from diff + spec) | M2 | ☐ | Pillar 7 partial |
| LRN-01 | Support triage loop (tickets → drafted replies gated → bug clusters → signals) | M2 | ☐ | extends F-OUTCOME-SURFACE reads |
| LRN-02 | Outcome reviews (predicted vs actual, Historian verdicts) | M2 | ☐ | new |
| LRN-04 | Product Memory consult/write runtime on every mission + trace visibility | M2 | ☐ | the moat — new |
| ENG-06 | Cost-per-mission / cost-per-artifact telemetry chips | M1 | ☐ | extends budgets/traces |
| ENG-07 | MCP server + client, A2A cards/scopes/audit | M4 | ☐ | Pillar 8 / X5 rows |
| ENG-08 | Roles + per-persona approval lanes | M3 | ☐ | A. roles `[new]` row |
| OPS-01 | Flow mode (ambient soundscape + focus timer on Home, notification quieting) | M3+ | ☐ | new, P3 |

Full L4 decomposition pattern: v4 map §9 M1 exemplar (every hop = HandoffEnvelope + one human card). When picking up any v4 ID, decompose to that grain in this file first, then build.

---

## ▶ Agentic Proof Platform (v1.1) — full product lifecycle, end-to-end on real systems

> **What this is.** A scope overlay — not a new roadmap. The exhaustive backlog below is unchanged. This section picks the smallest subset of existing features whose _combined, end-to-end behavior on real data_ proves that Cadence delivers agentic-native product management that legacy PM tools (Jira, Linear, Productboard, ProductPlan, Aha) structurally cannot. **The YC demo is a by-product; the platform is the point.**
>
> **Locked decisions (2026-06-03):** Demo persona = **Founder-as-PM** ("run the product org you can't afford to hire"). Demo data = **real product** (default: Cadence-on-Cadence; design partner is additive). **v1.1 un-defers Build/Test/Ship/Launch/Support** to cover the whole PM lifecycle end-to-end — under one realism rule: _agents orchestrate existing tools (GitHub, CI, deploy, Slack/email, support channel) where the tool already exists; they don't replace IDEs, CI, or helpdesks._ See [`docs/strategy/session-decisions.md`](../strategy/session-decisions.md) for the reframe.
>
> **From demo cut → proof cut.** Every bundle now ships against an explicit **proof bar** — the minimum behavior that makes the claim true on real data, not just visible in a screenshot. If a visitor cannot point to each of the four claims being true in the running product within ~5 minutes, the bundle hasn't shipped.

### The four claims we are proving

| #      | Claim (vs. legacy PM tools)                                                                                                                  | Proof artifact                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | Agents **operate**, humans govern — agents run multi-step missions, not assist with forms                                                    | Live Mission Graph + Decision Queue with real approval gates firing                                                                                                  |
| **C2** | **Agent-to-agent handoff is first-class** — no human in the routing path                                                                     | A2A trace: Discovery → Strategist → Planner, each reading prior agent's structured output, with full lineage                                                         |
| **C3** | The **whole lifecycle is one governed loop** — Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn (re-feeds Discover) | One continuous mission from a real signal to a re-scored opportunity, passing through a real PR, real merge, real deploy, real outbound message, real inbound ticket |
| **C4** | **Trust is earned and visible** — autonomy is dialed, not assumed                                                                            | Trust Score + Autonomy Dial per agent, changing behavior of approval gates in real time                                                                              |

### Realism rule (so "full lifecycle" doesn't become "half-baked everywhere")

For each lifecycle stage, the demo bar is: a real artifact lands in a real external system that a PM would actually use, driven by an agent through a real integration. No mocks. No "click here and pretend it deployed."

| Stage    | Real external system                                            | Real artifact                                                       | What the agent owns                                                 | What we do NOT build                      |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| Discover | Cadence DB (own signals: feedback, issues, session-decisions)   | Themes + scored opportunities                                       | Discovery agent: ingest, cluster, score                             | New signal connectors beyond what 0.x has |
| Define   | Cadence DB (PRD doc, tiptap)                                    | Versioned PRD with lineage to opportunities                         | Strategist agent: draft + iterate                                   | A new doc editor                          |
| Plan     | Cadence DB + GitHub Issues                                      | Sprint plan + real issues in GitHub                                 | Strategist proposes; Orchestrator writes via GitHub MCP on approval | Replacing Linear/Jira                     |
| Build    | GitHub PR                                                       | A real PR on the Cadence repo for one planned task                  | Builder agent: scoped diff + PR via GitHub MCP                      | A custom autonomous IDE (Cursor/Devin)    |
| Test     | GitHub Actions (existing CI)                                    | CI run on the PR; agent reads results                               | Builder: watch CI, surface failures, propose fix                    | A new test runner                         |
| Ship     | GitHub merge + existing deploy webhook                          | Merged PR + deploy event recorded                                   | Builder (with approval gate): merge; Cadence ingests deploy webhook | A new deploy pipeline                     |
| Launch   | Markdown changelog + one outbound channel (email/Slack via MCP) | Real changelog + a real draft message in the channel                | Growth agent: draft on ship; send on approval                       | A marketing automation tool               |
| Support  | One real inbound channel (email forward / webhook)              | Tickets ingested, triaged, routed back as signals                   | Support agent: triage + link to PRD/opportunity                     | A full helpdesk (Zendesk)                 |
| Learn    | Cadence DB                                                      | Outcome attached to opportunity → re-scored → re-ranked next sprint | Analyst agent: measure, insight memo, feed Trust Score              | A full analytics product                  |

### The 12 capability bundles + proof bars

Each bundle composes existing backlog IDs; nothing here is a parallel scope. Bundles are ordered by the dependency chain, not priority.

| #      | Bundle                                                                                                                                     | Proof bar (what makes the claim true)                                                                                                                                                                                                                                                                                                                    | Backlog IDs                                                             | Supports   | Status                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- | ---------------------------- |
| 1      | **Governed Foundation** — tenancy, AI chokepoint, trust tables, blast-radius, kill-switch + spend caps, injection defense, durable runtime | Killing an agent mid-mission halts spend within 1 tick; every action has an audit-log row queryable from the UI.                                                                                                                                                                                                                                         | 0.1, 0.2, 0.3, 0.5, **0.6** ✅, **0.7** ✅, 0.9, A1/A2                  | C1, C4     | ◑ (0.6 + 0.7 done; 0.9 next) |
| 2      | **Strategic Briefing surface**                                                                                                             | Changing the brief visibly changes the next Discovery + Strategist output (not just stored).                                                                                                                                                                                                                                                             | C5 (new) ✅                                                             | C1, C3     | ☑                            |
| 3      | **Agent Roster + Trust Score + Autonomy Dial**                                                                                             | Dialing autonomy from Observing → Trusted removes a specific approval gate; Trust Score moves based on real outcomes (eval pass-rate, approval-acceptance, mission success).                                                                                                                                                                             | C1, C2, C3, C4, **C6** (new)                                            | C1, C4     | ☐                            |
| 4 ⭐   | **Agent-to-Agent comms + handoff + sub-agent spawning**                                                                                    | One mission with **≥3 hops** between agents, each reading prior agent's **structured** output via the orchestration layer (not prompt-stuffing), full trace replayable.                                                                                                                                                                                  | E1, E2, E3, E4, E5                                                      | C2         | ☐                            |
| 5      | **Live Mission Graph**                                                                                                                     | The graph updates in real time as agents act; clicking a node opens that agent's trace + cost + tokens + approval state.                                                                                                                                                                                                                                 | E6, X1                                                                  | C1, C2     | ☑                            |
| 6      | **Lifecycle slice — Discover → Define → Plan on real data**                                                                                | Real signals → real PRD → real sprint plan → one approval-gated item → on approval, **real GitHub issue created via MCP**. End-to-end, no human routing.                                                                                                                                                                                                 | F1, F2, F3, G1, H1 + **N1** (new, GitHub-issues sync)                   | C3         | ◑ (legacy parts reusable)    |
| 7      | **Decision Queue + approval gates UX**                                                                                                     | Every gate the agents hit lands in the queue with context (what, why, cost-if-approved, who proposed); approve/reject changes downstream agent behavior.                                                                                                                                                                                                 | D3, P-approvals                                                         | C1, C4     | ◑ (reusable)                 |
| 8      | **Product Memory + lineage + full data export**                                                                                            | Every artifact (signal → theme → opportunity → PRD → decision) has lineage backward to its source; "Export everything" produces a complete, re-importable archive.                                                                                                                                                                                       | O1, O2, U6 (new)                                                        | C3         | ☐                            |
| **9**  | **Build + Test bundle** — Builder agent + scoped PR + CI read + parallel-safe conflict guard                                               | Builder opens a **real PR** on the connected repo for one planned task; reads CI status; on red proposes a one-file fix commit; two missions can't race on the same file. All gated by approval mode. **Shipped 2026-06-04 (Slice 1) + 2026-06-06 (Slices 2 + 3).** Per-feature doc: [`./features/bundle-9-builder.md`](../features/bundle-9-builder.md). | **I-thin (S4)**, **J-thin (S5)** + GitHub MCP write scope               | C2, C3     | ✅                           |
| **10** | **Ship bundle** — approval-gated merge + deploy webhook ingest                                                                             | Operator approves merge → real merge → existing deploy webhook lands → Ship node lights up on Mission Graph with deploy URL + commit SHA.                                                                                                                                                                                                                | **K-thin (S6)** + deploy webhook ingest                                 | C1, C3     | ☐                            |
| **11** | **Launch bundle** — changelog + one outbound channel                                                                                       | Growth agent drafts changelog + outbound message on ship; operator approves; message is **really sent** to one real channel (Slack or email).                                                                                                                                                                                                            | **L-thin** (changelog + one outbound integration)                       | C3         | ☐                            |
| **12** | **Support → Learn loop** — one inbound channel + Analyst learn loop                                                                        | Real ticket arrives via one channel → Support agent triages and links to source PRD/opportunity → Analyst attaches outcome and re-scores → next Discovery cycle reflects it. **The loop closes.**                                                                                                                                                        | **M-thin** (one inbound channel) + **Z1** (Analyst learn loop) on O1/O2 | C2, C3, C4 | ☐                            |

### Build sequence (Proof Platform v1.1)

1. **Finish foundation gaps** — **0.9 FND-RUNTIME** (long missions must survive worker restarts before handoff is meaningful) → **0.2 cache stage**. _(Matches existing Build-order rollup step 1.)_
2. **C5 Strategic Briefing** — small, high-leverage; gives the swarm shared operating context.
3. **C1/C4 + C6 skeleton** — roster UI + read-only Trust Score; scoring math can come later.
4. **E1–E5** — the A2A primitives (protocol + tables + tracing). Hardest bundle; budget the most time here. **This is where C2 becomes true.**
5. **E6 Mission Graph** — the visualization on top of #4. Without #4 it's a fake screenshot.
6. **Bundle 6: Discover→Define→Plan slice + N1 GitHub-issues sync** — Plan stage writes real GitHub issues on approval.
7. **Bundle 9: Build + Test (I-thin, J-thin)** — Builder opens a real, scoped PR on the Cadence repo and reads CI.
8. **Bundle 10: Ship (K-thin)** — approval-gated merge + deploy webhook ingest into Mission Graph.
9. **Bundle 11: Launch (L-thin)** — changelog + one outbound channel (Slack or email) with send-gate.
10. **Bundle 12: Support → Learn (M-thin + Z1)** — one inbound channel + Analyst outcome/re-score. **The full lifecycle loop closes here.**
11. **D3 polish** — make it the obvious "govern here" surface.
12. **O1/O2 lineage view + U6 Export** — anti-lock-in proof.

### Real-data seeding (default: Cadence-on-Cadence)

Bundles 6, 9, 10, 11, and 12 all run on real product data. **Default seed = Cadence itself** (we run our own roadmap on Cadence: real signals from this repo's issues, decisions, session-decisions log, feature-backlog; real PRs on this repo; real deploys; one outbound channel; one inbound support address). Most credible YC story ("we eat our own dog food") and no design-partner dependency. If a design partner is signed later, their product becomes an additional seed — not a replacement.

**Repo-write decision (Bundle 9):** Builder agent opens PRs on the **Cadence repo itself** (option (a) from the plan). Requires a `GITHUB_TOKEN` runtime secret with `repo` scope; branch protection on `main` enforces that no agent can bypass review. To be added when Bundle 9 starts — not now.

### Demo narrative (one continuous mission, ~3 minutes)

> Operator updates the Strategic Briefing. Discovery ingests Cadence's own signals and surfaces a re-ranked opportunity. Strategist drafts a PRD via A2A handoff. Planner proposes a sprint; one item is high-blast-radius → lands in Decision Queue. Operator approves. Orchestrator writes a **real GitHub issue**. Builder opens a **real PR** on the Cadence repo, watches CI. CI passes. Merge gate fires → operator approves → **real merge** → **real deploy webhook** lands → Ship node lights up on Mission Graph. Growth drafts a **real changelog + outbound message**; operator approves; message **really sends**. Two days later, a **real support ticket** lands; Support agent triages and links it back to the same opportunity; Analyst attaches the outcome, re-scores the opportunity, writes the insight memo. The next Discovery cycle reflects the learning. Operator opens Product Memory → sees full lineage from ticket → opportunity → PRD → PR → deploy → ticket. Clicks Export.

Every step in that paragraph is real behavior on real systems, not a slide.

### Explicitly deferred (NOT in v1.1, NOT removed from the product)

External-facing **MCP / A2A interop** (Q — Cadence exposing its agents to outside callers), advanced eval / drift / guardrail UIs beyond what the chokepoint already does, multi-product portfolio view (B3), BYO keys UI polish (A5), billing UI, full autonomous coding/IDE depth (we orchestrate GitHub via MCP; we do NOT replace Cursor/Devin), full helpdesk depth (one inbound channel only), marketing-automation depth (one outbound channel only), analytics dashboards (Learn is a re-score + insight memo). Positioning: _"agentic orchestration of the existing stack; each integration deepens over time."_

### New features this overlay adds to the backlog

These need feature entries written in full when their bundle becomes the next-up task. Stubbed here so the IDs are reserved:

- **C5 — Strategic Briefing surface** `[new]` · `P0` · `X1` — Single doc per product: north star, current goals, hard constraints, working agreements. Every agent loads it as system context. Versioned; changes propagate to in-flight missions on next step.
- **C6 — Agent Trust Score + Autonomy Dial** `[new]` · `P0` · `X1` — Per-agent score derived from eval pass-rate, approval-acceptance-rate, mission success-rate. Operator can move each agent along the trust arc (Observing → Proving → Trusted → Ambient) and the dial changes the default approval mode.
- **U6 — Full data portability / export** `[new]` · `P0` · `U` — Export signals, themes, opportunities, PRDs (markdown), decisions+lineage (JSON), agent configs (YAML), and the product-memory graph (JSON). One-click per product; scheduled exports later.
- **N1 — GitHub Issues sync (write)** `[new]` · `P0` · `H` — On approval of a sprint plan item, Orchestrator creates a real GitHub issue via GitHub MCP with title/body/labels and back-links to the PRD + opportunity. Bidirectional status sync read-only at first.
- **I-thin — Builder agent (scoped PR)** `[new]` · `P0` · `I` — Thin slice of S4: Builder picks one planned task, produces a small scoped diff, opens a real PR on the Cadence repo via GitHub MCP. Blast-radius `high`; default approval mode `confirm`. NOT an autonomous IDE — scoped diffs only.
- **J-thin — CI-read for Builder** `[new]` · `P0` · `J` — Thin slice of S5: Builder reads GitHub Actions status on its open PR, surfaces failures, proposes a fix as a follow-up commit. No custom test runner.
- **K-thin — Merge gate + deploy webhook ingest** `[new]` · `P0` · `K` — Thin slice of S6: approval-gated merge via GitHub MCP; `/api/public/hooks/deploy` ingests deploy events from the existing platform (Cloudflare/Vercel) and posts a Ship node to the Mission Graph with deploy URL + commit SHA.
- **L-thin — Changelog + one outbound channel** `[new]` · `P0` · `L` — On ship event, Growth agent drafts a markdown changelog entry + a single outbound message (Slack OR email, one channel only for v1.1). Send is approval-gated. Real send via MCP/connector, no mocks.
- **M-thin — One inbound support channel** `[new]` · `P0` · `M` — Single inbound channel (email forward or webhook) ingests tickets into `signals` with `source='support'`. Support agent triages and links each ticket to a PRD or opportunity if matched.
- **Z1 — Analyst learn loop** `[new]` · `P0` · `O` — Analyst agent attaches a measured outcome to each shipped opportunity, re-scores it (ICE re-rank), writes a short insight memo, and feeds the result into Trust Score inputs. Closes the lifecycle loop back into Discover.

---

## How to read an entry

```text
ID. Feature name                         [status] · Pn · stage
   What     — one sentence: what it is.
   Build    — the granular sub-features (the actual checklist).
   States   — loading/empty/error/edge cases that must be handled.
   Done when— acceptance signal(s) that mark it shippable.
   Depends  — prerequisite IDs.
```

**Status** (from `plan.md` §2): `[reuse]` legacy survives largely as-is · `[extend]` legacy base + new work · `[new]` build from scratch · `[found]` foundation/non-functional (architecture, not a screen).

**Priority** (from `considerations.md` precedence, P0 highest): `P0` credible first user / built into foundation now · `P1` before/at first enterprise sale · `P2` scale & maturity.

**Stage**: lifecycle `S1`–`S9` (Discover→Learn) · platform `X1`–`X6` · `FND` foundation · `NFR` cross-cutting non-functional.

**Legend for the rollup tables:** ☐ not started · ◑ partial (legacy exists, needs hardening) · ☑ done & verified into the active build log.

---

## The 8 Cockpit Pillars Mapping

This feature backlog is organized under the **8 Cockpit Pillars** representing the end-to-end product lifecycle for a B2B Enterprise team. The 24 developer epics map directly into these pillars:

| Pillar                                     | Focus                    | Included Epics & Feature Scopes                                                        | Stable ID Ranges                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pillar 1: Signal & Discovery**           | "Perplexity for PMs"     | Signal Capture (S1), opportunity clustering, Product Memory, continuous discovery feed | EPIC F (Discover), EPIC O (Product Memory), EPIC N (Learn)                                                                                                                                          |
| **Pillar 2: Speech & Meeting Intake**      | "WhisperFlow for PMs"    | Audio sync and meeting transcription, spec/ticket extraction                           | EPIC S2 (Audio Sync), `F-AUDIO-*`                                                                                                                                                                   |
| **Pillar 3: Conversational Swarm Command** | "ChatGPT/Claude for PMs" | Swarm steering, natural language intent routing, execution loops                       | EPIC D (Agent Execution), `F-CHAT-NL-INTENT`                                                                                                                                                        |
| **Pillar 4: Spec & Plan**                  | "Jira/Linear for PMs"    | PRD writing, roadmapping, sprint planning, Linear/Jira connectors                      | EPIC G (Define), EPIC H (Plan)                                                                                                                                                                      |
| **Pillar 5: Design & Scaffolding**         | "Lovable for PMs"        | UI mockups, visual sandbox, design tokens, style audits                                | EPIC I (Build - Studio/Sandbox portions)                                                                                                                                                            |
| **Pillar 6: Build & QA**                   | "Cursor for PMs"         | Autonomous code writing, CI status loop, test generation, test runners                 | EPIC J (Test), EPIC I (Build - code generation portions)                                                                                                                                            |
| **Pillar 7: Release & Support**            | The Closed Loop          | Ship approvals, deploy webhook tracking, GTM changelogs, Support triage                | EPIC K (Ship), EPIC L (Launch), EPIC M (Support), EPIC N (Learn delta), `F-ANALYTICS-*`                                                                                                             |
| **Pillar 8: Cockpit & Observability**      | "Miro for PMs"           | Swarm HUD, live DAGs, budget telemetry, governance gates, workspaces, auth, interop    | EPIC 0 (Foundation), EPIC A (Identity), EPIC B (Workspaces), EPIC C (Agents config), EPIC E (Coordination), EPIC P (Observability), EPIC Q (Interop), EPIC R (Platform), EPICS S-X (Non-Functional) |

---

---

## Pillar 1: Signal & Discovery ("Perplexity for PMs")

_Focus: Signal Capture (S1), opportunity clustering, Product Memory, continuous discovery feed._

#### EPIC F — Discover `S1` _(first end-to-end slice)_

**F1 — Signal ingest** `[extend]` · `P0` · `S1`

- Build: paste + CSV now (chunked inserts, params cap fixed); sentiment on insert; source typing (support/churn/usage/sales/reviews/NPS/interviews); injection-screened on ingest (0.7); connectors next (R2).
- States: huge CSV (chunking); malformed rows; duplicate signals.
- Done when: pasted + CSV signals land scoped, sentiment-tagged, injection-screened.
- Depends: 0.1, 0.7.

**F2 — Clustering → themes → opportunities** `[reuse]` · `P0` · `S1`

- Build: embed + cluster (k-medoid) + synthesize with `evidence_ids[]`; ICE scoring; dedupe by similarity; known limit: degrades past ~1000 signals/run (chunk runs).
- States: too-few signals; noisy cluster; re-run idempotency.
- Done when: signals produce themes → ICE-scored opportunities each citing evidence ids.
- Depends: F1, P (chokepoint), 0.3.

**F3 — Continuous discovery feed** `[extend]` · `P0` · `S1`

- Build: always-fresh per-product feed; incremental synthesis (not one-shot); new-signal → re-cluster delta; feed UI with filters.
- States: empty feed; high-velocity inflow; stale-fact flag (O).
- Done when: new signals update the feed without a full recompute. _This is the lead use case._
- Depends: F2.

---

#### EPIC N — Learn `S9`

**N1 — Decisions + `supersedes`** `[reuse]` · `P0` · `S9`

- Build: outcomes write `decisions` with `supersedes` lineage; decision timeline (Mission Control widget).
- Done when: a decision supersedes a prior one and the lineage renders as soft arrows.
- Depends: 0.3, O1.

**N2 — Re-score + insight memo + daily brief** `[extend]` · `P1` · `S9`

- Build: outcomes re-rank opportunities; insight memo; daily brief surfaced in Today's Focus.
- States: no outcomes yet (empty brief copy); conflicting outcomes.
- Done when: an outcome re-scores its opportunity and the brief reflects it.
- Depends: F2, N1.

---

#### EPIC O — Product Memory `X4`

**O1 — Knowledge graph + query** `[new]` · `P1` · `X4`

- Build: typed nodes/edges — signals → themes → opportunities → decisions → experiments → outcomes — with `supersedes`; queryable; "why is this on the roadmap?" answerable with cited evidence.
- Done when: a roadmap item resolves to its evidence chain via one query.
- Depends: F2, G1, H1, N1.

**O2 — RAG retrieval (citations)** `[reuse]` · `P0` · `X4`

- Build: pgvector hybrid retrieval (512/64 chunks, 1536-d); citation ids returned; salted cache; chunker boundary handling.
- Done when: retrieved chunks produce `[1][2]` citations in the AI-message contract.
- Depends: 0.2, 5b (pgvector).

**O3 — Currency / drift on facts + skill packs** `[new]` · `P2` · `X4`

- Build: flag stale facts; export versioned skill bundles over MCP.
- Depends: O1, Q1.

---

---

## Pillar 2: Speech & Meeting Intake ("WhisperFlow for PMs")

_Focus: Audio sync and meeting transcription, spec/ticket extraction._

### Placeholder Features (WhisperFlow for PMs)

**F-AUDIO-1 — Speech transcription & chunking** `[new]` · `P1` · `S2`

- Build: upload meeting/voice audio → Whisper API transcribe → segment diarization → chunk transcripts.
- States: background upload fails; noisy audio; long transcripts.
- Done when: audio file upload yields formatted speaker-labelled transcripts with timestamps.
- Depends: 0.1, 0.2.

**F-AUDIO-2 — Action item & ticket extraction** `[new]` · `P1` · `S2`

- Build: process transcript → extract action items, requirements, and user pain points → draft opportunities or PRD suggestions citing transcripts.
- States: ambiguous context; hallucinated action items.
- Done when: transcribed meeting automatically generates draft tickets / opportunities in the discovery feed.
- Depends: F-AUDIO-1, F2.

---

## Pillar 3: Conversational Swarm Command ("ChatGPT/Claude for PMs")

_Focus: Swarm steering, natural language intent routing, execution loops._

#### EPIC D — Agent execution `X1`

**D1 — Run on-demand / scheduled** `[reuse]` · `P0` · `X1`

- Build: manual trigger + cron fan-out via `/api/public/hooks/*`; idempotent ticks.
- Depends: 0.9, C3.

**D2 — Planner/executor loop** `[reuse]` · `P0` · `X1`

- Build: plan → tool calls → observe → reflect → answer; max-step + max-cost caps; loop/runaway detection.
- States: step cap hit → stop + escalate; runaway detected → halt.
- Done when: a capped loop terminates and records partial trace.
- Depends: 0.2, 0.6.

**D3 — Approval gates + Decision Queue** `[reuse]` · `P0` · `X1`

- Build: `auto|confirm|review` per run; queue of `awaiting_review` runs with summary + proposed action; approve/reject; one-click resume from checkpoint.
- States: approve → resume; reject → record + stop; timeout policy.
- Done when: a `confirm` action pauses, appears in the queue, and resumes on approve. See `design.md` DecisionQueue card.
- Depends: D2, P (trace).

**D4 — Cancellation / replay-and-branch / checkpoints** `[reuse]` · `P1` · `X1`

- Build: stop mid-run saving partial; checkpoint persistence; re-run against a different model/prompt; show the diff (ties AI-message "Replay with…").
- Depends: D2, 0.9.

---

---

## Pillar 4: Spec & Plan ("Jira/Linear for PMs")

_Focus: PRD writing, roadmapping, sprint planning, Linear/Jira connectors._

#### EPIC G — Define `S2`

**G1 — PRD/spec generation** `[reuse]` · `P0` · `S2`

- Build: opportunity → structured cited draft (acceptance criteria, non-goals, risks, success metrics auto-drafted); retrieval-grounded with citation ids.
- States: low-evidence opportunity (warn); regeneration vs. edit conflict.
- Done when: an opportunity yields a cited PRD a human can edit + approve.
- Depends: F2, O (RAG), P.

**G2 — Doc editor + `/ai` + versions/diff** `[reuse]` · `P0` · `S2`

- Build: Tiptap editor; inline `/ai` slash menu; 1.5s autosave to `prd_versions`; version diff; citation pills; side-anchored comments.
- States: autosave conflict; offline edit; long doc.
- Done when: edits autosave + version; `/ai` edits inline with citations; diff renders. See `design.md` DocEditor.
- Depends: G1.

---

#### EPIC H — Plan `S3`

**H1 — Task graph** ✅ 2026-06-14 · `[reuse]` · `P0` · `S3`

- Build: spec → dependency-aware tasks with estimates/owners/risk flags; cycle detection; acceptance criteria per task (eng-lead need).
- States: cyclic dependency; orphan task; unestimated task.
- Done when: a PRD generates a valid dependency-ordered task graph agents can execute.
- Depends: G1.

**H2 — Outcome roadmap (Now/Next/Later)** `[extend]` · `P1` · `S3`

- Build: `@dnd-kit` board; each item declares the outcome it pursues + how it's measured; drag reorder; link to tasks/opportunities.
- States: empty lane; large board; drag on touch.
- Done when: every roadmap item ties to a measurable outcome (anti-feature-factory).
- Depends: H1.

**H3 — Scheduling** `[reuse]` · `P1` · `S3`

- Build: agent proposes work blocks within profile working hours; calendar-aware (R2 Calendar).
- Depends: A4, H1.

---

---

## Pillar 5: Design & Scaffolding ("Lovable for PMs")

_Focus: UI mockups, visual sandbox, design tokens, style audits._

#### EPIC I — Build (autonomous) `S4` _(the differentiator)_

**I1 — Studio multi-file coding** `[extend]` · `P1` · `S4`

- Build: three-pane Studio; virtual `studio_files`; JSON edit-plan multi-file edits; per-hunk accept/reject; atomic `studio_revisions`; known limit: truncates files >2k lines (chunk).
- States: large file; conflicting hunks; failed apply rollback.
- Done when: an agent edits across files with per-hunk review and atomic commit.
- Depends: 0.10 (sandbox), D2.

**I2 — Watch-the-agents-build surface** `[new]` · `P1` · `S4`

- Build: live per-session view — current step, files touched, tool calls, cost, status; pause/steer/approve mid-run; streaming.
- States: many concurrent sessions; paused; errored step.
- Done when: a building agent's steps/files/cost stream live and can be paused. See README capability surface + `design.md`.
- Depends: E6, I1, P.

**I3 — Branch/worktree isolation per mission** `[new]` · `P1` · `S4`

- Build: each mission on its own branch/worktree; isolation; merge path to Ship.
- States: branch conflict; abandoned branch cleanup.
- Depends: 0.12, K1.

---

---

## Pillar 6: Build & QA ("Cursor for PMs")

_Focus: Autonomous code writing, CI status loop, test generation, test runners._

#### EPIC J — Test (autonomous) `S5`

**J1 — Test generation + run** `[new]` · `P1` · `S5`

- Build: agents author + run unit/integration/E2E + evals; runner wiring (note: no test runner configured yet — see CLAUDE.md); results persisted.
- States: flaky test; timeout; environment missing.
- Done when: the QA agent generates and runs tests producing a pass/fail gate signal.
- Depends: I1, 0.12.

**J2 — QA gate + self-correct loop** `[new]` · `P1` · `S5`

- Build: failing tests feed back to the build agent until green or escalate; regression gate (≥10-point eval regression on the 0–100 scale blocks without override — KI-14); ties "Cadence core" eval suite (P5).
- States: infinite-correct guard (cap); unrecoverable → escalate to Decision Queue.
- Done when: a failing suite loops the Engineer until green or escalates; a regression blocks Ship.
- Depends: J1, P5, D3.

---

---

## Pillar 7: Release & Support (The Closed Loop)

_Focus: Ship approvals, deploy webhook tracking, GTM changelogs, Support triage._

#### EPIC K — Ship `S6`

**K1 — PR / deploy / release notes** `[new]` · `P1` · `S6`

- Build: open PRs; run deploy checklist; deploy; draft release notes — all behind approval gates; respect branch protection + CI gates.
- States: CI red → block; deploy failure → rollback; approval rejected.
- Done when: an approved mission opens a PR, passes gates, deploys, and drafts notes.
- Depends: 0.12, I3, D3, 0.10.

**K2 — Rollback triggers** `[new]` · `P1` · `S6`

- Build: documented rollback per release; automated revert path; feature-flag kill (W?).
- Done when: a release can be reverted from the UI within one action.
- Depends: K1, 0.12.

---

#### EPIC L — Launch / GTM / price `S7`

**L1 — Launch + positioning + pricing + distribution drafts** `[new]` · `P2` · `S7`

- Build: agent-drafted launch assets, positioning, pricing pages, distribution plans; human-approved before anything external.
- States: nothing external sends without approval (governance gate).
- Done when: an agent produces a launch package that requires approval to publish.
- Depends: G/H/N (context), D3, Q (publish targets).

**L2 — Customer-facing pages / announcements** `[new]` · `P2` · `S7`

- Build: generate public pages (`p.$slug`) + announcement copy; preview; approval to publish.
- Depends: L1.

---

#### EPIC M — Operate / support `S8`

**M1 — Ticket triage + draft answers + route/escalate** `[new]` · `P2` · `S8`

- Build: agents triage inbound tickets, draft answers, route, escalate; support themes flow back into Discover (closes the loop into F1).
- States: low-confidence → escalate; PII handling (U5).
- Done when: a ticket is triaged + draft-answered and its theme appears as a new signal.
- Depends: F1, 0.7, Q.

---

### Placeholder Features (Cohort Metrics & Loop Evaluation)

**F-ANALYTICS-1 — Cohort metrics & telemetry ingestion** `[new]` · `P1` · `S8`

- Build: ingest cohort usage data (daily active users, retention, key actions) → store in `product_analytics` → link to launched features.
- States: ingestion bottleneck; missing event mappings.
- Done when: product analytics dashboards show cohort retention curves correlated with specific feature release tags.
- Depends: 0.1, 0.2.

**F-ANALYTICS-2 — Opportunity impact evaluation** `[new]` · `P1` · `S9`

- Build: analyze post-release cohort performance → feed results back into Strategist and Product Memory → auto-update ICE scores for related opportunities.
- States: low sample size (warn); conflicting signals.
- Done when: system evaluates release outcomes and re-evaluates strategic priorities based on real usage.
- Depends: F-ANALYTICS-1, EPIC O.

---

## Pillar 8: Cockpit & Observability ("Miro for PMs")

_Focus: Swarm HUD, live DAGs, budget telemetry, governance gates, workspaces, auth, interop._

#### EPIC 0 — Foundation, tenancy & runtime `FND`

_The base every later stage is an addition to, not a rewrite of. Build order step 1._

**0.1 — Three-key tenancy + RLS** `[extend]` · `P0` · `FND`

- What: enforce `user_id` + `workspace_id` + `product_id` scoping on every table and RLS policy.
- Build: add `product_id` to all product-scoped tables; RLS policies for select/insert/update/delete keyed on all three; tenancy helper in server fns; deny-by-default policies; tenancy assertion in the chokepoint and orchestrator.
- States: missing-context request rejected (no silent cross-tenant read); workspace-with-no-product; product archived.
- Done when: an integration test proves a row created under (W1,P1) is invisible to (W1,P2) and (W2,\*) at the DB layer.
- Depends: A2 (session), B2 (product entity).

**0.2 — AI chokepoint pipeline** `[reuse]` · `P0` · `FND`

- What: the single path every model call takes (`src/lib/ai/runtime.server.ts`).
- Build: ordered stages — `budget → cache → pre-guard → retrieve(RAG) → PROVIDER → post-guard → persist(trace) → async eval → fallback`; one `ai_events` row + trace span per call; cache key salted by tenant (no cross-user poisoning); cache hit logs cost `$0.0000` explicitly.
- States: budget exceeded → throw before provider; cache hit → short-circuit but still log; guardrail block → abort + log; provider error → fallback chain.
- Done when: a call produces exactly one event + trace; budget throw fires before any provider spend; guardrail block aborts and is logged.
- Depends: 0.1, P1, P2.

**0.3 — Trust-stack tables** `[reuse]` · `P0` · `FND`

- What: the telemetry/governance schema the chokepoint writes to.
- Build: `ai_events`, `ai_traces`, `ai_evals`, `ai_feedback`, prompt-version tables, guardrail-rule tables, budget tables — all 3-key scoped, all with `parent_event_id` for trace nesting.
- Done when: schema migrations applied; chokepoint writes resolve; trace nesting renders in the viewer (P4).
- Depends: 0.1.

**0.4 — Design tokens & system** `[reuse]` · `P0` · `FND`

- What: OKLCH token system in `src/styles.css`; components consume tokens only.
- Build: semantic colors, gradients, shadows, `--surface-*` palette, type ramp, motion tokens, radii; `prefers-reduced-motion` hook; dark-first theme; lint/review guard against hex literals.
- Done when: a token edit changes the surface globally; a11y spot-check passes 4.5:1; no hex literals in components.
- Depends: —. See [`../design.md`](../../design.md).

**0.5 — Agent blast-radius limits** `[new]` · `P0` · `FND/NFR`

- What: hard scope limits on what any agent run may touch.
- Build: per-agent tool allow-list enforced at the chokepoint/orchestrator; resource scope (which products/tables/external systems); deny external side-effects without an approval gate; record attempted-out-of-scope actions.
- States: out-of-scope tool call → blocked + logged + surfaced in trace; escalates to Decision Queue if `confirm`.
- Done when: an agent cannot call a tool outside its allow-list, proven by test.
- Depends: 0.2, C2, D2.

**0.6 — Per-mission spend caps + global kill-switch** `[new]` · `P0` · `FND/NFR`

- What: cost ceilings per mission/agent and a one-action pause/stop for everything.
- Build: per-mission and per-workspace cost budgets; soft-warn → hard-stop thresholds; global kill-switch that pauses all running sessions and blocks new ones; per-agent run cap.
- States: cap reached mid-mission → checkpoint + pause (not data loss); kill-switch active → new runs refused with a clear message.
- Done when: a runaway mission halts at its cap with a resumable checkpoint; kill-switch drains running work safely.
- Depends: 0.6 needs P6 (budgets), E? (orchestration checkpoints).
- **How to use / verify (2026-06-03):**
  - **Where:** sidebar → AI Ops → **Governance** (`/_authenticated/governance`). Visible to any authenticated workspace member; system-pause toggle is admin-gated.
  - **Panels:**
    1. **Kill Switch** — workspace pause (owner/admin) with required reason; system pause is read-only for non-admins. When paused, `AppShell` shows a red banner on every route.
    2. **Mission Caps** — per-mission `mission_token_cap` + `mission_spend_cap_usd` with live usage bars (`tokens_used` / `spend_used_usd` from `agent_runs`). Auto-halts the run on exceedance.
    3. **Approvals** — pending `agent_approvals` with TTL countdown (default 24h), `escalation_state`, and Approve / Reject / Extend actions.
  - **Server enforcement:** `callModel()` and `callModelStream()` in `src/lib/ai/runtime.server.ts` call `current_kill_state()` + `check_mission_caps()` before spend and throw `GovernanceHaltError`; the agent loop catches it, calls `halt_agent_run()`, and finalizes the run with `status='halted'`. Blocked attempts log `ai_events.status='blocked'` with `error_message='governance_halt:<kind>'`.
  - **Cron:** `pg_cron` hits `/api/public/hooks/approvals-tick` every minute → expires approvals past `expires_at` and flips `escalation_state`.
  - **Verification checklist:** (a) toggle workspace pause → start any mission → call is rejected with a `governance_halt:kill_switch` event; (b) set a tiny `mission_spend_cap_usd` on a run → next step halts with `governance_halt:mission_spend_cap` and the run row shows `status='halted'`; (c) leave an approval past its `expires_at` → within ~1 min it shows expired in the Approvals panel.

**0.7 — Prompt-injection defense** `[new]` · `P0` · `FND/NFR`

- What: treat all ingested/external content (signals, tickets, MCP/A2A results, web) as untrusted.
- Build: input sanitization + delimiting; instruction-isolation prompt pattern; injection classifier on ingested text; external tool-result quarantine before it can drive an action; high-risk actions require approval regardless of agent mode.
- States: detected injection → flag + strip + log; unverified external instruction never auto-executes a side-effect.
- Done when: a seeded poisoned signal cannot trigger an autonomous external action without approval.
- Depends: 0.2, F1, Q2.

**0.8 — Provider/model fallback & graceful degradation** `[new]` · `P0` · `FND/NFR`

- What: the product keeps working when a model/gateway is down or deprecated.
- Build: ordered fallback routing per surface; health checks; circuit-breaker per provider; degraded-mode UX (queue/retry, not hard-fail); model-deprecation playbook + config.
- States: primary provider 5xx/timeout → next in chain; all down → queue + friendly degraded state.
- Done when: killing the primary provider in a test still returns answers via fallback.
- Depends: 0.2, 5a (model gateway + BYO).

**0.9 — Durable runtime for long/parallel missions** `[new]` · `P0` · `FND/NFR`

- What: missions survive Cloudflare Workers execution limits.
- Build: durable job/queue model; checkpointing + resume; backpressure; idempotent ticks; long-op state in DB not memory.
- States: worker eviction mid-step → resume from last checkpoint; duplicate tick → no double effect.
- Done when: a multi-step mission survives a forced worker restart and completes.
- Depends: 0.2, E5/E6 (parallel sessions), architecture/orchestration.md.

**0.10 — Sandboxed execution + review gate for agent code** `[new]` · `P0` · `FND/NFR`

- What: agent-written code runs isolated and is reviewed before merge/deploy.
- Build: sandboxed exec environment; no ambient secrets in sandbox; mandatory human/policy review gate before merge; supply-chain allow-list for agent-installed deps.
- Done when: agent code executes without access to prod secrets; no merge without passing the review gate.
- Depends: I1 (Studio), K1 (PR/deploy), S1.

**0.11 — App monitoring, backups & DR** `[new]` · `P0/P1` · `FND/NFR`

- What: platform-level (not just AI) observability + recoverability.
- Build: uptime/error/latency monitoring + alerting; DB backups + point-in-time restore; restore drill; basic status signal.
- Done when: an induced app error alerts; a restore drill recovers to a point in time.
- Depends: 0.3 (telemetry base), T1/T5.

**0.12 — CI/CD + environments** `[new]` · `P0` · `FND/NFR`

- What: dev/staging/prod pipelines so autonomous shipping is safe.
- Build: environment separation; build/test/lint gates in CI; migration apply step; deploy + rollback path (Cloudflare Workers + Supabase).
- Done when: a PR runs gates green and deploys to staging; rollback restores the prior release.
- Depends: 0.12 underpins K (Ship).

---

#### EPIC A — Identity & access `X6`

**A1 — Sign up / onboarding** `[reuse]` · `P0` · `X6`

- What: account creation + first-run setup.
- Build: email+password + Google OAuth; create first workspace + product; capture display name, timezone, working hours; email verification on by default; sample/template seed (ties W1 onboarding).
- States: duplicate email; unverified email; OAuth cancel; partial onboarding resume.
- Done when: a new user lands in a seeded, usable workspace with a product.
- Depends: 0.1.

**A2 — Login / logout / session** `[reuse]` · `P0` · `X6`

- Build: authenticated session; sign-out-everywhere; session refresh; `Last-Event-ID` resume for SSE streams; global auth middleware on all `_authenticated.*` routes.
- States: expired token; refresh failure; stream resume after reconnect.
- Done when: streams resume after a reconnect; sign-out invalidates all sessions.
- Depends: 0.1.

**A3 — Password reset / email verification** `[reuse]` · `P0` · `X6`

- Build: reset request → email → set-new; verification link; rate-limited.
- States: expired/used token; unknown email (no enumeration leak).

**A4 — Profile & preferences** `[reuse]` · `P0` · `X6`

- Build: display name, role, timezone, working hours, default model per surface.
- Done when: greeting, scheduling windows, and model routing all read these values.
- Depends: A1.

**A5 — BYO model keys** `[reuse]` · `P0` · `X6`

- Build: add/test/rotate/delete provider keys; encrypted (pgsodium); masked display; per-provider validation ping.
- States: invalid key; rotation while a mission is mid-run; revoked key fallback to gateway.
- Done when: a BYO key is used for the chosen surface and never rendered in plaintext.
- Depends: 0.8, S4.

**A6 — Roles & membership (future)** `[new]` · `P1` · `X6`

- Build: invite flow; per-workspace roles (owner/admin/member/viewer); SSO/SAML readiness; RBAC enforcement at RLS + UI.
- Depends: 0.1, B1. (See S6.)

---

#### EPIC B — Workspaces & products `X2`

**B1 — Create / switch workspace** `[extend]` · `P0` · `X2`

- Build: workspace as top-level tenancy boundary; create/rename/switch; membership stub.
- States: last-workspace delete guard; switch persists per session.

**B2 — Create product under workspace** `[extend]` · `P0` · `X2`

- Build: product entity with vision/problem/target-users/metrics/stage; create/edit; `product_id` scoping everywhere.
- Done when: a second product under the same workspace is fully isolated (see 0.1).

**B3 — Product switcher + portfolio view** `[new]` · `P1` · `X2`

- Build: fast product switcher (⌘K + header); cross-product portfolio overview (health, activity, budgets per product).
- States: zero products; many products (search/scroll).

**B4 — Per-product isolation** `[extend]` · `P0` · `X2`

- Build: data, agents, memory, budgets, access all scoped by the three keys.
- Done when: covered by the 0.1 isolation test extended to agents/memory/budgets.

**B5 — Archive / delete product** `[new]` · `P1` · `X2`

- Build: archive (soft, reversible) + delete (hard, with export prompt); cascade rules; audit entry.
- States: delete with running missions → block or drain; archived product hidden from switcher but queryable.
- Depends: U2 (export), U1 (retention/deletion).

---

#### EPIC C — Agents (configuration) `X1`

**C1 — Agent roster** `[extend]` · `P0` · `X1`

- Build: list durable lifecycle agents + spawned sub-agents per product; status dots; last-run summary.
- Done when: the roster shows the ~10 durable agents (`plan.md` §6) + live sub-agents.

**C2 — Create / clone / configure agent** `[reuse]` · `P0` · `X1`

- Build: schema `slug, name, system_prompt, tool_allowlist[], default_model, temperature/top_p/seed, max_tokens, schedule_cron?, approval_mode(auto|confirm|review), memory_enabled`; clone from template; validation.
- States: invalid prompt/model; tool not permitted; duplicate slug.
- Done when: a configured agent runs through the chokepoint honoring its allow-list + approval mode.
- Depends: 0.5.

**C3 — Enable / disable / schedule agent** `[reuse]` · `P0` · `X1`

- Build: cron schedule with next-run preview; enable/disable; advisory-lock to prevent duplicate fan-out (legacy bug fixed).
- States: disabled mid-schedule; overlapping runs deduped.

**C4 — Agent detail + run history + memory inspector** `[reuse]` · `P1` · `X1`

- Build: last runs (status/duration/score/cost); memory inspector (shared vs private); per-agent eval coverage.
- Depends: P1, O1.

---

#### EPIC E — Agent communication, coordination & transfer `X1` _(the autonomous spine — do not defer)_

**E1 — Sub-agent spawning** `[done]` · `P1` · `X1`

- Built (MVP): any agent inside a mission spawns the next hop via `agent.handoff` → `enqueueHandoff` (inserts a `queued` `agent_runs` row + structured `agent_messages` row). Spawned runs inherit the chokepoint, the user's tool allow-list, the workspace brief, and their own autonomy arc. Lifecycle = `queued → running → completed/failed`, all rows tied to the mission via `mission_id`.
- Out (deferred): dedicated `agent.spawn` tool with fan-out semantics (folded into Bundle 5 alongside E4 polish).
- See: `docs/a2a-handoff.md`.

**E2 — Agent-to-agent (internal) messaging** `[done]` · `P1` · `X1`

- Built: `agent_messages` table — one structured payload per hop (`from/to_agent`, `kind`, `payload jsonb`, source run/trace, consumer run, `created_at` for ordering). RLS scoped to workspace members. Receiver loads its inbound message via `consumeInboundHandoff` and gets it injected as a `--- Handoff from {agent} ---` block in its system prompt. Receiver never sees a pasted prompt — only a typed JSON payload.
- Out (deferred): loop-guard / message-cap is currently implicit (mission scope + sweeper backpressure). Explicit per-mission message cap is a Bundle 5 polish item.

**E3 — Agent transfer / handoff** `[done]` · `P1` · `X1`

- Built: `missions` table groups every hop. `agent.handoff` tool (write/confirm) takes `to_agent_slug + task + context + artifacts + open_questions + constraints` and enqueues the receiver as a new `agent_runs` row with the same `mission_id`. Receiver inherits brief + structured handoff block; references artifacts by ID and re-reads them with its own tools (no game-of-telephone summarization). Done-when met: a Planner→Engineer→QA chain runs with each stage's first system prompt carrying the prior stage's structured payload.
- See: `docs/a2a-handoff.md` "Why structured payloads".

**E4 — Parallel sub-agents** `[done — schema; UI deferred]` · `P1` · `X1`

- Built: schema supports parallel hops on a single mission — no serial constraint on `agent_messages`, no FK preventing two queued runs sharing a `mission_id`. The resume-runs sweeper promotes them subject to per-workspace concurrency cap (5).
- Out (deferred): a fan-out tool (`agent.spawn` returning N message ids) + merge-result step in the parent agent. Both fold cleanly into Bundle 5.

**E5 — Parallel agent sessions** `[done]` · `P1` · `X1`

- Built: two missions in the same workspace run concurrently up to the FND-RUNTIME 0.9 backpressure cap (`MAX_RUNNING_PER_WORKSPACE = 5`). Above that, additional missions sit `queued` and are promoted by the sweeper. Per-mission isolation is enforced by `mission_id` on `agent_runs` + `agent_messages` and by RLS scoping to `workspace_members`. No cross-bleed possible — each run loads only its own inbound handoff and writes only to its own mission.

**E6 — Orchestration / mission graph view** `[done]` · `P1` · `X1`

- Built (2026-06-04): live DAG on `/missions/$id` via `src/components/cadence/MissionGraph.tsx`. Pure-SVG, no external graph lib. Nodes = `agent_runs` rows; edges = `agent_messages` (`source_run_id → consumed_by_run_id`, fallback to next hop matching `to_agent_slug` while in flight). Layout = BFS-depth columns × chronological rows; fan-out renders as parallel rows in the child column. Status color + glyph mirror the hop card; click = expand+scroll target hop; keyboard accessible. Re-uses the existing 2s refetch loop while mission `status='running'`.
- How to use / verify: dispatch any mission from `/agents` with "Start as mission" → open `/missions/{id}` → Mission graph card sits above the Agent timeline. Single-agent mission ⇒ 1 node, 0 edges. Multi-hop ⇒ N nodes + labelled handoff edges, updating live. Click a node ⇒ matching hop card expands + scrolls into view; per-hop `/traces/$traceId` link still works.
- Deferred to later: pause/steer-from-graph controls, zoom/collapse for very large graphs (>20 nodes), per-node cost/token rollup pill (data available once we surface it in `getMission`).
- Depends: E1–E5, P.

**E7 — Shared vs. private memory** `[extend]` · `P1` · `X1`

- Build: mission-shared context + per-agent long-term memory with importance decay; access rules (no leakage across missions/products).
- Depends: O1, 0.1.

---

#### EPIC P — Trust & observability `X3`

**P1 — Telemetry + traces + judge scores** `[reuse]` · `P0` · `X3`

- Build: per-call `ai_events`; trace waterfall (`/traces/$traceId`, one row per span, depth from `parent_event_id`, surface color-coding); LLM-as-judge composite (groundedness/relevance/coherence/hallucination); recursion blow-up fixed.
- Done when: every AI call is inspectable end-to-end in the trace viewer with a judge score.
- Depends: 0.2, 0.3.

**P2 — Guardrails (input + output)** `[reuse]` · `P0` · `X3`

- Build: rule kinds for pre- and post-guard; block aborts + logs; per-rule unit tests; injection rules tie 0.7.
- Done when: a blocking rule aborts a call and is visible in the trace.

**P3 — Prompt studio (versioning + A/B)** `[reuse]` · `P1` · `X3`

- Build: versioned prompts; A/B assignment; pin per agent/surface; rollback.
- Depends: 0.3.

**P4 — Eval harness + regression gate** `[reuse]` · `P1` · `X3`

- Build: "Cadence core" eval suite; per-surface/agent coverage targets; ≥10-point regression (0–100 scale — KI-14) blocks deploy without override.
- Done when: a regression blocks Ship (ties J2/K1).

**P5 — Drift watch** `[reuse]` · `P1` · `X3`

- Build: monitor score/cost/latency drift per surface/model; alert on threshold.

**P6 — Budgets** `[reuse]` · `P0` · `X3`

- Build: daily/monthly caps per workspace/product/mission; BudgetBar (today vs cap, month vs cap; muted→accent→destructive; per-surface popover); breach is friendly (not a crash).
- Done when: a breach degrades gracefully and the BudgetBar reflects burn. See `design.md` BudgetBar.
- Depends: 0.6, V1.

**P7 — Incidents log** `[reuse]` · `P1` · `X3`

- Build: record safety/guardrail/cost incidents; link to traces; resolution notes.

**P8 — AI message UI contract** `[reuse]` · `P0` · `X3`

- Build: one shared component rendering score/model+via/latency/tokens/cost/citations/feedback/view-trace/replay on every AI message; cache hit shows `$0.0000`; no citations box when `retrieval=false`.
- Done when: every AI surface (chat, copilot, PRD `/ai`, Studio, agent summaries, brief) uses the one contract component. Non-negotiable per `design.md` + `AGENTS.md` rule 9.
- Depends: P1, O2.

---

#### EPIC Q — Interop (agent-native) `X5`

**Q1 — MCP server + client** `[new]` · `P2` · `X5`

- Build: expose Cadence capabilities as MCP tools (server); consume external MCP tools (client); capability scopes; rate limits; audit.
- States: untrusted tool result → quarantine (0.7); scope-exceeded call blocked.
- Done when: an external agent calls a scoped Cadence tool and the call is audited.
- Depends: 0.7, S5.

**Q2 — A2A server/client + Agent Cards + scopes/limits/audit** `[new]` · `P2` · `X5`

- Build: Agent Cards; delegate-to-agent; peer registry; per-peer scopes + rate limits; prompt-injection guard on external results; audit log.
- Depends: Q1, 0.7.

---

#### EPIC R — Platform & ops

**R1 — Command palette (⌘K) + global search** `[reuse]` · `P0` · `X6`

- Build: `cmdk`-based; resolves every destination/create-action/recent-artifact; keyboard-first.
- Done when: ⌘K reaches every route + create action + recent artifact. See `design.md`.

**R2 — Connectors / integrations** `[extend]` · `P1` · `X5`

- Build: Google Docs/Notion two-way sync, Linear pull/push + Sync Inbox, Google Calendar read+write, GitHub, Slack, CRM; integration health surface; OAuth + token storage (encrypted); reuse Nango engine (`nango/`); known limits: Docs sync drops comments, Notion BFS reorder fixed.
- States: token expired; sync conflict; partial sync; rate limit.
- Done when: at least Docs/Notion/Linear/Calendar round-trip with health visible. See `integrations` epic in `plan.md` §5.
- Depends: A5/secrets, nango.

**R3 — Notifications** `[extend]` · `P1` · `X6`

- Build: approvals, budget breaches, guardrail hits, integration health, digests; in-app + transactional email; preferences.
- Depends: D3, P6, W?(email).

**R4 — Settings** `[extend]` · `P1` · `X6`

- Build: profile, keys, budgets config, guardrail rules, integration health, notification prefs, workspace/product admin.
- Depends: A4, A5, P2, P6.

---

#### EPIC S — Security & compliance `NFR`

**S1 — Sandboxed execution for agent code** `P0` → see **0.10**.
**S2 — Supply-chain security (agent-installed deps)** `[new]` · `P0`: allow-list + scanning before install; ties bunfig `minimumReleaseAge`.
**S3 — Secret scanning + SAST in build pipeline** `[new]` · `P1`: scan agent code for secrets/vulns pre-merge.
**S4 — Key rotation + compromise response** `[new]` · `P1`: rotate BYO/gateway/DB creds; revoke + re-issue runbook. Depends A5.
**S5 — Pen-test + threat model for MCP/A2A** `[new]` · `P1`: threat model the external-agent surface. Depends Q.
**S6 — RBAC / roles / team membership** `[new]` · `P1`: enforce at RLS + UI. Depends A6.

#### EPIC T — Reliability / SRE `NFR`

**T1 — App monitoring + alerting** `P0` → see **0.11**.
**T2 — SLOs/SLAs + error budgets + status page** `[new]` · `P1`.
**T3 — Long-running job durability / queue + backpressure** `P0` → see **0.9**.
**T4 — Graceful degradation on provider/model down** `P0` → see **0.8**.
**T5 — Incident response runbooks + on-call** `[new]` · `P1`. Depends P7.
**T6 — DR: backups, PITR, restore drills** `P0/P1` → see **0.11**.

#### EPIC U — Data & privacy `NFR`

**U1 — Data retention + deletion (GDPR/CCPA)** `[new]` · `P1`: `ai_events` currently unbounded → retention + right-to-be-forgotten.
**U2 — Data export / portability** `[new]` · `P1`: per-workspace/product export (anti-lock-in). Depends B5.
**U3 — Sub-processor list + DPA** `[new]` · `P1`: disclose model-vendor data flows; contracts.
**U4 — Data residency / region options** `[new]` · `P2`.
**U5 — PII classification + minimization before model calls** `[new]` · `P1`: strip/mask PII pre-provider; pairs with guardrails P2.

#### EPIC V — Finance & monetization `NFR`

**V1 — Usage metering + plan-limit enforcement** `[new]` · `P0/P1`: meter tokens/missions; enforce caps. Depends P6.
**V2 — Cost-to-serve vs. price model** `[new]` · `P0`: per-mission cost attribution feeding margin analysis.
**V3 — Payments, trials, dunning, invoicing** `[new]` · `P1`.
**V4 — Per-customer cost attribution** `[new]` · `P1`. Depends V1.

#### EPIC W — Growth / GTM platform `NFR`

**W1 — Onboarding + activation + samples/templates** `[new]` · `P0`: time-to-value; seeded sample product. Depends A1.
**W2 — Product usage analytics (separate from AI telemetry)** `[new]` · `P1`: activation/retention/funnels.
**W3 — Marketing site, pricing page, waitlist, SEO** `[new]` · `P1`.
**W4 — In-app support, help center, changelog, docs** `[new]` · `P1`.
**W5 — Mobile/PWA for approvals triage** `[new]` · `P2`: approvals can't block on desktop. Depends D3.

#### EPIC X — Legal & compliance `NFR`

**X1 — ToS, privacy policy, AUP, DPA** `[new]` · `P1` (required to sell).
**X2 — IP ownership of agent-generated code/content** `[new]` · `P1`.
**X3 — Liability for autonomous actions** `[new]` · `P1` (governance gates are part of the answer).
**X4 — OSS license compliance of agent-installed deps** `[new]` · `P1`. Ties S2, AGENTS.md §9.
**X5 — SOC 2 / ISO 27001 / ISO 42001 path** `[new]` · `P2` (substrate in security.md).

---

---

## Recent Additions & Triage

## New features — v2 Positioning Session (2026-06-02)

_Derived from strategic repositioning to "autonomous product OS." Full reasoning: [`strategy/product-positioning-v2.md`](../strategy/archive/v2-positioning-2026-06-02.md)._

**C5 — Strategic Briefing surface** `[status: ☑ shipped 2026-06-04]` · `P0` · `X1`

- What: one place where the operator defines mission, target user, current focus, anti-goals and notes once; every agent reads it as their operating context before each mission.
- Built: `workspace_briefs` table (one per workspace; mission / target_user / current_focus / anti_goals / notes; member-read, owner-write RLS). Editor at `/_authenticated/briefing` (5 textareas with hint copy + char counts + Save). `renderBriefBlock()` helper emits a labelled fenced text block (skipped when every field is empty). Agent loop injects the rendered block **between the agent's persona prompt and memory recall** in `src/lib/ai/loop.server.ts` so Discovery / Strategist / Builder all see the operator's shared context first. Migration also added `prds.github_issue_url` + a `prd.link_issue` tool to close PRD↔issue link-back.
- Done when: ✅ a mission's system prompt visibly contains the brief; editing the brief changes the next mission's plan.
- Depends: C2, G2 (editor), O2 (RAG context).

##### How to use / verify

- **Where to find it.** Sidebar → **Briefing** (Crosshair icon, pinned right after Today). Route: `/briefing`.
- **What each control does.** Five textareas — **Mission** (what this workspace exists to do), **Target user (ICP)** (who you're building for), **Current focus** (this quarter's priorities), **Anti-goals** (what to refuse to spend effort on), **Notes** (tone / constraints / decisions). Top-right **Save brief** button (disabled until dirty).
- **Server enforcement.** Read via `getActiveBrief` server fn (workspace-member RLS). Write via `upsertBrief` (workspace-owner only — RLS rejects everyone else). Brief content is injected into the agent loop's system prompt _before_ the tools list and quarantined tool-output rules, so it can't be overridden by tool output.
- **Verification checklist:** (1) Open `/briefing`, type a Current focus + Anti-goal, hit Save (toast confirms). (2) Run a mission from `/agents` (Discovery Scout / PRD Writer / Strategist). (3) Open the trace at `/traces/{trace_id}` and inspect the first model call's system prompt — the **Workspace Strategic Brief** block must appear between the persona prompt and the tools list. (4) Edit the brief, re-run the mission, confirm the Strategist's draft now reflects the new focus and refuses the anti-goal.

**C6 — Agent Trust Score + Autonomy Dial** `[status: ☑ shipped 2026-06-04]` · `P0` · `X1`

- What: each agent shows a visible trust score (0–100) computed from mission outcomes, approval acceptance, and eval scores; the operator places the agent on the trust arc (Observing → Proving → Trusted → Ambient) via an inline dial, and that arc composes with each tool's own approval mode in the agent loop.
- Built: `agent_autonomy` table (one row per user+agent, owner-only RLS). Trust score computed on read (`src/lib/ai/trust.server.ts → computeAllAgentTrust`) with Bayesian shrinkage so a 1-run agent doesn't show 100%. `resolveApprovalMode(toolMode, arc)` is the single combiner: Observing forces `review`, Proving forces `confirm`, Trusted lets `confirm` tools run inline, Ambient lets everything except hard-locked tools run inline. Safety floor preserved: `review` is sticky, and `calendar.create` keeps `confirm` even at Ambient. Server fns `getAllAgentTrust` + `setAgentArc` in `src/lib/trust.functions.ts`. UI: Trust chip (color-tiered, hover tooltip with full breakdown + formula) on each agent button and detail header; AutonomyDial (4 arc buttons + suggested-arc hint) inside the agent detail card.
- Out of scope (later): trust history chart, auto-promotion on sustained score, E8 Loop Health Monitor.
- Done when: ✅ dialing Discovery Scout from Observing → Trusted causes the next mission's `confirm`-mode tool to execute inline instead of queueing in the Decision Queue, and the trace shows `status:"executed"`.
- Depends: C2, D3, P1.

##### How to use / verify

- **Canonical explanation:** see [`docs/trust-and-autonomy.md`](../features/trust-and-autonomy.md) — operator-facing meaning of the 0–100 scale, the three ingredients (40/30/30), the four arc levels, safety floors, and the operator playbook. Linked from `architecture/orchestration.md`.
- **Where to find it.** Route `/agents`. Trust chip appears on each agent in the left roster and at the top of the right-hand detail card. The Autonomy Dial sits inside the detail card, just under the agent persona.
- **What each control does.** **Trust chip** (e.g. `Trust 72 · Trusted`) — the qualitative label is derived from the score band (`At-risk` / `Observing` / `Proving` / `Trusted` / `Ambient`; `New` until ≥3 samples). Hover (Radix tooltip) shows the 0–100 scale + Bayesian shrinkage explanation, then the weighted breakdown: Missions 40%, Approvals 30%, Evals 30% with raw counts and the suggested arc. **Autonomy Dial** — 4 buttons (Observing · Proving · Trusted · Ambient); each button has its own tooltip describing exactly what it does to `auto` / `confirm` / `review` tools. Clicking one writes `agent_autonomy` for that user+agent. The suggested arc is shown when it differs from the current arc.
- **Server enforcement.** `setAgentArc` server fn writes via `requireSupabaseAuth`; RLS on `agent_autonomy` restricts everyone to their own rows. The agent loop (`src/lib/ai/loop.server.ts`) calls `loadAgentArc` once per run and `resolveApprovalMode(toolMode, arc)` at every tool-call gate. `review` mode is sticky (never downgraded). `calendar.create` is hard-locked: even at Ambient it forces `confirm`.
- **Verification checklist:** (1) Open `/agents` — every agent card shows a Trust chip with qualitative label (first-time users see `Trust 50 · New`). (2) Hover the chip — Radix tooltip explains the scale, formula, and full breakdown. (3) Hover each arc button — each shows what that arc does to `auto` / `confirm` / `review` tools. (4) Dispatch a goal on **Discovery Scout** with the dial at **Observing** → the action is queued for review (visible at `/decisions` or `/traces` with `status:"queued"`). (5) Flip to **Trusted** → re-dispatch → a `confirm`-mode tool executes inline (trace step `status:"executed"`). (6) At **Ambient**, confirm `calendar.create` still hard-forces `confirm` (safety floor).

**E8 — Loop Health Monitor** `[new]` · `P1` · `X1`

- What: single view showing whether the autonomous product loop is running, where it's stuck, and what needs human attention — the "is my product org operating?" dashboard.
- Build: per-product loop status (active missions, stalled missions, approval queue depth, last signal ingest, last deploy); health score composite; alert when loop stalls >N hours; one-click resume from each stall point.
- States: healthy (all stages active); degraded (one stage stalled); stalled (multiple stages blocked or no activity).
- Done when: stall in the Discover stage appears in the monitor within 1 hour with the reason and unblock action.
- Depends: E6 (orchestration graph), D3, F3.

**N3 — Mission Compounding View** `[new]` · `P2` · `S9`

- What: show how each mission built on previous memory — make Product Memory accumulation visible and rewarding; counter the "is it getting smarter?" question.
- Build: per-mission "context used" panel (which past decisions, signals, outcomes informed this mission's plan); memory growth chart (nodes + edges over time); "this mission referenced N prior decisions" badge; exportable context snapshot.
- States: first mission (no prior context, explain what will be remembered); mature product (rich context graph visible).
- Done when: a mission trace shows which prior Product Memory nodes were retrieved and used in the plan.
- Depends: O1, O2, N1, N2.

**U6 — Full data portability / export** `[new]` · `P1` · `NFR`

- What: export all product data in open, standard formats — the anti-lock-in commitment made concrete. Operator can take their data to any tool at any time.
- Build: export wizard (per product or workspace); exports: signals (CSV/JSON), themes + opportunities (JSON), decisions + lineage (JSON), PRDs (Markdown), task graphs (JSON), agent configs (YAML), Product Memory graph (JSON), trace logs (JSON); scheduled export option; export audit log.
- States: large export (async + download link); partial export (per-data-type selection); export history.
- Done when: a full workspace export produces files importable into standard tools (CSV → spreadsheet, Markdown → Notion, JSON → any processor).
- Depends: B4, O1, G2, plan.md §9 (portability commitment).

**W6 — Persona-specific onboarding tracks** `[new]` · `P0` · `NFR`

- What: three onboarding paths matching the three primary personas — each emphasises the pain point most relevant to that user type and gets them to first value faster.
- Build: onboarding flow selector post-signup (Solo PM / Founding PM / Technical Founder); per-track: different sample data, different first-mission suggestion, different "first win" moment; track stored in profile; can switch tracks.
- States: existing user (skip or re-run track); partial onboarding (resume).
- Done when: each track gets a user to their first completed mission in <10 min (time-to-value measured).
- Depends: A1, W1, C5 (Strategic Briefing seeded as part of onboarding).

---

## v3 Audit Triage (2026-06-06)

_Derived from [`./strategy/archive/v3-audit-2026-06-06.md`](../strategy/archive/v3-audit-2026-06-06.md) (22 product RECs) and [`./strategy/archive/v3-audit-language-2026-06-06.md`](../strategy/archive/v3-audit-language-2026-06-06.md) (10 LANG + tooltip + IA + outcome + chip recs). Operator-approved A→C→B sequence; this triage **is** Phase C. Each F-ID below is a thin entry pointing back to the audit doc for full body + impact/effort/horizon scoring — do not duplicate that prose here._

**Owner column:** any tool may pick a row whose own status isn't `☑`. Update Live status board's "Now building" before starting. Cross-tool rules: [`../AGENTS.md`](../../AGENTS.md) §10.

**Status legend:** ☑ shipped · ◑ partial · ☐ not started · ⊘ closed/superseded.

#### P0 — ship in the next two weeks (low-risk voice/clarity wins)

| F-ID                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Source recs                         |  Owner  | Status |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | :-----: | :----: |
| `F-VOICE-LOGIN`       | Rewrite `/login` headline + subhead to the v3 thesis ("Your product org, run by a swarm of agents…").                                                                                                                                                                                                                                                                                                                                                                                                                                                | REC-01 · LANG-01                    | Lovable |   ☑    |
| `F-VOICE-AINATIVE`    | Grep + replace every `AI-native` string with v3 language; update marketing meta + sidebar tagline.                                                                                                                                                                                                                                                                                                                                                                                                                                                   | REC-02                              | Lovable |   ☑    |
| `F-VOICE-VERSIONS`    | Strip `Phase N` / `Bundle N` / `Slice N` internal labels from operator UI (`/build`, `/discovery`, `/opportunities`, `/prds`); keep them in docs only.                                                                                                                                                                                                                                                                                                                                                                                               | REC-18 · LANG-02                    | Lovable |   ☑    |
| `F-VOICE-EMPTY-TODAY` | Rewrite Today empty state (drop "hit refresh") + Swarm empty state (drop "humming").                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | LANG-06                             | Lovable |   ☑    |
| `F-VOICE-CASE`        | Sentence-case every page H1; remove `uppercase tracking-[0.16em]` mono-labels and serif gradients on `Upcoming meetings` / `All tasks`.                                                                                                                                                                                                                                                                                                                                                                                                              | LANG-08                             | Lovable |   ☑    |
| `F-GOV-APPROVAL-COPY` | Approval-gate row copy must lead with consequence: `Approve · <what happens> · Reject · <what rolls back>`. Applies to inbox + decision queue + mission detail.                                                                                                                                                                                                                                                                                                                                                                                      | REC-08 (approval prompts) · LANG-09 | Lovable |   ☑    |
| `F-TODAY-AUTOSEED`    | Auto-generate the Today brief on first sign-in instead of asking the operator to seed it. Implemented via `ensureTodayBrief(supabase, userId)` helper in `src/lib/copilot.functions.ts`, called from `getDashboard`.                                                                                                                                                                                                                                                                                                                                 | REC-05                              | Lovable |   ☑    |
| `F-AGENTS-ROSTER-CUT` | Cut seeded agent roster to 5 (Discovery Scout · Strategist · PRD Writer · Builder · Orchestrator). `seed_default_agents` migration cut 9 → 4; Orchestrator seeded by its own fn. Extras disabled (not deleted) for existing users.                                                                                                                                                                                                                                                                                                                   | REC-04                              | Lovable |   ☑    |
| `F-NAV-ACCORDION`     | Sidebar groups behave as single-open accordion: clicking a group auto-collapses the others; the active route's group auto-opens; `localStorage` persists one id. Implemented in `src/components/cadence/AppShell.tsx` only. **Why:** addresses operator feedback that the left rail felt crowded; pairs with `F-IA-MERGE-OBSERVE` to clean up the AI Ops area without hiding features. **How to verify:** open `/agents` → "Agents" group is the only one expanded; click "Deliver" → "Agents" auto-collapses; refresh → last-opened group restored. | operator-fb · pairs with REC-12     | Lovable |   ☑    |

#### P1 — ship in the next 1–2 months (structural)

| F-ID                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Source recs               |  Owner  |        Status        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | :-----: | :------------------: |
| `F-IA-MERGE-OBSERVE`  | Sidebar `AI Ops` → `Run` (Observe · Evals). `/analytics` + `/traces` + `/drift` merged into `/observe` with tabs (Analytics · Traces · Drift); Traces & Drift labels carry live count badges; `?tab=` drives state; old URLs `throw redirect()` to the matching tab; `/traces/$traceId` preserved. Govern group untouched (Guardrails · Governance · Budgets · Integrations). **How to use / verify:** sidebar → Run → Observe; default Analytics tab; switching tabs updates `?tab=`; visiting `/analytics`, `/traces`, or `/drift` redirects to the matching tab; ⌘K resolves "Observe"; Trace detail still opens at `/traces/<id>`. **Implementation:** new `src/routes/_authenticated.observe.tsx` + `src/components/observe/{Analytics,Traces,Drift}Panel.tsx`; old route files reduced to `beforeLoad: redirect(...)`; sidebar group `aiops` → `run` with 2 items in `src/components/cadence/AppShell.tsx`. | REC-12 · operator-fb      | Lovable |          ☑           |
| `F-IA-MERGE-GOVERN`   | Merge `/inbox` + `/guardrails` + `/budgets` → `/governance` with internal tabs (Controls · Approvals · Guardrails · Budgets); old URLs redirect to the matching tab; sidebar workspace "Approvals" deep-links to `?tab=approvals`; Govern group shrinks to Governance + Integrations. **How to use / verify:** open `/governance` → tab strip shows the 4 tabs with a one-line description below; visit `/inbox`, `/guardrails`, `/budgets` and confirm 301 to `/governance?tab=…`; sidebar Approvals (workspace rail) and Governance (Govern group) both light up correctly when their tab is active. Server enforcement is unchanged — all four panels reuse their existing server fns (`listApprovals`/`decideApproval`, `getGuardrailOverview`/etc., `getBudgetOverview`/etc., `getGovernanceOverview`/reactor fns), each gated by `requireSupabaseAuth`.                                                     | REC-13                    |   any   | ☑ shipped 2026-06-06 |
| `F-IA-CULL-CALDOCS`   | Delete `/calendar`, `/meetings`, `/docs`, `/sync` from operator nav (data preserved).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | REC-14                    |   any   |          ☐           |
| `F-IA-AGENTS-TABS`    | Fold `/prompts` and `/agents` into one **Agents** route with internal tabs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | REC-15                    |   any   |          ☐           |
| `F-IA-TODAY-BRIEFING` | Execute Today + Briefing merge per audit §5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | REC-11                    |   any   |          ☐           |
| `F-IA-RENAMES`        | Batch rename in sidebar + command palette + page headers (URLs unchanged, so no redirects needed): `Build Console`→`Builder` · `AI Chat`→`Chat` · `Swarm HUD`→`Swarm` · `Prompt Studio`→`Prompts` · `Sync Inbox`→`Connectors`. `AI Ops`→`Observe`, `AI Analytics`→`Analytics`, and `Eval Harness`→`Evals` already landed via `F-IA-MERGE-OBSERVE`. **How to use / verify:** open sidebar and confirm the new labels; open `/build`, `/swarm`, `/prompts`, `/sync`, `/chat` and confirm tab title + page H1 match; command palette (⌘K) shows "Chat" not "AI Chat".                                                                                                                                                                                                                                                                                                                                                | LANG-05                   |   any   | ☑ shipped 2026-06-06 |
| `F-CHAT-NL-INTENT`    | Natural Language Intent Detection & Inline Mission Progress on Chat. Intercepts user inputs, runs fast Gemini classification, seeds orchestrator, dispatches mission, and renders inline progress card & approvals panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | REC-08 (chat-mission)     |   any   | ☑ shipped 2026-06-07 |
| `F-COCKPIT-MERGE`     | Merge `/swarm` + `/missions` → `/cockpit` (two views: Agents · Missions). Subsumes most of LANG-IA-12.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | REC-16 · LANG-IA-12       |   any   | ☑ shipped 2026-06-11 |
| `F-TODAY-LOOPPULSE`   | Replace Today hero (Focus Score / deep blocks) with Loop Pulse: `Overnight: 7 signals clustered → 2 themes promoted · 1 PRD ready for review · Builder PR #142 awaiting CI (green in 3m)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | REC-03 · REC-17           |   any   |          ☐           |
| `F-VOICE-EMPTY-ALL`   | Empty-state copy pass across all remaining routes (post-IA merges).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | REC-06                    |   any   |          ☐           |
| `F-GOV-COST-SURFACE`  | Surface unit economics on `/build` and `/governance`: `This mission cost $0.42 in tokens; budget $5.00`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | REC-20                    |   any   |          ☐           |
| `F-VOICE-TOOLTIPS`    | Apply audit §4.1 (delete restating tooltips, ~15 sites) + §4.2 (rewrite to consequence-first, ~8 sites, mostly `/agents`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | TOOLTIP-DEL · TOOLTIP-REW |   any   |          ☐           |
| `F-VOICE-GLOSSARY`    | Publish glossary; add a CI script that flags banned synonyms (`Trajectory`, `Run` for missions, `Specialist` in UI).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | LANG-04                   |   any   |          ☐           |

#### P2 — 3–6 months (platform / differentiator depth)

| F-ID                     | What                                                                                                                                                                                                     | Source recs                          | Owner | Status |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | :---: | :----: |
| `F-COCKPIT-MACHINE-MODE` | Header toggle: Human Mode (current dense surface) ↔ Machine Mode (full-screen dispatch board showing running agents, queue, attention, throughput; hides everything else). Depends on `F-COCKPIT-MERGE`. | REC-22 · REC-08 (mode toggle aspect) |  any  |   ☐    |
| `F-MCP-V1`               | Ship minimal Cadence MCP server (read signals/opportunities/PRDs · append decision · queue mission).                                                                                                     | REC-09                               |  any  |   ☐    |
| `F-AGENTS-MENTIONABLE`   | Agents as first-class users: `@discovery, please re-cluster the last 50 signals` from any PRD comment or Today card.                                                                                     | REC-10                               |  any  |   ☐    |
| `F-BUILDER-MULTIFILE`    | Lift Builder from single-file to scoped multi-file: pre-declared touch list, max N files, review per file.                                                                                               | REC-21                               |  any  |   ☐    |
| `F-VOICE-CHIP`           | Enforce AI-message chip spec via component prop types: `<AiCallChip model via score latency tokens cost />`.                                                                                             | LANG-CHIP                            |  any  |   ☐    |
| `F-MKT-COCKPIT-AB`       | A/B landing: "OS" vs. "cockpit" positioning. Marketing surface only.                                                                                                                                     | REC-19                               |  any  |   ☐    |

#### Phase B — Outcome surface (the big merged bet)

| F-ID                | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Source recs               | Owner |        Status        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | :---: | :------------------: |
| `F-OUTCOME-SURFACE` | Ship `/outcome` (Releases · Launches · Support · Learnings) and the 5 missing right-half loop surfaces (Release · Launch · Support · Learn · Outcome) in shadow form so operators _see_ the loop they're sold. Maps to Proof Platform v1.1 bundles 10–12 (Ship · Launch · Support→Learn). Empty surfaces are fine if the loop is named. **How to use / verify:** open the sidebar → **Outcome** group → `/outcome`. Four tabs: **Releases** (completed missions + completed agent runs with duration/tokens/cost), **Launches** (approvals on outbound tools `send_slack`/`send_email`/`publish_changelog`/`post_announcement`/`notify_channel` — pending rows link to `/inbox`), **Support** (signals with `source` in `support`/`ticket`/`helpdesk`/`email`/`zendesk`/`intercom`/`freshdesk`), **Learnings** (opportunities whose `updated_at` is >60s after `created_at` — proxy for re-scoring). Each tab is empty by design until upstream events arrive; empty state names the loop step + why it lights up. All reads go through `getOutcomeData` in `src/lib/outcome.functions.ts` (RLS-scoped via `requireSupabaseAuth`). No new agent logic; no chokepoint bypass. | REC-07 · LANG-NEW-OUTCOME |  any  | ☑ shipped 2026-06-06 |

#### Already shipped (close-out)

| F-ID              | What                                                                                                                                                                                                                                          | Source recs |        Status        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | :------------------: |
| `F-VOICE-DIALOGS` | `window.prompt()`/`window.confirm()` flows in `AppShell` (workspace + product creation/rename/delete) replaced with `useConfirm` / `usePrompt` dialogs + sentence-case labels; ESLint guardrail blocks `alert/confirm/prompt/onbeforeunload`. | LANG-07     | ☑ shipped 2026-06-06 |
| `F-VOICE-GUIDE`   | One-page voice guide published as [`./conventions/ui-voice.md`](../conventions/ui-voice.md); linked from `design.md`, `AGENTS.md` §3, `CLAUDE.md` + `GEMINI.md` read-order step 1.6.                                                           | LANG-10     | ☑ shipped 2026-06-06 |

#### Security follow-up (ignored finding, tracked)

| F-ID                 | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Source                                                   |          Status          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | :----------------------: |
| `F-SEC-REALTIME-RLS` | `realtime.messages` has no RLS — any authenticated user can subscribe to any channel topic. Operator picked "ignore for now, track as backlog F-ID". Fix requires (a) renaming every `supabase.channel()` call site to `workspace:<id>:…` / `user:<auth.uid()>:…` topic convention, then (b) RLS on `realtime.messages` enforcing topic regex against workspace membership. Higher risk than payoff today (no PII broadcast on realtime; row reads still RLS-protected). | supabase_lov scanner `realtime_messages_no_channel_auth` | ☐ (deferred by operator) |

#### Triage notes (apply when picking a row)

- **Most P0 rows are pure copy.** No schema change, no server-fn change, no migration. Estimate is hours-per-route, not days.
- **`F-IA-*` merges break URLs.** Always add redirects in the same commit; never ship a rename without `<Navigate>` from old route.
- **`F-AGENTS-ROSTER-CUT` is a data change**, not a code change — update seed data + the agent roster server fn, leave the spawn pipeline alone.
- **`F-OUTCOME-SURFACE` is Phase B** — claim it via Live status board before another tool does; bundles 10–12 collapse into this one F-ID.
- **Don't expand prose here.** Full bodies live in the two audit docs. This section is the addressable index.

---

---

## Build-order rollup (status × build sequence)

Sequence from [`../plan.md`](../../plan.md) §3. Status: ☐ not started · ◑ legacy partial (harden) · ☑ verified into `plan.md` §4. **Per-item code-verified grades + step-1 tickets: [`foundation-audit.md`](./foundation-audit.md) (2026-05-30).**

> **▶ This table is the canonical "what do I build next?" source.** To resolve the next actionable task deterministically (any tool, any human):
>
> 1. Take the **lowest-numbered step** that is still `◑` or `☐` (the `∥` cross-cutting row is pulled into step 1, not sequenced separately).
> 2. Expand its **Key IDs** to the feature entries above; pick the first whose own `[status]` is not `☑`.
> 3. Open its concrete ticket in [`foundation-audit.md`](./foundation-audit.md) (step 1) or its entry above (later steps), then build.
>
> `TASKS.md` (repo root) is the **strategic** P0–P3 view — it points here for the concrete next step; it is not itself the task queue.

| Step | Scope                                                  | Key IDs                                       | Status |
| ---- | ------------------------------------------------------ | --------------------------------------------- | ------ |
| 1    | Foundation hardening + P0 non-functionals              | 0.1–0.12, A1–A5, B1–B2, P1–P2, P6, P8, O2, R1 | ◑      |
| 2    | First slice: Discover→Define→Plan                      | F1–F3, G1–G2, H1–H3, N1                       | ◑      |
| 3    | Orchestration layer (X1)                               | E1–E7, D1–D4, C1–C4, **C6**, E6 graph         | ◑      |
| 4    | Build→Test→Ship (autonomous)                           | I1–I3, J1–J2, K1–K2, 0.10, 0.12               | ☐      |
| 5    | Multi-product / multi-workspace                        | B3–B5, B4, E5                                 | ◑      |
| 6    | Launch/GTM/Price + Operate/Support                     | L1–L2, M1                                     | ☐      |
| 7    | Learn + Product Memory                                 | N2, O1, O3                                    | ◑      |
| 8    | Interop (MCP/A2A)                                      | Q1–Q2                                         | ☐      |
| ∥    | Cross-cutting (pull P0s into step 1, rest as relevant) | S, T, U, V, W, X                              | ☐      |

**P0 critical path (the must-haves for a credible first user):** 0.1, 0.2, 0.5, 0.6, 0.7, 0.8, 0.9, 0.10, A1, A2, B1, B2, F1, F2, F3, G1, P6, P8, W1.

---
