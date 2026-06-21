/**
 * H2-WRITES · Bulk roadmap re-prioritization (pure, no IO).
 *
 * The board moves one opportunity at a time (drag, or the per-card bucket
 * select). A senior PM re-sequencing the board wants to move a SET in one action
 * ("push these three from Now to Next"). This module owns the pure PLANNING of
 * such a batch: de-dup the selection, drop ids that aren't on the board or are
 * already in the target bucket (so the write fans out no phantom audit rows), and
 * cap the batch so a single write can't unbounded-fan-out. Kept IO-free so it is
 * unit-tested with no DB and imported by the server fn.
 *
 * Like the single-item drag, a bulk move is the LENIENT (place-first) path:
 * governance (a declared outcome AND measure) is still enforced PER ITEM by
 * commitRoadmapItem, and the gap surface keeps flagging each moved commitment
 * until it is declared — so bulk-move is not a governance bypass.
 */
import type { RoadmapBucket } from "@/lib/roadmap-governance";

/** Upper bound on one bulk move, so the `.in()` write + the audit loop stay bounded. */
export const BULK_MOVE_CAP = 200;

/** The minimal current-state shape the planner reads for each candidate id. */
export type BulkMoveItem = { id: string; bucket: RoadmapBucket | null };

/** One concrete move the write should apply + audit (prev bucket -> target). */
export type PlannedMove = {
  id: string;
  fromBucket: RoadmapBucket | null;
  toBucket: RoadmapBucket | null;
};

export type BulkMovePlan = {
  /** The real moves to apply (bucket actually changes), de-duplicated and capped. */
  moves: PlannedMove[];
  /** Selected ids already in the target bucket (a no-op, counted as skipped). */
  skippedNoop: number;
  /** Selected ids not present in the board set (not owned / not loaded). */
  skippedUnknown: number;
  /** Candidate moves dropped because the batch exceeded the cap. */
  skippedOverCap: number;
};

/**
 * Plan a bulk move of `ids` into `target`. Pure + total.
 *
 * - De-dups `ids` (a doubled selection moves once, counted once).
 * - Resolves each id against `items`; an id absent from the board is dropped
 *   (`skippedUnknown`) — never invented as a move.
 * - Drops a no-op (already in `target`) so the audit trail gets no phantom move.
 * - Caps the result at `cap`; the overflow is reported, not silently lost.
 *
 * `moves` preserves the first-occurrence order of each id in `ids`.
 */
export function planBulkMove(
  ids: readonly string[],
  target: RoadmapBucket | null,
  items: readonly BulkMoveItem[],
  cap: number = BULK_MOVE_CAP,
): BulkMovePlan {
  const byId = new Map<string, BulkMoveItem>();
  for (const it of items) byId.set(it.id, it);

  const seen = new Set<string>();
  const candidates: PlannedMove[] = [];
  let skippedNoop = 0;
  let skippedUnknown = 0;

  for (const id of ids) {
    if (seen.has(id)) continue; // de-dup: a repeated id is one decision
    seen.add(id);
    const cur = byId.get(id);
    if (!cur) {
      skippedUnknown += 1;
      continue;
    }
    if (cur.bucket === target) {
      skippedNoop += 1;
      continue;
    }
    candidates.push({ id, fromBucket: cur.bucket, toBucket: target });
  }

  // A non-positive cap falls back to the default rather than dropping everything.
  const safeCap = cap > 0 ? cap : BULK_MOVE_CAP;
  const moves = candidates.slice(0, safeCap);
  const skippedOverCap = candidates.length - moves.length;

  return { moves, skippedNoop, skippedUnknown, skippedOverCap };
}
