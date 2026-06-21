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
- **Richer write surface** — the audit-provenance half + its UI render shipped (see the increments below); bulk-commit / reprioritize-in-bulk remain.
- Clearing an outcome on a committed item is deliberately not allowed inline (move to backlog first).

## H2-AUDIT — roadmap-decision audit trail (increment, 2026-06-21)

Answers "why is this on the roadmap?" (the recurring senior-PM justification burden, `considerations.md` PM P0/P1) with cited evidence, by recording every roadmap decision.

- `supabase/migrations/20260621024000_h2_roadmap_audit.sql`: an append-only `roadmap_audit` table (insert-own + read-own-or-workspace RLS, NO update/delete = tamper-evident, mirroring `export_log`/U6-AUDIT; FK to `opportunities` `ON DELETE CASCADE` so the audit never outlives its data and is auto-erased by DATA-RETENTION-b's `workspace_id` sweep; CHECK on action/buckets).
- `src/lib/roadmap-audit.ts` (pure): `buildAuditInsert` (blank-normalization; `user_id` left to the DB default `auth.uid()` so the actor can't be spoofed) + `summarizeRoadmapHistory` (the live "why" = the newest committed outcome). 5 unit tests.
- `roadmap.functions.ts`: best-effort audit writes in `commitRoadmapItem` (action `commit`, captures the declared outcome **at commit time** — the point-in-time evidence) and `updateRoadmapItem`; the write is try/caught so it never breaks the roadmap write it describes. New `getRoadmapHistory(opportunityId)` read fn (RLS-scoped, newest-first).
- **Status:** backend ◐ — built, unit-verified, and migration dry-run-verified on prod (BEGIN..ROLLBACK: table + RLS + 2 policies + FK CASCADE confirmed).
- **Move-provenance enrichment (richer write surface, Lane 1, 2026-06-21):** the move audit was hollow — `recordRoadmapDecision` never threaded `from_bucket` (so the schema's `from_bucket` was always null) and the move call-site carried no outcome, so re-prioritizing a live commitment lost both where it moved from and what it still promised. A new pure, unit-tested `classifyRoadmapWrite(prev, next)` (in `roadmap-audit.ts`) is now the single source of the rule: `updateRoadmapItem` reads the prior row, then records full-provenance audits — a real bucket MOVE carries `from_bucket` + the (normalized) outcome/measure it still promised, and an in-place outcome re-declaration is a `commit`; a single write that both relocates AND re-declares emits BOTH (the live-why summary reads only `commit` rows). It also removed a phantom "move" the old code logged whenever `bucket` was merely present in the patch (now only on a real change). 2-lens adversarial review (logic + security): both SHIP, 0 blockers; folded the combined-write move+commit completeness fix + decision normalization. tsc 0 / eslint 0 / `bun test` 608 (`roadmap-audit.test.ts` 5→14).
- **Move-provenance render (Lane 1, 2026-06-21):** the "why" popover (`RoadmapHistory.tsx`) now reads the freshly-captured `from_bucket` and renders a re-prioritization as "moved · now → next" (a new `eventBuckets(e)` helper), making the persisted provenance visible. It shows the `from → to` arrow ONLY when a source bucket was actually recorded (legacy rows and backlog-origin moves, both null-source, fall back to the destination so a "from" is never fabricated); commits stay in-place. tsc 0 / eslint 0 / `bun test` 608.
- **UI (H2-AUDIT-UI, 2026-06-21):** `src/components/product/RoadmapHistory.tsx` — a reveal-on-demand "why" popover on each committed roadmap card. A quiet trigger opens a Popover that LAZILY (`enabled: open`, so a board of cards never fans out N queries) reads `getRoadmapHistory` and renders `summarizeRoadmapHistory` (the live "why" = the newest committed outcome) plus a hairline-separated event timeline (committed/moved · bucket · date, with the outcome promised at that time). Engine-Room doctrine (calm front, reveal on demand; name the outcome) + Ember Editorial (restrained tinted neutrals, `·` separators, no banned pattern, no fancy unicode); graceful empty/pre-publish state (no crash if the audit table is not live yet). UI: /roadmap > a committed card > "why".

## Related

- [`../../plan.md`](../../plan.md) §4 (2026-06-21) · [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) row 8 · H2 base feature (shipped) · `src/components/product/RoadmapBoard.tsx`
