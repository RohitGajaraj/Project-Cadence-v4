import { describe, it, expect } from "bun:test";
import { summarizeHealth } from "./health-view";
import type { ReliabilitySlo, RunawayReport } from "@/lib/reliability.functions";
import type { ErrorBudgetStatus } from "./slo";
import type { RunawaySeverity } from "./runaway";

function slo(budgetStatus: ErrorBudgetStatus, availabilityPct = 99.5): ReliabilitySlo {
  return {
    windowDays: 7,
    sampleCount: 100,
    truncated: false,
    metrics: {
      evaluated: 100,
      ok: 99,
      errors: 1,
      blocked: 0,
      availabilityPct,
      errorRatePct: 100 - availabilityPct,
      p50LatencyMs: 120,
      p95LatencyMs: 400,
      budget: {
        targetAvailabilityPct: 99,
        allowedErrorPct: 1,
        consumedPct: budgetStatus === "exhausted" ? 120 : budgetStatus === "warning" ? 80 : 20,
        remainingPct: budgetStatus === "exhausted" ? 0 : budgetStatus === "warning" ? 20 : 80,
        status: budgetStatus,
      },
    },
    summary: "",
  };
}

function runaway(severities: RunawaySeverity[]): RunawayReport {
  const flagged = severities
    .filter((s) => s !== "none")
    .map((severity, i) => ({
      missionId: `m${i}`,
      isRunaway: severity === "runaway",
      severity,
      reasons: ["a step retried 5 times"],
    }));
  return {
    windowDays: 7,
    missionsScanned: 10,
    truncated: false,
    flagged,
    summary: "",
  };
}

describe("summarizeHealth", () => {
  it("returns unknown when no read has answered yet (never a false healthy)", () => {
    const r = summarizeHealth(undefined, undefined);
    expect(r.state).toBe("unknown");
    expect(r.signals).toEqual([]);
  });

  it("is healthy when the budget is fine and nothing is spinning", () => {
    const r = summarizeHealth(slo("healthy"), runaway([]));
    expect(r.state).toBe("healthy");
    expect(r.headline).toBe("Everything looks healthy.");
    expect(r.signals).toEqual([]);
  });

  it("escalates to attention when the error budget is in warning", () => {
    const r = summarizeHealth(slo("warning", 97), runaway([]));
    expect(r.state).toBe("attention");
    expect(r.signals.some((s) => s.includes("running low") && s.includes("97%"))).toBe(true);
  });

  it("escalates to attention with a spent message when the budget is exhausted", () => {
    const r = summarizeHealth(slo("exhausted", 90), runaway([]));
    expect(r.state).toBe("attention");
    expect(r.signals.some((s) => s.includes("spent") && s.includes("90%"))).toBe(true);
  });

  it("escalates to attention and counts spinning missions (plural)", () => {
    const r = summarizeHealth(slo("healthy"), runaway(["runaway", "runaway"]));
    expect(r.state).toBe("attention");
    expect(r.signals[0]).toBe("2 missions spinning right now");
  });

  it("uses the singular form for one spinning mission", () => {
    const r = summarizeHealth(slo("healthy"), runaway(["runaway"]));
    expect(r.signals[0]).toBe("1 mission spinning right now");
  });

  it("treats terminal watch missions as informational, not an escalation", () => {
    const r = summarizeHealth(slo("healthy"), runaway(["watch", "watch"]));
    expect(r.state).toBe("healthy");
    expect(r.signals).toContain("2 finished missions to review");
  });

  it("works when only one read resolved (runaway present, slo still loading)", () => {
    const r = summarizeHealth(undefined, runaway(["runaway"]));
    expect(r.state).toBe("attention");
    expect(r.signals[0]).toBe("1 mission spinning right now");
  });

  it("works when only the slo read resolved healthy", () => {
    const r = summarizeHealth(slo("healthy"), undefined);
    expect(r.state).toBe("healthy");
    expect(r.signals).toEqual([]);
  });

  it("stays unknown when only the runaway read resolved clean (primary slo budget still unread)", () => {
    const r = summarizeHealth(undefined, runaway([]));
    expect(r.state).toBe("unknown");
    expect(r.signals).toEqual([]);
  });

  it("orders signals most-urgent-first: spinning, then budget, then watch", () => {
    const r = summarizeHealth(slo("warning", 95), runaway(["runaway", "watch"]));
    expect(r.signals[0]).toContain("spinning");
    expect(r.signals[1]).toContain("budget");
    expect(r.signals[2]).toContain("review");
  });

  it("emits no em or en dashes in any line (humanized-output gate)", () => {
    const all = [
      summarizeHealth(undefined, undefined),
      summarizeHealth(slo("exhausted", 90), runaway(["runaway", "watch"])),
    ];
    for (const r of all) {
      for (const line of [r.headline, ...r.signals]) {
        expect(line.includes("—")).toBe(false);
        expect(line.includes("–")).toBe(false);
      }
    }
  });
});
