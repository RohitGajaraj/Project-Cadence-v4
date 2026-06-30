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
import { runAgentLoop } from "@/lib/ai/loop.server";
import {
  applyHunkSelection,
  evaluateFileSetPolicy,
  matchesTouchList,
  type FileSetPolicyReport,
} from "@/lib/ai/studio-hunks";
import { summarizeInspection } from "@/lib/ai/studio-inspection";
import { callModel } from "@/lib/ai/runtime.server";
import { humanizeText } from "@/lib/ai/humanize";
import { revertChangesetToRevision } from "@/lib/ai/studio-revert.server";
import { runRollbackRelease, ghHeaders } from "@/lib/studio-rollbacks";
import { pickChangesetForPrd } from "@/lib/studio-ship";
import { resolveGitHub } from "@/lib/connectors/providers/github.server";
import { execGateFromChecks, type ExecGate } from "@/lib/exec/provider";

export type StudioChangesetSummary = {
  id: string;
  product_id: string | null;
  status: "staged" | "committed" | "pr_open" | "merged" | "abandoned";
  repo: string;
  branch: string | null;
  pr_url: string | null;
  pr_number: number | null;
  title: string;
  summary: string | null;
  file_count: number;
  release_notes?: string | null;
  release_notes_at?: string | null;
};

/** F-BUILDER-MULTIFILE: the changeset's declared touch list + max-files cap. */
export type StudioConstraints = {
  allowed_paths: string[];
  max_files: number | null;
} | null;

/** F-BUILDER-MULTIFILE: the staged file set evaluated against its policy. */
export type StudioFileSetPolicy = FileSetPolicyReport;

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
  /** SESSION-ORG: soft-archived (hidden from the default Build list). */
  archived: boolean;
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
  /**
   * SANDBOX: the merge gate derived THROUGH the `ExecProvider` seam — which
   * backend ran the checks + the plain-language merge readiness, so the Build
   * surface reads the same verdict the `studio.pr.merge` gate enforces, and a
   * future paid backend updates provenance with no surface change.
   */
  gate: ExecGate;
} | null;

/**
 * SANDBOX: the $0 self-contained preview of a Build's output. The best standalone
 * HTML file the changeset produced, rendered in a sandboxed iframe on the Preview
 * tab. `null` when the changeset has no standalone-renderable file — the common
 * case for multi-file repo PRs, whose LIVE preview needs the sandbox backend
 * (the founder-gated Cloudflare adapter), surfaced as the pane's empty state.
 */
export type StudioPreview = {
  path: string;
  /** The file's generated contents, rendered as the iframe `srcDoc`. */
  html: string;
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
        // F-BUILDER-MULTIFILE: optional pre-declared touch list + max-files cap.
        allowedPaths: z.array(z.string().max(400)).max(200).optional(),
        maxFiles: z.number().int().min(1).max(1000).optional(),
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
      if (/delegat|external.?agent|openhands/i.test(data.prompt)) {
        sections.push(
          "Delegation available: the operator wants external delegation. Call the `delegate.openhands` TOOL directly (NOT `agent.handoff`). Required args: task (string), repo_url (full GitHub URL), base_branch (e.g. 'main'). evidence_ids (array of {kind, id} pairs) is OPTIONAL: cite research/memory rows when they exist, but if the repo is new or empty there is nothing to cite — pass an empty list and proceed, do NOT manufacture a signal or any other row just to populate it. The human approval gate is the real guardrail. If existing code is present, a quick repo.search/repo.read to ground the task is good practice, but a failed or empty repo.tree (an empty repo returns HTTP 409) is expected for greenfield work and is not a blocker.",
        );
      }
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

    // F-BUILDER-MULTIFILE: persist the pre-declared touch list + cap (mission-
    // keyed, so it is in place before the agent lazily creates the changeset).
    // Best-effort: if the constraints table has not been synced yet, dispatch
    // must still succeed and the operator can re-declare on the Changes tab.
    const declaredPaths = (data.allowedPaths ?? []).map((p) => p.trim()).filter(Boolean);
    if (declaredPaths.length || (data.maxFiles ?? null) !== null) {
      await db.from("studio_changeset_constraints").insert({
        mission_id: mission.id,
        workspace_id: workspaceId,
        user_id: userId,
        allowed_paths: declaredPaths,
        max_files: data.maxFiles ?? null,
      });
    }

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
  .inputValidator((i: unknown) =>
    z
      .object({ includeArchived: z.boolean().optional() })
      .optional()
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ sessions: StudioSessionListItem[] }> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;
    const includeArchived = data?.includeArchived ?? false;

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
          .select("id,title,goal,status,created_at,updated_at,archived_at")
          .in("id", missionIds),
        db
          .from("studio_changesets")
          .select(
            "id,product_id,mission_id,status,repo,branch,pr_url,pr_number,title,summary,created_at",
          )
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
        archived_at: string | null;
      }>
    )
      // SESSION-ORG: hide archived sessions unless explicitly requested.
      .filter((m) => includeArchived || !m.archived_at)
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
          archived: !!m.archived_at,
        };
      })
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    return { sessions };
  });

/**
 * SESSION-ORG: soft-archive / un-archive a Build session — reversible, keeps
 * everything. The safe default for tidying the list. Owner-only (the "Owners can
 * write their missions" RLS policy scopes the UPDATE to the caller's own rows).
 */
export const setStudioSessionArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ missionId: z.string().uuid(), archived: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { error } = await db
      .from("missions")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.missionId);
    if (error) throw new Error(error.message);
    return { ok: true, archived: data.archived };
  });

/**
 * SESSION-ORG: hard-delete a Build session. Removes the build's WORKING artifacts
 * — deleting the mission CASCADEs its steps, changesets (→ staged files), and
 * messages, and we delete its runs (→ checkpoints / idempotency keys) explicitly
 * since `agent_runs` has no mission FK. But the typed DECISION memory is
 * `ON DELETE SET NULL`, so what was decided/learned SURVIVES in the Brain (it just
 * detaches from this build). Deleting a build never erases the moat; forgetting
 * memory is a separate, deliberate act. Owner-only via the same RLS policy.
 */
export const deleteStudioSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ missionId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    // Mission first: its delete throws on failure (so nothing is half-removed) and
    // CASCADEs the working artifacts (steps / changesets / messages) while SET-NULLing
    // decisions, so the memory survives. Then best-effort clean up the now-orphaned
    // runs (agent_runs has no mission FK). If THAT step fails, the leftover runs are
    // invisible (the mission is gone, so the session no longer lists), never a ghost.
    const { error } = await db.from("missions").delete().eq("id", data.missionId);
    if (error) throw new Error(error.message);
    await db.from("agent_runs").delete().eq("mission_id", data.missionId);
    return { ok: true };
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
      .select(
        "id,product_id,status,repo,branch,base_sha,pr_url,pr_number,title,summary,release_notes,release_notes_at,updated_at",
      )
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

    // F-BUILDER-MULTIFILE: the changeset's declared touch list + cap, evaluated
    // against the staged files so the Changes tab can surface what is out of
    // scope / over the cap. A missing constraints table (pre-sync) just yields
    // an unconstrained policy rather than erroring the whole session read.
    let constraints: StudioConstraints = null;
    {
      const { data: conRow, error: conErr } = await db
        .from("studio_changeset_constraints")
        .select("allowed_paths,max_files")
        .eq("mission_id", data.missionId)
        .maybeSingle();
      if (!conErr && conRow) {
        const c = conRow as { allowed_paths: string[] | null; max_files: number | null };
        constraints = { allowed_paths: c.allowed_paths ?? [], max_files: c.max_files ?? null };
      }
    }
    const fileSetPolicy: StudioFileSetPolicy = evaluateFileSetPolicy({
      paths: changes.map((c) => c.path),
      allowedPaths: constraints?.allowed_paths ?? null,
      maxFiles: constraints?.max_files ?? null,
    });

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
          const checks = r.checks ?? [];
          ci = {
            overall: r.overall as Exclude<StudioCi, null>["overall"],
            pr_number: prNumber,
            pr_url: r.pr_url ?? (csRow as { pr_url?: string | null }).pr_url ?? null,
            head_sha: r.head_sha ?? null,
            updated_at: r.updated_at ?? null,
            checks,
            // Derive the merge gate through the ExecProvider seam (the $0 GitHub
            // Actions floor today). `overallFromChecks(checks)` here equals the
            // stored r.overall (same snapshot), so the gate cannot drift from the
            // verdict shown above it.
            gate: execGateFromChecks(checks),
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

    // BLD-05 Inspector gate: the test + preview summary the operator sees before
    // clearing the merge gate (warn-only on no tests; never hard-blocks).
    const inspection = summarizeInspection({
      paths: changes.map((c) => c.path),
      ciOverall: ci?.overall ?? null,
      ciCheckCount: ci?.checks.length ?? 0,
    });

    return {
      mission,
      runs: runsDetailed,
      changeset: csRow
        ? { ...(csRow as Record<string, unknown>), file_count: changes.length }
        : null,
      changes,
      constraints,
      fileSetPolicy,
      approvals: (approvals ?? []) as StudioApproval[],
      ci,
      inspection,
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
 * BYO-P3 WI2 — the studio changeset that best represents what shipped for a PRD.
 * Prefers a direct prd_id link (stamped at creation by the
 * studio_changeset_link_prd trigger); falls back to resolving the PRD's
 * dispatched missions via artifact_lineage for changesets that predate the
 * trigger. Among candidates, picks the one closest to shipped (merged > pr_open
 * > committed > staged, newest wins). Read-only; RLS scopes to the workspace.
 */
export type ChangesetByPrd = {
  id: string;
  product_id: string | null;
  status: string;
  repo: string | null;
  branch: string | null;
  base_sha: string | null;
  pr_url: string | null;
  pr_number: number | null;
  title: string | null;
  summary: string | null;
  release_notes: string | null;
  release_notes_at: string | null;
  prd_id: string | null;
  mission_id: string | null;
  updated_at: string | null;
};

export const getChangesetByPrd = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ prdId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<{ changeset: ChangesetByPrd | null }> => {
    const db = context.supabase as unknown as SupabaseClient;
    const cols =
      "id,product_id,status,repo,branch,base_sha,pr_url,pr_number,title,summary,release_notes,release_notes_at,prd_id,mission_id,updated_at";

    const { data: direct, error: dErr } = await db
      .from("studio_changesets")
      .select(cols)
      .eq("prd_id", data.prdId)
      .order("updated_at", { ascending: false });
    if (dErr) throw new Error(dErr.message);

    let candidates = (direct ?? []) as unknown as ChangesetByPrd[];

    // Fallback for changesets whose prd_id was never stamped: resolve via the
    // dispatch lineage edge (prd → mission), then by mission_id.
    if (!candidates.length) {
      const { data: edges } = await db
        .from("artifact_lineage")
        .select("child_id")
        .eq("parent_kind", "prd")
        .eq("parent_id", data.prdId)
        .eq("child_kind", "mission");
      const missionIds = Array.from(
        new Set((edges ?? []).map((e) => e.child_id as string).filter(Boolean)),
      );
      if (missionIds.length) {
        const { data: byMission, error: mErr } = await db
          .from("studio_changesets")
          .select(cols)
          .in("mission_id", missionIds)
          .order("updated_at", { ascending: false });
        if (mErr) throw new Error(mErr.message);
        candidates = (byMission ?? []) as unknown as ChangesetByPrd[];
      }
    }

    const changeset = pickChangesetForPrd(candidates);
    return { changeset: changeset ?? null };
  });

/**
 * K2: revert the changeset's branch to a prior revision's file state. Operator
 * door for the rollback in `studio-revert.server.ts` (non-destructive: a forward
 * commit restoring the target tree). Resolves GitHub auth for the changeset's
 * workspace, then delegates to the shared helper. The operator initiating it IS
 * the authorization (the same human-in-the-loop posture as the agent's gates).
 */
export const revertToRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ changesetId: z.string().uuid(), revisionId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;
    const { data: csRow, error: csErr } = await db
      .from("studio_changesets")
      .select("id,workspace_id,branch,status")
      .eq("id", data.changesetId)
      .maybeSingle();
    if (csErr) throw new Error(csErr.message);
    if (!csRow) throw new Error("Changeset not found.");
    const cs = csRow as { id: string; workspace_id: string | null; branch: string | null };
    if (!cs.branch)
      throw new Error("This changeset has no commits yet, so there is nothing to revert to.");
    const { token, repo } = await resolveGitHub({
      userId,
      workspaceId: cs.workspace_id,
      userClient: db,
    });
    return await revertChangesetToRevision({
      supabase: db,
      userId,
      token,
      repo,
      changesetId: cs.id,
      branch: cs.branch,
      revisionId: data.revisionId,
    });
  });

/**
 * K2: roll back a merged release by synthesizing an inverse changeset.
 * Reads touched paths from the merge commit's parent (GitHub parent SHA),
 * reconstructs the undo (create->delete, update->restore, delete->create),
 * and creates a new rollback mission + revert changeset. The revert flows
 * through the existing commit->PR->J2-gated-merge rails. Returns the rollback
 * mission ID so the UI can navigate to it.
 */
export const rollbackRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        changesetId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      })
      .parse(i),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ rollbackId: string; revertChangesetId: string; revertMissionId: string }> => {
      const { supabase, userId } = context;
      const db = supabase as unknown as SupabaseClient;
      const result = await runRollbackRelease(db, userId, data);

      // Drive the staged revert through the existing Build rails: a Build agent
      // run on the rollback mission calls studio.commit -> studio.pr.open (each
      // confirm-gated for the operator). Mirrors build.functions.ts dispatch.
      // The loop returns once it hits the first approval gate; the operator then
      // clears the gates from the revert mission's build session.
      const goal = [
        "A revert changeset has already been staged on this mission (the inverse of a merged release).",
        "Commit the staged changes with studio.commit, then open a pull request with studio.pr.open.",
        "Do not stage new edits or modify any files - only commit what is already staged and open the PR.",
      ].join(" ");
      await runAgentLoop(db, userId, {
        agentSlug: "builder",
        goal,
        missionId: result.revertMissionId,
      });

      return result;
    },
  );

/**
 * K2 R3: kill an in-flight changeset (staged/committed/pr_open).
 * Closes any open PR, releases builder_file_claims, and marks the changeset abandoned.
 * Idempotent: safe to call multiple times.
 */
export const abandonChangeset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        changesetId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<{ success: boolean }> => {
    const db = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    // Fetch changeset
    const { data: csRow } = await db
      .from("studio_changesets")
      .select("id,status,repo,pr_number,branch,mission_id,workspace_id")
      .eq("id", data.changesetId)
      .maybeSingle();
    if (!csRow) throw new Error("Changeset not found.");
    const cs = csRow as {
      id: string;
      status: string;
      repo: string;
      pr_number: number | null;
      branch: string | null;
      mission_id: string | null;
      workspace_id: string | null;
    };
    if (!["staged", "committed", "pr_open"].includes(cs.status)) {
      throw new Error(`Cannot abandon a ${cs.status} changeset.`);
    }

    // Resolve GitHub auth via the connector chain (same as studio.commit), only
    // when we actually touch GitHub. Avoids the wrong process.env.GITHUB_TOKEN path.
    const headers =
      cs.pr_number || cs.branch
        ? ghHeaders(
            (await resolveGitHub({ userId, workspaceId: cs.workspace_id, userClient: db })).token,
          )
        : null;

    // Close PR if open
    if (cs.pr_number && headers) {
      const prUrl = `https://api.github.com/repos/${cs.repo}/pulls/${cs.pr_number}`;
      try {
        await fetch(prUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ state: "closed" }),
        });
      } catch (error) {
        console.error("Failed to close PR (best effort):", error);
      }
    }

    // Delete branch (best effort)
    if (cs.branch && headers) {
      const branchUrl = `https://api.github.com/repos/${cs.repo}/git/refs/heads/${encodeURIComponent(cs.branch)}`;
      try {
        await fetch(branchUrl, { method: "DELETE", headers });
      } catch (error) {
        console.error("Failed to delete branch (best effort):", error);
      }
    }

    // Release file claims
    if (cs.mission_id) {
      const { error: claimsErr } = await db
        .from("builder_file_claims")
        .update({
          status: "released",
          released_reason: "rollback_abandon",
          released_at: new Date().toISOString(),
        })
        .eq("mission_id", cs.mission_id)
        .eq("status", "held");
      if (claimsErr) console.error("Failed to release claims:", claimsErr.message);
    }

    // Abandon the changeset
    const { error: upErr } = await db
      .from("studio_changesets")
      .update({ status: "abandoned", updated_at: new Date().toISOString() })
      .eq("id", cs.id);
    if (upErr) throw new Error(upErr.message);

    return { success: true };
  });

/**
 * K2 R2: fetch rollback history for a product.
 * Pre-migration tolerant: returns empty array if table doesn't exist yet.
 */
export const getRollbacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      rollbacks: Array<{
        id: string;
        original_changeset_id: string;
        original_pr_number: number | null;
        revert_changeset_id: string | null;
        revert_pr_number: number | null;
        reason: string;
        status: string;
        note: string | null;
        created_at: string;
      }>;
    }> => {
      const db = context.supabase as unknown as SupabaseClient;

      // Pre-migration tolerance: a missing table/column resolves to an empty list,
      // not a throw. PostgREST returns PGRST205 (missing table) / PGRST204 (missing
      // column); direct Postgres returns 42P01. None of these contain "does not exist".
      const isMissingRelation = (code: string | undefined | null) =>
        code === "42P01" || code === "PGRST205" || code === "PGRST204";

      try {
        // Two FKs to the same table must be aliased and disambiguated by the FK
        // name; PostgREST returns each under its alias as a to-one object (not a
        // positional array on a shared `studio_changesets` key).
        const { data: rows, error } = await db
          .from("studio_rollbacks")
          .select(
            `id,
            original_changeset_id,
            revert_changeset_id,
            reason,
            status,
            note,
            created_at,
            original:studio_changesets!original_changeset_id(pr_number),
            revert:studio_changesets!revert_changeset_id(pr_number,status)`,
          )
          .eq("product_id", data.productId)
          .order("created_at", { ascending: false });

        if (error) {
          if (isMissingRelation(error.code)) return { rollbacks: [] };
          throw new Error(error.message);
        }

        type CsEmbed = { pr_number: number | null; status?: string | null };
        type RollbackRow = {
          id: string;
          original_changeset_id: string;
          revert_changeset_id: string | null;
          reason: string;
          status: string;
          note: string | null;
          created_at: string;
          // PostgREST returns a to-one embed as an object, but supabase-js types
          // embeds as arrays; accept either shape and normalize with one().
          original?: CsEmbed | CsEmbed[] | null;
          revert?: CsEmbed | CsEmbed[] | null;
        };
        const one = (v: CsEmbed | CsEmbed[] | null | undefined): CsEmbed | null =>
          Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
        const rollbacks = ((rows ?? []) as unknown as RollbackRow[]).map((r) => {
          const revert = one(r.revert);
          return {
            id: r.id,
            original_changeset_id: r.original_changeset_id,
            original_pr_number: one(r.original)?.pr_number ?? null,
            revert_changeset_id: r.revert_changeset_id,
            revert_pr_number: revert?.pr_number ?? null,
            reason: r.reason,
            // Show 'reverted' only when the revert changeset has actually merged;
            // otherwise the stored status ('initiated' / 'failed'). Avoids claiming
            // a revert shipped when it is still staged or in review.
            status: revert?.status === "merged" ? "reverted" : r.status,
            note: r.note,
            created_at: r.created_at,
          };
        });

        return { rollbacks };
      } catch (error) {
        if (isMissingRelation((error as { code?: string } | null)?.code)) {
          return { rollbacks: [] };
        }
        throw error;
      }
    },
  );

/**
 * K2 R2: generate (or regenerate) a humanized rollback note via the AI chokepoint.
 * Mirrors generateReleaseNotes pattern: factual, under 150 words, no em-dashes or fingerprints.
 */
export const generateRollbackNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        rollbackId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<{ note: string }> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;

    // Fetch rollback + original + revert changesets
    const { data: rbRow, error: rbErr } = await db
      .from("studio_rollbacks")
      .select("id,original_changeset_id,reason,workspace_id")
      .eq("id", data.rollbackId)
      .maybeSingle();
    if (rbErr) throw new Error(rbErr.message);
    if (!rbRow) throw new Error("Rollback not found.");
    const rb = rbRow as {
      id: string;
      original_changeset_id: string;
      reason: string;
      workspace_id: string | null;
    };

    const { data: origCS } = await db
      .from("studio_changesets")
      .select("id,title,pr_number")
      .eq("id", rb.original_changeset_id)
      .maybeSingle();
    const oc = origCS as { title?: string | null; pr_number?: number | null } | null;
    const origTitle = oc?.title || "Untitled";
    const origPr = oc?.pr_number || "?";

    const { data: changes } = await db
      .from("studio_changes")
      .select("path,op")
      .eq("changeset_id", rb.original_changeset_id);
    const fileList = ((changes ?? []) as Array<{ path: string; op: string }>)
      .map((c) => `${c.op} ${c.path}`)
      .join(", ");

    const system =
      "You write concise, factual rollback summaries. Output GitHub-flavored markdown: one line stating the revert, then a short 'Reverted' section listing the paths and their ops (created/updated/deleted). Note any caveats (hard restore, may conflict). Under 150 words. No marketing tone.";
    const user = [
      `Reversing PR #${origPr}: "${origTitle}"`,
      `Reason: ${rb.reason}`,
      `Files: ${fileList}`,
    ].join("\n");

    const result = await callModel(supabase, userId, {
      surface: "studio",
      surface_ref: `rollback-note:${rb.id}`,
      model: "google/gemini-2.5-flash",
      workspaceId: rb.workspace_id,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    if (result.status !== "ok" || !result.output.trim()) {
      throw new Error(result.error || "Rollback-note generation failed.");
    }
    const note = result.output.trim();

    const { error: upErr } = await db
      .from("studio_rollbacks")
      .update({ note, updated_at: new Date().toISOString() })
      .eq("id", rb.id);
    if (upErr) throw new Error(upErr.message);

    return { note };
  });

/**
 * K1: generate (or regenerate) release notes for a changeset. Factual notes
 * drawn ONLY from the changeset's files + commit revisions + linked work order,
 * via the AI chokepoint (the runtime sanitizer humanizes the output). Persisted
 * on the changeset so they are operator-reviewable and stable across views.
 * Deploy itself is external (Lovable); this is the ship artifact, not a trigger.
 */
export const generateReleaseNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ changesetId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<{ release_notes: string }> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;

    const { data: csRow, error: csErr } = await db
      .from("studio_changesets")
      .select("id,workspace_id,mission_id,repo,branch,title,summary")
      .eq("id", data.changesetId)
      .maybeSingle();
    if (csErr) throw new Error(csErr.message);
    if (!csRow) throw new Error("Changeset not found.");
    const cs = csRow as {
      id: string;
      workspace_id: string | null;
      mission_id: string | null;
      repo: string;
      branch: string | null;
      title: string | null;
      summary: string | null;
    };

    const { data: fileRows } = await db
      .from("studio_changes")
      .select("path,op")
      .eq("changeset_id", cs.id)
      .order("path");
    const { data: revRows } = await db
      .from("studio_changeset_revisions")
      .select("revision_no,message")
      .eq("changeset_id", cs.id)
      .order("revision_no", { ascending: true });
    const files = (fileRows ?? []) as Array<{ path: string; op: string }>;
    const revs = (revRows ?? []) as Array<{ revision_no: number; message: string }>;
    if (files.length === 0 && revs.length === 0)
      throw new Error("Nothing to describe yet: stage and commit changes first.");

    let workOrder = "";
    if (cs.mission_id) {
      const { data: m } = await db
        .from("missions")
        .select("title,goal")
        .eq("id", cs.mission_id)
        .maybeSingle();
      const mm = m as { title?: string | null; goal?: string | null } | null;
      workOrder = (mm?.goal ?? mm?.title ?? "").slice(0, 4000);
    }

    const fileList = files.map((f) => `${f.op} ${f.path}`).join("\n") || "(none recorded)";
    // Cap each commit message (untrusted: an agent or member authored it) so a
    // crafted message can't dominate or hijack the release-notes prompt.
    const commits = revs.map((r) => `r${r.revision_no}: ${r.message.slice(0, 500)}`).join("\n");
    const system =
      "You write concise, factual software release notes. Output GitHub-flavored markdown: a one-line summary, then a short bulleted 'What changed' grounded ONLY in the provided files and commit messages, then a 'Notable' line only if warranted. No marketing tone, no hype, no invented features or claims. Under 180 words.";
    const user = [
      cs.title ? `Title: ${cs.title}` : "",
      cs.summary ? `Summary: ${cs.summary}` : "",
      workOrder ? `Work order context:\n${workOrder}` : "",
      `Files changed:\n${fileList}`,
      commits ? `Commits:\n${commits}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await callModel(supabase, userId, {
      surface: "studio",
      surface_ref: `release-notes:${cs.id}`,
      model: "google/gemini-2.5-flash",
      workspaceId: cs.workspace_id,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    if (result.status !== "ok" || !result.output.trim())
      throw new Error(result.error || "Release-notes generation failed.");
    const notes = result.output.trim();

    const { error: upErr } = await db
      .from("studio_changesets")
      .update({ release_notes: notes, release_notes_at: new Date().toISOString() })
      .eq("id", cs.id);
    if (upErr) throw new Error(upErr.message);
    return { release_notes: notes };
  });

export type LaunchKit = {
  changelog: string;
  blog: string;
  email: string;
  social: string;
  docs: string;
};

/**
 * LCH-01 / L1: draft a launch kit from a shipped changeset. One AI pass turns the
 * release notes + title + work order + file list into five human-approved
 * artifacts (changelog, blog, email, social, docs) in plain markdown. It NEVER
 * sends anything - outbound delivery is a separate, founder-gated step; this only
 * drafts copy for the operator to review and use. Ephemeral by design (no
 * persistence, no migration); regenerate any time. Every artifact is run through
 * humanizeText so the JSON-mode output still clears the no-AI-fingerprint gate.
 */
export const generateLaunchKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ changesetId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<LaunchKit> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;

    const { data: csRow, error: csErr } = await db
      .from("studio_changesets")
      .select("id,workspace_id,mission_id,title,summary,release_notes")
      .eq("id", data.changesetId)
      .maybeSingle();
    if (csErr) throw new Error(csErr.message);
    if (!csRow) throw new Error("Changeset not found.");
    const cs = csRow as {
      id: string;
      workspace_id: string | null;
      mission_id: string | null;
      title: string | null;
      summary: string | null;
      release_notes: string | null;
    };

    const { data: fileRows } = await db
      .from("studio_changes")
      .select("path,op")
      .eq("changeset_id", cs.id)
      .order("path");
    const files = (fileRows ?? []) as Array<{ path: string; op: string }>;
    if (!cs.release_notes && !cs.title && files.length === 0)
      throw new Error(
        "Nothing to announce yet: commit the changeset (and generate release notes) first.",
      );

    let workOrder = "";
    if (cs.mission_id) {
      const { data: m } = await db
        .from("missions")
        .select("title,goal")
        .eq("id", cs.mission_id)
        .maybeSingle();
      const mm = m as { title?: string | null; goal?: string | null } | null;
      workOrder = (mm?.goal ?? mm?.title ?? "").slice(0, 2000);
    }
    const fileList = files.map((f) => `${f.op} ${f.path}`).join("\n") || "(none recorded)";

    const system =
      "You are a product marketer drafting a launch kit for a shipped change. Ground EVERY claim ONLY in the provided release notes, title, work order, and file list. Never invent features, numbers, or benefits. Return STRICT JSON only with exactly these string fields: changelog (one or two factual lines), blog (120 to 180 words: who it helps and why, with one soft call to action), email (a subject line on the first line, then an 80 to 120 word body), social (three short variants for Twitter, LinkedIn, and a team channel, each under 280 characters, separated by a blank line), docs (a 100 to 150 word 'How to use it' section). Plain language, no hype, no em dashes.";
    const user = [
      cs.title ? `Title: ${cs.title}` : "",
      cs.summary ? `Summary: ${cs.summary}` : "",
      workOrder ? `Work order:\n${workOrder}` : "",
      cs.release_notes ? `Release notes:\n${cs.release_notes.slice(0, 3000)}` : "",
      `Files changed:\n${fileList}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await callModel(supabase, userId, {
      surface: "studio",
      surface_ref: `launch-kit:${cs.id}`,
      model: "google/gemini-2.5-pro",
      fallbackModel: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      workspaceId: cs.workspace_id,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    if (result.status !== "ok") throw new Error(result.error || "Launch-kit generation failed.");

    const parsed = (result.json ?? {}) as Record<string, unknown>;
    const pick = (k: string) => humanizeText(String(parsed[k] ?? "").trim());
    const kit: LaunchKit = {
      changelog: pick("changelog"),
      blog: pick("blog"),
      email: pick("email"),
      social: pick("social"),
      docs: pick("docs"),
    };
    if (!kit.changelog && !kit.blog && !kit.email && !kit.social && !kit.docs)
      throw new Error("Launch kit came back empty, try again.");
    return kit;
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
        // Optimistic-concurrency token: the row's updated_at as the UI saw it.
        // The update only lands if the row is unchanged, so stale hunk ids
        // (computed against older content) can never silently corrupt the file.
        expectedUpdatedAt: z.string().max(64).optional(),
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
    let upd = db
      .from("studio_changes")
      .update({ new_content: next, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (data.expectedUpdatedAt) upd = upd.eq("updated_at", data.expectedUpdatedAt);
    const { data: updated, error } = await upd.select("id");
    if (error) throw new Error(error.message);
    if (data.expectedUpdatedAt && (updated?.length ?? 0) === 0)
      throw new Error("This file changed since you opened it. Refresh and reapply your selection.");
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

/**
 * F-BUILDER-MULTIFILE: declare (or clear) the touch list + max-files cap for a
 * session. Mission-keyed, so it can be set before the agent creates the
 * changeset; the Changes-tab policy report reads it back. Pass an empty
 * allowedPaths and null maxFiles to clear the policy. RLS scopes the upsert to
 * the workspace.
 */
export const setChangesetConstraints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        missionId: z.string().uuid(),
        allowedPaths: z.array(z.string().max(400)).max(200).default([]),
        maxFiles: z.number().int().min(1).max(1000).nullable().default(null),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const db = supabase as unknown as SupabaseClient;
    // Resolve the workspace from the session's active changeset, else the mission.
    let workspaceId: string | null = null;
    const { data: csRow } = await db
      .from("studio_changesets")
      .select("workspace_id")
      .eq("mission_id", data.missionId)
      .neq("status", "abandoned")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    workspaceId = (csRow as { workspace_id?: string | null } | null)?.workspace_id ?? null;
    if (!workspaceId) {
      const { data: m } = await db
        .from("missions")
        .select("workspace_id")
        .eq("id", data.missionId)
        .maybeSingle();
      workspaceId = (m as { workspace_id?: string | null } | null)?.workspace_id ?? null;
    }
    if (!workspaceId) throw new Error("Could not resolve the workspace for this session.");
    const allowed = data.allowedPaths.map((p) => p.trim()).filter(Boolean);
    const { error } = await db.from("studio_changeset_constraints").upsert(
      {
        mission_id: data.missionId,
        workspace_id: workspaceId,
        user_id: userId,
        allowed_paths: allowed,
        max_files: data.maxFiles,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mission_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, allowed_paths: allowed, max_files: data.maxFiles };
  });

// NOTE: the changeset-wide "merge across files" primitive lives as the pure,
// unit-tested applyChangesetHunkSelections() in src/lib/ai/studio-hunks.ts (the
// spec's home for the merge logic). It is not re-exposed as a TanStack server fn
// here because the operator path drives per-file curation via
// applyStagedHunkSelection; a changeset-wide server endpoint would be an
// un-driven surface. The agent/contract door can import the pure helper directly.

/**
 * F-BUILDER-MULTIFILE: apply the touch list. Drop every staged file that is NOT
 * in the session's declared touch list (the one-click "stay in scope" before the
 * gated commit). No-op when no touch list is declared. Only a staged changeset
 * can be curated. RLS scopes the delete to the workspace.
 */
export const enforceTouchList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ changesetId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data: cs, error: csErr } = await db
      .from("studio_changesets")
      .select("id,status,mission_id")
      .eq("id", data.changesetId)
      .maybeSingle();
    if (csErr) throw new Error(csErr.message);
    if (!cs) throw new Error("Changeset not found.");
    const csr = cs as { id: string; status: string; mission_id: string | null };
    if (csr.status !== "staged")
      throw new Error("Only a staged changeset can be curated; this one is already committed.");
    let allowed: string[] = [];
    if (csr.mission_id) {
      const { data: con } = await db
        .from("studio_changeset_constraints")
        .select("allowed_paths")
        .eq("mission_id", csr.mission_id)
        .maybeSingle();
      allowed = ((con as { allowed_paths?: string[] | null } | null)?.allowed_paths ?? []).filter(
        Boolean,
      );
    }
    if (allowed.length === 0) return { ok: true, removed: [] as string[] };
    const { data: rows } = await db
      .from("studio_changes")
      .select("path")
      .eq("changeset_id", data.changesetId);
    const paths = ((rows ?? []) as Array<{ path: string }>).map((r) => r.path);
    const removed = paths.filter((p) => !matchesTouchList(p, allowed));
    if (removed.length) {
      const { error } = await db
        .from("studio_changes")
        .delete()
        .eq("changeset_id", data.changesetId)
        .in("path", removed);
      if (error) throw new Error(error.message);
    }
    return { ok: true, removed };
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

// SANDBOX: previewable file types + a payload cap for the $0 self-contained preview.
const PREVIEWABLE_HTML = /\.html?$/i;
const MAX_PREVIEW_BYTES = 512_000;

/**
 * SANDBOX: the $0 build preview. Returns the best standalone HTML file the latest
 * changeset produced, for the Preview tab's sandboxed iframe — or `null` when the
 * change has no standalone-renderable file (a live preview of a full repo build
 * needs the founder-gated sandbox backend). Reads through the RLS-scoped client,
 * so a changeset the caller cannot see simply yields `null` (no leak).
 */
export const getStudioPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ missionId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<StudioPreview> => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data: csRow } = await db
      .from("studio_changesets")
      .select("id")
      .eq("mission_id", data.missionId)
      .neq("status", "abandoned")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const changesetId = (csRow as { id?: string } | null)?.id;
    if (!changesetId) return null;
    // Find candidate previewable files by PATH first (no content), so the heavy
    // `new_content` column is read for ONLY the single file we render — not every
    // staged file (which could bloat the worker on a large changeset).
    const { data: rows } = await db
      .from("studio_changes")
      .select("path,op")
      .eq("changeset_id", changesetId)
      .neq("op", "delete")
      .order("path");
    const candidates = ((rows ?? []) as Array<{ path: string; op: string }>).filter((r) =>
      PREVIEWABLE_HTML.test(r.path),
    );
    if (candidates.length === 0) return null;
    // Prefer an entry file (index.html); else the path closest to the repo root.
    const pick =
      candidates.find((r) => /(^|\/)index\.html?$/i.test(r.path)) ??
      [...candidates].sort((a, b) => a.path.length - b.path.length)[0];
    const { data: fileRow } = await db
      .from("studio_changes")
      .select("new_content")
      .eq("changeset_id", changesetId)
      .eq("path", pick.path)
      .limit(1)
      .maybeSingle();
    const html = (fileRow as { new_content?: string | null } | null)?.new_content ?? "";
    if (html.length === 0) return null;
    return { path: pick.path, html: html.slice(0, MAX_PREVIEW_BYTES) };
  });
