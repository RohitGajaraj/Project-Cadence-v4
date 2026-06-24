import { describe, it, expect } from "bun:test";
import {
  PRIMARY_NAV,
  ENGINE_ROOM_DOOR,
  ENGINE_ROOM_LINKS,
  ENGINE_ROOM_PATHS,
  navItemActive,
  engineRoomActive,
} from "./nav-model";

/**
 * IA-NAV-V11 (v11 #12) — the nav must collapse the four competing metaphors into
 * one calm flat list + one engine-room door, WITHOUT orphaning any destination
 * the old 5-icon Trust row exposed. These tests lock both.
 */

describe("nav-model — the calm front (primary destinations)", () => {
  it("is one flat list of outcome-named destinations", () => {
    expect(PRIMARY_NAV.length).toBeGreaterThanOrEqual(5);
    const labels = PRIMARY_NAV.map((n) => n.label);
    expect(labels).toEqual(["Today", "Ask", "Product", "Build", "Missions", "Brain"]);
  });

  it("every destination has a route, a label, and an icon", () => {
    for (const n of PRIMARY_NAV) {
      expect(n.to.startsWith("/")).toBe(true);
      expect(n.label.length).toBeGreaterThan(0);
      expect(n.icon).toBeDefined();
    }
  });

  it("destination routes are unique (no two nav items point to the same path)", () => {
    const tos = PRIMARY_NAV.map((n) => n.to);
    expect(new Set(tos).size).toBe(tos.length);
  });

  it("primary destinations are flat — none is tab-scoped (no NavGroup indirection)", () => {
    for (const n of PRIMARY_NAV) expect(n.search).toBeUndefined();
  });
});

describe("nav-model — the engine room door (deep engine behind one door)", () => {
  it("the door points at the engine room and is labelled Engine Room", () => {
    expect(ENGINE_ROOM_DOOR.to).toBe("/govern");
    expect(ENGINE_ROOM_DOOR.label).toBe("Engine Room");
  });

  it("reveals every surface the old Trust row exposed — nothing is orphaned", () => {
    const targets = ENGINE_ROOM_LINKS.map((l) => l.to);
    // Trust Ledger and Connectors are NOT in the ⌘K palette, so the door is their
    // only sidebar path — they must be present.
    expect(targets).toContain("/trust-ledger");
    expect(targets).toContain("/sync");
    // Approvals + Spend live as tabs on /govern.
    const approvals = ENGINE_ROOM_LINKS.find((l) => l.label === "Approvals");
    expect(approvals?.to).toBe("/govern");
    expect(approvals?.search?.tab).toBe("approvals");
    const spend = ENGINE_ROOM_LINKS.find((l) => l.label === "Spend");
    expect(spend?.search?.tab).toBe("budgets");
  });

  it("keeps all five engine-room destinations", () => {
    expect(ENGINE_ROOM_LINKS.length).toBe(5);
  });
});

describe("nav-model — active-state math", () => {
  it("navItemActive matches an exact bare path and rejects others", () => {
    expect(navItemActive({ to: "/" }, "/", null)).toBe(true);
    expect(navItemActive({ to: "/product" }, "/product", null)).toBe(true);
    expect(navItemActive({ to: "/product" }, "/build", null)).toBe(false);
  });

  it("navItemActive respects a tab scope when the item declares one", () => {
    const item = { to: "/govern", search: { tab: "approvals" } };
    expect(navItemActive(item, "/govern", "approvals")).toBe(true);
    expect(navItemActive(item, "/govern", "budgets")).toBe(false);
    expect(navItemActive(item, "/govern", null)).toBe(false);
  });

  it("engineRoomActive is true anywhere inside the engine room, false outside", () => {
    expect(engineRoomActive("/govern")).toBe(true);
    expect(engineRoomActive("/govern/anything")).toBe(true);
    expect(engineRoomActive("/trust-ledger")).toBe(true);
    expect(engineRoomActive("/sync")).toBe(true);
    expect(engineRoomActive("/")).toBe(false);
    expect(engineRoomActive("/product")).toBe(false);
    // a path that merely starts with a prefix string but isn't a sub-route stays out
    expect(engineRoomActive("/governance-board")).toBe(false);
  });

  it("ENGINE_ROOM_PATHS covers exactly the door's deep surfaces", () => {
    expect([...ENGINE_ROOM_PATHS].sort()).toEqual(["/govern", "/sync", "/trust-ledger"]);
  });
});
