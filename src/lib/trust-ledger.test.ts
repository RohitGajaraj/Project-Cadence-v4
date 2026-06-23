import { expect, test, describe } from "bun:test";
import {
  isSupersessionRelation,
  supersededChildIds,
  evidenceCounts,
  summarizeAction,
  assembleReceipts,
  type DecisionLite,
  type ApprovalLite,
  type LineageEdgeLite,
} from "./trust-ledger.functions";

describe("isSupersessionRelation", () => {
  test("matches only supersedes/contradicts, case + space tolerant", () => {
    expect(isSupersessionRelation("supersedes")).toBe(true);
    expect(isSupersessionRelation("  Contradicts ")).toBe(true);
    expect(isSupersessionRelation("derived_from")).toBe(false);
    expect(isSupersessionRelation(null)).toBe(false);
    expect(isSupersessionRelation("")).toBe(false);
  });
});

describe("supersededChildIds — the CHILD of an active supersession edge is the superseded node", () => {
  const edges: LineageEdgeLite[] = [
    { parent_kind: "decision", parent_id: "new", child_kind: "decision", child_id: "old", relation: "supersedes", valid_to: null },
    { parent_kind: "prd", parent_id: "p2", child_kind: "prd", child_id: "p1", relation: "contradicts", valid_to: null },
    // retired supersession (reversal) — must NOT count
    { parent_kind: "decision", parent_id: "x", child_kind: "decision", child_id: "y", relation: "supersedes", valid_to: "2026-06-01T00:00:00Z" },
    // non-supersession edge — ignored
    { parent_kind: "signal", parent_id: "s1", child_kind: "opportunity", child_id: "o1", relation: "derived_from", valid_to: null },
  ];
  const map = supersededChildIds(edges);

  test("active supersedes/contradicts mark the child superseded, with the superseder id", () => {
    expect(map.get("old")).toBe("new");
    expect(map.get("p1")).toBe("p2");
  });
  test("a retired (valid_to set) supersession is a reversal and does not count", () => {
    expect(map.has("y")).toBe(false);
  });
  test("non-supersession relations are ignored", () => {
    expect(map.has("o1")).toBe(false);
  });
  test("malformed input is safe", () => {
    expect(supersededChildIds(null).size).toBe(0);
    expect(supersededChildIds(undefined as never).size).toBe(0);
  });
});

describe("evidenceCounts", () => {
  test("counts every id on either end of an edge", () => {
    const edges: LineageEdgeLite[] = [
      { parent_kind: "a", parent_id: "x", child_kind: "b", child_id: "y", relation: "derived_from" },
      { parent_kind: "a", parent_id: "x", child_kind: "b", child_id: "z", relation: "promoted" },
    ];
    const c = evidenceCounts(edges);
    expect(c.get("x")).toBe(2);
    expect(c.get("y")).toBe(1);
    expect(c.get("z")).toBe(1);
  });
});

describe("summarizeAction", () => {
  test("prettifies the tool name and appends a subject when present", () => {
    expect(summarizeAction("tasks.create", { title: "Draft rollout" })).toBe("Tasks Create: Draft rollout");
    expect(summarizeAction("github.issue_open", { name: "Fix bug" })).toBe("Github Issue Open: Fix bug");
  });
  test("falls back to a clean tool name with no subject, and to a default with no tool", () => {
    expect(summarizeAction("notify.send", {})).toBe("Notify Send");
    expect(summarizeAction(null, null)).toBe("Autonomous action");
  });
});

describe("assembleReceipts — merges decisions + actions, sorts newest first, tags supersession", () => {
  const decisions: DecisionLite[] = [
    {
      id: "d-old",
      title: "Ship formal tone",
      rationale: "SMB asked for it",
      status: "approved",
      source_kind: "prd",
      meeting_id: null,
      mission_id: null,
      prd_id: "prd-1",
      decided_by_agent_slug: "strategist",
      created_at: "2026-06-10T00:00:00Z",
    },
    {
      id: "d-new",
      title: "Segment tone by tier",
      rationale: "enterprise reads formal as accountable",
      status: "approved",
      source_kind: "mission",
      meeting_id: null,
      mission_id: "m-1",
      prd_id: null,
      decided_by_agent_slug: "strategist",
      created_at: "2026-06-12T00:00:00Z",
    },
  ];
  const approvals: ApprovalLite[] = [
    {
      id: "a-1",
      agent_slug: "strategist",
      tool_name: "tasks.create",
      args: { title: "Draft the rollout plan" },
      rationale: "off the off-hours spec",
      decision_reason: null,
      status: "approved",
      decided_at: "2026-06-11T09:00:00Z",
      decided_by: "user-1",
      created_at: "2026-06-11T08:00:00Z",
      mission_id: "m-1",
    },
  ];
  // d-old (prd-1) is superseded by d-new
  const superseded = new Map<string, string>([["prd-1", "d-new"]]);
  const evidence = new Map<string, number>([
    ["prd-1", 2],
    ["m-1", 1],
  ]);
  const sourceLabels = new Map<string, string>([
    ["prd-1", "Tone PRD"],
    ["m-1", "Tone mission"],
  ]);

  const receipts = assembleReceipts({ decisions, approvals, superseded, evidence, sourceLabels });

  test("returns one receipt per decision + action", () => {
    expect(receipts).toHaveLength(3);
  });
  test("sorts strictly by occurredAt, newest first (decided_at used for actions)", () => {
    expect(receipts.map((r) => r.id)).toEqual(["d-new", "a-1", "d-old"]);
  });
  test("tags the superseded decision via its source id and names the superseder", () => {
    const old = receipts.find((r) => r.id === "d-old")!;
    expect(old.outcome).toBe("superseded");
    expect(old.supersededBy).toBe("d-new");
    const current = receipts.find((r) => r.id === "d-new")!;
    expect(current.outcome).toBe("standing");
  });
  test("action receipt: human-decided flag, tool name, summarized title, evidence via mission", () => {
    const a = receipts.find((r) => r.id === "a-1")!;
    expect(a.kind).toBe("action");
    expect(a.humanDecided).toBe(true);
    expect(a.toolName).toBe("tasks.create");
    expect(a.title).toBe("Tasks Create: Draft the rollout plan");
    expect(a.evidenceCount).toBe(1);
    expect(a.source.label).toBe("Tone mission");
  });
  test("decision evidence sums the record id and the source id", () => {
    const old = receipts.find((r) => r.id === "d-old")!;
    expect(old.evidenceCount).toBe(2); // prd-1 -> 2, d-old -> 0
    expect(old.source.label).toBe("Tone PRD");
  });
  test("malformed input is safe", () => {
    expect(
      assembleReceipts({
        decisions: null as never,
        approvals: undefined as never,
        superseded: new Map(),
        evidence: new Map(),
        sourceLabels: new Map(),
      }),
    ).toEqual([]);
  });
});
