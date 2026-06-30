import { describe, it, expect } from "bun:test";
import { kindQueries, type WorkspaceCtx } from "./autoquery";
import type { WatchKind } from "./kinds";

const EMPTY: WorkspaceCtx = { focus: "", targets: [], opps: [] };

describe("kindQueries", () => {
  it("returns empty object when context is completely empty", () => {
    expect(kindQueries(EMPTY)).toEqual({});
  });

  it("returns empty object when focus is whitespace only", () => {
    expect(kindQueries({ focus: "   ", targets: [], opps: [] })).toEqual({});
  });

  // ── focus-only context ──────────────────────────────────────────────

  it("derives market-news and social-reviews from focus alone", () => {
    const q = kindQueries({ focus: "product analytics", targets: [], opps: [] });
    expect(q["market-news"]).toContain("product analytics");
    expect(q["social-reviews"]).toContain("product analytics");
  });

  it("derives competitor-surface from focus when no named target", () => {
    const q = kindQueries({ focus: "analytics tool", targets: [], opps: [] });
    expect(q["competitor-surface"]).toContain("analytics tool");
    expect(q["competitor-surface"]).toContain("competitor");
  });

  it("omits hiring when only a focus area is available (not a company name)", () => {
    const q = kindQueries({ focus: "analytics", targets: [], opps: [] });
    expect(q["hiring"]).toBeUndefined();
  });

  it("derives tech-platform-shift from focus when no opps", () => {
    const q = kindQueries({ focus: "data pipeline", targets: [], opps: [] });
    expect(q["tech-platform-shift"]).toContain("data pipeline");
  });

  it("derives regulatory-compliance from focus", () => {
    const q = kindQueries({ focus: "fintech payments", targets: [], opps: [] });
    expect(q["regulatory-compliance"]).toContain("fintech payments");
  });

  // ── named target (competitor) context ───────────────────────────────

  it("uses the named target for competitor-surface (not the focus)", () => {
    const q = kindQueries({ focus: "analytics", targets: ["Amplitude"], opps: [] });
    expect(q["competitor-surface"]).toContain("Amplitude");
    expect(q["competitor-surface"]).not.toContain("analytics");
  });

  it("adds hiring query for a named competitor target", () => {
    const q = kindQueries({ focus: "", targets: ["Mixpanel"], opps: [] });
    expect(q["hiring"]).toContain("Mixpanel");
    expect(q["hiring"]).toContain("hiring");
  });

  it("uses named target as primary for market-news and social-reviews", () => {
    const q = kindQueries({ focus: "analytics", targets: ["Amplitude"], opps: [] });
    expect(q["market-news"]).toContain("Amplitude");
    expect(q["social-reviews"]).toContain("Amplitude");
  });

  // ── opportunity context ─────────────────────────────────────────────

  it("uses top opportunity for tech-platform-shift over focus", () => {
    const q = kindQueries({ focus: "analytics", targets: [], opps: ["LLM data pipeline"] });
    expect(q["tech-platform-shift"]).toContain("LLM data pipeline");
  });

  it("falls back to focus for tech-platform-shift when no opps", () => {
    const q = kindQueries({ focus: "data pipeline", targets: [], opps: [] });
    expect(q["tech-platform-shift"]).toContain("data pipeline");
  });

  it("omits tech-platform-shift when no focus and no opps", () => {
    const q = kindQueries({ focus: "", targets: ["Amplitude"], opps: [] });
    expect(q["tech-platform-shift"]).toBeUndefined();
  });

  // ── output shape ────────────────────────────────────────────────────

  it("each returned query is a non-empty string", () => {
    const q = kindQueries({ focus: "analytics", targets: ["Amplitude"], opps: ["ETL tool"] });
    for (const v of Object.values(q) as (string | undefined)[]) {
      expect(typeof v).toBe("string");
      expect((v as string).length).toBeGreaterThan(0);
    }
  });

  it("all returned keys are valid WatchKinds", () => {
    const VALID: WatchKind[] = [
      "competitor-surface",
      "market-news",
      "social-reviews",
      "hiring",
      "tech-platform-shift",
      "regulatory-compliance",
    ];
    const q = kindQueries({ focus: "analytics", targets: ["Amplitude"], opps: ["ETL"] });
    for (const k of Object.keys(q)) {
      expect(VALID).toContain(k);
    }
  });
});
