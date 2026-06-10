/**
 * Agent Trust + Autonomy Dial — TanStack server functions.
 * Read: getAllAgentTrust (batched for the roster page).
 * Write: setAgentArc (operator moves an agent along the trust arc).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeAllAgentTrust, type AgentTrust, type Arc } from "@/lib/ai/trust.server";

export type { AgentTrust, Arc };

export const getAllAgentTrust = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const trust = await computeAllAgentTrust(supabase, userId);
    return { trust };
  });

const ArcEnum = z.enum(["observing", "proving", "trusted", "ambient"]);

export const setAgentArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        agentId: z.string().uuid(),
        arc: ArcEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify the agent belongs to the user (RLS would also block, but this
    // returns a cleaner error to the UI).
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("id")
      .eq("id", data.agentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (agentErr) throw new Error(agentErr.message);
    if (!agent) throw new Error("Agent not found");

    const { error } = await supabase.from("agent_autonomy").upsert(
      {
        user_id: userId,
        agent_id: data.agentId,
        arc: data.arc,
        set_by: userId,
        set_at: new Date().toISOString(),
      },
      { onConflict: "user_id,agent_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, arc: data.arc };
  });
