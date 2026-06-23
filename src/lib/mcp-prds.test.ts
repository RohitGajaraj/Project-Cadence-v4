import { expect, test, describe } from "bun:test";
import { groupByRoadmapBucket, sanitizeIlikeQuery, type RoadmapItemLite } from "./mcp.functions";
import { MCP_TOOLS, MCP_TOOL_NAMES } from "./mcp-protocol";

describe("sanitizeIlikeQuery — strip PostgREST .or() structural chars (injection guard)", () => {
  test("removes commas, parens, and backslashes that could inject an OR branch", () => {
    expect(sanitizeIlikeQuery("foo,id.neq.null")).toBe("fooid.neq.null");
    expect(sanitizeIlikeQuery("a)(b\\c")).toBe("abc");
  });
  test("keeps ordinary keywords and wildcards intact", () => {
    expect(sanitizeIlikeQuery("  checkout flow  ")).toBe("checkout flow");
    expect(sanitizeIlikeQuery("pay%ment")).toBe("pay%ment");
  });
  test("null/undefined -> empty string", () => {
    expect(sanitizeIlikeQuery(null)).toBe("");
    expect(sanitizeIlikeQuery(undefined)).toBe("");
  });
});

describe("groupByRoadmapBucket — opportunities into now/next/later/unbucketed", () => {
  const rows: RoadmapItemLite[] = [
    { id: "a", title: "A", ice_score: 5, roadmap_bucket: "now" },
    { id: "b", title: "B", ice_score: 9, roadmap_bucket: "now" },
    { id: "c", title: "C", ice_score: 3, roadmap_bucket: "Next" }, // case-insensitive
    { id: "d", title: "D", ice_score: 7, roadmap_bucket: "later" },
    { id: "e", title: "E", ice_score: 1, roadmap_bucket: null }, // unbucketed
    { id: "f", title: "F", ice_score: 8, roadmap_bucket: "  " }, // blank -> unbucketed
  ];

  test("routes each row to its bucket; unknown/blank/null -> unbucketed", () => {
    const v = groupByRoadmapBucket(rows);
    expect(v.now.map((r) => r.id)).toEqual(["b", "a"]); // highest ICE first
    expect(v.next.map((r) => r.id)).toEqual(["c"]);
    expect(v.later.map((r) => r.id)).toEqual(["d"]);
    expect(v.unbucketed.map((r) => r.id).sort()).toEqual(["e", "f"]);
  });

  test("sorts within a bucket by ICE desc, null ICE treated as 0", () => {
    const v = groupByRoadmapBucket([
      { id: "x", title: "X", ice_score: null, roadmap_bucket: "now" },
      { id: "y", title: "Y", ice_score: 4, roadmap_bucket: "now" },
    ]);
    expect(v.now.map((r) => r.id)).toEqual(["y", "x"]);
  });

  test("malformed / empty input is safe", () => {
    expect(groupByRoadmapBucket(null)).toEqual({ now: [], next: [], later: [], unbucketed: [] });
    expect(groupByRoadmapBucket(undefined)).toEqual({
      now: [],
      next: [],
      later: [],
      unbucketed: [],
    });
    // a row with no id is dropped
    expect(
      groupByRoadmapBucket([{ id: "", title: "z", ice_score: 1, roadmap_bucket: "now" }]).now,
    ).toHaveLength(0);
  });
});

describe("MCP catalog — the spec/roadmap read tools are registered", () => {
  test("search_prds takes query/status/limit, no required write params", () => {
    expect(MCP_TOOL_NAMES).toContain("search_prds");
    const t = MCP_TOOLS.find((x) => x.name === "search_prds")!;
    expect(t.inputSchema.properties).toHaveProperty("query");
    expect(t.inputSchema.properties).toHaveProperty("status");
    expect(t.inputSchema.required ?? []).toEqual([]);
  });
  test("get_roadmap is read-only (no required params)", () => {
    expect(MCP_TOOL_NAMES).toContain("get_roadmap");
    const t = MCP_TOOLS.find((x) => x.name === "get_roadmap")!;
    expect(t.inputSchema.required ?? []).toEqual([]);
  });
});
