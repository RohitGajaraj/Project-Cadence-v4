/**
 * Governance server functions — kill-switch, mission caps, stale approvals.
 * Backs the /_authenticated/governance UI and the AppShell paused indicator.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the current pause state for a workspace + recent in-flight missions + stale approvals. */
export const getGovernanceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId?: string | null } | undefined) =>
    z.object({ workspaceId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Resolve workspace (fallback to default)
    let workspaceId = data.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }

    const [killState, systemRow, wsRow, runs, approvals] = await Promise.all([
      supabase.rpc("current_kill_state", { ws: workspaceId as unknown as string }),
      supabase.from("kill_switches").select("*").eq("scope", "system").maybeSingle(),
      workspaceId
        ? supabase
            .from("kill_switches")
            .select("*")
            .eq("scope", "workspace")
            .eq("workspace_id", workspaceId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("agent_runs")
        .select(
          "id,agent_slug,agent_name,status,tokens_used,spend_used_usd,mission_token_cap,mission_spend_cap_usd,halted_reason,created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("agent_approvals")
        .select("id,agent_slug,tool_name,status,escalation_state,expires_at,created_at,rationale")
        .eq("user_id", userId)
        .in("escalation_state", ["pending", "expired"])
        .order("expires_at", { ascending: true })
        .limit(50),
    ]);

    const ks = Array.isArray(killState.data) ? killState.data[0] : killState.data;
    return {
      workspaceId,
      killState:
        (ks as {
          system_paused?: boolean;
          workspace_paused?: boolean;
          reason?: string | null;
        } | null) ?? null,
      systemRow: systemRow.data ?? null,
      workspaceRow: wsRow.data ?? null,
      runs: runs.data ?? [],
      approvals: approvals.data ?? [],
    };
  });

const SetPauseSchema = z.object({
  workspaceId: z.string().uuid(),
  paused: z.boolean(),
  reason: z.string().max(500).optional().nullable(),
});

/** Pause/unpause a workspace. Workspace owners/admins only (enforced by RLS). */
export const setWorkspacePause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof SetPauseSchema>) => SetPauseSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("kill_switches")
      .select("id")
      .eq("scope", "workspace")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("kill_switches")
        .update({
          paused: data.paused,
          reason: data.reason ?? null,
          set_by: userId,
          set_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("kill_switches").insert({
        scope: "workspace",
        workspace_id: data.workspaceId,
        paused: data.paused,
        reason: data.reason ?? null,
        set_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Lightweight "is my workspace paused?" probe used by AppShell. */
export const getWorkspacePauseState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId?: string | null } | undefined) =>
    z.object({ workspaceId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let workspaceId = data.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }
    const { data: state } = await supabase.rpc("current_kill_state", {
      ws: workspaceId as unknown as string,
    });
    const row = Array.isArray(state) ? state[0] : state;
    const r =
      (row as {
        system_paused?: boolean;
        workspace_paused?: boolean;
        reason?: string | null;
      } | null) ?? null;
    return {
      workspaceId,
      paused: !!(r?.system_paused || r?.workspace_paused),
      systemPaused: !!r?.system_paused,
      reason: r?.reason ?? null,
    };
  });

const ExtendApprovalSchema = z.object({
  approvalId: z.string().uuid(),
  additionalHours: z.number().int().min(1).max(168),
});

/** Extend a pending approval's TTL. */
export const extendApprovalTtl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof ExtendApprovalSchema>) => ExtendApprovalSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const newExpiry = new Date(Date.now() + data.additionalHours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("agent_approvals")
      .update({ expires_at: newExpiry, escalation_state: "pending" })
      .eq("id", data.approvalId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, expires_at: newExpiry };
  });

const ResolveApprovalSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

/** Resolve a pending approval (approve / reject without executing). */
export const resolveApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof ResolveApprovalSchema>) => ResolveApprovalSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("agent_approvals")
      .update({
        status: data.decision,
        escalation_state: "resolved",
        decided_at: new Date().toISOString(),
        decided_by: userId,
      })
      .eq("id", data.approvalId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
