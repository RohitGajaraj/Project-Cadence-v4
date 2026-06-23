import { describe, it, expect } from "bun:test";
import {
  computeImpactLedger,
  renderImpactMarkdown,
  type ImpactLedgerInput,
} from "./pm-impact";

function ledger(over: Partial<ImpactLedgerInput> = {}) {
  return computeImpactLedger({ decisions: [], learnings: [], ...over });
}

describe("computeImpactLedger — empty / sparse", () => {
  it("is fully empty-safe and never throws", () => {
    const r = ledger();
    expect(r.decisionsTotal).toBe(0);
    expect(r.outcomes.hitRate).toBeNull();
    expect(r.highlights).toEqual([]);
    expect(r.headline.toLowerCase()).toContain("no decisions");
  });

  it("counts decisions but reports no decisive hit rate when outcomes are only mixed", () => {
    const r = ledger({
      decisions: [{ id: "d1", created_at: "2026-06-01T00:00:00Z" }],
      learnings: [{ verdict: "mixed" }],
    });
    expect(r.decisionsTotal).toBe(1);
    expect(r.outcomes.mixed).toBe(1);
    expect(r.outcomes.hitRate).toBeNull();
  });
});

describe("computeImpactLedger — human vs agent + status + span", () => {
  it("splits human-led from agent-led and tallies status + active months", () => {
    const r = ledger({
      decisions: [
        { id: "d1", status: "shipped", created_at: "2026-04-10T00:00:00Z" },
        { id: "d2", status: "shipped", created_at: "2026-06-02T00:00:00Z", decided_by_agent_slug: "scout" },
        { id: "d3", status: "draft", created_at: "2026-06-20T00:00:00Z", decided_by_agent_slug: "  " },
      ],
    });
    expect(r.humanLed).toBe(2); // d1 + d3 (blank slug = human)
    expect(r.agentLed).toBe(1); // d2
    expect(r.decisionsByStatus).toEqual({ shipped: 2, draft: 1 });
    expect(r.span.activeMonths).toBe(2); // 2026-04, 2026-06
    expect(r.span.firstAt).toBe("2026-04-10T00:00:00Z");
    expect(r.span.lastAt).toBe("2026-06-20T00:00:00Z");
  });
});

describe("computeImpactLedger — outcomes, ICE, beliefs revised", () => {
  it("computes hit rate from decisive outcomes and net ICE from measured ones", () => {
    const r = ledger({
      decisions: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
      learnings: [
        { verdict: "validated", prior_ice: 4, new_ice: 7 }, // +3
        { verdict: "validated", prior_ice: 5, new_ice: 6 }, // +1
        { verdict: "missed", prior_ice: 8, new_ice: 3 }, // -5
        { verdict: "noted" }, // non-decisive, no ICE
      ],
    });
    expect(r.outcomes.validated).toBe(2);
    expect(r.outcomes.missed).toBe(1);
    expect(r.outcomes.other).toBe(1);
    expect(r.outcomes.hitRate).toBeCloseTo(0.67, 2); // 2/3
    expect(r.measuredOutcomes).toBe(3);
    expect(r.iceShiftTotal).toBeCloseTo(-1, 5); // 3 + 1 - 5
    expect(r.iceShiftAvg).toBeCloseTo(-0.3, 5);
  });

  it("counts beliefs revised from the superseded set", () => {
    const r = ledger({
      decisions: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
      supersededDecisionIds: new Set(["d1", "d3"]),
    });
    expect(r.beliefsRevised).toBe(2);
    expect(r.headline).toContain("2 beliefs revised");
  });

  it("ranks highlights by largest positive ICE shift and drops empty summaries", () => {
    const r = ledger({
      learnings: [
        { verdict: "validated", summary: "Small win", prior_ice: 5, new_ice: 6 }, // +1
        { verdict: "validated", summary: "Big win", prior_ice: 3, new_ice: 9 }, // +6
        { verdict: "validated", summary: "" }, // dropped (no summary)
      ],
      maxHighlights: 2,
    });
    expect(r.highlights).toHaveLength(2);
    expect(r.highlights[0].summary).toBe("Big win");
    expect(r.highlights[1].summary).toBe("Small win");
  });
});

describe("renderImpactMarkdown — portable artifact", () => {
  it("renders a clean record with name, span, and standout calls", () => {
    const l = computeImpactLedger({
      decisions: [
        { id: "d1", status: "shipped", created_at: "2026-04-01T00:00:00Z" },
        { id: "d2", status: "shipped", created_at: "2026-06-01T00:00:00Z" },
      ],
      learnings: [
        { verdict: "validated", summary: "Checkout redesign lifted conversion", metric_label: "conv", metric_value: "+12%", prior_ice: 4, new_ice: 8 },
      ],
      supersededDecisionIds: new Set(["d1"]),
    });
    const md = renderImpactMarkdown(l, { name: "Alex Rivera", workspace: "Acme", asOf: "2026-06-24" });
    expect(md).toContain("# Alex Rivera");
    expect(md).toContain("_Acme_");
    expect(md).toContain("As of 2026-06-24");
    expect(md).toContain("Apr 2026 to Jun 2026");
    expect(md).toContain("Beliefs revised on evidence: 1");
    expect(md).toContain("Standout calls");
    expect(md).toContain("Checkout redesign lifted conversion (conv: +12%)");
  });

  it("renders honestly with no data", () => {
    const md = renderImpactMarkdown(computeImpactLedger({}), {});
    expect(md).toContain("Product decision record");
    expect(md).toContain("No outcomes recorded yet");
  });

  it("has no em/en dashes or AI-cliché fingerprints in the artifact", () => {
    const l = computeImpactLedger({
      decisions: [{ id: "d1", created_at: "2026-06-01T00:00:00Z" }],
      learnings: [{ verdict: "validated", summary: "win", prior_ice: 1, new_ice: 2 }],
    });
    const md = renderImpactMarkdown(l, { name: "PM" });
    expect(md.includes("—")).toBe(false);
    expect(md.includes("–")).toBe(false);
    expect(md.toLowerCase()).not.toContain("delve");
  });
});
