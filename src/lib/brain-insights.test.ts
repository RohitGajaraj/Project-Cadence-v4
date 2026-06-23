import { expect, test, describe } from "bun:test";
import {
  summarizeLearnings,
  isDecisionSuperseded,
  monthKey,
  buildTimeline,
  derivePatterns,
} from "./brain-insights.functions";

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
