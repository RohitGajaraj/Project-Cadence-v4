import { describe, it, expect } from "bun:test";
import {
  planFanout,
  FANOUT_MAX_CHILDREN,
  FANOUT_MAX_DEPTH,
  fanoutDepthOf,
  canSpawnAtDepth,
} from "./fanout";

describe("planFanout (ephemeral sub-agent fan-out)", () => {
  it("keeps valid subtasks and reports zero dropped under the cap", () => {
    const plan = planFanout([{ task: "ingest A" }, { task: "ingest B" }]);
    expect(plan.children.map((c) => c.task)).toEqual(["ingest A", "ingest B"]);
    expect(plan.dropped).toBe(0);
  });

  it("drops blank/non-string tasks and trims", () => {
    const plan = planFanout([
      { task: "  ingest A  " },
      { task: "" },
      { task: "   " },
      // @ts-expect-error defensive: a malformed item from a hand-crafted call
      { task: 123 },
      null as unknown as { task: string },
    ]);
    expect(plan.children.map((c) => c.task)).toEqual(["ingest A"]);
  });

  it("dedupes identical tasks", () => {
    const plan = planFanout([{ task: "x" }, { task: "x" }, { task: "y" }]);
    expect(plan.children.map((c) => c.task)).toEqual(["x", "y"]);
  });

  it("caps at FANOUT_MAX_CHILDREN and reports the dropped count", () => {
    const items = Array.from({ length: FANOUT_MAX_CHILDREN + 5 }, (_, i) => ({ task: `t${i}` }));
    const plan = planFanout(items);
    expect(plan.children).toHaveLength(FANOUT_MAX_CHILDREN);
    expect(plan.dropped).toBe(5);
  });

  it("honors a tighter maxChildren but never exceeds the hard cap", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ task: `t${i}` }));
    expect(planFanout(items, { maxChildren: 3 }).children).toHaveLength(3);
    expect(planFanout(items, { maxChildren: 999 }).children).toHaveLength(FANOUT_MAX_CHILDREN);
    expect(planFanout(items, { maxChildren: 0 }).children).toHaveLength(1); // floored to >=1
  });

  it("splits the supplied budget evenly across kept children as a per-child hint", () => {
    const plan = planFanout([{ task: "a" }, { task: "b" }, { task: "c" }, { task: "d" }], {
      spendCapUsd: 2,
      tokenCap: 1000,
    });
    expect(plan.children).toHaveLength(4);
    for (const c of plan.children) {
      expect(c.spendCapUsd).toBeCloseTo(0.5);
      expect(c.tokenCap).toBe(250);
    }
  });

  it("leaves per-child caps null when no budget is supplied (mission cap enforces the aggregate)", () => {
    const plan = planFanout([{ task: "a" }]);
    expect(plan.children[0].spendCapUsd).toBeNull();
    expect(plan.children[0].tokenCap).toBeNull();
  });

  it("returns an empty plan for an empty / all-blank input", () => {
    expect(planFanout([])).toEqual({ children: [], dropped: 0 });
    expect(planFanout([{ task: "   " }])).toEqual({ children: [], dropped: 0 });
  });

  it("carries each item's context through to its child", () => {
    const plan = planFanout([{ task: "a", context: { sourceId: "s1" } }]);
    expect(plan.children[0].context).toEqual({ sourceId: "s1" });
  });
});

describe("fan-out depth bound (the recursion guard)", () => {
  it("fanoutDepthOf reads context._fanout_depth, defaulting to 0 for absent/odd values", () => {
    expect(fanoutDepthOf(null)).toBe(0);
    expect(fanoutDepthOf(undefined)).toBe(0);
    expect(fanoutDepthOf({})).toBe(0);
    expect(fanoutDepthOf({ context: {} })).toBe(0);
    expect(fanoutDepthOf({ context: { _fanout_depth: 1 } })).toBe(1);
    expect(fanoutDepthOf({ context: { _fanout_depth: 2 } })).toBe(2);
    expect(fanoutDepthOf({ context: { _fanout_depth: "x" } })).toBe(0);
    expect(fanoutDepthOf({ context: { _fanout_depth: -3 } })).toBe(0);
    expect(fanoutDepthOf({ context: { _fanout_depth: 1.9 } })).toBe(1);
  });

  it("canSpawnAtDepth allows a top-level run (0) and forbids a spawned one (>= FANOUT_MAX_DEPTH)", () => {
    expect(canSpawnAtDepth(0)).toBe(true);
    expect(canSpawnAtDepth(FANOUT_MAX_DEPTH)).toBe(false);
    expect(canSpawnAtDepth(FANOUT_MAX_DEPTH + 1)).toBe(false);
  });
});
