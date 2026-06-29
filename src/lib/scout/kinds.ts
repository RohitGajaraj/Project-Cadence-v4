/**
 * SF-SCOUT (Signal Fabric Phase 1) — the watch-target taxonomy.
 *
 * The Scout / Watchtower monitors a small set of outside-in web targets and emits
 * a signal ONLY when one of them actually changes vs the last snapshot. Every target
 * belongs to exactly one WatchKind; this is the one place the per-kind defaults
 * (the signals.source label, the base tags, the default cadence, and whether the
 * kind is fetched as a single URL or resolved via web search) are defined.
 *
 * PURE + client-safe: types and constants only, no server imports, no I/O. Mirrors
 * the role of src/lib/sources/kinds.ts for the sink. The Scout always emits through
 * the keystone writeSignals with sourceKind:"web_scout" and untrusted:true.
 */

/** The six outside-in surfaces the Scout watches. Mirrors the DB CHECK on scout_targets.kind. */
export type WatchKind =
  | "competitor-surface" // a competitor's pricing/changelog/landing page (URL diff)
  | "market-news" // market + category news (search query)
  | "social-reviews" // reviews / social chatter (search query)
  | "hiring" // a careers/jobs page (URL diff — headcount signals strategy)
  | "tech-platform-shift" // an API/SDK/platform changelog or deprecation page (URL diff)
  | "regulatory-compliance"; // regulatory / compliance news (search query)

/** Runtime list of every kind — mirrors the DB CHECK on scout_targets.kind. */
export const WATCH_KINDS: readonly WatchKind[] = [
  "competitor-surface",
  "market-news",
  "social-reviews",
  "hiring",
  "tech-platform-shift",
  "regulatory-compliance",
] as const;

/** How often a target is re-checked (DB CHECK on scout_targets.cadence). */
export type Cadence = "hourly" | "daily" | "weekly";

/** Per-kind defaults. `strategy` decides how the surface is fetched:
 *  'fetch' = a single URL diffed via webFetch; 'search' = a web-search query whose
 *  top-N results are joined and diffed. fetchTarget falls back gracefully when a
 *  target only carries the other of url/query (the DB CHECK guarantees at least one). */
export interface KindSpec {
  /** signals.source token written for this kind (e.g. "scout_competitor"). */
  sourceLabel: string;
  /** Tags always attached to a signal from this kind (the sink keeps producer tags). */
  baseTags: string[];
  /** Cadence a new target of this kind defaults to. */
  defaultCadence: Cadence;
  /** Whether the kind is primarily a single-URL diff or a search-query diff. */
  strategy: "fetch" | "search";
}

export const KIND_SPECS: Record<WatchKind, KindSpec> = {
  "competitor-surface": {
    sourceLabel: "scout_competitor",
    baseTags: ["scout", "competitor"],
    defaultCadence: "daily",
    strategy: "fetch",
  },
  "market-news": {
    sourceLabel: "scout_news",
    baseTags: ["scout", "market"],
    defaultCadence: "daily",
    strategy: "search",
  },
  "social-reviews": {
    sourceLabel: "scout_reviews",
    baseTags: ["scout", "reviews"],
    defaultCadence: "weekly",
    strategy: "search",
  },
  hiring: {
    sourceLabel: "scout_hiring",
    baseTags: ["scout", "hiring"],
    defaultCadence: "weekly",
    strategy: "fetch",
  },
  "tech-platform-shift": {
    sourceLabel: "scout_platform",
    baseTags: ["scout", "platform"],
    defaultCadence: "weekly",
    strategy: "fetch",
  },
  "regulatory-compliance": {
    sourceLabel: "scout_regulatory",
    baseTags: ["scout", "regulatory"],
    defaultCadence: "weekly",
    strategy: "search",
  },
};

/** The signals.source token for a kind (e.g. "scout_competitor"). */
export function sourceLabelFor(kind: WatchKind): string {
  return KIND_SPECS[kind].sourceLabel;
}

/** Milliseconds in one cadence period. Used to compute the next check time + backoff. */
export function cadenceToMs(c: Cadence): number {
  switch (c) {
    case "hourly":
      return 3_600_000; // 1h
    case "daily":
      return 86_400_000; // 24h
    case "weekly":
      return 604_800_000; // 7d
  }
}
