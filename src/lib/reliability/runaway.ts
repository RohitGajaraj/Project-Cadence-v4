/**
 * RUNAWAY-DETECT: pure detector for missions that are SPINNING.
 *
 * Closes the `considerations.md` AI-safety-lens P1 gap "Loop/runaway detection" ("agents can spin;
 * cap + detect"). KI-15/16 added the CAPS (per-tick mission fairness + per-mission step-dispatch
 * bounds); this is the DETECT half: surface a mission whose hop/step/retry/spend has blown past
 * normal so an operator (or a future alert) sees it. It is the inverse of E8's stall monitor
 * (loop-health.functions.ts): stall = too LITTLE progress, runaway = too MUCH churn. Together they
 * bracket "the loop is misbehaving."
 *
 * Pure and deterministic (the clock is injected as `ageMinutes`), so the whole verdict is unit-tested
 * with no DB and no publish. The thin `getRunawayMissions` server fn (reliability.functions.ts) only
 * aggregates missions/mission_steps/agent_runs into {@link MissionRunStats} and runs `assessMission`.
 *
 * Calibration: these defaults are independently-chosen heuristics that sit deliberately ABOVE the
 * loop's own enforcement, so a flag means "well past normal," not "near a cap." Specifics: there is
 * no hard hop ceiling (hop_count climbs unbounded via a DB trigger), and the per-mission step
 * dispatch cap is small and per-tick (DISPATCH_CAP, default ~10), so maxSteps 50 / maxHops 20 only
 * trip on real spinning. The per-step signal stays above the default retry ceiling (max_attempts
 * defaults to 2, i.e. at most 2 dispatches per step), so a normally-exhausted retry never trips.
 */

/** Per-mission aggregate, normalized from missions + mission_steps + agent_runs. */
export type MissionRunStats = {
  missionId: string;
  /** missions.status (e.g. running | pending | done | failed | cancelled). */
  status: string;
  /** missions.hop_count: the orchestration hop counter. */
  hopCount: number;
  /** Number of mission_steps rows for the mission. */
  stepCount: number;
  /** Sum of mission_steps.attempts across the mission (each step starts at 0). */
  totalAttempts: number;
  /** Max mission_steps.attempts on any single step (a step pinned at its retry ceiling). */
  maxStepAttempts: number;
  /** Sum of agent_runs.spend_used_usd for the mission, USD. */
  spendUsd: number;
  /** Minutes since missions.created_at (injected so this module stays pure). */
  ageMinutes: number;
};

export type RunawayConfig = {
  /** hop_count strictly above this is a runaway signal. */
  maxHops: number;
  /** step count strictly above this is a runaway signal (well above the per-tick step-dispatch cap). */
  maxSteps: number;
  /** Per-mission spend (USD) strictly above this is a runaway signal. */
  maxSpendUsd: number;
  /** Excess-retry ratio: (totalAttempts - stepCount) / stepCount strictly above this is thrashing. */
  retryChurnRatio: number;
  /** A single step with at least this many attempts is a runaway signal. Kept above the default
   *  retry ceiling (max_attempts defaults to 2 = at most 2 dispatches) so a normal exhausted retry
   *  never trips; it fires only when a step is retried past the default. */
  maxStepAttemptsCeiling: number;
};

export const DEFAULT_RUNAWAY_CONFIG: RunawayConfig = {
  maxHops: 20,
  maxSteps: 50,
  maxSpendUsd: 5,
  retryChurnRatio: 1,
  maxStepAttemptsCeiling: 3,
};

/** Missions in a terminal state. Anything not listed is treated as ACTIVE (fail-loud toward visibility). */
const TERMINAL_STATUSES = new Set(["done", "completed", "failed", "cancelled", "canceled"]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** `runaway` = breached AND still active (actionable now); `watch` = breached but terminal (post-hoc). */
export type RunawaySeverity = "none" | "watch" | "runaway";

export type RunawayVerdict = {
  missionId: string;
  isRunaway: boolean;
  severity: RunawaySeverity;
  /** Human-readable, humanized reasons (no em/en dashes). Empty when severity is "none". */
  reasons: string[];
};

/** Round USD to cents for display copy. */
function usd(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Assess one mission for runaway behavior. Pure and total: any input yields a defined verdict.
 * A reason is recorded per breached threshold; severity escalates to `runaway` only while the
 * mission is still active (a terminal mission that breached is a `watch`, worth a look but not live).
 */
export function assessMission(
  stats: MissionRunStats,
  config: RunawayConfig = DEFAULT_RUNAWAY_CONFIG,
): RunawayVerdict {
  const reasons: string[] = [];

  if (stats.hopCount > config.maxHops) {
    reasons.push(`${stats.hopCount} hops (over ${config.maxHops})`);
  }
  if (stats.stepCount > config.maxSteps) {
    reasons.push(`${stats.stepCount} steps (over ${config.maxSteps})`);
  }
  // Excess retries beyond one attempt per step = thrashing. Guard the zero-step case.
  const excessRetries = stats.totalAttempts - stats.stepCount;
  if (stats.stepCount > 0 && excessRetries / stats.stepCount > config.retryChurnRatio) {
    reasons.push(`${excessRetries} retries across ${stats.stepCount} steps`);
  }
  if (stats.maxStepAttempts >= config.maxStepAttemptsCeiling) {
    reasons.push(`a step retried ${stats.maxStepAttempts} times`);
  }
  if (stats.spendUsd > config.maxSpendUsd) {
    reasons.push(`$${usd(stats.spendUsd)} spent (over $${usd(config.maxSpendUsd)})`);
  }

  const breached = reasons.length > 0;
  const severity: RunawaySeverity = !breached
    ? "none"
    : isTerminalStatus(stats.status)
      ? "watch"
      : "runaway";

  return { missionId: stats.missionId, isRunaway: breached, severity, reasons };
}

/** Assess a batch and return only the missions that tripped (severity != "none"), runaway first. */
export function assessMissions(
  batch: MissionRunStats[],
  config: RunawayConfig = DEFAULT_RUNAWAY_CONFIG,
): RunawayVerdict[] {
  const order: Record<RunawaySeverity, number> = { runaway: 0, watch: 1, none: 2 };
  return batch
    .map((s) => assessMission(s, config))
    .filter((v) => v.severity !== "none")
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

// Raw row shapes from missions / mission_steps / agent_runs, as the read paths select them.
export type RawMissionRow = {
  id: string;
  status: string | null;
  hop_count: number | null;
  created_at: string;
};
export type RawStepRow = { mission_id: string; attempts: number | null };
export type RawRunRow = { mission_id: string | null; spend_used_usd: number | null };

/**
 * Fold raw mission + step + run rows into per-mission {@link MissionRunStats}. PURE (the clock is
 * injected as `nowMs`), so both read paths (getRunawayMissions and the incidents runaway source)
 * share one tested fold and cannot drift. Non-finite/negative aggregates degrade to 0.
 */
export function buildMissionStats(
  missions: RawMissionRow[],
  steps: RawStepRow[],
  runs: RawRunRow[],
  nowMs: number,
): MissionRunStats[] {
  const stepAgg = new Map<string, { count: number; total: number; max: number }>();
  for (const s of steps) {
    const a = stepAgg.get(s.mission_id) ?? { count: 0, total: 0, max: 0 };
    const attempts = Number(s.attempts ?? 0);
    const v = Number.isFinite(attempts) && attempts >= 0 ? attempts : 0;
    a.count += 1;
    a.total += v;
    a.max = Math.max(a.max, v);
    stepAgg.set(s.mission_id, a);
  }

  const spendAgg = new Map<string, number>();
  for (const r of runs) {
    if (!r.mission_id) continue;
    const spend = Number(r.spend_used_usd ?? 0);
    spendAgg.set(
      r.mission_id,
      (spendAgg.get(r.mission_id) ?? 0) + (Number.isFinite(spend) ? spend : 0),
    );
  }

  return missions.map((m) => {
    const steps = stepAgg.get(m.id) ?? { count: 0, total: 0, max: 0 };
    const createdMs = Date.parse(m.created_at);
    const ageMinutes = Number.isFinite(createdMs) ? Math.max(0, (nowMs - createdMs) / 60000) : 0;
    return {
      missionId: m.id,
      status: m.status ?? "unknown",
      hopCount: Number(m.hop_count ?? 0),
      stepCount: steps.count,
      totalAttempts: steps.total,
      maxStepAttempts: steps.max,
      spendUsd: spendAgg.get(m.id) ?? 0,
      ageMinutes,
    };
  });
}

/**
 * One calm operator line. Authored display copy (humanized-output Tier 2: no em/en dashes, no
 * AI-cliche filler). Returns "" when nothing tripped so the caller can stay silent.
 */
export function summarizeRunaway(verdicts: RunawayVerdict[]): string {
  const runaway = verdicts.filter((v) => v.severity === "runaway").length;
  const watch = verdicts.filter((v) => v.severity === "watch").length;
  if (runaway === 0 && watch === 0) return "";
  const parts: string[] = [];
  if (runaway > 0) parts.push(`${runaway} mission${runaway === 1 ? " is" : "s are"} spinning`);
  if (watch > 0) parts.push(`${watch} to review`);
  return parts.join(" · ");
}
