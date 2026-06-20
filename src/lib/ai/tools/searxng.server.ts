/**
 * SearXNG client - the native, self-host web-search backend behind FIRECRAWL-FLOOR.
 *
 * SearXNG is a zero-external-paid-dependency metasearch engine the operator runs
 * themselves (set SEARXNG_URL to the instance). It is the autonomy floor: when no
 * paid Firecrawl key is configured, the agent's `web.search` still works against
 * the self-hosted instance. SearXNG only searches (returns snippets), so this is
 * a search backend, not a scraper - webFetch/webMap/webCrawl have no SearXNG
 * equivalent and remain Firecrawl-only.
 *
 * Reads SEARXNG_URL from process.env on every call (Cloudflare Workers must not
 * capture a stale value at module load), mirroring firecrawl.server.ts.
 */
import {
  buildSearxngQueryUrl,
  normalizeSearxngResults,
  type WebSearchHit,
} from "@/lib/ai/tools/web-search-fallback";

/** Search via the self-hosted SearXNG instance. Throws a clear error if the
 *  instance is unreachable or errors - the caller (webSearch) surfaces it to the
 *  agent loop the same way a Firecrawl error is surfaced. */
export async function searxngSearch(opts: {
  query: string;
  limit?: number;
  recency?: "day" | "week" | "month" | "year";
}): Promise<{ query: string; results: WebSearchHit[] }> {
  const base = process.env.SEARXNG_URL;
  if (!base || base.trim().length === 0) {
    // Defensive: webSearch only routes here after selectWebBackend resolved
    // "searxng", but never assume the env survived the round trip.
    throw new Error("SearXNG is not configured: SEARXNG_URL is missing.");
  }
  const url = buildSearxngQueryUrl(base, opts);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`SearXNG ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json().catch(() => ({}));
  return { query: opts.query, results: normalizeSearxngResults(json, { limit: opts.limit }) };
}
