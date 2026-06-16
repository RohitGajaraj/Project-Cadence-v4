# Convention: home (Today) and surface-placement IA

**Status: standing rule, founder ruling 2026-06-16. This evolves the early v5 "Today = tight ritual" idea (which was written before we had built and felt the product) into an enforceable IA. Where this and the old v5 canon disagree, this wins.**

## The rules

1. **Today is not a dashboard.** Today (`/`) answers one question the instant it opens: *what needs me, and what did the loop do while I was away?* It shows the calls that need a human now, plus a tight "while you were away" summary, plus a light brief and a dispatch affordance. Nothing else. Metrics, trends, dashboards, portfolios, activity logs, history, and configuration never live on Today.

2. **Relocate and curate, never delete or textualize.** When content moves off a surface, it lands in its right home in its *best* representation (the rich visual / chart / dashboard form, whichever delivers the most value there), exactly preserved or improved. The destination gains the good version. Rich visuals (for example the autonomy `observing -> proving -> trusted` stage strip, which lives on the Gauntlet) are never flattened into prose, and nothing is dropped just because a thinner copy exists elsewhere. Before removing a panel from a surface, open its destination and either preserve the visual into it, keep the destination's form because it is better, or improve the destination.

3. **Editorial hierarchy over card-stacks.** Hierarchy comes from type and whitespace; a surface earns at most a few containers. Identical card grids and the hero-metric template (big number, small label, supporting stats) are banned (they read as AI slop and break `design.md`'s no-filler law).

## The surface-placement rubric (the durable answer to "where does this go")

Before adding any panel, feature, or metric, apply this test so Today never re-clutters and we never re-do this cleanup:

- **Does the human need to ACT on it the moment they open the app** (a call / approval), **or is it the tight "what the loop did while I was away" summary?** If yes, it may sit on Today.
- **Otherwise it goes to its station by loop stage:** sense / decide -> **Product**; define -> **Product** (Specs); build -> **Missions** / **Build**; ship -> **Product** (Releases); learn + observe (metrics, trends, autonomy, gauntlet, traces, drift, analytics) -> **Govern** or **Knowledge**.
- **Every artifact type has exactly one home.** If the same thing renders in two places, one is wrong (single-source it; a quick badge or count that links to the home is fine, a duplicate panel is not).

Worked example (the 2026-06-16 de-clutter): the autonomy stage visual -> Gauntlet; project progress ("Where the work stands") -> Product; agent activity + throughput -> Missions; spend + runs -> Govern/Analytics; meetings -> Knowledge/Calendar (a count on Today's lede); tasks stayed on Today (the `/tasks` redirect target).

## Why

The home had drifted into ~15 stacked look-alike panels with no hierarchy: a dump, not a tool. A new user could not tell what needed them. This rubric makes the fix self-enforcing so the next build self-answers placement instead of piling onto Today.

## How to apply

On any new surface or panel: run the placement rubric first; if it is not "needs the human now" or the while-away summary, it does not go on Today. When removing content from a surface, relocate it (best representation, destination made good), never delete or textualize a rich visual.

## Related

- [`design-context.md`](./design-context.md) - the design brief (Ember system + design-craft skills + reference north-stars) that loads by default on any design work.
- [`ui-voice.md`](./ui-voice.md) · [`humanized-output.md`](./humanized-output.md) · [`inline-management.md`](./inline-management.md).
- [`../../design.md`](../../design.md) (Ember Editorial, "every element earns its place; three clicks max") · [`../../architecture/frontend.md`](../../architecture/frontend.md).
- Plan of record for the recompose: `.claude/plans/piped-brewing-knuth.md` (session 2026-06-16).
