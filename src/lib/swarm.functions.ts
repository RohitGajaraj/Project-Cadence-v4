/**
 * Swarm HUD server function (F-AGENT-4).
 *
 * Single-roundtrip read for the /swarm page. Aggregates:
 *   - live agents + their latest run
 *   - missions in flight (planning/running, or completed in last hour)
 *   - recent agent_messages (A2A handoff feed)
 *   - pending agent_approvals (same rows /inbox sees)
 *   - event_queue last 50 + pending confirm rows
 *   - throughput strip from ai_events last 60 minutes (count, sum cost,
 *     p50 latency, 5-minute buckets)
 *   - guardrail_hits count last hour
 *
 * RLS scopes everything to the requesting user (workspace narrowed via the
 * current-workspace RPC). No mutations live here — Approve/Reject reuses
 * resolveApproval from governance.functions, Dispatch/Skip reuses
 * decideEventDispatch from reactor.functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type J = Record<string, unknown>;

export type SwarmAgent = {
  agent_id: string;
  slug: string;
  name: string;
  role: string;
  color: string;
  enabled: boolean;
  trust_arc: string | null;
  trust_score: number | null;
  latest_run: {
    run_id: string;
    status: string;
    step_index: number;
    mission_id: string | null;
    input: string;
    created_at: string;
    last_checkpoint_at: string | null;
  } | null;
};

export type SwarmMission = {
  id: string;
  title: string;
  goal: string;
  status: string;
  hop_count: number;
  created_at: string;
  updated_at: string;
  steps_total: number;
  steps_done: number;
  steps_failed: number;
};

export type SwarmHandoff = {
  id: string;
  from_agent_slug: string | null;
  to_agent_slug: string;
  kind: string;
  mission_id: string;
  task: string;
  created_at: string;
};

export type SwarmApproval = {
  id: string;
  agent_slug: string | null;
  tool_name: string;
  rationale: string | null;
  args: J;
  expires_at: string | null;
  created_at: string;
};

export type SwarmReactorEvent = {
  id: string;
  event_type: string;
  target_agent_slug: string;
  approval_mode: string;
  status: string;
  mission_id: string | null;
  run_id: string | null;
  error: string | null;
  created_at: string;
  payload: J;
};

export type SwarmThroughputBucket = {
  bucket_start: string; // ISO, 5-min aligned
  runs: number;
  cost_usd: number;
  p50_latency_ms: number;
};

export type SwarmHud = {
  workspace_id: string | null;
  generated_at: string;
  agents: SwarmAgent[];
  missions: SwarmMission[];
  handoffs: SwarmHandoff[];
  approvals: SwarmApproval[];
  reactor_events: SwarmReactorEvent[];
  throughput: {
    total_runs: number;
    total_cost_usd: number;
    p50_latency_ms: number;
    buckets: SwarmThroughputBucket[];
  };
  guardrail_hits_last_hour: number;
};

function p50(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export const getSwarmHud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId?: string | null } | undefined) => input ?? {})
  .handler(async ({ context, data }): Promise<SwarmHud> => {
    const { supabase, userId } = context;
    let workspaceId = data.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }

    const now = Date.now();
    const oneHourAgoIso = new Date(now - 60 * 60 * 1000).toISOString();

    // Fire reads in parallel — every query is RLS-scoped by user_id already.
    const [
      agentsRes,
      runsRes,
      autonomyRes,
      missionsRes,
      stepsRes,
      handoffsRes,
      approvalsRes,
      reactorRes,
      eventsRes,
      guardrailsRes,
    ] = await Promise.all([
      supabase
        .from("agents")
        .select("id,slug,name,role,color,enabled")
        .eq("user_id", userId)
        .order("name"),
      // Latest 80 runs gives us the "current" row per agent and covers an
      // active swarm comfortably without paging.
      supabase
        .from("agent_runs")
        .select("id,agent_id,agent_slug,status,step_index,mission_id,input,created_at,last_checkpoint_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("agent_autonomy")
        .select("agent_id,arc,trust_score")
        .eq("user_id", userId),
      workspaceId
        ? supabase
            .from("missions")
            .select("id,title,goal,status,hop_count,created_at,updated_at,completed_at")
            .eq("workspace_id", workspaceId)
            .or(`status.in.(planning,running,completed_with_failures),completed_at.gte.${oneHourAgoIso}`)
            .order("updated_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
      workspaceId
        ? supabase
            .from("mission_steps")
            .select("mission_id,status")
            .eq("workspace_id", workspaceId)
        : Promise.resolve({ data: [], error: null }),
      workspaceId
        ? supabase
            .from("agent_messages")
            .select("id,from_agent_slug,to_agent_slug,kind,mission_id,payload,created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("agent_approvals")
        .select("id,agent_slug,tool_name,rationale,args,expires_at,created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(30),
      workspaceId
        ? supabase
            .from("event_queue")
            .select("id,event_type,target_agent_slug,approval_mode,status,mission_id,run_id,error,created_at,payload")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("ai_events")
        .select("est_cost_usd,latency_ms,created_at")
        .eq("user_id", userId)
        .gte("created_at", oneHourAgoIso)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("guardrail_hits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", oneHourAgoIso),
    ]);

    if (agentsRes.error) throw new Error(agentsRes.error.message);
    if (runsRes.error) throw new Error(runsRes.error.message);

    const autonomyByAgent = new Map<string, { arc: string | null; trust_score: number | null }>();
    for (const row of (autonomyRes.data ?? []) as Array<{ agent_id: string; arc: string | null; trust_score: number | null }>) {
      autonomyByAgent.set(row.agent_id, { arc: row.arc, trust_score: row.trust_score });
    }

    // First run we see per agent (the list is already created_at desc).
    const latestByAgent = new Map<string, NonNullable<SwarmAgent["latest_run"]>>();
    const RUN_PRIO: Record<string, number> = { running: 0, paused: 1, queued: 2 };
    type RunRow = {
      id: string; agent_id: string | null; status: string; step_index: number | null;
      mission_id: string | null; input: string; created_at: string; last_checkpoint_at: string | null;
    };
    for (const r of (runsRes.data ?? []) as RunRow[]) {
      if (!r.agent_id) continue;
      const existing = latestByAgent.get(r.agent_id);
      if (!existing) {
        latestByAgent.set(r.agent_id, {
          run_id: r.id, status: r.status, step_index: r.step_index ?? 0,
          mission_id: r.mission_id, input: r.input, created_at: r.created_at,
          last_checkpoint_at: r.last_checkpoint_at,
        });
        continue;
      }
      // Prefer an actively-running row over a more-recent terminal one.
      const eP = RUN_PRIO[existing.status] ?? 9;
      const rP = RUN_PRIO[r.status] ?? 9;
      if (rP < eP) {
        latestByAgent.set(r.agent_id, {
          run_id: r.id, status: r.status, step_index: r.step_index ?? 0,
          mission_id: r.mission_id, input: r.input, created_at: r.created_at,
          last_checkpoint_at: r.last_checkpoint_at,
        });
      }
    }

    const agents: SwarmAgent[] = ((agentsRes.data ?? []) as Array<{
      id: string; slug: string; name: string; role: string; color: string; enabled: boolean;
    }>).map((a) => {
      const auto = autonomyByAgent.get(a.id);
      return {
        agent_id: a.id, slug: a.slug, name: a.name, role: a.role,
        color: a.color, enabled: a.enabled,
        trust_arc: auto?.arc ?? null,
        trust_score: auto?.trust_score ?? null,
        latest_run: latestByAgent.get(a.id) ?? null,
      };
    });

    // Mission step aggregates.
    const stepAgg = new Map<string, { total: number; done: number; failed: number }>();
    for (const s of (stepsRes.data ?? []) as Array<{ mission_id: string; status: string }>) {
      const cur = stepAgg.get(s.mission_id) ?? { total: 0, done: 0, failed: 0 };
      cur.total++;
      if (s.status === "done") cur.done++;
      else if (s.status === "failed") cur.failed++;
      stepAgg.set(s.mission_id, cur);
    }
    const missions: SwarmMission[] = ((missionsRes.data ?? []) as Array<{
      id: string; title: string; goal: string; status: string; hop_count: number;
      created_at: string; updated_at: string;
    }>).map((m) => {
      const a = stepAgg.get(m.id) ?? { total: 0, done: 0, failed: 0 };
      return {
        id: m.id, title: m.title, goal: m.goal, status: m.status, hop_count: m.hop_count,
        created_at: m.created_at, updated_at: m.updated_at,
        steps_total: a.total, steps_done: a.done, steps_failed: a.failed,
      };
    });

    const handoffs: SwarmHandoff[] = ((handoffsRes.data ?? []) as Array<{
      id: string; from_agent_slug: string | null; to_agent_slug: string; kind: string;
      mission_id: string; payload: J; created_at: string;
    }>).map((h) => ({
      id: h.id, from_agent_slug: h.from_agent_slug, to_agent_slug: h.to_agent_slug,
      kind: h.kind, mission_id: h.mission_id, created_at: h.created_at,
      task: typeof h.payload?.task === "string" ? (h.payload.task as string) : "",
    }));

    const approvals: SwarmApproval[] = ((approvalsRes.data ?? []) as Array<{
      id: string; agent_slug: string | null; tool_name: string; rationale: string | null;
      args: J; expires_at: string | null; created_at: string;
    }>);

    const reactor: SwarmReactorEvent[] = ((reactorRes.data ?? []) as Array<{
      id: string; event_type: string; target_agent_slug: string; approval_mode: string;
      status: string; mission_id: string | null; run_id: string | null; error: string | null;
      created_at: string; payload: J;
    }>);

    // Throughput: bucket events into 5-minute windows aligned to the start of
    // the hour-ago window so the strip is stable across refetches.
    type Evt = { est_cost_usd: number | string; latency_ms: number; created_at: string };
    const evts = ((eventsRes.data ?? []) as Evt[]);
    const BUCKET_MS = 5 * 60 * 1000;
    const windowStart = Math.floor((now - 60 * 60 * 1000) / BUCKET_MS) * BUCKET_MS;
    const bucketCount = Math.ceil((now - windowStart) / BUCKET_MS);
    const bucketAgg: { count: number; cost: number; lats: number[] }[] = Array.from(
      { length: bucketCount }, () => ({ count: 0, cost: 0, lats: [] }),
    );
    let totalCost = 0;
    const allLats: number[] = [];
    for (const e of evts) {
      const t = new Date(e.created_at).getTime();
      const idx = Math.floor((t - windowStart) / BUCKET_MS);
      if (idx < 0 || idx >= bucketCount) continue;
      const cost = typeof e.est_cost_usd === "string" ? Number(e.est_cost_usd) : (e.est_cost_usd ?? 0);
      bucketAgg[idx].count++;
      bucketAgg[idx].cost += cost;
      bucketAgg[idx].lats.push(e.latency_ms ?? 0);
      totalCost += cost;
      allLats.push(e.latency_ms ?? 0);
    }
    const buckets: SwarmThroughputBucket[] = bucketAgg.map((b, i) => ({
      bucket_start: new Date(windowStart + i * BUCKET_MS).toISOString(),
      runs: b.count,
      cost_usd: Math.round(b.cost * 1_000_000) / 1_000_000,
      p50_latency_ms: p50(b.lats),
    }));

    return {
      workspace_id: workspaceId,
      generated_at: new Date(now).toISOString(),
      agents,
      missions,
      handoffs,
      approvals,
      reactor_events: reactor,
      throughput: {
        total_runs: evts.length,
        total_cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
        p50_latency_ms: p50(allLats),
        buckets,
      },
      guardrail_hits_last_hour: guardrailsRes.count ?? 0,
    };
  });