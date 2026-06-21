import { describe, it, expect } from "bun:test";
import { capToolsByRisk } from "./agent-tool-cap";

type Row = { tool_name: string; mode: string; enabled: boolean };
const rows: Row[] = [
  { tool_name: "memory.remember", mode: "auto", enabled: true }, // low
  { tool_name: "mission.dispatch", mode: "auto", enabled: true }, // medium
  { tool_name: "studio.commit", mode: "confirm", enabled: true }, // high
  { tool_name: "github.pr.open", mode: "confirm", enabled: true }, // medium
];

describe("capToolsByRisk", () => {
  it("returns rows unchanged for a null/undefined cap (unrestricted)", () => {
    expect(capToolsByRisk(rows, null)).toEqual(rows);
    expect(capToolsByRisk(rows, undefined)).toEqual(rows);
  });

  it("returns rows unchanged for an invalid cap value (fail-open, never accidentally locks out)", () => {
    expect(capToolsByRisk(rows, "bogus")).toEqual(rows);
    expect(capToolsByRisk(rows, "")).toEqual(rows);
  });

  it("a low cap keeps only low-blast tools", () => {
    const r = capToolsByRisk(rows, "low");
    expect(r.map((t) => t.tool_name)).toEqual(["memory.remember"]);
  });

  it("a medium cap keeps low + medium, drops high", () => {
    const r = capToolsByRisk(rows, "medium");
    expect(r.map((t) => t.tool_name)).toEqual([
      "memory.remember",
      "mission.dispatch",
      "github.pr.open",
    ]);
  });

  it("a high cap keeps everything", () => {
    expect(capToolsByRisk(rows, "high")).toEqual(rows);
  });

  it("preserves the original row objects (mode/enabled intact), not just names", () => {
    const r = capToolsByRisk(rows, "medium");
    expect(r[0]).toEqual({ tool_name: "memory.remember", mode: "auto", enabled: true });
  });

  it("handles an empty tool set", () => {
    expect(capToolsByRisk([], "low")).toEqual([]);
  });
});
