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
