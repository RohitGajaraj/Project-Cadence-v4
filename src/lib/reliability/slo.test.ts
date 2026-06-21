import { describe, it, expect } from "bun:test";
import {
  computeSlo,
  percentile,
  errorBudgetStatus,
  summarizeSlo,
  normalizeStatus,
  DEFAULT_SLO_CONFIG,
  type CallSample,
} from "./slo";

const ok = (latencyMs = 100): CallSample => ({ status: "ok", latencyMs });
const err = (latencyMs = 100): CallSample => ({ status: "error", latencyMs });
const blocked = (): CallSample => ({ status: "blocked", latencyMs: 0 });

describe("percentile (nearest-rank, ascending)", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([], 95)).toBe(0);
  });

  it("returns the single value regardless of p", () => {
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([7], 95)).toBe(7);
  });

  it("computes p50 and p95 on a 1..10 ramp", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // ceil(0.5*10)-1 = 4 -> xs[4] = 5
    expect(percentile(xs, 50)).toBe(5);
    // ceil(0.95*10)-1 = 9 -> xs[9] = 10
    expect(percentile(xs, 95)).toBe(10);
  });

  it("clamps the extremes", () => {
    expect(percentile([10, 20, 30], 0)).toBe(10);
    expect(percentile([10, 20, 30], 100)).toBe(30);
  });
});

describe("errorBudgetStatus", () => {
  it("buckets healthy / warning / exhausted", () => {
    expect(errorBudgetStatus(0)).toBe("healthy");
    expect(errorBudgetStatus(74.9)).toBe("healthy");
    expect(errorBudgetStatus(75)).toBe("warning");
    expect(errorBudgetStatus(99.9)).toBe("warning");
    expect(errorBudgetStatus(100)).toBe("exhausted");
    expect(errorBudgetStatus(200)).toBe("exhausted");
  });
});

describe("normalizeStatus (fail-visible coercion)", () => {
  it("passes the three canonical states through", () => {
    expect(normalizeStatus("ok")).toBe("ok");
    expect(normalizeStatus("error")).toBe("error");
    expect(normalizeStatus("blocked")).toBe("blocked");
  });

  it("maps anything unknown/NULL to error, NEVER to the excluded blocked bucket", () => {
    // The crux: an unknown status must NOT silently vanish from the availability denominator.
    expect(normalizeStatus("timeout")).toBe("error");
    expect(normalizeStatus(null)).toBe("error");
    expect(normalizeStatus(undefined)).toBe("error");
    expect(normalizeStatus("")).toBe("error");
    expect(normalizeStatus(42)).toBe("error");
  });

  it("recognizes known success synonyms (seed/legacy 'success') as ok, not error", () => {
    // Live-confirmed: ai_events carries 'success' rows from seed/legacy telemetry. Counting them as
    // errors would understate availability on a window that includes them. Fail-visible still holds
    // for a genuinely unknown word.
    expect(normalizeStatus("success")).toBe("ok");
    expect(normalizeStatus("succeeded")).toBe("ok");
    // a real success row must add to availability, not consume the error budget
    const samples: CallSample[] = [
      { status: normalizeStatus("ok"), latencyMs: 100 },
      { status: normalizeStatus("success"), latencyMs: 100 },
      { status: normalizeStatus("error"), latencyMs: 100 },
    ];
    const m = computeSlo(samples);
    expect(m.ok).toBe(2);
    expect(m.errors).toBe(1);
    expect(m.availabilityPct).toBeCloseTo(66.67, 1);
  });

  it("a junk status counts against availability (not hidden as blocked)", () => {
    const samples: CallSample[] = [
      { status: normalizeStatus("ok"), latencyMs: 100 },
      { status: normalizeStatus("garbage"), latencyMs: 100 },
    ];
    const m = computeSlo(samples);
    expect(m.errors).toBe(1);
    expect(m.blocked).toBe(0);
    expect(m.evaluated).toBe(2);
    expect(m.availabilityPct).toBe(50);
  });
});

describe("computeSlo", () => {
  it("reports a vacuous-but-defined result for an empty window", () => {
    const m = computeSlo([]);
    expect(m.evaluated).toBe(0);
    expect(m.availabilityPct).toBe(100);
    expect(m.errorRatePct).toBe(0);
    expect(m.p50LatencyMs).toBe(0);
    expect(m.p95LatencyMs).toBe(0);
    expect(m.budget.remainingPct).toBe(100);
    expect(m.budget.status).toBe("healthy");
  });

  it("reports a perfect window when every call is ok", () => {
    const m = computeSlo([ok(50), ok(150), ok(250)]);
    expect(m.ok).toBe(3);
    expect(m.errors).toBe(0);
    expect(m.evaluated).toBe(3);
    expect(m.availabilityPct).toBe(100);
    expect(m.budget.consumedPct).toBe(0);
    expect(m.budget.remainingPct).toBe(100);
    expect(m.budget.status).toBe("healthy");
  });

  it("EXCLUDES blocked calls from availability and latency (the correctness crux)", () => {
    // 8 ok, 0 error, 2 blocked -> availability is 100% (blocked is not downtime), not 80%.
    const samples = [...Array(8)].map(() => ok(100)).concat([blocked(), blocked()]);
    const m = computeSlo(samples);
    expect(m.ok).toBe(8);
    expect(m.errors).toBe(0);
    expect(m.blocked).toBe(2);
    expect(m.evaluated).toBe(8);
    expect(m.availabilityPct).toBe(100);
    // blocked rows (latencyMs 0) must not drag the percentile down.
    expect(m.p50LatencyMs).toBe(100);
    expect(m.p95LatencyMs).toBe(100);
  });

  it("computes availability and error rate over ok+error only", () => {
    // 99 ok + 1 error = 99% availability against the 99% default target.
    const samples = [...Array(99)].map(() => ok(120)).concat([err(800)]);
    const m = computeSlo(samples);
    expect(m.evaluated).toBe(100);
    expect(m.availabilityPct).toBe(99);
    expect(m.errorRatePct).toBe(1);
    // observed error 1% / allowed 1% = exactly at budget -> consumed 100 -> exhausted.
    expect(m.budget.allowedErrorPct).toBe(1);
    expect(m.budget.consumedPct).toBe(100);
    expect(m.budget.remainingPct).toBe(0);
    expect(m.budget.status).toBe("exhausted");
  });

  it("leaves budget healthy when failures stay well under target", () => {
    // 999 ok + 1 error against a 99% target: observed 0.1% / allowed 1% = 10% consumed.
    const samples = [...Array(999)].map(() => ok(100)).concat([err(500)]);
    const m = computeSlo(samples);
    expect(m.budget.consumedPct).toBe(10);
    expect(m.budget.remainingPct).toBe(90);
    expect(m.budget.status).toBe("healthy");
  });

  it("flags warning between 75% and 100% of the budget", () => {
    // 112 ok + 1 error, 99% target: observed 1/113 = 0.885% / allowed 1% = 88.5% consumed -> warning.
    const warn = computeSlo([...Array(112)].map(() => ok(100)).concat([err(100)]), {
      targetAvailabilityPct: 99,
    });
    expect(warn.budget.consumedPct).toBe(88.5);
    expect(warn.budget.status).toBe("warning");
  });

  it("handles a zero-tolerance (100%) target: any error blows the budget", () => {
    const clean = computeSlo([ok(), ok()], { targetAvailabilityPct: 100 });
    expect(clean.budget.allowedErrorPct).toBe(0);
    expect(clean.budget.consumedPct).toBe(0);
    expect(clean.budget.status).toBe("healthy");

    const dirty = computeSlo([ok(), err()], { targetAvailabilityPct: 100 });
    expect(dirty.budget.allowedErrorPct).toBe(0);
    expect(dirty.budget.consumedPct).toBe(200);
    expect(dirty.budget.remainingPct).toBe(0);
    expect(dirty.budget.status).toBe("exhausted");
  });

  it("ignores negative/NaN latencies without crashing", () => {
    const m = computeSlo([ok(-5), ok(Number.NaN), ok(300)]);
    expect(m.ok).toBe(3);
    // only the one valid latency (300) feeds the percentile.
    expect(m.p50LatencyMs).toBe(300);
    expect(m.p95LatencyMs).toBe(300);
  });

  it("uses the default config when none is passed", () => {
    const m = computeSlo([ok()]);
    expect(m.budget.targetAvailabilityPct).toBe(DEFAULT_SLO_CONFIG.targetAvailabilityPct);
  });

  it("stays total for a non-finite target (no NaN leaks into the budget)", () => {
    const m = computeSlo([ok(), err()], { targetAvailabilityPct: Number.NaN });
    expect(m.budget.targetAvailabilityPct).toBe(DEFAULT_SLO_CONFIG.targetAvailabilityPct);
    expect(Number.isFinite(m.budget.allowedErrorPct)).toBe(true);
    expect(Number.isFinite(m.budget.consumedPct)).toBe(true);
    expect(Number.isFinite(m.budget.remainingPct)).toBe(true);
    expect(["healthy", "warning", "exhausted"]).toContain(m.budget.status);
  });
});

describe("summarizeSlo", () => {
  it("returns an empty string for an empty window (caller stays silent)", () => {
    expect(summarizeSlo(computeSlo([]))).toBe("");
  });

  it("renders a calm one-liner with grouped counts and human latency", () => {
    const samples = [...Array(1203)].map(() => ok(900)).concat([err(1800)]);
    const line = summarizeSlo(computeSlo(samples));
    expect(line).toContain("1,204 AI calls succeeded");
    expect(line).toContain("p95");
    expect(line).toContain("error budget");
  });

  it("reads sub-second latency in ms and over-second in s", () => {
    expect(summarizeSlo(computeSlo([ok(820)]))).toContain("820ms");
    expect(summarizeSlo(computeSlo([ok(1800)]))).toContain("1.8s");
  });

  it("carries no em or en dashes (humanized-output Tier 2)", () => {
    const line = summarizeSlo(computeSlo([...Array(50)].map(() => ok(100)).concat([err(200)])));
    expect(line).not.toMatch(/[—–]/);
  });
});
