// M-A — turn the user-wide autonomy ratio (the Gauntlet's Metric C) into a
// visible position on the observing -> proving -> trusted ladder for the Today
// card. Pure + client-safe (no server middleware), so it is unit-testable in
// isolation, mirroring gauntlet-metrics.ts.
//
// OBSERVATIONAL ONLY. The stage is a reflection of how much reversible work the
// loop already runs unattended; it is NOT a safety gate (the real gate is the
// per-agent arc in agent_autonomy, applied by resolveApprovalMode) and it is NOT
// a stored per-user tier (none exists in the domain). So the copy describes the
// stage, it never instructs the operator to "promote" agents (no advance UI
// exists yet) nor implies the system grants trust on its own (no auto-advance
// exists yet). The claim never outruns the wiring.

export type AutonomyStage = "observing" | "proving" | "trusted";

export const AUTONOMY_STAGES: readonly AutonomyStage[] = [
  "observing",
  "proving",
  "trusted",
] as const;

/** Thresholds on the unattended-share ratio (0..1): below `proving` the loop is
 *  still mostly asking; past `trusted` it carries most of the reversible work. */
export const PROVING_AT = 1 / 3;
export const TRUSTED_AT = 2 / 3;

/** Map the user-wide autonomy ratio to a stage. `null` (no side-effecting
 *  actions in the window) reads as "observing" — the honest floor, never an
 *  invented step. */
export function autonomyStage(ratio: number | null): AutonomyStage {
  if (ratio == null || ratio < PROVING_AT) return "observing";
  if (ratio < TRUSTED_AT) return "proving";
  return "trusted";
}

/** 0-based index of a stage on the ladder (for the progress strip). */
export function stageIndex(stage: AutonomyStage): number {
  return AUTONOMY_STAGES.indexOf(stage);
}

/** One plain-language line of what the stage means. A description, not an
 *  instruction: there is no advance button and no auto-advance, so this never
 *  tells the operator to promote agents nor promises the loop will climb on its
 *  own. */
export function stageMeaning(stage: AutonomyStage): string {
  switch (stage) {
    case "observing":
      return "Most side-effecting work still comes to you for a call. This is where every workspace starts.";
    case "proving":
      return "The loop now runs some reversible work unattended; the rest still comes to you.";
    case "trusted":
      return "The loop carries most of the reversible work itself; you still make the calls that matter.";
  }
}
