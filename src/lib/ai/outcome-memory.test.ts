import { describe, expect, test } from "bun:test";
import {
  buildOutcomeMemory,
  outcomeImportance,
  OUTCOME_MEMORY_KIND,
  formatDecisionPrecedent,
} from "./outcome-memory";

describe("buildOutcomeMemory", () => {
  test("names the spec, the opportunity, the verdict, and the ICE move", () => {
    const m = buildOutcomeMemory({
      prdTitle: "Smart Off-Hours Routing",
      oppTitle: "Per-segment tone calibration",
      verdict: "validated",
      summary: "Conversion rose 12% for the off-hours segment.",
      priorIce: 8.3,
      newIce: 8.7,
    });
    expect(m).toContain('"Smart Off-Hours Routing"');
    expect(m).toContain('opportunity: "Per-segment tone calibration"');
    expect(m).toContain("VALIDATED");
    expect(m).toContain("Conversion rose 12%");
    expect(m).toContain("8.3→8.7");
  });

  test("omits the opportunity clause when there is no linked opportunity", () => {
    const m = buildOutcomeMemory({
      prdTitle: "Spec X",
      oppTitle: null,
      verdict: "missed",
      summary: "Didn't move the metric.",
    });
    expect(m).toContain("MISSED");
    expect(m).not.toContain("opportunity:");
  });

  test("omits the ICE line when the score didn't move (mixed)", () => {
    const m = buildOutcomeMemory({
      prdTitle: "Spec Y",
      verdict: "mixed",
      summary: "Partial result.",
      priorIce: 7,
      newIce: 7,
    });
    expect(m).toContain("MIXED");
    expect(m).not.toContain("ICE moved");
  });

  test("treats a sub-0.1 drift as no move (no misleading 8.7→8.7)", () => {
    // Reachable when confidence is clamped: DB-stored ICE vs recomputed float
    // differ by a hair but round to the same tenth.
    const m = buildOutcomeMemory({
      prdTitle: "Clamped",
      verdict: "validated",
      summary: "confidence already maxed",
      priorIce: 8.67,
      newIce: 8.6667,
    });
    expect(m).not.toContain("ICE moved");
  });

  test("rounds noisy generated ICE values to one decimal", () => {
    const m = buildOutcomeMemory({
      prdTitle: "Z",
      verdict: "validated",
      summary: "s",
      priorIce: 7,
      newIce: 7.333333333,
    });
    expect(m).toContain("7→7.3");
  });

  test("falls back gracefully on an empty title", () => {
    const m = buildOutcomeMemory({ prdTitle: "  ", verdict: "mixed", summary: "s" });
    expect(m).toContain("an untitled spec");
  });

  test("caps the content length", () => {
    const m = buildOutcomeMemory({
      prdTitle: "T",
      verdict: "validated",
      summary: "x".repeat(5000),
    });
    expect(m.length).toBeLessThanOrEqual(1000);
  });
});

describe("outcomeImportance", () => {
  test("decisive verdicts outrank an ambiguous one (and survive decay)", () => {
    expect(outcomeImportance("validated")).toBe(4);
    expect(outcomeImportance("missed")).toBe(4);
    expect(outcomeImportance("mixed")).toBe(3);
    // The memory-tick decays importance <= 2; outcomes must stay above it.
    expect(outcomeImportance("mixed")).toBeGreaterThan(2);
  });
});

test("OUTCOME_MEMORY_KIND is the stable discriminator", () => {
  expect(OUTCOME_MEMORY_KIND).toBe("outcome");
});

// DBR-0 (the Decision Brain's first step): the Critic was context-blind — it
// red-teamed only the row's own fields, never past outcomes. This formats the
// decision precedent (past shipped outcomes recordOutcome already wrote) into a
// compact block the Critic can cite, so its verdict carries receipts.
describe("formatDecisionPrecedent", () => {
  test("returns an empty string when there is no precedent", () => {
    expect(formatDecisionPrecedent([])).toBe("");
  });

  test("renders a header plus one bullet per outcome, with verdict, title, summary, and ICE move", () => {
    const block = formatDecisionPrecedent([
      {
        title: "Per-segment tone calibration",
        verdict: "validated",
        summary: "Conversion rose 12% for the off-hours segment.",
        priorIce: 6,
        newIce: 7.333,
      },
    ]);
    expect(block).toContain("Decision precedent");
    expect(block).toContain("[VALIDATED]");
    expect(block).toContain("Per-segment tone calibration");
    expect(block).toContain("Conversion rose 12%");
    expect(block).toContain("6→7.3");
  });

  test("caps the number of bullets so the Critic prompt never bloats", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      title: `Bet ${i}`,
      verdict: "missed" as const,
      summary: "did not move the metric",
    }));
    const block = formatDecisionPrecedent(rows);
    expect(block.match(/^- \[/gm)?.length).toBe(8);
  });

  test("truncates a long summary so one outcome cannot dominate the block", () => {
    const block = formatDecisionPrecedent([
      { title: "T", verdict: "mixed", summary: "x".repeat(500) },
    ]);
    expect(block).not.toContain("x".repeat(300));
  });

  test("falls back gracefully on a missing title and omits the ICE clause when absent", () => {
    const block = formatDecisionPrecedent([
      { title: null, verdict: "missed", summary: "no metric movement" },
    ]);
    expect(block).toContain("[MISSED]");
    expect(block).toContain("an untitled spec");
    expect(block).not.toContain("ICE");
  });
});
