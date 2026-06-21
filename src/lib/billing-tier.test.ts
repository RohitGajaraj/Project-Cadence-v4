import { describe, expect, it } from "vitest";
import {
  creditsFromLookupKey,
  defaultMonthlyLookupKey,
  lookupKeyFor,
  tierFromLookupKey,
} from "./billing-tier";
import type { PlanTier } from "./entitlements";

describe("tierFromLookupKey", () => {
  it("maps the seeded prefixes to tiers", () => {
    expect(tierFromLookupKey("cluster_1k_monthly")).toBe("pro");
    expect(tierFromLookupKey("constellation_5k_monthly")).toBe("max");
    expect(tierFromLookupKey("galaxy_1k_seat_monthly")).toBe("team");
  });
  it("returns null for top-ups and junk", () => {
    expect(tierFromLookupKey("topup_250")).toBeNull();
    expect(tierFromLookupKey("nope")).toBeNull();
    expect(tierFromLookupKey(null)).toBeNull();
    expect(tierFromLookupKey(undefined)).toBeNull();
  });
});

describe("creditsFromLookupKey", () => {
  it("resolves the live pricing_bundles subscription keys", () => {
    // Cluster (pro)
    expect(creditsFromLookupKey("cluster_500_monthly")).toBe(500);
    expect(creditsFromLookupKey("cluster_1k_monthly")).toBe(1000);
    expect(creditsFromLookupKey("cluster_2k_yearly")).toBe(2000);
    expect(creditsFromLookupKey("cluster_5k_monthly")).toBe(5000);
    // Constellation (max)
    expect(creditsFromLookupKey("constellation_2k_monthly")).toBe(2000);
    expect(creditsFromLookupKey("constellation_5k_monthly")).toBe(5000);
    expect(creditsFromLookupKey("constellation_10k_monthly")).toBe(10000);
    expect(creditsFromLookupKey("constellation_25k_yearly")).toBe(25000);
    // Galaxy (team, per-seat) - incl. the 2500 raw form
    expect(creditsFromLookupKey("galaxy_500_seat_monthly")).toBe(500);
    expect(creditsFromLookupKey("galaxy_1k_seat_monthly")).toBe(1000);
    expect(creditsFromLookupKey("galaxy_2500_seat_monthly")).toBe(2500);
    expect(creditsFromLookupKey("galaxy_10k_seat_yearly")).toBe(10000);
  });

  it("resolves the seeded top-up keys (incl. the N_Mk decimal form)", () => {
    expect(creditsFromLookupKey("topup_250")).toBe(250);
    expect(creditsFromLookupKey("topup_1k")).toBe(1000);
    expect(creditsFromLookupKey("topup_2_5k")).toBe(2500);
  });

  it("is the exact inverse of lookupKeyFor for every catalog bundle", () => {
    const cases: Array<[PlanTier, number]> = [
      ["pro", 500],
      ["pro", 1000],
      ["pro", 2000],
      ["pro", 5000],
      ["max", 2000],
      ["max", 5000],
      ["max", 10000],
      ["max", 25000],
      ["team", 500],
      ["team", 1000],
      ["team", 2500],
      ["team", 5000],
      ["team", 10000],
    ];
    for (const [tier, credits] of cases) {
      for (const interval of ["monthly", "yearly"] as const) {
        const key = lookupKeyFor(tier, credits, interval);
        expect(key, `${tier}/${credits}/${interval}`).not.toBeNull();
        expect(creditsFromLookupKey(key), `roundtrip ${key}`).toBe(credits);
      }
    }
  });

  it("returns null for unknown / non-credit keys", () => {
    expect(creditsFromLookupKey(null)).toBeNull();
    expect(creditsFromLookupKey(undefined)).toBeNull();
    expect(creditsFromLookupKey("free")).toBeNull();
    expect(creditsFromLookupKey("cluster__monthly")).toBeNull();
    expect(creditsFromLookupKey("garbage")).toBeNull();
    expect(creditsFromLookupKey("topup_abc")).toBeNull();
  });
});

describe("defaultMonthlyLookupKey resolves to a real credit volume", () => {
  it("each tier's default bundle is parseable", () => {
    for (const tier of ["pro", "max", "team"] as const) {
      const key = defaultMonthlyLookupKey(tier);
      expect(key).not.toBeNull();
      expect(creditsFromLookupKey(key)).toBeGreaterThan(0);
    }
    expect(defaultMonthlyLookupKey("free")).toBeNull();
    expect(defaultMonthlyLookupKey("enterprise")).toBeNull();
  });
});
