/**
 * M-C-DB-HYGIENE (drift guard): pin the SQL tier-limit functions to the TS source of truth.
 *
 * `entitlements.ts` (`limitFor`) is the single TS source of truth for the per-tier product and
 * workspace caps. The authoritative, unbypassable enforcement lives in Postgres trigger functions
 * `public.tier_product_limit(_tier)` / `public.tier_workspace_limit(_tier)`
 * (migration `..._wm_m5_tier_limit_gates.sql`), which HAND-MIRROR those numbers with only a
 * "keep in sync" comment. Nothing guarded the two from drifting apart — change one and the cap a
 * free user hits in the DB silently disagrees with the cap the app shows and pre-checks.
 *
 * This test parses the migration's CASE bodies and asserts, for every tier, that the SQL value
 * equals `limitFor(tier, kind)`. Edit either side without the other and this fails — the gap the
 * comment could not enforce.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { PLAN_TIERS, limitFor, type LimitKind, type PlanTier } from "./entitlements";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** Find the migration file that defines the tier-limit SQL functions (robust to renames). */
function readTierLimitMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const hit = files.find((f) =>
    readFileSync(join(MIGRATIONS_DIR, f), "utf8").includes("function public.tier_product_limit"),
  );
  if (!hit) {
    throw new Error(
      "No migration defines public.tier_product_limit — the SQL tier-limit gate moved or was removed. " +
        "Update this drift guard to point at the new home.",
    );
  }
  return readFileSync(join(MIGRATIONS_DIR, hit), "utf8");
}

/**
 * Extract a `CASE _tier WHEN 'x' THEN n ... ELSE m END` mapping from one SQL function body into
 * { explicit: Map<tier, number|null>, fallback: number|null }. `null` is encoded for `null` and for
 * an unparsed bare value, so an unexpected SQL shape surfaces as a mismatch rather than passing.
 */
function parseTierCase(
  sql: string,
  fnName: string,
): { explicit: Map<string, number | null>; fallback: number | null } {
  const fnStart = sql.indexOf(`function public.${fnName}`);
  if (fnStart < 0) throw new Error(`SQL function ${fnName} not found`);
  // The body runs from the function start to the closing dollar-quote of THIS function.
  const bodyEnd = sql.indexOf("$$;", fnStart);
  const body = sql.slice(fnStart, bodyEnd < 0 ? undefined : bodyEnd);

  const explicit = new Map<string, number | null>();
  const whenRe = /when\s+'([a-z_]+)'\s+then\s+(\d+|null)/gi;
  let m: RegExpExecArray | null;
  while ((m = whenRe.exec(body)) !== null) {
    explicit.set(m[1].toLowerCase(), m[2].toLowerCase() === "null" ? null : Number(m[2]));
  }

  const elseMatch = /else\s+(\d+|null)/i.exec(body);
  const fallback = !elseMatch
    ? null
    : elseMatch[1].toLowerCase() === "null"
      ? null
      : Number(elseMatch[1]);

  return { explicit, fallback };
}

function sqlValueFor(
  parsed: { explicit: Map<string, number | null>; fallback: number | null },
  tier: PlanTier,
): number | null {
  return parsed.explicit.has(tier) ? (parsed.explicit.get(tier) ?? null) : parsed.fallback;
}

describe("M-C-DB-HYGIENE — SQL tier limits stay in sync with entitlements.ts", () => {
  const sql = readTierLimitMigration();
  const product = parseTierCase(sql, "tier_product_limit");
  const workspace = parseTierCase(sql, "tier_workspace_limit");

  it("parses real CASE bodies (sanity: explicit mappings were found)", () => {
    // Guards the parser itself: if the regex stops matching the migration, this fails loudly
    // instead of every tier silently collapsing to the fallback and 'matching' by accident.
    expect(product.explicit.size).toBeGreaterThan(0);
    expect(workspace.explicit.size).toBeGreaterThan(0);
    // Free is the one tier that is capped on BOTH axes; it must be explicit in each.
    expect(product.explicit.has("free")).toBe(true);
    expect(workspace.explicit.has("free")).toBe(true);
    // The unlimited tiers must resolve through an `ELSE null`, not a missing case.
    expect(product.fallback).toBeNull();
    expect(workspace.fallback).toBeNull();
  });

  const kinds: { kind: LimitKind; parsed: typeof product }[] = [
    { kind: "product", parsed: product },
    { kind: "workspace", parsed: workspace },
  ];

  for (const { kind, parsed } of kinds) {
    for (const tier of PLAN_TIERS) {
      it(`${kind} limit for '${tier}' matches limitFor (SQL ${sqlValueFor(parsed, tier)} === TS ${limitFor(tier, kind)})`, () => {
        expect(sqlValueFor(parsed, tier)).toBe(limitFor(tier, kind));
      });
    }
  }
});
