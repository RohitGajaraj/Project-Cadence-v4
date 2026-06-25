import { describe, test, expect } from "bun:test";
import {
  validateDispatch,
  toLinearPriority,
  topologicalOrder,
  findDanglingDeps,
  summarizeDispatch,
  type DispatchableTask,
} from "./orchestrator";

function task(seq: number, depends_on: number[] = [], priority = "medium"): DispatchableTask {
  return { id: `task-${seq}`, seq, title: `Task ${seq}`, priority, depends_on };
}

// ─── validateDispatch ────────────────────────────────────────────────────────

describe("validateDispatch", () => {
  test("rejects empty task list", () => {
    const r = validateDispatch([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Generate the task graph first");
  });

  test("rejects over 50 tasks", () => {
    const tasks = Array.from({ length: 51 }, (_, i) => task(i + 1));
    const r = validateDispatch(tasks);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("max 50");
  });

  test("accepts exactly 50 tasks", () => {
    const tasks = Array.from({ length: 50 }, (_, i) => task(i + 1));
    expect(validateDispatch(tasks).ok).toBe(true);
  });

  test("accepts a normal task list", () => {
    expect(validateDispatch([task(1), task(2), task(3)]).ok).toBe(true);
  });
});

// ─── toLinearPriority ────────────────────────────────────────────────────────

describe("toLinearPriority", () => {
  test("maps urgent -> 1", () => expect(toLinearPriority("urgent")).toBe(1));
  test("maps high -> 2", () => expect(toLinearPriority("high")).toBe(2));
  test("maps medium -> 3", () => expect(toLinearPriority("medium")).toBe(3));
  test("maps low -> 4", () => expect(toLinearPriority("low")).toBe(4));
  test("null defaults to medium (3)", () => expect(toLinearPriority(null)).toBe(3));
  test("unknown string defaults to medium (3)", () => expect(toLinearPriority("critical")).toBe(3));
});

// ─── topologicalOrder ────────────────────────────────────────────────────────

describe("topologicalOrder", () => {
  test("single task has no reordering", () => {
    const [t1] = topologicalOrder([task(1)]);
    expect(t1.id).toBe("task-1");
  });

  test("linear chain: 1 -> 2 -> 3 outputs 1, 2, 3", () => {
    const result = topologicalOrder([task(2, [1]), task(3, [2]), task(1)]);
    expect(result.map((t) => t.id)).toEqual(["task-1", "task-2", "task-3"]);
  });

  test("diamond: 1 -> 2,3 -> 4 outputs 1 before 2 and 3, both before 4", () => {
    const result = topologicalOrder([
      task(4, [2, 3]),
      task(2, [1]),
      task(3, [1]),
      task(1),
    ]);
    const ids = result.map((t) => t.id);
    expect(ids.indexOf("task-1")).toBeLessThan(ids.indexOf("task-2"));
    expect(ids.indexOf("task-1")).toBeLessThan(ids.indexOf("task-3"));
    expect(ids.indexOf("task-2")).toBeLessThan(ids.indexOf("task-4"));
    expect(ids.indexOf("task-3")).toBeLessThan(ids.indexOf("task-4"));
  });

  test("independent tasks are all included", () => {
    const result = topologicalOrder([task(1), task(2), task(3)]);
    expect(result).toHaveLength(3);
  });

  test("task with null deps treated as no deps", () => {
    const t = { ...task(1), depends_on: null };
    const result = topologicalOrder([t]);
    expect(result).toHaveLength(1);
  });

  test("empty input returns empty", () => {
    expect(topologicalOrder([])).toHaveLength(0);
  });
});

// ─── findDanglingDeps ────────────────────────────────────────────────────────

describe("findDanglingDeps", () => {
  test("returns empty when all deps exist", () => {
    expect(findDanglingDeps([task(1), task(2, [1])])).toHaveLength(0);
  });

  test("flags task whose dep seq is missing from the set", () => {
    const result = findDanglingDeps([task(2, [99])]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("task-2");
  });

  test("returns empty for tasks with no deps", () => {
    expect(findDanglingDeps([task(1), task(2), task(3)])).toHaveLength(0);
  });

  test("null depends_on treated as no deps", () => {
    const t: DispatchableTask = { id: "t1", seq: 1, title: "T1", priority: "medium", depends_on: null };
    expect(findDanglingDeps([t])).toHaveLength(0);
  });
});

// ─── summarizeDispatch ───────────────────────────────────────────────────────

describe("summarizeDispatch", () => {
  test("happy path: all dispatched", () => {
    const summary = summarizeDispatch({
      dispatched: [{ taskId: "t1", issueId: "i1", url: "https://linear.app/i1", title: "T1" }],
      skipped: [],
      alreadyDispatched: [],
      totalTasks: 1,
    });
    expect(summary).toContain("1/1 dispatched");
    expect(summary).not.toContain("already");
    expect(summary).not.toContain("failed");
  });

  test("includes already-dispatched count", () => {
    const summary = summarizeDispatch({
      dispatched: [],
      skipped: [],
      alreadyDispatched: ["t1", "t2"],
      totalTasks: 2,
    });
    expect(summary).toContain("2 already dispatched");
  });

  test("includes skipped count", () => {
    const summary = summarizeDispatch({
      dispatched: [],
      skipped: ["t1"],
      alreadyDispatched: [],
      totalTasks: 1,
    });
    expect(summary).toContain("1 failed");
  });
});
