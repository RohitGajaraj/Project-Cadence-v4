/**
 * WM-M15: cost-aware model routing (the margin lever).
 *
 * Because there is no self-serve BYOK, the platform eats LLM COGS, so margin discipline is
 * structural (plan §2.6 / WM-M15). This routes ROUTINE, structured, internal surfaces down
 * to the cheapest adequate live model, and deliberately leaves the hard reasoning surfaces
 * (the agent loop, prd, copilot, studio, chat, discovery clustering) on their requested
 * model, so a genuinely hard step is never downgraded (the quality gate). It is a strict
 * no-op until the founder sets the `AI_COST_ROUTING` env flag (the runtime gate lives in
 * runtime.server.ts); this module is the pure, deterministic picker only.
 *
 * Pure (no IO): ranks the catalog by blended price. Unit-tested in routing.test.ts. The
 * RESPONSE / embedding cache half of WM-M15 is split to WM-M15b (it needs a persistent
 * store + invalidation design; an in-process cache is near-useless on ephemeral Workers).
 */
import { MODELS, getModel, type ModelTier } from "./models";
import { priceFor } from "./pricing";

/**
 * Blended per-million-token price (the mean of the input and output rates), used only to
 * RANK models by cost. Not a real cost estimate (that is estimateCostUsd); a rough,
 * monotonic ordering is all the router needs. Pure.
 */
export function blendedPrice(model: string): number {
  const p = priceFor(model);
  return (p.in_per_mtok + p.out_per_mtok) / 2;
}

/**
 * The surfaces whose calls are routine / structured / internal enough that the cheapest
 * adequate model is fine. Deliberately NARROW (adversarial-review-tightened):
 *   - excludes `agent`, `prd`, `copilot`, `studio`, `chat`, `discovery` (hard / user-facing);
 *   - excludes `judge` because the Critic (the launch wedge) runs on it with a deliberate
 *     reasoning model and renders user-facing;
 *   - excludes `eval` because its subject call IS the model under test, so rerouting would
 *     corrupt the benchmark (a tier guard cannot save a benchmark surface);
 *   - excludes `embed` because cheapestLiveModel() only knows CHAT models, so routing an
 *     embedding call would swap in a chat model.
 * The remaining surfaces are internal / low-stakes; the tier guard in costRoutedModel is a
 * second line of defense even here.
 */
export const COST_ROUTABLE_SURFACES: ReadonlySet<string> = new Set([
  "brief", // daily brief summary
  "scheduler", // internal scheduling
  "test", // connection test surface
]);

/**
 * Tiers that may be downgraded. A reasoning / premium / code / vision request is a DELIBERATE
 * quality choice (e.g. the Critic's gemini-2.5-pro), so it is never downgraded even on a
 * routable surface. Only fast / balanced requests are eligible.
 */
const DOWNGRADABLE_TIERS: ReadonlySet<ModelTier> = new Set(["fast", "balanced"]);

/**
 * The cheapest LIVE model in the catalog by blended price (the routing target). Live-only
 * so we never route to an adapter-ready (BYO/offline) model. Deterministic; falls back to
 * the catalog's cheapest known fast model if the catalog is somehow empty. Pure.
 */
export function cheapestLiveModel(): string {
  const live = MODELS.filter((m) => m.live);
  if (live.length === 0) return "google/gemini-2.5-flash-lite";
  let best = live[0].id;
  let bestPrice = blendedPrice(best);
  for (const m of live) {
    const price = blendedPrice(m.id);
    if (price < bestPrice) {
      best = m.id;
      bestPrice = price;
    }
  }
  return best;
}

/**
 * The model a call should actually use under cost-aware routing. For a routable surface,
 * downgrade to the cheapest live model IFF it is genuinely cheaper than the requested one
 * (never an upgrade, never a sideways move); for any other surface, keep the requested
 * model unchanged. Pure + deterministic, so the chokepoint stays predictable. The runtime
 * only calls this when `AI_COST_ROUTING` is enabled; otherwise it uses the requested model.
 */
export function costRoutedModel(surface: string, requestedModel: string): string {
  if (!COST_ROUTABLE_SURFACES.has(surface)) return requestedModel;
  const req = getModel(requestedModel);
  // Never downgrade an unknown model (getModel returns the default when not found, so
  // compare ids) or a deliberately-chosen reasoning/premium/code/vision tier (the quality
  // gate). Only a fast/balanced request on a routable surface is eligible.
  if (req.id !== requestedModel || !DOWNGRADABLE_TIERS.has(req.tier)) return requestedModel;
  const cheap = cheapestLiveModel();
  return blendedPrice(cheap) < blendedPrice(requestedModel) ? cheap : requestedModel;
}
