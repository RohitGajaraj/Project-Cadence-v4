import { describe, expect, test } from "bun:test";
import { mergeReadinessFromCi, overallFromChecks, type CiCheckLite } from "./studio-ci";

const c = (status: string, conclusion: string | null): CiCheckLite => ({ status, conclusion });

describe("overallFromChecks", () => {
  test("no checks => neutral (no CI configured)", () => {
    expect(overallFromChecks([])).toBe("neutral");
  });

  test("all completed + success => success", () => {
    expect(overallFromChecks([c("completed", "success"), c("completed", "success")])).toBe(
      "success",
    );
  });

  test("any failing conclusion => failure (even if others pass)", () => {
    expect(overallFromChecks([c("completed", "success"), c("completed", "failure")])).toBe(
      "failure",
    );
  });

  test("failure dominates a still-running check", () => {
    expect(overallFromChecks([c("in_progress", null), c("completed", "failure")])).toBe("failure");
  });

  test("an unfinished check (no failures) => pending", () => {
    expect(overallFromChecks([c("completed", "success"), c("queued", null)])).toBe("pending");
  });

  test("timed_out / action_required / cancelled all count as failure", () => {
    expect(overallFromChecks([c("completed", "timed_out")])).toBe("failure");
    expect(overallFromChecks([c("completed", "action_required")])).toBe("failure");
    expect(overallFromChecks([c("completed", "cancelled")])).toBe("failure");
  });

  test("neutral / skipped conclusions do not block success", () => {
    expect(overallFromChecks([c("completed", "neutral"), c("completed", "skipped")])).toBe(
      "success",
    );
  });
});

describe("mergeReadinessFromCi", () => {
  test("success => allowed", () => {
    expect(mergeReadinessFromCi("success").allowed).toBe(true);
  });

  test("neutral (no CI) => allowed (cannot gate on absent CI)", () => {
    expect(mergeReadinessFromCi("neutral").allowed).toBe(true);
  });

  test("failure => blocked with an actionable reason", () => {
    const r = mergeReadinessFromCi("failure");
    expect(r.allowed).toBe(false);
    expect(r.reason.toLowerCase()).toContain("red");
  });

  test("pending => blocked (do not merge mid-run)", () => {
    const r = mergeReadinessFromCi("pending");
    expect(r.allowed).toBe(false);
    expect(r.reason.toLowerCase()).toContain("running");
  });

  test("green CI is the only positive path to ship (success xor neutral)", () => {
    // Regression guard for the J2 gate: red and pending must never be allowed.
    expect(mergeReadinessFromCi("failure").allowed).toBe(false);
    expect(mergeReadinessFromCi("pending").allowed).toBe(false);
  });
});
