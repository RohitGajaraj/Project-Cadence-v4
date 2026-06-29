/**
 * Platform-level provider credentials (server-only).
 *
 * Cadence powers its OWN internal AI actions (agent steps, daily briefs, idea
 * bucketing/clustering, research, the Critic, …) and, per the WM-M9 ruling, does so
 * on PLATFORM keys — not user-supplied ones. Model-agnosticism therefore lives here:
 * the platform operator can plug in ANY provider by setting two env vars / wrangler
 * secrets, with NO code change and NO consumer-facing BYOK surface.
 *
 * Convention (per provider id `<P>`, upper-cased, non-alphanumerics → `_`):
 *   AI_PROVIDER_<P>_KEY        the API key            (required to activate the provider)
 *   AI_PROVIDER_<P>_BASE_URL   the endpoint base URL  (optional; falls back to the
 *                              provider's built-in default in provider-route.ts)
 *
 * Examples:
 *   AI_PROVIDER_QWEN_KEY=sk-...           AI_PROVIDER_QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 *   AI_PROVIDER_GROQ_KEY=gsk_...          (base URL omitted → built-in default)
 *   AI_PROVIDER_OPENROUTER_KEY=sk-or-...
 *   AI_PROVIDER_LOCAL_KEY=ollama          AI_PROVIDER_LOCAL_BASE_URL=http://localhost:11434
 *
 * Secrets are env/wrangler only (never the client bundle, never a DB row), matching
 * the project's env-var split. The model CATALOG (which models exist, their pricing
 * and capabilities) is code-defined in models.ts; only the live credential lives here.
 */

/** Map a provider id to its env-var suffix (upper-case, non-alphanumerics → "_"). */
function envSuffix(provider: string): string {
  return provider
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

export type PlatformProviderKey = { apiKey: string; baseUrl: string | null };

/**
 * Resolve a platform credential for a provider id from env, or null when none is
 * configured. A provider is "platform-available" exactly when its `_KEY` is set.
 */
export function resolvePlatformProviderKey(provider: string): PlatformProviderKey | null {
  if (!provider) return null;
  const suffix = envSuffix(provider);
  const apiKey = process.env[`AI_PROVIDER_${suffix}_KEY`];
  if (!apiKey) return null;
  const baseUrl = process.env[`AI_PROVIDER_${suffix}_BASE_URL`] || null;
  return { apiKey, baseUrl };
}

/** True if the platform operator has configured a credential for this provider. */
export function isPlatformProviderConfigured(provider: string): boolean {
  return resolvePlatformProviderKey(provider) !== null;
}
