/**
 * Model pricing (USD per 1M tokens). Kept conservative; tune as providers
 * update. Unknown models fall back to a neutral default so cost math never
 * crashes.
 */
export type Pricing = { in_per_mtok: number; out_per_mtok: number };

export const MODEL_PRICING: Record<string, Pricing> = {
  // Google Gemini (via Lovable AI Gateway)
  "google/gemini-3-flash-preview": { in_per_mtok: 0.075, out_per_mtok: 0.3 },
  "google/gemini-2.5-pro": { in_per_mtok: 1.25, out_per_mtok: 5.0 },
  "google/gemini-2.5-flash": { in_per_mtok: 0.15, out_per_mtok: 0.6 },
  "google/gemini-2.5-flash-lite": { in_per_mtok: 0.05, out_per_mtok: 0.2 },
  "google/gemini-3.5-flash": { in_per_mtok: 0.15, out_per_mtok: 0.6 },
  // OpenAI
  "openai/gpt-5": { in_per_mtok: 5.0, out_per_mtok: 15.0 },
  "openai/gpt-5-mini": { in_per_mtok: 0.5, out_per_mtok: 1.5 },
  "openai/gpt-5-nano": { in_per_mtok: 0.1, out_per_mtok: 0.4 },
  "openai/gpt-5.4": { in_per_mtok: 3.0, out_per_mtok: 12.0 },
  "openai/gpt-5.4-mini": { in_per_mtok: 0.4, out_per_mtok: 1.6 },
  "openai/gpt-5.5-pro": { in_per_mtok: 8.0, out_per_mtok: 24.0 },
  // BYO Anthropic / DeepSeek / xAI
  "anthropic/claude-opus-4": { in_per_mtok: 15.0, out_per_mtok: 75.0 },
  "anthropic/claude-sonnet-4": { in_per_mtok: 3.0, out_per_mtok: 15.0 },
  "anthropic/claude-haiku-4": { in_per_mtok: 0.8, out_per_mtok: 4.0 },
  "deepseek/deepseek-v3": { in_per_mtok: 0.27, out_per_mtok: 1.1 },
  "xai/grok-4": { in_per_mtok: 5.0, out_per_mtok: 15.0 },
};

const DEFAULT_PRICING: Pricing = { in_per_mtok: 0.5, out_per_mtok: 1.5 };

export function priceFor(model: string): Pricing {
  return MODEL_PRICING[model] ?? DEFAULT_PRICING;
}

export function estimateCostUsd(model: string, inTokens: number, outTokens: number): number {
  const p = priceFor(model);
  return (inTokens * p.in_per_mtok + outTokens * p.out_per_mtok) / 1_000_000;
}
