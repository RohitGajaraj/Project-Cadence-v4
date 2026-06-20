/**
 * F-V5-INGEST-WEBHOOK — Rate limiting for the public ingest endpoint.
 *
 * KI-10 — per-token cap to prevent abuse of the public /api/public/ingest-signals
 * endpoint. Implements a rolling-window counter in the ingest_rate_limits table.
 *
 * Limits: 100 signals per 1 hour per token (rolling window).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const LIMIT_PER_HOUR = 100;
const WINDOW_DURATION_MS = 3600 * 1000; // 1 hour

/**
 * Check if a token has exceeded its rate limit.
 * Returns { allowed: true } if within limit, { allowed: false, retryAfterSeconds: n } if over limit.
 */
export async function checkIngestRateLimit(
  db: SupabaseClient,
  tokenId: string
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const now = new Date().toISOString();
  const windowStart = new Date(Date.now() - WINDOW_DURATION_MS).toISOString();

  try {
    // Get the current request count in the active window
    const { data: record, error: getError } = await db
      .from("ingest_rate_limits")
      .select("id,request_count,window_start")
      .eq("token_id", tokenId)
      .single();

    if (getError && getError.code !== "PGRST116") {
      // PGRST116 = not found, which is expected for new tokens
      throw new Error(getError.message);
    }

    // Check if we need to reset the window
    const shouldReset = !record || new Date(record.window_start) < new Date(windowStart);

    if (shouldReset) {
      // Start a new window. Resolve the conflict on token_id (the UNIQUE key), not
      // the PK: the row already exists for a returning token, so without
      // onConflict:'token_id' PostgREST tries a fresh INSERT, violates UNIQUE
      // (token_id), errors, and the catch below fails OPEN — i.e. the limiter
      // silently stops enforcing for that token after its first window. The
      // trailing .eq() on an upsert was a no-op and is removed.
      const { error: upsertError } = await db.from("ingest_rate_limits").upsert(
        {
          token_id: tokenId,
          request_count: 1,
          window_start: now,
          updated_at: now,
        },
        { onConflict: "token_id" },
      );

      if (upsertError) throw new Error(upsertError.message);

      return { allowed: true };
    }

    // Check if we're over the limit
    if (record.request_count >= LIMIT_PER_HOUR) {
      // Calculate when the window expires
      const windowEnd = new Date(new Date(record.window_start).getTime() + WINDOW_DURATION_MS);
      const retryAfterSeconds = Math.ceil((windowEnd.getTime() - Date.now()) / 1000);

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }

    // Increment the counter
    const { error: incrementError } = await db
      .from("ingest_rate_limits")
      .update({
        request_count: record.request_count + 1,
        updated_at: now,
      })
      .eq("id", record.id);

    if (incrementError) throw new Error(incrementError.message);

    return { allowed: true };
  } catch (error) {
    // On any DB error, allow the request (fail open, but log)
    console.warn("[ingest-ratelimit] DB error, allowing request:", error instanceof Error ? error.message : error);
    return { allowed: true };
  }
}
