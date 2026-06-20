/**
 * Admin Console v2 — People · Vouchers panel server fns + the public-facing
 * redeemVoucher fn (called from in-app "Redeem code" surfaces).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminVoucher = {
  id: string;
  code: string;
  kind: "signup" | "credit_grant" | "plan_upgrade";
  plan_tier: string | null;
  credits: number | null;
  auto_login: boolean;
  max_redemptions: number | null;
  expires_at: string | null;
  campaign_tag: string | null;
  active: boolean;
  created_at: string;
  redemptions_count: number;
};

export const adminListVouchers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { active?: boolean | null }) => d)
  .handler(async ({ context, data }): Promise<AdminVoucher[] | { error: string }> => {
    const { data: rows, error } = await context.supabase.rpc("admin_list_vouchers", {
      _active: data.active ?? null, _lim: 100, _off: 0,
    });
    if (error) return { error: error.message };
    return (rows ?? []).map((r: AdminVoucher) => ({ ...r, redemptions_count: Number(r.redemptions_count ?? 0) })) as AdminVoucher[];
  });

export const adminCreateVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    code: string; kind: "signup" | "credit_grant" | "plan_upgrade";
    planTier: string | null; credits: number | null; autoLogin: boolean;
    maxRedemptions: number | null; expiresAt: string | null; campaignTag: string | null;
  }) => d)
  .handler(async ({ context, data }): Promise<AdminVoucher | { error: string }> => {
    const { data: row, error } = await context.supabase.rpc("admin_create_voucher", {
      _code: data.code, _kind: data.kind, _plan_tier: data.planTier, _credits: data.credits,
      _auto_login: data.autoLogin, _max_redemptions: data.maxRedemptions,
      _expires_at: data.expiresAt, _campaign_tag: data.campaignTag,
    });
    if (error) return { error: error.message };
    return row as AdminVoucher;
  });

export const adminDeactivateVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_deactivate_voucher", { _id: data.id });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminListVoucherRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { voucherId: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.rpc("admin_list_voucher_redemptions", { _voucher_id: data.voucherId });
    if (error) return { error: error.message };
    return (rows ?? []) as Array<{ id: string; user_id: string; user_email: string; workspace_id: string | null; redeemed_at: string; meta: Record<string, unknown> }>;
  });

/** Public redeem: callable by any signed-in user against their own account. */
export const redeemVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string; kind?: string; credits?: number | null; plan_tier?: string | null }> => {
    const { data: res, error } = await context.supabase.rpc("redeem_voucher", { _code: data.code });
    if (error) return { ok: false, error: error.message };
    return res as { ok: boolean; error?: string; kind?: string; credits?: number | null; plan_tier?: string | null };
  });