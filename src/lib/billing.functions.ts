/**
 * M-C billing: plan state + Stripe checkout (the monetization surface).
 *
 * The plan tier lives on workspaces.plan_tier and is changed ONLY by the Stripe
 * webhook (service-role, src/routes/api/stripe/webhook.ts). These authed server
 * functions READ the plan and START a checkout. Everything degrades gracefully
 * when Stripe is not configured yet (no STRIPE_SECRET_KEY / price ids), so the
 * surface ships before the founder provisions Stripe.
 *
 * No Stripe SDK dependency: checkout is created via Stripe's REST API over fetch,
 * which is the Cloudflare Workers friendly path.
 *
 * PRE-MIGRATION TOLERANT: plan_tier lands on the next Lovable sync. Until then the
 * read falls back to "free" and nothing throws.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
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
  /** Has the founder wired Stripe keys yet? Drives the upgrade CTA state. */
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
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

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
      // pre-migration (no plan_tier column) or transient error: default to free.
    }

    return {
      workspaceId,
      planTier,
      entitlements: entitlementsFor(planTier),
      isOwner,
      stripeConfigured,
    };
  });

const CheckoutInput = z.object({
  tier: z.enum(["pro", "team"]).default("pro"),
  workspaceId: z.string().uuid().nullable().optional(),
});

export type CheckoutResult = {
  /** false when Stripe is not configured yet (no secret / price id). */
  configured: boolean;
  /** The Stripe Checkout URL to redirect to, when a session was created. */
  url?: string;
  /** A human reason when no URL was produced (not configured, not owner, error). */
  reason?: string;
};

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof CheckoutInput> | undefined) => CheckoutInput.parse(d ?? {}))
  .handler(async ({ context, data }): Promise<CheckoutResult> => {
    const { userId } = context;
    const supabase = context.supabase as unknown as SupabaseClient;

    const secret = process.env.STRIPE_SECRET_KEY;
    const priceId =
      data.tier === "team" ? process.env.STRIPE_PRICE_TEAM : process.env.STRIPE_PRICE_PRO;
    if (!secret || !priceId) {
      return { configured: false, reason: "Billing is not configured yet." };
    }

    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId ?? null);
    if (!workspaceId) return { configured: true, reason: "No workspace is available." };

    // Owner-only: only the workspace owner can start a subscription.
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id,owner_id")
      .eq("id", workspaceId)
      .maybeSingle();
    const ownerId = (ws as { owner_id?: string } | null)?.owner_id;
    if (!ownerId || ownerId !== userId) {
      return { configured: true, reason: "Only the workspace owner can change the plan." };
    }

    const origin = getRequestHeader("origin") || process.env.APP_BASE_URL || "";
    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
    form.set("client_reference_id", workspaceId);
    form.set("metadata[workspace_id]", workspaceId);
    form.set("subscription_data[metadata][workspace_id]", workspaceId);
    form.set("success_url", `${origin}/settings?section=billing&checkout=success`);
    form.set("cancel_url", `${origin}/settings?section=billing&checkout=cancel`);

    try {
      const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const result = (await resp.json()) as { url?: string; error?: { message?: string } };
      if (!resp.ok || !result.url) {
        return { configured: true, reason: result.error?.message || "Could not start checkout." };
      }
      return { configured: true, url: result.url };
    } catch (e) {
      return { configured: true, reason: e instanceof Error ? e.message : "Checkout failed." };
    }
  });
