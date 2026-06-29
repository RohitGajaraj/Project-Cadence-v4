/**
 * SF-SCOUT — fetch + snapshot persistence (server-only).
 *
 * Fetches a watch target's current surface (REUSING the firecrawl chokepoint —
 * webFetch for URL targets, webSearch for query targets, NEVER webCrawl in this
 * unattended path), and reads/writes the per-target snapshot history that the diff
 * compares against. The content hash is computed by the caller (diff.hashContent)
 * and passed in, so this module stays I/O-only.
 *
 * Untyped client cast (scout_* tables not in generated types yet) — same precedent
 * as github-ingest.server.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { webFetch, webSearch } from "@/lib/ai/tools/firecrawl.server";
import { KIND_SPECS } from "./kinds";
import type { ScoutTargetRow } from "./targets.server";

const db = supabaseAdmin as unknown as SupabaseClient;

/** Max chars pulled per fetch and kept as the snapshot excerpt. Bounded for cost. */
const FETCH_MAX_CHARS = 8_000;
/** Excerpt cap stored per snapshot. Exported so the tick diffs the same window. */
export const EXCERPT_CHARS = 2_000;
const SEARCH_RESULTS = 5;

/** A row of public.scout_snapshots. */
export interface SnapshotRow {
  id: string;
  target_id: string;
  workspace_id: string;
  content_hash: string;
  excerpt: string;
  char_count: number;
  fetched_url: string | null;
  status: number | null;
  fetched_at: string;
}

/** The freshly fetched surface, pre-hash. */
export interface FetchedSurface {
  url: string;
  title: string;
  markdown: string;
  status?: number;
  charCount: number;
}

/**
 * Fetch a target's current surface. The kind's strategy chooses the method, with a
 * graceful fallback to whichever of url/query the target actually carries (the DB
 * CHECK guarantees at least one):
 *   - search: join the top-N web-search results into a single markdown blob.
 *   - fetch:  scrape the single URL via Firecrawl.
 * NEVER calls webCrawl — that is unbounded and forbidden in the unattended path.
 */
export async function fetchTarget(t: ScoutTargetRow): Promise<FetchedSurface> {
  const spec = KIND_SPECS[t.kind];
  const query = (t.query ?? "").trim();
  const url = (t.url ?? "").trim();
  // Prefer the kind's strategy, but never pick a method the target can't satisfy.
  const useSearch = spec.strategy === "search" ? Boolean(query) : !url && Boolean(query);

  if (useSearch && query) {
    const { results } = await webSearch({ query, limit: SEARCH_RESULTS });
    const top = results.slice(0, SEARCH_RESULTS);
    const markdown = top
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.description ?? ""}\n${r.url}`)
      .join("\n\n");
    return {
      url: url || top[0]?.url || "",
      title: `Search: ${query.slice(0, 120)}`,
      markdown,
      status: undefined,
      charCount: markdown.length,
    };
  }

  if (url) {
    const r = await webFetch({ url, maxChars: FETCH_MAX_CHARS });
    return {
      url: r.url,
      title: r.title,
      markdown: r.markdown,
      status: r.status,
      charCount: r.markdown.length,
    };
  }

  // Unreachable given the DB CHECK (url IS NOT NULL OR query IS NOT NULL); defensive.
  throw new Error(`scout target ${t.id} has neither url nor query`);
}

/** The most recent snapshot for a target, or null when none exists (first sighting). */
export async function loadLastSnapshot(targetId: string): Promise<SnapshotRow | null> {
  const { data, error } = await db
    .from("scout_snapshots")
    .select("*")
    .eq("target_id", targetId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as SnapshotRow;
}

/** Persist the fetched surface as a snapshot (ALWAYS — the timeline is kept complete,
 *  even for unchanged checks). Returns the stored row. */
export async function storeSnapshot(
  t: ScoutTargetRow,
  f: FetchedSurface,
  hash: string,
): Promise<SnapshotRow> {
  const row = {
    target_id: t.id,
    workspace_id: t.workspace_id,
    content_hash: hash,
    excerpt: f.markdown.slice(0, EXCERPT_CHARS),
    char_count: f.charCount,
    fetched_url: f.url || null,
    status: f.status ?? null,
  };
  const { data, error } = await db.from("scout_snapshots").insert(row).select("*").single();
  if (error) throw new Error(`scout storeSnapshot failed: ${error.message}`);
  return data as unknown as SnapshotRow;
}
