import { expect, test, describe } from "bun:test";
import {
  summarizeLearnings,
  isDecisionSuperseded,
  monthKey,
  buildTimeline,
  derivePatterns,
  supersedingIdFor,
  supersedesParentMap,
  resolvedChildIds,
  activeContradictions,
  deriveUnresolved,
} from "./brain-insights.functions";
import type { LineageEdgeLite } from "./trust-ledger.functions";

describe("summarizeLearnings", () => {
  test("tallies by verdict family and computes the decisive hit rate (mixed excluded)", () => {
    const s = summarizeLearnings([
      { verdict: "validated" },
      { verdict: "validated" },
      { verdict: "validated" },
      { verdict: "missed" },
      { verdict: "mixed" },
      { verdict: "Validated" }, // case-insensitive
      { verdict: "weird" }, // other
    ]);
    expect(s.validated).toBe(4);
    expect(s.missed).toBe(1);
    expect(s.mixed).toBe(1);
    expect(s.other).toBe(1);
    expect(s.total).toBe(7);
    expect(s.hitRate).toBe(80); // 4 / (4+1)
  });
  test("hitRate is null when there is no decisive outcome", () => {
    expect(summarizeLearnings([{ verdict: "mixed" }]).hitRate).toBeNull();
    expect(summarizeLearnings([]).hitRate).toBeNull();
    expect(summarizeLearnings(null).total).toBe(0);
  });
});

describe("isDecisionSuperseded — own id OR a source artifact id is superseded", () => {
  const sup = new Map<string, string>([["prd-1", "d-new"]]);
  const base = { id: "d", status: "approved", created_at: "2026-06-10T00:00:00Z", mission_id: null, meeting_id: null };
  test("superseded via the decision's source prd", () => {
    expect(isDecisionSuperseded({ ...base, title: "t", prd_id: "prd-1" }, sup)).toBe(true);
  });
  test("standing when neither own nor source id is superseded", () => {
    expect(isDecisionSuperseded({ ...base, title: "t", prd_id: "prd-x" }, sup)).toBe(false);
  });
});

describe("monthKey", () => {
  test("extracts YYYY-MM from an ISO stamp", () => {
    expect(monthKey("2026-06-24T03:00:00Z")).toBe("2026-06");
  });
  test("returns null for malformed input", () => {
    expect(monthKey("nope")).toBeNull();
    expect(monthKey(null)).toBeNull();
    expect(monthKey("")).toBeNull();
  });
});

describe("buildTimeline — month buckets, oldest→newest, capped", () => {
  const sup = new Map<string, string>([["d-old", "d-new"]]);
  const decisions = [
    { id: "d-old", title: "a", status: "approved", created_at: "2026-04-02T00:00:00Z", mission_id: null, prd_id: null, meeting_id: null },
    { id: "d2", title: "b", status: "approved", created_at: "2026-06-10T00:00:00Z", mission_id: null, prd_id: null, meeting_id: null },
    { id: "d3", title: "c", status: "approved", created_at: "2026-06-20T00:00:00Z", mission_id: null, prd_id: null, meeting_id: null },
  ];
  const learnings = [{ created_at: "2026-06-01T00:00:00Z" }, { created_at: "2026-05-01T00:00:00Z" }];
  const tl = buildTimeline(decisions, sup, learnings);

  test("groups decisions + superseded + learnings by month, sorted ascending", () => {
    expect(tl.map((b) => b.month)).toEqual(["2026-04", "2026-05", "2026-06"]);
    const jun = tl.find((b) => b.month === "2026-06")!;
    expect(jun.decisions).toBe(2);
    expect(jun.learnings).toBe(1);
    const apr = tl.find((b) => b.month === "2026-04")!;
    expect(apr.superseded).toBe(1); // d-old is superseded
  });
  test("caps to the most recent N months", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `d${i}`,
      title: "x",
      status: "approved",
      created_at: `2026-${String(i + 1).padStart(2, "0")}-01T00:00:00Z`,
      mission_id: null,
      prd_id: null,
      meeting_id: null,
    }));
    expect(buildTimeline(many, new Map(), [], 6)).toHaveLength(6);
  });
});

describe("derivePatterns — honest plain-language observations", () => {
  test("sparse data yields a single honest 'still gathering' note", () => {
    const p = derivePatterns({ standing: 0, superseded: 0 }, summarizeLearnings([]));
    expect(p).toHaveLength(1);
    expect(p[0].text).toContain("gathering precedent");
  });
  test("a strong hit rate is positive; supersession is surfaced as evolving", () => {
    const learned = summarizeLearnings([{ verdict: "validated" }, { verdict: "validated" }, { verdict: "missed" }]);
    const p = derivePatterns({ standing: 4, superseded: 2 }, learned);
    expect(p.some((x) => x.tone === "positive" && /landing/.test(x.text))).toBe(true);
    expect(p.some((x) => /revised since/.test(x.text))).toBe(true);
  });
  test("a weak hit rate is flagged to watch", () => {
    const learned = summarizeLearnings([{ verdict: "missed" }, { verdict: "missed" }, { verdict: "validated" }]);
    const p = derivePatterns({ standing: 1, superseded: 0 }, learned);
    expect(p.some((x) => x.tone === "watch")).toBe(true);
    expect(p.some((x) => /All 1 recorded decisions still stand/.test(x.text))).toBe(true);
  });
});

describe("supersedingIdFor — which artifact revised this decision (the 'why it changed')", () => {
  const base = { id: "d", mission_id: null, prd_id: null, meeting_id: null };
  test("returns the superseding parent for the decision's own id", () => {
    const sup = new Map<string, string>([["d", "d-new"]]);
    expect(supersedingIdFor(base, sup)).toBe("d-new");
  });
  test("matches via a source artifact id (prd) too", () => {
    const sup = new Map<string, string>([["prd-1", "d-new"]]);
    expect(supersedingIdFor({ ...base, prd_id: "prd-1" }, sup)).toBe("d-new");
  });
  test("returns null when nothing superseded it", () => {
    expect(supersedingIdFor(base, new Map())).toBeNull();
  });
});

describe("resolvedChildIds — only real supersessions settle (contradicts does NOT)", () => {
  const edges: LineageEdgeLite[] = [
    { parent_kind: "decision", parent_id: "d-new", child_kind: "decision", child_id: "d-old", relation: "supersedes", valid_to: null },
    { parent_kind: "decision", parent_id: "x", child_kind: "decision", child_id: "d-conflict", relation: "contradicts", valid_to: null },
    { parent_kind: "decision", parent_id: "y", child_kind: "decision", child_id: "d-reversed", relation: "supersedes", valid_to: "2026-06-01T00:00:00Z" },
  ];
  test("includes active supersedes children, excludes contradicts + reversed", () => {
    const r = resolvedChildIds(edges);
    expect(r.has("d-old")).toBe(true);
    expect(r.has("d-conflict")).toBe(false); // a contradiction is not a resolution
    expect(r.has("d-reversed")).toBe(false); // bitemporally retired
  });
});

describe("supersedesParentMap — 'revised' map excludes contradicts (Defect-1 guard)", () => {
  const edges: LineageEdgeLite[] = [
    { parent_kind: "decision", parent_id: "d-new", child_kind: "decision", child_id: "d-old", relation: "supersedes", valid_to: null },
    // a contradiction must NOT register as a revision — else a mere conflict reads "now superseded by X"
    { parent_kind: "decision", parent_id: "rival", child_kind: "decision", child_id: "d-contested", relation: "contradicts", valid_to: null },
  ];
  test("maps superseded child to its replacing parent, ignores the contradiction", () => {
    const m = supersedesParentMap(edges);
    expect(m.get("d-old")).toBe("d-new");
    expect(m.has("d-contested")).toBe(false);
  });
  test("a contested-only decision yields no superseding id (revisedBy stays null)", () => {
    const m = supersedesParentMap(edges);
    expect(supersedingIdFor({ id: "d-contested", mission_id: null, prd_id: null, meeting_id: null }, m)).toBeNull();
  });
});

describe("activeContradictions — open conflict pairs, deduped + reversal-aware", () => {
  const edges: LineageEdgeLite[] = [
    { parent_kind: "decision", parent_id: "a", child_kind: "decision", child_id: "b", relation: "contradicts", valid_to: null },
    // same unordered pair from the other direction — must dedupe
    { parent_kind: "decision", parent_id: "b", child_kind: "decision", child_id: "a", relation: "contradicts", valid_to: null },
    // a reversed contradiction — excluded
    { parent_kind: "decision", parent_id: "c", child_kind: "decision", child_id: "e", relation: "contradicts", valid_to: "2026-06-01T00:00:00Z" },
    // a supersession — not a contradiction
    { parent_kind: "decision", parent_id: "f", child_kind: "decision", child_id: "g", relation: "supersedes", valid_to: null },
  ];
  test("returns one deduped active pair", () => {
    const c = activeContradictions(edges);
    expect(c).toHaveLength(1);
    expect(new Set([c[0].aId, c[0].bId])).toEqual(new Set(["a", "b"]));
  });
});

describe("deriveUnresolved — open questions touching a known decision", () => {
  const decisions = [
    { id: "d1", title: "Ship the inline editor" },
    { id: "d2", title: "Drop the legacy export" },
  ];
  const learned = summarizeLearnings([{ verdict: "mixed" }, { verdict: "validated" }]);

  test("surfaces an unresolved contradiction that touches a decision", () => {
    const contras = [{ aId: "d1", bId: "other-artifact" }];
    const u = deriveUnresolved(decisions, contras, new Set(), learned);
    expect(u.contradictions).toHaveLength(1);
    expect(u.contradictions[0].title).toBe("Ship the inline editor");
    expect(u.mixedOutcomes).toBe(1);
    expect(u.count).toBe(2); // 1 contradiction + 1 mixed
  });
  test("a contradiction settled by a real supersession is NOT unresolved", () => {
    const contras = [{ aId: "d1", bId: "other" }];
    const u = deriveUnresolved(decisions, contras, new Set(["d1"]), learned);
    expect(u.contradictions).toHaveLength(0);
    expect(u.count).toBe(1); // only the mixed outcome remains
  });
  test("a contradiction touching no known decision is skipped", () => {
    const u = deriveUnresolved(decisions, [{ aId: "ghost-1", bId: "ghost-2" }], new Set(), summarizeLearnings([]));
    expect(u.contradictions).toHaveLength(0);
    expect(u.count).toBe(0);
  });
  test("count totals ALL open contradictions even when the list is capped (Defect-2 guard)", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `dd${i}`, title: `decision ${i}` }));
    const contras = many.map((d) => ({ aId: d.id, bId: "other" }));
    const u = deriveUnresolved(many, contras, new Set(), summarizeLearnings([]), 2);
    expect(u.contradictions).toHaveLength(2); // list capped
    expect(u.count).toBe(5); // but count is the honest total (5 open + 0 mixed)
  });
});
