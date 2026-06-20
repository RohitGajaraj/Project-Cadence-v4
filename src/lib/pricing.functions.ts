import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

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

export type PricingFeature = {
  id: string;
  tier: string;
  label: string;
  sort_order: number;
  active: boolean;
};

export type TopupBundle = {
  id: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
  sort_order: number;
  active: boolean;
};

export type PricingCatalog = {
  plans: PricingPlan[];
  bundles: PricingBundle[];
  features: PricingFeature[];
  topups: TopupBundle[];
};

function publicClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

/** Public read of the pricing catalog. Used by Settings (top-up bundles) and any
 *  future marketing page. RLS limits rows to `active = true`. */
export const getPricingCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<PricingCatalog> => {
    const sb = publicClient();
    const [plans, bundles, features, topups] = await Promise.all([
      sb.from("pricing_plans").select("*").order("sort_order"),
      sb.from("pricing_bundles").select("*").order("sort_order"),
      sb.from("pricing_features").select("*").order("sort_order"),
      sb.from("pricing_topup_bundles").select("*").order("sort_order"),
    ]);
    return {
      plans: (plans.data ?? []) as PricingPlan[],
      bundles: (bundles.data ?? []) as PricingBundle[],
      features: (features.data ?? []) as PricingFeature[],
      topups: (topups.data ?? []) as TopupBundle[],
    };
  },
);

/* ------- Admin server fns (all gated by has_role(_, 'admin')) ------- */

async function assertAdmin(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
) {
  const { data } = await supabase.rpc("has_role" as never, {
    _user_id: userId,
    _role: "admin",
  } as never);
  if (data !== true) throw new Error("Forbidden");
}

export const adminGetCreditsEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ enabled: boolean }> => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "credits_enabled")
      .maybeSingle();
    const v = (data as { value?: unknown } | null)?.value;
    return { enabled: v === true || v === "true" };
  });

export const adminSetCreditsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { enabled: boolean }) => data)
  .handler(async ({ data, context }): Promise<{ enabled: boolean }> => {
    const { data: ok, error } = await context.supabase.rpc(
      "admin_set_credits_enabled" as never,
      { _enabled: data.enabled } as never,
    );
    if (error) throw new Error(error.message);
    return { enabled: ok === true };
  });

export const adminUpsertTopupBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string | null;
      credits: number;
      price_cents: number;
      sort_order?: number;
      active?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc(
      "admin_upsert_topup_bundle" as never,
      {
        _id: data.id ?? null,
        _credits: data.credits,
        _price_cents: data.price_cents,
        _sort_order: data.sort_order ?? 0,
        _active: data.active ?? true,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const adminSetBundleActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; active: boolean }) => data)
  .handler(async ({ data, context }): Promise<{ active: boolean }> => {
    const { data: ok, error } = await context.supabase.rpc(
      "admin_set_bundle_active" as never,
      { _id: data.id, _active: data.active } as never,
    );
    if (error) throw new Error(error.message);
    return { active: ok === true };
  });

/** Returns whether the calling user has the admin role. Used by /admin guard. */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ admin: boolean }> => {
    const { data } = await context.supabase.rpc("has_role" as never, {
      _user_id: context.userId,
      _role: "admin",
    } as never);
    return { admin: data === true };
  });