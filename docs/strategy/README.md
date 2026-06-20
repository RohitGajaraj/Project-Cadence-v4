# docs/strategy: Strategic Positioning History

> _Created: 2026-06-03 · Last updated: 2026-06-19_

> The versioned record of Cadence's product positioning, market analysis, and strategic direction. Each version captures the thinking at a point in time so future decisions can be made with full context on how the position evolved and why.

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is **Cadence**, and that is the only name to use. A brief 2026-06-10 rename experiment to a different brand was reverted on 2026-06-16; the retired name must not be reintroduced anywhere (code, docs, DB, env, caches, APIs). Any stray legacy token from that experiment is to be read as equivalent to `cadence`/`Cadence`.

---

## Which doc to pick (the role map - read this if unsure; one source per need, no duplication)

| If you need... | Pick this ⭐ | Role |
| --- | --- | --- |
| **What to build next, why, how it should look and behave, priority + lane** | [**v10 master blueprint**](./v10-master-blueprint.md) | the blueprint (pick first) |
| **How we execute it** (build order, per-item discipline, milestone gates) | [**v10_implementation-plan.md**](../planning/v10_implementation-plan.md) | the how |
| **Live status of every feature** (the cursor) | [**feature-dashboard.md**](../planning/feature-dashboard.md) | the status board |
| **The workspace / accounts / tenancy + monetization build (current initiative)** | [**workspace-tenancy-and-monetization-plan.md**](../planning/workspace-tenancy-and-monetization-plan.md) | the cross-tool build bible (per-ID specs; live board group G10) |
| **What is our moat, who do we compete with (YC + interview prep)** | [**moat.md**](./moat.md) | the moat / competition / defensibility canon (decision-layer thesis; memory is one layer; objection Q&A; ripple-review process) |
| **Build vs buy vs integrate any capability** (build the moat, buy the commodity, integrate behind a seam) | [**build-buy-integrate.md**](./build-buy-integrate.md) | the BBI decision gate (7 questions + decision rule) + the worked memory / Decision-Brain stack verdict; operative rule in AGENTS.md §3.0c + SSOT §1 ruling 10 |
| **Forward product bets not yet in the build queue (the Decision Brain, the Command Canvas)** | [**horizon-bets.md**](./horizon-bets.md) ⭐ | forward-bets register; links the self-contained drill-downs [`../features/decision-brain.md`](../features/decision-brain.md) + [`../features/command-canvas.md`](../features/command-canvas.md) |
| **The BYO repo model + all-in-one platform** (provider-agnostic repos, autonomous Build to Ship, managed runtime) | [**byo-build-and-cadence-cloud.md**](./byo-build-and-cadence-cloud.md) (spec) + [**byo-build-implementation-plan.md**](../planning/byo-build-implementation-plan.md) (all-phase plan; board group G11) | the repo/platform reframe |
| Positioning / market / pricing / GTM / investor | [v7](./v7-agentic-product-os.md) | positioning canon |
| Surfaces / IA / structure / the hybrid Build spine | [v8](./v8-calm-front-deep-engine.md) | structure canon |
| The launch wedge / competitor posture | [v9](./v9-decision-wedge-and-build-next.md) | decision lens |
| The raw reasoning + the fundraising/YC narrative | [strategic-inputs-log.md](./strategic-inputs-log.md) | source reasoning |
| Why a decision was made | [session-decisions.md](./session-decisions.md) | decision log |
| Granular acceptance criteria per feature | [feature-backlog.md](../planning/feature-backlog.md) | granular ledger |
| Milestone exit criteria | [../planning/SOURCE-OF-TRUTH.md](../planning/SOURCE-OF-TRUTH.md) (sections 2-3) + [../planning/v10_implementation-plan.md](../planning/v10_implementation-plan.md) | milestone narrative |
| Open bugs | [known-issues.md](../planning/known-issues.md) | bug list |
| Engine / 19-agent mesh / handoff contract detail | [v4-feature-map](archive/v4-feature-map.md) | engine reference |
| **Agent roster model, faces, identity, and how agents are shown (the relay)** | [agent-experience](../features/agent-experience.md) | agent-experience canon (resolves 19 -> 6 -> cast/crew) |
| Requirements / technical contracts | [v7-prd](../planning/archive/v7-prd.md) / [v7-trd](../planning/archive/v7-trd.md) (archived, superseded by v10) | requirements reference |
| **Superseded - do not use; archived 2026-06-17 to docs/planning/archive/** | `strategic-tasks.md` (use v10 pick-list), `v7-feature-map` + `v7-functionality-map` (use v10), `v4-rebuild-handoff` (stale) | historical |

> **De-dup status (updated 2026-06-19):** the superseded docs above (`strategic-tasks.md`, `v7-feature-map`, `v7-functionality-map`, `v4-rebuild-handoff`) have now been moved to [`../planning/archive/`](../planning/archive/). Use v10 (and the SSOT / `feature-backlog.md`) instead. **This role map remains the single arbiter of which doc to pick.**

---

## Versions

| Version                                                                           | Date       | Summary                                                                                                                                                                                                                                                            | Status                      |
| --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| [**v10: The Master Blueprint**](./v10-master-blueprint.md) | 2026-06-17 | **⭐ CURRENT master execution blueprint.** The single doc that fuses v7 (positioning) + v8 (structure) + v9 (decision lens) with a file-grounded scan of what is built, into a granular item-by-item plan: tagline, naming/verbatim, IA + navigation, screen-by-screen function, the agentic closed loop, the analytical engine, connectors, architecture, pricing, and the phased build sequence (Tiers 1 to 4 mapped to dashboard IDs). **Pick this to know what to build next and how the product should look and behave.** References the live feature-dashboard for status (does not duplicate it). | **⭐ Current (master blueprint)** |
| [**v9: The Decision Wedge & the Build-Next Plan**](./v9-decision-wedge-and-build-next.md) | 2026-06-17 | **⭐ CURRENT decision-lens + build-next canon.** Sits on top of v7 (positioning) and v8 (structure); adds four things they did not state plainly: (1) the first-principles read of the "Cursor for PM" essay (code has a fast oracle, "what to build" does not, so memory is the moat, not a preference); (2) the sharpened single launch wedge (the **Critic teardown**: "Cadence tells you why your pet feature is wrong, with receipts"); (3) the competitor posture map (**integrate / absorb / race / ignore**; the real threat is workspace incumbents, not labs, so pull MCP forward); (4) an honest audit (engine + Build spine real; the loop-ends and packaging are the unfinished, highest-leverage work) and a tiered build-next plan mapped to dashboard IDs. Reconciles the Build call with v8's hybrid spine. | **⭐ Current (decision/build-next)** |
| [**v8: Calm Front, Deep Engine (structure & build canon)**](./v8-calm-front-deep-engine.md) | 2026-06-16 | **⭐ CURRENT structure / IA / build-order canon.** Operationalizes v7's "simple front, powerful engine" into a concrete surface map (5 calm top-level surfaces + one Engine Room door; machinery recessed-not-removed and fully drillable on demand), the hybrid Build spine (own the 80% path, rent the heavy 20%; sandbox+preview is the one real new build), and a 4-phase forward sequencing. Born from a 2026-06-16 founder reflection that the product had drifted into a technical control room. Settled: Build = hybrid spine; two heroes (Today=decide, Build=ship), one loop; Law #1 = the Engine-Room Doctrine. | **⭐ Current (structure/build)** |
| [**v7: Agentic Product OS (the post-Phase-3 reset)**](./v7-agentic-product-os.md) | 2026-06-14 | **⭐ CURRENT positioning + build canon.** Code-verified state-of-product (the autonomy/memory engine is real; gaps = a live slug bug + migration-sync + connectors + observing-default); four committed course-corrections (memory-moat · ambient+governed · hybrid+outcome pricing · complete-loop-first); **dual-persona** beachhead; honest market synthesis (failure-data baseline, vendor reports down-weighted); pricing/GTM/investor narrative; proof-gated **M-0→M-D** roadmap. Built on a holistic evidence base (code truth-audit + market/WTP/investor research + references), not any single source. | **⭐ Current (positioning)** |
| [v6: Agentic Product OS (positioning + build canon)](archive/v6-agentic-product-os.md) | 2026-06-13 | **Superseded by v7 for positioning**, retained as the detailed engine/IA reference + market-evidence / 5-seat pressure-test appendices. Umbrella = PM Chief of Staff (felt entry) + Decision System (moat); delete sprint/kanban; defer marketplace but keep the A2A contract; phased build. | Superseded by v7 (engine/IA retained) |
| [v5: The PM Chief of Staff wedge](archive/v5-chief-of-staff.md)             | 2026-06-11 | **Wedge UX detail (felt product: nav, vocabulary, demo), folded under v6.** Cadence = the senior PM's Chief of Staff running the evidence-to-decision loop daily. 4 felt surfaces (Today-as-Calls-queue · Product · Knowledge · Chat) + Trust drawer; mothball-hard cut; 5-agent UI vocabulary; Slack ingest door; smallest-loop closure; phases A to E (`F-V5-*`) to June 22. | **Current (wedge)**         |
| [v4: Feature map: the agent-run lifecycle](archive/v4-feature-map.md)       | 2026-06-11 | **Expansion map.** 7 platform laws, 6 stations over the 12-stage engine, 19-agent mesh + HandoffEnvelope contract + HITL gate matrix, 7-surface IA, station feature catalogs, milestones M1 to M5, PLG wedge → enterprise, frontier-absorption policy.                | **Current (expansion / engine map)**, positioning now under v6 |
| [v4: Stress test (adversarial review)](archive/v4-stress-test.md)           | 2026-06-11 | 10 argued failure verdicts (F1 to F10): IA = engine anatomy, no golden path, agents configured not embodied, right half scaffolding, cost story unproven, frontier wipe-out test. What survives, what M1 to M5 must fix.                                                 | **Companion to v4**         |
| [v3: Strategic pivot to Cadence](archive/v3-positioning-cadence.md)         | 2026-06-10 | Full reposition to Cadence, a B2B Enterprise Product Cockpit. Re-aligns the 12 lifecycle stages, 8 cockpit pillars, target personas, pluggable multi-model substrate, and co-development guidelines.                                                                | Superseded by v4 for scope/IA/GTM; **personas still current** |
| [v3: End-to-end product & platform audit](./archive/v3-audit.md)              | 2026-06-06 | Brutally honest audit: 10-second test fail, 31-route IA collapse to ~12, "cockpit" framing refinement of v2, Paxel Human/Machine Mode adoption, prioritized Top-5/10/20 roadmap, investor scorecard. **Recommends refining v2 framing, not replacing the thesis.** | Archived (historical · [`archive/`](./archive/)) |
| [v3: Language, naming & microcopy companion](./archive/v3-audit-language.md)  | 2026-06-06 | Naming integrity matrix, sidebar 31→12 rename mapping, tooltip Keep/Delete/Rewrite/Add audit, voice guide (operator-grade · reporter · coach), agent/AI vocabulary spec, P0 to P3 rewrite roadmap.                                                                    | Archived (historical · [`archive/`](./archive/)) |
| [v3: Voice, popups & inline management](./archive/v3-audit-language-voice.md) | 2026-06-06 | Full AI-tell list beyond em dashes; popup sweep (12 sites replaced + ESLint guardrail); inline workspace + product management spec. P0 landed in same turn.                                                                                                        | Archived (historical · [`archive/`](./archive/)) |
| [v2: Autonomous product OS](./archive/v2-positioning.md)                      | 2026-06-02 | Full reposition to autonomous product OS. Three equal personas. "Agents do, humans govern." Portability commitment. Market timing analysis.                                                                                                                        | Archived, superseded by v3 |
| [v1: Initial positioning reframe](./archive/v1-positioning.md)                | 2026-05-26 | First positioning reframe: discovery-first wedge, six-thread analysis, Cagan lens, demand evidence from PM voices. Uses retired framings.                                                                                                                          | Archived, superseded by v3 |

---

## Session decisions log

| File                                           | Purpose                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [session-decisions.md](./session-decisions.md) | Running log of major strategic decisions, tradeoffs evaluated, and facts presented across sessions. Read this to understand _why_ things are the way they are without re-reading conversation history. Updated every session that produces a strategic decision. |
| [strategic-inputs-log.md](./strategic-inputs-log.md) | Living, append-forward record of the **raw strategic reasoning and brainstorm inputs** that fed the canon (the operator/PM/investor/marketer lenses, the arguments, the evidence) preserved in original form, not just the distilled conclusion. The source narrative for **fundraising and incubator applications (YC, accelerators, investor memos)**. Updated in the same session any strategic input surfaces. |

---

## How to use this folder

- **Building a feature, making a UX/positioning decision, or onboarding?** Start with the **role map above**. For what to build next and how it should look and behave, read **v10 (The Master Blueprint)** first, then **v10_implementation-plan.md** for the execution order. For the launch wedge, competitor posture, and priority rationale, read **v9 (The Decision Wedge & the Build-Next Plan)** (the current decision-lens canon). For structure / IA / surface placement and build-order, read **v8 (Calm Front, Deep Engine)** (the current structure/build canon). For positioning / market, read **v7 (Agentic Product OS, the reset)**. It is the current positioning + build canon (code-verified state, four course-corrections, dual-persona, proof-gated M-0→M-D roadmap; founder rulings in §13). v6 holds the prior canon + engine/IA detail + market appendices; v5 holds the wedge UX detail; v4 governs expansion scope (stations, mesh, M2 to M5); personas in v3. Superseded iterations live in [`archive/`](./archive/).
- **Received strategic input (market analysis, positioning feedback, new customer insight)?** Document it in the current version in the same session. If the change is significant enough to warrant a new version, create `v3-positioning-YYYY-MM-DD.md` and update this index.
- **Wondering why a past decision was made?** Read the version that was current at that time.

## Cascade rule (closed documentation loop)

If the current version of strategy changes:

1. Update `v3-positioning-cadence-YYYY-MM-DD.md` (or create a new version) in the same session
2. Review and update `../../README.md` (product thesis, personas, MOAT, USP)
3. Review and update `../../AGENTS.md` §0 (the one-paragraph goal statement)
4. Review and update `../../docs/planning/feature-backlog.md` (new features section if features change)
5. Review and update `../../plan.md` (persona descriptions if they change)
6. Update the tool-specific configs if framing language changes: `../../CLAUDE.md`, `../../GEMINI.md`, `../../.lovable-config.txt`
7. Update [`moat.md`](./moat.md) (the moat / competition / positioning canon) and run the **Repositioning Ripple Review** in its §11 (pricing/gating, feature priority, IA/messaging, build-next, tests), so a positioning change ripples across the platform, not just the docs.

This cascade is mandatory. A positioning change that does not propagate to the live docs is not real. It will drift immediately.

## Documentation bar (standing, founder 2026-06-19) - applies to ALL strategy and decision docs

Every strategy doc, decision record, information-gathering note, and answer to an important question is captured **comprehensively and thought-process-oriented**: the reasoning, the insights, and how we decided, not just the conclusion. The goal is that these docs directly serve YC / accelerator / investor applications and let any future question be answered by reference without re-deriving. Whenever a chat produces a non-obvious answer, an analysis, an insight, or an important decision, write it into the relevant canon doc **in the same session**: decisions to [`session-decisions.md`](./session-decisions.md); raw reasoning + insights to [`strategic-inputs-log.md`](./strategic-inputs-log.md); moat / competition to [`moat.md`](./moat.md); positioning to the current vX canon. Brief, high-level capture is not enough; capture the why and the how-we-decided. This bar is not specific to any one file; it governs all of them.

## References

- Current product truth: [`../../README.md`](../../README.md)
- Feature list: [`../../docs/planning/feature-backlog.md`](../../docs/planning/feature-backlog.md)
- Build plan: [`../../plan.md`](../../plan.md)
- Operating rules: [`../../AGENTS.md`](../../AGENTS.md)
