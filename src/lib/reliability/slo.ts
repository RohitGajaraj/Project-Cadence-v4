/**
 * RELIABILITY-SLO — pure SLO / error-budget computation over AI-call telemetry.
 *
 * Closes the `considerations.md` SRE-lens P1 gap "SLOs/SLAs + error budgets": APP-HEALTH gives a
 * binary liveness/readiness probe; this gives the *measured* reliability of the AI surface the
 * operator actually depends on (availability, latency, and how much of the error budget is spent).
 *
 * The substance is here, PURE and deterministic, so it is fully unit-tested with no DB and no
 * publish. The thin `getReliabilitySlo` server fn (reliability.functions.ts) only maps `ai_events`
 * rows to {@link CallSample}s and hands them to {@link computeSlo}.
 *
 * Correctness crux — three call states, not two:
 *  - `ok`      : a successful call. Counts toward availability.
 *  - `error`   : a failed call (provider/model outage, timeout). The real reliability signal;
 *                consumes the error budget.
 *  - `blocked` : a DELIBERATE governance/credit halt (the guardrails working as designed). It is
 *                NOT an outage, so it is excluded from the availability denominator entirely —
 *                otherwise the system would look "unreliable" exactly when its safety rails fire.
 *
 * Engine-Room: per-call ai_events status + latency -> a calm `summarizeSlo` one-liner
 * ("X% of N calls succeeded · p95 Ys"), ready to render on the operator's Engine Room surface (the
 * UI wire-up is a tracked follow-up) -> full per-surface breakdown stays behind the Engine Room.
 */

/** The three terminal states the chokepoint writes to `ai_events.status`. */
export type CallStatus = "ok" | "error" | "blocked";

/**
 * Normalize a raw `ai_events.status` into a terminal SLO state. There is NO CHECK constraint on the
 * column, so an unknown/legacy/NULL value can exist. We fail VISIBLE: anything unrecognized maps to
 * `"error"`, never to the excluded `"blocked"` bucket — so an anomalous row can never silently
 * vanish from the denominator and inflate measured availability (hiding an outage).
 *
 * Known success synonyms are recognized as `"ok"`. The runtime chokepoint only ever writes the three
 * canonical states, but `ai_events` also carries `"success"` rows from seed/legacy/imported telemetry
 * (verified live: the demo workspace has 17 such rows). Counting a KNOWN success as an `"error"` would
 * understate availability on any window that includes those rows — so we map them to `"ok"`. This does
 * NOT weaken the fail-visible guarantee: it applies only to a recognized success word, while a
 * genuinely unknown/NULL status still surfaces as `"error"`.
 */
export function normalizeStatus(raw: unknown): CallStatus {
  if (raw === "ok" || raw === "error" || raw === "blocked") return raw;
  if (raw === "success" || raw === "succeeded") return "ok";
  return "error";
}

/** One AI call, normalized from an `ai_events` row. */
export type CallSample = {
  status: CallStatus;
  /** End-to-end latency in ms. Ignored for `blocked` rows (no real call ran). */
  latencyMs: number;
};

/** SLO target. A separate type so a future per-surface override is a one-line change. */
export type SloConfig = {
  /** Target availability as a percentage, e.g. 99 means "99% of evaluated calls succeed". */
  targetAvailabilityPct: number;
};

/**
 * 99% is the conservative default for a BYO-model AI surface where some upstream provider error is
 * expected and already absorbed by the PROVIDER-FALLBACK chain. Tune per surface as live data lands.
 */
export const DEFAULT_SLO_CONFIG: SloConfig = { targetAvailabilityPct: 99 };

/** How much of the error budget is left, bucketed for a calm three-state operator signal. */
export type ErrorBudgetStatus = "healthy" | "warning" | "exhausted";

export type ErrorBudget = {
  targetAvailabilityPct: number;
  /** The failure fraction the target permits, as a percentage (100 - target). */
  allowedErrorPct: number;
  /** Share of the budget consumed: 0 = none spent, 100 = exactly at target, >100 = blown. */
  consumedPct: number;
  /** Budget remaining, clamped to [0, 100] for display. */
  remainingPct: number;
  status: ErrorBudgetStatus;
};

export type SloMetrics = {
  /** Calls that count toward availability = ok + error (blocked is excluded). */
  evaluated: number;
  ok: number;
  /** Failed calls (outages / provider errors). */
  errors: number;
  /** Governance/credit halts — deliberate, never counted as downtime. */
  blocked: number;
  /** ok / evaluated, as a percentage (2dp). 100 when nothing was evaluated. */
  availabilityPct: number;
  /** errors / evaluated, as a percentage (2dp). 0 when nothing was evaluated. */
  errorRatePct: number;
  /** Median latency (ms) over evaluated calls. 0 when none. */
  p50LatencyMs: number;
  /** 95th-percentile latency (ms) over evaluated calls. 0 when none. */
  p95LatencyMs: number;
  budget: ErrorBudget;
};

/** Round to a fixed number of decimal places without floating-point display noise. */
function round(value: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/**
 * Nearest-rank percentile over an ASCENDING-sorted array. `p` in [0, 100].
 * Deterministic and dependency-free: index = ceil(p/100 * n) - 1, clamped to [0, n-1].
 * Returns 0 for an empty array so callers never have to special-case it.
 */
export function percentile(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (p <= 0) return sortedAsc[0];
  if (p >= 100) return sortedAsc[n - 1];
  const rank = Math.ceil((p / 100) * n) - 1;
  const idx = Math.min(Math.max(rank, 0), n - 1);
  return sortedAsc[idx];
}

/** Bucket the consumed-budget fraction into the calm three-state operator signal. */
export function errorBudgetStatus(consumedPct: number): ErrorBudgetStatus {
  if (consumedPct >= 100) return "exhausted";
  if (consumedPct >= 75) return "warning";
  return "healthy";
}

/**
 * Compute SLO metrics + the error budget from a window of call samples. Pure and total: every input
 * (including empty, all-blocked, or a 100% target) yields a well-defined result with no throw.
 *
 * Availability and latency are computed over the EVALUATED set (ok + error). A window with zero
 * evaluated calls reports 100% availability (nothing failed) and a full remaining budget — the
 * caller decides whether a quiet window is worth surfacing at all.
 */
export function computeSlo(
  samples: CallSample[],
  config: SloConfig = DEFAULT_SLO_CONFIG,
): SloMetrics {
  let ok = 0;
  let errors = 0;
  let blocked = 0;
  const latencies: number[] = [];

  for (const s of samples) {
    if (s.status === "blocked") {
      blocked += 1;
      continue; // deliberate halt: not an outage, not a latency data point
    }
    if (s.status === "ok") ok += 1;
    else errors += 1;
    // Latency is meaningful for both ok and error (a slow failure still ran).
    if (Number.isFinite(s.latencyMs) && s.latencyMs >= 0) latencies.push(s.latencyMs);
  }

  const evaluated = ok + errors;
  const availabilityPct = evaluated === 0 ? 100 : round((ok / evaluated) * 100);
  const errorRatePct = evaluated === 0 ? 0 : round((errors / evaluated) * 100);

  latencies.sort((a, b) => a - b);
  const p50LatencyMs = Math.round(percentile(latencies, 50));
  const p95LatencyMs = Math.round(percentile(latencies, 95));

  // Keep the totality guarantee true for ANY input: a non-finite target falls back to the default
  // rather than propagating NaN through the budget math. (The server fn's validator also bounds it.)
  const target = Number.isFinite(config.targetAvailabilityPct)
    ? config.targetAvailabilityPct
    : DEFAULT_SLO_CONFIG.targetAvailabilityPct;
  const allowedErrorPct = round(100 - target);
  const observedErrorPct = evaluated === 0 ? 0 : (errors / evaluated) * 100;
  // A zero-tolerance target (100%) has no budget: any error blows it, none keeps it pristine.
  const consumedPct =
    allowedErrorPct <= 0
      ? errors > 0
        ? 200
        : 0
      : round((observedErrorPct / allowedErrorPct) * 100);
  const remainingPct = round(Math.min(Math.max(100 - consumedPct, 0), 100));

  return {
    evaluated,
    ok,
    errors,
    blocked,
    availabilityPct,
    errorRatePct,
    p50LatencyMs,
    p95LatencyMs,
    budget: {
      targetAvailabilityPct: target,
      allowedErrorPct,
      consumedPct,
      remainingPct,
      status: errorBudgetStatus(consumedPct),
    },
  };
}

/** Compact thousands grouping without locale surprises (deterministic across runtimes). */
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** ms -> a human reading: "820ms" under a second, "1.8s" above. */
function readLatency(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${round(ms / 1000, 1)}s`;
}

/**
 * One calm, operator-readable line. Authored display copy (humanized-output Tier 2: no em/en
 * dashes, no AI-cliché filler). Returns "" for an empty window so the caller can stay silent.
 */
export function summarizeSlo(m: SloMetrics): string {
  if (m.evaluated === 0) return "";
  const head = `${m.availabilityPct}% of ${group(m.evaluated)} AI calls succeeded`;
  const lat = `p95 ${readLatency(m.p95LatencyMs)}`;
  const budget =
    m.budget.status === "exhausted"
      ? "error budget spent"
      : `${m.budget.remainingPct}% of the error budget left`;
  return `${head} · ${lat} · ${budget}`;
}
