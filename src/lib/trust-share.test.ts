import { expect, test, describe } from "bun:test";
import { supersedingParentIds } from "./decisions-share.functions";
import type { LineageEdgeLite } from "./trust-ledger.functions";

describe("supersedingParentIds — the superseders of a decision (for the public receipt)", () => {
  const edges: LineageEdgeLite[] = [
    // an active supersession of decision d-old by d-new (d-old is the child)
    { parent_kind: "decision", parent_id: "d-new", child_kind: "decision", child_id: "d-old", relation: "supersedes", valid_to: null },
    // a RETIRED (reversed) supersession of d-rev — must NOT count
    { parent_kind: "decision", parent_id: "x", child_kind: "decision", child_id: "d-rev", relation: "supersedes", valid_to: "2026-06-01T00:00:00Z" },
    // a non-supersession edge — ignored
    { parent_kind: "prd", parent_id: "p", child_kind: "decision", child_id: "d-derived", relation: "derived_from", valid_to: null },
  ];

  test("returns the parent (superseder) id for an active supersedes edge on the child", () => {
    expect(supersedingParentIds(["d-old"], edges)).toEqual(["d-new"]);
  });

  test("checks ALL of the decision's own + source ids", () => {
    const withSourceEdge: LineageEdgeLite[] = [
      { parent_kind: "prd", parent_id: "p-new", child_kind: "prd", child_id: "prd-1", relation: "supersedes", valid_to: null },
    ];
    expect(supersedingParentIds(["d-1", "prd-1", null, undefined], withSourceEdge)).toEqual(["p-new"]);
  });

  test("a reversed (valid_to set) supersession yields no superseder", () => {
    expect(supersedingParentIds(["d-rev"], edges)).toEqual([]);
  });

  test("a non-supersession relation yields no superseder", () => {
    expect(supersedingParentIds(["d-derived"], edges)).toEqual([]);
  });

  test("an unrelated / unknown decision has no superseders (standing)", () => {
    expect(supersedingParentIds(["d-unknown"], edges)).toEqual([]);
  });

  test("dedups multiple edges from the same superseder", () => {
    const dup: LineageEdgeLite[] = [
      { parent_kind: "decision", parent_id: "d-new", child_kind: "decision", child_id: "d-old", relation: "supersedes", valid_to: null },
      { parent_kind: "decision", parent_id: "d-new", child_kind: "prd", child_id: "prd-src", relation: "contradicts", valid_to: null },
    ];
    expect(supersedingParentIds(["d-old", "prd-src"], dup)).toEqual(["d-new"]);
  });

  test("empty / malformed input is safe", () => {
    expect(supersedingParentIds([], edges)).toEqual([]);
    expect(supersedingParentIds(["d-old"], null)).toEqual([]);
    expect(supersedingParentIds([null, undefined, ""], edges)).toEqual([]);
  });
});
