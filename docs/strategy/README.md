# docs/strategy — Strategic Positioning History

> The versioned record of Circuit's product positioning, market analysis, and strategic direction. Each version captures the thinking at a point in time so future decisions can be made with full context on how the position evolved and why.

---

> [!IMPORTANT]
> **CADENCE ➔ CIRCUIT RENAME DISCLAIMER:**
> _This project has been renamed from **Cadence** to **Circuit**. Any legacy folder structures, database tables, migrations, environment variables, or APIs that still contain the string `cadence` or `Cadence` are to be treated as equivalent to `circuit` or `Circuit` to prevent breakages in existing configurations and caches._

---

## Versions

| Version                                                                           | Date       | Summary                                                                                                                                                                                                                                                            | Status                      |
| --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| [v5 — The PM Chief of Staff wedge](./v5-chief-of-staff-2026-06-11.md)             | 2026-06-11 | **Current for the felt product (wedge UX, nav, vocabulary, demo).** Circuit = the senior PM's Chief of Staff running the evidence-to-decision loop daily. 4 felt surfaces (Today-as-Calls-queue · Product · Knowledge · Chat) + Trust drawer; mothball-hard cut; 5-agent UI vocabulary; Slack ingest door; smallest-loop closure; phases A–E (`F-V5-*`) to June 22. | **Current (wedge)**         |
| [v4 — Feature map: the agent-run lifecycle](./v4-feature-map-2026-06-11.md)       | 2026-06-11 | **Expansion map.** 7 platform laws, 6 stations over the 12-stage engine, 19-agent mesh + HandoffEnvelope contract + HITL gate matrix, 7-surface IA, station feature catalogs, milestones M1–M5, PLG wedge → enterprise, frontier-absorption policy.                | **Current (expansion scope)** — wedge/felt product superseded by v5 |
| [v4 — Stress test (adversarial review)](./v4-stress-test-2026-06-11.md)           | 2026-06-11 | 10 argued failure verdicts (F1–F10): IA = engine anatomy, no golden path, agents configured not embodied, right half scaffolding, cost story unproven, frontier wipe-out test. What survives, what M1–M5 must fix.                                                 | **Companion to v4**         |
| [v3 — Strategic pivot to Circuit](./v3-positioning-circuit-2026-06-10.md)         | 2026-06-10 | Full reposition to Circuit — B2B Enterprise Product Cockpit. Re-aligns the 12 lifecycle stages, 8 cockpit pillars, target personas, pluggable multi-model substrate, and co-development guidelines.                                                                | Superseded by v4 for scope/IA/GTM; **personas still current** |
| [v3 — End-to-end product & platform audit](./v3-audit-2026-06-06.md)              | 2026-06-06 | Brutally honest audit: 10-second test fail, 31-route IA collapse to ~12, "cockpit" framing refinement of v2, Paxel Human/Machine Mode adoption, prioritized Top-5/10/20 roadmap, investor scorecard. **Recommends refining v2 framing, not replacing the thesis.** | **Companion to v3**         |
| [v3 — Language, naming & microcopy companion](./v3-audit-language-2026-06-06.md)  | 2026-06-06 | Naming integrity matrix, sidebar 31→12 rename mapping, tooltip Keep/Delete/Rewrite/Add audit, voice guide (operator-grade · reporter · coach), agent/AI vocabulary spec, P0–P3 rewrite roadmap.                                                                    | **Companion to v3**         |
| [v3 — Voice, popups & inline management](./v3-audit-language-voice-2026-06-06.md) | 2026-06-06 | Full AI-tell list beyond em dashes; popup sweep (12 sites replaced + ESLint guardrail); inline workspace + product management spec. P0 landed in same turn.                                                                                                        | **Companion to v3**         |
| [v2 — Autonomous product OS](./v2-positioning-2026-06-02.md)                      | 2026-06-02 | Full reposition to autonomous product OS. Three equal personas. "Agents do, humans govern." Portability commitment. Market timing analysis.                                                                                                                        | Archived — superseded by v3 |
| [v1 — Initial positioning reframe](./v1-positioning-2026-05-26.md)                | 2026-05-26 | First positioning reframe: discovery-first wedge, six-thread analysis, Cagan lens, demand evidence from PM voices. Uses retired framings.                                                                                                                          | Archived — superseded by v3 |

---

## Session decisions log

| File                                           | Purpose                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [session-decisions.md](./session-decisions.md) | Running log of major strategic decisions, tradeoffs evaluated, and facts presented across sessions. Read this to understand _why_ things are the way they are without re-reading conversation history. Updated every session that produces a strategic decision. |

---

## How to use this folder

- **Building a feature or making a UX decision?** Read **v5 (Chief of Staff wedge)** first — it governs the felt product, nav, vocabulary, and what ships by June 22. v4 governs expansion scope (stations, mesh, M2–M5). Personas: v3 §2.
- **Received strategic input (market analysis, positioning feedback, new customer insight)?** Document it in the current version in the same session. If the change is significant enough to warrant a new version, create `v3-positioning-YYYY-MM-DD.md` and update this index.
- **Wondering why a past decision was made?** Read the version that was current at that time.

## Cascade rule (closed documentation loop)

If the current version of strategy changes:

1. Update `v3-positioning-circuit-YYYY-MM-DD.md` (or create a new version) in the same session
2. Review and update `../../README.md` (product thesis, personas, MOAT, USP)
3. Review and update `../../AGENTS.md` §0 (the one-paragraph goal statement)
4. Review and update `../../docs/planning/feature-backlog.md` (new features section if features change)
5. Review and update `../../plan.md` (persona descriptions if they change)
6. Update the tool-specific configs if framing language changes: `../../CLAUDE.md`, `../../GEMINI.md`, `../../.lovable-config.txt`

This cascade is mandatory. A positioning change that does not propagate to the live docs is not real — it will drift immediately.

## References

- Current product truth: [`../../README.md`](../../README.md)
- Feature list: [`../../docs/planning/feature-backlog.md`](../../docs/planning/feature-backlog.md)
- Build plan: [`../../plan.md`](../../plan.md)
- Operating rules: [`../../AGENTS.md`](../../AGENTS.md)
