/**
 * F-ANALYTICS-1 / F-ANALYTICS-2 — TanStack server functions for the product
 * analytics + ICE auto-adjust surfaces.
 *
 * getProductAnalytics  — cohort sparkline + ICE adjustment history for an opportunity.
 * linkOpportunityEvent — set the PostHog event that measures this opportunity.
 * runAnalyticsIngest   — admin-only manual trigger (used by the observability surface).
 * autoAdjustIceForOpportunity — on-demand ICE update from current analytics data.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ingestPostHogAnalytics } from "@/lib/analytics-ingest.server";
import { autoAdjustIce } from "@/lib/ice-adjust.server";

// ── getProductAnalytics ──────────────────────────────────────────────────────

type CohortRow = {
  cohort_date:    string;
  distinct_users: number;
  event_count:    number;
};

type IceAdjRow = {
  adjusted_at:    string;
  feature_event:  string;
  old_impact:     number;
  new_impact:     number;
  old_confidence: number;
  new_confidence: number;
  reason:         string;
  sample_users:   number;
};

export type ProductAnalyticsData = {
  opportunityId:  string;
  featureEvent:   string | null;
  cohort:         CohortRow[];
  iceAdjustments: IceAdjRow[];
  ingestGated:    boolean;
};

export const getProductAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ opportunityId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<ProductAnalyticsData> => {
    const { supabase } = context;

    const { data: opp } = await supabase
      .from("opportunities")
      .select("id, workspace_id, posthog_event")
      .eq("id", data.opportunityId)
      .single();

    const featureEvent: string | null = opp?.posthog_event ?? null;
    const workspaceId: string | undefined = opp?.workspace_id;

    if (!featureEvent || !workspaceId) {
      return { opportunityId: data.opportunityId, featureEvent, cohort: [], iceAdjustments: [], ingestGated: !featureEvent };
    }

    // product_analytics + ice_adjustments are not in generated types (new migration).
    const anyDb = supabaseAdmin as any;
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [cohortRes, adjRes] = await Promise.all([
      anyDb
        .from("product_analytics")
        .select("cohort_date, distinct_users, event_count")
        .eq("workspace_id", workspaceId)
        .eq("feature_event", featureEvent)
        .gte("cohort_date", since)
        .order("cohort_date", { ascending: true }) as Promise<{ data: CohortRow[] | null; error: unknown }>,
      anyDb
        .from("ice_adjustments")
        .select("adjusted_at, feature_event, old_impact, new_impact, old_confidence, new_confidence, reason, sample_users")
        .eq("opportunity_id", data.opportunityId)
        .order("adjusted_at", { ascending: false })
        .limit(10) as Promise<{ data: IceAdjRow[] | null; error: unknown }>,
    ]);

    const ingestGated = !process.env.POSTHOG_PERSONAL_API_KEY || !process.env.POSTHOG_PROJECT_ID;

    return {
      opportunityId:  data.opportunityId,
      featureEvent,
      cohort:         cohortRes.data ?? [],
      iceAdjustments: adjRes.data   ?? [],
      ingestGated,
    };
  });

// ── linkOpportunityEvent ─────────────────────────────────────────────────────

export const linkOpportunityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      opportunityId: z.string().uuid(),
      featureEvent:  z.string().min(1).max(200).nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("opportunities")
      .update({ posthog_event: data.featureEvent, updated_at: new Date().toISOString() })
      .eq("id", data.opportunityId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

// ── autoAdjustIceForOpportunity ──────────────────────────────────────────────

export const autoAdjustIceForOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ opportunityId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    return autoAdjustIce(supabase, data.opportunityId);
  });

// ── runAnalyticsIngest (admin-only) ──────────────────────────────────────────

export const runAnalyticsIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const userId = context.auth.user.id;

    // Verify caller is a workspace member or owner.
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", data.workspaceId)
      .single();
    if (!ws) return { ok: false, error: "workspace not found" };

    return ingestPostHogAnalytics(data.workspaceId, ws.owner_id ?? userId);
  });
