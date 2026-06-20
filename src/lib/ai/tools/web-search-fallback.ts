// FIRECRAWL-FLOOR - the pure, client-safe core of the web-search autonomy floor.
//
// The agent's web search must not hard-depend on a single paid provider. This
// module holds the provider-agnostic decision logic (which backend to use) and
// the SearXNG response normalization, kept out of the .server shell so it is
// unit-testable with no network or env. The BBI doctrine: a zero-external-paid-
// dep native default (self-hosted SearXNG) must always be able to hold the floor.

/** The web-search backend resolved from the environment. "none" means neither a
 *  paid Firecrawl key nor a self-host SearXNG URL is configured. */
export type WebBackend = "firecrawl" | "searxng" | "none";

/** A single web search result. Defined here (the dependency-free module) and
 *  re-exported by firecrawl.server.ts so existing importers are unaffected. */
export type WebSearchHit = {
  url: string;
  title: string;
  description: string;
  markdown?: string;
};

/** Resolve the web-search backend by precedence: a configured Firecrawl key wins
 *  (the existing path stays byte-identical), else a self-host SearXNG URL is the
 *  native floor, else "none". A blank/whitespace-only value counts as unset, so a
 *  stray empty env var never selects a backend that will then fail every call. */
export function selectWebBackend(env: {
  FIRECRAWL_API_KEY?: string | null;
  SEARXNG_URL?: string | null;
}): WebBackend {
  if (nonBlank(env.FIRECRAWL_API_KEY)) return "firecrawl";
  if (nonBlank(env.SEARXNG_URL)) return "searxng";
  return "none";
}

function nonBlank(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Map a Firecrawl-style recency window to a SearXNG `time_range` value. SearXNG
 *  accepts exactly day|week|month|year; anything else is omitted (no filter)
 *  rather than sent and rejected. */
export function mapRecencyToTimeRange(
  recency?: "day" | "week" | "month" | "year",
): "day" | "week" | "month" | "year" | undefined {
  if (recency === "day" || recency === "week" || recency === "month" || recency === "year") {
    return recency;
  }
  return undefined;
}

/** Clamp a search limit to the same 1..10 envelope the Firecrawl path enforces,
 *  so the fallback never asks for an unbounded or zero result set. */
export function clampLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 5;
  return Math.min(10, Math.max(1, Math.floor(limit)));
}

/** Build a SearXNG JSON search URL. Pure: trims a trailing slash on the base,
 *  caps the query length (mirrors the Firecrawl path), url-encodes every param,
 *  and adds `time_range` only when a valid recency was given. */
export function buildSearxngQueryUrl(
  base: string,
  opts: { query: string; limit?: number; recency?: "day" | "week" | "month" | "year" },
): string {
  const root = base.trim().replace(/\/+$/, "");
  const params = new URLSearchParams({
    q: (opts.query ?? "").slice(0, 300),
    format: "json",
  });
  const tr = mapRecencyToTimeRange(opts.recency);
  if (tr) params.set("time_range", tr);
  return `${root}/search?${params.toString()}`;
}

function clip(s: string | undefined | null, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "..." : s;
}

type SearxngRaw = {
  results?: Array<{ url?: unknown; title?: unknown; content?: unknown }>;
};

/** Normalize a SearXNG `/search?format=json` body into WebSearchHit[]. Defensive
 *  against the `unknown` wire shape: a non-array `results`, missing/non-string
 *  fields, and url-less rows are all dropped rather than throwing. SearXNG returns
 *  snippets (`content`), not page markdown, so the fallback never fabricates a
 *  `markdown` field - the agent gets honest search results, not scraped bodies. */
export function normalizeSearxngResults(raw: unknown, opts?: { limit?: number }): WebSearchHit[] {
  const body = (raw ?? {}) as SearxngRaw;
  const rows = Array.isArray(body.results) ? body.results : [];
  const limit = clampLimit(opts?.limit);
  const hits: WebSearchHit[] = [];
  for (const r of rows) {
    const url = typeof r?.url === "string" ? r.url : "";
    if (!url) continue;
    hits.push({
      url,
      title: clip(typeof r?.title === "string" ? r.title : "", 200),
      description: clip(typeof r?.content === "string" ? r.content : "", 400),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
