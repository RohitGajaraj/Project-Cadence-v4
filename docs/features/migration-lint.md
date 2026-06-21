# Migration SQL apply-safety linter

> _Created: 2026-06-21 (Lane 3) · considerations.md Build/ship "Migration rollback strategy" · Tier 3 (core build-integrity infra)_

**Status:** ✅ Shipped (pure linter + offline CLI + wired into the migration hook; validated against all 168 existing migrations).

**One line:** a static, offline linter that fails the build on a migration whose SQL would **fail to apply** (e.g. `CREATE POLICY ... IF NOT EXISTS`), catching the broken-migration class **before** the founder's publish.

---

## Why this exists

`scripts/check-migrations.sh` verifies that every migration **file has been applied** to the DB (file-version vs `supabase_migrations.schema_migrations`) and **needs DB credentials**. It says nothing about whether a file's SQL is even valid to apply.

That gap was expensive: this project repeatedly shipped migrations that would have **failed on apply**. The clearest case (WM-F3) used `CREATE POLICY ... IF NOT EXISTS`, which is invalid Postgres (ERROR 42601 — `CREATE POLICY` has never supported `IF NOT EXISTS`); the safe idiom is `DROP POLICY IF EXISTS ...` then `CREATE POLICY ...`. The session notes record three such "broken parallel ship" catches. Nothing detected them statically, so they only surfaced on (or just before) publish.

This linter closes that: it runs **offline** (no DB), so it catches the broken SQL on any laptop/CI before it ships.

---

## What it checks

`src/lib/migration-lint.ts` `lintMigrationSql(sql)` returns findings with a 1-based line.

**ERROR (build-blocking — always-invalid SQL, zero false positives):**
- `create-policy-if-not-exists` — `CREATE POLICY ... IF NOT EXISTS` (ERROR 42601).
- `create-trigger-if-not-exists` — `CREATE TRIGGER ... IF NOT EXISTS` (unsupported).

**WARN (advisory, non-blocking):**
- `new-table-no-rls` — a new **public**-schema table with no `ENABLE ROW LEVEL SECURITY` in the same file (the repo requires RLS on tenant tables). Non-public-schema tables (e.g. `app_private`) are intentionally service-role-only and are skipped.
- `add-column-notnull-no-default` — `ADD COLUMN ... NOT NULL` with no `DEFAULT` (fails on a populated table).

### Precision (why the ERROR rules can safely block the build)

- The ERROR patterns are **always-invalid** SQL — the construct cannot legitimately appear — so a hard block is safe. Validated: **0 errors across all 168 existing migrations** while the unit tests prove the WM-F3-class pattern IS caught.
- `blankComments()` neutralizes `--` and `/* */` comments **and** `$$...$$` / `$tag$...$tag$` dollar-quoted bodies (preserving length + newlines so line numbers stay accurate), so a forbidden phrase mentioned in a `RAISE NOTICE` or a comment inside a plpgsql body never trips a build-blocking error. (Folded from the adversarial review: a build gate must not carry a latent false positive.)
- The regexes are anchored to the genuinely-invalid adjacency (`create policy` immediately followed by `if not exists`), so a `CREATE POLICY` and an unrelated later `IF NOT EXISTS` never cross-match. ReDoS-free (simple linear patterns).

---

## How it runs

- `scripts/lint-migrations.ts` — a `bun` CLI that lints every `supabase/migrations/*.sql` and exits non-zero on any ERROR.
- Wired into `scripts/check-migrations.sh` (which runs in the `prebuild` hook): the offline lint runs **first**, so a broken migration is caught even without DB credentials. Degrades gracefully if `bun` is absent.

Run manually: `bun scripts/lint-migrations.ts`.

---

## Verification

- `tsc --noEmit` 0; `bun test src/lib/migration-lint.test.ts` 17 tests (each ERROR pattern caught with correct line; the safe DROP-then-CREATE idiom clean; commented-out + dollar-quoted-body invalid text NOT flagged; the WARN rules + their no-false-positive cases; a realistic valid migration clean). Full suite green.
- Real-world: linting all 168 shipped migrations yields 0 apply-fatal errors and 1 advisory warn.
- Single-agent SQL review (`ecc:database-reviewer`): confirmed the ERROR-rule anchoring, comment-blanking, cross-statement, ReDoS, and hook wiring are sound; flagged 2 real issues (the `$$`-body false-positive trap + the non-public-schema warn mis-capture) — both folded with regression tests.

## Follow-ups (logged)

- Extend the ERROR set as more always-invalid patterns surface (e.g. other `IF NOT EXISTS`-unsupported statements).
- Optionally promote `add-column-notnull-no-default` to an error once a backfill convention is settled.

## Related

- [`../operations/hooks.md`](../operations/hooks.md) · `scripts/check-migrations.sh` (the applied-status check this complements).
- [`../planning/considerations.md`](../planning/considerations.md) (Build/ship "Migration rollback strategy").
