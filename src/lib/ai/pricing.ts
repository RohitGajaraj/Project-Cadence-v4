/**
 * Model pricing (USD per 1M tokens). Kept conservative; tune as providers
 * update. Unknown models fall back to a neutral default so cost math never
 * crashes.
 */
export type Pricing = { in_per_mtok: number; out_per_mtok: number };

export const MODEL_PRICING: Record<string, Pricing> = {
  // Google Gemini (via Lovable AI Gateway)
  "google/gemini-3-flash-preview": { in_per_mtok: 0.075, out_per_mtok: 0.30 },
  "google/gemini-2.5-pro": { in_per_mtok: 1.25, out_per_mtok: 5.00 },
  "google/gemini-2.5-flash": { in_per_mtok: 0.15, out_per_mtok: 0.60 },
  "google/gemini-2.5-flash-lite": { in_per_mtok: 0.05, out_per_mtok: 0.20 },
  "google/gemini-3.5-flash": { in_per_mtok: 0.15, out_per_mtok: 0.60 },
  // OpenAI
  "openai/gpt-5": { in_per_mtok: 5.00, out_per_mtok: 15.00 },
  "openai/gpt-5-mini": { in_per_mtok: 0.50, out_per_mtok: 1.50 },
  "openai/gpt-5-nano": { in_per_mtok: 0.10, out_per_mtok: 0.40 },
  "openai/gpt-5.4": { in_per_mtok: 3.00, out_per_mtok: 12.00 },
  "openai/gpt-5.4-mini": { in_per_mtok: 0.40, out_per_mtok: 1.60 },
  "openai/gpt-5.5-pro": { in_per_mtok: 8.00, out_per_mtok: 24.00 },
  // BYO Anthropic / DeepSeek / xAI
  "anthropic/claude-opus-4": { in_per_mtok: 15.00, out_per_mtok: 75.00 },
  "anthropic/claude-sonnet-4": { in_per_mtok: 3.00, out_per_mtok: 15.00 },
  "anthropic/claude-haiku-4": { in_per_mtok: 0.80, out_per_mtok: 4.00 },
  "deepseek/deepseek-v3": { in_per_mtok: 0.27, out_per_mtok: 1.10 },
  "xai/grok-4": { in_per_mtok: 5.00, out_per_mtok: 15.00 },
};

const DEFAULT_PRICING: Pricing = { in_per_mtok: 0.50, out_per_mtok: 1.50 };

export function priceFor(model: string): Pricing {
  return MODEL_PRICING[model] ?? DEFAULT_PRICING;
}

export function estimateCostUsd(model: string, inTokens: number, outTokens: number): number {
  const p = priceFor(model);
  return (inTokens * p.in_per_mtok + outTokens * p.out_per_mtok) / 1_000_000;
}