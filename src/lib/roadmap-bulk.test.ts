import { describe, it, expect } from "bun:test";
import { planBulkMove, BULK_MOVE_CAP, type BulkMoveItem } from "./roadmap-bulk";

const item = (id: string, bucket: BulkMoveItem["bucket"]): BulkMoveItem => ({ id, bucket });

describe("planBulkMove", () => {
  it("plans a move only for ids whose bucket actually changes", () => {
    const items = [item("a", null), item("b", "now"), item("c", "next")];
    const plan = planBulkMove(["a", "b", "c"], "now", items);
    // a (backlog) and c (next) move to now; b is already now (no-op).
    expect(plan.moves).toEqual([
      { id: "a", fromBucket: null, toBucket: "now" },
      { id: "c", fromBucket: "next", toBucket: "now" },
    ]);
    expect(plan.skippedNoop).toBe(1);
    expect(plan.skippedUnknown).toBe(0);
    expect(plan.skippedOverCap).toBe(0);
  });

  it("carries the real from-bucket on each move (for the audit provenance)", () => {
    const plan = planBulkMove(["x"], "later", [item("x", "now")]);
    expect(plan.moves[0]).toEqual({ id: "x", fromBucket: "now", toBucket: "later" });
  });

  it("supports a bulk move to backlog (un-commit), keeping the from-bucket", () => {
    const plan = planBulkMove(["a", "b"], null, [item("a", "now"), item("b", null)]);
    // a un-commits now -> backlog; b is already backlog (no-op).
    expect(plan.moves).toEqual([{ id: "a", fromBucket: "now", toBucket: null }]);
    expect(plan.skippedNoop).toBe(1);
  });

  it("de-dups a repeated id (one move, counted once)", () => {
    const plan = planBulkMove(["a", "a", "a"], "next", [item("a", "now")]);
    expect(plan.moves).toEqual([{ id: "a", fromBucket: "now", toBucket: "next" }]);
    expect(plan.skippedNoop).toBe(0);
  });

  it("drops an unknown id (not on the board) instead of inventing a move", () => {
    const plan = planBulkMove(["a", "ghost"], "now", [item("a", null)]);
    expect(plan.moves).toEqual([{ id: "a", fromBucket: null, toBucket: "now" }]);
    expect(plan.skippedUnknown).toBe(1);
  });

  it("preserves the first-occurrence order of the selection", () => {
    const items = [item("a", null), item("b", null), item("c", null)];
    const plan = planBulkMove(["c", "a", "b"], "now", items);
    expect(plan.moves.map((m) => m.id)).toEqual(["c", "a", "b"]);
  });

  it("caps the batch and reports the overflow instead of silently dropping it", () => {
    const items = Array.from({ length: 5 }, (_, i) => item(`id${i}`, null));
    const ids = items.map((i) => i.id);
    const plan = planBulkMove(ids, "now", items, 3);
    expect(plan.moves).toHaveLength(3);
    expect(plan.skippedOverCap).toBe(2);
  });

  it("falls back to the default cap when given a non-positive cap", () => {
    const plan = planBulkMove(["a"], "now", [item("a", null)], 0);
    expect(plan.moves).toHaveLength(1);
    // sanity: the default is the exported constant.
    expect(BULK_MOVE_CAP).toBeGreaterThan(0);
  });

  it("returns an all-empty plan for an empty selection", () => {
    const plan = planBulkMove([], "now", [item("a", null)]);
    expect(plan).toEqual({ moves: [], skippedNoop: 0, skippedUnknown: 0, skippedOverCap: 0 });
  });

  it("counts every selected id as exactly one outcome (move + skips == unique ids)", () => {
    const items = [item("a", null), item("b", "now"), item("c", "next")];
    const ids = ["a", "b", "c", "ghost", "a"]; // 4 unique
    const plan = planBulkMove(ids, "now", items, 1);
    const accounted =
      plan.moves.length + plan.skippedNoop + plan.skippedUnknown + plan.skippedOverCap;
    expect(accounted).toBe(4);
  });
});
