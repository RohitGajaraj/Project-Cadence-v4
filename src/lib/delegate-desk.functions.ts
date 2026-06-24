/**
 * DELEGATE-DESK (v11 #25) — the RLS adapter for the delegate-and-walk-away desk.
 *
 * Re-frames the workspace's missions through the lifecycle lens computed by the
 * PURE `delegate-desk.ts` model. Reads missions + their step strips (RLS-scoped
 * via the request's authed Supabase client), then composes the desk server-side
 * so the route just renders. Best-effort step enrichment: any failure degrades to
 * empty step strips (progress shows "—"), never throws the surface down.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeDelegateDesk, type DelegateDesk, type DeskMissionInput } from "@/lib/delegate-desk";

export const getDelegateDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ desk: DelegateDesk }> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("missions")
      .select("id,title,goal,status,created_at,updated_at,completed_at,current_agent_id")
      .order("updated_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const missions = data ?? [];
    if (missions.length === 0) return { desk: computeDelegateDesk([]) };

    const ids = missions.map((m) => m.id);
    // Step strips for progress: mission_steps when orchestrated, else agent_runs.
    // One batched query each across all missions; failure degrades to empty steps.
    const stepsByMission = new Map<string, { status: string }[]>();
    const runsByMission = new Map<string, { status: string }[]>();
    try {
      const [{ data: planSteps }, { data: runs }] = await Promise.all([
        supabase
          .from("mission_steps")
          .select("mission_id,idx,status")
          .in("mission_id", ids)
          .order("idx", { ascending: true }),
        supabase
          .from("agent_runs")
          .select("mission_id,status,created_at")
          .in("mission_id", ids)
          .order("created_at", { ascending: true }),
      ]);
      for (const s of planSteps ?? []) {
        const arr = stepsByMission.get(s.mission_id) ?? [];
        arr.push({ status: s.status });
        stepsByMission.set(s.mission_id, arr);
      }
      for (const r of runs ?? []) {
        if (!r.mission_id) continue;
        const arr = runsByMission.get(r.mission_id) ?? [];
        arr.push({ status: r.status });
        runsByMission.set(r.mission_id, arr);
      }
    } catch (e) {
      console.error("[delegate-desk] step enrichment failed (degrading):", e);
    }

    const rows: DeskMissionInput[] = missions.map((m) => ({
      id: m.id,
      title: m.title,
      goal: m.goal,
      status: m.status,
      created_at: m.created_at,
      updated_at: m.updated_at,
      completed_at: m.completed_at,
      current_agent_id: m.current_agent_id,
      steps: stepsByMission.get(m.id) ?? runsByMission.get(m.id) ?? [],
      cost_usd: null,
    }));
    return { desk: computeDelegateDesk(rows) };
  });
