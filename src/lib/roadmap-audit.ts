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

/** One audit decision a write should record, ready for {@link buildAuditInsert}. */
export type RoadmapWriteDecision = {
  action: RoadmapAuditAction;
  fromBucket: RoadmapBucket | null;
  toBucket: RoadmapBucket | null;
  outcome: string | null;
  measure: string | null;
};

/**
 * Classify an `updateRoadmapItem` write (prev -> next state) into the audit decisions it should
 * record, so the "why is this here" trail is complete across RE-PRIORITIZATIONS, not just commits:
 *
 * - A real bucket change is a "move" that now CARRIES the from-bucket AND the item's current
 *   outcome/measure, so the history shows where a commitment moved from and what it still promised
 *   at that move (today the move row records neither).
 * - An in-place outcome/measure amendment that leaves the item in a bucket with a declared outcome
 *   is a "commit" (a re-declaration), captured even when a non-board caller routed it through the
 *   lenient path instead of the governed commit fn.
 *
 * Pure and total. Comparing prev to next also avoids a phantom "move" when the same bucket is
 * re-saved (the old code audited whenever `bucket` was merely present in the patch). Clears (outcome
 * removed) and edits on a backlog item are not roadmap decisions, so they produce no row here.
 */
export function classifyRoadmapWrite(
  prev: { bucket: RoadmapBucket | null; outcome: string | null; measure: string | null },
  next: { bucket: RoadmapBucket | null; outcome: string | null; measure: string | null },
): RoadmapWriteDecision[] {
  const decisions: RoadmapWriteDecision[] = [];
  // Normalize so the returned decisions are canonical (a move never carries "  x  "), independent of
  // the insert path which also normalizes.
  const outcome = norm(next.outcome);
  const measure = norm(next.measure);
  const bucketChanged = prev.bucket !== next.bucket;
  const fieldsChanged = norm(prev.outcome) !== outcome || norm(prev.measure) !== measure;

  if (bucketChanged) {
    decisions.push({
      action: "move",
      fromBucket: prev.bucket,
      toBucket: next.bucket,
      outcome,
      measure,
    });
  }
  // A (re)declaration of an outcome on a live commitment is a "commit", recorded ALSO alongside a
  // move (NOT else-if): the live-why summary reads commit rows, never move rows, so a single call
  // that both relocates AND re-declares would otherwise lose the new outcome. A pure clear (no
  // outcome left) and edits on a backlog item are not roadmap decisions and produce no row.
  if (fieldsChanged && next.bucket != null && outcome != null) {
    decisions.push({
      action: "commit",
      fromBucket: next.bucket,
      toBucket: next.bucket,
      outcome,
      measure,
    });
  }
  return decisions;
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
