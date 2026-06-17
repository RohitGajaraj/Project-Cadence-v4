import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// C4/E7 · Agent inspector data — the recent run history for one agent, so the
// operator can see what a given agent has actually been doing. Read-only,
// RLS-scoped (agent_runs is keyed on user_id, with an explicit filter as
// defense-in-depth and for the index). A null or errored query yields no rows.

export type AgentRun = {
  id: string;
  status: string | null;
  mission_id: string | null;
  step_index: number | null;
  created_at: string | null;
};

export const getAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ agentId: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }): Promise<{ runs: AgentRun[] }> => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("agent_runs")
      .select("id,status,mission_id,step_index,created_at")
      .eq("user_id", userId)
      .eq("agent_id", data.agentId)
      .order("created_at", { ascending: false })
      .limit(25);
    const runs: AgentRun[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      status: (r.status as string | null) ?? null,
      mission_id: (r.mission_id as string | null) ?? null,
      step_index: (r.step_index as number | null) ?? null,
      created_at: (r.created_at as string | null) ?? null,
    }));
    return { runs };
  });
