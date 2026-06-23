import { expect, test, describe } from "bun:test";
import { applyDecisionOutcomes } from "./mcp.functions";
import { MCP_TOOLS, MCP_TOOL_NAMES } from "./mcp-protocol";

describe("applyDecisionOutcomes — tag each decision with its provenance outcome", () => {
  const decisions = [{ id: "d-old", title: "a" }, { id: "d-new", title: "b" }, { id: "d3", title: "c" }];
  const superseded = new Map<string, string>([["d-old", "d-new"]]);

  test("a decision in the superseded map is 'superseded', others 'standing'", () => {
    const out = applyDecisionOutcomes(decisions, superseded);
    expect(out.find((d) => d.id === "d-old")!.outcome).toBe("superseded");
    expect(out.find((d) => d.id === "d-new")!.outcome).toBe("standing");
    expect(out.find((d) => d.id === "d3")!.outcome).toBe("standing");
  });
  test("preserves the original fields", () => {
    const out = applyDecisionOutcomes([{ id: "x", title: "keep me" }], new Map());
    expect(out[0]).toEqual({ id: "x", title: "keep me", outcome: "standing" });
  });
  test("malformed input is safe", () => {
    expect(applyDecisionOutcomes(null, new Map())).toEqual([]);
    expect(applyDecisionOutcomes(undefined, new Map())).toEqual([]);
  });
});

describe("MCP catalog exposes the read-only decision-brain tool", () => {
  test("search_decisions is registered with a query/limit/offset schema", () => {
    expect(MCP_TOOL_NAMES).toContain("search_decisions");
    const tool = MCP_TOOLS.find((t) => t.name === "search_decisions")!;
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties).toHaveProperty("query");
    expect(tool.inputSchema.properties).toHaveProperty("limit");
    // read-only: no required write params
    expect(tool.inputSchema.required ?? []).toEqual([]);
  });
});
