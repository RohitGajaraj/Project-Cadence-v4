/**
 * Server functions for the Drift Detection UI (/drift):
 * - getDriftOverview: baseline cfg, snapshot trend, open/resolved incidents
 * - runDriftNow: trigger rollup + detection synchronously
 * - updateDriftBaseline: edit thresholds & windows (upsert)
 * - resolveDriftIncident / reopenDriftIncident
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runDriftForUser } from "./ai/drift.server";

export const getDriftOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [baselineRes, snapsRes, openRes, recentRes] = await Promise.all([
      supabase.from("drift_baselines").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("drift_snapshots")
        .select("*")
        .eq("user_id", userId)
        .gte("bucket_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
        .order("bucket_date", { ascending: true }),
      supabase
        .from("drift_incidents")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("detected_at", { ascending: false }),
      supabase
        .from("drift_incidents")
        .select("*")
        .eq("user_id", userId)
        .neq("status", "open")
        .order("detected_at", { ascending: false })
        .limit(50),
    ]);
    return {
      baseline: baselineRes.data ?? null,
      snapshots: snapsRes.data ?? [],
      openIncidents: openRes.data ?? [],
      recentIncidents: recentRes.data ?? [],
    };
  });

export const runDriftNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    return await runDriftForUser(supabase, userId);
  });

const BaselineSchema = z.object({
  window_days: z.number().int().min(1).max(60),
  baseline_days: z.number().int().min(1).max(180),
  latency_pct_threshold: z.number().min(0).max(500),
  tokens_pct_threshold: z.number().min(0).max(500),
  cost_pct_threshold: z.number().min(0).max(500),
  score_pct_threshold: z.number().min(0).max(100),
  error_rate_pct_threshold: z.number().min(0).max(100),
  enabled: z.boolean(),
});

export const updateDriftBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof BaselineSchema>) => BaselineSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("drift_baselines")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveDriftIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("drift_incidents")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reopenDriftIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("drift_incidents")
      .update({ status: "open", resolved_at: null })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
