import { describe, it, expect } from "bun:test";
import {
  buildConnectorCatalog,
  catalogEntryCount,
  flowLabelFor,
  categoryOf,
  type CatalogEntry,
} from "./catalog";
import { CONNECTOR_REGISTRY } from "./registry";

/**
 * CONNECTORS-V11 (v11 #14) — the catalog must present every user-facing connector
 * exactly once, grouped into clean categories, with honest flow/connect metadata.
 * These tests lock the de-dup + categorization + derivations.
 */

const allEntries = (): CatalogEntry[] => buildConnectorCatalog().flatMap((g) => g.entries);

describe("connector catalog — de-dup + coverage", () => {
  it("includes every user-facing provider, exactly once", () => {
    const userFacing = Object.values(CONNECTOR_REGISTRY).filter((s) => s.userFacing !== false);
    const ids = allEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect([...ids].sort()).toEqual([...userFacing.map((s) => s.id)].sort());
  });

  it("excludes platform infra (Firecrawl, userFacing:false)", () => {
    expect(allEntries().some((e) => e.id === "firecrawl")).toBe(false);
    expect(categoryOf("firecrawl")).toBeNull();
  });

  it("catalogEntryCount equals the number of user-facing providers (9)", () => {
    expect(catalogEntryCount()).toBe(9);
    expect(catalogEntryCount()).toBe(allEntries().length);
  });
});

describe("connector catalog — categorization", () => {
  it("groups providers into the expected categories", () => {
    const cat = (id: string) => allEntries().find((e) => e.id === id)?.category;
    expect(cat("github")).toBe("code");
    expect(cat("intercom")).toBe("support");
    expect(cat("linear")).toBe("issues");
    expect(cat("jira")).toBe("issues");
    expect(cat("notion")).toBe("docs");
    expect(cat("google_docs")).toBe("docs");
    expect(cat("google_calendar")).toBe("calendar");
    expect(cat("microsoft_outlook")).toBe("calendar");
    expect(cat("figma")).toBe("design");
  });

  it("returns categories in the stable display order, none empty", () => {
    const groups = buildConnectorCatalog();
    expect(groups.map((g) => g.id)).toEqual([
      "code",
      "issues",
      "docs",
      "support",
      "calendar",
      "design",
    ]);
    for (const g of groups) {
      expect(g.entries.length).toBeGreaterThan(0);
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.blurb.length).toBeGreaterThan(0);
    }
  });

  it("sorts entries within a category by label", () => {
    const issues = buildConnectorCatalog().find((g) => g.id === "issues")!;
    expect(issues.entries.map((e) => e.label)).toEqual(["Jira", "Linear"]);
  });
});

describe("connector catalog — derivations", () => {
  it("flowLabelFor reads capabilities into one plain phrase", () => {
    expect(flowLabelFor({ inflow: true, outflow: true, sync: true })).toBe("Two-way sync");
    expect(flowLabelFor({ inflow: true, outflow: true, sync: false })).toBe("In & out");
    expect(flowLabelFor({ inflow: true, outflow: false, sync: false })).toBe("Pulls in");
    expect(flowLabelFor({ inflow: false, outflow: true, sync: false })).toBe("Pushes out");
    expect(flowLabelFor({ inflow: false, outflow: false, sync: false })).toBe("Reference");
  });

  it("derives flowLabel per real provider", () => {
    const e = (id: string) => allEntries().find((x) => x.id === id)!;
    expect(e("google_calendar").flowLabel).toBe("Two-way sync");
    expect(e("github").flowLabel).toBe("In & out");
    expect(e("google_docs").flowLabel).toBe("Pulls in");
    expect(e("intercom").flowLabel).toBe("Pulls in");
    expect(e("figma").flowLabel).toBe("Reference");
  });

  it("derives the connect method (GitHub is a GitHub App; others OAuth)", () => {
    const e = (id: string) => allEntries().find((x) => x.id === id)!;
    expect(e("github").connectMethod).toBe("github_app");
    expect(e("linear").connectMethod).toBe("oauth");
    expect(e("notion").connectMethod).toBe("oauth");
  });

  it("surfaces the bindable resource label, or null", () => {
    const e = (id: string) => allEntries().find((x) => x.id === id)!;
    expect(e("github").resourceLabel).toBe("Repository");
    expect(e("linear").resourceLabel).toBe("Team");
    expect(e("notion").resourceLabel).toBe("Database");
    expect(e("intercom").resourceLabel).toBe("Inbox");
    expect(e("figma").resourceLabel).toBeNull();
  });
});
