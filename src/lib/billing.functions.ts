/**
 * Billing READ state. Authoritative checkout lives in payments.functions.ts
 * (embedded Stripe checkout via the Lovable connector gateway). This module
 * only resolves the caller's current plan_tier + entitlements + ownership for
 * the Settings UI, falling back gracefully if the account migration isn't live.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  entitlementsFor,
  normalizePlanTier,
  type Entitlements,
  type PlanTier,
} from "@/lib/entitlements";

async function resolveWorkspaceId(
  supabase: SupabaseClient,
  explicit: string | null | undefined,
): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabase.rpc("current_user_default_workspace");
  return (data as string | null) ?? null;
}

export type BillingState = {
  workspaceId: string | null;
  planTier: PlanTier;
  entitlements: Entitlements;
  /** Is the caller the workspace owner (the only role that can change the plan)? */
  isOwner: boolean;
  /** Is the payment gateway configured for this build (sandbox or live token present)? */
  stripeConfigured: boolean;
};

export const getBillingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId?: string | null } | undefined) =>
    z.object({ workspaceId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<BillingState> => {
    const { userId } = context;
    // Untyped cast: plan_tier is not in the generated types until the migration
    // applies (same precedent as outcome.functions.ts / decisions-share).
    const supabase = context.supabase as unknown as SupabaseClient;
    // Gateway-managed Stripe: sandbox key lands when payments are enabled,
    // live key after go-live. Either one means checkout will work.
    const stripeConfigured =
      !!process.env.STRIPE_SANDBOX_API_KEY || !!process.env.STRIPE_LIVE_API_KEY;

    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId ?? null);
    if (!workspaceId) {
      return {
        workspaceId: null,
        planTier: "free",
        entitlements: entitlementsFor("free"),
        isOwner: false,
        stripeConfigured,
      };
    }

    let planTier: PlanTier = "free";
    let isOwner = false;
    let accountId: string | null = null;
    try {
      // Post-migration: account_id is present. error (not throw) on a missing column,
      // so re-throw to hit the known-columns fallback below.
      const { data: row, error } = await supabase
        .from("workspaces")
        .select("id,owner_id,plan_tier,account_id")
        .eq("id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      const r = (row ?? {}) as {
        owner_id?: string;
        plan_tier?: string | null;
        account_id?: string | null;
      };
      planTier = normalizePlanTier(r.plan_tier); // workspace shim
      isOwner = !!r.owner_id && r.owner_id === userId;
      accountId = r.account_id ?? null;
    } catch {
      // pre-migration (no account_id column): read the known columns so isOwner still works.
      try {
        const { data: row } = await supabase
          .from("workspaces")
          .select("id,owner_id,plan_tier")
          .eq("id", workspaceId)
          .maybeSingle();
        const r = (row ?? {}) as { owner_id?: string; plan_tier?: string | null };
        planTier = normalizePlanTier(r.plan_tier);
        isOwner = !!r.owner_id && r.owner_id === userId;
      } catch {
        // transient / no plan_tier column: default to free.
      }
    }

    // WM-M2: the account's plan wins over the workspace shim once the migration lands.
    // Pre-migration (no accounts table) or for a non-account-member, this is a no-op.
    if (accountId) {
      try {
        const { data: acct } = await supabase
          .from("accounts")
          .select("plan_tier")
          .eq("id", accountId)
          .maybeSingle();
        const a = (acct ?? {}) as { plan_tier?: string | null };
        if (a.plan_tier != null) planTier = normalizePlanTier(a.plan_tier);
      } catch {
        // accounts not present yet: keep the workspace shim.
      }
    }

    return {
      workspaceId,
      planTier,
      entitlements: entitlementsFor(planTier),
      isOwner,
      stripeConfigured,
    };
  });
