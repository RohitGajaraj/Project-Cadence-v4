/**
 * RELIABILITY-SLO — read-only server fn over `ai_events`.
 *
 * The thin I/O wrapper around the pure {@link computeSlo} engine (reliability/slo.ts): it pulls the
 * caller's recent AI-call outcomes (status + latency) and returns the SLO + error budget. Closes the
 * `considerations.md` SRE-lens P1 gap "SLOs/SLAs + error budgets"; complements APP-HEALTH (binary
 * liveness) with the *measured* reliability of the AI surface.
 *
 * Read-only, user-scoped (RLS via `requireSupabaseAuth` + an explicit `user_id` filter, matching its
 * siblings `getCostPerOutcome` / `getAnalyticsOverview`). No writes, no agent calls, no AI spend.
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
