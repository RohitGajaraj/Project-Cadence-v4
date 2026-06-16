/**
 * Loop Health Monitor (E8) — catch a stalled loop before it bites.
 *
 * A read of the autonomous loop's vital signs: whether anything is stuck
 * (in-flight runs that should have advanced, calls that expired waiting), the
 * human queue depth, and how fresh the loop is (last signal in, last run out).
 * Read-only, RLS-scoped (every table is keyed on user_id); each probe degrades
 * to a safe default on error so the monitor can never break the surface it sits
 * on. Powers the LoopHealthBanner on the Missions surface.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A run still running/queued past this window (the resume cron runs per minute)
 *  is treated as stuck — it should have advanced or failed by now. */
const STALL_MINUTES = 30;

export type LoopHealth = {
  /** idle = at rest and clean · working = runs in flight · stalled = needs you. */
  verdict: "idle" | "working" | "stalled";
  /** Runs in running/queued past the stall window — should have advanced. */
  stalledRuns: number;
  /** Calls that expired waiting for a human (a stall symptom). */
  expiredCalls: number;
  /** Calls currently waiting on a human decision (the queue depth). */
  queueDepth: number;
  /** Runs currently running or queued. */
  inFlightRuns: number;
  /** When real signal last came in (max signals.created_at), or null. */
  lastIngestAt: string | null;
  /** When the loop last ran anything (max agent_runs.created_at), or null. */
  lastRunAt: string | null;
  stallMinutes: number;
};

export const getLoopHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LoopHealth> => {
    const { supabase, userId } = context;
    const cutoff = new Date(Date.now() - STALL_MINUTES * 60 * 1000).toISOString();

    const [queue, expired, inflight, stalled, lastSignal, lastRun] = await Promise.all([
      supabase
        .from("agent_approvals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("escalation_state", "pending"),
      supabase
        .from("agent_approvals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("escalation_state", "expired"),
      supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["running", "queued"]),
      supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["running", "queued"])
        .lt("created_at", cutoff),
      supabase
        .from("signals")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("agent_runs")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const queueDepth = queue.count ?? 0;
    const expiredCalls = expired.count ?? 0;
    const inFlightRuns = inflight.count ?? 0;
    const stalledRuns = stalled.count ?? 0;

    const verdict: LoopHealth["verdict"] =
      stalledRuns > 0 || expiredCalls > 0 ? "stalled" : inFlightRuns > 0 ? "working" : "idle";

    return {
      verdict,
      stalledRuns,
      expiredCalls,
      queueDepth,
      inFlightRuns,
      lastIngestAt: (lastSignal.data as { created_at?: string } | null)?.created_at ?? null,
      lastRunAt: (lastRun.data as { created_at?: string } | null)?.created_at ?? null,
      stallMinutes: STALL_MINUTES,
    };
  });
