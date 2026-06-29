/**
 * Signal Fabric - the source taxonomy and the candidate contract.
 *
 * Every signal that enters Cadence comes from exactly one SourceKind, and every
 * writer hands the sink (`writeSignals`, sink.server.ts) a SignalCandidate rather
 * than building a `signals` row by hand. This is the one place the shape of an
 * inbound signal is defined, so dedup + injection-screening + normalization happen
 * once, for every source, instead of being re-implemented (or forgotten) per
 * connector. Client-safe (types only, no server imports).
 */
import type { Sentiment } from "@/lib/sensing/normalize";

/** The kind of source a signal originated from (stamped onto signals.source_kind). */
export type SourceKind =
  | "pull_connector" // registry-backed provider; creds via resolveProviderAuth (github, intercom…)
  | "web_scout" // the Scout/watchtower: diffed web targets (competitor, market, …)
  | "mcp_source" // one adapter, N external MCP servers (Phase 3)
  | "webhook" // inbound push via ingest_tokens
  | "manual"; // human-entered / DEMO_FEED

/** Runtime list of every kind - mirrors the DB CHECK on signals.source_kind. */
export const SOURCE_KINDS: readonly SourceKind[] = [
  "pull_connector",
  "web_scout",
  "mcp_source",
  "webhook",
  "manual",
] as const;

/**
 * One inbound signal, source-agnostic. A producer fills this; the sink decides
 * whether to screen (untrusted), how to dedup (externalId), and how to normalize
 * (tags/sentiment fall back to the rule-based tagger when omitted).
 */
export type SignalCandidate = {
  /** Stable id for idempotency. When set, the partial unique index makes re-emits no-ops. */
  externalId?: string | null;
  /** Channel token written to signals.source (e.g. "github", "intercom", "scout_competitor"). */
  source: string;
  /** Which lane of the fabric this came from. */
  sourceKind: SourceKind;
  title: string;
  /** signals.content is NOT NULL; the sink falls back to title when this is empty. */
  content: string;
  url?: string | null;
  /** Optional; when omitted the sink derives tags via autoTag(). */
  tags?: string[];
  /** Optional; when omitted the sink derives sentiment via inferSentiment(). */
  sentiment?: Sentiment;
  /** When true, the sink runs the prompt-injection screen before storing (web/MCP/webhook). */
  untrusted?: boolean;
};

/** Outcome of one writeSignals() call. */
export type SinkResult = {
  inserted: number;
  /** Already-present rows skipped by external_id dedup (stored + within-batch). */
  skipped: number;
  /** Structural injections rejected by the screen (never stored). */
  quarantined: number;
};
