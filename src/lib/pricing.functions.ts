/**
 * Pricing catalog + admin RPCs.
 *
 * `getPricingCatalog` is public to any signed-in user and powers the Plan
 * picker (tier + monthly/yearly + credit slider) and the Credits top-up
 * shelf. All admin mutations gate server-side on `has_role('admin')` via
 * SECURITY DEFINER RPCs; non-admins are rejected at the database.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PricingPlan = {
  tier: string;
  display_name: string;
  tagline: string | null;
  audience: string;
  sort_order: number;
  recommended: boolean;
  active: boolean;
};

export type PricingBundle = {
  id: string;
  tier: string;
  credits: number;
  monthly_cents: number;
  yearly_cents: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  recommended: boolean;
  active: boolean;
  sort_order: number;
};

export type TopupBundle = {
  id: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
  active: boolean;
  sort_order: number;
};

export type PricingCatalog = {
  plans: PricingPlan[];
  bundles: PricingBundle[];
  topups: TopupBundle[];
  creditsEnabled: boolean;
};

/** Public (signed-in) read of the live pricing catalog. */
export const getPricingCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PricingCatalog> => {
    const sb = context.supabase;
    const [plans, bundles, topups, flag] = await Promise.all([
      sb.from("pricing_plans").select("*").order("sort_order"),
      sb.from("pricing_bundles").select("*").order("tier").order("sort_order"),
      sb.from("pricing_topup_bundles").select("*").order("sort_order"),
      sb.from("app_settings").select("value").eq("key", "credits_enabled").maybeSingle(),
    ]);
    const creditsEnabled = !!(flag.data?.value === true || flag.data?.value === "true");
    return {
      plans: (plans.data ?? []) as PricingPlan[],
      bundles: (bundles.data ?? []) as PricingBundle[],
      topups: (topups.data ?? []) as TopupBundle[],
      creditsEnabled,
    };
  });

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; anyAdminExists: boolean }> => {
    const sb = context.supabase;
    const [mine, all] = await Promise.all([
      sb.from("user_roles").select("user_id").eq("user_id", context.userId).eq("role", "admin").maybeSingle(),
      sb.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
    ]);
    return { isAdmin: !!mine.data, anyAdminExists: (all.count ?? 0) > 0 };
  });

export const bootstrapSelfAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_bootstrap_self_as_admin");
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminSetCreditsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_set_credits_enabled", { _enabled: data.enabled });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminUpsertBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string | null;
      tier: string;
      credits: number;
      monthly_cents: number;
      yearly_cents: number;
      stripe_price_id_monthly?: string | null;
      stripe_price_id_yearly?: string | null;
      recommended?: boolean;
      active?: boolean;
      sort_order?: number;
    }) => d,
  )
  .handler(async ({ context, data }): Promise<{ id: string } | { error: string }> => {
    const { data: id, error } = await context.supabase.rpc("admin_upsert_bundle", {
      _id: data.id ?? null,
      _tier: data.tier,
      _credits: data.credits,
      _monthly_cents: data.monthly_cents,
      _yearly_cents: data.yearly_cents,
      _stripe_price_id_monthly: data.stripe_price_id_monthly ?? null,
      _stripe_price_id_yearly: data.stripe_price_id_yearly ?? null,
      _recommended: data.recommended ?? false,
      _active: data.active ?? true,
      _sort_order: data.sort_order ?? 0,
    });
    if (error) return { error: error.message };
    return { id: id as string };
  });

export const adminDeleteBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_delete_bundle", { _id: data.id });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminUpsertTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string | null;
      credits: number;
      price_cents: number;
      stripe_price_id?: string | null;
      active?: boolean;
      sort_order?: number;
    }) => d,
  )
  .handler(async ({ context, data }): Promise<{ id: string } | { error: string }> => {
    const { data: id, error } = await context.supabase.rpc("admin_upsert_topup_bundle", {
      _id: data.id ?? null,
      _credits: data.credits,
      _price_cents: data.price_cents,
      _stripe_price_id: data.stripe_price_id ?? null,
      _active: data.active ?? true,
      _sort_order: data.sort_order ?? 0,
    });
    if (error) return { error: error.message };
    return { id: id as string };
  });

export const adminDeleteTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_delete_topup_bundle", { _id: data.id });
    if (error) return { error: error.message };
    return { ok: true };
  });

export type AdminUser = { user_id: string; email: string; created_at: string };

export const adminListAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[] | { error: string }> => {
    const { data, error } = await context.supabase.rpc("admin_list_admins");
    if (error) return { error: error.message };
    return (data ?? []) as AdminUser[];
  });

export const adminAddAdminByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ context, data }): Promise<{ user_id: string } | { error: string }> => {
    const { data: uid, error } = await context.supabase.rpc("admin_add_admin_by_email", {
      _email: data.email,
    });
    if (error) return { error: error.message };
    return { user_id: uid as string };
  });

export const adminRemoveAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_remove_admin", { _user_id: data.user_id });
    if (error) return { error: error.message };
    return { ok: true };
  });

// M-C-EXPIRY: memory expiry gate (free-tier 14-day expiry of agent_memory rows)
export const getMemoryExpiryEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ enabled: boolean } | { error: string }> => {
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return { error: "Forbidden" };
    const { data, error } = await context.supabase.rpc("memory_expiry_enabled");
    if (error) return { error: error.message };
    return { enabled: Boolean(data) };
  });

export const adminSetMemoryExpiryEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ context, data }): Promise<{ enabled: boolean } | { error: string }> => {
    const { data: v, error } = await context.supabase.rpc("admin_set_memory_expiry_enabled", {
      _enabled: data.enabled,
    });
    if (error) return { error: error.message };
    return { enabled: Boolean(v) };
  });