import { describe, it, expect } from "bun:test";
import {
  ENGINE_ROOM_BANDS,
  ALL_ENGINE_ROOM_TABS,
  DEFAULT_ENGINE_ROOM_TAB,
  bandForTab,
  findBand,
  tabsInBand,
  primaryTabForBand,
  type EngineRoomTab,
} from "./engine-room-bands";

/**
 * IA-DEPTH-V11 (v11 #23, slice) — the 13 Engine Room tabs must group into 3 bands
 * WITHOUT dropping or duplicating any tab, and the ?tab= routing contract (every
 * tab id) must be preserved. These lock both.
 */

// The 13 tab ids the /govern route ships with — the routing contract.
const ROUTE_TABS: EngineRoomTab[] = [
  "controls",
  "attention",
  "team",
  "approvals",
  "guardrails",
  "budgets",
  "prompts",
  "evals",
  "analytics",
  "gauntlet",
  "traces",
  "drift",
  "incidents",
];

describe("engine-room-bands — the routing contract is preserved", () => {
  it("covers exactly the 13 route tab ids (none added or dropped)", () => {
    expect([...ALL_ENGINE_ROOM_TABS].sort()).toEqual([...ROUTE_TABS].sort());
  });

  it("places every tab in exactly one band", () => {
    for (const t of ROUTE_TABS) {
      const owning = ENGINE_ROOM_BANDS.filter((b) => b.tabs.includes(t));
      expect(owning.length).toBe(1);
    }
  });

  it("has no duplicate tab across bands", () => {
    expect(new Set(ALL_ENGINE_ROOM_TABS).size).toBe(ALL_ENGINE_ROOM_TABS.length);
  });
});

describe("engine-room-bands — band shape", () => {
  it("groups into 3 bands in the intended order, each non-empty with label + blurb", () => {
    expect(ENGINE_ROOM_BANDS.map((b) => b.id)).toEqual([
      "needs-you",
      "trust-safety",
      "quality-insight",
    ]);
    for (const b of ENGINE_ROOM_BANDS) {
      expect(b.tabs.length).toBeGreaterThan(0);
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.blurb.length).toBeGreaterThan(0);
    }
  });

  it("puts the action-now surfaces in Needs you", () => {
    expect(tabsInBand("needs-you")).toEqual(["controls", "attention", "approvals"]);
  });

  it("the default tab lands in the FIRST band (so a bare /govern opens Needs you)", () => {
    expect(bandForTab(DEFAULT_ENGINE_ROOM_TAB)).toBe("needs-you");
    expect(ENGINE_ROOM_BANDS[0]!.id).toBe("needs-you");
  });
});

describe("engine-room-bands — derivations", () => {
  it("bandForTab maps representative tabs correctly", () => {
    expect(bandForTab("approvals")).toBe("needs-you");
    expect(bandForTab("guardrails")).toBe("trust-safety");
    expect(bandForTab("incidents")).toBe("trust-safety");
    expect(bandForTab("traces")).toBe("quality-insight");
    expect(bandForTab("evals")).toBe("quality-insight");
  });

  it("primaryTabForBand returns the first member and round-trips with bandForTab", () => {
    for (const b of ENGINE_ROOM_BANDS) {
      const primary = primaryTabForBand(b.id);
      expect(primary).toBe(b.tabs[0]!);
      expect(bandForTab(primary)).toBe(b.id);
    }
  });

  it("findBand returns the definition or undefined", () => {
    expect(findBand("quality-insight")?.label).toBe("Quality & insight");
    // @ts-expect-error — unknown band id
    expect(findBand("nope")).toBeUndefined();
  });
});
