/**
 * Admin Console v2 — People · Users panel server fns.
 * Every mutation is gated server-side by `has_role('admin')` inside the
 * SECURITY DEFINER RPC, which also appends a row to `admin_audit_log`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  suspended: boolean;
  plan_tier: string;
  balance_credits: number;
};

export const adminSearchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<AdminUserRow[] | { error: string }> => {
    const { data: rows, error } = await context.supabase.rpc("admin_search_users", {
      _q: data.q ?? "",
      _lim: data.limit ?? 25,
      _off: data.offset ?? 0,
    });
    if (error) return { error: error.message };
    return (rows ?? []) as AdminUserRow[];
  });

export const adminGetUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }): Promise<{ json: string } | { error: string }> => {
    const { data: detail, error } = await context.supabase.rpc("admin_get_user_detail", {
      _uid: data.userId,
    });
    if (error) return { error: error.message };
    return { json: JSON.stringify(detail ?? {}) };
  });

export const adminGrantCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; delta: number; reason: string }) => d)
  .handler(async ({ context, data }): Promise<{ balance: number } | { error: string }> => {
    const { data: bal, error } = await context.supabase.rpc("admin_grant_user_credits", {
      _uid: data.userId,
      _delta: data.delta,
      _reason: data.reason,
    });
    if (error) return { error: error.message };
    return { balance: Number(bal) };
  });

export const adminResetCreditCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_reset_user_credit_cycle", {
      _uid: data.userId,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminOverrideUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; planTier: string; expiresAt: string | null; reason: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_override_user_plan", {
      _uid: data.userId,
      _tier: data.planTier,
      _expires_at: data.expiresAt,
      _reason: data.reason,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminClearUserPlanOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_clear_user_plan_override", {
      _uid: data.userId,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminSuspendUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; suspend: boolean; reason: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_set_user_suspended", {
      _uid: data.userId,
      _suspend: data.suspend,
      _reason: data.reason,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });