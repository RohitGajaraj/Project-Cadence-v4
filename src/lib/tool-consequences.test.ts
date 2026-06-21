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
  it("fails closed: a real but uncatalogued tool is high (unknown blast radius = maximal)", () => {
    expect(toolRisk("nope.unknown")).toBe("high");
    expect(isHighRiskTool("nope.unknown")).toBe(true);
  });
  it("a null/absent tool name (a non-tool gate) stays neutral medium, never the high chip", () => {
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

describe("FND-0.5 min-confirm floor coverage (loop gate uses isHighRiskTool)", () => {
  // The loop gate floors a tool to `confirm` when HIGH_RISK_MIN_CONFIRM.has(name) OR
  // isHighRiskTool(name). These lock the systematic half: every high-blast tool is covered,
  // including the one the hand-maintained set missed, while medium/low tools are NOT escalated
  // by the systematic rule (they rely only on the curated manual set).
  it("catches github.commit.append — the high-blast tool the manual set missed", () => {
    expect(isHighRiskTool("github.commit.append")).toBe(true);
  });
  it("covers the other irreversible / external-partial writers", () => {
    expect(isHighRiskTool("studio.commit")).toBe(true);
    expect(isHighRiskTool("studio.pr.merge")).toBe(true);
  });
  it("does not over-escalate medium tools (they floor only via the curated manual set)", () => {
    expect(isHighRiskTool("github.pr.open")).toBe(false);
    expect(isHighRiskTool("calendar.create")).toBe(false);
  });
  it("never floors low-blast internal writes (they stay auto-eligible)", () => {
    expect(isHighRiskTool("memory.remember")).toBe(false);
    expect(isHighRiskTool("tasks.create")).toBe(false);
  });
});

describe("delegate.openhands (governed delegate-out, #5 wiring)", () => {
  it("is catalogued irreversible, external, and high blast radius", () => {
    expect(toolConsequence("delegate.openhands").reversible).toBe("irreversible");
    expect(isExternalTool("delegate.openhands")).toBe(true);
    expect(toolRisk("delegate.openhands")).toBe("high");
    expect(isHighRiskTool("delegate.openhands")).toBe(true);
  });
});
