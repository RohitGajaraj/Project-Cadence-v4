/**
 * Event reactor server functions (F-AGENT-3).
 *
 * Operator-facing CRUD over `event_subscriptions` + queue review actions:
 *   - listEventSubscriptions / upsertEventSubscription / deleteEventSubscription
 *   - listEventQueue (recent activity for the workspace)
 *   - decideEventDispatch (approve/reject a `confirm`-mode queue row)
 *
 * The cron tick (`/api/public/hooks/event-reactor-tick`) handles `auto`-mode
 * dispatches with the admin client; both paths share `dispatchEvent()` below.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAgentLoop } from "@/lib/ai/loop.server";
import { createMission } from "@/lib/ai/handoff.server";

const EVENT_TYPES = ["signal.created", "opportunity.scored", "prd.approved"] as const;

export const listEventSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId?: string | null } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let workspaceId = data.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }
    if (!workspaceId) return { subscriptions: [] };
    const { data: rows, error } = await supabase
      .from("event_subscriptions")
      .select("id,event_type,target_agent_slug,approval_mode,filter,enabled,is_default,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("event_type")
      .order("created_at");
    if (error) throw new Error(error.message);
    return { subscriptions: rows ?? [], workspace_id: workspaceId };
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  event_type: z.enum(EVENT_TYPES),
  target_agent_slug: z.string().min(1).max(60),
  approval_mode: z.enum(["auto", "confirm"]),
  enabled: z.boolean().optional(),
  filter: z.record(z.string(), z.unknown()).optional(),
});

export const upsertEventSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpsertSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let workspaceId = data.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }
    if (!workspaceId) throw new Error("No workspace");
    // Verify the target agent exists for this user (otherwise dispatch will fail later).
    const { data: agent } = await supabase.from("agents")
      .select("id").eq("user_id", userId).eq("slug", data.target_agent_slug).maybeSingle();
    if (!agent) throw new Error(`Unknown agent slug: ${data.target_agent_slug}`);

    const row = {
      user_id: userId,
      workspace_id: workspaceId,
      event_type: data.event_type,
      target_agent_slug: data.target_agent_slug,
      approval_mode: data.approval_mode,
      enabled: data.enabled ?? true,
      filter: (data.filter ?? {}) as unknown as Json,
    };
    if (data.id) {
      const { error } = await supabase.from("event_subscriptions")
        .update(row).eq("id", data.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await supabase.from("event_subscriptions")
      .insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (inserted as { id: string }).id };
  });

export const deleteEventSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("event_subscriptions")
      .delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEventQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId?: string | null; status?: string } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let workspaceId = data.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }
    if (!workspaceId) return { events: [] };
    let q = supabase
      .from("event_queue")
      .select("id,event_type,source_table,source_id,payload,status,approval_mode,target_agent_slug,mission_id,run_id,error,created_at,dispatched_at,decided_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });

const DecideSchema = z.object({
  eventId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

export const decideEventDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DecideSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: evt, error } = await supabase.from("event_queue")
      .select("id,user_id,workspace_id,event_type,target_agent_slug,payload,status,source_id")
      .eq("id", data.eventId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!evt) throw new Error("Event not found");
    if (evt.status !== "pending") return { ok: true, skipped: true, reason: `already ${evt.status}` };

    if (data.decision === "reject") {
      await supabase.from("event_queue").update({
        status: "skipped", decided_at: new Date().toISOString(), error: "rejected by operator",
      }).eq("id", data.eventId);
      return { ok: true, dispatched: false };
    }

    const result = await dispatchEvent(supabase, evt as EventRow, userId);
    return { ok: true, dispatched: true, ...result };
  });

// ---------- shared dispatch helper (used by server fn + cron) ----------

export type EventRow = {
  id: string; user_id: string; workspace_id: string;
  event_type: string; target_agent_slug: string;
  payload: Record<string, unknown>; source_id: string; status: string;
};

function goalForEvent(evt: EventRow): string {
  const p = evt.payload ?? {};
  const title = (p.title as string) || "(untitled)";
  switch (evt.event_type) {
    case "signal.created":
      return `New signal from ${p.source ?? "unknown"}: "${title}". Cluster it into existing themes, surface relevant opportunities, and capture any new theme it implies. Excerpt: ${(p.content as string) ?? ""}`;
    case "opportunity.scored":
      return `Opportunity "${title}" just scored ICE ${p.ice_score ?? "?"} (I${p.impact}/C${p.confidence}/E${p.ease}). Draft a PRD: problem, target user, hypothesis, scope, success metrics. Problem context: ${(p.problem as string) ?? ""}`;
    case "prd.approved":
      return `PRD "${title}" was just approved${p.github_issue_url ? ` (issue: ${p.github_issue_url})` : ""}. Plan a multi-agent execution: break it into specialist steps, dispatch the first wave, and return the plan.`;
    default:
      return `Handle ${evt.event_type} for "${title}".`;
  }
}

export async function dispatchEvent(
  supabase: SupabaseClient,
  evt: EventRow,
  actorUserId: string | null,
): Promise<{ mission_id: string | null; run_id: string | null; halted: string | null }> {
  try {
    const goal = goalForEvent(evt);
    // Find target agent in the row owner's namespace (subscriptions are
    // per-user; cron uses admin client so we must explicitly scope).
    const { data: agent } = await supabase.from("agents")
      .select("id").eq("user_id", evt.user_id).eq("slug", evt.target_agent_slug).maybeSingle();
    if (!agent) throw new Error(`Target agent '${evt.target_agent_slug}' not found for user`);

    const mission = await createMission(supabase, evt.user_id, evt.workspace_id, {
      title: `[${evt.event_type}] ${(evt.payload?.title as string) ?? evt.source_id.slice(0, 8)}`.slice(0, 200),
      goal,
      starting_agent_id: (agent as { id: string }).id,
    });

    const result = await runAgentLoop(supabase, evt.user_id, {
      agentSlug: evt.target_agent_slug,
      goal,
      missionId: mission.id,
      workspaceId: evt.workspace_id,
    });

    await supabase.from("event_queue").update({
      status: "dispatched",
      dispatched_at: new Date().toISOString(),
      decided_at: actorUserId ? new Date().toISOString() : null,
      mission_id: mission.id,
      run_id: result.run_id ?? null,
    }).eq("id", evt.id);

    const halted =
      result.halted == null ? null
      : typeof result.halted === "string" ? result.halted
      : (result.halted as { reason?: string }).reason ?? "halted";
    return { mission_id: mission.id, run_id: result.run_id ?? null, halted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("event_queue").update({
      status: "failed", dispatched_at: new Date().toISOString(), error: msg,
    }).eq("id", evt.id);
    throw e;
  }
}