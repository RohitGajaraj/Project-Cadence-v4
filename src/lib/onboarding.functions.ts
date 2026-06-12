/**
 * Screen 8 (F-DESIGN-EMBER) — first-run onboarding server functions.
 *
 * New file (Session B lane) so the flow never touches agents.functions /
 * briefs.functions signatures. Two jobs:
 *  - setAgentEnabled: the "Meet your staff" step toggles the REAL
 *    agents.enabled column (same field Settings → Staff manages).
 *  - completeOnboarding: merge-safe brief write + profiles.onboarded=true.
 *    upsertBrief's schema defaults omitted fields to "" — calling it naively
 *    from onboarding would wipe an existing brief, so this handler reads the
 *    current row and preserves every field it isn't setting.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setAgentEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ agentId: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // Own-row RLS scopes the update; the orchestrator is mission
    // infrastructure (planner/dispatcher), not staff — standing it down
    // would silently break every mission, so it is not toggleable here.
    const { data: agent, error: aerr } = await supabase
      .from("agents")
      .select("id,slug")
      .eq("id", data.agentId)
      .single();
    if (aerr || !agent) throw new Error("Agent not found");
    if (agent.slug === "orchestrator") {
      throw new Error("The Orchestrator runs the mission loop and cannot be stood down.");
    }
    const { data: row, error } = await supabase
      .from("agents")
      .update({ enabled: data.enabled })
      .eq("id", data.agentId)
      .select("id,slug,enabled")
      .single();
    if (error) throw new Error(error.message);
    return { agent: row };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ goal: z.string().max(2000).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const goal = data.goal?.trim();

    if (goal) {
      const { data: wsId } = await supabase.rpc("current_user_default_workspace");
      if (wsId) {
        const { data: existing } = await supabase
          .from("workspace_briefs")
          .select("mission,target_user,current_focus,anti_goals,notes")
          .eq("workspace_id", wsId)
          .maybeSingle();
        const { error: berr } = await supabase.from("workspace_briefs").upsert(
          {
            workspace_id: wsId as string,
            mission: existing?.mission ?? "",
            target_user: existing?.target_user ?? "",
            current_focus: goal,
            anti_goals: existing?.anti_goals ?? "",
            notes: existing?.notes ?? "",
            updated_by: userId,
          },
          { onConflict: "workspace_id" },
        );
        if (berr) throw new Error(berr.message);
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({ onboarded: true, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
