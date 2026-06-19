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

// ---------------------------------------------------------------------------
// WM-M10: credit unit + cost-to-credit conversion + the calm legibility layer.
//
// A credit is a stable, user-facing unit that abstracts blended managed COGS
// (inference + infra). The user never sees a raw provider cost; margin lives in
// grant-sizing (entitlements.creditMonthlyBase), NOT in the per-credit price, so
// the meter stays calm and abundant. The numbers here are founder-tunable
// placeholders (plan §7); the conversion MECHANISM is final. The whole credit
// engine stays dormant behind credits_enabled() until the founder flips it.
// ---------------------------------------------------------------------------

/**
 * USD of blended COGS that one credit represents. Founder-tunable (plan §7).
 * Placeholder: 1 credit ~= $0.0002 of COGS (so $1 of COGS ~= 5,000 credits),
 * which keeps the user-facing unit abundant rather than a raw provider cost.
 */
export const CREDIT_COGS_USD = 0.0002;

/**
 * Optional per-model credit-rate multiplier applied on top of raw COGS. Lets a
 * premium reasoning model be dialed above its raw cost ratio (or a loss-leader
 * below it) without touching the conversion. Empty by default = pure COGS
 * pass-through (rate 1) for every model; founder-tunable (plan §7).
 */
export const MODEL_CREDIT_RATE: Record<string, number> = {};

/** The credit-rate multiplier for a model. Falls back to 1 for any unset/invalid rate. */
export function creditRateFor(model: string): number {
  const r = MODEL_CREDIT_RATE[model];
  return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : 1;
}

/**
 * Convert a measured USD cost into credits. A billable call (cost > 0) always
 * costs at least 1 credit; a zero / negative / non-finite cost costs 0 (no
 * charge). Deterministic and margin-positive (rounds up).
 */
export function creditsForCost(estCostUsd: number, model: string): number {
  if (!Number.isFinite(estCostUsd) || estCostUsd <= 0) return 0;
  const credits = Math.ceil((estCostUsd / CREDIT_COGS_USD) * creditRateFor(model));
  return Math.max(1, credits);
}

/**
 * Project the credits a call will cost from its token shape. Composes the
 * existing USD estimator so the projection and the real (post-call) debit share
 * one source of truth.
 */
export function estimateCreditsForCall(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  return creditsForCost(estimateCostUsd(model, promptTokens, completionTokens), model);
}

/** An approximate, display-only credit range for a user-facing action. */
export type CreditRange = { min: number; max: number };

type ActionShape = {
  model: string;
  /** [low, high] prompt tokens for a typical instance of this action. */
  prompt: [number, number];
  /** [low, high] completion tokens for a typical instance of this action. */
  completion: [number, number];
};

/**
 * Representative token shapes per user-facing action. Placeholders calibrated to
 * typical calls; WM-M16 can refine them from historical ai_events averages. They
 * feed the SAME conversion as the real meter, so the displayed range never
 * contradicts what actually gets debited.
 */
const ACTION_SHAPES: Record<string, ActionShape> = {
  chat_reply: { model: "google/gemini-2.5-flash", prompt: [800, 2500], completion: [300, 1200] },
  research: { model: "google/gemini-2.5-pro", prompt: [4000, 12000], completion: [1500, 5000] },
  prd_draft: { model: "google/gemini-2.5-pro", prompt: [3000, 8000], completion: [2000, 6000] },
  mission_step: { model: "google/gemini-2.5-flash", prompt: [1500, 6000], completion: [500, 2500] },
  embedding: { model: "google/gemini-2.5-flash-lite", prompt: [200, 1500], completion: [0, 0] },
};

/** A safe, non-alarming default range for an unknown action kind. */
const DEFAULT_ACTION_RANGE: CreditRange = { min: 1, max: 10 };

/**
 * Approximate credit range for a user-facing action, for calm UI display only
 * ("a PRD draft is about N to M credits"). Returns {min,max} (min <= max, both
 * >= 1 for known kinds); unknown kinds get a conservative default. The real
 * debit is always metered from the actual call cost, never this range, so this
 * must never be rendered as a flat per-action charge.
 */
export function actionCreditRange(actionKind: string): CreditRange {
  const shape = ACTION_SHAPES[actionKind];
  if (!shape) return { ...DEFAULT_ACTION_RANGE };
  const low = estimateCreditsForCall(shape.model, shape.prompt[0], shape.completion[0]);
  const high = estimateCreditsForCall(shape.model, shape.prompt[1], shape.completion[1]);
  const min = Math.max(1, Math.min(low, high));
  const max = Math.max(min, low, high);
  return { min, max };
}

// --- Pre-call projection (WM-M12) ------------------------------------------
// The credit-debit seam projects a call's cost BEFORE making it, to halt cleanly
// when the account pool cannot cover it. The real debit is exact (from the actual
// post-call est_cost_usd); this projection is a conservative guard only.

/** Default completion-token budget assumed for the pre-call projection. */
export const ASSUMED_COMPLETION_TOKENS = 1200;

/** Rough prompt-token estimate from message text (~4 chars per token). Pure. */
export function estimatePromptTokens(messages: { content?: string | null }[]): number {
  const chars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  return Math.ceil(chars / 4);
}

/**
 * Conservative pre-call credit projection: estimated prompt tokens plus a default
 * completion budget, run through the SAME converter the post-call debit uses, so the
 * guard and the real meter agree on the unit. Pure.
 */
export function projectCallCredits(model: string, messages: { content?: string | null }[]): number {
  return estimateCreditsForCall(model, estimatePromptTokens(messages), ASSUMED_COMPLETION_TOKENS);
}
