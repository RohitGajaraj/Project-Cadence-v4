import { describe, it, expect } from "bun:test";
import {
  entitlementsFor,
  isPlanTier,
  normalizePlanTier,
  planPresentation,
  limitFor,
  FREE_MEMORY_RETENTION_DAYS,
  FREE_MONTHLY_CREDITS,
  PLAN_TIERS,
} from "./entitlements";

describe("PLAN_TIERS", () => {
  it("is the five-tier Constellation ladder, in order", () => {
    expect([...PLAN_TIERS]).toEqual(["free", "pro", "max", "team", "enterprise"]);
  });
});

describe("entitlementsFor", () => {
  it("free does NOT persist memory and carries a finite (rolling) retention", () => {
    const e = entitlementsFor("free");
    expect(e.memoryPersists).toBe(false);
    expect(e.memoryRetentionDays).toBe(FREE_MEMORY_RETENTION_DAYS);
    expect(FREE_MEMORY_RETENTION_DAYS).toBe(30);
    expect(e.crossWorkspaceMemory).toBe(false);
    expect(e.criticEverywhere).toBe(false);
    expect(e.workspaceLimit).toBe(1);
    expect(e.productLimit).toBe(2);
    expect(e.creditMultiplier).toBe(1);
    expect(e.creditMonthlyBase).toBe(FREE_MONTHLY_CREDITS);
    expect(e.creditTopUps).toBe(false);
    expect(e.topUpCapPerCycle).toBe(0);
    expect(e.rbac).toBe(false);
    expect(e.sharedWorkspaceMemory).toBe(false);
    expect(e.perRoleApprovalLanes).toBe(false);
  });

  it("pro persists memory, pools recall across workspaces, and unlocks Critic", () => {
    const e = entitlementsFor("pro");
    expect(e.memoryPersists).toBe(true);
    expect(e.memoryRetentionDays).toBeNull();
    expect(e.crossWorkspaceMemory).toBe(true);
    expect(e.criticEverywhere).toBe(true);
    expect(e.workspaceLimit).toBeNull();
    expect(e.productLimit).toBe(3);
    expect(e.creditMultiplier).toBe(5);
    expect(e.creditMonthlyBase).toBe(FREE_MONTHLY_CREDITS * 5);
    expect(e.creditTopUps).toBe(true);
    expect(e.topUpCapPerCycle).toBeGreaterThan(0);
    // solo tier: no team capabilities yet.
    expect(e.rbac).toBe(false);
    expect(e.approvalLanes).toBe(false);
    expect(e.sharedWorkspaceMemory).toBe(false);
  });

  it("max adds more credits and priority but is still solo", () => {
    const e = entitlementsFor("max");
    expect(e.memoryPersists).toBe(true);
    expect(e.crossWorkspaceMemory).toBe(true);
    expect(e.productLimit).toBe(5);
    expect(e.creditMultiplier).toBe(20);
    expect(e.creditMonthlyBase).toBe(FREE_MONTHLY_CREDITS * 20);
    expect(e.priority).toBe(true);
    expect(e.rbac).toBe(false);
    expect(e.seats).toBe(1);
  });

  it("team adds members, RBAC, and approval lanes on top of paid memory", () => {
    const e = entitlementsFor("team");
    expect(e.memoryPersists).toBe(true);
    expect(e.crossWorkspaceMemory).toBe(true);
    expect(e.rbac).toBe(true);
    expect(e.approvalLanes).toBe(true);
    expect(e.seats).toBeNull();
    expect(e.productLimit).toBeNull();
    // legacy aliases mirror the new fields.
    expect(e.sharedWorkspaceMemory).toBe(true);
    expect(e.perRoleApprovalLanes).toBe(true);
  });

  it("enterprise is custom: a negotiated credit model, no fixed limits", () => {
    const e = entitlementsFor("enterprise");
    expect(e.memoryPersists).toBe(true);
    expect(e.rbac).toBe(true);
    expect(e.enterpriseCreditModel).toBe(true);
    expect(e.creditMultiplier).toBeNull();
    expect(e.creditMonthlyBase).toBeNull();
    expect(e.topUpCapPerCycle).toBeNull();
    expect(e.seats).toBeNull();
    expect(e.productLimit).toBeNull();
  });

  it("share links and data export stay available on every tier", () => {
    for (const tier of PLAN_TIERS) {
      const e = entitlementsFor(tier);
      expect(e.shareLinks).toBe(true);
      expect(e.dataExport).toBe(true);
    }
  });
});

describe("limitFor", () => {
  it("returns the product and workspace limits, null for generous tiers", () => {
    expect(limitFor("free", "workspace")).toBe(1);
    expect(limitFor("free", "product")).toBe(2);
    expect(limitFor("pro", "product")).toBe(3);
    expect(limitFor("max", "product")).toBe(5);
    expect(limitFor("pro", "workspace")).toBeNull();
    expect(limitFor("team", "product")).toBeNull();
    expect(limitFor("enterprise", "workspace")).toBeNull();
  });
});

describe("isPlanTier / normalizePlanTier", () => {
  it("accepts the five known tiers", () => {
    expect(isPlanTier("free")).toBe(true);
    expect(isPlanTier("pro")).toBe(true);
    expect(isPlanTier("max")).toBe(true);
    expect(isPlanTier("team")).toBe(true);
    expect(isPlanTier("enterprise")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPlanTier("garbage")).toBe(false);
    expect(isPlanTier(null)).toBe(false);
    expect(isPlanTier(undefined)).toBe(false);
    expect(isPlanTier(2)).toBe(false);
  });

  it("normalizes unknown or missing values to free (fail-safe default)", () => {
    expect(normalizePlanTier("pro")).toBe("pro");
    expect(normalizePlanTier("max")).toBe("max");
    expect(normalizePlanTier("enterprise")).toBe("enterprise");
    expect(normalizePlanTier("garbage")).toBe("free");
    expect(normalizePlanTier(null)).toBe("free");
    expect(normalizePlanTier(undefined)).toBe("free");
  });
});

describe("planPresentation", () => {
  it("returns a Constellation presentation for each tier", () => {
    for (const tier of PLAN_TIERS) {
      const p = planPresentation(tier);
      expect(p.tier).toBe(tier);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.price.length).toBeGreaterThan(0);
      expect(p.tagline.length).toBeGreaterThan(0);
      expect(p.highlights.length).toBeGreaterThan(0);
    }
  });

  it("uses the current display names for each tier", () => {
    expect(planPresentation("free").name).toBe("Free");
    expect(planPresentation("pro").name).toBe("Pro");
    expect(planPresentation("max").name).toBe("Pro (legacy)");
    expect(planPresentation("team").name).toBe("Business");
    expect(planPresentation("enterprise").name).toBe("Enterprise");
  });

  it("enterprise has a platform fee, not contact-sales", () => {
    expect(planPresentation("enterprise").price).toBe("Platform fee");
  });
});

describe("planPresentation prices mirror the catalog recommended bundles (M-C-PRICE-SYNC drift guard)", () => {
  it("pins the public/marketing price per tier to the recommended pricing_bundles", () => {
    // free/$0, pro/from $20/mo, max/from $99/mo (legacy), team/from $50/mo, enterprise/Platform fee.
    // If the catalog changes, change both this test and planPresentation() in entitlements.ts.
    expect(planPresentation("free").price).toBe("$0");
    expect(planPresentation("pro").price).toBe("from $20/mo");
    expect(planPresentation("max").price).toBe("from $99/mo");
    expect(planPresentation("team").price).toBe("from $50/mo");
    expect(planPresentation("enterprise").price).toBe("Platform fee");
  });
});

describe("limitFor matches the SQL tier-limit functions (WM-M5 / M-C-BILLING-TESTS parity guard)", () => {
  // Pinned to public.tier_product_limit / public.tier_workspace_limit, verified EQUAL on the
  // live DB 2026-06-21 for every tier. The SQL triggers (WM-M5 migration) and this TS table
  // must stay in lockstep: if you change one, change the other, or a paid user is mis-gated.
  const expected: Record<string, { product: number | null; workspace: number | null }> = {
    free: { product: 2, workspace: 1 },
    pro: { product: 3, workspace: null },
    max: { product: 5, workspace: null },
    team: { product: null, workspace: null },
    enterprise: { product: null, workspace: null },
  };
  it("pins product + workspace limits per tier", () => {
    for (const tier of PLAN_TIERS) {
      expect(limitFor(tier, "product")).toBe(expected[tier].product);
      expect(limitFor(tier, "workspace")).toBe(expected[tier].workspace);
    }
  });
});
