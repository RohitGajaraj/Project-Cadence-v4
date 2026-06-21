/**
 * Embeddings chokepoint (EMBED-CHOKEPOINT).
 *
 * Every vector in Cadence is produced HERE, so embeddings get the same governance treatment as
 * completions instead of calling the gateway directly with no oversight: a cost estimate, an
 * `ai_events` telemetry row, and BYO-key routing. It reuses the SAME shared primitives the
 * completion chokepoint (`ai/runtime.server.ts`) uses — `estimateCostUsd` (pricing.ts), `loadBYOKey`
 * (the vault), and the `ai_events` table — rather than duplicating them, so the two chokepoints stay
 * consistent. Embeddings are a distinct API shape (no messages / guardrails / JSON), so they get
 * their own thin chokepoint here rather than being forced through `callModel`.
 *
 * Context (`supabase` + `userId`) is OPTIONAL and threaded by the caller. When present the call
 * BYO-routes (an OpenAI BYO key) and logs an embed event; when absent it routes via the gateway and
 * skips logging (ai_events.user_id is NOT NULL, so an unattributed event cannot be written). Logging
 * is fail-open: a telemetry write never breaks an embedding. Uses the 1536-dim Matryoshka size so
 * vectors fit the `vector(1536)` columns our migrations define.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { loadBYOKey } from "@/lib/byokeys-vault.server";

const GATEWAY_EMB_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const OPENAI_EMB_URL = "https://api.openai.com/v1/embeddings";
export const EMB_MODEL = "openai/text-embedding-3-small";
export const EMB_DIMS = 1536;
const BATCH = 64;
const MAX_INPUT_CHARS = 32_000;

export type EmbedContext = {
  /** User-scoped or service client used to write the ai_events telemetry row + load a BYO key. */
  supabase?: SupabaseClient;
  /** The owner the call is attributed to; required to log (ai_events.user_id is NOT NULL). */
  userId?: string | null;
  /** ai_events.surface_ref, e.g. the source_kind being indexed. */
  surfaceRef?: string | null;
  /** Explicit BYO key override (e.g. test-running a key); else an OpenAI BYO key is auto-loaded.
   *  OpenAI-only by design (the sole BYO embeddings provider), so it always routes to the fixed,
   *  trusted OpenAI endpoint — there is deliberately no caller-supplied base URL (an arbitrary
   *  URL would send the user's key to an attacker-controlled host). */
  byoOverride?: { apiKey: string };
};

type EmbedRoute = {
  via: "gateway" | "byo";
  provider: "lovable" | "openai";
  url: string;
  key: string;
  /** The model id as the chosen endpoint expects it (gateway keeps the `openai/` prefix; the raw
   *  OpenAI API does not). */
  model: string;
};

/** chars/4 token heuristic, matching the completion estimator's spirit. Pure + total. */
export function estimateEmbedTokens(inputs: string[]): number {
  let chars = 0;
  for (const s of inputs) chars += s.length;
  return Math.ceil(chars / 4);
}

const OPENAI_MODEL = EMB_MODEL.replace(/^openai\//, "");

/**
 * Resolve which endpoint + key an embedding call uses: an explicit override first, then an
 * auto-loaded OpenAI BYO key (only when user context is present), else the Lovable gateway
 * (today's default). Pure given its inputs except the optional BYO lookup + the env read.
 */
export async function resolveEmbedRoute(opts: EmbedContext): Promise<EmbedRoute> {
  if (opts.byoOverride?.apiKey) {
    return {
      via: "byo",
      provider: "openai",
      url: OPENAI_EMB_URL,
      key: opts.byoOverride.apiKey,
      model: OPENAI_MODEL,
    };
  }
  if (opts.supabase && opts.userId) {
    const byo = await loadBYOKey(opts.supabase, opts.userId, "openai");
    if (byo?.api_key) {
      return {
        via: "byo",
        provider: "openai",
        url: OPENAI_EMB_URL,
        key: byo.api_key,
        model: OPENAI_MODEL,
      };
    }
  }
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return { via: "gateway", provider: "lovable", url: GATEWAY_EMB_URL, key, model: EMB_MODEL };
}

async function logEmbedEvent(
  opts: EmbedContext,
  route: EmbedRoute,
  inTok: number,
  latencyMs: number,
): Promise<void> {
  // No user context -> cannot attribute (ai_events.user_id is NOT NULL). The call still routed
  // through this chokepoint; it just isn't logged until the caller threads context.
  if (!opts.supabase || !opts.userId) return;
  try {
    await opts.supabase.from("ai_events").insert({
      user_id: opts.userId,
      surface: "embed",
      surface_ref: opts.surfaceRef ?? null,
      provider: route.provider,
      via: route.via,
      model: EMB_MODEL,
      prompt_tokens: inTok,
      completion_tokens: 0,
      total_tokens: inTok,
      est_cost_usd: estimateCostUsd(EMB_MODEL, inTok, 0),
      latency_ms: latencyMs,
      status: "ok",
    });
  } catch (e) {
    // Fail-open: telemetry must never break embedding.
    console.error("embed ai_events insert failed:", e);
  }
}

export async function embedThroughChokepoint(
  inputs: string[],
  opts: EmbedContext = {},
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const route = await resolveEmbedRoute(opts);
  const started = Date.now();
  const out: number[][] = [];
  let usageTokens = 0;
  // Batch in chunks of 64 to stay well under the 256 limit.
  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH).map((s) => s.slice(0, MAX_INPUT_CHARS));
    const res = await fetch(route.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${route.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: route.model, input: slice, dimensions: EMB_DIMS }),
    });
    if (!res.ok) {
      // Redact any echoed key material before the body reaches an error / log (defense in depth).
      const body = (await res.text()).slice(0, 200).replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***");
      throw new Error(`embeddings ${res.status}: ${body}`);
    }
    const j = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
      usage?: { prompt_tokens?: number; total_tokens?: number };
    };
    for (const row of j.data) out[i + row.index] = row.embedding;
    usageTokens += j.usage?.prompt_tokens ?? j.usage?.total_tokens ?? 0;
  }
  const inTok = usageTokens > 0 ? usageTokens : estimateEmbedTokens(inputs);
  await logEmbedEvent(opts, route, inTok, Date.now() - started);
  return out;
}

// Back-compat wrappers: existing callers pass no opts and behave exactly as before (gateway, no
// logging); callers that thread context get BYO routing + embed telemetry.
export async function embedTexts(inputs: string[], opts: EmbedContext = {}): Promise<number[][]> {
  return embedThroughChokepoint(inputs, opts);
}

export async function embedOne(text: string, opts: EmbedContext = {}): Promise<number[]> {
  const [v] = await embedThroughChokepoint([text], opts);
  return v;
}
