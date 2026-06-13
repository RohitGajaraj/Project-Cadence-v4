/**
 * Hop-failure retry policy (v6 Phase 1 — "the loop runs itself").
 *
 * Pure, DB-free decision logic. The mission reflector (`mission-advance.server`)
 * calls these when a child run for a `mission_steps` row ends failed/halted, to
 * decide whether to re-dispatch the step (bounded) and when. Kept pure so the
 * policy is unit-testable without a Supabase round-trip (`bun test`).
 *
 * `attempts` is the number of times the step has been DISPATCHED, counting the
 * attempt that just failed. With the default ceiling of 2 that means one
 * automatic retry; raise `mission_steps.max_attempts` to allow more.
 */
export const DEFAULT_MAX_ATTEMPTS = 2;
/** Delay before the first retry; doubles each subsequent attempt. */
export const RETRY_BASE_MS = 30_000;

export type StepRetryInput = {
  /** Dispatch count so far, including the failure being judged. */
  attempts: number;
  /** Per-step ceiling; <= 0 falls back to DEFAULT_MAX_ATTEMPTS. */
  maxAttempts: number;
};

export function shouldRetryStep(input: StepRetryInput): boolean {
  const ceiling = input.maxAttempts > 0 ? input.maxAttempts : DEFAULT_MAX_ATTEMPTS;
  return input.attempts < ceiling;
}

/** Exponential backoff: `baseMs * 2^(attempts-1)`; attempts floored at 1. */
export function backoffMs(attempts: number, baseMs: number = RETRY_BASE_MS): number {
  const n = Math.max(1, attempts);
  return baseMs * 2 ** (n - 1);
}

/** ISO timestamp `backoffMs(attempts)` after `nowMs` — when the retry becomes eligible. */
export function nextRetryAtIso(
  nowMs: number,
  attempts: number,
  baseMs: number = RETRY_BASE_MS,
): string {
  return new Date(nowMs + backoffMs(attempts, baseMs)).toISOString();
}
