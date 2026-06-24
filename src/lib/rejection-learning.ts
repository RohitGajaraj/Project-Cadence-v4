// CORE-UX-TRUST (#10) — visible rejection-learning (the autonomous slice).
//
// When you REJECT an agent's proposed action, that correction is signal. This pure
// module turns your past rejections into a per-(agent, tool) tally so the approval
// queue can show, at the point of decision, "you've declined this 3 times before" —
// making your boundaries visible and registered instead of the agent silently
// re-asking. (Actually SUPPRESSING a repeatedly-declined gate is a loop approval-mode
// change in the pinned chokepoint + a founder-gated behavior call; this is the
// visible, honest half.)
//
// Pure + dependency-free: grouped/counted over plain rows, unit-tested without a DB.

export type RejectionRow = {
  agent_slug: string | null;
  tool_name: string | null;
  status: string;
  decision_reason?: string | null;
  decided_at?: string | null;
};

export type RejectionPattern = {
  agentSlug: string | null;
  toolName: string | null;
  count: number;
  /** the most recent decline reason for this (agent, tool), when recorded. */
  lastReason: string | null;
  lastAt: string | null;
};

const REJECTED = new Set(["rejected"]);
// NUL separator: cannot appear in a slug/tool name, so the key is unambiguous.
const SEP = "\u0000";

export function rejectionKey(
  agentSlug: string | null | undefined,
  toolName: string | null | undefined,
): string {
  return `${agentSlug ?? ""}${SEP}${toolName ?? ""}`;
}

/**
 * Tally the caller's REJECTED decisions per (agent, tool). Only `rejected` rows count
 * (approved/executed/failed are not declines). Keyed by the composite key so a pending
 * gate can look up its own history. The most recent reason/time is kept per pair.
 */
export function summarizeRejections(rows: RejectionRow[]): Record<string, RejectionPattern> {
  const out: Record<string, RejectionPattern> = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !REJECTED.has((r.status ?? "").trim().toLowerCase())) continue;
    const key = rejectionKey(r.agent_slug, r.tool_name);
    const at = r.decided_at ?? null;
    const reason = (r.decision_reason ?? "").trim() || null;
    const cur = out[key];
    if (!cur) {
      out[key] = {
        agentSlug: r.agent_slug ?? null,
        toolName: r.tool_name ?? null,
        count: 1,
        lastReason: reason,
        lastAt: at,
      };
    } else {
      cur.count += 1;
      // keep the most recent reason/time (rows may arrive in any order).
      if (at && (!cur.lastAt || at > cur.lastAt)) {
        cur.lastAt = at;
        cur.lastReason = reason;
      }
    }
  }
  return out;
}

/** How many times this exact (agent, tool) has been declined before. */
export function rejectionCountFor(
  byKey: Record<string, RejectionPattern> | null | undefined,
  agentSlug: string | null | undefined,
  toolName: string | null | undefined,
): number {
  if (!byKey) return 0;
  return byKey[rejectionKey(agentSlug, toolName)]?.count ?? 0;
}

/** The number of distinct (agent, tool) boundaries the caller has set by declining. */
export function rejectionPatternCount(byKey: Record<string, RejectionPattern> | null | undefined): number {
  return byKey ? Object.keys(byKey).length : 0;
}
