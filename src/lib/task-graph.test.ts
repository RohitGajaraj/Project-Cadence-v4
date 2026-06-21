import { describe, expect, test } from "bun:test";
import {
  type TaskNode,
  readyTasks,
  sanitizeDependsOn,
  summarizeTaskGraph,
  topoOrder,
  validateTaskGraph,
} from "./task-graph";

const node = (seq: number, over: Partial<TaskNode> = {}): TaskNode => ({
  id: `t${seq}`,
  seq,
  title: over.title ?? `Task ${seq}`,
  detail: over.detail ?? null,
  depends_on: over.depends_on ?? [],
  estimate_hours: "estimate_hours" in over ? (over.estimate_hours as number | null) : 1,
  risk: over.risk ?? null,
  assignee_kind: over.assignee_kind ?? "agent",
  status: over.status ?? "todo",
});

describe("sanitizeDependsOn", () => {
  test("keeps only earlier, positive, finite, deduped seqs, sorted", () => {
    expect(sanitizeDependsOn(4, [1, 2, 2, "3"])).toEqual([1, 2, 3]);
    expect(sanitizeDependsOn(3, [3, 4, 5])).toEqual([]); // self + forward dropped
    expect(sanitizeDependsOn(3, [0, -1, 1])).toEqual([1]); // non-positive dropped
    expect(sanitizeDependsOn(3, "nope")).toEqual([]); // non-array
    expect(sanitizeDependsOn(5, [2.9, NaN, 4])).toEqual([2, 4]); // truncate + drop NaN
  });
});

describe("validateTaskGraph", () => {
  test("a clean linear chain has no issues", () => {
    expect(
      validateTaskGraph([node(1), node(2, { depends_on: [1] }), node(3, { depends_on: [2] })]),
    ).toEqual([]);
  });

  test("flags a missing dependency", () => {
    const issues = validateTaskGraph([node(2, { depends_on: [1] })]); // seq 1 absent
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("missing-dep");
    expect(issues[0]).toMatchObject({ seq: 2, dep: 1 });
  });

  test("flags a self-dependency and a forward reference", () => {
    const issues = validateTaskGraph([
      node(1, { depends_on: [1] }),
      node(2, { depends_on: [3] }),
      node(3),
    ]);
    const kinds = issues.map((i) => i.kind).sort();
    expect(kinds).toContain("self-dep");
    expect(kinds).toContain("forward-ref");
  });

  test("a self-dependency is reported ONCE (self-dep, not also a cycle)", () => {
    const issues = validateTaskGraph([node(1, { depends_on: [1] })]);
    expect(issues.map((i) => i.kind)).toEqual(["self-dep"]);
  });

  test("detects a real cycle (1->2->1)", () => {
    const issues = validateTaskGraph([node(1, { depends_on: [2] }), node(2, { depends_on: [1] })]);
    expect(issues.some((i) => i.kind === "cycle")).toBe(true);
  });
});

describe("topoOrder", () => {
  test("orders dependencies before dependents, stable by seq", () => {
    // 3 depends on 1; 2 depends on nothing → order should be 1,2,3 (tie 1<2 first).
    const order = topoOrder([node(3, { depends_on: [1] }), node(2), node(1)]);
    expect(order.map((n) => n.seq)).toEqual([1, 2, 3]);
  });

  test("a diamond resolves with both middles before the join", () => {
    // 1 -> {2,3} -> 4
    const order = topoOrder([
      node(1),
      node(2, { depends_on: [1] }),
      node(3, { depends_on: [1] }),
      node(4, { depends_on: [2, 3] }),
    ]).map((n) => n.seq);
    expect(order[0]).toBe(1);
    expect(order[3]).toBe(4);
    expect(order.indexOf(2)).toBeLessThan(order.indexOf(4));
    expect(order.indexOf(3)).toBeLessThan(order.indexOf(4));
  });

  test("is total: a cycle's nodes are appended (never dropped), in seq order", () => {
    const order = topoOrder([
      node(1),
      node(2, { depends_on: [3] }),
      node(3, { depends_on: [2] }),
    ]).map((n) => n.seq);
    expect(order).toHaveLength(3);
    expect(order[0]).toBe(1); // the acyclic node first
    expect(new Set(order)).toEqual(new Set([1, 2, 3]));
  });
});

describe("readyTasks", () => {
  test("a task is ready only when every dependency is done", () => {
    const nodes = [
      node(1, { status: "done" }),
      node(2, { depends_on: [1] }), // dep done → ready
      node(3, { depends_on: [2] }), // dep not done → blocked
    ];
    expect(readyTasks(nodes).map((n) => n.seq)).toEqual([2]);
  });

  test("a done task is never 'ready'; a missing dep keeps a task blocked", () => {
    const nodes = [node(1, { status: "done" }), node(2, { depends_on: [9] })];
    expect(readyTasks(nodes)).toEqual([]); // 1 is done, 2 waits on a missing dep
  });
});

describe("summarizeTaskGraph", () => {
  test("counts status + readiness partitions and rolls estimates", () => {
    const s = summarizeTaskGraph([
      node(1, { status: "done", estimate_hours: 2 }),
      node(2, { status: "doing", depends_on: [1], estimate_hours: 3 }), // ready (dep done) + doing
      node(3, { status: "todo", depends_on: [2], estimate_hours: 4 }), // blocked
    ]);
    expect(s.total).toBe(3);
    expect(s.done).toBe(1);
    expect(s.doing).toBe(1);
    expect(s.todo).toBe(1);
    expect(s.ready).toBe(1); // task 2
    expect(s.blocked).toBe(1); // task 3
    expect(s.estimateTotalHours).toBe(9);
    expect(s.estimateRemainingHours).toBe(7); // 3 + 4 (not-done)
    expect(s.percentComplete).toBe(33); // 1/3
  });

  test("empty graph → all zeros, 0% (never NaN/100)", () => {
    const s = summarizeTaskGraph([]);
    expect(s).toMatchObject({ total: 0, percentComplete: 0, ready: 0, blocked: 0 });
  });
});
