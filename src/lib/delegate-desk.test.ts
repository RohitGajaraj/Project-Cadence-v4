import { describe, it, expect } from "bun:test";
import {
  computeDelegateDesk,
  laneForStatus,
  missionProgress,
  summarizeDesk,
  type DeskMissionInput,
  type DeskLaneId,
} from "./delegate-desk";

/**
 * DELEGATE-DESK (v11 #25) — the desk re-frames the mission list into lifecycle
 * lanes. These lock the status→lane mapping, progress math, partition invariants,
 * and the honest summary.
 */

function m(over: Partial<DeskMissionInput> & { id: string; status: string }): DeskMissionInput {
  return {
    title: "T",
    goal: "G",
    created_at: "2026-06-24T00:00:00Z",
    updated_at: "2026-06-24T00:00:00Z",
    completed_at: null,
    steps: [],
    ...over,
  };
}

describe("delegate-desk — status → lane", () => {
  it("maps each lifecycle state to the right lane", () => {
    expect(laneForStatus("paused")).toBe("needsYou");
    expect(laneForStatus("blocked")).toBe("needsYou");
    expect(laneForStatus("running")).toBe("working");
    expect(laneForStatus("in_progress")).toBe("working");
    expect(laneForStatus("dispatched")).toBe("working");
    expect(laneForStatus("queued")).toBe("awaiting");
    expect(laneForStatus("proposed")).toBe("awaiting");
    expect(laneForStatus("completed")).toBe("done");
    expect(laneForStatus("done")).toBe("done");
    expect(laneForStatus("error")).toBe("attention");
    expect(laneForStatus("failed")).toBe("attention");
    expect(laneForStatus("cancelled")).toBe("attention");
  });

  it("normalizes case/whitespace and defaults unknown to queued (never dropped)", () => {
    expect(laneForStatus("  RUNNING ")).toBe("working");
    expect(laneForStatus("In_Progress")).toBe("working");
    expect(laneForStatus("some_custom_state")).toBe("awaiting");
    expect(laneForStatus("")).toBe("awaiting");
  });
});

describe("delegate-desk — progress", () => {
  it("counts terminal-done steps over total", () => {
    expect(missionProgress([])).toEqual({ done: 0, total: 0, pct: null });
    expect(missionProgress([{ status: "executed" }, { status: "queued" }])).toEqual({
      done: 1,
      total: 2,
      pct: 50,
    });
    expect(
      missionProgress([{ status: "completed" }, { status: "skipped" }, { status: "executed" }]),
    ).toEqual({ done: 3, total: 3, pct: 100 });
  });

  it("does not count error/denied/running steps as done", () => {
    expect(missionProgress([{ status: "error" }, { status: "running" }, { status: "denied" }])).toEqual(
      { done: 0, total: 3, pct: 0 },
    );
  });
});

describe("delegate-desk — composition", () => {
  const desk = computeDelegateDesk([
    m({ id: "a", status: "running", updated_at: "2026-06-24T02:00:00Z" }),
    m({ id: "b", status: "running", updated_at: "2026-06-24T05:00:00Z" }),
    m({ id: "c", status: "paused" }),
    m({ id: "d", status: "completed" }),
    m({ id: "e", status: "completed" }),
    m({ id: "f", status: "queued" }),
    m({ id: "g", status: "failed" }),
  ]);

  it("partitions every mission into exactly one lane (counts sum to total)", () => {
    const sum = (Object.values(desk.counts) as number[]).reduce((n, x) => n + x, 0);
    expect(sum).toBe(desk.total);
    expect(desk.total).toBe(7);
    expect(desk.counts).toEqual({ needsYou: 1, working: 2, awaiting: 1, done: 2, attention: 1 });
  });

  it("returns all 5 lanes in urgent-first order", () => {
    expect(desk.lanes.map((l) => l.id)).toEqual([
      "needsYou",
      "working",
      "awaiting",
      "done",
      "attention",
    ] satisfies DeskLaneId[]);
  });

  it("orders missions within a lane most-recently-updated first", () => {
    const working = desk.lanes.find((l) => l.id === "working")!;
    expect(working.missions.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("tags each mission with its lane + progress", () => {
    const working = desk.lanes.find((l) => l.id === "working")!;
    expect(working.missions[0]!.lane).toBe("working");
    expect(working.missions[0]!.progress).toEqual({ done: 0, total: 0, pct: null });
  });

  it("is null-safe and honest when empty", () => {
    const empty = computeDelegateDesk([]);
    expect(empty.total).toBe(0);
    expect(empty.lanes.length).toBe(5);
    expect(empty.summary).toContain("Nothing delegated yet");
  });
});

describe("delegate-desk — summary", () => {
  it("mentions only non-empty lanes, urgent first", () => {
    expect(summarizeDesk({ needsYou: 1, working: 2, awaiting: 0, done: 5, attention: 0 }, 8)).toBe(
      "1 needs you · 2 working · 5 done.",
    );
  });

  it("pluralizes 'needs a look' correctly (1 needs, 2 need)", () => {
    expect(summarizeDesk({ needsYou: 0, working: 0, awaiting: 0, done: 0, attention: 1 }, 1)).toBe(
      "1 needs a look.",
    );
    expect(summarizeDesk({ needsYou: 0, working: 0, awaiting: 0, done: 0, attention: 2 }, 2)).toBe(
      "2 need a look.",
    );
  });
});
