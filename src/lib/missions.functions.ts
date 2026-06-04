/**
 * Mission server functions (Bundle 4).
 *
 * A mission groups multiple agent_runs under one operator intent. These fns
 * feed the /missions/$id page: the mission row, its ordered hops (runs), and
 * the structured A2A messages between them.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type MissionDetail = {
  mission: {
    id: string;
    title: string;
    goal: string;
    status: string;
    current_agent_id: string | null;
    hop_count: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
  };
  hops: {
    run_id: string;
    agent_slug: string;
    agent_name: string;
    status: string;
    input: string;
    output: string | null;
    created_at: string;
  }[];
  messages: {
    id: string;
    from_agent_slug: string | null;
    to_agent_slug: string;
    kind: string;
    payload: JsonValue;
    source_run_id: string | null;
    source_trace_id: string | null;
    consumed_by_run_id: string | null;
    created_at: string;
  }[];
};

export const listMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("missions")
      .select("id,title,goal,status,hop_count,current_agent_id,created_at,updated_at,completed_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { missions: data ?? [] };
  });

export const getMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { missionId: string }) =>
    z.object({ missionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<MissionDetail> => {
    const { supabase } = context;
    const { data: mission, error } = await supabase
      .from("missions")
      .select("id,title,goal,status,current_agent_id,hop_count,created_at,updated_at,completed_at")
      .eq("id", data.missionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mission) throw new Error("Mission not found");

    // Pull trace_id from the first ai_events row per run (cheap, no join).
    const { data: runs } = await supabase
      .from("agent_runs")
      .select("id,agent_slug,agent_name,status,input,output,created_at")
      .eq("mission_id", data.missionId)
      .order("created_at", { ascending: true });

    const { data: messages } = await supabase
      .from("agent_messages")
      .select("id,from_agent_slug,to_agent_slug,kind,payload,source_run_id,source_trace_id,consumed_by_run_id,created_at")
      .eq("mission_id", data.missionId)
      .order("created_at", { ascending: true });

    return {
      mission: mission as MissionDetail["mission"],
      hops: (runs ?? []).map((r) => ({
        run_id: r.id,
        agent_slug: r.agent_slug,
        agent_name: r.agent_name,
        status: r.status,
        input: r.input,
        output: r.output,
        created_at: r.created_at,
      })),
      messages: (messages ?? []) as MissionDetail["messages"],
    };
  });