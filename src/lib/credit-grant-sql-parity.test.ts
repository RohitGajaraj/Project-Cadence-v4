/**
 * Drift guard: pin the SQL per-tier credit-grant numbers to the TS source of truth.
 *
 * `entitlements.ts` (`entitlementsFor(tier).creditMonthlyBase`) is the single TS source of truth
 * for how many included credits each tier gets per cycle. The SQL `backfill_account_credits`
 * function HAND-MIRRORS those numbers in a `case a.plan_tier when 'free' then 500 …` block with
 * only an implicit "keep in sync" expectation. Nothing guarded the two from drifting — change
 * `FREE_MONTHLY_CREDITS` or a tier multiplier in TS and the DB silently funds accounts with a
 * different amount than the app advertises and meters. (The product/workspace LIMITS already have
 * such a guard in `entitlements-sql-parity.test.ts`; the credit GRANTS did not — this closes that
 * gap, flagged by the 2026-06-22 Stripe-readiness audit.)
 *
 * This test parses the migration's CASE body and asserts, for every non-enterprise tier, that the
 * SQL grant equals `entitlementsFor(tier).creditMonthlyBase`. Edit either side without the other
 * and it fails.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { PLAN_TIERS, entitlementsFor } from "./entitlements";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** Find the migration that defines backfill_account_credits (robust to renames). */
function readBackfillMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const hit = files.find((f) =>
    readFileSync(join(MIGRATIONS_DIR, f), "utf8").includes("function public.backfill_account_credits"),
  );
  if (!hit) {
    throw new Error(
      "No migration defines public.backfill_account_credits — the credit-grant CASE moved or was " +
        "removed. Update this drift guard to point at the new home.",
    );
  }
  return readFileSync(join(MIGRATIONS_DIR, hit), "utf8");
}

/** Parse the `case a.plan_tier when 'x' then n … end` grant mapping into Map<tier, number>. */
function parseGrantCase(sql: string): Map<string, number> {
  const fnStart = sql.indexOf("function public.backfill_account_credits");
  const body = sql.slice(fnStart, sql.indexOf("$$;", fnStart));
  const caseStart = body.indexOf("case a.plan_tier");
  if (caseStart < 0) throw new Error("credit-grant CASE (case a.plan_tier …) not found");
  const caseBody = body.slice(caseStart, body.indexOf(" end", caseStart));
  const map = new Map<string, number>();
  const re = /when\s+'([a-z]+)'\s+then\s+(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(caseBody)) !== null) {
    map.set(m[1], Number(m[2]));
  }
  if (map.size === 0) throw new Error("parsed zero tier→credit pairs — the CASE shape changed");
  return map;
}

describe("credit-grant SQL ↔ TS parity (backfill_account_credits vs entitlements)", () => {
  const grantByTier = parseGrantCase(readBackfillMigration());

  // enterprise is excluded from the backfill (`where a.plan_tier <> 'enterprise'`) and has a null
  // metered base, so it is not part of the parity surface.
  const fundedTiers = PLAN_TIERS.filter((t) => t !== "enterprise");

  it("parses every funded tier from the SQL CASE", () => {
    for (const tier of fundedTiers) {
      expect(grantByTier.has(tier)).toBe(true);
    }
  });

  for (const tier of fundedTiers) {
    it(`grants ${tier} the entitlements.creditMonthlyBase`, () => {
      const expected = entitlementsFor(tier).creditMonthlyBase;
      expect(grantByTier.get(tier)).toBe(expected as number);
    });
  }

  it("parser sanity: a wrong-shape CASE cannot silently pass (free is a real positive number)", () => {
    expect(typeof grantByTier.get("free")).toBe("number");
    expect(grantByTier.get("free")).toBeGreaterThan(0);
  });
});
