/**
 * Orchestrator server functions (F-AGENT-1).
 *
 * Two entrypoints the UI can call:
 *  - ensureOrchestrator: idempotently seeds the `orchestrator` agent + the
 *    four mission.* tools for the current user.
 *  - startOrchestratedMission: bootstrap the orchestrator if needed, then
 *    spawn a mission running the orchestrator with the given goal.
 *  - listMissionSteps: read the mission_steps for a mission (for the
 *    Swarm HUD / mission detail page).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAgentLoop } from "@/lib/ai/loop.server";
import { createMission } from "@/lib/ai/handoff.server";

export const ensureOrchestrator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("seed_orchestrator_agent", { p_user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true, agent_id: data as string };
  });

const StartSchema = z.object({
  goal: z.string().min(4).max(4000),
  title: z.string().max(200).optional(),
  model: z.string().max(120).optional(),
});

export const startOrchestratedMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => StartSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // 1. Ensure the orchestrator exists (idempotent).
    const { error: seedErr } = await supabase.rpc("seed_orchestrator_agent", { p_user_id: userId });
    if (seedErr) throw new Error(`seed orchestrator failed: ${seedErr.message}`);

    // 2. Resolve workspace + orchestrator agent.
    const { data: ws } = await supabase.rpc("current_user_default_workspace");
    const workspaceId = (ws as string | null) ?? null;
    if (!workspaceId) throw new Error("No default workspace found for user");
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", "orchestrator")
      .maybeSingle();
    if (!agent) throw new Error("Orchestrator agent not found after seeding");

    // 3. Pre-flight roster check: confirm at least one specialist exists.
    const { count: specialists } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("enabled", true)
      .neq("slug", "orchestrator");
    if ((specialists ?? 0) === 0) {
      throw new Error(
        "No specialist agents enabled. Create at least one specialist (e.g. discovery, strategist, builder) before starting an orchestrated mission.",
      );
    }

    // 4. Create the mission row.
    const mission = await createMission(supabase, userId, workspaceId, {
      title: data.title?.trim() || data.goal.slice(0, 80),
      goal: data.goal,
      starting_agent_id: (agent as { id: string }).id,
    });

    // 5. Run the orchestrator loop. It will plan + dispatch on this call;
    //    specialists run async via the resume-runs sweeper. The operator can
    //    re-invoke advanceMission to push the next round of dispatches.
    const result = await runAgentLoop(supabase, userId, {
      agentSlug: "orchestrator",
      goal: data.goal,
      model: data.model,
      missionId: mission.id,
      workspaceId,
    });

    return { mission_id: mission.id, ...result };
  });

const AdvanceSchema = z.object({
  missionId: z.string().uuid(),
  model: z.string().max(120).optional(),
});

/**
 * Re-invoke the orchestrator on an existing mission to dispatch newly-ready
 * steps (those whose deps just completed). Use after specialists report back.
 * Once the event reactor lands (F-AGENT-3) this is fired automatically.
 */
export const advanceMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AdvanceSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: mission, error: mErr } = await supabase
      .from("missions")
      .select("id,user_id,workspace_id,goal,status")
      .eq("id", data.missionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!mission) throw new Error("Mission not found");
    if (mission.status !== "running" && mission.status !== "in_progress") {
      return { skipped: true, reason: `mission already ${mission.status}` };
    }

    const result = await runAgentLoop(supabase, userId, {
      agentSlug: "orchestrator",
      goal: `Advance mission: ${mission.goal.slice(0, 200)}`,
      model: data.model,
      missionId: data.missionId,
      workspaceId: mission.workspace_id,
    });
    return { mission_id: data.missionId, ...result };
  });

const ListStepsSchema = z.object({ missionId: z.string().uuid() });

export const listMissionSteps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListStepsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("mission_steps")
      .select(
        "id,idx,agent_slug,sub_goal,depends_on,status,run_id,error,result,rationale,dispatched_at,completed_at,created_at",
      )
      .eq("mission_id", data.missionId)
      .order("idx");
    if (error) throw new Error(error.message);
    return { steps: rows ?? [] };
  });
