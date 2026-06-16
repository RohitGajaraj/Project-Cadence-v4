# docs/strategy: Strategic Positioning History

> The versioned record of Cadence's product positioning, market analysis, and strategic direction. Each version captures the thinking at a point in time so future decisions can be made with full context on how the position evolved and why.

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is **Cadence**, and that is the only name to use. A brief 2026-06-10 rename experiment to a different brand was reverted on 2026-06-16; the retired name must not be reintroduced anywhere (code, docs, DB, env, caches, APIs). Any stray legacy token from that experiment is to be read as equivalent to `cadence`/`Cadence`.

---

## Versions

| Version                                                                           | Date       | Summary                                                                                                                                                                                                                                                            | Status                      |
| --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| [**v9: The Decision Wedge & the Build-Next Plan**](./v9-decision-wedge-and-build-next-2026-06-17.md) | 2026-06-17 | **⭐ CURRENT decision-lens + build-next canon.** Sits on top of v7 (positioning) and v8 (structure); adds four things they did not state plainly: (1) the first-principles read of the "Cursor for PM" essay (code has a fast oracle, "what to build" does not, so memory is the moat, not a preference); (2) the sharpened single launch wedge (the **Critic teardown**: "Cadence tells you why your pet feature is wrong, with receipts"); (3) the competitor posture map (**integrate / absorb / race / ignore**; the real threat is workspace incumbents, not labs, so pull MCP forward); (4) an honest audit (engine + Build spine real; the loop-ends and packaging are the unfinished, highest-leverage work) and a tiered build-next plan mapped to dashboard IDs. Reconciles the Build call with v8's hybrid spine. | **⭐ Current (decision/build-next)** |
| [**v8: Calm Front, Deep Engine (structure & build canon)**](./v8-calm-front-deep-engine-2026-06-16.md) | 2026-06-16 | **⭐ CURRENT structure / IA / build-order canon.** Operationalizes v7's "simple front, powerful engine" into a concrete surface map (5 calm top-level surfaces + one Engine Room door; machinery recessed-not-removed and fully drillable on demand), the hybrid Build spine (own the 80% path, rent the heavy 20%; sandbox+preview is the one real new build), and a 4-phase forward sequencing. Born from a 2026-06-16 founder reflection that the product had drifted into a technical control room. Settled: Build = hybrid spine; two heroes (Today=decide, Build=ship), one loop; Law #1 = the Engine-Room Doctrine. | **⭐ Current (structure/build)** |
| [**v7: Agentic Product OS (the post-Phase-3 reset)**](./v7-agentic-product-os-2026-06-14.md) | 2026-06-14 | **⭐ CURRENT positioning + build canon.** Code-verified state-of-product (the autonomy/memory engine is real; gaps = a live slug bug + migration-sync + connectors + observing-default); four committed course-corrections (memory-moat · ambient+governed · hybrid+outcome pricing · complete-loop-first); **dual-persona** beachhead; honest market synthesis (failure-data baseline, vendor reports down-weighted); pricing/GTM/investor narrative; proof-gated **M-0→M-D** roadmap. Built on a holistic evidence base (code truth-audit + market/WTP/investor research + references), not any single source. | **⭐ Current (positioning)** |
| [v6: Agentic Product OS (positioning + build canon)](./v6-agentic-product-os-2026-06-13.md) | 2026-06-13 | **Superseded by v7 for positioning**, retained as the detailed engine/IA reference + market-evidence / 5-seat pressure-test appendices. Umbrella = PM Chief of Staff (felt entry) + Decision System (moat); delete sprint/kanban; defer marketplace but keep the A2A contract; phased build. | Superseded by v7 (engine/IA retained) |
| [v5: The PM Chief of Staff wedge](./v5-chief-of-staff-2026-06-11.md)             | 2026-06-11 | **Wedge UX detail (felt product: nav, vocabulary, demo), folded under v6.** Cadence = the senior PM's Chief of Staff running the evidence-to-decision loop daily. 4 felt surfaces (Today-as-Calls-queue · Product · Knowledge · Chat) + Trust drawer; mothball-hard cut; 5-agent UI vocabulary; Slack ingest door; smallest-loop closure; phases A to E (`F-V5-*`) to June 22. | **Current (wedge)**         |
| [v4: Feature map: the agent-run lifecycle](./v4-feature-map-2026-06-11.md)       | 2026-06-11 | **Expansion map.** 7 platform laws, 6 stations over the 12-stage engine, 19-agent mesh + HandoffEnvelope contract + HITL gate matrix, 7-surface IA, station feature catalogs, milestones M1 to M5, PLG wedge → enterprise, frontier-absorption policy.                | **Current (expansion / engine map)**, positioning now under v6 |
| [v4: Stress test (adversarial review)](./v4-stress-test-2026-06-11.md)           | 2026-06-11 | 10 argued failure verdicts (F1 to F10): IA = engine anatomy, no golden path, agents configured not embodied, right half scaffolding, cost story unproven, frontier wipe-out test. What survives, what M1 to M5 must fix.                                                 | **Companion to v4**         |
| [v3: Strategic pivot to Cadence](./v3-positioning-cadence-2026-06-10.md)         | 2026-06-10 | Full reposition to Cadence, a B2B Enterprise Product Cockpit. Re-aligns the 12 lifecycle stages, 8 cockpit pillars, target personas, pluggable multi-model substrate, and co-development guidelines.                                                                | Superseded by v4 for scope/IA/GTM; **personas still current** |
| [v3: End-to-end product & platform audit](./archive/v3-audit-2026-06-06.md)              | 2026-06-06 | Brutally honest audit: 10-second test fail, 31-route IA collapse to ~12, "cockpit" framing refinement of v2, Paxel Human/Machine Mode adoption, prioritized Top-5/10/20 roadmap, investor scorecard. **Recommends refining v2 framing, not replacing the thesis.** | Archived (historical · [`archive/`](./archive/)) |
| [v3: Language, naming & microcopy companion](./archive/v3-audit-language-2026-06-06.md)  | 2026-06-06 | Naming integrity matrix, sidebar 31→12 rename mapping, tooltip Keep/Delete/Rewrite/Add audit, voice guide (operator-grade · reporter · coach), agent/AI vocabulary spec, P0 to P3 rewrite roadmap.                                                                    | Archived (historical · [`archive/`](./archive/)) |
| [v3: Voice, popups & inline management](./archive/v3-audit-language-voice-2026-06-06.md) | 2026-06-06 | Full AI-tell list beyond em dashes; popup sweep (12 sites replaced + ESLint guardrail); inline workspace + product management spec. P0 landed in same turn.                                                                                                        | Archived (historical · [`archive/`](./archive/)) |
| [v2: Autonomous product OS](./archive/v2-positioning-2026-06-02.md)                      | 2026-06-02 | Full reposition to autonomous product OS. Three equal personas. "Agents do, humans govern." Portability commitment. Market timing analysis.                                                                                                                        | Archived, superseded by v3 |
| [v1: Initial positioning reframe](./archive/v1-positioning-2026-05-26.md)                | 2026-05-26 | First positioning reframe: discovery-first wedge, six-thread analysis, Cagan lens, demand evidence from PM voices. Uses retired framings.                                                                                                                          | Archived, superseded by v3 |

---

## Session decisions log

| File                                           | Purpose                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [session-decisions.md](./session-decisions.md) | Running log of major strategic decisions, tradeoffs evaluated, and facts presented across sessions. Read this to understand _why_ things are the way they are without re-reading conversation history. Updated every session that produces a strategic decision. |

---

## How to use this folder

- **Building a feature, making a UX/positioning decision, or onboarding?** For the launch wedge, competitor posture, and what-to-build-next priority, read **v9 (The Decision Wedge & the Build-Next Plan)** first (the current decision-lens canon). For structure / IA / surface placement and build-order, read **v8 (Calm Front, Deep Engine)** (the current structure/build canon). For positioning / market, read **v7 (Agentic Product OS, the reset)**. It is the current positioning + build canon (code-verified state, four course-corrections, dual-persona, proof-gated M-0→M-D roadmap; founder rulings in §13). v6 holds the prior canon + engine/IA detail + market appendices; v5 holds the wedge UX detail; v4 governs expansion scope (stations, mesh, M2 to M5); personas in v3. Superseded iterations live in [`archive/`](./archive/).
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

This cascade is mandatory. A positioning change that does not propagate to the live docs is not real. It will drift immediately.

## References

- Current product truth: [`../../README.md`](../../README.md)
- Feature list: [`../../docs/planning/feature-backlog.md`](../../docs/planning/feature-backlog.md)
- Build plan: [`../../plan.md`](../../plan.md)
- Operating rules: [`../../AGENTS.md`](../../AGENTS.md)
