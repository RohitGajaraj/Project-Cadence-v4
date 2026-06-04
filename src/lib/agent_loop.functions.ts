import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAgentLoop, executeApproval, type Json } from "@/lib/ai/loop.server";

const RunSchema = z.object({
  agentSlug: z.string().min(1).max(60),
  goal: z.string().min(1).max(4000),
  model: z.string().min(1).max(120).optional(),
  asMission: z.boolean().optional(),
  missionTitle: z.string().max(200).optional(),
});

export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let missionId: string | null = null;
    if (data.asMission) {
      // Resolve workspace + starting agent, create mission, then run.
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      const workspaceId = (ws as string | null) ?? null;
      const { data: agent } = await supabase.from("agents")
        .select("id").eq("user_id", userId).eq("slug", data.agentSlug).maybeSingle();
      if (workspaceId && agent) {
        const { createMission } = await import("@/lib/ai/handoff.server");
        const m = await createMission(supabase, userId, workspaceId, {
          title: data.missionTitle?.trim() || data.goal.slice(0, 80),
          goal: data.goal,
          starting_agent_id: (agent as { id: string }).id,
        });
        missionId = m.id;
      }
    }
    const result = await runAgentLoop(supabase, userId, { ...data, missionId });
    return { ...result, mission_id: missionId };
  });

export const listApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: "pending" | "approved" | "rejected" | "executed" | "failed" | "all" } | undefined) =>
    input ?? { status: "pending" as const })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase.from("agent_approvals")
      .select("id,agent_slug,tool_name,args,rationale,status,created_at,decided_at,result,error")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { approvals: rows ?? [] };
  });

const DecideSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  execute: z.boolean().optional(),
});

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DecideSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const status = data.decision === "approve" ? "approved" : "rejected";
    const { error } = await supabase.from("agent_approvals").update({
      status, decided_at: new Date().toISOString(), decided_by: userId,
    }).eq("id", data.approvalId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    if (status === "approved" && data.execute !== false) {
      const result = await executeApproval(supabase, userId, data.approvalId);
      return { ok: true, executed: true, result: result as Json };
    }
    return { ok: true, executed: false };
  });

export const listAgentMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentSlug?: string } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase.from("agent_memory")
      .select("id,agent_slug,scope,kind,content,importance,created_at,last_used_at")
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.agentSlug) q = q.eq("agent_slug", data.agentSlug);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { memories: rows ?? [] };
  });

const ForgetSchema = z.object({ memoryId: z.string().uuid() });
export const forgetMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ForgetSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("agent_memory").delete()
      .eq("id", data.memoryId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("agent_tools")
      .select("id,tool_name,display_name,description,category,mode,enabled,built_in")
      .eq("user_id", userId).order("category").order("display_name");
    if (error) throw new Error(error.message);
    return { tools: data ?? [] };
  });

const ToolModeSchema = z.object({
  toolId: z.string().uuid(),
  mode: z.enum(["auto", "confirm", "review", "off"]).optional(),
  enabled: z.boolean().optional(),
});
export const updateToolMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ToolModeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: { mode?: "auto" | "confirm" | "review" | "off"; enabled?: boolean } = {};
    if (data.mode) patch.mode = data.mode;
    if (typeof data.enabled === "boolean") patch.enabled = data.enabled;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabase.from("agent_tools").update(patch)
      .eq("id", data.toolId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });