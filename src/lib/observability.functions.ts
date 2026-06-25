/**
 * AFD-12: Server functions powering the admin Observability surface.
 *
 * Admin-only — all RPCs gate at the database via `has_role('admin')`. Read-only
 * fns join the new job_runs ledger, mv_decision_velocity, mv_supersession_rate,
 * and mv_agent_cost_per_decision (see migration 20260626100000_afd_observability).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { readObservabilityConfig } from "@/lib/observability/config";

export type ObservabilityStatus = {
  gateEnabled: boolean;
  vendors: {
    posthog: boolean;
    sentry: boolean;
    betterStack: boolean;
  };
  recentJobRuns: Array<{
    id: number;
    job_name: string;
    status: string;
    started_at: string;
    duration_ms: number | null;
    error_kind: string | null;
  }>;
  failureBreakdown: Array<{ failure_kind: string; count: number }>;
};

export const getObservabilityStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ObservabilityStatus | { error: string }> => {
    // Admin gate: user_roles RLS restricts rows to auth.uid(), so a hit means this user is admin.
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return { error: "Forbidden" };

    // The DB function is the source of truth for the gate.
    const { data: gate } = await context.supabase.rpc("observability_enabled");

    const [{ data: jobs }, { data: failures }] = await Promise.all([
      supabaseAdmin
        .from("job_runs")
        .select("id, job_name, status, started_at, duration_ms, error_kind")
        .order("started_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("agent_runs")
        .select("failure_kind")
        .not("failure_kind", "is", null)
        .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString())
        .limit(5000),
    ]);

    const counts = new Map<string, number>();
    for (const r of (failures ?? []) as Array<{ failure_kind: string | null }>) {
      const k = r.failure_kind ?? "unknown";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const cfg = readObservabilityConfig();
    return {
      gateEnabled: Boolean(gate),
      vendors: {
        posthog: cfg.posthog.enabled,
        sentry: cfg.sentry.enabled,
        betterStack: cfg.betterStack.enabled,
      },
      recentJobRuns: (jobs ?? []) as ObservabilityStatus["recentJobRuns"],
      failureBreakdown: Array.from(counts.entries())
        .map(([failure_kind, count]) => ({ failure_kind, count }))
        .sort((a, b) => b.count - a.count),
    };
  });

export const adminSetObservabilityEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ context, data }): Promise<{ enabled: boolean } | { error: string }> => {
    const { data: v, error } = await context.supabase.rpc("admin_set_observability_enabled", {
      _enabled: data.enabled,
    });
    if (error) return { error: error.message };
    return { enabled: Boolean(v) };
  });