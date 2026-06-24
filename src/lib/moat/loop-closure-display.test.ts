import { describe, it, expect } from "bun:test";
import { summarizeLoopClosure } from "./loop-closure-display";
import type { LoopClosureReport } from "./loop-closure";

function report(over: Partial<LoopClosureReport> = {}): LoopClosureReport {
  return {
    closed: false,
    warmth: "cold",
    counts: {
      decisions: 0,
      outcomesRecorded: 0,
      supersessionEdges: 0,
      contradictionEdges: 0,
      governingResolutions: 0,
    },
    chains: [],
    gaps: [],
    ...over,
  };
}

describe("summarizeLoopClosure", () => {
  it("warm: leads with the proof (beliefs resolved forward), tone + headline", () => {
    const s = summarizeLoopClosure(
      report({
        closed: true,
        warmth: "warm",
        counts: {
          decisions: 23,
          outcomesRecorded: 17,
          supersessionEdges: 2,
          contradictionEdges: 0,
          governingResolutions: 2,
        },
      }),
    );
    expect(s.tone).toBe("warm");
    expect(s.label).toBe("Your decision loop is closing");
    expect(s.detail).toContain("2 beliefs resolved forward");
  });

  it("warm with exactly one resolution is singular", () => {
    const s = summarizeLoopClosure(
      report({
        closed: true,
        warmth: "warm",
        counts: {
          decisions: 6,
          outcomesRecorded: 16,
          supersessionEdges: 1,
          contradictionEdges: 0,
          governingResolutions: 1,
        },
      }),
    );
    expect(s.detail).toBe("1 belief resolved forward to its current replacement.");
  });

  it("warming: surfaces the engine's first gap, not a fabricated win", () => {
    const s = summarizeLoopClosure(
      report({
        warmth: "warming",
        gaps: ["Edges exist but none resolve forward yet.", "second gap"],
      }),
    );
    expect(s.tone).toBe("warming");
    expect(s.label).toBe("Your decision loop is warming");
    expect(s.detail).toBe("Edges exist but none resolve forward yet.");
  });

  it("cold with no gaps falls back to a plain honest line (never empty)", () => {
    const s = summarizeLoopClosure(report({ warmth: "cold", gaps: [] }));
    expect(s.tone).toBe("cold");
    expect(s.detail.length).toBeGreaterThan(0);
    expect(s.detail).toBe("No decision has been superseded by its outcome yet.");
  });

  it("maps the four loop stages into an ordered trail", () => {
    const s = summarizeLoopClosure(
      report({
        warmth: "warming",
        counts: {
          decisions: 23,
          outcomesRecorded: 17,
          supersessionEdges: 3,
          contradictionEdges: 1,
          governingResolutions: 0,
        },
      }),
    );
    expect(s.trail.map((t) => t.label)).toEqual(["decisions", "outcomes", "revised", "resolved"]);
    expect(s.trail.map((t) => t.value)).toEqual([23, 17, 3, 0]);
  });

  it("is defensive: a partial/garbage report never throws and reads cold", () => {
    const s = summarizeLoopClosure({
      warmth: "nope",
      counts: undefined,
      gaps: undefined,
    } as unknown as LoopClosureReport);
    expect(s.tone).toBe("cold");
    expect(s.trail).toHaveLength(4);
    expect(s.trail.every((t) => t.value === 0)).toBe(true);
  });

  it("floors negative/non-finite counts to 0", () => {
    const s = summarizeLoopClosure(
      report({
        warmth: "warm",
        closed: true,
        counts: {
          decisions: -5,
          outcomesRecorded: Number.NaN,
          supersessionEdges: 2.9,
          contradictionEdges: 0,
          governingResolutions: 1,
        },
      }),
    );
    expect(s.trail[0].value).toBe(0); // -5 -> 0
    expect(s.trail[1].value).toBe(0); // NaN -> 0
    expect(s.trail[2].value).toBe(2); // 2.9 -> 2
  });
});
