/**
 * Cadence model catalog.
 * All `live: true` models route through the Lovable AI Gateway today.
 * `live: false` entries are adapter-ready and will light up when keys/gateway support land.
 */

export type ModelTier = "fast" | "balanced" | "reasoning" | "premium" | "code" | "vision";

export type Model = {
  id: string;
  label: string;
  provider: "google" | "openai" | "anthropic" | "deepseek" | "xai" | "moonshot" | "ollama";
  tier: ModelTier;
  contextK: number;
  desc: string;
  live: boolean;
  /**
   * MODEL-REGISTRY-DEPRECATION: a model-deprecation playbook (considerations.md #4). When a
   * provider sunsets a model, mark it `deprecated: true` and point `replacement` at the model
   * id that should serve its traffic instead; `activeModelId` then routes around it at the AI
   * chokepoint. `sunset` is the human-readable date for the catalog UI. All optional, so a
   * catalog with nothing flagged (today) is a no-op. The route-around only takes effect when a
   * `replacement` is set AND that replacement is live, so a deprecation can never strand traffic
   * on an unusable model.
   */
  deprecated?: boolean;
  replacement?: string;
  sunset?: string;
};

export const MODELS: Model[] = [
  // Live — via Lovable AI Gateway
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    provider: "google",
    tier: "fast",
    contextK: 1000,
    desc: "Default. Fast, balanced, multimodal.",
    live: true,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    tier: "reasoning",
    contextK: 2000,
    desc: "Deep reasoning, vision, long context.",
    live: true,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    tier: "balanced",
    contextK: 1000,
    desc: "Balanced cost/quality.",
    live: true,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "google",
    tier: "fast",
    contextK: 1000,
    desc: "Cheapest. High-volume tasks.",
    live: true,
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    provider: "openai",
    tier: "reasoning",
    contextK: 400,
    desc: "OpenAI all-rounder, top-tier reasoning.",
    live: true,
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    provider: "openai",
    tier: "balanced",
    contextK: 400,
    desc: "Balanced GPT-5, lower cost.",
    live: true,
  },
  {
    id: "openai/gpt-5-nano",
    label: "GPT-5 Nano",
    provider: "openai",
    tier: "fast",
    contextK: 400,
    desc: "Cheapest GPT-5, high-volume.",
    live: true,
  },
  {
    id: "openai/gpt-5.4",
    label: "GPT-5.4",
    provider: "openai",
    tier: "code",
    contextK: 400,
    desc: "Advanced reasoning + code.",
    live: true,
  },
  {
    id: "openai/gpt-5.5-pro",
    label: "GPT-5.5 Pro",
    provider: "openai",
    tier: "premium",
    contextK: 400,
    desc: "Premium reasoning for hardest problems.",
    live: true,
  },

  // Adapter-ready (BYO key or future gateway support)
  {
    id: "anthropic/claude-opus-4",
    label: "Claude Opus 4",
    provider: "anthropic",
    tier: "premium",
    contextK: 200,
    desc: "Anthropic's strongest. BYO key.",
    live: false,
  },
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "anthropic",
    tier: "balanced",
    contextK: 200,
    desc: "Balanced Anthropic. BYO key.",
    live: false,
  },
  {
    id: "anthropic/claude-haiku-4",
    label: "Claude Haiku 4",
    provider: "anthropic",
    tier: "fast",
    contextK: 200,
    desc: "Fastest Anthropic. BYO key.",
    live: false,
  },
  {
    id: "deepseek/deepseek-v3",
    label: "DeepSeek V3",
    provider: "deepseek",
    tier: "code",
    contextK: 128,
    desc: "Strong open code model. BYO key.",
    live: false,
  },
  {
    id: "xai/grok-4",
    label: "Grok 4",
    provider: "xai",
    tier: "reasoning",
    contextK: 256,
    desc: "xAI reasoning. BYO key.",
    live: false,
  },
  {
    id: "moonshot/kimi-k2",
    label: "Kimi K2",
    provider: "moonshot",
    tier: "reasoning",
    contextK: 200,
    desc: "Moonshot long-context. BYO key.",
    live: false,
  },
  {
    id: "ollama/llama-3.3-70b",
    label: "Llama 3.3 70B (local)",
    provider: "ollama",
    tier: "balanced",
    contextK: 128,
    desc: "Self-hosted via Ollama. Configure URL.",
    live: false,
  },
];

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export function getModel(id: string): Model {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

/**
 * MODEL-REGISTRY-DEPRECATION: resolve a requested model id to the model that should actually
 * serve it, following `deprecated -> replacement` links. Pure + deterministic. Safe by
 * construction: it follows a hop only when the current model is `deprecated`, names a
 * `replacement`, and that replacement EXISTS in the catalog (intermediates may be non-live
 * retired models that themselves point onward); the chain stops at the first non-deprecated
 * model, a missing replacement, or a cycle. The resolved model is adopted ONLY if that terminal
 * model is `live` - otherwise the original requested id is returned, so a deprecation can never
 * route traffic onto a missing or non-live model. It caps the hop count and tracks visited ids
 * so a misconfigured cycle terminates instead of looping. With nothing flagged in the catalog (the
 * state today) this is the identity function, so the chokepoint stays byte-identical until a
 * real sunset is recorded. Unit-tested in models.test.ts with an injected catalog.
 */
export function activeModelId(id: string, catalog: Model[] = MODELS): string {
  let current = id;
  const seen = new Set<string>();
  // Follow deprecated -> replacement links (a retired model may itself point to a newer one,
  // so intermediates can be non-live). Cap the hops and track visited ids so a misconfigured
  // cycle terminates.
  for (let hops = 0; hops < 8; hops++) {
    const m = catalog.find((x) => x.id === current);
    if (!m || !m.deprecated || !m.replacement) break;
    if (seen.has(current)) break;
    seen.add(current);
    if (!catalog.find((x) => x.id === m.replacement)) break; // replacement missing: do not strand
    current = m.replacement;
  }
  // Only adopt the resolved model if it is a real, LIVE endpoint; otherwise keep the original
  // requested id so a deprecation can never route traffic onto a missing or non-live model.
  if (current === id) return id;
  const resolved = catalog.find((x) => x.id === current);
  return resolved && resolved.live ? current : id;
}

/**
 * Lightweight task-aware router. Picks an appropriate live model.
 */
export function routeModel(opts: {
  task?: "chat" | "code" | "reasoning" | "summarize" | "vision";
  preferred?: string;
  costSensitive?: boolean;
}): string {
  if (opts.preferred) {
    const m = MODELS.find((x) => x.id === opts.preferred && x.live);
    if (m) return m.id;
  }
  if (opts.costSensitive) return "google/gemini-2.5-flash-lite";
  switch (opts.task) {
    case "code":
      return "openai/gpt-5.4";
    case "reasoning":
      return "google/gemini-2.5-pro";
    case "vision":
      return "google/gemini-2.5-pro";
    case "summarize":
      return "google/gemini-2.5-flash";
    default:
      return DEFAULT_MODEL;
  }
}
