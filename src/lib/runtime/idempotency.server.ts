/**
 * Idempotency helper — DB-backed dedup for cron ticks and tool executions.
 * Backed by the `idempotency_keys` table (UNIQUE on (scope, key)).
 *
 * Usage:
 *   const { result, cached } = await withIdempotency(supabase, "tool", key, userId, runId, async () => {
 *     return await actuallyExpensiveOp();
 *   });
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IdempotencyOutcome<T> = { result: T; cached: boolean };

export async function withIdempotency<T>(
  supabase: SupabaseClient,
  scope: string,
  key: string,
  userId: string | null,
  runId: string | null,
  fn: () => Promise<T>,
): Promise<IdempotencyOutcome<T>> {
  // Fast-path: existing key → return cached result.
  const { data: existing } = await supabase
    .from("idempotency_keys")
    .select("result")
    .eq("scope", scope)
    .eq("key", key)
    .maybeSingle();
  if (existing) {
    return { result: existing.result as T, cached: true };
  }

  // Execute the work first, then store. If insert collides (parallel runner
  // beat us to it), prefer the stored result so callers see a single outcome.
  const result = await fn();
  const { error } = await supabase.from("idempotency_keys").insert({
    scope,
    key,
    user_id: userId,
    run_id: runId,
    result: (result ?? null) as unknown as Record<string, unknown> | null,
  });
  if (error && !/duplicate key|unique/i.test(error.message)) {
    // Non-conflict insert failure shouldn't break the caller — log + return.
    console.error("[idempotency] insert failed:", error.message);
    return { result, cached: false };
  }
  if (error) {
    const { data: raced } = await supabase
      .from("idempotency_keys")
      .select("result")
      .eq("scope", scope)
      .eq("key", key)
      .maybeSingle();
    if (raced) return { result: raced.result as T, cached: true };
  }
  return { result, cached: false };
}
