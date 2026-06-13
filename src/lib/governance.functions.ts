/**
 * Governance server functions — kill-switch, mission caps, stale approvals.
 * Backs the /_authenticated/governance UI and the AppShell paused indicator.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeApproval, type Json } from "@/lib/ai/loop.server";

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
  // v6 Phase 0 / W3 — optional human note on the call (Appendix D: "Reject
  // (+reason)"). Persisted best-effort to agent_approvals.decision_reason.
  reason: z.string().max(2000).optional().nullable(),
});

/* ————— Ember Editorial (screen 5 · Govern) — additive exports only ————— */

/**
 * Mission concurrency cap. Mirrors MAX_RUNNING_PER_WORKSPACE in
 * src/lib/ai/loop.server.ts (not exported there — keep the two in sync).
 * When the workspace is at capacity, new goals land as status 'queued'.
 */
export const MISSION_CONCURRENCY_CAP = 5;

/**
 * Approvals queue for the Govern surface, enriched for the reference
 * ApprovalCard: mission title (for "in {mission}" + the Mission ↗ link),
 * a risk grade, and the real median human response time.
 *
 * Risk grade = the oversight mode the user configured for the tool in
 * agent_tools — production's own vocabulary (loop.server.ts names its
 * force-review set "HIGH_RISK"): review → high · confirm → medium ·
 * auto → low. No invented numbers; absent tools default to medium, the
 * loop's own default mode.
 */
export const listGovernApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // mission_id postdates the generated Supabase types — untyped client +
    // explicit row casts, the studio.functions.ts precedent.
    const db = supabase as unknown as SupabaseClient;
    type ApprovalRow = {
      id: string;
      agent_slug: string | null;
      tool_name: string;
      args: Json;
      rationale: string | null;
      status: string;
      escalation_state: string | null;
      expires_at: string | null;
      created_at: string;
      decided_at: string | null;
      error: string | null;
      mission_id: string | null;
    };
    // Pre-migration tolerant (the api/chat.ts precedent): mission_id lands
    // with 20260612100000 via the Lovable sync; until it applies, retry the
    // select without the column so the queue still renders.
    const baseColumns =
      "id,agent_slug,tool_name,args,rationale,status,escalation_state,expires_at,created_at,decided_at,error";
    let rows: Partial<ApprovalRow>[] | null = null;
    let error: { message: string } | null = null;
    ({ data: rows, error } = await db
      .from("agent_approvals")
      .select(`${baseColumns},mission_id`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50));
    if (error && /mission_id/.test(error.message)) {
      ({ data: rows, error } = await db
        .from("agent_approvals")
        .select(baseColumns)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50));
    }
    if (error) throw new Error(error.message);
    const approvals = (rows ?? []).map((a) => ({
      ...a,
      mission_id: a.mission_id ?? null,
    })) as ApprovalRow[];

    const missionIds = [
      ...new Set(approvals.map((a) => a.mission_id).filter((id): id is string => Boolean(id))),
    ];
    const toolNames = [...new Set(approvals.map((a) => a.tool_name))];
    const [missions, tools] = await Promise.all([
      missionIds.length
        ? supabase.from("missions").select("id,title").in("id", missionIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      toolNames.length
        ? supabase
            .from("agent_tools")
            .select("tool_name,mode")
            .eq("user_id", userId)
            .in("tool_name", toolNames)
        : Promise.resolve({ data: [] as { tool_name: string; mode: string }[] }),
    ]);
    const titleOf = new Map((missions.data ?? []).map((m) => [m.id, m.title]));
    const riskOf = new Map(
      (tools.data ?? []).map((t) => [
        t.tool_name,
        t.mode === "review" ? "high" : t.mode === "auto" ? "low" : "medium",
      ]),
    );

    // Median human response time across decided approvals — real timestamps only.
    const waits = approvals
      .filter((a) => a.decided_at)
      .map((a) => new Date(a.decided_at as string).getTime() - new Date(a.created_at).getTime())
      .filter((ms) => Number.isFinite(ms) && ms >= 0)
      .sort((x, y) => x - y);
    const medianResponseMs = waits.length ? waits[Math.floor(waits.length / 2)] : null;

    return {
      approvals: approvals.map((a) => ({
        ...a,
        mission_title: a.mission_id ? (titleOf.get(a.mission_id) ?? null) : null,
        risk: riskOf.get(a.tool_name) ?? "medium",
      })),
      medianResponseMs,
    };
  });

/**
 * Resolve a pending approval. Approving also EXECUTES the tool — same
 * semantics as agent_loop's decideApproval, so every approval surface (Today
 * calls queue, governance, Studio) behaves identically. Audit finding: an
 * approve-without-execute left F-STUDIO's paused runs blocked forever
 * (status 'approved' never reaches 'executed', so the sweeper never resumes).
 */
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

    // Record the human's note on the call (Appendix D). Best-effort: the
    // decision_reason column lands via a Phase 0 migration — tolerate its
    // absence so the decision is never blocked before Lovable applies it.
    // `as never` escapes the pre-migration generated types without `any`.
    if (data.reason && data.reason.trim()) {
      try {
        await supabase
          .from("agent_approvals")
          .update({ decision_reason: data.reason.trim().slice(0, 2000) } as never)
          .eq("id", data.approvalId)
          .eq("user_id", userId);
      } catch {
        // missing column pre-migration — the decision stands without the note
      }
    }

    if (data.decision === "approved") {
      // executeApproval flips the row to executed/failed itself; its failure
      // is surfaced to the caller but the decision stays recorded.
      const result = await executeApproval(supabase, userId, data.approvalId);
      return { ok: true, executed: true, result: result as Json };
    }
    return { ok: true, executed: false };
  });
