# Lane 0 — parallel build report

> Lane 0 (`cadence-lane-0`, branch `parallel/lane-0`) per-item run log. Preferred categories: Monetization, Credit, Foundational (soft; then roam). One row per claimed item. The WM-run history this file's name references lived in `overnight-build-report.md`; this is Lane 0's peer-lane log going forward.

## Cycles

### 2026-06-21 01:48 — DATA-RETENTION-b — Right-to-be-forgotten erase cascade (◐, dormant) — SHIPPED

- **Picked:** roamed past Lane 0's founder-gated Monetization/Credit rows (Stripe/pricing/taste) to the highest-impact clean non-gated item — the GDPR/CCPA right-to-be-forgotten erase cascade that `DATA-RETENTION` (c47) explicitly named as its follow-up. Closes `considerations.md` Data/Privacy P1; completes the data-governance triad (DATA-RETENTION + U6-AUDIT + SUBPROC-DISCLOSURE).
- **Claimed:** `bash scripts/lane.sh claim DATA-RETENTION-b 0` (globs: the erasure migration + `src/lib/compliance/erasure.ts` + test + feature doc). No collision (only `CHOKEPOINT` pinned).
- **Built:** `supabase/migrations/20260621012900_data_retention_b_right_to_erasure.sql` (dormant flag + `forget_workspace`/`forget_account` + read-only `erasure_residue` + the `_erasure_delete_by_column` engine) + pure tested `src/lib/compliance/erasure.ts`.
- **Design:** FK-order-agnostic dynamic fixed-point delete over all 61 `workspace_id` tables (catalog-sourced → drift-proof; `quote_ident`'d + tenant-id-bound + `_col`-whitelisted → single-tenant by construction). Erases the 6 SET-NULL agent-moat tables explicitly + clears the 22 RESTRICT children a naive workspace delete would choke on (FK rules read live).
- **Gate:** `bunx tsc --noEmit` 0 · `bunx eslint` 0 (new files) · `bun run build` ✓ (Node 26; session default Node 20.9 < Vite floor = environmental) · `bun test` 398/398 (11 new).
- **Review:** 4-lens adversarial Workflow (sql-fk-correctness CLEAN; tenant-isolation; gdpr-completeness; ts-receipt) → 4 must-fix folded (`_col` whitelist, primitive dormancy gate, `isErasureComplete` null guard, structural `isAccount`). 6 GDPR-completeness findings are stated scope boundaries → DATA-RETENTION-c.
- **Live verify:** zero-destruction dry-run on the real prod schema (Lovable MCP, `BEGIN..ROLLBACK`, random non-existent uuid → 0-row deletes) clean: `{passes:1, tables:{}}` + residue `{}`. Prod untouched.
- **Doc-loop:** feature dashboard row 145b flipped ◐ + claim cleared; `plan.md` §4 (2026-06-21); SSOT §3 DATA-RETENTION row; `session-decisions.md`; new `docs/features/right-to-erasure.md`.
- **◐ not ✅:** tenant-data erasure, dormant + service-role-only + offline-gated + dry-run-verified; NOT person-level (auth.users / `user_id`-only rows / Storage / account residue → DATA-RETENTION-c); the destructive FK-order dry-run + live activation (flag flip + operator invoke) are publish-verify.
- **Commit:** see `git log` on `parallel/lane-0` (fast-forward to `main`). **Released claim** after ship.

**Publish-verify queue (for the founder):**
- DATA-RETENTION-b: on publish, in `BEGIN..ROLLBACK`, enable `right_to_erasure_enabled()`, `select forget_workspace('<a test workspace WITH rows>')`, confirm `erasure_residue` → `{}` and the workspace row gone, then `ROLLBACK`. Activation = flip the flag + operator-invoke per verified erasure request.

### 2026-06-21 02:20 — H2-WRITES — Outcome-roadmap governed writes (◐) — SHIPPED

- **Picked:** roamed past Lane 0's gated Monetization/Credit rows to the highest-priority eligible non-gated unclaimed item (H2-WRITES, P1, Decide) — advances autonomous execution via a governed roadmap-commit path.
- **Claimed:** `bash scripts/lane.sh claim H2-WRITES 0` (roadmap.functions.ts + new roadmap-governance.ts + test + RoadmapBoard.tsx). No collision.
- **Built:** pure `src/lib/roadmap-governance.ts` (the governance rule, 8 tests) + `commitRoadmapItem` governed write (now/next/later requires outcome+measure; RLS-hardened) + `getRoadmap` returns `governanceGaps` + board gap-header + ember `VerdictChip` ("Needs outcome") on ungoverned cards. Lenient drag move untouched (the lenient/strict split).
- **Gate:** tsc 0 · eslint 0 (4 files) · build ✓ (Node 26) · `bun test` 446/446 (8 new).
- **Review:** focused adversarial self-review (additive/non-destructive → no multi-agent workflow); `impeccable` design pass (VerdictChip per the verdict-chip ruling, role-color law, no banned pattern).
- **Doc-loop:** dashboard row 8 → ◐ + claim cleared; `plan.md` §4; new `docs/features/h2-writes.md`; `session-decisions.md`.
- **◐ not ✅:** renders on publish (not render-verified locally); agent autonomous-commit wiring + richer write surface remain.
- **Released claim** after ship.

### 2026-06-21 02:42 — H2-AUDIT — Roadmap-decision audit trail (◐, backend) — SHIPPED

- **Picked:** highest-impact clean isolation-safe item after re-scan (Monetization/Credit gated, DATA-RETENTION-c founder/legal-gated, reliability/evals = lane 1). Closes the PM P0/P1 gap "why is this on the roadmap" (cited evidence). Extends H2-WRITES.
- **Claimed:** `scripts/lane.sh claim H2-AUDIT 0` (new migration + roadmap.functions.ts + roadmap-audit.ts + test). No collision.
- **Built:** append-only `roadmap_audit` migration (insert-own + read-own-or-workspace RLS, no update/delete; FK opportunities ON DELETE CASCADE; auto-covered by DATA-RETENTION-b's workspace_id sweep) + best-effort audit writes in commitRoadmapItem (outcome at commit time) + updateRoadmapItem (moves) + getRoadmapHistory read fn + pure roadmap-audit.ts (buildAuditInsert + summarizeRoadmapHistory, 5 tests).
- **Gate:** tsc 0 · eslint 0 (3 files) · build ✓ (Node 26) · `bun test` 451/451 (5 new).
- **Review:** focused adversarial self-review (additive/best-effort → no multi-agent workflow). Migration dry-run-verified on prod (BEGIN..ROLLBACK: table+RLS+2 policies+3 indexes+FK CASCADE).
- **Doc-loop:** dashboard new row 8b → ◐; `plan.md` §4; `docs/features/h2-writes.md` (H2-AUDIT section); `session-decisions.md`.
- **◐ not ✅:** backend built + dry-run-verified, renders on publish; the "why is this here" UI surface is a later/design slice.
- **Released claim** after ship.

### 2026-06-21 02:58 — H2-AUDIT-UI — Roadmap "why is this here" history popover (◐) — SHIPPED

- **Picked:** the teed-up next pick — surface the H2-AUDIT backend (shipped same session) as a user-visible "why is this on the roadmap" affordance. Clean FE-wiring of a shipped backend (the loop's established pattern), disjoint from CHOKEPOINT/lane 1 (reliability/incidents).
- **Claimed:** `scripts/lane.sh claim H2-AUDIT-UI 0` (RoadmapBoard.tsx + new RoadmapHistory.tsx). Claim pushed to main first.
- **Built:** `RoadmapHistory.tsx` — a quiet "why" trigger on committed cards opens a Popover that lazily (`enabled: open`) reads `getRoadmapHistory` + renders `summarizeRoadmapHistory` (live why) + a hairline event timeline; wired into the board's outcome block.
- **Gate:** tsc 0 · eslint 0 · build ✓ (Node 26) · `bun test` 469/469 · no fancy unicode.
- **Design:** Ember Editorial + Engine-Room reveal-on-demand applied (restrained color, hairline separators not side-stripes, `·` separator, no banned pattern); design rules from last cycle's `impeccable` load govern.
- **Review:** focused self-review (additive UI): lazy fetch (no N-query fan-out), graceful empty/pre-publish state (no crash), purely additive.
- **Doc-loop:** dashboard new row 8c → ◐ + H2-WRITES row 8 bumped to [~85%] + claim cleared; `plan.md` §4; `docs/features/h2-writes.md` UI section.
- **◐ not ✅:** renders real history on publish (once audit rows exist); not render-verified locally.
- **Released claim** after ship.
