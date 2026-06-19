import { describe, it, expect } from "bun:test";
import {
  monthlyGrantCredits,
  resetDelta,
  sumDebitCredits,
  rollupAttribution,
  capExceeded,
  creditWindowStartIso,
  type LedgerDebitRow,
} from "./credits.functions";

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

// --- WM-M14: attribution rollup + cap math ----------------------------------

const DEBITS: LedgerDebitRow[] = [
  { delta_credits: -10, product_id: "p1", user_id: "u1" },
  { delta_credits: -5, product_id: "p1", user_id: "u2" },
  { delta_credits: -7, product_id: "p2", user_id: "u1" },
  { delta_credits: -3, product_id: null, user_id: "u2" }, // unattributed product
];

describe("sumDebitCredits", () => {
  it("sums the absolute value of debit (negative) deltas", () => {
    expect(sumDebitCredits(DEBITS)).toBe(25);
  });

  it("ignores grant/reset (non-negative) and non-finite deltas", () => {
    const rows: LedgerDebitRow[] = [
      { delta_credits: -10, product_id: "p1", user_id: "u1" },
      { delta_credits: 500, product_id: null, user_id: "u1" }, // a grant, not a debit
      { delta_credits: 0, product_id: null, user_id: "u1" },
      { delta_credits: Number.NaN, product_id: null, user_id: "u1" },
    ];
    expect(sumDebitCredits(rows)).toBe(10);
  });

  it("is 0 for no rows", () => {
    expect(sumDebitCredits([])).toBe(0);
  });
});

describe("rollupAttribution", () => {
  it("groups debits by product and by member as positive credits", () => {
    const r = rollupAttribution(DEBITS);
    expect(r.byProduct).toEqual([
      { id: "p1", credits: 15 },
      { id: "p2", credits: 7 },
      { id: null, credits: 3 },
    ]);
    expect(r.byMember).toEqual([
      { id: "u1", credits: 17 },
      { id: "u2", credits: 8 },
    ]);
  });

  it("reconciles: sum(byProduct) === sum(byMember) === totalDebited (the spec invariant)", () => {
    const r = rollupAttribution(DEBITS);
    const sum = (b: { credits: number }[]) => b.reduce((n, x) => n + x.credits, 0);
    expect(r.totalDebited).toBe(25);
    expect(sum(r.byProduct)).toBe(25);
    expect(sum(r.byMember)).toBe(25);
  });

  it("sorts each dimension by spend, high to low", () => {
    const credits = rollupAttribution(DEBITS).byProduct.map((b) => b.credits);
    expect(credits).toEqual([...credits].sort((a, b) => b - a));
  });

  it("ignores grant/reset rows and returns empty buckets for no debits", () => {
    expect(rollupAttribution([{ delta_credits: 500, product_id: null, user_id: "u1" }])).toEqual({
      byProduct: [],
      byMember: [],
      totalDebited: 0,
    });
  });
});

describe("capExceeded", () => {
  it("is true only when spent + projected pushes past the cap", () => {
    expect(capExceeded(90, 5, 100)).toBe(false); // 95 <= 100
    expect(capExceeded(95, 5, 100)).toBe(false); // exactly at the cap is allowed
    expect(capExceeded(96, 5, 100)).toBe(true); // 101 > 100
  });

  it("a cap of 0 blocks any billable draw", () => {
    expect(capExceeded(0, 1, 0)).toBe(true);
    expect(capExceeded(0, 0, 0)).toBe(false);
  });

  it("a non-finite cap means no cap (never exceeded)", () => {
    expect(capExceeded(1_000_000, 1, Number.POSITIVE_INFINITY)).toBe(false);
    expect(capExceeded(1, 1, Number.NaN)).toBe(false);
  });

  it("clamps negative inputs to 0 before comparing", () => {
    expect(capExceeded(-50, 5, 10)).toBe(false); // spent floored to 0 -> 5 <= 10
  });
});

describe("creditWindowStartIso", () => {
  const now = "2026-06-19T17:10:00.000Z";

  it("day -> midnight UTC today", () => {
    expect(creditWindowStartIso("day", null, now)).toBe("2026-06-19T00:00:00.000Z");
  });

  it("month -> first of this month", () => {
    expect(creditWindowStartIso("month", "2026-06-04T00:00:00.000Z", now)).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });

  it("cycle -> the account's billing anchor when present", () => {
    expect(creditWindowStartIso("cycle", "2026-06-04T08:00:00.000Z", now)).toBe(
      "2026-06-04T08:00:00.000Z",
    );
  });

  it("cycle -> the month start when no anchor is set", () => {
    expect(creditWindowStartIso("cycle", null, now)).toBe("2026-06-01T00:00:00.000Z");
  });
});
