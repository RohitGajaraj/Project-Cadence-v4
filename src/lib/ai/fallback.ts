/**
 * PROVIDER-FALLBACK (considerations.md #4: provider/model outage degrades, not hard-fails).
 *
 * Generalizes the chokepoint's single `fallbackModel` retry into an ordered fallback CHAIN:
 * after the primary model exhausts its retries, the runtime walks this chain, attempting each
 * model until one succeeds, so a single down model (or a flag-enabled cross-model degrade)
 * no longer hard-fails the call. This module is the PURE, deterministic chain builder only;
 * the runtime (runtime.server.ts) owns the I/O, the env flag, and the surface guard.
 *
 * Pure (no IO). Unit-tested in fallback.test.ts.
 */

/**
 * Build the ordered list of models to try AFTER the primary, given the caller's explicit
 * fallback(s) and an optional auto-fallback (the runtime supplies the cheapest live model when
 * the AI_PROVIDER_FALLBACK flag is on and the surface is safe to swap). The result is:
 *   - ordered: explicit fallbacks first (caller intent wins), then the auto-fallback;
 *   - de-duplicated; and
 *   - never includes the primary model (a fallback to the model that just failed is pointless).
 *
 * Back-compat: a single `fallbackModel` (the legacy field) yields a one-element chain, identical
 * to the pre-PROVIDER-FALLBACK behavior. `fallbackModels` (the new ordered list) takes
 * precedence when both are set.
 */
export function resolveFallbackChain(
  primaryModel: string,
  opts: { fallbackModels?: string[]; fallbackModel?: string; autoFallback?: string | null },
): string[] {
  const explicit =
    opts.fallbackModels && opts.fallbackModels.length > 0
      ? opts.fallbackModels
      : opts.fallbackModel
        ? [opts.fallbackModel]
        : [];
  const candidates = [...explicit, ...(opts.autoFallback ? [opts.autoFallback] : [])];
  const seen = new Set<string>([primaryModel]);
  const chain: string[] = [];
  for (const m of candidates) {
    if (m && !seen.has(m)) {
      seen.add(m);
      chain.push(m);
    }
  }
  return chain;
}
