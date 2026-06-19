import { describe, it, expect } from "bun:test";
import { nextUpsellTier, isOverLimit, LimitReachedError } from "./limits.functions";
import { limitFor } from "./entitlements";

describe("nextUpsellTier (product)", () => {
  it("free (2) upsells to pro (3) -- the next higher product cap", () => {
    expect(nextUpsellTier("free", "product")).toBe("pro");
  });
  it("pro (3) upsells to max (5)", () => {
    expect(nextUpsellTier("pro", "product")).toBe("max");
  });
  it("max (5) upsells to team (unlimited)", () => {
    expect(nextUpsellTier("max", "product")).toBe("team");
  });
  it("team (unlimited) has no upsell -- already generous", () => {
    expect(limitFor("team", "product")).toBeNull();
    expect(nextUpsellTier("team", "product")).toBeNull();
  });
  it("enterprise (unlimited) has no upsell", () => {
    expect(nextUpsellTier("enterprise", "product")).toBeNull();
  });
});

describe("nextUpsellTier (workspace)", () => {
  it("free (1) upsells to pro (the first pooled/unlimited tier)", () => {
    expect(nextUpsellTier("free", "workspace")).toBe("pro");
  });
  it("pro (pooled) has no upsell -- workspaces are already unlimited", () => {
    expect(limitFor("pro", "workspace")).toBeNull();
    expect(nextUpsellTier("pro", "workspace")).toBeNull();
  });
});

describe("isOverLimit", () => {
  it("null limit is never over (unlimited)", () => {
    expect(isOverLimit(0, null)).toBe(false);
    expect(isOverLimit(9999, null)).toBe(false);
  });
  it("blocks at the cap (creating the Nth+1 when N already exist)", () => {
    // free product cap is 2: 0 and 1 existing are fine, 2 is at the cap -> blocked.
    expect(isOverLimit(0, 2)).toBe(false);
    expect(isOverLimit(1, 2)).toBe(false);
    expect(isOverLimit(2, 2)).toBe(true);
    expect(isOverLimit(3, 2)).toBe(true);
  });
  it("free workspace cap of 1 blocks the second workspace", () => {
    expect(isOverLimit(0, 1)).toBe(false); // first workspace allowed
    expect(isOverLimit(1, 1)).toBe(true); // second blocked
  });
});

describe("LimitReachedError", () => {
  it("carries kind, tier, limit, and the computed upsell target", () => {
    const err = new LimitReachedError("product", "free", 2);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("LimitReachedError");
    expect(err.kind).toBe("product");
    expect(err.currentTier).toBe("free");
    expect(err.limit).toBe(2);
    expect(err.upsellTier).toBe("pro");
    expect(err.message).toContain("2 products");
  });
  it("pluralizes the noun correctly for a limit of 1 (workspace)", () => {
    const err = new LimitReachedError("workspace", "free", 1);
    expect(err.message).toContain("1 workspace");
    expect(err.message).not.toContain("1 workspaces");
    expect(err.upsellTier).toBe("pro");
  });
  it("has a null upsell when already on an unlimited tier", () => {
    const err = new LimitReachedError("product", "team", 9999);
    expect(err.upsellTier).toBeNull();
  });
});
