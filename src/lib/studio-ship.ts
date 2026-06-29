/**
 * BYO-P3 WI2 — Build-merge → PRD join (pure core).
 *
 * A PRD can spawn several studio changesets over its life (a revision, a
 * rollback, a follow-up). When the Ship → Learn loop asks "what shipped for
 * this PRD?", it wants the one that best represents the shipped state. This
 * module owns that selection so it is testable without a DB and reused by both
 * `getChangesetByPrd` and `recordOutcome`'s enrichment.
 */

export type ChangesetForPrd = {
  id: string;
  status: string;
  release_notes?: string | null;
  pr_number?: number | null;
  updated_at?: string | null;
};

// Higher rank = closer to "shipped". A merged change beats an open PR beats a
// committed-but-unmerged branch beats a staged draft.
const STATUS_RANK: Record<string, number> = {
  merged: 4,
  pr_open: 3,
  committed: 2,
  staged: 1,
  abandoned: 0,
};

function rank(status: string): number {
  return STATUS_RANK[status] ?? 0;
}

/**
 * Pick the changeset that best represents what shipped for a PRD: highest
 * status rank, breaking ties by most-recently updated. Abandoned changesets are
 * never chosen. Returns null when the list is empty or all are abandoned.
 */
export function pickChangesetForPrd<T extends ChangesetForPrd>(changesets: T[]): T | null {
  let best: T | null = null;
  for (const cs of changesets) {
    if (rank(cs.status) === 0) continue;
    if (!best) {
      best = cs;
      continue;
    }
    const r = rank(cs.status);
    const br = rank(best.status);
    if (r > br) {
      best = cs;
    } else if (r === br) {
      const t = new Date(cs.updated_at ?? 0).getTime();
      const bt = new Date(best.updated_at ?? 0).getTime();
      if (t > bt) best = cs;
    }
  }
  return best;
}
