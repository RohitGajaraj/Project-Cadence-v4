import { describe, expect, test } from "bun:test";
import { applyHunkSelection, computeHunks } from "./studio-hunks";

describe("computeHunks", () => {
  test("identical content has no hunks", () => {
    expect(computeHunks("a\nb\nc", "a\nb\nc")).toEqual([]);
  });

  test("a single replaced line is one hunk", () => {
    const hunks = computeHunks("a\nb\nc", "a\nB\nc");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({ id: 0, baseLines: ["b"], modifiedLines: ["B"] });
  });

  test("two separated edits are two hunks with stable ids", () => {
    const hunks = computeHunks("a\nb\nc\nd\ne", "A\nb\nc\nd\nE");
    expect(hunks.map((h) => h.id)).toEqual([0, 1]);
    expect(hunks[0]).toMatchObject({ baseLines: ["a"], modifiedLines: ["A"] });
    expect(hunks[1]).toMatchObject({ baseLines: ["e"], modifiedLines: ["E"] });
  });

  test("pure insertion (create-like) is one ins-only hunk", () => {
    const hunks = computeHunks("", "x\ny");
    expect(hunks).toHaveLength(1);
    expect(hunks[0].baseLines).toEqual([]);
    expect(hunks[0].modifiedLines).toEqual(["x", "y"]);
  });

  test("pure deletion is one del-only hunk", () => {
    const hunks = computeHunks("x\ny", "");
    expect(hunks).toHaveLength(1);
    expect(hunks[0].baseLines).toEqual(["x", "y"]);
    expect(hunks[0].modifiedLines).toEqual([]);
  });
});

describe("applyHunkSelection", () => {
  const base = "a\nb\nc\nd\ne";
  const modified = "A\nb\nc\nd\nE";

  test("rejecting nothing reconstructs the modified content exactly", () => {
    expect(applyHunkSelection(base, modified, [])).toBe(modified);
  });

  test("rejecting every hunk reconstructs the base content exactly", () => {
    const ids = computeHunks(base, modified).map((h) => h.id);
    expect(applyHunkSelection(base, modified, ids)).toBe(base);
  });

  test("rejecting one hunk keeps the other (partial accept)", () => {
    // Reject hunk 0 (a->A), keep hunk 1 (e->E): expect base's first line, modified's last.
    expect(applyHunkSelection(base, modified, [0])).toBe("a\nb\nc\nd\nE");
    expect(applyHunkSelection(base, modified, [1])).toBe("A\nb\nc\nd\ne");
  });

  test("preserves a trailing newline through round-trip", () => {
    const b = "a\nb\n";
    const m = "a\nB\n";
    expect(applyHunkSelection(b, m, [])).toBe(m);
    expect(applyHunkSelection(b, m, computeHunks(b, m).map((h) => h.id))).toBe(b);
  });

  test("unknown rejected ids are ignored (no crash, treated as accept)", () => {
    expect(applyHunkSelection(base, modified, [99])).toBe(modified);
  });

  test("an inserted block can be rejected back to empty base", () => {
    expect(applyHunkSelection("", "x\ny", [0])).toBe("");
    expect(applyHunkSelection("", "x\ny", [])).toBe("x\ny");
  });
});
