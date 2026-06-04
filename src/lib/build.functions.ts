/**
 * Bundle 9 Slice 1 — Build Console server fns.
 *
 * Read-only view over agent_runs WHERE agent_slug='builder' joined to the
 * github.pr.open tool_call result (PR url, number, branch, path) and any
 * pending agent_approvals for that run. Feeds the /build page.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BuilderRun = {
  run_id: string;
  mission_id: string | null;
  mission_title: string | null;
  goal: string;
  status: string;
  created_at: string;
  last_checkpoint_at: string | null;
  pr: { number: number; url: string; branch: string; path: string } | null;
  pending_approvals: number;
};

export const listBuilderRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ runs: BuilderRun[] }> => {
    const { supabase, userId } = context;

    const { data: runs, error } = await supabase
      .from("agent_runs")
      .select("id,mission_id,input,status,created_at,last_checkpoint_at")
      .eq("user_id", userId)
      .eq("agent_slug", "builder")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const rows = (runs ?? []) as {
      id: string; mission_id: string | null; input: string; status: string;
      created_at: string; last_checkpoint_at: string | null;
    }[];
    if (rows.length === 0) return { runs: [] };

    const missionIds = [...new Set(rows.map((r) => r.mission_id).filter((m): m is string => !!m))];
    const { data: missions } = missionIds.length
      ? await supabase.from("missions").select("id,title").in("id", missionIds)
      : { data: [] as { id: string; title: string }[] };
    const titleByMission = new Map((missions ?? []).map((m) => [m.id, m.title]));

    // Pull github.pr.open results for these runs via trace_id (joined through latest checkpoint).
    const runIds = rows.map((r) => r.id);
    const { data: cps } = await supabase
      .from("agent_run_checkpoints")
      .select("run_id,state,step_index")
      .in("run_id", runIds)
      .order("step_index", { ascending: false });
    const traceByRun = new Map<string, string>();
    for (const cp of (cps ?? []) as { run_id: string; state: Record<string, unknown>; step_index: number }[]) {
      if (traceByRun.has(cp.run_id)) continue;
      const t = (cp.state as { traceId?: string }).traceId;
      if (typeof t === "string" && t.length > 0) traceByRun.set(cp.run_id, t);
    }
    const traceIds = [...traceByRun.values()];
    const { data: tcs } = traceIds.length
      ? await supabase
          .from("tool_calls")
          .select("trace_id,tool_name,result,ok")
          .in("trace_id", traceIds)
          .eq("tool_name", "github.pr.open")
      : { data: [] as { trace_id: string; tool_name: string; result: unknown; ok: boolean }[] };
    const prByTrace = new Map<string, { number: number; url: string; branch: string; path: string }>();
    for (const t of (tcs ?? []) as { trace_id: string; result: { number?: number; url?: string; branch?: string; path?: string } | null; ok: boolean }[]) {
      if (!t.ok || !t.result) continue;
      const r = t.result;
      if (typeof r.number === "number" && typeof r.url === "string" && typeof r.branch === "string" && typeof r.path === "string") {
        prByTrace.set(t.trace_id, { number: r.number, url: r.url, branch: r.branch, path: r.path });
      }
    }

    // Count pending approvals per run (Builder PR opens are confirm-gated).
    const { data: apps } = await supabase
      .from("agent_approvals")
      .select("id,run_id,status")
      .in("run_id", runIds)
      .eq("status", "pending");
    const pendingByRun = new Map<string, number>();
    for (const a of (apps ?? []) as { run_id: string | null }[]) {
      if (!a.run_id) continue;
      pendingByRun.set(a.run_id, (pendingByRun.get(a.run_id) ?? 0) + 1);
    }

    return {
      runs: rows.map((r) => {
        const trace = traceByRun.get(r.id);
        return {
          run_id: r.id,
          mission_id: r.mission_id,
          mission_title: r.mission_id ? titleByMission.get(r.mission_id) ?? null : null,
          goal: r.input,
          status: r.status,
          created_at: r.created_at,
          last_checkpoint_at: r.last_checkpoint_at,
          pr: trace ? prByTrace.get(trace) ?? null : null,
          pending_approvals: pendingByRun.get(r.id) ?? 0,
        };
      }),
    };
  });