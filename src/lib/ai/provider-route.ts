/**
 * MODEL-AGNOSTIC dispatch resolver (pure).
 *
 * Cadence is model-agnostic at the platform layer: ANY model from ANY provider
 * (Anthropic, OpenAI, Google, DeepSeek, xAI, Moonshot, Groq, Mistral, Together,
 * OpenRouter, Qwen/DashScope, MiniMax, Fireworks, Perplexity, Ollama, vLLM, …)
 * can power an internal AI action, as long as it speaks the OpenAI Chat
 * Completions shape (the near-universal lingua franca) or Anthropic Messages.
 *
 * A model id is always `"<provider>/<model>"`. This module turns that id (plus an
 * optional base URL) into a concrete `{ provider, model, url, style }` dispatch
 * target. It is PURE: no env, no IO, no SSRF assertions (the chokepoint re-asserts
 * `url` via assertSafeBaseUrl at call time). Unit-tested in provider-route.test.ts.
 *
 * Replaces the old `byoConfig` prefix-switch in runtime.server.ts, which returned
 * `null` for any provider it did not hardcode — so a model like `qwen/...` silently
 * fell through to the managed gateway and 400'd (and `moonshot/`, `ollama/` had this
 * latent bug despite being in the catalog). The new rule: an unknown provider with a
 * resolvable base URL routes generically as OpenAI-compatible; only a provider with
 * NO resolvable endpoint returns null (→ the managed gateway).
 */

export type CompletionStyle = "openai_chat" | "anthropic_messages";

export type ProviderRoute = {
  /** provider id (the part before the first "/" in the model id) */
  provider: string;
  /** the bare model name sent to the provider API (the part after the first "/") */
  model: string;
  /** fully-resolved chat/completions (or messages) endpoint */
  url: string;
  /** wire shape — anthropic_messages uses the Anthropic Messages API, else OpenAI Chat */
  style: CompletionStyle;
};

/**
 * Default direct endpoints for well-known providers. A caller-supplied base URL
 * (user vault key or platform env config) ALWAYS wins over these, so the defaults
 * are a zero-config convenience for the common providers, not a closed set.
 *
 * Every entry except `anthropic` is OpenAI-Chat-compatible. MiniMax's compat
 * endpoint is non-standard (`/text/chatcompletion_v2`); it is included best-effort
 * and most reliably driven via an explicit base URL.
 */
const KNOWN_PROVIDERS: Record<string, { url: string; style: CompletionStyle }> = {
  anthropic: { url: "https://api.anthropic.com/v1/messages", style: "anthropic_messages" },
  openai: { url: "https://api.openai.com/v1/chat/completions", style: "openai_chat" },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    style: "openai_chat",
  },
  deepseek: { url: "https://api.deepseek.com/v1/chat/completions", style: "openai_chat" },
  xai: { url: "https://api.x.ai/v1/chat/completions", style: "openai_chat" },
  // --- opened set (fixes the moonshot/ollama latent bug + adds the long tail) ---
  moonshot: { url: "https://api.moonshot.cn/v1/chat/completions", style: "openai_chat" },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", style: "openai_chat" },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions", style: "openai_chat" },
  together: { url: "https://api.together.xyz/v1/chat/completions", style: "openai_chat" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", style: "openai_chat" },
  qwen: {
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    style: "openai_chat",
  },
  minimax: { url: "https://api.minimaxi.chat/v1/text/chatcompletion_v2", style: "openai_chat" },
  fireworks: {
    url: "https://api.fireworks.ai/inference/v1/chat/completions",
    style: "openai_chat",
  },
  perplexity: { url: "https://api.perplexity.ai/chat/completions", style: "openai_chat" },
  deepinfra: {
    url: "https://api.deepinfra.com/v1/openai/chat/completions",
    style: "openai_chat",
  },
  cerebras: { url: "https://api.cerebras.ai/v1/chat/completions", style: "openai_chat" },
  ollama: { url: "http://localhost:11434/v1/chat/completions", style: "openai_chat" },
};

/** Provider ids with a built-in default endpoint (zero-config). */
export const KNOWN_PROVIDER_IDS = Object.keys(KNOWN_PROVIDERS);

/** True if the provider has a built-in default endpoint. */
export function isKnownProvider(provider: string): boolean {
  return provider in KNOWN_PROVIDERS;
}

/** The Anthropic-style providers (non-OpenAI wire shape). */
export function isAnthropicStyle(modelId: string): boolean {
  return providerStyle(modelId) === "anthropic_messages";
}

/** Split a `provider/model` id. A bare id (no slash) is treated as its own provider. */
export function splitModelId(modelId: string): { provider: string; model: string } {
  const i = modelId.indexOf("/");
  if (i <= 0) return { provider: modelId, model: modelId };
  return { provider: modelId.slice(0, i), model: modelId.slice(i + 1) };
}

/** The wire shape a model id defaults to (anthropic_messages for anthropic, else openai_chat). */
export function providerStyle(modelId: string): CompletionStyle {
  const { provider } = splitModelId(modelId);
  return KNOWN_PROVIDERS[provider]?.style ?? "openai_chat";
}

/**
 * Normalize a user/platform-supplied base URL into a full completions/messages
 * endpoint. Idempotent: a URL that already ends in a known endpoint is returned
 * unchanged. Handles the three common shapes people paste:
 *   - full endpoint:  https://host/v1/chat/completions  → unchanged
 *   - version root:   https://host/v1                    → + /chat/completions
 *   - bare origin:    http://localhost:11434             → + /v1/chat/completions
 * Anything else (an unrecognized path) gets the endpoint appended directly.
 */
export function normalizeChatCompletionsUrl(baseUrl: string, style: CompletionStyle): string {
  const endpoint = style === "anthropic_messages" ? "/messages" : "/chat/completions";
  const u = baseUrl.trim().replace(/\/+$/, "");
  // Already a recognized terminal endpoint.
  if (/\/(chat\/completions|messages|chatcompletion_v2|responses)$/i.test(u)) return u;
  // Ends with a version segment (…/v1, …/openai/v1, …/compatible-mode/v1).
  if (/\/v\d+$/i.test(u)) return u + endpoint;
  // Bare origin (scheme://host[:port]) with no meaningful path.
  try {
    const parsed = new URL(u);
    if (parsed.pathname === "" || parsed.pathname === "/") return u + "/v1" + endpoint;
  } catch {
    /* not parseable as an absolute URL; fall through to the generic append */
  }
  return u + endpoint;
}

/**
 * Resolve a model id (+ optional base URL) to a concrete dispatch target, or null
 * when there is no direct endpoint to reach (the caller then uses the managed
 * gateway). Precedence for the endpoint:
 *   1. opts.baseUrl  (override → user vault base_url → platform env base_url)
 *   2. the provider's built-in default
 * `opts.style` overrides the inferred wire shape (e.g. an Anthropic-compatible proxy).
 *
 * PURE — does not validate the URL for SSRF; the chokepoint calls assertSafeBaseUrl
 * on the returned `url` before fetching.
 */
export function providerRoute(
  modelId: string,
  opts: { baseUrl?: string | null; style?: CompletionStyle } = {},
): ProviderRoute | null {
  const { provider, model } = splitModelId(modelId);
  const known = KNOWN_PROVIDERS[provider];
  const override = opts.baseUrl?.trim() || null;
  const base = override ?? known?.url ?? null;
  if (!base) return null; // unknown provider, no base URL → fall back to the managed gateway
  const style: CompletionStyle = opts.style ?? known?.style ?? "openai_chat";
  // A built-in default is already a full endpoint; only normalize a supplied base URL.
  const url = override ? normalizeChatCompletionsUrl(override, style) : base;
  return { provider, model, url, style };
}
