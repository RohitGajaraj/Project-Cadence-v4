# DATA-RETENTION-b — Right-to-be-forgotten erase cascade

> Status: ◐ Built dormant 2026-06-21 (Lane 0). The migration + the pure receipt module are gate-green (tsc + build + 398 tests), unit-verified, 4-lens-adversarially-reviewed (all must-fix folded), and zero-destruction-dry-run-verified on the live schema; the cascade is **dormant** (`right_to_erasure_enabled()` = false) and **service-role-only**, so nothing is ever deleted until an operator flips the flag and invokes it. The destructive FK-order dry-run (a workspace with rows) is a publish-verify step.

## What it does (one paragraph)

Erases all of a tenant's data on a verified right-to-be-forgotten request, where the tenant unit is a workspace (`forget_workspace`) or a whole account and every workspace under it (`forget_account`). It is the destructive other half of `DATA-RETENTION` (which shipped the time-based telemetry purge); that migration's header explicitly named this follow-up. A read-only `erasure_residue` verifier reports any tenant rows still present after an erase, and the pure `summarizeErasure` receipt turns the raw result into a verifiable "what was deleted" summary an operator/DPO can read.

## Why it exists (one paragraph)

GDPR Art. 17 / CCPA right-to-erasure is a legal requirement and a standard blocking item in enterprise security reviews; `considerations.md` flags it as a P1 Data/Privacy gap ("Data retention + deletion (GDPR/CCPA right-to-be-forgotten)"). It completes the data-governance triad alongside the retention purge (`DATA-RETENTION`, cycle 47), the export audit log (`U6-AUDIT`, cycle 48), and the sub-processor disclosure (`SUBPROC-DISCLOSURE`, cycle 49). See [`../../plan.md`](../../plan.md) §4.

## How it works (migration, modules)

`supabase/migrations/20260621012900_data_retention_b_right_to_erasure.sql`:

- `right_to_erasure_enabled()` — dormant flag, returns `false` (mirrors `data_retention_enabled()` / `credits_enabled()`). Every destructive function self-gates on it and returns `{skipped:"dormant"}` until it is flipped.
- `_erasure_delete_by_column(_col, _id)` — the engine. Lists every public **base table** carrying the tenant column from `information_schema` (auto-covers all 61 `workspace_id` tables today and any table added later — no hand-list to rot), then deletes `delete from <table> where <col> = $1` from each, retrying any table that raises `foreign_key_violation` on a later pass. This **fixed-point loop resolves FK ordering with no hand-maintained topological sort**, is bounded (max passes + a no-progress exit), and **raises if anything cannot be cleared** (never silently incomplete). Returns `{table: rows_deleted}`.
- `forget_workspace(_workspace_id)` — runs the workspace_id sweep, then deletes the `workspaces` row (now unblocked).
- `forget_account(_account_id)` — snapshots the account's workspace ids, forgets each, then sweeps account-scoped tables (`account_id`: credits/ledger/members/…) and deletes the `accounts` row.
- `erasure_residue(_workspace_id)` — read-only; returns counts of any rows still carrying that `workspace_id` (`{}` means fully erased). Drift-proof verification, including tables added after this migration.

`src/lib/compliance/erasure.ts` (pure, no IO): the `ErasureResult` union (dormant | workspace | account), `summarizeErasure(result)` → a flat `ErasureReceipt` (total rows, per-table, workspaces/accounts erased; recurses into an account's per-workspace results), and `isErasureComplete(receipt, residue)` (true only when not-dormant AND residue empty — a dormant result is never counted as "done"). Defensive: non-finite/negative counts are treated as 0.

## Why a naive `delete from workspaces` is wrong (the design rationale)

Verified on the live schema (2026-06-21): of the 61 tables carrying `workspace_id`, the FK to `workspaces` is **ON DELETE CASCADE on 22, RESTRICT/NO ACTION on 22, SET NULL on 6**. A bare parent delete would (a) be **blocked** by the 22 RESTRICT children, and (b) merely **NULL** the 6 SET NULL tables — which include the agent moat (`agent_memory` / `agents` / `agent_runs` / `agent_tools` / `agent_run_checkpoints`) and `idempotency_keys` — leaving the data present but unlinked (the worst erasure outcome). The explicit, FK-order-agnostic sweep deletes every tenant row regardless of FK action.

## Governance & guardrails (why this destructive dynamic DML is sound)

- **Single-tenant by construction:** every delete is `where <col> = $1` with the tenant id bound as a parameter; it can never touch another tenant's rows.
- **No injection surface:** table names come only from the catalog and are `quote_ident()`'d (no user-supplied identifiers).
- **Dormant:** ships inert; strict no-op until the flag is flipped.
- **Service-role-only:** execute revoked from public/anon/authenticated, granted to `service_role`. Right-to-erasure is an operator/DPO action behind identity verification, not self-serve.

## Invocation (operator / DPO)

The erase runs only when (1) the founder flips `right_to_erasure_enabled()` to `true`, and (2) an operator calls the RPC over the service-role connection, e.g. `select forget_workspace('<uuid>')` / `select forget_account('<uuid>')`, then `select erasure_residue('<uuid>')` to confirm `{}`. There is no self-serve UI or HTTP endpoint by design (a gated DPO console is the follow-up DATA-RETENTION-c).

## Verification checklist (concrete)

- [x] `bunx tsc --noEmit` clean; `bun run build` ✓ (Node 22.12+/26; the session default Node 20.9 is below Vite's floor — environmental); `bunx eslint` clean on the new files.
- [x] `bun test src/lib/compliance/erasure.test.ts` 11/11 (incl. null-residue + discriminator-confusion edge cases from the review); full suite 398/398.
- [x] 4-lens adversarial review (sql-fk-correctness clean; tenant-isolation, gdpr-completeness, ts-receipt) — 4 must-fix folded: `_col` whitelist, primitive-level dormancy gate, `isErasureComplete` null guard, structural `isAccount` discriminator.
- [x] **Zero-destruction live dry-run (real prod schema, `BEGIN … ROLLBACK`):** created the functions, set the flag true, ran `_erasure_delete_by_column` for both `workspace_id` and `account_id` against a random non-existent uuid (every delete = 0 rows) + `erasure_residue` — all returned clean (`{passes:1, tables:{}}`, residue `{}`), proving the dynamic catalog discovery, `quote_ident` over every real table, the whitelist, the dormancy gate, and the loop termination all work on the live 61-table schema, then `ROLLBACK` (prod untouched).
- [ ] **Destructive FK-order dry-run (publish-verify):** on the founder's next publish, in a `BEGIN … ROLLBACK`, temporarily enable the flag, `select forget_workspace('<a real test workspace WITH rows>')`, confirm `erasure_residue` returns `{}` and the workspace row is gone (proves the retry loop resolves real FK ordering), then `ROLLBACK`. (Note: `erasure_residue` proves workspace-scope only.)

## Known limits / out of scope (it is TENANT-data erasure, not PERSON erasure)

> Confirmed by a 4-lens adversarial review (2026-06-21). **DATA-RETENTION-b does NOT by itself satisfy GDPR Art. 17 person-level erasure** — it erases a workspace's / account's data, not a human identity. The gaps below are stated scope boundaries (acceptable for a dormant engine), all scoped to the follow-up **DATA-RETENTION-c** (person-level cascade):

- **`auth.users` is never deleted.** The identity record (and `auth.admin.deleteUser`) lives outside the public-schema sweep. A true "forget this person" must delete it plus every `user_id`-scoped row across all their workspaces.
- **`user_id`-only rows persist.** Tables keyed solely by `user_id` with no `workspace_id`/`account_id` (e.g. `user_notification_preferences`; product-level `export_log` rows with `workspace_id = NULL`) survive an account erase, leaking that a member existed / acted. Needs a `user_id`-scoped sweep in DATA-RETENTION-c.
- **Supabase Storage objects are not deleted** by row erasure (orphaned `prototype_files` etc. retain quota and potentially guessable-path content). Storage is outside SQL; DATA-RETENTION-c adds a Storage-API delete-by-prefix / orphan cron.
- **`erasure_residue` only checks `workspace_id`.** It gives no signal about residual `account_id`/`user_id` rows, so an account-scope sign-off rests on workspace-scope verification only. DATA-RETENTION-c adds `erasure_residue_account` (and a user variant).
- **Public-share artifacts** (`is_public` decisions/opportunities at `/d/<slug>`, `/t/<slug>`): the rows are deleted, but external caches (browser, email, search indexes) are not retroactively invalidated, and there is no pre-deletion audit of which slugs were public. DATA-RETENTION-c logs slug/is_public before deletion.
- **No UI / no HTTP trigger** (deliberate; a destructive action stays operator-gated until a verified DPO flow exists).
- **Anonymize-vs-delete policy + legal-hold carve-outs** are a founder/legal decision; this ships the hard-delete default (the literal GDPR right to erasure).

## Related

- [`../../plan.md`](../../plan.md) §4 · [`../planning/considerations.md`](../planning/considerations.md) Data/Privacy lens · [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) (DATA-RETENTION) · siblings [`subprocessor-disclosure.md`](./subprocessor-disclosure.md), [`u6-data-export.md`](./u6-data-export.md) · migration `supabase/migrations/20260621012900_data_retention_b_right_to_erasure.sql`
