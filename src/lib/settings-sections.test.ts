import { describe, it, expect } from "bun:test";
import {
  SETTINGS_GROUPS,
  ALL_SECTION_IDS,
  PRIMARY_GROUPS,
  RECESSED_GROUPS,
  LEGACY_SECTION_MAP,
  DEFAULT_SECTION,
  normalizeSection,
  groupForSection,
  findGroup,
  primarySection,
  sectionLabel,
  type SectionId,
} from "./settings-sections";

/**
 * SETTINGS-SEGREGATE (v11 #13) — the grouping must collapse 11 flat tabs into a
 * calmer nav WITHOUT breaking the `?section=` deep-link contract. These tests
 * lock both: the structural invariants of the group model AND that every one of
 * the original 11 section ids is still reachable and unchanged.
 */

// The 11 section ids the route shipped with — the routing contract that must hold.
const ORIGINAL_SECTION_IDS: SectionId[] = [
  "connections",
  "ai",
  "staff",
  "workspace",
  "billing",
  "credits",
  "interop",
  "profile",
  "health",
  "data",
  "notifications",
];

describe("settings-sections — the routing contract is preserved", () => {
  it("exposes exactly the 11 original section ids (no id added or dropped)", () => {
    expect([...ALL_SECTION_IDS].sort()).toEqual([...ORIGINAL_SECTION_IDS].sort());
  });

  it("has no duplicate section id across groups", () => {
    expect(new Set(ALL_SECTION_IDS).size).toBe(ALL_SECTION_IDS.length);
  });

  it("every section belongs to exactly one group", () => {
    for (const id of ORIGINAL_SECTION_IDS) {
      const owning = SETTINGS_GROUPS.filter((g) => g.sections.some((s) => s.id === id));
      expect(owning.length).toBe(1);
    }
  });
});

describe("settings-sections — group shape", () => {
  it("collapses to 5 primary groups + 1 recessed (Advanced)", () => {
    expect(PRIMARY_GROUPS.length).toBe(5);
    expect(RECESSED_GROUPS.length).toBe(1);
    expect(RECESSED_GROUPS[0]!.id).toBe("advanced");
  });

  it("only Advanced is recessed", () => {
    for (const g of SETTINGS_GROUPS) {
      expect(Boolean(g.recessed)).toBe(g.id === "advanced");
    }
  });

  it("every group has a label, a one-line desc, and at least one section", () => {
    for (const g of SETTINGS_GROUPS) {
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.desc.length).toBeGreaterThan(0);
      expect(g.sections.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("the 3-places-to-connect confusion is consolidated: Accounts + Integrations live in one group", () => {
    expect(groupForSection("connections")).toBe("connections");
    expect(groupForSection("interop")).toBe("connections");
  });
});

describe("settings-sections — derivations", () => {
  it("groupForSection round-trips with primarySection", () => {
    for (const g of SETTINGS_GROUPS) {
      const primary = primarySection(g.id);
      expect(groupForSection(primary)).toBe(g.id);
      // the primary is the group's first member
      expect(primary).toBe(g.sections[0]!.id);
    }
  });

  it("primarySection falls back to DEFAULT_SECTION for an unknown group", () => {
    // @ts-expect-error — exercising the runtime guard with a bad id
    expect(primarySection("nope")).toBe(DEFAULT_SECTION);
  });

  it("findGroup returns the definition, or undefined when unknown", () => {
    expect(findGroup("billing")?.label).toBe("Billing");
    // @ts-expect-error — unknown id
    expect(findGroup("nope")).toBeUndefined();
  });

  it("sectionLabel maps ids to human labels and de-jargons Models/Staff", () => {
    expect(sectionLabel("ai")).toBe("Models & keys");
    expect(sectionLabel("workspace")).toBe("Brief & voice");
    expect(sectionLabel("connections")).toBe("Accounts");
    // unknown id falls back to itself
    expect(sectionLabel("nope" as SectionId)).toBe("nope");
  });
});

describe("settings-sections — normalizeSection (deep-link safety)", () => {
  it("defaults to connections when nothing is provided", () => {
    expect(normalizeSection(undefined)).toBe(DEFAULT_SECTION);
    expect(normalizeSection(null)).toBe(DEFAULT_SECTION);
    expect(normalizeSection("")).toBe(DEFAULT_SECTION);
  });

  it("passes through every valid section id unchanged", () => {
    for (const id of ORIGINAL_SECTION_IDS) {
      expect(normalizeSection(id)).toBe(id);
    }
  });

  it("keeps legacy deep links landing (brief -> workspace, calendar -> connections)", () => {
    expect(normalizeSection("brief")).toBe("workspace");
    expect(normalizeSection("calendar")).toBe("connections");
    // every legacy alias resolves to a real section
    for (const target of Object.values(LEGACY_SECTION_MAP)) {
      expect(ORIGINAL_SECTION_IDS).toContain(target);
    }
  });

  it("falls back to the default for an unknown section value", () => {
    expect(normalizeSection("totally-made-up")).toBe(DEFAULT_SECTION);
  });
});
