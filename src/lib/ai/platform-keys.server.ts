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

/**
 * Returns the set of provider ids that have a platform key configured.
 * Safe to call from a server function — returns only provider names, never key material.
 */
export function listConfiguredPlatformProviders(): string[] {
  const candidates = [
    "anthropic",
    "openai",
    "google",
    "deepseek",
    "xai",
    "qwen",
    "groq",
    "mistral",
    "together",
    "openrouter",
    "moonshot",
    "minimax",
    "fireworks",
    "deepinfra",
    "cerebras",
    "perplexity",
    "ollama",
    "local",
  ];
  return candidates.filter((p) => isPlatformProviderConfigured(p));
}

/**
 * Tier-1 priority list for agentic work, ranked by tool-use accuracy + JSON output quality.
 * Covers every provider that has a known best model for structured agentic tasks.
 * New providers added here are immediately considered at runtime when their key is set
 * and are automatically considered by resolveBestAgentModelForUser (vault-aware version).
 */
export const AGENT_MODEL_PRIORITY: Array<{ provider: string; modelId: string }> = [
  { provider: "anthropic",  modelId: "anthropic/claude-haiku-4" },
  { provider: "openai",     modelId: "openai/gpt-4o-mini" },
  { provider: "qwen",       modelId: "qwen/qwen-plus" },
  { provider: "groq",       modelId: "groq/llama-3.3-70b-versatile" },
  { provider: "deepseek",   modelId: "deepseek/deepseek-chat" },
  { provider: "xai",        modelId: "xai/grok-2-1212" },
  { provider: "mistral",    modelId: "mistral/mistral-large-latest" },
  { provider: "moonshot",   modelId: "moonshot/moonshot-v1-128k" },
  { provider: "together",   modelId: "together/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" },
  { provider: "openrouter", modelId: "openrouter/openai/gpt-4o-mini" },
  { provider: "fireworks",  modelId: "fireworks/accounts/fireworks/models/llama-v3p1-70b-instruct" },
  { provider: "deepinfra",  modelId: "deepinfra/meta-llama/Meta-Llama-3.1-70B-Instruct" },
  { provider: "cerebras",   modelId: "cerebras/llama3.1-70b" },
  { provider: "perplexity", modelId: "perplexity/llama-3.1-sonar-large-128k-online" },
  { provider: "minimax",    modelId: "minimax/minimax-text-01" },
];

/**
 * Picks the best model available for agentic work at runtime.
 *
 * Resolution order:
 *   1. DEFAULT_AGENT_MODEL env var — operator pin, no redeploy needed, beats everything
 *   2. First provider in AGENT_MODEL_PRIORITY that has a configured key
 *   3. Any OTHER configured provider not yet in the priority list (future providers auto-work)
 *   4. Gemini 2.5 Flash via the Lovable managed gateway — zero-config but quota-limited
 */
export function resolveBestAgentModel(): string {
  const override = process.env.DEFAULT_AGENT_MODEL;
  if (override) return override;

  const prioritySet = new Set(AGENT_MODEL_PRIORITY.map((p) => p.provider));

  // Step 2: walk the curated list
  for (const { provider, modelId } of AGENT_MODEL_PRIORITY) {
    if (isPlatformProviderConfigured(provider)) return modelId;
  }

  // Step 3: any provider outside the curated list that has a key configured
  // (new providers added via env var auto-work without a code change)
  for (const provider of listConfiguredPlatformProviders()) {
    if (!prioritySet.has(provider)) return `${provider}/auto`;
  }

  // Step 4: managed gateway fallback
  return "google/gemini-2.5-flash";
}

/**
 * Vault-aware variant of resolveBestAgentModel. When no platform env key is
 * configured for any priority provider, this also walks the user's BYO vault
 * (user_api_keys) in AGENT_MODEL_PRIORITY order and picks the first provider the
 * user has a key for. This is the correct function to call from the agent loop —
 * it makes "auto" mode work for ANY provider the user has configured, whether that
 * is a platform-level key OR a per-user BYO key, without any code changes.
 *
 * Signature is async because vault lookup hits Supabase.
 */
export async function resolveBestAgentModelForUser(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<string> {
  // Platform env keys take priority (shared operator quota, no per-user lookup needed).
  const platformModel = resolveBestAgentModel();
  if (!platformModel.startsWith("google/")) return platformModel;

  // No platform key found — fall back to the user's vault keys, same priority order.
  const { loadBYOKey } = await import("@/lib/byokeys-vault.server");
  for (const { provider, modelId } of AGENT_MODEL_PRIORITY) {
    try {
      const vaultKey = await loadBYOKey(supabase, userId, provider);
      if (vaultKey?.api_key) return modelId;
    } catch {
      // Vault lookup failing for one provider must not block the others.
    }
  }

  return platformModel; // Gemini managed gateway — last resort
}
