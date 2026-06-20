/**
 * H2-AUDIT · Outcome-roadmap decision audit (pure, no IO).
 *
 * "Why is this on the roadmap?" is the recurring senior-PM justification burden.
 * Every roadmap DECISION (a bucket move, an outcome commit) is recorded so the
 * answer is reconstructable from evidence: who prioritized it, when, into which
 * bucket, and what outcome was promised AT THAT TIME. This module owns the row
 * shape, the pure insert-shaping (blank normalization), and a pure history
 * summary, kept IO-free so it is unit-tested and shared by the write + read fns.
 */

import type { RoadmapBucket } from "@/lib/roadmap-governance";

export type RoadmapAuditAction = "move" | "commit";

/** A persisted roadmap-decision event (matches the roadmap_audit table). */
export type RoadmapAuditRow = {
  id: string;
  opportunity_id: string;
  user_id: string;
  workspace_id: string | null;
  action: RoadmapAuditAction;
  from_bucket: RoadmapBucket | null;
  to_bucket: RoadmapBucket | null;
  outcome: string | null;
  measure: string | null;
  created_at: string;
};

/** The payload written on a roadmap decision (id + created_at are DB-defaulted). */
export type RoadmapAuditInsert = {
  opportunity_id: string;
  workspace_id: string | null;
  action: RoadmapAuditAction;
  from_bucket: RoadmapBucket | null;
  to_bucket: RoadmapBucket | null;
  outcome: string | null;
  measure: string | null;
};

const norm = (s: string | null | undefined): string | null =>
  s && s.trim().length > 0 ? s.trim() : null;

/**
 * Shape an audit insert from a decision. Blanks normalize to null so the trail
 * never records an "all whitespace" outcome as a real promise. user_id is left to
 * the DB default (auth.uid()) so the actor can never be spoofed by the caller.
 */
export function buildAuditInsert(input: {
  opportunityId: string;
  workspaceId: string | null;
  action: RoadmapAuditAction;
  fromBucket?: RoadmapBucket | null;
  toBucket: RoadmapBucket | null;
  outcome?: string | null;
  measure?: string | null;
}): RoadmapAuditInsert {
  return {
    opportunity_id: input.opportunityId,
    workspace_id: input.workspaceId ?? null,
    action: input.action,
    from_bucket: input.fromBucket ?? null,
    to_bucket: input.toBucket,
    outcome: norm(input.outcome),
    measure: norm(input.measure),
  };
}

export type RoadmapHistorySummary = {
  /** Total recorded decisions. */
  events: number;
  /** How many were governed commits (declared an outcome). */
  commits: number;
  /** How many were plain bucket moves. */
  moves: number;
  /** The most recent committed outcome (the live "why"), if any. */
  currentOutcome: string | null;
  currentMeasure: string | null;
  /** When this was last committed with an outcome (ISO), if ever. */
  lastCommittedAt: string | null;
};

/**
 * Summarize an opportunity's roadmap history into the "why is this here" answer.
 * Expects rows newest-first (the read fn's order); pure and defensive.
 */
export function summarizeRoadmapHistory(rows: readonly RoadmapAuditRow[]): RoadmapHistorySummary {
  const summary: RoadmapHistorySummary = {
    events: rows.length,
    commits: 0,
    moves: 0,
    currentOutcome: null,
    currentMeasure: null,
    lastCommittedAt: null,
  };
  for (const r of rows) {
    if (r.action === "commit") {
      summary.commits += 1;
      // rows are newest-first, so the first commit with an outcome is the live one.
      if (summary.currentOutcome === null && r.outcome) {
        summary.currentOutcome = r.outcome;
        summary.currentMeasure = r.measure;
        summary.lastCommittedAt = r.created_at;
      }
    } else {
      summary.moves += 1;
    }
  }
  return summary;
}
