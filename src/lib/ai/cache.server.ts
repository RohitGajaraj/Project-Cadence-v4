/**
 * Response cache for repeated identical AI calls.
 *
 * A content-hash cache serves repeated identical calls (same model + messages +
 * responseFormat) from cache, avoiding a provider call and its full COGS. This
 * is a direct margin win that, unlike routing, never overrides the caller's
 * model choice, so it is safer to apply broadly.
 *
 * Caching logic:
 * - Cache key: SHA256 hash of (model, normalized messages, responseFormat)
 * - Store: ai_response_cache table with configurable TTL (default 7 days)
 * - Read: before the provider call; if cache hit, return cached response
 * - Write: after a successful provider call; record the response + metadata
 * - Observe: ai_events records cache_hit/cache_miss for visibility
 *
 * Invalidation safety:
 * - Skip caching for JSON responses (user-personalized, non-deterministic)
 * - Skip caching if retrieval is enabled (context changes invalidate cache)
 * - Skip caching if no guardrails (we trust cached prose output)
 * - Always recompute the hash at lookup time (never stale key)
 *
 * Limitations:
 * - Only caches prose responses (JSON skipped to keep it byte-exact)
 * - Not useful for streaming (streamed chunks are concatenated post-stream)
 * - Conservative scope: caches brief/scheduler/test only (judge/eval/embed excluded)
 *   to avoid caching reasoning models or benchmarks that should never cache
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CacheEntry = {
  id: string;
  user_id: string;
  model: string;
  cache_key: string;
  prompt_tokens: number;
  completion_tokens: number;
  output_text: string;
  created_at: string;
  expires_at: string;
};

/**
 * Generate a deterministic cache key for (model, messages, responseFormat).
 * Uses Web Crypto SHA-256 (a worker global — no node:crypto import that gets
 * externalized into the bundle, and no bare-"crypto" dynamic import whose runtime
 * resolution is uncertain). Mirrors the repo's hashing pattern (rag/indexer.server.ts).
 */
export async function generateCacheKey(
  model: string,
  messages: { role: string; content: string }[],
  responseFormat?: string,
): Promise<string> {
  const msg = JSON.stringify({ model, messages, responseFormat });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Check if a call should be cached. Returns false for:
 * - JSON responses (must stay byte-exact for JSON.parse)
 * - Retrieval-enabled calls (context changes invalidate cache)
 * - Calls without guardrails (we trust guardrail-processed output)
 * - Non-cacheable surfaces (judge, eval, embed)
 */
export function shouldCacheCall(
  surface: string,
  retrieval: boolean | { k?: number; sourceKinds?: string[] } | undefined,
  guardrails: boolean | undefined,
  responseFormat?: string,
): boolean {
  // No JSON responses (must be byte-exact)
  if (responseFormat === "json_object") return false;

  // No retrieval (context changes invalidate cache)
  if (retrieval) return false;

  // Require guardrails (we trust the guardrail-processed output)
  if (guardrails === false) return false;

  // Conservative surface whitelist: only cache for routine surfaces
  const cacheableSurfaces = new Set(["brief", "scheduler", "test"]);
  if (!cacheableSurfaces.has(surface)) return false;

  return true;
}

/**
 * Format a cached response as if it came from the provider, preserving token counts.
 * Used when a cache hit returns the original provider response structure.
 */
export function formatCachedResponse(entry: CacheEntry) {
  return {
    text: entry.output_text,
    in_tok: entry.prompt_tokens,
    out_tok: entry.completion_tokens,
    latency: 0, // Cache hits have near-zero latency; record as 0ms
  };
}

/**
 * Determine the cache TTL in seconds. Default 7 days; conservative to prevent stale output.
 */
export function cacheTtlSeconds(): number {
  return 7 * 24 * 60 * 60; // 7 days
}

/**
 * Try to read a cached response for a call. Returns the cached entry if valid,
 * null if cache miss or cache lookup fails (errors are logged and ignored).
 *
 * @param supabase - Supabase client (must be service-role for cache table access)
 * @param userId - User ID for the cache lookup
 * @param model - Model used in the call
 * @param cacheKey - SHA256 hash of (messages, responseFormat)
 * @returns CacheEntry or null
 */
export async function readCache(
  supabase: SupabaseClient,
  userId: string,
  model: string,
  cacheKey: string,
): Promise<CacheEntry | null> {
  try {
    const { data, error } = await supabase
      .from("ai_response_cache")
      .select("*")
      .eq("user_id", userId)
      .eq("model", model)
      .eq("cache_key", cacheKey)
      // WM-M15b fix: compare against a real ISO timestamp. The shipped version passed
      // the literal string "now()", which Postgres cannot cast to timestamptz, so the
      // query errored on every read and the cache always missed.
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("cache read failed:", error);
      return null;
    }
    return (data as CacheEntry | null) ?? null;
  } catch (e) {
    console.error("cache read exception:", e);
    return null;
  }
}

/**
 * Write a cache entry for a successful provider call. Errors are logged but ignored
 * (cache writes are best-effort and never block the call).
 *
 * @param supabase - Supabase client (must be service-role for cache table access)
 * @param userId - User ID for the cache entry
 * @param model - Model used in the call
 * @param cacheKey - SHA256 hash of (messages, responseFormat)
 * @param outputText - The provider's response text
 * @param promptTokens - Input token count
 * @param completionTokens - Output token count
 */
export async function writeCache(
  supabase: SupabaseClient,
  userId: string,
  model: string,
  cacheKey: string,
  outputText: string,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  try {
    const ttlSeconds = cacheTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await supabase.from("ai_response_cache").insert({
      user_id: userId,
      model,
      cache_key: cacheKey,
      output_text: outputText,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      expires_at: expiresAt,
    });
  } catch (e) {
    console.error("cache write failed:", e);
    // Errors are ignored; cache writes are best-effort
  }
}
