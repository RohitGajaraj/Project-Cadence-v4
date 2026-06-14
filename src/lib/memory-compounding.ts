// "Memory compounds" - pure helpers behind the Gauntlet's moat metric. Kept
// client-safe and unit-testable, out of gauntlet.functions.ts (which carries
// server-only auth middleware). Mirrors gauntlet-metrics.ts.
//
// The moat object is the compounding decision memory (v7 canon). The honest,
// scale-independent proof that it compounds (defensible even at one user) is
// not a revenue figure but two real signals on the account's own store:
//   - reuse: of what the loop stored, how much has it actually recalled. A
//     store the loop reads back is a moat; one it never reopens is a log.
//   - priorities moved: how many recorded outcomes actually moved an
//     opportunity's ICE (the literal "this learning moved these priorities").
// NDR is deliberately NOT computed here: it needs recurring revenue, and billing
// is an M-C item, so claiming it now would outrun the wiring.

/** recalled / stored as 0..1, or null when nothing is stored yet (so the UI
 *  reads "not enough data yet" rather than dividing by zero into a fake 0%). */
export function reuseRate(recalled: number, stored: number): number | null {
  if (stored <= 0) return null;
  return recalled / stored;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Postgres `numeric` arrives over PostgREST as a STRING (to preserve
 *  precision), even though the generated types say `number | null` - so the
 *  whole codebase coerces numeric reads with Number() (see swarm / analytics /
 *  outcome.functions). Mirror that here: null/blank/NaN all read as "no value". */
function toNum(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Count learnings whose recorded outcome actually MOVED the opportunity's ICE.
 *  Compares the ROUNDED values so a sub-0.1 drift (a clamped confidence leaving
 *  the stored ICE and the recomputed float a hair apart) never reads as a move -
 *  the same honesty guard buildOutcomeMemory uses. Accepts the real wire shape
 *  (numeric-as-string); a row missing either value is not a move. */
export function countPriorityMoves(
  rows: { prior_ice: number | string | null; new_ice: number | string | null }[],
): number {
  let n = 0;
  for (const r of rows) {
    const p = toNum(r.prior_ice);
    const q = toNum(r.new_ice);
    if (p !== null && q !== null && round1(p) !== round1(q)) n++;
  }
  return n;
}
