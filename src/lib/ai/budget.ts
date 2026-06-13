/**
 * Adaptive step budget (v6 Phase 1 — "the loop runs itself").
 *
 * Replaces the static `maxStepsFor`. The planner/executor loop asks how many
 * {thought, action} steps an agent gets before it must finalize. The budget is
 * arc- and mission-size-aware (founder ruling 2026-06-13):
 *
 *   budget = roleBase + arcBonus(arc) + sizeBonus(role, plannedStepCount)   (capped)
 *
 * - Specialists keep the conservative role floor; only earned trust (arc) lifts
 *   them, and only a little.
 * - The orchestrator scales with the size of the DAG it shepherds — a 6-step
 *   mission needs more observe/dispatch cycles than a 1-step one.
 * - Everything is bounded by STEP_CEILING so a runaway budget can't blow past a
 *   hard cap (cost + safety floor).
 *
 * Pure + DB-free so the policy is unit-testable (`bun test`). The constants here
 * are the tunable autonomy knob — adjust them, the tests pin the shape.
 */
import type { Arc } from "./trust.server";

/** Hard cap no budget may exceed, whatever the inputs. */
export const STEP_CEILING = 40;

export type BudgetInput = {
  agentSlug: string;
  arc: Arc;
  /** mission_steps count for this run's mission; 0/undefined when not in a mission. */
  plannedStepCount?: number;
};

/** Conservative per-role base. Specialists are the floor; the orchestrator base
 *  preserves the proven static cap (14) so a plan+dispatch initial run never
 *  regresses, and size scales ABOVE it. */
function roleBase(slug: string): number {
  if (slug === "orchestrator") return 14;
  if (slug === "builder") return 24;
  return 6;
}

/** Earned headroom from the trust arc — observing/proving earn nothing extra. */
function arcBonus(arc: Arc): number {
  if (arc === "ambient") return 4;
  if (arc === "trusted") return 2;
  return 0;
}

/** Only the orchestrator grows with DAG size (it observes/dispatches per step). */
function sizeBonus(slug: string, plannedStepCount: number): number {
  if (slug !== "orchestrator") return 0;
  return Math.max(0, plannedStepCount) * 2;
}

export function adaptiveStepBudget(input: BudgetInput): number {
  const planned = input.plannedStepCount ?? 0;
  const raw = roleBase(input.agentSlug) + arcBonus(input.arc) + sizeBonus(input.agentSlug, planned);
  return Math.min(STEP_CEILING, raw);
}
