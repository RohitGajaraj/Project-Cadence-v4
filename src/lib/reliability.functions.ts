/**
 * Reliability read-only server fns.
 *
 * - getReliabilitySlo: the SLO + error budget over `ai_events` (RELIABILITY-SLO). Thin I/O around the
 *   pure {@link computeSlo} engine (reliability/slo.ts). Closes `considerations.md` SRE-lens P1
 *   "SLOs/SLAs + error budgets"; complements APP-HEALTH (binary liveness) with MEASURED reliability.
 * - getRunawayMissions: missions that are spinning (RUNAWAY-DETECT). Thin I/O around the pure
 *   {@link assessMissions} detector (reliability/runaway.ts). Closes `considerations.md` AI-safety
 *   P1 "Loop/runaway detection"; the inverse of E8's stall monitor (loop-health.functions.ts).
 *
 * Both are read-only, user-scoped (RLS via `requireSupabaseAuth` + an explicit `user_id` filter,
 * matching `getCostPerOutcome` / `getAnalyticsOverview`). No writes, no agent calls, no AI spend.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeSlo,
  summarizeSlo,
  normalizeStatus,
  DEFAULT_SLO_CONFIG,
  type CallSample,
  type SloMetrics,
} from "@/lib/reliability/slo";
import {
  assessMissions,
  summarizeRunaway,
  type MissionRunStats,
  type RunawayVerdict,
} from "@/lib/reliability/runaway";

export type ReliabilitySlo = {
  /** Trailing window the metrics cover, in days. */
  windowDays: number;
  /** Total ai_events rows scored (ok + error + blocked). */
  sampleCount: number;
  /** True when the window held more than MAX_ROWS calls and only the most recent MAX_ROWS were scored. */
  truncated: boolean;
  metrics: SloMetrics;
  /** One calm operator line, or "" for a quiet window (the caller stays silent). */
  summary: string;
};

/** Cap the scan so a huge history can never turn a read into an unbounded query. */
const MAX_ROWS = 5000;

export const getReliabilitySlo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        // 1..90 days; default 7 to match the cost-per-outcome "this week" frame.
        days: z.number().int().min(1).max(90).optional(),
        // Optional target override; defaults to the conservative 99%.
        targetAvailabilityPct: z.number().min(50).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<ReliabilitySlo> => {
    const { supabase, userId } = context;
    const windowDays = data.days ?? 7;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("ai_events")
      .select("status, latency_ms")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw new Error(error.message);

    const samples: CallSample[] = (rows ?? []).map((r) => ({
      status: normalizeStatus((r as { status: unknown }).status),
      // latency_ms is `integer NOT NULL DEFAULT 0`; the engine still guards non-finite/negative.
      latencyMs: Number((r as { latency_ms: unknown }).latency_ms),
    }));

    const config = data.targetAvailabilityPct
      ? { targetAvailabilityPct: data.targetAvailabilityPct }
      : DEFAULT_SLO_CONFIG;
    const metrics = computeSlo(samples, config);

    return {
      windowDays,
      sampleCount: samples.length,
      truncated: samples.length >= MAX_ROWS,
      metrics,
      summary: summarizeSlo(metrics),
    };
  });

// ---------------------------------------------------------------------------
// RUNAWAY-DETECT: missions that are spinning.
// ---------------------------------------------------------------------------

export type RunawayReport = {
  /** Trailing window scanned, in days. */
  windowDays: number;
  /** Missions considered (within the window, up to MAX_MISSIONS). */
  missionsScanned: number;
  /** True when more than MAX_MISSIONS missions existed in the window (only the most recent scored). */
  truncated: boolean;
  /** The missions that tripped a threshold, runaway (still active) before watch (terminal). */
  flagged: RunawayVerdict[];
  /** One calm operator line, or "" when nothing tripped. */
  summary: string;
};

/** Cap the mission scan (and therefore the child fetches) so the read stays bounded. */
const MAX_MISSIONS = 200;

export const getRunawayMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<RunawayReport> => {
    const { supabase, userId } = context;
    const windowDays = data.days ?? 7;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const nowMs = Date.now();

    const { data: missions, error: mErr } = await supabase
      .from("missions")
      .select("id, status, hop_count, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_MISSIONS);
    if (mErr) throw new Error(mErr.message);

    const missionRows = missions ?? [];
    const ids = missionRows.map((r) => (r as { id: string }).id).filter(Boolean);
    if (ids.length === 0) {
      return { windowDays, missionsScanned: 0, truncated: false, flagged: [], summary: "" };
    }

    // Child aggregates for just the scanned missions (bounded by the mission cap).
    const [stepsRes, runsRes] = await Promise.all([
      supabase.from("mission_steps").select("mission_id, attempts").in("mission_id", ids),
      supabase.from("agent_runs").select("mission_id, spend_used_usd").in("mission_id", ids),
    ]);
    if (stepsRes.error) throw new Error(stepsRes.error.message);
    if (runsRes.error) throw new Error(runsRes.error.message);

    // Fold steps -> {count, totalAttempts, maxAttempts} per mission.
    const stepAgg = new Map<string, { count: number; total: number; max: number }>();
    for (const s of stepsRes.data ?? []) {
      const mid = (s as { mission_id: string }).mission_id;
      const attempts = Number((s as { attempts: unknown }).attempts ?? 0);
      const a = stepAgg.get(mid) ?? { count: 0, total: 0, max: 0 };
      a.count += 1;
      a.total += Number.isFinite(attempts) ? attempts : 0;
      a.max = Math.max(a.max, Number.isFinite(attempts) ? attempts : 0);
      stepAgg.set(mid, a);
    }

    // Fold spend per mission.
    const spendAgg = new Map<string, number>();
    for (const r of runsRes.data ?? []) {
      const mid = (r as { mission_id: string | null }).mission_id;
      if (!mid) continue;
      const spend = Number((r as { spend_used_usd: unknown }).spend_used_usd ?? 0);
      spendAgg.set(mid, (spendAgg.get(mid) ?? 0) + (Number.isFinite(spend) ? spend : 0));
    }

    const stats: MissionRunStats[] = missionRows.map((row) => {
      const r = row as {
        id: string;
        status: string | null;
        hop_count: number | null;
        created_at: string;
      };
      const steps = stepAgg.get(r.id) ?? { count: 0, total: 0, max: 0 };
      const createdMs = Date.parse(r.created_at);
      const ageMinutes = Number.isFinite(createdMs) ? Math.max(0, (nowMs - createdMs) / 60000) : 0;
      return {
        missionId: r.id,
        status: r.status ?? "unknown",
        hopCount: Number(r.hop_count ?? 0),
        stepCount: steps.count,
        totalAttempts: steps.total,
        maxStepAttempts: steps.max,
        spendUsd: spendAgg.get(r.id) ?? 0,
        ageMinutes,
      };
    });

    const flagged = assessMissions(stats);

    return {
      windowDays,
      missionsScanned: missionRows.length,
      truncated: missionRows.length >= MAX_MISSIONS,
      flagged,
      summary: summarizeRunaway(flagged),
    };
  });
