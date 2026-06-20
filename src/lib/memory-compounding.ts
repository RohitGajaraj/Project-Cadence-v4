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

// ---------------------------------------------------------------------------
// MOAT-METRIC - the memory-depth split (the lift half of the moat proof).
//
// The shipped Outcome-accuracy card surfaces the validated SHARE + a wall-clock
// trend, and deliberately refuses a causal "memory lift" claim (no on/off
// control). This is the honest, observational complement: a within-account
// MEMORY-DEPTH cut. We split the account's reviewed bets into the half decided
// EARLIER in the store's growth (less precedent accumulated) vs the half decided
// LATER (more precedent), and report the difference in validated share between
// them. It is correlational, never causal: depth is near-collinear with calendar
// time, so "got better with practice", "easier later bets", and survivorship
// (agent_memory is hard-deletable) all confound it - the card names that at the
// pixel, not just a footnote. Every number is gated so it never prints noise or
// false precision; below the gates it reads "not enough data yet" with a reason.

/** Why a memory-depth split is not a printable number. null reason => liftPoints
 *  is a real measured value (including a genuine 0). */
export type MemoryLiftReason =
  | "not-enough-outcomes" // a cohort is below MIN_LIFT_COHORT
  | "depth-contrast-too-small" // the two halves are not materially separated in precedent depth
  | "lift-within-noise" // measured, but inside the 95% CI / one-outcome resolution
  | "data-quality"; // too many outcomes dropped for unparseable timestamps

export type MemoryLift = {
  /** Signed WHOLE percentage points (richRate - sparseRate) * 100, rounded to an
   *  integer; null when not defensibly computable (see reason). A measured-equal
   *  result is a real 0, not null. */
  liftPoints: number | null;
  /** Validated share of the earlier / lower-depth half, 0..1 (null before computed). */
  sparseRate: number | null;
  /** Validated share of the later / upper-depth half, 0..1 (null before computed). */
  richRate: number | null;
  sparseN: number;
  richN: number;
  /** round(100 / min(sparseN, richN)) - how much one outcome moves the headline;
   *  0 until cohorts are formed, so a small sample never reads as settled. */
  swingPoints: number;
  /** Lower-median precedent depth of the earlier half. */
  sparseMedianDepth: number;
  /** Lower-median precedent depth of the later half. */
  richMedianDepth: number;
  /** richMedianDepth - sparseMedianDepth (the realized separation). */
  depthGap: number;
  /** Reviewed outcomes excluded for an unparseable created_at. */
  droppedOutcomes: number;
  reason: MemoryLiftReason | null;
};

/** One reviewed bet. In production learnings.verdict is CHECK-constrained to
 *  exactly these three terminal values and is NOT NULL, so the helper's verdict
 *  filter is an input-validation contract (it never drops real draft rows). */
export type ReviewedOutcome = {
  verdict: "validated" | "missed" | "mixed" | string;
  created_at: string | number; // timestamptz over PostgREST (string); epoch ms also accepted
};

/** Each half must hold this many reviewed outcomes (N >= 16) before any number is
 *  reported. This only ADMITS the computation; the noise gate is the honesty bar. */
export const MIN_LIFT_COHORT = 8;
/** richMedianDepth - sparseMedianDepth must reach this to count as a real contrast. */
export const MIN_DEPTH_GAP = 3;

const TERMINAL_VERDICTS = new Set(["validated", "missed", "mixed"]);

/** Guarded epoch parse: a finite ms or null. A number is taken as epoch ms; a
 *  string goes through Date.parse. Unparseable -> null (the row is dropped from
 *  the cut, never silently read as 1970). */
function parseEpoch(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/** Count of elements <= x in an ascending-sorted array (upper-bound search). */
function countLessEqual(sortedAsc: number[], x: number): number {
  let lo = 0;
  let hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Lower median (element at floor((len-1)/2)) of an ascending-sorted array; 0 when empty. */
function lowerMedian(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  return sortedAsc[Math.floor((sortedAsc.length - 1) / 2)];
}

/** Pure within-account memory-depth cohort difference (NOT an A/B lift).
 *  - outcomes: reviewed bets (verdict + created_at). Non-terminal verdicts and
 *    unparseable timestamps are filtered; if > 20% of reviewed bets have a bad
 *    timestamp the result is 'data-quality' (the implied N must equal the used N).
 *  - memoryCreatedAt: agent_memory.created_at list (the precedent timeline). This
 *    measures precedent CURRENTLY in the store dated on/before each bet; because
 *    memory is hard-deletable, depth() is survivorship-sensitive (copy reflects this).
 *  Correlational only. Returns liftPoints:null + a reason whenever the cohorts are
 *  too small, not separated by depth, within noise, or the data is too dirty.
 *  Never throws on any input shape. */
export function computeMemoryLift(
  outcomes: ReviewedOutcome[],
  memoryCreatedAt: (string | number | null | undefined)[],
  opts?: { minPerCohort?: number; minDepthGap?: number },
): MemoryLift {
  const minPerCohort = opts?.minPerCohort ?? MIN_LIFT_COHORT;
  const minDepthGap = opts?.minDepthGap ?? MIN_DEPTH_GAP;

  // Step 0 - keep terminal-verdict bets, parse timestamps, count the dropped.
  let terminalCount = 0;
  let dropped = 0;
  const parsed: { ms: number; validated: boolean }[] = [];
  for (const o of outcomes ?? []) {
    if (!TERMINAL_VERDICTS.has(o.verdict)) continue;
    terminalCount++;
    const ms = parseEpoch(o.created_at);
    if (ms === null) {
      dropped++;
      continue;
    }
    parsed.push({ ms, validated: o.verdict === "validated" });
  }

  const base: MemoryLift = {
    liftPoints: null,
    sparseRate: null,
    richRate: null,
    sparseN: 0,
    richN: 0,
    swingPoints: 0,
    sparseMedianDepth: 0,
    richMedianDepth: 0,
    depthGap: 0,
    droppedOutcomes: dropped,
    reason: "not-enough-outcomes",
  };

  // Data-quality gate FIRST: too many bad timestamps means the N the card implies
  // would overstate the N actually used - refuse before anything else.
  if (terminalCount > 0 && dropped > 0.2 * terminalCount) {
    return { ...base, reason: "data-quality" };
  }

  // Step 1 - precedent depth per surviving outcome (count of memory dated on/before it).
  const memMs: number[] = [];
  for (const m of memoryCreatedAt ?? []) {
    const ms = parseEpoch(m);
    if (ms !== null) memMs.push(ms);
  }
  memMs.sort((a, b) => a - b);
  const withDepth = parsed.map((p) => ({
    depth: countLessEqual(memMs, p.ms),
    validated: p.validated,
  }));

  // Step 2 - order by depth ascending (stable: Array.prototype.sort is stable).
  withDepth.sort((a, b) => a.depth - b.depth);

  // Step 3 - equal-halves positional split; the single middle element (odd N) joins
  // the RICH half. Positional (not a depth-value threshold) because integer depth
  // clusters heavily on a young account; equal halves keeps the cohorts balanced.
  // (v1 tradeoff: a bottom-third vs top-third contrast would sharpen the separation
  // and dilute the time-collinearity less; deferred, honest given the depth guard.)
  const n = withDepth.length;
  const k = Math.floor(n / 2);
  const sparse = withDepth.slice(0, k);
  const rich = withDepth.slice(k);
  const sparseN = sparse.length;
  const richN = rich.length;

  // Step 4 - size floor (admits the computation; not itself the honesty bar).
  if (sparseN < minPerCohort || richN < minPerCohort) {
    return { ...base, sparseN, richN, reason: "not-enough-outcomes" };
  }

  // Step 5 - depth-contrast guard (material median separation, not boundary
  // inequality). The halves must differ in precedent depth, or there is no
  // memory-depth contrast to attribute anything to.
  const sparseMedianDepth = lowerMedian(sparse.map((d) => d.depth));
  const richMedianDepth = lowerMedian(rich.map((d) => d.depth));
  const depthGap = richMedianDepth - sparseMedianDepth;
  const contrastReady =
    depthGap >= minDepthGap && richMedianDepth >= 2 * Math.max(1, sparseMedianDepth);
  if (!contrastReady) {
    return {
      ...base,
      sparseN,
      richN,
      sparseMedianDepth,
      richMedianDepth,
      depthGap,
      reason: "depth-contrast-too-small",
    };
  }

  // Step 6 - cohort validated rates + the raw difference.
  const sparseRate = sparse.filter((d) => d.validated).length / sparseN;
  const richRate = rich.filter((d) => d.validated).length / richN;
  const rawDiff = richRate - sparseRate;
  const swingPoints = Math.round(100 / Math.min(sparseN, richN));

  const computed: MemoryLift = {
    liftPoints: null,
    sparseRate,
    richRate,
    sparseN,
    richN,
    swingPoints,
    sparseMedianDepth,
    richMedianDepth,
    depthGap,
    droppedOutcomes: dropped,
    reason: null,
  };

  // Step 7 - noise gate (the load-bearing honesty gate). A measured-equal result
  // (|diff| ~ 0) is a real 0, never collapsed to null. Otherwise publish only if
  // the difference clears one 95% z-interval of noise AND one outcome's resolution.
  const absDiff = Math.abs(rawDiff);
  if (absDiff <= 1e-9) {
    return { ...computed, liftPoints: 0, reason: null };
  }
  const se = Math.sqrt(
    (richRate * (1 - richRate)) / richN + (sparseRate * (1 - sparseRate)) / sparseN,
  );
  const margin = 1.96 * se;
  const oneOutcome = 1 / Math.min(sparseN, richN);
  if (absDiff > margin && absDiff >= oneOutcome) {
    // Step 8 - whole percentage points only (a decimal is false precision at this N);
    // a negative difference is reported as-is, never floored or flipped.
    return { ...computed, liftPoints: Math.round(rawDiff * 100), reason: null };
  }
  return { ...computed, liftPoints: null, reason: "lift-within-noise" };
}
