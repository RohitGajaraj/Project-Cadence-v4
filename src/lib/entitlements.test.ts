import { describe, it, expect } from "bun:test";
import {
  entitlementsFor,
  isPlanTier,
  normalizePlanTier,
  planPresentation,
  FREE_MEMORY_RETENTION_DAYS,
  PLAN_TIERS,
} from "./entitlements";

describe("entitlementsFor", () => {
  it("free does NOT persist memory and carries a finite retention", () => {
    const e = entitlementsFor("free");
    expect(e.memoryPersists).toBe(false);
    expect(e.memoryRetentionDays).toBe(FREE_MEMORY_RETENTION_DAYS);
    expect(e.criticEverywhere).toBe(false);
    expect(e.sharedWorkspaceMemory).toBe(false);
    expect(e.perRoleApprovalLanes).toBe(false);
  });

  it("pro persists memory forever and unlocks Critic everywhere", () => {
    const e = entitlementsFor("pro");
    expect(e.memoryPersists).toBe(true);
    expect(e.memoryRetentionDays).toBeNull();
    expect(e.criticEverywhere).toBe(true);
    // team-only capabilities stay off on pro.
    expect(e.sharedWorkspaceMemory).toBe(false);
    expect(e.perRoleApprovalLanes).toBe(false);
  });

  it("team adds shared memory and approval lanes on top of pro", () => {
    const e = entitlementsFor("team");
    expect(e.memoryPersists).toBe(true);
    expect(e.memoryRetentionDays).toBeNull();
    expect(e.criticEverywhere).toBe(true);
    expect(e.sharedWorkspaceMemory).toBe(true);
    expect(e.perRoleApprovalLanes).toBe(true);
  });

  it("share links stay available on every tier (not a paid-only gate)", () => {
    for (const tier of PLAN_TIERS) {
      expect(entitlementsFor(tier).shareLinks).toBe(true);
    }
  });
});

describe("isPlanTier / normalizePlanTier", () => {
  it("accepts the three known tiers", () => {
    expect(isPlanTier("free")).toBe(true);
    expect(isPlanTier("pro")).toBe(true);
    expect(isPlanTier("team")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPlanTier("enterprise")).toBe(false);
    expect(isPlanTier(null)).toBe(false);
    expect(isPlanTier(undefined)).toBe(false);
    expect(isPlanTier(2)).toBe(false);
  });

  it("normalizes unknown or missing values to free (fail-safe default)", () => {
    expect(normalizePlanTier("pro")).toBe("pro");
    expect(normalizePlanTier("garbage")).toBe("free");
    expect(normalizePlanTier(null)).toBe("free");
    expect(normalizePlanTier(undefined)).toBe("free");
  });
});

describe("planPresentation", () => {
  it("returns a presentation for each tier with a name, price, and highlights", () => {
    for (const tier of PLAN_TIERS) {
      const p = planPresentation(tier);
      expect(p.tier).toBe(tier);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.price.length).toBeGreaterThan(0);
      expect(p.highlights.length).toBeGreaterThan(0);
    }
  });

  it("team price is intentionally not a fixed number", () => {
    expect(planPresentation("team").price).toBe("Custom");
  });
});
