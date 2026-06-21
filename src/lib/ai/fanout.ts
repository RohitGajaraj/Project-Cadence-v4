/**
 * Ephemeral sub-agent fan-out (PURE core).
 *
 * Lets a specialist spread independent, parallelizable subwork across N bounded
 * ephemeral sub-agents of one role (e.g. one per source to ingest, per spec
 * section to draft, per file to build) instead of grinding them serially in a
 * single loop. Mechanically each child is a normal A2A handoff: `enqueueFanout`
 * (the `.server` half) calls the proven `enqueueHandoff` once per planned child,
 * so a spawned child is just another mission run the existing self-driving engine
 * already carries, reflects, and completes. No new orchestration-engine surface.
 *
 * What actually BOUNDS a fan-out (do not rely on a mission budget cap for this:
 * the runtime chokepoint enforces caps PER-RUN, not as a mission-wide aggregate,
 * and live mission runs are created with null caps today, so the per-child budget
 * split is only a hint):
 *   1. COUNT cap: at most {@link FANOUT_MAX_CHILDREN} children per single spawn.
 *   2. DEPTH cap: a spawned child is stamped with its fan-out depth, and a run at
 *      depth >= {@link FANOUT_MAX_DEPTH} may NOT itself spawn. With the default of
 *      1 that means exactly ONE level of fan-out (a top-level agent spawns workers;
 *      those workers cannot spawn), so the chain can never explode 8 -> 64 -> 512.
 * The self-spawn refusal (A -> A) in `enqueueFanout` is a minor extra guard, NOT a
 * recursion bound; the depth cap is what prevents fan-out explosion.
 *
 * This module is the pure, offline-verifiable heart: it caps the child count,
 * dedupes blank/duplicate subtasks, splits the supplied (remaining) budget evenly
 * across the kept children as a per-child hint, and exposes the depth helpers. No
 * db, no network, no AI.
 */

/** Hard cap on parallel sub-agents per single spawn (cost + concurrency guard). */
export const FANOUT_MAX_CHILDREN = 8;

/**
 * Max fan-out depth: a run at depth >= this may not spawn. 1 = a single level of
 * fan-out (top-level agent spawns workers; a spawned worker cannot itself spawn),
 * which makes the chain length, and therefore the total run count, hard-bounded
 * independent of any budget cap.
 */
export const FANOUT_MAX_DEPTH = 1;

/**
 * PURE. Read the fan-out depth a run was stamped with, from its inbound handoff
 * payload (`context._fanout_depth`, set by {@link planFanout}'s server enqueue).
 * A top-level run (no inbound fan-out handoff, or an absent/odd stamp) is depth 0.
 */
export function fanoutDepthOf(payload: unknown): number {
  const d = (payload as { context?: { _fanout_depth?: unknown } } | null | undefined)?.context
    ?._fanout_depth;
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? Math.floor(d) : 0;
}

/** PURE. True when a run at this depth may still spawn (bounds nested fan-out). */
export function canSpawnAtDepth(depth: number): boolean {
  return depth < FANOUT_MAX_DEPTH;
}

export type FanoutItem = { task: string; context?: Record<string, unknown> };

export type PlannedChild = {
  task: string;
  context?: Record<string, unknown>;
  /** Per-child spend hint = supplied cap / kept-child-count (null when no cap supplied). */
  spendCapUsd: number | null;
  /** Per-child token hint = floor(supplied cap / kept-child-count) (null when no cap supplied). */
  tokenCap: number | null;
};

export type FanoutPlan = {
  children: PlannedChild[];
  /** How many valid subtasks were dropped by the cap (surfaced so truncation is never silent). */
  dropped: number;
};

/**
 * PURE. Turn a requested list of subtasks + an optional mission budget into a
 * bounded, deduped, budget-split set of children. Caps at {@link FANOUT_MAX_CHILDREN}
 * (and any tighter `maxChildren`), drops blank/non-string/duplicate tasks, reports
 * how many valid tasks were cut by the cap.
 */
export function planFanout(
  items: readonly FanoutItem[],
  opts: { maxChildren?: number; spendCapUsd?: number | null; tokenCap?: number | null } = {},
): FanoutPlan {
  const cap = Math.max(1, Math.min(opts.maxChildren ?? FANOUT_MAX_CHILDREN, FANOUT_MAX_CHILDREN));

  const seen = new Set<string>();
  const valid: FanoutItem[] = [];
  for (const it of items ?? []) {
    if (!it || typeof it.task !== "string") continue;
    const task = it.task.trim();
    if (!task || seen.has(task)) continue;
    seen.add(task);
    valid.push({ task, context: it.context });
  }

  const kept = valid.slice(0, cap);
  const dropped = valid.length - kept.length;
  const n = kept.length;

  const spend =
    n > 0 && typeof opts.spendCapUsd === "number" && opts.spendCapUsd > 0
      ? opts.spendCapUsd / n
      : null;
  const tokens =
    n > 0 && typeof opts.tokenCap === "number" && opts.tokenCap > 0
      ? Math.floor(opts.tokenCap / n)
      : null;

  return {
    children: kept.map((it) => ({
      task: it.task,
      context: it.context,
      spendCapUsd: spend,
      tokenCap: tokens,
    })),
    dropped,
  };
}
