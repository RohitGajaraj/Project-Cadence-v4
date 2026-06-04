/**
 * Bundle 9 Slice 1 — Build Console server fns.
 *
 * Read-only view over agent_runs WHERE agent_slug='builder' joined to the
 * github.pr.open tool_call result (PR url, number, branch, path) and any
 * pending agent_approvals for that run. Feeds the /build page.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAgentLoop } from "@/lib/ai/loop.server";
import { createMission } from "@/lib/ai/handoff.server";

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

    // Count pending approvals per run via trace_id (agent_approvals has no run_id column).
    const pendingByRun = new Map<string, number>();
    if (traceIds.length) {
      const { data: apps } = await supabase
        .from("agent_approvals")
        .select("id,trace_id,status")
        .in("trace_id", traceIds)
        .eq("status", "pending");
      const runByTrace = new Map<string, string>();
      for (const [runId, traceId] of traceByRun.entries()) runByTrace.set(traceId, runId);
      for (const a of (apps ?? []) as { trace_id: string | null }[]) {
        if (!a.trace_id) continue;
        const runId = runByTrace.get(a.trace_id);
        if (!runId) continue;
        pendingByRun.set(runId, (pendingByRun.get(runId) ?? 0) + 1);
      }
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

/**
 * Dispatch a Builder mission from the Build Console with free-form input.
 *
 * Three ways to resolve the GitHub issue the Builder closes:
 *   1. prdId given + that PRD has github_issue_url → reuse it.
 *   2. explicit issueNumber → use it.
 *   3. autoCreateIssue=true → open a fresh issue from the goal (+ optional
 *      PRD body and reference links appended as context).
 *
 * The Builder agent's tool contract is unchanged: it still calls
 * github.pr.open with the same allow-list and per-issue idempotency key.
 */
export const dispatchBuilderMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      goal: z.string().min(4).max(4000),
      prdId: z.string().uuid().optional(),
      issueNumber: z.number().int().positive().optional(),
      autoCreateIssue: z.boolean().optional(),
      referenceLinks: z.array(z.string().url().max(500)).max(10).optional(),
      missionTitle: z.string().min(1).max(200).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Resolve PRD context if provided.
    let prd: { id: string; title: string; body_md: string | null; github_issue_url: string | null } | null = null;
    if (data.prdId) {
      const { data: row, error } = await supabase
        .from("prds")
        .select("id,title,body_md,github_issue_url")
        .eq("id", data.prdId)
        .single();
      if (error) throw new Error(`PRD lookup failed: ${error.message}`);
      prd = row as typeof prd;
    }

    // Resolve issue number.
    let issueNumber: number | null = data.issueNumber ?? null;
    let issueUrl: string | null = null;

    if (!issueNumber && prd?.github_issue_url) {
      const m = prd.github_issue_url.match(/\/issues\/(\d+)/);
      if (m) {
        issueNumber = Number(m[1]);
        issueUrl = prd.github_issue_url;
      }
    }

    if (!issueNumber && data.autoCreateIssue) {
      const token = process.env.GITHUB_TOKEN;
      const repo = process.env.GITHUB_REPO;
      if (!token || !repo) throw new Error("GitHub is not connected on the server (GITHUB_TOKEN / GITHUB_REPO missing)");
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid GITHUB_REPO format: ${repo}`);

      const titleSrc = data.missionTitle?.trim() || data.goal.split(/\r?\n/)[0].slice(0, 120);
      const bodyParts: string[] = [data.goal.slice(0, 40_000)];
      if (prd) bodyParts.push(`\n---\n**From PRD:** ${prd.title}\n\n${(prd.body_md ?? "").slice(0, 20_000)}`);
      if (data.referenceLinks?.length) {
        bodyParts.push(`\n---\n**References:**\n${data.referenceLinks.map((u) => `- ${u}`).join("\n")}`);
      }
      bodyParts.push(`\n---\n_Opened from Cadence Build Console_`);

      const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "cadence-agent",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: titleSrc.slice(0, 250),
          body: bodyParts.join("\n"),
          labels: ["cadence", "build"],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`GitHub ${res.status}: ${txt.slice(0, 400)}`);
      }
      const json = (await res.json()) as { number: number; html_url: string };
      issueNumber = json.number;
      issueUrl = json.html_url;

      if (prd && !prd.github_issue_url) {
        await supabase
          .from("prds")
          .update({ github_issue_url: issueUrl, updated_at: new Date().toISOString() })
          .eq("id", prd.id);
      }
    }

    if (!issueNumber) {
      throw new Error("Need a GitHub issue: link a PRD with one, enter an issue number, or enable Auto-create.");
    }

    // Build a context-rich goal for the Builder agent.
    const goalSections: string[] = [
      `Pick up GitHub issue #${issueNumber} on the connected repo. Read the issue body, then ship a single-file scoped PR via github.pr.open with idempotency_key="issue-${issueNumber}". Closes #${issueNumber}.`,
      `\nUser intent:\n${data.goal}`,
    ];
    if (prd) goalSections.push(`\nLinked PRD: "${prd.title}" (id ${prd.id}). Use it as the source of truth for scope.`);
    if (data.referenceLinks?.length) {
      goalSections.push(`\nReferences:\n${data.referenceLinks.map((u) => `- ${u}`).join("\n")}`);
    }
    const fullGoal = goalSections.join("\n");

    // Resolve workspace + builder agent, create mission, then run.
    const { data: ws } = await supabase.rpc("current_user_default_workspace");
    const workspaceId = (ws as string | null) ?? null;
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", "builder")
      .maybeSingle();

    let missionId: string | null = null;
    if (workspaceId && agent) {
      const m = await createMission(supabase, userId, workspaceId, {
        title: (data.missionTitle?.trim() || `Build · #${issueNumber} ${data.goal.slice(0, 60)}`).slice(0, 200),
        goal: fullGoal,
        starting_agent_id: (agent as { id: string }).id,
      });
      missionId = m.id;
    }

    const result = await runAgentLoop(supabase, userId, {
      agentSlug: "builder",
      goal: fullGoal,
      missionId,
    });

    return { ...result, mission_id: missionId, issue_number: issueNumber, issue_url: issueUrl };
  });