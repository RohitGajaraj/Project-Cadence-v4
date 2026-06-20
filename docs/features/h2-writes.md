# H2-WRITES — Outcome-roadmap governed writes

> Status: ◐ Governed commit path shipped 2026-06-21 (Lane 0). The governance rule + validation + gap surface are built, unit-verified, design-passed (`impeccable`), and gate-green; they render on the founder's publish. Remaining: the autonomous agent-commit wiring + a richer write surface.

## What it does (one paragraph)

Turns the H2 Now/Next/Later board from a lenient kanban into governed outcome curation: a commitment to a Now/Next/Later bucket must carry a declared **outcome** and **measure**. The drag/select move stays unconstrained (you can place an item first), but the outcome save goes through a governed write that rejects a half-declared commitment, and the board surfaces every "ungoverned" commitment (in a bucket, no outcome) so the gap is visible and actionable.

## Why it exists (one paragraph)

H2's thesis (v6 positioning) is outcome curation, not a feature kanban: a roadmap commitment is a promise about an outcome and how it will be measured. Without enforcement, items drift into "Now" with no declared outcome, the exact feature-factory failure the positioning rejects. This is also the governed write path the autonomous agent uses to commit roadmap changes, advancing the genuine-autonomous-execution North Star (the claim never outruns the wiring: the rule is enforced at the write, not just nagged in the UI).

## How it works (modules)

- `src/lib/roadmap-governance.ts` (pure, no IO): the single governance rule, shared by the write path and the surface.
  - `isCommitmentGoverned(c)`: a null-bucket (backlog) item needs nothing; a Now/Next/Later item needs a non-empty outcome AND measure.
  - `validateCommitment(c)`: returns a typed `{ok}` / `{ok:false, reason}` (specific reason per missing field), not a throw.
  - `findGovernanceGaps(items)` / `governanceGapCount(items)`: the ungoverned commitments (order-preserving) and their count.
  - Owns the canonical `RoadmapBucket` type + `ROADMAP_TEXT_MAX`.
- `src/lib/roadmap.functions.ts`:
  - `commitRoadmapItem` (POST): the GOVERNED atomic write (bucket + outcome + measure). Validates via `validateCommitment`, trims blanks to null, RLS-hardened (`.eq("user_id")` + `.select("id")` + loud 0-row throw). The lenient `updateRoadmapItem` (drag move) is untouched.
  - `getRoadmap` now also returns `governanceGaps` (count of ungoverned commitments).
- `src/components/product/RoadmapBoard.tsx`: routes the outcome-save through `commitRoadmapItem`; shows a calm gap-count header when > 0; leads each ungoverned committed card with an ember `VerdictChip` ("Needs outcome").

## Design (Ember Editorial)

Per the verdict-chip ruling (a needs-human judgment leads with a chip, not buried prose), an ungoverned commitment is annotated with an ember `VerdictChip` (ember = needs-human, the role-color law). The header is a plain, calm ink-subtle sentence. No banned pattern (no hero-metric, no card grid, no gradient). `impeccable` design pass applied (it corrected an initial recolored-link cut to the canonical chip).

## The lenient/strict split (the key decision)

The MOVE (drag or the per-card select) stays lenient via `updateRoadmapItem`, so placing an item is frictionless. The governance binds at the SAVE of the outcome (`commitRoadmapItem`) and at the gap surface. Net: a commitment can never be SAVED half-declared, but the board never blocks you from organizing first. To clear an outcome you move the item back to backlog (where no outcome is required) — by design, a committed item should not be left ungoverned by clearing.

## Verification checklist

- [x] `bunx tsc --noEmit` 0; `bunx eslint` 0 on the 4 touched files; `bun run build` ✓ (Node 22.12+/26).
- [x] `bun test src/lib/roadmap-governance.test.ts` 8/8 (backlog-exempt, both-fields-required, next/later not just now, whitespace not a declaration, per-field reasons, gap detection/count); full suite 446/446.
- [x] `impeccable` design pass against the Ember Editorial DESIGN.md (VerdictChip, role-color law, no banned pattern).
- [ ] Live: render-verify the board on the founder's next publish (gap header + chip + governed save error toast); not render-verified locally.

## Known limits / out of scope

- **Autonomous agent-commit wiring** (the agent committing roadmap items through `commitRoadmapItem`) is the next slice; the governed primitive is ready.
- **Richer write surface** (reprioritize, bulk-commit, audit of roadmap changes) remains for a later H2-WRITES increment.
- Clearing an outcome on a committed item is deliberately not allowed inline (move to backlog first).

## Related

- [`../../plan.md`](../../plan.md) §4 (2026-06-21) · [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) row 8 · H2 base feature (shipped) · `src/components/product/RoadmapBoard.tsx`
