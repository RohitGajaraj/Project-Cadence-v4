// v6 Phase 3 / Track 2 — pure, side-effect-free helpers behind the Gauntlet
// metrics. Kept out of gauntlet.functions.ts (which carries server-only auth
// middleware) so they are client-safe AND unit-testable in isolation.

export type Trend = "up" | "down" | "flat";

/** Direction of a current figure vs a prior one. Equal (or anything that
 *  can't be compared, handled by the caller) reads "flat" — never a
 *  fabricated movement. */
export function trendOf(current: number, prior: number): Trend {
  if (current > prior) return "up";
  if (current < prior) return "down";
  return "flat";
}

/** True ONLY for a genuine missing-relation/column error (pre-migration), so a
 *  transient or permission error still surfaces rather than silently reading as
 *  "no data". Postgres 42P01 = undefined_table, 42703 = undefined_column;
 *  PostgREST surfaces a missing relation as PGRST205. */
export function isMissingRelation(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const code = error.code;
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    /relation .* does not exist|could not find the table/i.test(error.message ?? "")
  );
}
