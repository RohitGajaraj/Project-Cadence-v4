import { describe, it, expect } from "bun:test";
import { monthlyGrantCredits, resetDelta } from "./credits.functions";

describe("monthlyGrantCredits", () => {
  it("grants each tier its FREE_MONTHLY_CREDITS * multiplier base", () => {
    // 500 base * (free 1 / pro 5 / max 20 / team 20)
    expect(monthlyGrantCredits("free")).toBe(500);
    expect(monthlyGrantCredits("pro")).toBe(2500);
    expect(monthlyGrantCredits("max")).toBe(10000);
    expect(monthlyGrantCredits("team")).toBe(10000);
  });

  it("returns 0 for enterprise (a negotiated custom model, not the base grant)", () => {
    expect(monthlyGrantCredits("enterprise")).toBe(0);
  });

  it("is a non-negative integer for every tier", () => {
    for (const tier of ["free", "pro", "max", "team", "enterprise"] as const) {
      const g = monthlyGrantCredits(tier);
      expect(Number.isInteger(g)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(0);
    }
  });

  it("never grants a paid tier less than the free tier", () => {
    const free = monthlyGrantCredits("free");
    for (const tier of ["pro", "max", "team"] as const) {
      expect(monthlyGrantCredits(tier)).toBeGreaterThanOrEqual(free);
    }
  });
});

describe("resetDelta", () => {
  it("is the signed move from the current included balance to the monthly grant", () => {
    expect(resetDelta(300, 500)).toBe(200); // partial spend -> top back up
    expect(resetDelta(500, 500)).toBe(0); // untouched -> no movement
    expect(resetDelta(700, 500)).toBe(-200); // leftover above the grant -> reset down
    expect(resetDelta(0, 2500)).toBe(2500); // fully spent -> full re-grant
  });

  it("reconciles: currentIncluded + resetDelta === monthlyGrant", () => {
    const current = 137;
    const grant = 2500;
    expect(current + resetDelta(current, grant)).toBe(grant);
  });

  it("floors fractional inputs to whole credits", () => {
    expect(resetDelta(100.9, 500.9)).toBe(400);
  });
});
