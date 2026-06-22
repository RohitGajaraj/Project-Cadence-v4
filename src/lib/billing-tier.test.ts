import { describe, expect, it } from "vitest";
import {
  FALLBACK_TOPUP_CAP,
  creditsFromLookupKey,
  defaultMonthlyLookupKey,
  effectiveTierForStatus,
  lookupKeyFor,
  subscriptionStatusGrantsCredits,
  tierFromLookupKey,
  topUpCycleCap,
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

describe("effectiveTierForStatus — the access-preservation rule the webhook applies", () => {
  it("keeps the paid tier while the subscription is entitlement-bearing", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      expect(effectiveTierForStatus("pro", status)).toBe("pro");
      expect(effectiveTierForStatus("max", status)).toBe("max");
      expect(effectiveTierForStatus("team", status)).toBe("team");
    }
  });
  it("preserves access through past_due (dunning, not termination)", () => {
    // The founder ruling: do not yank access while Stripe retries the card.
    expect(effectiveTierForStatus("pro", "past_due")).toBe("pro");
  });
  it("drops to free on every terminal / non-paying status", () => {
    for (const status of [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
      "",
      "unknown_future_status",
    ]) {
      expect(effectiveTierForStatus("pro", status)).toBe("free");
      expect(effectiveTierForStatus("max", status)).toBe("free");
    }
  });
});

describe("subscriptionStatusGrantsCredits — only a paying state mints credits", () => {
  it("grants on active and trialing", () => {
    expect(subscriptionStatusGrantsCredits("active")).toBe(true);
    expect(subscriptionStatusGrantsCredits("trialing")).toBe(true);
  });
  it("does NOT grant on past_due — access is kept, but no fresh allowance until payment clears", () => {
    // Distinct from effectiveTierForStatus, which DOES preserve the tier on past_due.
    expect(subscriptionStatusGrantsCredits("past_due")).toBe(false);
  });
  it("does NOT grant on any terminal / non-paying status", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", ""]) {
      expect(subscriptionStatusGrantsCredits(status)).toBe(false);
    }
  });
});

describe("topUpCycleCap — the single source the checkout pre-check, credits view, and SQL RPC all agree on", () => {
  it("caps a paying account at 2x its monthly grant", () => {
    expect(topUpCycleCap(2500)).toBe(5000);
    expect(topUpCycleCap(5000)).toBe(10000);
    expect(topUpCycleCap(10000)).toBe(20000);
    expect(topUpCycleCap(1)).toBe(2);
  });
  it("falls back to FALLBACK_TOPUP_CAP when there is no monthly grant (engine dormant / free)", () => {
    expect(topUpCycleCap(0)).toBe(FALLBACK_TOPUP_CAP);
    expect(topUpCycleCap(null)).toBe(FALLBACK_TOPUP_CAP);
    expect(topUpCycleCap(undefined)).toBe(FALLBACK_TOPUP_CAP);
  });
  it("never returns a negative cap on a malformed negative grant (treats it as no grant)", () => {
    expect(topUpCycleCap(-100)).toBe(FALLBACK_TOPUP_CAP);
  });
  it("FALLBACK_TOPUP_CAP is the documented dormant ceiling (must stay in lockstep with the SQL RPC fallback)", () => {
    expect(FALLBACK_TOPUP_CAP).toBe(5000);
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
