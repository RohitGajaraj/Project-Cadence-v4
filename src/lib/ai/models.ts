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
