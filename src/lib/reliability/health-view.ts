/**
 * R4 (Settings > Health) — pure roll-up of the two shipped reliability reads into one
 * calm operator headline. Folds {@link ReliabilitySlo} (RELIABILITY-SLO) + {@link RunawayReport}
 * (RUNAWAY-DETECT) into a single state + headline + signal lines so the self-serve Settings
 * surface can say "are my agents healthy?" in one glance, then show the numbers below.
 *
 * Pure + total: type-only imports keep this free of the server-fn/Supabase runtime, so it is
 * unit-testable. Distinct from the silent-when-healthy Missions glance — Settings is a deliberate
 * "show me" surface, so a healthy window still gets an explicit, reassuring headline (never blank).
 */
import type { ReliabilitySlo, RunawayReport } from "@/lib/reliability.functions";

export type HealthState = "healthy" | "attention" | "unknown";

export type HealthRollup = {
  state: HealthState;
  /** One plain-language line for the top of the card. Humanized (no em/en dashes). */
  headline: string;
  /** Calm supporting lines, most urgent first. Empty when there is nothing to note. */
  signals: string[];
};

/**
 * Roll the SLO + runaway reads into a single health verdict.
 *
 * - Neither answered yet (loading, or both reads errored) -> "unknown": never a false "healthy".
 * - A spinning (active runaway) mission OR a strained AI error budget -> "attention".
 * - Otherwise -> "healthy". Terminal "watch" missions are informational (review, not urgent), so
 *   they surface as a signal but never escalate the state.
 */
export function summarizeHealth(
  slo: ReliabilitySlo | undefined,
  runaway: RunawayReport | undefined,
): HealthRollup {
  if (!slo && !runaway) {
    return {
      state: "unknown",
      headline: "Reliability data will appear once your agents start running.",
      signals: [],
    };
  }

  const spinning = runaway?.flagged.filter((f) => f.severity === "runaway").length ?? 0;
  const watch = runaway?.flagged.filter((f) => f.severity === "watch").length ?? 0;
  const budgetStatus = slo?.metrics.budget.status;
  const budgetStrained = budgetStatus === "warning" || budgetStatus === "exhausted";

  const signals: string[] = [];
  if (spinning > 0) {
    signals.push(`${spinning} mission${spinning === 1 ? "" : "s"} spinning right now`);
  }
  if (budgetStrained && slo) {
    signals.push(
      budgetStatus === "exhausted"
        ? `AI error budget spent, ${slo.metrics.availabilityPct}% of calls succeeded`
        : `AI error budget running low, ${slo.metrics.availabilityPct}% of calls succeeded`,
    );
  }
  if (watch > 0) {
    signals.push(`${watch} finished mission${watch === 1 ? "" : "s"} to review`);
  }

  if (spinning > 0 || budgetStrained) {
    return { state: "attention", headline: "A few things need a look.", signals };
  }
  // The SLO budget is the primary health signal. If only the runaway read has answered (and it is
  // clean), we cannot yet claim "healthy" without over-claiming on an unread budget. Honor the
  // "never a false healthy" contract: report unknown until the primary read resolves.
  if (!slo && runaway && watch === 0) {
    return { state: "unknown", headline: "Checking AI call health now.", signals: [] };
  }
  return { state: "healthy", headline: "Everything looks healthy.", signals };
}
