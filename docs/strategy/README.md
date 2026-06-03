# docs/strategy — Strategic Positioning History

> The versioned record of Cadence's product positioning, market analysis, and strategic direction. Each version captures the thinking at a point in time so future decisions can be made with full context on how the position evolved and why.

---

## Versions

| Version | Date | Summary | Status |
|---|---|---|---|
| [v1 — Initial positioning reframe](./v1-positioning-2026-05-26.md) | 2026-05-26 | First positioning reframe: discovery-first wedge, six-thread analysis, Cagan lens, demand evidence from PM voices. Uses retired framings ("wedge," "moat is data"). | Archived — superseded by v2 |
| [v2 — Autonomous product OS](./v2-positioning-2026-06-02.md) | 2026-06-02 | Full reposition to autonomous product OS. Three equal personas. "Agents do, humans govern." Portability commitment. Market timing analysis. Trust arc as emergent behavior. | **Current** |

---

## Session decisions log

| File | Purpose |
|---|---|
| [session-decisions.md](./session-decisions.md) | Running log of major strategic decisions, tradeoffs evaluated, and facts presented across sessions. Read this to understand *why* things are the way they are without re-reading conversation history. Updated every session that produces a strategic decision. |

---

## How to use this folder

- **Building a feature or making a UX decision?** Read the current version (v2) first — it governs what to build and why.
- **Received strategic input (market analysis, positioning feedback, new customer insight)?** Document it in the current version in the same session. If the change is significant enough to warrant a new version, create `v3-positioning-YYYY-MM-DD.md` and update this index.
- **Wondering why a past decision was made?** Read the version that was current at that time.

## Cascade rule (closed documentation loop)

If the current version of strategy changes:
1. Update `v2-positioning-YYYY-MM-DD.md` (or create a new version) in the same session
2. Review and update `../../README.md` (product thesis, personas, MOAT, USP)
3. Review and update `../../AGENTS.md` §0 (the one-paragraph goal statement)
4. Review and update `../../docs/feature-backlog.md` (new features section if features change)
5. Review and update `../../plan.md` (persona descriptions if they change)
6. Update the tool-specific configs if framing language changes: `../../CLAUDE.md`, `../../GEMINI.md`, `../../.lovable-config.txt`

This cascade is mandatory. A positioning change that does not propagate to the live docs is not real — it will drift immediately.

## References

- Current product truth: [`../../README.md`](../../README.md)
- Feature list: [`../../docs/feature-backlog.md`](../../docs/feature-backlog.md)
- Build plan: [`../../plan.md`](../../plan.md)
- Operating rules: [`../../AGENTS.md`](../../AGENTS.md)
