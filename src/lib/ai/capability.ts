/**
 * Perplexity-style CAPABILITY ROUTING (pure).
 *
 * Cadence runs a great deal of internal AI work — agent steps, daily briefs, idea
 * bucketing/clustering, research synthesis — plus a consumer-facing "Auto" mode.
 * Rather than pin one model everywhere, the platform routes each call to the model
 * BEST at the task it represents (code, reasoning, vision, long-context, fast chat),
 * within what is actually reachable. This is "optimized by us, the platform operator."
 *
 * The policy is a hand-curated preference order per capability (CAPABILITY_PREFERENCES) —
 * the single control surface for "what should power X". It is PURE + deterministic;
 * availability (gateway-live or a configured platform/BYO key) is injected by the caller.
 * Wired into the chokepoint (runtime.server.ts) BEFORE cost routing.
 *
 * Quality gate: this NEVER overrides a consumer's explicit, capable model pick. It
 * engages only for (a) "Auto" mode, (b) a caller-set task hint, or (c) an internal
 * system surface (SURFACE_CAPABILITY). The eval-subject and judge surfaces are never
 * routed (benchmark integrity / the Critic is a deliberate reasoning choice).
 */
import { MODELS, DEFAULT_MODEL, AUTO_MODEL, type Capability, type Model } from "./models";
import { priceFor } from "./pricing";

/**
 * Ordered best→worst model id per capability — the platform's routing policy. Gateway-live
 * models lead so the policy resolves to a callable model even with NO extra keys configured;
 * adapter-ready entries (Anthropic, DeepSeek, Qwen, …) win once their key is set. Tune freely.
 */
export const CAPABILITY_PREFERENCES: Record<Capability, string[]> = {
  code: [
    "openai/gpt-5.4",
    "anthropic/claude-opus-4",
    "deepseek/deepseek-v3",
    "qwen/qwen-2.5-coder-32b",
    "openai/gpt-5.5-pro",
    "google/gemini-2.5-pro",
  ],
  reasoning: [
    // BYO-key providers first: when the platform operator has configured a key, these win
    // over the managed gateway — higher quality-per-token and no shared quota pressure.
    "anthropic/claude-haiku-4",
    "anthropic/claude-opus-4",
    "openai/gpt-4o-mini",
    "openai/gpt-5",
    "qwen/qwen-max-latest",
    "qwen/qwen-plus",
    "deepseek/deepseek-chat",
    "groq/llama-3.3-70b-versatile",
    "xai/grok-2-1212",
    "xai/grok-4",
    // Managed-gateway fallbacks (no key needed, but shared quota; Gemini is the free floor).
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
  ],
  vision: [
    "google/gemini-2.5-pro",
    "google/gemini-3-flash-preview",
    "openai/gpt-5",
    "google/gemini-2.5-flash",
  ],
  "fast-chat": [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "openai/gpt-5-nano",
    "google/gemini-3-flash-preview",
  ],
  "long-context": [
    "google/gemini-2.5-pro",
    "google/gemini-3-flash-preview",
    "minimax/minimax-text-01",
    "moonshot/kimi-k2",
  ],
  // No dedicated image-generation model in the chat catalog yet; an image-gen route
  // currently has no candidate and falls back to the caller's default (extensible).
  "image-gen": [],
};

/**
 * Internal/system surfaces that are platform-driven (not a consumer's explicit pick), so
 * they are capability-routed by default for "most optimized" behavior. Consumer surfaces
 * (chat, prd, copilot, studio) are NOT here — they route only on "Auto" or an explicit task.
 */
export const SURFACE_CAPABILITY: Record<string, Capability> = {
  agent: "reasoning",
  brief: "fast-chat",
  scheduler: "fast-chat",
  discovery: "reasoning",
};

function blended(modelId: string): number {
  const p = priceFor(modelId);
  return (p.in_per_mtok + p.out_per_mtok) / 2;
}

export function modelHasCapability(m: Model, cap: Capability): boolean {
  return (m.capabilities ?? []).includes(cap);
}

/**
 * Pick the model for a capability: an explicit `requested` model wins if it is itself
 * capable + available; otherwise the first available model in the preference order; otherwise
 * the cheapest available capable model. Returns null when nothing capable is reachable.
 */
export function selectModelForCapability(opts: {
  capability: Capability;
  requested?: string;
  catalog?: Model[];
  isAvailable: (m: Model) => boolean;
}): string | null {
  const catalog = opts.catalog ?? MODELS;
  const byId = (id: string) => catalog.find((m) => m.id === id);
  if (opts.requested) {
    const r = byId(opts.requested);
    if (r && modelHasCapability(r, opts.capability) && opts.isAvailable(r)) return r.id;
  }
  for (const id of CAPABILITY_PREFERENCES[opts.capability] ?? []) {
    const m = byId(id);
    if (m && modelHasCapability(m, opts.capability) && opts.isAvailable(m)) return m.id;
  }
  const candidates = catalog.filter(
    (m) => modelHasCapability(m, opts.capability) && opts.isAvailable(m),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, m) => (blended(m.id) < blended(best.id) ? m : best)).id;
}

/** The cheapest gateway-live model with a capability — the capability-aware fallback floor. */
export function cheapestCapableLiveModel(
  capability: Capability,
  catalog: Model[] = MODELS,
): string | null {
  const live = catalog.filter((m) => m.live && modelHasCapability(m, capability));
  if (live.length === 0) return null;
  return live.reduce((best, m) => (blended(m.id) < blended(best.id) ? m : best)).id;
}

// Light heuristics for "Auto" mode (messages are plain strings today; image attachments
// are signalled via an explicit task: "vision", not sniffed here).
const CODE_HINT =
  /```|\bfunction\b|\bclass \b|\bdef \b|\bstack trace\b|\bcompile|\bTypeError\b|\bnull pointer\b|\bSELECT \b|\bnpm \b|\bgit \b/i;

/** Infer the dominant capability of a chat request for "Auto" mode. Pure. */
export function detectCapability(messages: { role: string; content: string }[]): Capability {
  const text = messages.map((m) => m.content ?? "").join("\n");
  if (CODE_HINT.test(text)) return "code";
  if (text.length > 40_000) return "long-context"; // ~10k tokens
  if (text.length < 400) return "fast-chat";
  return "reasoning";
}

/**
 * The model a call should actually use under capability routing — the single entry the
 * chokepoint calls. Returns a concrete model id (never AUTO_MODEL). Engages only for Auto
 * mode, an explicit task, or an internal system surface; otherwise returns the requested
 * model unchanged (the quality gate). When it engages, it picks the best model for the
 * capability regardless of the passed default ("most optimized").
 */
export function capabilityRoutedModel(opts: {
  surface: string;
  requestedModel: string; // may be AUTO_MODEL
  task?: Capability;
  messages: { role: string; content: string }[];
  isAvailable: (m: Model) => boolean;
  enabled: boolean;
  catalog?: Model[];
}): string {
  const isAuto = opts.requestedModel === AUTO_MODEL;
  const fallback = isAuto ? DEFAULT_MODEL : opts.requestedModel;
  if (!opts.enabled) return fallback;
  // Benchmark integrity: the eval subject IS the model under test; judge is a deliberate pick.
  if (opts.surface === "eval" || opts.surface === "judge") return fallback;

  let cap: Capability | null = null;
  if (isAuto) cap = detectCapability(opts.messages);
  else if (opts.task) cap = opts.task;
  // Explicit non-auto model: always respect it on every surface, including system surfaces
  // (agent, brief, discovery). SURFACE_CAPABILITY only engages when the caller is in auto mode
  // and has not committed to a specific model. Overriding a resolved model here is what caused
  // Qwen/explicit picks to silently degrade to Gemini via the "agent" surface capability route.
  if (!cap) return fallback;

  const picked = selectModelForCapability({
    capability: cap,
    catalog: opts.catalog,
    isAvailable: opts.isAvailable,
  });
  return picked ?? fallback;
}
