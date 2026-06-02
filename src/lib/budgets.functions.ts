/**
 * Server functions for the Budgets UI (/budgets) and header BudgetBar:
 * - getBudgetOverview: global cap + usage, surface caps + usage, recent alerts
 * - updateGlobalBudget: caps + alert_at_pct
 * - upsertSurfaceBudget / deleteSurfaceBudget
 * - acknowledgeAlert
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBudgetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [g, s, a] = await Promise.all([
      supabase.from("ai_budgets").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("ai_surface_budgets").select("*").eq("user_id", userId).order("surface"),
      supabase.from("ai_budget_alerts").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      global: g.data ?? null,
      surfaces: s.data ?? [],
      alerts: a.data ?? [],
    };
  });

const GlobalSchema = z.object({
  daily_usd_cap: z.number().min(0).nullable(),
  monthly_usd_cap: z.number().min(0).nullable(),
  daily_token_cap: z.number().int().min(0).nullable(),
  monthly_token_cap: z.number().int().min(0).nullable(),
  alert_at_pct: z.number().int().min(1).max(100),
});

export const updateGlobalBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof GlobalSchema>) => GlobalSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("ai_budgets").select("id").eq("user_id", userId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("ai_budgets").update(data).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("ai_budgets").insert({ user_id: userId, ...data });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const SurfaceSchema = z.object({
  surface: z.string().min(1).max(40),
  daily_usd_cap: z.number().min(0).nullable(),
  monthly_usd_cap: z.number().min(0).nullable(),
  enabled: z.boolean(),
});

export const upsertSurfaceBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof SurfaceSchema>) => SurfaceSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ai_surface_budgets")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id,surface" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSurfaceBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { surface: string }) => z.object({ surface: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ai_surface_budgets").delete()
      .eq("user_id", userId).eq("surface", data.surface);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ai_budget_alerts").update({ acknowledged: true })
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lightweight summary for header badge — just the global daily/monthly usage vs cap. */
export const getBudgetSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("ai_budgets")
      .select("daily_usd_cap,monthly_usd_cap,daily_usd_used,monthly_usd_used,day_window,month_window,alert_at_pct")
      .eq("user_id", userId).maybeSingle();
    return data ?? null;
  });