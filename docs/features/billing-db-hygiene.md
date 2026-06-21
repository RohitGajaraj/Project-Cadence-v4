# M-C-DB-HYGIENE — billing/admin migration hygiene

> _Created: 2026-06-22 (Lane 1). Status: ✅ all three gaps resolved — app_settings replay migration (verified against live schema), the SQL↔TS tier-limit drift guard (new passing test), and the "redundant RLS" claim investigated and correctly closed as no-change._

Three migration-hygiene gaps were flagged on the billing/admin schema. Each is addressed below.

## 1. `app_settings` had no create-table migration — ✅ FIXED (already in tree)

`public.app_settings` (`key text pk`, `value jsonb not null`, `updated_at timestamptz not null default now()`, `updated_by uuid`) is RLS-enabled + policy-attached by `20260620211507_*` and read by `credits_enabled()` and `getPricingCatalog`, but it had been created out-of-band on the live DB, so a **clean replay from `migrations/` failed** at `20260620211507` ("relation app_settings does not exist"). Migration `20260620211506_app_settings_table.sql` (`create table if not exists`, timestamped one step before the policy migration) makes the history self-contained and is a no-op on the live DB. **Verified 2026-06-22:** the migration's columns match the live `information_schema.columns` for `app_settings` exactly.

## 2. SQL tier limits could silently drift from `entitlements.ts` — ✅ FIXED (drift guard added)

The authoritative, unbypassable product/workspace caps live in Postgres trigger functions `public.tier_product_limit(_tier)` / `public.tier_workspace_limit(_tier)` (`20260619200000_wm_m5_tier_limit_gates.sql`). They **hand-mirror** `limitFor()` in [`../../src/lib/entitlements.ts`](../../src/lib/entitlements.ts) with only a "keep in sync" comment — so editing one without the other would make the cap a free user hits in the DB silently disagree with the cap the app shows and pre-checks.

New test [`../../src/lib/entitlements-sql-parity.test.ts`](../../src/lib/entitlements-sql-parity.test.ts) closes the gap: it locates the migration that defines `tier_product_limit` (robust to renames), parses the `CASE _tier WHEN … ELSE …` bodies, and asserts for **every** tier in `PLAN_TIERS` that the SQL value equals `limitFor(tier, kind)` for both `product` and `workspace`. A parser-sanity test guards against the regex silently failing (which would otherwise let every tier collapse to the fallback and "match" by accident). Change either side without the other and the suite fails. `bun test` 11 pass; tsc clean.

Current pinned values (both sides agree): product — free 2 · pro 3 · max 5 · team/enterprise unlimited; workspace — free 1 · every paid tier pooled.

## 3. "Redundant" SELECT policies on `accounts` / `account_members` — ✅ investigated, NO CHANGE (decision call)

The flag claimed WM-M2/WM-F3 declare redundant SELECT policies. Inspecting the **live** `pg_policies` (2026-06-22), `account_members` carries two SELECT policies with **different** predicates, not duplicates:

- `account members read membership` — `is_account_member(account_id)` (see every membership row for an account you belong to).
- `account members see own` — `user_id = auth.uid()` (always see your OWN membership row).

These are OR'd, and while "read membership" usually subsumes "see own", they are **not interchangeable**: `is_account_member` is an active-membership check, so a pending / not-yet-active member would fail it yet must still be able to read their own row — exactly what "see own" guarantees. Dropping "see own" as "redundant" would silently remove that self-visibility fallback. The correct call (industry practice: never remove a defensive self-row RLS policy on an assumed redundancy) is to **keep both**. `accounts` has a single SELECT policy already, so there is nothing to consolidate there. No change is the right answer, not a deferral. (Independently, these tables are the active tenancy lane's working set, so any future change to them belongs to that lane.)

## Related
- [`../../plan.md`](../../plan.md) §4 · [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (`M-C-DB-HYGIENE`) · source of truth [`../../src/lib/entitlements.ts`](../../src/lib/entitlements.ts).
