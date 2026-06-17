# Feature Dashboard - the single live status board (master sheet)

> **What this is.** The one canonical, at-a-glance status of **every** feature: what is built, in development, paused, deferred, or pending, each with a one-line "why it matters" and a build cue so any session can pick it up cold. This is the **front door** to status. Detail lives elsewhere (links below); this page is the index that stays true.
>
> **Last updated:** 2026-06-17 · **Maintainer rule:** Tier 1, continuous (update in the same commit as any status change).

---

## ⛔ STANDING RULE - read this BEFORE starting any feature work (non-negotiable)

Every tool (Claude Code · Antigravity · Gemini · Lovable · a future session) **must** do this before touching any feature:

1. **`git pull origin main`**, then **read this dashboard.** It is checked before any activity starts, exactly so a new or parallel session knows what is already in flight or already deferred and does not collide or redo.
2. **Respect the claims.** If a row is `🔨 In Dev`, another session may be on it - do not start it. Pick a different row, or coordinate. Check the **Active claims** table below first.
3. **On pickup:** flip that row's status to `🔨 In Dev (<tool>, YYYY-MM-DD)`, add a line to the **Active claims** table, and commit + push immediately so others see the claim. Same commit, before you write feature code.
4. **On completion:** flip the row to `✅ (YYYY-MM-DD · <commit>)`, remove the Active-claims line, and update the linked detail doc + `plan.md` §4 in the same unit of work (the closed-doc loop).
5. **On pause/defer/block:** flip to `⏸️`, `⏭️`, or `🚧` with a one-line reason in the row.

> This is the same shared-cursor discipline as the Live status board in [`feature-backlog.md`](./feature-backlog.md); this page is the human-readable master view of it. When they disagree, fix both in the same commit.

### How to pick something up
Say **"pick `<ID>`"** (e.g. "pick I-2", "start K1", "do F-IA-V4") and the agent resolves the ID here → reads the **Cue** → opens the linked detail → builds. The IDs are stable and shared with [`feature-backlog.md`](./feature-backlog.md) and [`v7-build-status.md`](./v7-build-status.md).

### Status legend
| Mark | Meaning |
| --- | --- |
| ✅ | **Done** - built, on `main`, verified (date · commit where known) |
| 🔨 | **In Development** - actively being built this/another session (see Active claims) |
| ◐ | **Partial** - foundation built, real remaining work; row says what's left |
| ⏸️ | **Paused** - started or built but intentionally idle, with a reason |
| ⏭️ | **Deferred** - deliberately not now (gate/sequence reason) |
| 🚧 | **Blocked** - cannot proceed until a dependency clears (often a `KI-` or a founder action) |
| ⬜ | **Pending** - not started, ready to pick up |
| ⚠️ | **Verify** - docs conflict on whether this is done; confirm against the live build before acting |

---

## Active claims (who is on what, right now)

> Keep this table empty when nothing is in flight. Add a row the moment you pick something up.

| ID | Feature | Tool / session | Since | Notes |
| --- | --- | --- | --- | --- |

---

## 🎯 Build priority & disjoint lanes (the pick-list, from [v10](../strategy/v10-master-blueprint-2026-06-17.md))

> **The single pick-list.** Priority and lane come from the [v10 master blueprint](../strategy/v10-master-blueprint-2026-06-17.md) sections 15 to 16 (full What/Pain/How per item there). Lanes are **file-disjoint** so a session claims a lane and builds its top item without colliding. Execution mechanics (per-item build/verify/ship discipline, milestone gates) are in [`v10_implementation-plan.md`](./v10_implementation-plan.md). Pick top-down.

**P0 - build first (close the loop + land the wedge):**
| Order | Item | Lane | Status | What |
| --- | --- | --- | --- | --- |
| 1 | `LRN-02` + `W1-AUTO` | B (LEARN) | ✅ (2026-06-17) | Done. Recon found the core already built (`recordOutcome` rescores ICE + writes `learnings`; `rememberOutcome` already wires W1-AUTO into a recallable `agent_memory`). Added the missing "predicted vs actual, Historian verdict" half: an AI Historian assist on the outcome card. The loop is closed. |
| 2 | `WEDGE` | C (DECIDE) | ✅ (2026-06-17) | Critic-teardown first-run ("why your pet feature is wrong, with receipts"). The 10-minute moment. Shipped: cold-start Today card → `runWedgeTeardown` records the idea as an opportunity + runs the existing Critic inline → Ship/Revise/Kill verdict with risks, kill criteria, and evidence gaps. No new AI infra, no migration. Detail: [`features/wedge.md`](../features/wedge.md). |
| 3 | `MOAT-VIS` | B (LEARN) | ✅ (2026-06-17) | Surface "this learning moved these priorities" on Today + Brain. Makes compounding visible. Shipped: `listLearnings` now carries the moved opportunity's title; Brain Learnings reads "moved {opportunity} · ICE x→y" + a "Priorities moved" count; Today's What-changed card names the opportunity. Recon found LRN-02 already rendered the raw rescore — the gap was naming the priority. |
| 4 | `SEN-01` (needs `F-CONN` OAuth) | A (SENSE) | ⬜ / ⏸ | A second live ingest source. Founder registers one OAuth client first. |
| 5 | `W6` | E (PLG) | ✅ (2026-06-17) | Persona onboarding (also the wedge's delivery surface). Shipped: 3-track selector + per-track seed data, 4-step flow. Closed: fixed the step-3 agent-toggle contract bug (agentId), removed the no-op `agentSlugsToEnable` field, wrote [`features/onboarding-tracks.md`](../features/onboarding-tracks.md). Live UI walkthrough on next publish. |

**P1 - monetize, defend, deepen autonomy:** `F-SHARE-TEARDOWN` (C, new), `PLG` (E), `M-C-PRICE` switch-on (E, founder secrets), `Q1-MCP` read-only (F, new), `SANDBOX`+`AMBIENT-ARC` (D, new), `MOAT-METRIC` ✅ (Gauntlet Outcome-accuracy card) + `SEN-05`+`F-ANALYTICS-1/2` (A/B; SEN-05 + F-ANALYTICS gated on a product-analytics connector OAuth), `DEC-02-LOOP`+`H1-TASKS`+`H2-WRITES` (C).

**P2 - breadth/polish:** `ENG-06`, `BLD-04`, `K2`, `BLD-05`, `D4`, `P7`, `P3`, `R3`, `B5`, `FND-0.7`, `U6`, IA culls.

**CUT / DEFER (do not build now):** `K1-deploy` (external deploy), `F-AUDIO-1/2` + `SEN-04` (post-PMF), the full 19-mesh breadth, outcome-pricing machinery, team/RBAC `A6` beyond the MCP slice.

**New items added by v10 (tracked here; not yet group rows below):** `MOAT-VIS` ✅, `MOAT-METRIC` ✅ (Gauntlet "Outcome accuracy" card · [`features/gauntlet-metrics.md`](../features/gauntlet-metrics.md)), `F-SHARE-TEARDOWN` ✅, `SANDBOX`, `AMBIENT-ARC` ✅ (Trust Dial on the Agents tab — `src/components/cockpit/TrustDial.tsx`; surfaces the per-agent arc incl. Ambient + suggested promotion; see [`features/trust-and-autonomy.md`](../features/trust-and-autonomy.md) §7), `Q1-MCP` ◐ (Phases 1-3 done). (`WEDGE` ✅ and `W1-AUTO` ✅ now have group rows.) **Lanes:** A SENSE/ingestion · B LEARN/analytical engine · C DECIDE/wedge · D BUILD/autonomy spine · E MONETIZE/PLG · F INTEROP · G Cockpit/IA/gov polish.

---

## At a glance

| Group | ✅ Done | ◐ Partial | ⏸️/⏭️/🚧 | ⬜ Pending |
| --- | --- | --- | --- | --- |
| G0 Core loop & memory (engine) | 11 | 0 | 0 | 0 |
| G1 Sense & Discovery | 4 | 1 | 1 | 6 |
| G2 Decide & Plan | 8 | 0 | 0 |  1 |
| G3 Build → QA → Ship | 8 | 0 | 1 | 5 |
| G4 Launch & Learn | 2 | 1 | 0 | 5 |
| G5 Monetize & Growth | 2 | 0 | 2 | 2 |
| G6 Interop & Team | 0 | 1 | 0 | 4 |
| G7 Cockpit, IA & Observability | 8 | 1 | 0 | 7 |
| G8 Governance, Trust & Safety | 4 | 4 | 0 | 4 |
| G9 Platform & Foundation | 5 | 0 | 1 | 2 |

> ✅ **G3 Build → QA → Ship complete (2026-06-16):** I3 · J1 · J2 · I1 · I1b · K1 · I2 all ✅. Build is a Cursor-grade hero (live cockpit + Phase-2 polish). The remaining build frontier is the sandbox/preview spine (v8 Phase 3) + delegate-out. IA/cockpit lanes (N3, F-TODAY-LOOPPULSE, E8) in/landed.

The engine (Sense → Decide → Plan, memory, governance) is **built and verified live**. The pending frontier is the **execution half** of the lifecycle (Build → QA → Ship → Launch → Learn), **monetization/PLG**, and **interop/team**. Milestone narrative: [`v7-build-status.md`](./v7-build-status.md) (M-0 to M-D).

---

## G0 - Core loop & memory (the engine)
_The autonomous spine. Built and code/live-verified. Do not rebuild; extend via the groups below._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| F-AGENT-1 | Orchestrator + multi-agent missions | ✅ | The mission DAG that runs the whole loop | [`features/f-agent-1-orchestrator.md`](../features/f-agent-1-orchestrator.md) |
| F-AGENT-2 | Persistent memory + self-reflection + trust auto-advance | ✅ | Agents remember and earn autonomy; the moat's substrate | [`features/f-agent-2-memory-reflection.md`](../features/f-agent-2-memory-reflection.md) |
| F-AGENT-3 | Event reactor + auto-pipelines | ✅ | Signals trigger missions with no human poke | [`features/f-agent-3-event-reactor.md`](../features/f-agent-3-event-reactor.md) |
| F-AGENT-4 | Swarm HUD | ✅ | See the agent mesh working (Missions → Agents tab) | [`features/f-agent-4-swarm-hud.md`](../features/f-agent-4-swarm-hud.md) |
| P1-AA | Deterministic auto-advance | ✅ | Missions advance unattended past wave 0 | `src/lib/ai/mission-advance.server.ts` |
| P1-RETRY | Bounded hop retry | ✅ | A failed hop retries with backoff, not a dead mission | `src/lib/ai/retry.ts` |
| P1-BUDGET | Adaptive step budget | ✅ | Step budget scales to role/arc, not a static cap | `src/lib/ai/budget.ts` |
| W1 | Memory-compounding loop | ✅ | Outcomes distil into recallable memory across agents (the moat wired) | `src/lib/ai/outcome-memory.ts` |
| W2 | Executed-unattended audit | ✅ | The cockpit shows what the loop ran without you | `ExecutedCard` · Missions |
| W3 | A2A hardening + moat on cockpit | ✅ | Handoffs validate memory refs; outcomes-remembered count shown | `enqueueHandoff` · Swarm HUD |
| M-0 | Loop runs end-to-end on live data | ✅ (2026-06-15) | Plan → dispatch → specialist execution confirmed live (hollow-completion fixed) | [`v7-build-status.md`](./v7-build-status.md) |

---

## G1 - Sense & Discovery
_Get real signal in, cluster it, keep it fresh._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| KI-10 | Ingest webhook + per-token rate limit | ✅ (2026-06-16) | One secure live ingest path for public use | [`features/ingest-webhook.md`](../features/ingest-webhook.md) |
| F-BRAIN | Brain (web + workspace research) | ✅ | Perplexity-grade research feeding decisions | [`features/brain.md`](../features/brain.md) |
| F-CONN | Connector platform (OAuth) | ⏸️ Parked | The connector engine is built; **parked** pending founder OAuth-client registration | `src/lib/connectors/` · [`architecture/integrations.md`](../../architecture/integrations.md) |
| SEN-01 | Connector dock: 2nd live ingest (Slack / GitHub issues / support) | ⬜ (M-A) | The loop needs ≥2 real sources to close on real data | Register one provider OAuth client → adapter in `src/lib/connectors/` |
| F3 | Continuous discovery feed | ◐ Partial | Always-fresh per-product feed + incremental re-cluster (Scout ingest is manual today) | Extend discovery functions; feed UI on `/prds` discovery |
| N2 | Re-score + insight memo + daily brief | ✅ (2026-06-16) | Re-score loop + daily brief already existed; this added the missing **insight memo** — the daily brief now ingests the recent `learnings` (re-scored outcomes: verdict + summary + ICE shift) and synthesizes a "what the loop learned" beat. ⚠️ Wiring + build verified; the AI-generated brief output needs a live re-verify on the deployed app (local dev has no AI key) | `copilot.functions.ts` (`ensureTodayBrief`) → Today's brief |
| O1 | Knowledge graph + query | ⬜ | Typed signals→themes→opps→decisions→outcomes; "why is this on the roadmap?" | New graph tables + query fn |
| O3 | Fact currency/drift + skill packs | ⬜ | Flag stale facts; export versioned skill bundles over MCP | Depends on O1 + Q1 |
| SEN-04 | Researcher watchtower (competitor crawl briefs) | ⬜ (M2) | Ambient competitive signal without manual research | Firecrawl crawl + scheduled brief |
| SEN-05 | Quant analytics inbound (PostHog/Amplitude/Mixpanel) | ⬜ (M2) | Product metrics as first-class signal | Connector adapter + `product_analytics` |
| F-AUDIO-1 | Speech transcription + chunking | ⬜ | Upload meeting audio → transcript → diarized chunks | Whisper pipeline + storage |
| F-AUDIO-2 | Action-item / ticket extraction from transcripts | ⬜ | Meetings become drafted opportunities/PRDs citing the transcript | Depends on F-AUDIO-1 |

---

## G2 - Decide & Plan
_Turn signal into governed decisions and specs._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| F-CHAT-NL-INTENT | Conversational command of the swarm | ✅ | Drive missions in natural language | `src/routes/api/chat.ts` |
| H1 | PRD / spec generation | ✅ (2026-06-14) | Cited specs from opportunities | discovery/lineage functions |
| DEF-03 | Critic-on-spec red team | ✅ (2026-06-14) | Specs get an adversarial pass before commit | Critic inline call |
| F-DEC-CARD | Decision card + Critic badge on Today | ✅ | The human makes the call with the Critic's view in front of them | Today surface |
| WEDGE | Critic-teardown first-run (the launch wedge) | ✅ (2026-06-17) | The felt entry: a brand-new account names a feature it believes in and gets an evidence-backed Critic teardown (Ship/Revise/Kill + risks/kill-criteria/evidence-gaps) in the first session, no setup. Leads the cold-start Today. Wires the existing `runCritic` engine; no new AI infra, no migration | `runWedgeTeardown` (`discovery.functions.ts`) + `WedgeTeardown.tsx` · [`features/wedge.md`](../features/wedge.md) |
| F-SHARE-TEARDOWN | Shareable Critic-teardown link (viral loop) | ✅ (2026-06-17) | The wedge's sharpest artifact made public ("why your pet feature is wrong, with receipts") — the v9 wedge as acquisition. Mirrors the F-SHARE rails onto `opportunities` (`share_slug`+`is_public`) + a `/t/$slug` public route rendering the persisted `critic_review`; no new AI infra. Pre-migration tolerant like F-SHARE: Share control shows "share · after sync" until Lovable sync applies migration 20260617130000. Shipped: operator toggles Share on teardown → public `/t/$slug` link → anon render with verdict + risks + kill-criteria + evidence-gaps. | `opportunities-share.functions.ts` + `t.$slug.tsx` · [`features/shareable-teardowns.md`](../features/shareable-teardowns.md) |
| F-SHARE | Shareable-decision viral loop + rate limit | ✅ (2026-06-16) | A public decision link drives signups; secure anon-read | [`features/shareable-decisions.md`](../features/shareable-decisions.md) |
| H2 | Outcome roadmap (Now/Next/Later) | ✅ (2026-06-17) | Outcome-driven board on `/product?tab=roadmap`: the human commits opportunities to Now/Next/Later with a declared outcome + measure; the agent's continuous ICE ranking orders within each bucket (NOT the v6-deleted task kanban). Native HTML5 drag + a keyboard/click bucket select per card; verified RLS-scoped writes (user-scoped `.select()` so a blocked update fails loudly). Adversarially reviewed: 3 fixes (phantom-ok write, a11y drag-only gap, field reset). **Place-into-bucket write is gated on the next Lovable sync applying the migration; read is pre-migration tolerant.** | `roadmap.functions.ts` + `RoadmapBoard.tsx` + migration `20260617000000_h2_roadmap_outcome.sql` |
| H3 | Scheduling (calendar-aware work blocks) | ✅ (2026-06-16) | "Plan deep work" on the Calendar: `proposeWorkBlocks` schedules open deep-work tasks into free time within working hours (reuses proposeSlots' conflict logic; one block per task, back-to-back, skips weekends/meetings; pure read-only proposal), each block has "Add to calendar". Adversarially reviewed: 1 real boundary bug + a user-facing em-dash fixed | `calendar.functions.ts` (`proposeWorkBlocks`) + `CalendarPanel.tsx` |
| D4 | Cancellation / replay-and-branch / checkpoints | ⬜ | Stop mid-run, re-run with a different model/prompt, diff the result | Mission control + loop checkpoints |

---

## G3 - Build → QA → Ship (the autonomous execution chain)
_The biggest pending block and the core differentiator: genuine end-to-end execution. Some of this exists via the Build engine (F-STUDIO); verify overlap before building._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| F-STUDIO | Build engine (repo reads, multi-file changesets, `studio/*` branches, PR + CI, gated merge) | ✅ | The green path that ships real code | [`features/studio.md`](../features/studio.md) |
| I1 | Studio multi-file coding (per-hunk accept/reject) | ✅ (2026-06-16) | Operator can curate a staged changeset before the gated commit: per-hunk reject (reverts to base) + drop a whole file. Pure tested diff engine shared UI/server | `ai/studio-hunks.ts` (11 tests) + `studio.functions.ts` (applyStagedHunkSelection / rejectStagedFile) + `ChangesPanel.tsx` |
| I1b | True revision history (atomic revisions) | ✅ (2026-06-16) | Each `studio.commit` records a revision (no, sha, message, files); the Changes tab shows the commit history with GitHub links. Revert-to-revision deferred (needs per-revision content or git ops) | migration `20260616230000` + `registry.server.ts` studio.commit + `getChangesetRevisions` + `ChangesPanel` strip |
| I2 | Watch-the-agents-build live surface | ✅ (2026-06-16) | Live per-session cockpit: 4s conditional polling, two-pane (timeline+steer / Changes·PR·Cost), journey strip, inline approval gates, merge gate, cost. Phase-2 polish added a live "what's it doing now" caption (outcome-named, no tool-id leak) + calmer copy. True SSE streaming deferred (nice-to-have) | `_authenticated.build.{index,$missionId}.tsx` + `SessionTimeline.tsx` |
| I3 | Branch/worktree isolation per mission | ✅ (2026-06-16) | Concurrent missions can't share a branch or clobber files: per-path `builder_file_claims` (same-file guard) + collision-safe per-changeset branch `studio/<mission8>-<changeset12>` + clean open→squash-merge→release path. Git Data API (no local checkout), so "worktree" = isolated branch | `ai/studio-branch.ts` (6 tests) + `registry.server.ts` studio.commit |
| J1 | Test generation + run | ✅ (2026-06-16) | Studio agent now authors tests as part of every change (prompt discipline); tests run in the connected repo's GitHub Actions CI (no Cadence sandbox, by design) | migration `20260616220000` (Studio system prompt) |
| J2 | QA gate + self-correct loop | ✅ (2026-06-16) | `studio.pr.merge` now refuses to merge while CI is red or pending (Cadence-level gate, not just GitHub required-checks); with the J1 prompt directing fix-on-red-until-green, the self-correct loop closes | `ai/studio-ci.ts` (12 tests) + `registry.server.ts` studio.pr.merge |
| K1 | Release notes for a shipped changeset | ✅ (2026-06-16) | Generate/regenerate factual release notes from a changeset (files + commit revisions + linked work order) via the AI chokepoint (auto-humanized), persisted on the changeset + shown in the Changes tab. PR/merge gates already exist (studio.pr.*, J2 CI-gated); deploy stays external. Note: owner-scoped generation (changeset RLS) | migration `20260616240000` + `generateReleaseNotes` + `ChangesPanel` section |
| K1-deploy | Cadence-triggered deploy gate | ⏭️ Deferred | Triggering the actual deploy from Cadence needs a Cloudflare/Lovable deploy hook + founder config; deploy is external today. Deferred (founder ruling: honest path, no speculative infra) | needs a deploy hook + token |
| K2 | Rollback triggers + one-action revert | ⬜ | Safe ship: documented rollback, feature-flag kill, UI revert | Revert path + flag kill |
| BLD-05 | Inspector gate (agent tests + preview before merge) | ⬜ | A preview + test bar before a merge proposal reaches you | Depends on J1/J2 |
| F-BUILDER-MULTIFILE | Scoped multi-file build (pre-declared touch list, max N files) | ⬜ | Thin slice of I1; safer multi-file edits | `studio.functions.ts` claims |
| BLD-04 | Delegate-out to external coding agents under governance | ⬜ (M4) | A2A-style hand-off of build work, still governed | Depends on Q2 |

---

## G4 - Launch & Learn
_Close the loop: ship to market, learn from outcomes, feed it back._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| LRN-04 | Product Memory consult/write runtime visibility | ◐ Partial | The memory loop is wired (W1); surfacing it per mission is N3 | `/memory` + Missions |
| LCH-01 / L1 | Launch-kit mission (changelog/blog/email/social/docs from diff + spec) | ⬜ (M2) | One mission drafts the whole launch, human-approved | New mission template + outbound send |
| L2 | Customer pages / announcements (`p.$slug`) | ⬜ (M2) | Public-facing announcement pages, approval to publish | `src/routes/p.$slug.tsx` |
| M1 / LRN-01 | Support triage loop (tickets → drafted replies → bug clusters → signals) | ⬜ (M2) | Support feeds back into Discover; the loop closes | Inbound channel + Analyst learn loop |
| LRN-02 | Outcome reviews (predicted vs actual, Historian verdicts) | ✅ (2026-06-17) | Honest scorekeeping that trains the next decision. Core was already built (`recordOutcome`: human verdict + ICE rescore + `learnings` + W1-AUTO `rememberOutcome`); this added the missing **Historian verdict (predicted vs actual)**: `suggestOutcomeVerdict` reads the opportunity's prediction (problem/hypothesis/predicted-ICE + H2 roadmap outcome/measure when synced) and the actual signal, then drafts a verdict + summary on the OutcomeCard for the human to confirm (reuses `surface:"judge"`; output enum-clamped; human-gated write). Adversarially reviewed (APPROVE; 1 MED + 1 LOW folded) | `outcome.functions.ts` (`suggestOutcomeVerdict`) + `OutcomeCard.tsx` |
| F-ANALYTICS-1 | Cohort metrics + telemetry ingestion → `product_analytics` | ⬜ | Released features get real usage data | Depends on SEN-05 |
| F-ANALYTICS-2 | Opportunity impact eval (post-release cohort → Product Memory → auto-ICE) | ⬜ | The loop learns whether a bet paid off | Depends on F-ANALYTICS-1 |
| N3 | Mission Compounding View ("referenced N prior decisions") | ✅ (2026-06-16) | Makes the moat visible per mission: "drew on N prior memories" + the lineage (each memory + which agent cited it) + a copy-snapshot export; deduped across per-hop recalls + handoff `memory_refs` | `_authenticated.missions.$missionId.tsx` (`MissionCompounding`, client-side from `getMission` — no new server fn needed) |

---

## G5 - Monetize & Growth (M-C)
_First paying PMs; a viral share loop._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| F-SHARE | Shareable-decision link | ✅ (2026-06-16) | The viral acquisition surface (also in G2) | [`features/shareable-decisions.md`](../features/shareable-decisions.md) |
| M-C-PRICE | Pricing + entitlements (plan_tier, billing fns, Stripe webhook, Settings→Plan) | ◐ Built, needs secrets | The revenue rails; cannot be self-granted (service-role write only) | [`features/pricing.md`](../features/pricing.md) · **founder sets Stripe secrets to go live** |
| M-C-EXPIRY | Memory-expiry enforcement engine | ⏸️ Dormant | Free memory expiry is built but gated **off** (`memory_expiry_enabled()`); flip on when monetizing | migration `20260616210000` |
| PLG | PLG funnel (public onboarding → first-win → upgrade) | ⬜ | Turns share-link traffic into activated, paying users | Public onboarding + W6 |
| W6 | Persona onboarding tracks (Solo / Founding PM / Tech Founder) | ✅ Shipped 2026-06-17 (live-verify on next publish) | Per-track sample data + first-win moment; cold-start fuel for WEDGE | [`onboarding-tracks.md`](../features/onboarding-tracks.md) |

---

## G6 - Interop & Team (M-D)
_Dual-user: external agents plug in; teams land._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| F-A2A | Internal A2A handoff contract | ✅ | Agents hand off missions with structured payloads | [`features/a2a-handoff.md`](../features/a2a-handoff.md) |
| Q1 / ENG-07 / F-MCP-V1 | MCP server + read-only externals (signals/opps/PRDs · append decision) | ◐ (Phases 1-3 done 2026-06-17) | Other agents/tools use Cadence as a tool; the interop moat | Phase 1 foundation + Phase 2 tool dispatch + **Phase 3 token UI** (Settings → Integrations: issue/revoke + connect snippets) all done. Remaining (Q2/Phase 4): full MCP streamable-HTTP transport + external discovery. Detail: [`features/q1-mcp.md`](../features/q1-mcp.md) |
| Q2 | A2A server/client + Agent Cards + scopes/audit (external) | ⬜ (M-D) | Peer agents discover and call us, governed | Extend A2A card + scopes |
| A6 / ENG-08 | Roles + RBAC + invites (owner/admin/member/viewer) | ⬜ (M-D) | Teams can actually use it together; per-persona approval lanes | Membership tables + RLS roles |
| U6 | Full data-portability / export wizard | ⬜ (P0/P1) | Trust + escape hatch: export signals, decisions+lineage, PRDs, memory graph | Export fn + audit log |

---

## G7 - Cockpit, IA & Observability
_The product feels coherent; the operator sees the machine._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| F-GAUNTLET | Gauntlet metrics (acceptance · autonomy · retention) | ✅ | The north-star metrics, honestly instrumented | [`features/gauntlet-metrics.md`](../features/gauntlet-metrics.md) |
| F-MEMVIEW | `/memory` compounding-memory view | ✅ (2026-06-14) | The moat made visible | [`features/memory-view.md`](../features/memory-view.md) |
| F-AUTONOMY | AutonomyCard on Today (observing→proving→trusted) | ✅ | The trust arc is visible to the operator | `src/lib/autonomy-progression.ts` |
| F-IA-V4 | Collapse IA to 7 surfaces + redirects + vocab enforcement | ⬜ **(marked "next up")** | One coherent product instead of scattered routes | Route consolidation + redirects |
| F-IA-TODAY-BRIEFING | Merge Today + Briefing | ⬜ | One morning surface, not two | Today route |
| F-TODAY-LOOPPULSE | Loop Pulse hero (what the loop did while you were away) | ✅ (2026-06-16) | Today's hero opens with a tight "While you were away · N signals · N opportunities · N specs · N agent runs · N memories" line (last 24h, non-zero parts only, hidden when quiet) — the second half of the Today mandate | `today.functions.ts` (`getLoopPulse`) + `_authenticated.index.tsx` hero |
| F-IA-CULL-CALDOCS | Remove /calendar, /meetings, /docs, /sync from nav (data kept) | ⬜ | De-clutter the operator nav | Nav config |
| F-IA-AGENTS-TABS | Fold /prompts + /agents into one Agents route | ⬜ | Agents live in one place | Route merge |
| E8 | Loop Health Monitor (per-product: stalls, queue depth, last ingest/deploy) | ✅ (2026-06-16) | An always-on health strip on the Missions surface: verdict (on watch / working / stalled) from stuck runs + expired calls, plus queue depth, last ingest, last run; the stalled state links to the engine room | `loop-health.functions.ts` (`getLoopHealth`) + `components/cockpit/LoopHealthBanner.tsx` + Missions index |
| B3 | Product switcher + portfolio view | ✅ (2026-06-16) | A Portfolio section on `/product`: every product with its loop status (task progress + signals/opps/specs counts) and click-to-switch (the active product is marked). New `getPortfolio` fn; switcher reuses `setActiveProductId`. Adversarially reviewed (1 medium: silent-zero-on-query-error, fixed). ⌘K product-switch deferred (CommandPalette is parallel-active) | `projects.functions.ts` (`getPortfolio`) + `_authenticated.product.tsx` |
| B5 | Archive / delete product (soft archive + hard delete w/ export) | ✅ (2026-06-17) | Full product lifecycle on the `/product` **Portfolio** (B3 continuation, extracted to `PortfolioBoard.tsx`): soft archive + restore (reversible, Undo toast; archived products drop from the sidebar + tabs, shown in an Archived section), JSON export of the product's whole footprint (the escape hatch), and an honest export-then-delete (typed-name confirm; copy reflects FK `on delete set null` — delete detaches signals/opps/specs/tasks to the workspace, doesn't destroy them; a snapshot downloads first). Verified RLS-scoped writes. Adversarially reviewed: 3 fixes (a runtime `useConfirm` destructure bug that only `tsc` caught, a serializable server-fn return, a verified delete) + a partial index. Place-into-archive write is gated on the next sync adding `archived_at`; reads are pre-migration tolerant | `projects.functions.ts` + `PortfolioBoard.tsx` + migration `20260617120000_b5_project_archive.sql` |
| ENG-06 / F-GOV-COST-SURFACE | Cost-per-outcome chip (front) + unit-economics roll-up (Engine Room) | ◐ | B1 (Today chip) + B3 (Engine Room roll-up) built 2026-06-17 · tsc/lint/build green (build needs bun runtime or Node ≥20.19; env Node 20.9.0 fails plain `bun run build` on a pre-existing lovable-tagger require(esm)) · B2 (Missions glance) deferred · live-verify on next publish. "What you got for what you spent" on the calm front; full per-agent telemetry behind the door (split-by-surface per the 2026-06-17 agent-manager decision) | Front: `getCostPerOutcome` chip on Today. Engine Room: `getUnitEconomics` in Analytics. Detail: [`cost-per-outcome.md`](../features/cost-per-outcome.md) · Decision: [`session-decisions.md`](../strategy/session-decisions.md) |
| F-AGENTS-MENTIONABLE | Agents as first-class @-mentionable users | ⬜ | "@discovery, re-cluster the last 50 signals" from any card | Mention parser → mission |
| R3 | Notifications (approvals, budget, guardrail, health, digests) | ⬜ | The operator hears about what needs them | In-app + email + prefs |
| R4 | Settings expansion (budgets, guardrails, health, prefs, admin) | ◐ Partial | Self-serve control surface (Plan tab shipped) | `_authenticated.settings.tsx` |
| F-COCKPIT-MACHINE-MODE | Human ↔ Machine mode toggle (full-screen dispatch board) | ⬜ | The "watch the factory" view (absorbed by F-IA-V4) | Header toggle |
| OPS-01 | Flow mode (ambient soundscape + focus timer, notification quieting) | ✅ (2026-06-16) | Calm, focused operating surface | Chrome: Flow widget in `AppShell` footer; calm-state dim + hold-then-summarize toasts (`lib/notify` facade) + real-audio soundscape with drop-in files (`lib/flow/*`, `public/soundscape/`) + custom timer · [`features/flow-mode.md`](../features/flow-mode.md) |

---

## G8 - Governance, Trust & Safety
_The loop runs the reversible work; you make the calls. Honest by construction._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| F-TRUST | Trust score + four autonomy arcs at the gate | ✅ | Autonomy is earned and visible | [`features/trust-and-autonomy.md`](../features/trust-and-autonomy.md) |
| FND-0.6 | Kill-switch + spend caps | ✅ | The brake pedal; budgets enforced server-side | [`architecture/security.md`](../../architecture/security.md) |
| F-HUMANIZE | `humanizeText()` runtime sanitizer at the chokepoint | ✅ (2026-06-14) | Zero AI fingerprints in generated output | `src/lib/ai/humanize.ts` |
| DEC-02 | Critic adversarial pass on opportunities | ✅ (verified 2026-06-16) | Opportunities get a red-team verdict (ship/revise/kill) at promotion, shown via CriticBadge | `discovery.functions.ts` `runCritic()` · promote-to-DAG-step is DEC-02-LOOP (M-B) |
| FND-0.7 | Prompt-injection defense (sanitize/delimit, isolation, quarantine) | ◐ Partial (verified 2026-06-16) | Untrusted tool/RAG output is XML-tagged + escaped with system warnings; guardrails support injection rules. Remaining: a learned injection classifier + hard quarantine from high-risk sources (regex-only today) | `loop.server.ts` (untrusted_tool_output) · `guardrails.server.ts` |
| FND-0.5 | Agent blast-radius limits (per-agent tool allow-list, scope) | ◐ Partial | An agent can't reach beyond its remit | `src/lib/ai/tools/registry.server.ts` |
| P4 | Eval harness + regression gate (≥10-pt blocks deploy) | ◐ Partial | Quality can't silently regress (scale fixed KI-14) | `/evals` + deploy gate |
| P5 | Drift watch (score/cost/latency per surface/model) | ◐ Partial | Catch model/cost drift early (passive watcher) | `/drift` |
| DEC-02-LOOP | Critic as an explicit loop step (M-B) | ✅ (2026-06-17) | Shipped the safe increment: the Critic is now a routable, gating-exempt agent-loop tool `critic.evaluate`. Extracted `runCritic` → `src/lib/ai/critic.server.ts`, registered in `TOOL_REGISTRY`, seeded into `agent_tools` (new + backfilled users). The orchestrator / any specialist can red-team in-loop. Full `mission_steps` DAG-node promotion deferred to Phase 2 (avoids the handoff/retry blast radius). | `critic.server.ts` + `registry.server.ts` + migration `20260617160000` |
| P3 | Prompt studio (versioning + A/B + pin + rollback) | ⬜ | Safe prompt iteration with rollback | `/prompts` |
| P7 | Incidents log (safety/guardrail/cost incidents → traces) | ⬜ | A record when something goes wrong | New incidents table + surface |
| C4 / E7 | Agent detail + run history + shared/private memory inspector | ⬜ | See and govern what each agent knows | Agent detail route |

---

## G9 - Platform & Foundation
_Load-bearing infra. Feature-relevant items only; pure perf/optimization is intentionally out of scope here (separate pass)._

| ID | Feature | Status | Why it matters / what it delivers | Cue / detail |
| --- | --- | --- | --- | --- |
| FND-AUTH | Auth + tenancy + RLS (`user_id`+`workspace_id`+`product_id`) | ✅ | The multi-tenant spine | [`architecture/security.md`](../../architecture/security.md) |
| FND-CHOKE | AI runtime chokepoint (`callModel`/`callModelStream`) | ✅ | One governed path for every AI call | [`architecture/runtime.md`](../../architecture/runtime.md) |
| KI-13 | Resilient signup (`handle_new_user` subtransactions) | ✅ (verify live) | A real account can be created without a 500 | migration `20260614140000` |
| KI-14 | Eval score scale → 0-100 | ✅ | Eval scores don't overflow / false-fail the gate | migration `20260614160000` |
| F-A2A-CARD | Public A2A agent card | ✅ | Discoverability for external agents | `src/routes/api/.well-known` |
| F-HUMANIZE-HOOK | Pre-commit dash/invisible-char trace hook | ⬜ | Build-time backstop for the humanization rule | `scripts/check-humanized.sh` → pre-commit |
| KI-15 / KI-16 | Stale zero-step-mission completion · advance 20/tick cap | ⬜ (low) | Rare edge cases; high-scale only | [`known-issues.md`](./known-issues.md) |
| HUMAN-SWEEP | Full-product humanization sweep (UI strings, seed data) | ⏭️ Deferred | Pre-launch gate; deferred so screen churn doesn't force a re-sweep | Founder-prompted at the launch gate |

---

## Status reconciliation note
Statuses here are reconciled from [`v7-build-status.md`](./v7-build-status.md) (milestone tags), [`../../active-task.md`](../../active-task.md) (latest shipped/dormant/parked detail), and [`feature-backlog.md`](./feature-backlog.md) (granular ledger). Where those docs conflict on a "done" claim, the row is marked **⚠️ Verify** rather than assumed - confirm against the live build before building. **The four ⚠️-Verify rows from the first cut were reconciled against the live code on 2026-06-16 (with file:line evidence): DEC-02 confirmed Done; FND-0.7, I1, and J2 confirmed Partial, with the specific remaining work noted in each row.** Granular acceptance criteria and "How to use / verify" blocks live in [`feature-backlog.md`](./feature-backlog.md); milestone exit criteria live in [`v7-build-status.md`](./v7-build-status.md); open bugs live in [`known-issues.md`](./known-issues.md).

## Related
- [`feature-backlog.md`](./feature-backlog.md) - granular ledger + Build-order rollup (this dashboard is its master view)
- [`v7-build-status.md`](./v7-build-status.md) - "what next" milestone narrative (M-0 to M-D)
- [`known-issues.md`](./known-issues.md) - open bugs with KI-IDs
- [`strategic-tasks.md`](./archive/strategic-tasks.md) - P0-P3 strategic buckets
- [`../../active-task.md`](../../active-task.md) - the current session cursor
- [`../../AGENTS.md`](../../AGENTS.md) §1 (pre-action) + §5 (doc-update protocol) - where the standing rule is enforced
