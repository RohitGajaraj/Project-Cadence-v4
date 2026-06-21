// PLG Phase 3 — the pure core of the memory-retention upgrade nudge.
//
// The free plan keeps decision memory on a rolling `FREE_MEMORY_RETENTION_DAYS`
// window, then it fades; paid plans keep it forever (it starts to compound). This
// is the moat made tangible at the moment it matters: when a free user's own
// accumulated memory is about to age past that window, a calm banner surfaces the
// upgrade value. Honest by construction — it reflects the plan's stated retention,
// gates to free tier only, and fires ONLY when memory is genuinely near/past the
// limit (never an always-on nag, per the Today calm doctrine).
//
// SERVER-FREE + totally defined: any field may be missing and it still computes.
// `nowMs` is injected so the assessment is deterministic + unit-testable.

const DAY_MS = 86_400_000;

/** The minimal memory shape this needs (a subset of `agent_memory`). */
export type MemoryExpiryRow = {
  created_at: string | null;
  /** Set once the retention writer / founder expiry-flip stamps it; null before then. */
  expires_at: string | null;
};

export type MemoryExpiryState = {
  /** Whether to render the banner at all. */
  show: boolean;
  /** Total memories in scope (the workspace's). */
  total: number;
  /** The plan's retention window in days; null on a paid plan (memory never fades). */
  retentionDays: number | null;
  /** Memories whose effective fade date is within the warning window (incl. already past). */
  expiringCount: number;
  /** Whole days until the SOONEST fade (0 = at/over the limit now); null when nothing is at risk. */
  soonestDays: number | null;
};

/** Parse an ISO timestamp to ms, or null if absent/invalid. */
function ms(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || !iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * The effective fade instant for one memory: its stamped `expires_at` if present,
 * else the plan-implied fade (`created_at + retentionDays`). Null when neither is
 * knowable (undated row) so it is never counted as at-risk on a guess.
 */
function effectiveFadeMs(row: MemoryExpiryRow, retentionDays: number): number | null {
  const exp = ms(row?.expires_at);
  if (exp !== null) return exp;
  const created = ms(row?.created_at);
  return created === null ? null : created + retentionDays * DAY_MS;
}

/**
 * PURE. Assess whether the free-tier memory-retention nudge should show.
 *
 *  - Paid (`retentionDays === null`): never shows (memory never fades).
 *  - Free: shows only when at least one memory's effective fade date is within
 *    `warnWithinDays` of now (or already past) — honest urgency, not an always-on
 *    banner. `soonestDays` is clamped to >= 0 so an over-the-limit memory reads "now".
 */
export function assessMemoryExpiry(opts: {
  memories: MemoryExpiryRow[] | null | undefined;
  retentionDays: number | null;
  nowMs: number;
  warnWithinDays?: number;
}): MemoryExpiryState {
  const memories = Array.isArray(opts?.memories) ? opts.memories : [];
  const total = memories.length;
  const retentionDays = opts?.retentionDays ?? null;
  const warnWithinDays = opts?.warnWithinDays ?? 7;

  // Paid plan: memory persists, nothing to nudge.
  if (retentionDays === null) {
    return { show: false, total, retentionDays: null, expiringCount: 0, soonestDays: null };
  }

  const cutoff = opts.nowMs + warnWithinDays * DAY_MS;
  let expiringCount = 0;
  let soonestFade: number | null = null;
  for (const m of memories) {
    const fade = effectiveFadeMs(m, retentionDays);
    if (fade === null) continue;
    if (fade <= cutoff) {
      expiringCount++;
      if (soonestFade === null || fade < soonestFade) soonestFade = fade;
    }
  }

  if (expiringCount === 0) {
    return { show: false, total, retentionDays, expiringCount: 0, soonestDays: null };
  }

  const soonestDays = Math.max(0, Math.ceil((soonestFade! - opts.nowMs) / DAY_MS));
  return { show: true, total, retentionDays, expiringCount, soonestDays };
}
