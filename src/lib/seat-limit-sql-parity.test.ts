/**
 * Drift guard: pin the SQL `tier_seat_limit` to the TS source of truth (`entitlements.seats`).
 *
 * `entitlements.ts` defines `seats: collab ? null : 1` (solo tiers = 1, team/enterprise =
 * unlimited/null). The seat-cap enforcement in `create_workspace_invitation` reads
 * `public.tier_seat_limit(_tier)`, which HAND-MIRRORS those numbers in a CASE. This test parses
 * the SQL CASE and asserts, for every tier, that it equals `entitlementsFor(tier).seats` — so the
 * cap the DB enforces can never silently disagree with the plan the app advertises.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { PLAN_TIERS, entitlementsFor } from "./entitlements";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readSeatLimitMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const hit = files.find((f) =>
    readFileSync(join(MIGRATIONS_DIR, f), "utf8").includes("function public.tier_seat_limit"),
  );
  if (!hit) {
    throw new Error(
      "No migration defines public.tier_seat_limit — the seat-cap SQL moved or was removed. " +
        "Update this drift guard.",
    );
  }
  return readFileSync(join(MIGRATIONS_DIR, hit), "utf8");
}

/** Parse `case _tier when 'x' then n … else null end` into the explicit Map<tier, number>. */
function parseSeatCase(sql: string): Map<string, number> {
  const fnStart = sql.indexOf("function public.tier_seat_limit");
  const body = sql.slice(fnStart, sql.indexOf("$$;", fnStart));
  const map = new Map<string, number>();
  const re = /when\s+'([a-z]+)'\s+then\s+(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    map.set(m[1], Number(m[2]));
  }
  if (map.size === 0) throw new Error("parsed zero tier→seat pairs — the CASE shape changed");
  return map;
}

describe("seat-limit SQL ↔ TS parity (tier_seat_limit vs entitlements.seats)", () => {
  const explicit = parseSeatCase(readSeatLimitMigration());

  for (const tier of PLAN_TIERS) {
    it(`tier_seat_limit(${tier}) matches entitlements.seats`, () => {
      // An explicit WHEN sets the cap; absence falls to the SQL `else null` (unlimited).
      const sqlValue = explicit.has(tier) ? explicit.get(tier)! : null;
      expect(sqlValue).toBe(entitlementsFor(tier).seats);
    });
  }

  it("parser sanity: the solo tiers are explicitly capped (free is a real positive number)", () => {
    expect(explicit.get("free")).toBeGreaterThan(0);
  });
});
