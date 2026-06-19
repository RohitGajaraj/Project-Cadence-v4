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

  it("uses the Constellation display names (a skin over the slugs)", () => {
    expect(planPresentation("free").name).toBe("Star");
    expect(planPresentation("pro").name).toBe("Cluster");
    expect(planPresentation("max").name).toBe("Constellation");
    expect(planPresentation("team").name).toBe("Galaxy");
    expect(planPresentation("enterprise").name).toBe("Cosmos");
  });

  it("enterprise is contact-sales, not a fixed price", () => {
    expect(planPresentation("enterprise").price).toBe("Contact sales");
  });
});
