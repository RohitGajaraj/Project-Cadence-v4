import { describe, it, expect } from "bun:test";
import { buildAuditInsert, summarizeRoadmapHistory, type RoadmapAuditRow } from "./roadmap-audit";

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
