/**
 * F-STUDIO — server functions for the Studio surface + agent door.
 *
 * Studio is the in-platform development engine (docs/features/studio.md).
 * Two doors, one contract:
 *   - Agent door: dispatchStudioSession (structured work order in, missionId
 *     out; the session runs unattended through the loop + tick machinery).
 *   - Human door: /studio reads sessions/steps/changesets here, steers via
 *     steerStudioSession, and clears gates with the existing decideApproval.
 *
 * Legacy equivalence: the engine agent keeps slug 'builder'; sessions list
 * includes legacy Builder missions for history continuity.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createMission } from "@/lib/ai/handoff.server";
import { recordLineage } from "@/lib/lineage.functions";
import { TOOL_REGISTRY } from "@/lib/ai/tools/registry.server";
import type { LoopStep } from "@/lib/ai/loop.server";
import { applyHunkSelection } from "@/lib/ai/studio-hunks";

export type StudioChangesetSummary = {
  id: string;
  status: "staged" | "committed" | "pr_open" | "merged" | "abandoned";
  repo: string;
  branch: string | null;
  pr_url: string | null;
  pr_number: number | null;
  title: string;
  summary: string | null;
  file_count: number;
};

export type StudioSessionListItem = {
  mission_id: string;
  title: string;
  status: string;
  goal: string;
  created_at: string;
  updated_at: string;
  run_status: string | null;
  prd: { id: string; title: string } | null;
  changeset: StudioChangesetSummary | null;
  pending_approvals: number;
  cost_usd: number;
};

export type StudioRunDetail = {
  run_id: string;
  status: string;
  model: string | null;
  created_at: string;
  last_checkpoint_at: string | null;
  step_index: number | null;
  output: string | null;
  steps: LoopStep[];
  cost_usd: number;
  tokens: number;
};

/** Serializable JSON for server-fn payloads (matches the loop's Json shape). */
export type StudioJson =
  | string
  | number
  | boolean
  | null
  | StudioJson[]
  | { [k: string]: StudioJson };

export type StudioApproval = {
  id: string;
  tool_name: string;
  args: { [k: string]: StudioJson };
  rationale: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  result: { [k: string]: StudioJson } | null;
  error: string | null;
};

export type StudioCi = {
  overall: "pending" | "success" | "failure" | "neutral";
  pr_number: number;
  pr_url: string | null;
  head_sha: string | null;
  updated_at: string | null;
  checks: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    summary: string | null;
  }>;
} | null;

const WORK_ORDER_HEADER =
  "Studio work order — plan against the connected repo, stage a multi-file changeset, ship a PR, watch CI, and request the merge on green.";

/**
 * Dispatch a Studio session (the agent door). Builds a structured work order
 * from a PRD, an opportunity, or a raw prompt; creates the mission; enqueues
 * the run (the resume-runs sweeper starts it within its next tick); records
 * the prd→mission lineage edge. Returns fast — sessions run unattended.
 */
export const dispatchStudioSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        prdId: z.string().uuid().optional(),
        opportunityId: z.string().uuid().optional(),
        prompt: z.string().min(4).max(8000).optional(),
        model: z.string().max(80).optional(),
      })
      .refine((v) => v.prdId || v.opportunityId || v.prompt, {
        message: "Pass a prdId, an opportunityId, or a prompt.",
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<{ missionId: string }> => {
    const { supabase, userId } = context;
    // New tables/columns aren't in the generated Supabase types until the
    // migration applies + types regenerate (same pattern as F-V5-LOOP-CLOSE).
    const db = supabase as unknown as SupabaseClient;

    const sections: string[] = [WORK_ORDER_HEADER];
    let sourceTitle: string | null = null;
    let workspaceId: string | null = null;

    type PrdCtx = {
      id: string;
      title: string;
      body_md: string | null;
      github_issue_url: string | null;
      workspace_id: string | null;
    };
    let prd: PrdCtx | null = null;
    if (data.prdId) {
      const { data: row, error } = await supabase
        .from("prds")
        .select("id,title,body_md,github_issue_url,workspace_id")
        .eq("id", data.prdId)
        .single();
      if (error) throw new Error(`PRD lookup failed: ${error.message}`);
      prd = row as unknown as PrdCtx;
      sourceTitle = prd.title;
      workspaceId = prd.workspace_id;
      sections.push(
        `Linked PRD (source of truth for scope): "${prd.title}" (id ${prd.id})\n\n${(prd.body_md ?? "").slice(0, 24_000)}`,
      );
      // 3-way issue resolution, same pattern as the legacy dispatch: a PRD
      // with a linked issue gives the PR its "Closes #N".
      const m = prd.github_issue_url?.match(/\/issues\/(\d+)/);
      if (m) {
        sections.push(`Linked GitHub issue: #${m[1]} — include "Closes #${m[1]}" in the PR body.`);
      }
    }

    if (data.opportunityId) {
      const { data: opp, error } = await supabase
        .from("opportunities")
        .select("id,title,problem,target_user,hypothesis,workspace_id")
        .eq("id", data.opportunityId)
        .single();
      if (error) throw new Error(`Opportunity lookup failed: ${error.message}`);
      sourceTitle = sourceTitle ?? (opp.title as string);
      workspaceId = workspaceId ?? (opp.workspace_id as string | null);
      sections.push(
        [
          `Linked opportunity: "${opp.title}" (id ${opp.id})`,
          opp.problem ? `Problem: ${opp.problem}` : "",
          opp.target_user ? `Target user: ${opp.target_user}` : "",
          opp.hypothesis ? `Hypothesis: ${opp.hypothesis}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    if (data.prompt) {
      sections.push(`Operator intent:\n${data.prompt}`);
      sourceTitle = sourceTitle ?? data.prompt.split(/\r?\n/)[0].slice(0, 80);
    }

    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }
    if (!workspaceId) throw new Error("No workspace — create or join one first.");

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", "builder")
      .maybeSingle();
    if (!agent) throw new Error("Studio agent not found in your roster.");

    const goal = sections.join("\n\n");
    const mission = await createMission(supabase, userId, workspaceId, {
      title: `Studio · ${(sourceTitle ?? "session").slice(0, 180)}`,
      goal,
      starting_agent_id: (agent as { id: string }).id,
    });

    // Enqueue (don't block the dispatch on a long session) — the resume-runs
    // sweeper promotes queued runs on its next tick. Model rides on the run
    // row so the queued start honors the switcher.
    const { error: runErr } = await db.from("agent_runs").insert({
      user_id: userId,
      agent_id: (agent as { id: string }).id,
      agent_slug: "builder",
      agent_name: "Studio",
      input: goal,
      status: "queued",
      workspace_id: workspaceId,
      mission_id: mission.id,
      model: data.model ?? null,
    });
    if (runErr) throw new Error(`Session enqueue failed: ${runErr.message}`);

    if (prd) {
      await recordLineage(supabase, userId, {
        parent_kind: "prd",
        parent_id: prd.id,
        child_kind: "mission",
        child_id: mission.id,
        relation: "dispatched",
        rationale: "Sent to Studio",
        created_by_agent: "studio",
      });
    }

    return { missionId: mission.id };
  });

/** Latest trace id per run, via the checkpoint JSON projection (no full-state read). */
async function traceByRun(
  supabase: SupabaseClient,
  runIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!runIds.length) return out;
  const { data } = await supabase
    .from("agent_run_checkpoints")
    .select("run_id, step_index, trace:state->>traceId")
    .in("run_id", runIds)
    .order("step_index", { ascending: false })
    .limit(2000);
  for (const row of (data ?? []) as { run_id: string; trace: string | null }[]) {
    if (!out.has(row.run_id) && row.trace) out.set(row.run_id, row.trace);
  }
  return out;
}

/**
 * List Studio sessions (mission-centric), including legacy Builder missions
 * for history continuity.
 */
export const listStudioSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sessions: StudioSessionListItem[] }> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;

    const { data: runs, error } = await db
      .from("agent_runs")
      .select("id,mission_id,status,created_at")
      .eq("user_id", userId)
      .eq("agent_slug", "builder")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const runRows = (runs ?? []) as { id: string; mission_id: string | null; status: string }[];
    const missionIds = [
      ...new Set(runRows.map((r) => r.mission_id).filter((m): m is string => !!m)),
    ];
    if (!missionIds.length) return { sessions: [] };

    const [{ data: missions }, { data: changesets }, { data: pendings }, { data: edges }] =
      await Promise.all([
        db
          .from("missions")
          .select("id,title,goal,status,created_at,updated_at")
          .in("id", missionIds),
        db
          .from("studio_changesets")
          .select("id,mission_id,status,repo,branch,pr_url,pr_number,title,summary,created_at")
          .in("mission_id", missionIds)
          .neq("status", "abandoned")
          .order("created_at", { ascending: false }),
        db
          .from("agent_approvals")
          .select("id,mission_id")
          .in("mission_id", missionIds)
          .eq("status", "pending"),
        db
          .from("artifact_lineage")
          .select("parent_id,child_id")
          .eq("parent_kind", "prd")
          .eq("child_kind", "mission")
          .in("child_id", missionIds),
      ]);

    // Latest non-abandoned changeset per mission + file counts in one query.
    const changesetByMission = new Map<string, StudioChangesetSummary>();
    const changesetIds: string[] = [];
    for (const cs of (changesets ?? []) as Array<
      StudioChangesetSummary & { mission_id: string | null; created_at: string }
    >) {
      if (cs.mission_id && !changesetByMission.has(cs.mission_id)) {
        changesetByMission.set(cs.mission_id, { ...cs, file_count: 0 });
        changesetIds.push(cs.id);
      }
    }
    if (changesetIds.length) {
      const { data: changeRows } = await db
        .from("studio_changes")
        .select("changeset_id")
        .in("changeset_id", changesetIds);
      const counts = new Map<string, number>();
      for (const r of (changeRows ?? []) as { changeset_id: string }[]) {
        counts.set(r.changeset_id, (counts.get(r.changeset_id) ?? 0) + 1);
      }
      for (const cs of changesetByMission.values()) cs.file_count = counts.get(cs.id) ?? 0;
    }

    const pendingByMission = new Map<string, number>();
    for (const p of (pendings ?? []) as { mission_id: string | null }[]) {
      if (p.mission_id)
        pendingByMission.set(p.mission_id, (pendingByMission.get(p.mission_id) ?? 0) + 1);
    }

    const prdByMission = new Map<string, string>();
    for (const e of (edges ?? []) as { parent_id: string; child_id: string }[]) {
      prdByMission.set(e.child_id, e.parent_id);
    }
    const prdIds = [...new Set(prdByMission.values())];
    const { data: prds } = prdIds.length
      ? await db.from("prds").select("id,title").in("id", prdIds)
      : { data: [] as { id: string; title: string }[] };
    const prdTitle = new Map(
      (prds ?? []).map((p: { id: string; title: string }) => [p.id, p.title]),
    );

    // Cost: checkpoint trace → ai_events sum (legacy and new runs alike).
    const runIds = runRows.map((r) => r.id);
    const traces = await traceByRun(supabase, runIds);
    const traceList = [...new Set(traces.values())];
    const costByTrace = new Map<string, number>();
    if (traceList.length) {
      const { data: events } = await db
        .from("ai_events")
        .select("trace_id,est_cost_usd")
        .in("trace_id", traceList);
      for (const ev of (events ?? []) as {
        trace_id: string | null;
        est_cost_usd: number | null;
      }[]) {
        if (ev.trace_id)
          costByTrace.set(
            ev.trace_id,
            (costByTrace.get(ev.trace_id) ?? 0) + (ev.est_cost_usd ?? 0),
          );
      }
    }
    const costByMission = new Map<string, number>();
    const runStatusByMission = new Map<string, string>();
    for (const r of runRows) {
      if (!r.mission_id) continue;
      if (!runStatusByMission.has(r.mission_id)) runStatusByMission.set(r.mission_id, r.status);
      const trace = traces.get(r.id);
      if (trace) {
        costByMission.set(
          r.mission_id,
          (costByMission.get(r.mission_id) ?? 0) + (costByTrace.get(trace) ?? 0),
        );
      }
    }

    const sessions = (
      (missions ?? []) as Array<{
        id: string;
        title: string;
        goal: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>
    )
      .map((m) => {
        const prdId = prdByMission.get(m.id) ?? null;
        return {
          mission_id: m.id,
          title: m.title,
          status: m.status,
          goal: m.goal,
          created_at: m.created_at,
          updated_at: m.updated_at,
          run_status: runStatusByMission.get(m.id) ?? null,
          prd: prdId ? { id: prdId, title: prdTitle.get(prdId) ?? "PRD" } : null,
          changeset: changesetByMission.get(m.id) ?? null,
          pending_approvals: pendingByMission.get(m.id) ?? 0,
          cost_usd: Number((costByMission.get(m.id) ?? 0).toFixed(4)),
        };
      })
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    return { sessions };
  });

/** Full session detail for /studio/$missionId — timeline, changeset, gates, CI, cost. */
export const getStudioSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ missionId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;

    const { data: mission, error } = await db
      .from("missions")
      .select("id,title,goal,status,created_at,updated_at,completed_at")
      .eq("id", data.missionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mission) throw new Error("Session not found");

    const { data: runs } = await db
      .from("agent_runs")
      .select("id,status,created_at,last_checkpoint_at,step_index,output")
      .eq("mission_id", data.missionId)
      .eq("agent_slug", "builder")
      .order("created_at", { ascending: true });
    const runRows = (runs ?? []) as Array<{
      id: string;
      status: string;
      model: string | null;
      created_at: string;
      last_checkpoint_at: string | null;
      step_index: number | null;
      output: string | null;
    }>;
    const runIds = runRows.map((r) => r.id);

    // Steps + trace from the latest checkpoint per run (full state read is
    // fine here — a handful of runs per session).
    const stepsByRun = new Map<string, LoopStep[]>();
    const traceOfRun = new Map<string, string>();
    if (runIds.length) {
      const { data: cps } = await db
        .from("agent_run_checkpoints")
        .select("run_id,step_index,state")
        .in("run_id", runIds)
        .order("step_index", { ascending: false });
      for (const cp of (cps ?? []) as Array<{
        run_id: string;
        state: { steps?: LoopStep[]; traceId?: string };
      }>) {
        if (!stepsByRun.has(cp.run_id) && Array.isArray(cp.state?.steps)) {
          stepsByRun.set(cp.run_id, cp.state.steps);
        }
        if (!traceOfRun.has(cp.run_id) && cp.state?.traceId) {
          traceOfRun.set(cp.run_id, cp.state.traceId);
        }
      }
    }

    // Cost per run via its trace.
    const traceList = [...new Set(traceOfRun.values())];
    const costByTrace = new Map<string, { cost: number; tokens: number }>();
    if (traceList.length) {
      const { data: events } = await db
        .from("ai_events")
        .select("trace_id,est_cost_usd,total_tokens")
        .in("trace_id", traceList);
      for (const ev of (events ?? []) as Array<{
        trace_id: string | null;
        est_cost_usd: number | null;
        total_tokens: number | null;
      }>) {
        if (!ev.trace_id) continue;
        const cur = costByTrace.get(ev.trace_id) ?? { cost: 0, tokens: 0 };
        cur.cost += ev.est_cost_usd ?? 0;
        cur.tokens += ev.total_tokens ?? 0;
        costByTrace.set(ev.trace_id, cur);
      }
    }

    // Approvals — every gate on this mission (pending ones render as inline cards).
    const { data: approvals } = await db
      .from("agent_approvals")
      .select("id,tool_name,args,rationale,status,created_at,expires_at,result,error")
      .eq("mission_id", data.missionId)
      .order("created_at", { ascending: true });

    // Active changeset + its changes (paths/ops/sizes — diffs load separately).
    const { data: csRow } = await db
      .from("studio_changesets")
      .select("id,status,repo,branch,base_sha,pr_url,pr_number,title,summary,updated_at")
      .eq("mission_id", data.missionId)
      .neq("status", "abandoned")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let changes: Array<{
      id: string;
      path: string;
      op: string;
      base_chars: number;
      new_chars: number;
      updated_at: string;
    }> = [];
    if (csRow) {
      const { data: changeRows } = await db
        .from("studio_changes")
        .select("id,path,op,base_content,new_content,updated_at")
        .eq("changeset_id", (csRow as { id: string }).id)
        .order("path");
      changes = (
        (changeRows ?? []) as Array<{
          id: string;
          path: string;
          op: string;
          base_content: string | null;
          new_content: string | null;
          updated_at: string;
        }>
      ).map((c) => ({
        id: c.id,
        path: c.path,
        op: c.op,
        base_chars: c.base_content?.length ?? 0,
        new_chars: c.new_content?.length ?? 0,
        updated_at: c.updated_at,
      }));
    }

    // Latest CI snapshot for the changeset PR (loop reads + manual refreshes).
    let ci: StudioCi = null;
    const prNumber = (csRow as { pr_number?: number | null } | null)?.pr_number ?? null;
    if (prNumber) {
      const { data: ciCalls } = await db
        .from("tool_calls")
        .select("result,created_at")
        .eq("user_id", userId)
        .eq("tool_name", "github.ci.read")
        .eq("ok", true)
        .order("created_at", { ascending: false })
        .limit(20);
      for (const tc of (ciCalls ?? []) as Array<{ result: Record<string, unknown> | null }>) {
        const r = tc.result as {
          pr_number?: number;
          overall?: string;
          pr_url?: string;
          head_sha?: string;
          updated_at?: string;
          checks?: Array<{
            name: string;
            status: string;
            conclusion: string | null;
            html_url: string;
            summary: string | null;
          }>;
        } | null;
        if (r?.pr_number === prNumber && typeof r.overall === "string") {
          ci = {
            overall: r.overall as Exclude<StudioCi, null>["overall"],
            pr_number: prNumber,
            pr_url: r.pr_url ?? (csRow as { pr_url?: string | null }).pr_url ?? null,
            head_sha: r.head_sha ?? null,
            updated_at: r.updated_at ?? null,
            checks: r.checks ?? [],
          };
          break;
        }
      }
    }

    // Steer history (shown in the timeline so the human door reads as a chat).
    const { data: steers } = await db
      .from("agent_messages")
      .select("id,payload,created_at,consumed_at")
      .eq("mission_id", data.missionId)
      .eq("kind", "steer")
      .order("created_at", { ascending: true })
      .limit(50);

    const runsDetailed: StudioRunDetail[] = runRows.map((r) => {
      const trace = traceOfRun.get(r.id);
      const usage = trace
        ? (costByTrace.get(trace) ?? { cost: 0, tokens: 0 })
        : { cost: 0, tokens: 0 };
      return {
        run_id: r.id,
        status: r.status,
        model: r.model,
        created_at: r.created_at,
        last_checkpoint_at: r.last_checkpoint_at,
        step_index: r.step_index,
        output: r.output,
        steps: stepsByRun.get(r.id) ?? [],
        cost_usd: Number(usage.cost.toFixed(4)),
        tokens: usage.tokens,
      };
    });

    return {
      mission,
      runs: runsDetailed,
      changeset: csRow
        ? { ...(csRow as Record<string, unknown>), file_count: changes.length }
        : null,
      changes,
      approvals: (approvals ?? []) as StudioApproval[],
      ci,
      steers: (
        (steers ?? []) as Array<{
          id: string;
          payload: { message?: string };
          created_at: string;
          consumed_at: string | null;
        }>
      ).map((s) => ({
        id: s.id,
        message: s.payload?.message ?? "",
        created_at: s.created_at,
        consumed: Boolean(s.consumed_at),
      })),
      total_cost_usd: Number(runsDetailed.reduce((a, r) => a + r.cost_usd, 0).toFixed(4)),
    };
  });

/**
 * Mid-session natural-language steering (the Claude Code / Cursor interaction).
 * Lands as an agent_messages 'steer' row; the loop injects unconsumed steers
 * as operator guidance at its next step.
 */
export const steerStudioSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ missionId: z.string().uuid(), message: z.string().min(1).max(2000) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: mission } = await supabase
      .from("missions")
      .select("id,workspace_id")
      .eq("id", data.missionId)
      .maybeSingle();
    if (!mission) throw new Error("Session not found");
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", "builder")
      .maybeSingle();
    if (!agent) throw new Error("Studio agent not found");
    const { error } = await supabase.from("agent_messages").insert({
      user_id: userId,
      workspace_id: (mission as { workspace_id: string }).workspace_id,
      mission_id: data.missionId,
      to_agent_id: (agent as { id: string }).id,
      to_agent_slug: "builder",
      kind: "steer",
      payload: { message: data.message },
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Per-file before/after contents for the Monaco DiffEditor. */
export const getChangesetDiff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ changesetId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data: rows, error } = await db
      .from("studio_changes")
      .select("id,path,op,base_content,new_content,updated_at")
      .eq("changeset_id", data.changesetId)
      .order("path");
    if (error) throw new Error(error.message);
    return { changes: rows ?? [] };
  });

export type StudioRevision = {
  id: string;
  revision_no: number;
  commit_sha: string;
  commit_url: string | null;
  message: string;
  files: Array<{ path: string; op: string }>;
  created_at: string;
};

/**
 * I1b: a changeset's revision history (one row per studio.commit), newest
 * first. Read-only; RLS scopes to the workspace via the parent changeset.
 */
export const getChangesetRevisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ changesetId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data: rows, error } = await db
      .from("studio_changeset_revisions")
      .select("id,revision_no,commit_sha,commit_url,message,files,created_at")
      .eq("changeset_id", data.changesetId)
      .order("revision_no", { ascending: false });
    if (error) throw new Error(error.message);
    return { revisions: (rows ?? []) as StudioRevision[] };
  });

/**
 * I1 curation: the operator rejects specific hunks of a staged file (the rejected
 * ones revert to base) before the gated commit. Only a not-yet-committed
 * changeset can be curated; once committed/merged the content is on the branch
 * and the agent must re-stage. RLS scopes both reads/writes to the workspace.
 */
export const applyStagedHunkSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        changesetId: z.string().uuid(),
        path: z.string().min(1).max(400),
        rejectedHunkIds: z.array(z.number().int().min(0).max(100_000)).max(5_000),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data: cs, error: csErr } = await db
      .from("studio_changesets")
      .select("id,status")
      .eq("id", data.changesetId)
      .maybeSingle();
    if (csErr) throw new Error(csErr.message);
    if (!cs) throw new Error("Changeset not found.");
    if ((cs as { status: string }).status !== "staged")
      throw new Error("Only a staged changeset can be curated; this one is already committed.");
    const { data: row, error: rowErr } = await db
      .from("studio_changes")
      .select("id,base_content,new_content")
      .eq("changeset_id", data.changesetId)
      .eq("path", data.path)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row) throw new Error("Staged file not found.");
    const r = row as { id: string; base_content: string | null; new_content: string | null };
    const next = applyHunkSelection(
      r.base_content ?? "",
      r.new_content ?? "",
      data.rejectedHunkIds,
    );
    const { error } = await db
      .from("studio_changes")
      .update({ new_content: next, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) throw new Error(error.message);
    return { ok: true, path: data.path, new_chars: next.length };
  });

/**
 * I1 curation: drop a whole staged file from a not-yet-committed changeset (reject the
 * entire file before commit). RLS scopes the delete to the workspace.
 */
export const rejectStagedFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ changesetId: z.string().uuid(), path: z.string().min(1).max(400) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data: cs, error: csErr } = await db
      .from("studio_changesets")
      .select("id,status")
      .eq("id", data.changesetId)
      .maybeSingle();
    if (csErr) throw new Error(csErr.message);
    if (!cs) throw new Error("Changeset not found.");
    if ((cs as { status: string }).status !== "staged")
      throw new Error("Only a staged changeset can be curated; this one is already committed.");
    const { error } = await db
      .from("studio_changes")
      .delete()
      .eq("changeset_id", data.changesetId)
      .eq("path", data.path);
    if (error) throw new Error(error.message);
    return { ok: true, path: data.path };
  });

/** Re-read CI for the session's PR (manual refresh from the PR & CI tab). */
export const refreshStudioCi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ missionId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;
    const { data: csRow } = await db
      .from("studio_changesets")
      .select("id,pr_number,workspace_id")
      .eq("mission_id", data.missionId)
      .neq("status", "abandoned")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prNumber = (csRow as { pr_number?: number | null } | null)?.pr_number;
    if (!prNumber) throw new Error("No PR on this session yet");
    const ciRead = TOOL_REGISTRY["github.ci.read"];
    const result = (await ciRead.run(
      { pr_number: prNumber },
      {
        supabase,
        userId,
        missionId: data.missionId,
        workspaceId: (csRow as { workspace_id?: string | null }).workspace_id ?? null,
      },
    )) as { [k: string]: StudioJson };
    // Persist so getStudioSession's snapshot reflects manual refreshes too.
    await db.from("tool_calls").insert({
      user_id: userId,
      tool_name: "github.ci.read",
      args: { pr_number: prNumber },
      result,
      ok: true,
      latency_ms: 0,
    });
    return { ci: result };
  });
