/**
 * Phase 3: per-IP rate limiting for the public shareable-decision page.
 *
 * Caps anonymous /d/<slug> reads (getPublicDecision) per client IP in a rolling
 * window, mirroring KI-10's ingest limiter (src/lib/ingest-ratelimit.server.ts).
 * Slugs are unguessable 32-hex CSPRNG values, so this guards against abuse / DoS
 * of the public SSR read, NOT slug enumeration.
 *
 * Limit: 600 reads / 1-hour rolling window per IP (~10/min sustained). That stays
 * invisible to real viral traffic (a shared link spreads across many distinct IPs)
 * and to a NAT'd office, but caps a single hammering client. Tunable via the constants.
 *
 * Fails OPEN: any DB error (or a limiter-table outage) allows the read, because a
 * rate limiter must never be the reason a legitimate shared link reads "not available".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const LIMIT_PER_WINDOW = 600;
export const WINDOW_DURATION_MS = 3600 * 1000; // 1 hour

type RateLimitRow = { id: string; request_count: number; window_start: string };

export type RateLimitDecision =
  | { kind: "reset" }
  | { kind: "increment"; id: string; nextCount: number }
  | { kind: "block"; retryAfterSeconds: number };

/**
 * Pure policy: given the current row (or null) and the clock, decide the action.
 * Extracted from the DB wrapper so the window/limit edges are unit-tested without
 * a Supabase connection (the repo's "pure logic gets a bun test" convention).
 */
export function decidePublicReadRateLimit(
  row: RateLimitRow | null,
  nowMs: number,
  limit = LIMIT_PER_WINDOW,
  windowMs = WINDOW_DURATION_MS,
): RateLimitDecision {
  // A window exactly windowMs old (or older), or no row at all, starts fresh.
  const windowExpired = !row || new Date(row.window_start).getTime() <= nowMs - windowMs;
  if (windowExpired) return { kind: "reset" };

  if (row.request_count >= limit) {
    const windowEndMs = new Date(row.window_start).getTime() + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000));
    return { kind: "block", retryAfterSeconds };
  }

  return { kind: "increment", id: row.id, nextCount: row.request_count + 1 };
}

/**
 * Enforce the per-IP cap. Returns { allowed: true } within budget, or
 * { allowed: false, retryAfterSeconds } when the IP has exceeded the window.
 * Fails open on any error.
 */
export async function checkPublicDecisionRateLimit(
  db: SupabaseClient,
  clientIp: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  try {
    const { data: row, error: getError } = await db
      .from("public_decision_rate_limits")
      .select("id,request_count,window_start")
      .eq("client_ip", clientIp)
      .maybeSingle();
    if (getError) throw new Error(getError.message);

    const decision = decidePublicReadRateLimit((row as RateLimitRow | null) ?? null, nowMs);

    if (decision.kind === "block") {
      return { allowed: false, retryAfterSeconds: decision.retryAfterSeconds };
    }

    if (decision.kind === "reset") {
      // onConflict on the UNIQUE client_ip so a window reset UPDATES the existing
      // row instead of inserting a duplicate (the conflict target is not the PK).
      const { error } = await db
        .from("public_decision_rate_limits")
        .upsert(
          { client_ip: clientIp, request_count: 1, window_start: nowIso, updated_at: nowIso },
          { onConflict: "client_ip" },
        );
      if (error) throw new Error(error.message);
      return { allowed: true };
    }

    // increment: within the window and under the cap.
    const { error } = await db
      .from("public_decision_rate_limits")
      .update({ request_count: decision.nextCount, updated_at: nowIso })
      .eq("id", decision.id);
    if (error) throw new Error(error.message);
    return { allowed: true };
  } catch (error) {
    console.warn(
      "[decisions-ratelimit] DB error, allowing read:",
      error instanceof Error ? error.message : error,
    );
    return { allowed: true };
  }
}
