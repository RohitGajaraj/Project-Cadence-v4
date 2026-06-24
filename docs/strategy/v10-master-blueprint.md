# v10 - The Master Blueprint (granular: every feature, its pain point, what it is, how it functions, priority, and lane)

> _Created: 2026-06-17 · Last updated: 2026-06-19_

**Date: 2026-06-17. Status: CURRENT master execution blueprint.** The one doc that fuses the strategy canon (v7 positioning, v8 structure, v9 decision lens) with a file-grounded scan of `main`, and turns it into a granular, item-by-item plan you can build from one piece at a time. **If you are picking one doc to know exactly what to build next, why, how it should behave, and in what order, this is it.**

> **Precedence.** Positioning to [`v7`](./v7-agentic-product-os.md). Structure/surfaces to [`v8`](./v8-calm-front-deep-engine.md). Wedge/competitor/priority to [`v9`](./v9-decision-wedge-and-build-next.md). Raw reasoning to [`strategic-inputs-log.md`](./strategic-inputs-log.md). Live status to [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (v10 sets target + priority + lane; the dashboard tracks status; they stay consistent).
>
> **How to read this.** Sections 1 to 14 are the stable frame (tagline, positioning, the loop, pains, IA, screens, naming, the analytical engine, the agentic engine, connectors, architecture, pricing). **Section 15 is the granular feature catalog by disjoint build lane** (every feature: What / Pain / How / Build). **Section 16 is the priority pick-order** (what to build first, one at a time). Section 17 is the dashboard reconciliation. House style: no em dashes; ranges as "X to Y".

---

## 1. The one-line and the tagline

**Product one-liner:** Cadence is the agentic product OS where a PM decides what is worth building and watches it get built and shipped. Agents run the loop; you make the calls that matter; every decision and outcome compounds into memory the team can trust.

| Context | Verbatim | Why |
| --- | --- | --- |
| Launch hook (marketing) | **"The AI that red-teams your roadmap."** | Enters an existing emotional category; leads with judgment (v9 section 2). The shareable hook. |
| Site hero (positioning) | **"Decide what's worth building. Watch it ship."** | The two heroes in one breath (v8 Fork 2). |
| In-product footer (live) | **"Cadence - agents execute, you govern."** | Keep. The governance promise in five words. |
| Investor / category | **"The decision and memory system of record for product teams."** | The moat framing (v7). |

Do not ship "Agentic Product OS" as a public tagline (internal north star only).

---

## 2. Positioning spine (v7/v9 govern)

Felt entry: a PM Chief of Staff that red-teams your thinking and runs the reversible work. Moat: compounding decision memory (the only proprietary data, and the only way to manufacture a feedback signal in a domain with no fast oracle). Stance: ambient and governed, not autopilot; autonomy where there is an oracle (build/ship), governance where there is not (the calls). Beachhead: individual PM first, team as expansion.

---

## 3. The closed-loop product model (how it functions end to end)

```
   SENSE ──► DECIDE ──► DEFINE ──► BUILD ──► SHIP ──► LEARN ─┐
   cited     Critic     cited PRD  autonomous gated    outcome │
   signals   red-teams  + tasks    delivery   merge    review, │
   (Connect  the bet    (Scribe +  (own 80% +          memory  │
   + webhook)[GATE 1]   Critic)    BYO 20%)   [GATE 2]  rescore │
        ▲                                                       │
        └──────── memory compounds under every station ◄────────┘
```

Two human gates (the decision call, the merge approval); everything else runs unattended under governance; the autonomy dial loosens gating per agent as trust is earned; LEARN writes outcomes back to memory, which re-ranks SENSE and sharpens DECIDE. That write-back is what makes it compound rather than merely run.

---

## 4. The pain-point map (every pain, mapped to the feature that kills it)

The "why" behind the build. These are the PM pains the loop must remove; each maps to a catalog feature in section 15.

| # | Pain (the PM's words) | Today's broken workaround | The Cadence feature that kills it | Lane |
| --- | --- | --- | --- | --- |
| 1 | "Signal is scattered across 15 tools; I miss things and react late." | Manual triage across Intercom/Gong/Notion/email | Live ingest + clustering (SEN-01, F3, SEN-05) | A |
| 2 | "I can't defend my roadmap calls; I get overruled or burned." | Gut + slides | Critic red-team with evidence (DEC-02, the teardown) | C |
| 3 | "Writing PRDs and breaking down tasks eats my week." | Docs + Jira by hand | Cited PRD + task graph (H1) | C/Define |
| 4 | "Shipping needs eng I don't control; my context gets lost across the seam." | Tickets + waiting | Autonomous build engine, one dispatch from an approved PRD (F-STUDIO + spine) | D |
| 5 | "I never learn whether a bet paid off; nothing compounds." | Memory in my head, lost at handover | Outcome reviews + compounding memory (LRN-02, outcome-memory) | B |
| 6 | "I don't trust the AI; one confident wrong answer and I'm done." | Avoid AI for real calls | Citations, the Critic, the audit trail, governed autonomy | B/Gov |
| 7 | "Too many tools; the switching tax is brutal." | 93 apps, 1 hr/day lost | One platform, the whole loop; BYO-key, OAuth Connect | A/D |
| 8 | "I want help without buying enterprise tooling." | Spreadsheets + ChatGPT tabs | Individual PM tier, self-serve, $39 (PLG, W6) | E |

---

## 5. Current state vs target (vis-a-vis scan, file-grounded `main` 2026-06-17)

| Station | Built (real) | Gap to close | Lane |
| --- | --- | --- | --- |
| SENSE | Webhook ingest (KI-10); connector registry OAuth-wired (github/linear/notion/gdocs/gcal/outlook); signals to themes to opportunities (ICE) | Connectors operational; >=2 live sources; continuous feed; analytics inbound; audio | A |
| DECIDE | Critic on opportunities (DEC-02); decision card + badge (F-DEC-CARD); shareable link (F-SHARE) | Critic as routable step; the packaged teardown first-run; roadmap live writes | C |
| DEFINE | Cited PRD (H1); Critic-on-spec (DEF-03); prd to mission lineage | Task graph from PRD | C |
| BUILD | Full hybrid engine (I1/I2/I3/J1/J2/K1) | Sandbox+preview; BYO-key delegate-out; rollback; ambient arc | D |
| SHIP | PR gated; release notes | Launch-kit mission; announce pages; deploy trigger (deferred) | D/G |
| LEARN | Outcome roll-ups; memory recall + handoff threading (W1); compounding view (N3); brief insight (N2) | Real outcome reviews (LRN-02); outcome-memory auto-trigger; cohort analytics | B |
| Engine | Chokepoint (kill-switch to budget to guards to RAG to provider to humanize to log); BYO-key; auto-advance; 19-mesh to 5 faces; 31 tools; trust/autonomy dial | Ambient arc seeding; outcome-compound; MCP server; analytical depth | B/D/F |
| Monetize | plan_tier/entitlements; Stripe (REST) + webhook; expiry engine dormant | Switch on; PLG; persona onboarding | E |

**Verdict:** engine + build spine real; the loop *ends* (live ingest, real outcome learning) and the *packaging* (wedge, onboarding, interop, analytical depth) are the unfinished, highest-leverage work.

---

## 6. Information architecture and navigation (target = the live calm front; confirmed)

Five calm top-level surfaces + Trust row + one Engine Room door. No new top-level routes.

- **Daily rail:** Today (`/`), Ask (`/chat`).
- **The loop:** Product (`/product`), Build (`/build`), Brain (`/knowledge`), Missions (`/missions`).
- **Trust row (footer):** Approvals (live badge) → `/govern?tab=approvals`, Spend → `/govern?tab=budgets`, Engine Room → `/govern`, Connectors → `/sync`.
- **Engine Room tabs (outcome-named; ids never change):** Controls, Approvals, Safety (`guardrails`), Spend (`budgets`), Prompts, Quality checks (`evals`), Analytics, Loop health (`gauntlet`), Activity (`traces`), Trends (`drift`). New observability lands here as a tab, never a top-level route.
- **Command palette (Cmd-K):** keep navigate + "Ask AI anything"; add "Red-team this" quick action.
- The Critic-teardown wedge surfaces on **Today**, not a new surface.

---

## 7. Screen-by-screen (current, gap, how it should function)

| Surface | Hero | Now | Gap / how it should function |
| --- | --- | --- | --- |
| **Today** `/` | DECIDE | call-count line, vitals, cleared ring, decision cards, pulse, top priorities, bottlenecks, what-changed, brief, agents rail, tasks | Add the **Critic-teardown first-run** as cold-start hero + a "challenge a bet" card; make it the shareable artifact. Answers "what needs me, what to push, what changed" in 1 to 3 clicks; never a passive dashboard. |
| **Product** `/product` | sense→decide→define | signals, opportunities (ICE), specs, roadmap (H2), portfolio (B3) | Continuous discovery feed; Critic verdict inline on opportunity detail; roadmap place-into-bucket writes (migration sync). The work surface where signal becomes a Critic-checked decision. |
| **Build** `/build` | SHIP | live cockpit, per-hunk curation, branch isolation, CI gate, release notes; PRD picker dispatches a mission | Sandbox+preview so self-correct is a loop action; BYO-key delegate-out; rollback. Feels like Cursor but autonomous; one dispatch in, merge approval out. |
| **Brain** `/knowledge` | LEARN / moat visible | Memory, Learnings, Decisions, Docs, Calendar | "this learning moved these priorities"; outcome reviews (LRN-02) as a first-class Learnings view. The company brain a competitor cannot backfill. |
| **Ask** `/chat` | cross-cut | web-grounded + RAG chat, model switcher, message footer (model/via/cost/latency/sources/feedback) | "Red-team this" + "Capture decision" inline; deep-linked citations. Grounded, cited, never a raw error; can spawn a mission. |
| **Missions** `/missions` | the loop, visible | orchestrated missions, agent roster, swarm HUD, compounding view (N3), loop-health banner (E8) | Cancel/replay/checkpoints (D4); @-mentionable agents (later). Watch the mesh run; every hop cites the memory it drew on. |
| **Engine Room** `/govern` | the one door | 10 outcome-named tabs, fully drillable; audit trail first-class | Cost-per-mission chips (ENG-06); incidents log (P7). The 95% never open it; operator gets full depth one click in. |
| **Settings/Connectors/Public** | - | Plan tab; Connect button (OAuth) + webhook card; anon-safe `/d`,`/p` share | PLG-aware onboarding; the share link is the viral loop. |

---

## 8. Naming and verbatim conventions

Product name: **Cadence** only (retired experiment name never reintroduced; internal `studio.*` slugs intentionally not renamed, user-facing is **Build**). Name the outcome not the mechanism (Safety/Spend/Quality checks/Activity/Trends/Loop health/Brain/Ask). Voice: human, clear, contractions, active, one idea per sentence; H1 <= 6 words, button <= 3, toast <= 12. Banned: em/en dashes, buzzwords (seamlessly, leverage, empower, robust, powerful, unlock), triple-listicles, preamble, hedged confirms, trailing "!". Confirms name the effect. Humanized output is a hard gate (the `humanizeText()` sanitizer enforces it on generated prose). Canon lines: "All clear. The loop is running itself." / "Cadence - agents execute, you govern." / "Every autonomous action is cited, observable, gated, and reversible."

---

## 9. The analytical engine (make it genuinely strong; founder priority)

Not a BI dashboard; the closed measurement loop that proves the agents work and that the moat compounds. Five layers (current → target), all in Lane B:
1. **Run analytics (built):** `ai_events` per call. Target: cost-per-mission/artifact rollup (ENG-06) so unit economics sit in front of the operator.
2. **Proof metrics / gauntlet (built):** acceptance, autonomy, retention. Target: add **outcome-accuracy-lift-per-PM** (the scale-independent moat metric; the investor metric).
3. **Outcome learning (the #1 gap):** LRN-02 predicted-vs-actual + Historian verdicts to `learnings`, plus the outcome-memory auto-trigger (scaffolded, not wired). Closes the loop.
4. **Quality + drift guards (built):** eval harness (0-100, threshold) + drift watch. Target: eval as a hard deploy gate.
5. **Product/cohort analytics (absent):** SEN-05 inbound to `product_analytics`, then F-ANALYTICS-2 (post-release cohort to Product Memory to auto-ICE). The outer measurement loop.

Principle: every analytical surface either proves an agent is trustworthy or compounds the moat. No vanity metrics.

---

## 10. The agentic engine and autonomy

Roster: 19 internal slugs to 5 faces (Scout/Strategist/Critic/Scribe/Chief of Staff); all routable via the orchestrated DAG; Critic inline today (promote to a routable DECIDE step). Loop: orchestrator plans the DAG; deterministic model-free `advanceMissionCore` reflects/dispatches/finalizes every tick; adaptive step budgets; bounded retry; memory recalled into each hop's handoff. Tools (31): read inline; write/build gated by mode (auto/confirm/review) with safety floors. Autonomy dial: observing→proving→trusted→ambient from real signals; **wire the ambient arc** (mode resolver supports it; not seeded) and auto-advance arc on clean missions (scaffolded). Push BUILD toward full unattended self-correction (CI is the oracle); keep the merge gate human-held.

---

## 11. Connectors and plugins

Rule: Connect-button OAuth only for users, no key paste. Live OAuth-wired (operational once the founder registers each OAuth client): GitHub (App), Linear, Notion, Google Docs, Google Calendar, Outlook, Figma (reference); Jira parked; Firecrawl infra-only. Credential chain: workspace binding → user connection → env fallback; secrets AES-256-GCM, service-role vault. Next: register one client for a second live ingest (SEN-01), then analytics inbound (SEN-05). **MCP server (pull forward from M-D):** a thin read-only surface (read signals/opps/PRDs, append decision) so Cadence is the neutral brain other agents plug into; a moat against the workspace incumbents (v9 section 3).

---

## 12. Architecture (the spine)

Layers: client (TanStack Start/React 19/Vite, Cloudflare Worker) → auth+tenancy (Supabase RLS by user+workspace+product) → orchestration (mission DAG, gates, checkpoints) → the AI chokepoint (`runtime.server.ts`: kill-switch → budget → guards → RAG → provider → humanize → log) → models (Claude/Gemini/GPT/DeepSeek + BYO) + data (Postgres, pgvector, pg_cron). Build spine: own the autonomous delivery engine for PM-shaped work (the 80%); the heavy 20% is a BYO-key escape hatch, not a revenue-split dependency; the one genuinely new build is the **sandbox + live preview** (Cloudflare Sandbox SDK / E2B / Vercel Sandbox). Data spine (moat object): decision → evidence → outcome as a queryable, embeddable graph. Margin: BYOK + small-model routing + cache are architecture, not optimization.

---

## 13. Pricing strategy (the build bible §2.4 governs the live model)

The current model is the 5-tier **Constellation** ladder presented Anthropic-style as **two toggles** (Individual: Free / Pro / Max; Business: Team / Enterprise), with usage **variants inside Max and Team**. This table is a summary; the canonical matrix + the variant packaging live in [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) §2.4 + §2.4.1.

| Tier (toggle) | Price (founder-gated) | Sold on | State |
| --- | --- | --- | --- |
| Free (Individual) | $0 | features; starter usage; memory decays ~30d | built; expiry dormant |
| Pro (Individual) | ~$20/mo | features only (persistent memory, Critic everywhere, share links); no public usage number | rails built; needs Stripe secrets |
| Max (Individual) | one card: "5x" / "20x more usage than Pro" (~$100 / ~$200) | the power-individual usage step; deepest memory + priority | WM-M17 (deferred, post-core) |
| Team (Business) | one card: Standard (~$25-30/seat) / Premium seat | shared/pooled memory, per-role lanes, RBAC, per-member caps | entitlements built; WM-M17 seat variants deferred |
| Enterprise (Business) | per-seat + API-rate usage + per-user allocation; contact sales | SSO, audit, residency, governance | WM-M19 (deferred); architecture ready |

Margin is held by **right-sized credit grants + cost-aware routing + caching** (WM-M15), not BYO-key (self-serve BYOK was removed 2026-06-19; enterprise-only). Usage multipliers show only on Max + Team seats; Free/Pro are feature-led (§2.4.1 copy rule). Outcome pricing stays a later experiment (unit unsolved); ship seat/usage first. Switch-on: founder sets Stripe secrets + the variant numbers (bible §7); flip memory-expiry only when first-win is reliable.

---

## 15. The granular feature catalog (by disjoint build lane)

Every actionable feature, grounded in code + the dashboard. Format per item: **`ID` State · Priority** then **What / Pain / How / Build** (acceptance + primary files). State: ✅ done · ◐ partial · ⬜ pending · ⏸ parked · ⏭ deferred. Priority: **P0** (loop-closing + wedge, build now) · **P1** (monetize + defend + autonomy) · **P2** (depth + breadth) · **CUT/DEFER** (not now). Lanes are file-disjoint so they can be picked up one at a time without collision.

### Lane A - SENSE / ingestion
*Owns: `src/lib/connectors/`, `ingest.functions.ts`, `discovery.functions.ts`, signals/themes tables.*

- **`F-CONN`** ⏸ · **P0 (founder action)** — *What:* OAuth connector platform (built, parked). *Pain:* #1, #7. *How:* one Connect button per provider; rows flip live on client-ID env secrets. *Build:* founder registers >=1 OAuth client (GitHub or Linear); zero code. Unblocks SEN-01.
- **`SEN-01`** ⬜ · **P0** — *What:* a second live ingest source. *Pain:* #1 (the loop can't close on real data with one webhook). *How:* a registered connector pulls real signals → clusters into themes/opportunities. *Build accept:* a non-webhook signal clusters into an opportunity on a real account. *Files:* `connectors/` adapter + `discovery.functions.ts`.
- **`SEN-05`** ⬜ · **P1** — *What:* analytics inbound (PostHog/Amplitude/Mixpanel) → `product_analytics`. *Pain:* #1, #5 (no usage signal feeds the loop). *How:* connector adapter writes product metrics as first-class signals. *Build:* one analytics provider lands cohort events. Feeds Lane B's F-ANALYTICS-2.
- **`F3`** ◐ · **P2** — *What:* continuous discovery feed (always-fresh, incremental re-cluster). *Pain:* #1. *How:* per-product feed + incremental re-cluster vs today's manual Scout ingest. *Files:* discovery functions + `/product` feed UI.
- **`F-AUDIO-1/2`** ⬜ · **CUT/DEFER (post-PMF)** — *What:* meeting transcription → action-item extraction. *Pain:* #1, #3. *Why defer:* high build cost, not loop-closing; revisit after the wedge proves.
- **`SEN-04`** ⬜ · **CUT/DEFER** — *What:* competitor watchtower (Firecrawl crawl briefs). *Why defer:* nice ambient signal, not on the critical path.

### Lane B - LEARN / the analytical engine (the moat)
*Owns: `outcome.functions.ts`, `src/lib/ai/memory.server.ts`, `outcome-memory.ts`, `learnings`/`gauntlet`/`drift`/`evals`/`analytics` functions.*

- **`LRN-02`** ⬜ · **P0** — *What:* real outcome reviews (predicted vs actual, Historian verdict). *Pain:* #5, #6 (nothing compounds; no honest scorekeeping). *How:* on a shipped/closed decision, capture predicted vs actual, write a verdict to `learnings`, re-score the opportunity ICE. *Build accept:* closing a decision produces a verdict + an ICE rescore visible on Brain. *Files:* `outcome.functions.ts`, new review fn, `learnings` table.
- **`W1-AUTO` (outcome-memory auto-trigger)** ◐ · **P0** — *What:* wire the scaffolded `buildOutcomeMemory`/`rememberOutcome` to fire on decision close. *Pain:* #5 (the moat object exists but does not auto-compound). *How:* on outcome write, embed + store an `agent_memory` row (`metadata.source="outcome"`) that future recalls surface. *Build accept:* a closed decision's outcome is cited by a later mission's handoff. *Files:* `src/lib/ai/memory.server.ts`, `outcome-memory.ts`.
- **`MOAT-VIS` (moat visibility)** ⬜ · **P0** — *What:* surface "this learning moved these priorities". *Pain:* #5, #6 (the compounding is invisible). *How:* on Today's what-changed + Brain Learnings, show the rescore and its cause. *Build accept:* a rescore renders with the learning that caused it. *Files:* `today.functions.ts`, `_authenticated.knowledge.tsx`.
- **`MOAT-METRIC` (outcome-accuracy-lift-per-PM)** ⬜ · **P1** — *What:* the scale-independent moat metric. *Pain:* #6 + investor proof. *How:* measure recommendation quality vs a generic-model baseline as a single account's memory grows; show on the gauntlet. *Files:* `gauntlet.functions.ts`.
- **`F-ANALYTICS-1`** ⬜ · **P1** — *What:* cohort metrics + telemetry to `product_analytics`. *Pain:* #5. *How:* released features get real usage data. *Depends:* SEN-05.
- **`F-ANALYTICS-2`** ⬜ · **P1** — *What:* post-release cohort → Product Memory → auto-ICE. *Pain:* #5 (the outer loop). *How:* a shipped bet's real usage re-scores the roadmap automatically. *Depends:* F-ANALYTICS-1.
- **`ENG-06` (cost chips)** ⬜ · **P2** — *What:* cost-per-mission/artifact chips. *Pain:* margin discipline. *Files:* read `token_usage`/`ai_events`; chip on Build/Engine Room.
- **`P4` (eval deploy gate)** ◐ · **P2** — *What:* eval regression blocks deploy (>=10pt drop). *Pain:* #6. *How:* harden the existing harness into a hard gate.

### Lane C - DECIDE / the wedge
*Owns: `discovery.functions.ts` Critic path, `today.functions.ts`, `decisions-share.functions.ts`, onboarding first-run.*

- **`WEDGE` (Critic-teardown first-run)** ⬜ · **P0 (the launch wedge)** — *What:* "point Cadence at a feature you believe in, get an evidence-backed teardown." *Pain:* #2 (can't defend calls). *How:* a guided first-run takes a feature idea + connected signals, runs the Critic, returns a cited red-team in <10 min; lands on Today. *Build accept:* a new user gets a cited teardown in the first session. *Files:* onboarding (with W6), `discovery.functions.ts` Critic path, Today hero.
- **`F-SHARE-TEARDOWN`** ◐ · **P0/P1 (viral loop)** — *What:* make the Critic teardown the shareable `/d/$slug` artifact (F-SHARE rails exist). *Pain:* growth. *How:* one click publishes a redacted teardown card; it drives signups. *Build accept:* the share link renders the teardown, anon-safe.
- **`DEC-02-LOOP`** ⬜ · **P1** — *What:* promote Critic from inline call to a routable DECIDE step in the DAG. *Pain:* #2, #6 (every call should be challenged in-loop). *Files:* orchestrator step + `registry.server.ts`.
- **`H2-WRITES`** ◐ · **P1** — *What:* outcome-roadmap place-into-bucket live writes. *Pain:* #2. *How:* commit opportunities to Now/Next/Later with a declared outcome+measure; gated on the migration sync. *Files:* `roadmap.functions.ts`, migration sync.
- **`H1-TASKS` (task graph)** ◐ · **P1** — *What:* PRD → engineering task graph (DAG). *Pain:* #3. *How:* an approved PRD decomposes into ordered work units feeding BUILD. *Files:* `tasks.functions.ts`, `tasks` table.

### Lane D - BUILD / the autonomy spine
*Owns: `studio.functions.ts`, `src/lib/ai/tools/registry.server.ts`, `loop.server.ts`, new sandbox service.*

- **`SANDBOX` (sandbox + live preview)** ⬜ · **P1** — *What:* the one justified new build. *Pain:* #4 (no real test run / preview; self-correct is CI-polling). *How:* a sandbox service runs tests + renders preview so CI-fail triggers an in-loop re-plan and re-diff. *Build accept:* a failing test triggers an autonomous re-diff with no human poke. *Files:* new sandbox integration + `studio.functions.ts`.
- **`AMBIENT-ARC`** ◐ · **P1** — *What:* seed + wire the ambient autonomy stage + auto-advance arc. *Pain:* #6 (autonomy must be earned and visible). *How:* a trusted agent runs confirm-gated tools unattended where safe; arc auto-advances on clean missions (scaffolded in `reflection.server.ts`). *Build accept:* a trusted agent runs a confirm-gated tool unattended, shown on the autonomy card. *Files:* `trust.server.ts`, `reflection.server.ts`, `agent_autonomy`.
- **`BLD-04` (BYO-key delegate-out)** ⬜ · **P2** — *What:* escape hatch to external coding agents for the heavy 20%, under governance, customer's own key. *Pain:* #4, #7 (no revenue split). *How:* a mission classifier flags heavy work → delegate with BYO key. *Build accept:* a flagged-heavy mission delegates; default path stays in-platform.
- **`K2` (rollback)** ⬜ · **P2** — *What:* one-action revert + feature-flag kill. *Pain:* #4, #6 (safe ship). *Files:* revert path + flag kill.
- **`BLD-05` (inspector gate)** ⬜ · **P2** — *What:* preview + test bar before a merge proposal. *Depends:* SANDBOX.

### Lane E - MONETIZE / PLG
*Owns: `billing.functions.ts`, `entitlements.ts`, onboarding, `_authenticated.settings.tsx`, PLG funnel.*

- **`W6` (persona onboarding)** ⬜ · **P0/P1 (also enables the wedge)** — *What:* per-track onboarding (Solo PM / Founding PM / Tech Founder) with sample data + first-win. *Pain:* #8. *How:* a new user picks a track, gets seeded data, reaches the teardown first-win fast. *Build accept:* a signed-up PM reaches first-win without hand-holding. *Files:* onboarding flow + seed data.
- **`PLG` (funnel)** ⬜ · **P1** — *What:* public onboarding → first-win → upgrade. *Pain:* growth. *Depends:* W6, F-SHARE-TEARDOWN.
- **`M-C-PRICE` (switch-on)** ◐ · **P1 (founder secrets)** — *What:* flip billing live. *How:* set Stripe secrets + price IDs; webhook updates plan_tier. *Build accept:* a real upgrade changes plan_tier.
- **`M-C-EXPIRY` (memory-expiry flip)** ⏸ · **P1** — *What:* enable free-tier 14-day expiry (the paid pull). *How:* flip `memory_expiry_enabled()` once first-win is reliable.

### Lane F - INTEROP / the neutral brain
*Owns: new MCP route, A2A card.*

- **`Q1-MCP` (read-only MCP slice)** ⬜ · **P1 (pull forward)** — *What:* expose read signals/opps/PRDs + append-decision over MCP. *Pain:* the workspace-incumbent threat (v9 section 3). *How:* an external agent uses Cadence as a governed tool. *Build accept:* an external agent reads an opportunity and appends a decision, governed. *Files:* new MCP route (A2A card route exists).
- **`Q2` (A2A external)** ⬜ · **P2** — peer agents discover + call us, scoped/audited.
- **`U6` (data export)** ⬜ · **P2** — full export (signals, decisions+lineage, PRDs, memory graph); the trust/escape-hatch.

### Lane G - COCKPIT / IA / governance polish
*Owns: routes, `AppShell.tsx`, Engine Room tabs.*

- **`D4`** ⬜ · **P2** — cancel / replay-and-branch / checkpoints on a mission.
- **`P7`** ⬜ · **P2** — incidents log (safety/guardrail/cost) → traces.
- **`P3`** ⬜ · **P2** — prompt studio (versioning + A/B + rollback).
- **`R3`** ⬜ · **P2** — notifications (approvals, budget, health, digests).
- **`B5`** ⬜ · **P2** — archive/delete product (soft + hard with export).
- **`FND-0.7`** ◐ · **P2** — injection classifier + hard quarantine (regex-only today).
- **IA culls** (`F-IA-CULL-CALDOCS`, `F-IA-AGENTS-TABS`) ⬜ · **P2** — finish nav de-clutter.

### CUT / DEFER (mark down, do not build now)
- **`K1-deploy`** ⏭ — Cadence-triggered deploy needs a deploy hook + founder config; deploy stays external. Keep deferred.
- **F-AUDIO-1/2, SEN-04** — defer to post-PMF (Lane A).
- **The full 19-agent mesh breadth** — defer; the 5-face loop must close on real data first (v7 section 7).
- **Outcome-pricing machinery** — defer; ship seat/usage first (v9, section 13).
- **Team/RBAC (A6) beyond the MCP slice** — defer to M-D.

---

## 16. The priority pick-order (build one item at a time)

> **Pick-order overlay (founder rulings 2026-06-20 + 2026-06-21; this section predates both).** The live, operative pick-order is now the numbered **Build Sequence** in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (mirrored in [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) §0); build the lowest open number, do not deliberate. Two changes sit on top of the §16 ranking below: (1) the **Decision Brain (H1)** and its **supersession engine (DBR-1.5)** are TOPMOST, ahead of every §16 pick; (2) the monetization / credit / pricing items (`M-C-PRICE`, `WM-M*`, `BYO-P4`) are **Lovable-owned** and removed from the autonomous order. The §16 ranking still governs WITHIN the non-gated, non-Lovable, non-H1 remainder, and its #1/#3 loop-closers (`LRN-02`/`W1-AUTO`, `MOAT-VIS`) remain correct, now just below H1. Do not follow §16 literally as the pick-order; follow the Build Sequence.

Lanes are file-disjoint, so a session claims a lane and builds its top item. Recommended order; items within a tier can run in parallel sessions across different lanes.

**P0 - build first (close the loop + land the wedge):**
1. **`LRN-02` + `W1-AUTO`** (Lane B) - real outcome reviews + auto-compound. *This closes the loop; nothing matters more.*
2. **`WEDGE`** (Lane C) - the Critic-teardown first-run. *The thing a PM feels in 10 minutes.*
3. **`MOAT-VIS`** (Lane B) - make the compounding visible.
4. **`SEN-01`** (Lane A) - second live source (after the founder registers an OAuth client, `F-CONN`).
5. **`W6`** (Lane E) - persona onboarding (also the wedge's delivery surface).

**P1 - monetize, defend, deepen autonomy:**
6. `F-SHARE-TEARDOWN` + `PLG` + `M-C-PRICE` (Lane E/C) - the viral + revenue loop.
7. `Q1-MCP` (Lane F) - the neutral-brain moat, pulled forward.
8. `SANDBOX` + `AMBIENT-ARC` (Lane D) - full build autonomy.
9. `SEN-05` + `F-ANALYTICS-1/2` + `MOAT-METRIC` (Lane A/B) - the outer analytical loop.
10. `DEC-02-LOOP` + `H1-TASKS` + `H2-WRITES` (Lane C) - DECIDE/DEFINE depth.

**P2 - breadth/polish:** `ENG-06`, `BLD-04`, `K2`, `D4`, `P7`, `P3`, `R3`, `B5`, `FND-0.7`, IA culls.

**Parallel-safe lane pairs** (no file collision): A+B, B+C, C+E, D-alone (touches loop.server/registry, coordinate), F-alone, G-alone. Always claim the lane on the dashboard before starting.

---

## 17. Dashboard reconciliation (done this session)

The [feature dashboard](../planning/feature-dashboard.md) is updated to match this blueprint: a **Priority + Lane** overlay (the "pick-list" in dashboard section form), the new items above that were not yet rows (`W1-AUTO`, `MOAT-VIS`, `MOAT-METRIC`, `WEDGE`, `F-SHARE-TEARDOWN`, `SANDBOX`, `AMBIENT-ARC`, `Q1-MCP`), and the CUT/DEFER marks. The dashboard remains the live status board; v10 is the stable target + priority + lane. When a row ships, flip it there and in the build log; this blueprint changes only when strategy or sequencing changes.

---

## 18. The closed-loop doc map (nothing siloed)

Up to canon: [`v7`](./v7-agentic-product-os.md), [`v8`](./v8-calm-front-deep-engine.md), [`v9`](./v9-decision-wedge-and-build-next.md), [`strategic-inputs-log.md`](./strategic-inputs-log.md), [`session-decisions.md`](./session-decisions.md). Down to execution: [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md), [`../planning/archive/feature-backlog.md`](../planning/archive/feature-backlog.md). Across to contracts: [`../../README.md`](../../README.md), [`../../AGENTS.md`](../../AGENTS.md), [`../../architecture/`](../../architecture/), [`../conventions/`](../conventions/). Referenced from: README doc map, CLAUDE.md read-order, AGENTS.md section 0, strategy/README index.
