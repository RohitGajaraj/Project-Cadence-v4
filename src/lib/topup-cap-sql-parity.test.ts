/**
 * Drift guard: pin the SQL top-up cap to the TS source of truth (`topUpCycleCap`).
 *
 * The per-cycle top-up ceiling is enforced in THREE places: the checkout pre-check
 * (`createTopUpCheckout`), the credits view (`getMyCreditsView`), and — the real backstop — the
 * `apply_topup_credits` SQL RPC, which alone is race-safe (a `FOR UPDATE` lock serializes concurrent
 * grants). The TS sites now share one pure `topUpCycleCap`, but the SQL hand-codes the same formula
 * (`_cap := case when coalesce(_grant,0) > 0 then _grant * 2 else 5000 end`). If the two drift, the
 * UI advertises one cap while the backend enforces another — a top-up the user is told will succeed
 * gets silently rejected with `status='capped'` (or vice-versa). The verifier flagged this exact
 * duplication as a runtime-fatal risk; this test makes the two sides fail together if either moves.
 *
 * It parses the RPC's `_cap := …` assignment out of the migration and asserts the multiplier and the
 * dormant fallback match `topUpCycleCap` for representative grants. Edit either side alone → red.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { FALLBACK_TOPUP_CAP, topUpCycleCap } from "./billing-tier";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** Find the migration whose apply_topup_credits enforces the per-cycle cap (robust to renames). */
function readCapMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const hit = files.find((f) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    return sql.includes("apply_topup_credits") && /_cap\s*:=/.test(sql);
  });
  if (!hit) {
    throw new Error(
      "No migration defines the apply_topup_credits per-cycle cap (`_cap := …`) — the cap moved or " +
        "was removed. Update this drift guard to point at the new home.",
    );
  }
  return readFileSync(join(MIGRATIONS_DIR, hit), "utf8");
}

/** Parse `_cap := case when coalesce(_grant, 0) > 0 then _grant * N else M end` → {multiplier, fallback}. */
function parseCapFormula(sql: string): { multiplier: number; fallback: number } {
  const re =
    /_cap\s*:=\s*case\s+when\s+coalesce\(\s*_grant\s*,\s*0\s*\)\s*>\s*0\s+then\s+_grant\s*\*\s*(\d+)\s+else\s+(\d+)\s+end/i;
  const m = re.exec(sql);
  if (!m) {
    throw new Error(
      "Could not parse the `_cap := case … end` formula from the migration — its shape changed; " +
        "update this parser so the drift guard stays honest.",
    );
  }
  return { multiplier: Number(m[1]), fallback: Number(m[2]) };
}

describe("top-up cap SQL ↔ TS parity (apply_topup_credits vs topUpCycleCap)", () => {
  const { multiplier, fallback } = parseCapFormula(readCapMigration());

  it("parses a sane formula from the SQL (multiplier and fallback are positive)", () => {
    expect(multiplier).toBeGreaterThan(0);
    expect(fallback).toBeGreaterThan(0);
  });

  it("the SQL dormant fallback equals the TS FALLBACK_TOPUP_CAP", () => {
    expect(fallback).toBe(FALLBACK_TOPUP_CAP);
  });

  it("the TS helper reproduces the SQL cap for a paying account (grant * multiplier)", () => {
    for (const grant of [1, 500, 2500, 5000, 10000]) {
      expect(topUpCycleCap(grant)).toBe(grant * multiplier);
    }
  });

  it("the TS helper reproduces the SQL fallback for a dormant / zero-grant account", () => {
    expect(topUpCycleCap(0)).toBe(fallback);
  });
});
