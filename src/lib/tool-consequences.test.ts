import { describe, it, expect } from "bun:test";
import {
  toolConsequence,
  isSideEffectingTool,
  toolRisk,
  isHighRiskTool,
  isExternalTool,
  filterToolsByRisk,
  RISK_RANK,
} from "./tool-consequences";

describe("toolConsequence (existing)", () => {
  it("returns the catalogued consequence for a known tool", () => {
    expect(toolConsequence("studio.pr.merge").reversible).toBe("irreversible");
  });
  it("returns a conservative default for an unknown tool", () => {
    const c = toolConsequence("nope.unknown");
    expect(c.reversible).toBe("partial");
  });
  it("isSideEffectingTool is true only for catalogued tools", () => {
    expect(isSideEffectingTool("memory.remember")).toBe(true);
    expect(isSideEffectingTool("nope.unknown")).toBe(false);
    expect(isSideEffectingTool(null)).toBe(false);
  });
});

describe("toolRisk (FND-0.5 blast radius)", () => {
  it("rates any irreversible tool high", () => {
    expect(toolRisk("studio.pr.merge")).toBe("high"); // external + irreversible
  });
  it("rates an external partial write high (commits leave the workspace)", () => {
    expect(toolRisk("github.commit.append")).toBe("high");
    expect(toolRisk("studio.commit")).toBe("high");
  });
  it("rates an external reversible write medium", () => {
    expect(toolRisk("github.pr.open")).toBe("medium");
    expect(toolRisk("calendar.create")).toBe("medium");
  });
  it("rates an internal partial write medium", () => {
    expect(toolRisk("mission.dispatch")).toBe("medium");
    expect(toolRisk("research.synthesize")).toBe("medium");
  });
  it("rates an internal reversible write low", () => {
    expect(toolRisk("memory.remember")).toBe("low");
    expect(toolRisk("tasks.create")).toBe("low");
    expect(toolRisk("notes.create")).toBe("low");
  });
  it("treats local-only repo ops as internal (staging is not an external write)", () => {
    // studio.stage touches the local git index only; nothing leaves the repo until studio.commit.
    expect(isExternalTool("studio.stage")).toBe(false);
    expect(toolRisk("studio.stage")).toBe("low");
  });
  it("rates an uncatalogued tool medium (unknown blast radius, prompt review)", () => {
    expect(toolRisk("nope.unknown")).toBe("medium");
    expect(toolRisk(null)).toBe("medium");
    expect(toolRisk(undefined)).toBe("medium");
  });
  it("risk is a distinct axis from reversibility (a reversible tool can still be medium)", () => {
    // github.pr.open is reversible yet medium-risk because it is external.
    expect(toolConsequence("github.pr.open").reversible).toBe("reversible");
    expect(toolRisk("github.pr.open")).toBe("medium");
  });
  it("isHighRiskTool agrees with toolRisk", () => {
    expect(isHighRiskTool("studio.pr.merge")).toBe(true);
    expect(isHighRiskTool("memory.remember")).toBe(false);
  });
  it("isExternalTool flags only outside-the-workspace tools", () => {
    expect(isExternalTool("github.pr.open")).toBe(true);
    expect(isExternalTool("memory.remember")).toBe(false);
    expect(isExternalTool(null)).toBe(false);
  });
  it("RISK_RANK orders low < medium < high", () => {
    expect(RISK_RANK.low).toBeLessThan(RISK_RANK.medium);
    expect(RISK_RANK.medium).toBeLessThan(RISK_RANK.high);
  });
});

describe("filterToolsByRisk (FND-0.5 allow-list pre-filter)", () => {
  const tools = [
    "memory.remember", // low
    "mission.dispatch", // medium
    "studio.pr.merge", // high
    "github.pr.open", // medium
  ];

  it("a low cap keeps only low-risk tools, blocking the rest with their tier", () => {
    const r = filterToolsByRisk(tools, "low");
    expect(r.allowed).toEqual(["memory.remember"]);
    expect(r.blocked).toEqual([
      { tool: "mission.dispatch", risk: "medium" },
      { tool: "studio.pr.merge", risk: "high" },
      { tool: "github.pr.open", risk: "medium" },
    ]);
  });

  it("a medium cap allows low + medium, blocks high", () => {
    const r = filterToolsByRisk(tools, "medium");
    expect(r.allowed).toEqual(["memory.remember", "mission.dispatch", "github.pr.open"]);
    expect(r.blocked).toEqual([{ tool: "studio.pr.merge", risk: "high" }]);
  });

  it("a high cap allows everything", () => {
    const r = filterToolsByRisk(tools, "high");
    expect(r.allowed).toEqual(tools);
    expect(r.blocked).toEqual([]);
  });

  it("de-dups while preserving first-occurrence order", () => {
    const r = filterToolsByRisk(["memory.remember", "memory.remember", "tasks.create"], "low");
    expect(r.allowed).toEqual(["memory.remember", "tasks.create"]);
  });

  it("handles an empty tool set", () => {
    const r = filterToolsByRisk([], "high");
    expect(r.allowed).toEqual([]);
    expect(r.blocked).toEqual([]);
  });
});
