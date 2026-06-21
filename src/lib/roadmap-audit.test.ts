import { describe, it, expect } from "bun:test";
import {
  buildAuditInsert,
  classifyRoadmapWrite,
  summarizeRoadmapHistory,
  type RoadmapAuditRow,
} from "./roadmap-audit";

describe("buildAuditInsert", () => {
  it("shapes a commit and normalizes blank outcome/measure to null", () => {
    const row = buildAuditInsert({
      opportunityId: "o1",
      workspaceId: "w1",
      action: "commit",
      toBucket: "now",
      outcome: "  Lift activation  ",
      measure: "   ",
    });
    expect(row).toEqual({
      opportunity_id: "o1",
      workspace_id: "w1",
      action: "commit",
      from_bucket: null,
      to_bucket: "now",
      outcome: "Lift activation", // trimmed
      measure: null, // whitespace -> null
    });
  });

  it("defaults missing optional fields to null (a move to backlog)", () => {
    const row = buildAuditInsert({
      opportunityId: "o2",
      workspaceId: null,
      action: "move",
      toBucket: null,
    });
    expect(row.to_bucket).toBeNull();
    expect(row.from_bucket).toBeNull();
    expect(row.outcome).toBeNull();
    expect(row.measure).toBeNull();
    expect(row.workspace_id).toBeNull();
    // never carries a caller-supplied user_id — the DB defaults auth.uid().
    expect("user_id" in row).toBe(false);
  });
});

const ev = (o: Partial<RoadmapAuditRow>): RoadmapAuditRow => ({
  id: "e",
  opportunity_id: "o1",
  user_id: "u1",
  workspace_id: "w1",
  action: "commit",
  from_bucket: null,
  to_bucket: "now",
  outcome: "x",
  measure: "y",
  created_at: "2026-06-21T00:00:00Z",
  ...o,
});

describe("classifyRoadmapWrite", () => {
  const state = (
    bucket: "now" | "next" | "later" | null,
    outcome: string | null = null,
    measure: string | null = null,
  ) => ({ bucket, outcome, measure });

  it("records a move that CARRIES the from-bucket and the outcome still promised", () => {
    // re-prioritize a governed commitment now -> next (the drag path)
    const d = classifyRoadmapWrite(
      state("now", "Lift activation", "D7 retention"),
      state("next", "Lift activation", "D7 retention"),
    );
    expect(d).toHaveLength(1);
    expect(d[0]).toEqual({
      action: "move",
      fromBucket: "now",
      toBucket: "next",
      outcome: "Lift activation",
      measure: "D7 retention",
    });
  });

  it("records a move into a bucket from backlog (from-bucket null)", () => {
    const d = classifyRoadmapWrite(state(null), state("now"));
    expect(d).toEqual([
      { action: "move", fromBucket: null, toBucket: "now", outcome: null, measure: null },
    ]);
  });

  it("records NOTHING when the same bucket is re-saved unchanged (no phantom move)", () => {
    expect(classifyRoadmapWrite(state("now", "x", "y"), state("now", "x", "y"))).toEqual([]);
  });

  it("treats an in-place outcome amendment on a committed item as a commit", () => {
    const d = classifyRoadmapWrite(
      state("now", "Old outcome", "m"),
      state("now", "New outcome", "m"),
    );
    expect(d).toEqual([
      {
        action: "commit",
        fromBucket: "now",
        toBucket: "now",
        outcome: "New outcome",
        measure: "m",
      },
    ]);
  });

  it("records BOTH a move and a commit when one write relocates AND re-declares the outcome", () => {
    // summarizeRoadmapHistory reads the live-why only from commit rows, so a combined write must
    // emit a commit too, or the re-declared outcome would be invisible.
    const d = classifyRoadmapWrite(
      state("now", "Old outcome", "m"),
      state("next", "New outcome", "m"),
    );
    expect(d.map((x) => x.action)).toEqual(["move", "commit"]);
    expect(d[0]).toEqual({
      action: "move",
      fromBucket: "now",
      toBucket: "next",
      outcome: "New outcome",
      measure: "m",
    });
    expect(d[1]).toMatchObject({ action: "commit", toBucket: "next", outcome: "New outcome" });
  });

  it("normalizes the outcome/measure it carries (no leaky untrimmed strings)", () => {
    const d = classifyRoadmapWrite(state(null), state("now", "  Trimmed  ", "  "));
    // move into a bucket from backlog: outcome trimmed, blank measure -> null
    expect(d[0]).toMatchObject({ action: "move", outcome: "Trimmed", measure: null });
  });

  it("does NOT record an amendment on a backlog item (not a roadmap decision)", () => {
    expect(classifyRoadmapWrite(state(null, "a"), state(null, "b"))).toEqual([]);
  });

  it("does NOT record a pure clear (outcome removed) as a commit; the gap surface owns that", () => {
    expect(classifyRoadmapWrite(state("now", "had one", "m"), state("now", null, "m"))).toEqual([]);
  });

  it("ignores a whitespace-only change (normalized equal)", () => {
    expect(classifyRoadmapWrite(state("now", "x", "y"), state("now", "  x  ", "y"))).toEqual([]);
  });
});

describe("summarizeRoadmapHistory", () => {
  it("counts events and takes the newest committed outcome as the live why", () => {
    // newest-first, as the read fn returns.
    const rows: RoadmapAuditRow[] = [
      ev({
        action: "commit",
        outcome: "Newer outcome",
        measure: "m2",
        created_at: "2026-06-21T03:00:00Z",
      }),
      ev({ action: "move", outcome: null, measure: null, created_at: "2026-06-21T02:00:00Z" }),
      ev({
        action: "commit",
        outcome: "Older outcome",
        measure: "m1",
        created_at: "2026-06-21T01:00:00Z",
      }),
    ];
    const s = summarizeRoadmapHistory(rows);
    expect(s.events).toBe(3);
    expect(s.commits).toBe(2);
    expect(s.moves).toBe(1);
    expect(s.currentOutcome).toBe("Newer outcome");
    expect(s.currentMeasure).toBe("m2");
    expect(s.lastCommittedAt).toBe("2026-06-21T03:00:00Z");
  });

  it("handles an empty history and a move-only history", () => {
    expect(summarizeRoadmapHistory([])).toMatchObject({ events: 0, currentOutcome: null });
    const moves = summarizeRoadmapHistory([ev({ action: "move", outcome: null })]);
    expect(moves.moves).toBe(1);
    expect(moves.currentOutcome).toBeNull();
    expect(moves.lastCommittedAt).toBeNull();
  });

  it("ignores a commit with no outcome when finding the live why", () => {
    const s = summarizeRoadmapHistory([
      ev({ action: "commit", outcome: null, measure: null }),
      ev({ action: "commit", outcome: "Real", measure: "r" }),
    ]);
    expect(s.currentOutcome).toBe("Real");
  });
});
