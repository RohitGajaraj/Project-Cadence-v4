/**
 * Agent Trust Score + Autonomy Dial — server-only compute.
 *
 * Trust score is computed on read from real signals already in the DB
 * (mission outcomes, approval acceptance, eval scores). No cached score
 * column → can never go stale.
 *
 * The dial (`arc`) lives in `agent_autonomy` and is composed with each
 * tool's own `agent_tools.mode` via `resolveApprovalMode` to decide
 * whether the agent loop executes inline, queues a confirm, or queues
 * a review. The combiner is a SAFETY FLOOR — it never makes a tool
 * more permissive than its own mode requires.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Arc = "observing" | "proving" | "trusted" | "ambient";
export type ToolMode = "auto" | "confirm" | "review";

export type TrustBreakdown = {
  missions_total: number;
  missions_completed: number;
  mission_success_rate: number;
  approvals_total: number;
  approvals_approved: number;
  approval_acceptance_rate: number;
  evals_total: number;
  eval_mean_score: number;
  samples: number;
};

export type AgentTrust = {
  agent_id: string;
  score: number; // 0–100
  arc: Arc;
  suggested_arc: Arc;
  breakdown: TrustBreakdown;
};

const PRIOR = 0.5;
const PRIOR_WEIGHT = 10;

function shrink(rate: number, n: number): number {
  // Bayesian shrinkage toward 0.5 when sample size is small.
  return (rate * n + PRIOR * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT);
}

/** Score → suggested arc. Operator can override; this is just the hint. */
export function suggestArc(score: number, samples: number): Arc {
  if (samples < 3) return "observing";
  if (score >= 90) return "ambient";
  if (score >= 75) return "trusted";
  if (score >= 55) return "proving";
  return "observing";
}

/**
 * Compose the per-tool `mode` with the agent's `arc`. SAFETY FLOOR:
 * - `review` is sticky — the dial never downgrades a `review` tool.
 * - `calendar.create` and any other hard-locked tool stay `confirm`.
 * The dial only ever loosens `auto`/`confirm` tools toward `auto`.
 *
 * NOTE: orchestrator control-flow tools (mission.plan/dispatch/observe/
 * finalize) are exempt from gating entirely and always run inline. That
 * exemption lives at the loop's gate (ORCHESTRATION_CONTROL_FLOW_TOOLS in
 * loop.server.ts), not here, because this combiner is a pure name-agnostic
 * mode function reused by read-only surfaces (the trust UI). Keeping the
 * allowlist at the single queue-vs-execute decision point avoids leaking
 * tool names into the dial math.
 */
export function resolveApprovalMode(toolMode: ToolMode, arc: Arc): ToolMode {
  if (toolMode === "review") return "review";
  switch (arc) {
    case "ambient":
      return "auto";
    case "trusted":
      // confirm tools execute inline; review tools (filtered above) untouched.
      return toolMode === "confirm" ? "auto" : toolMode;
    case "proving":
      // auto tools must confirm; confirm stays confirm.
      return toolMode === "auto" ? "confirm" : toolMode;
    case "observing":
    default:
      // Every action visible: even auto tools queue a review.
      return "review";
  }
}

type AgentRow = { id: string };
type RunRow = { agent_id: string; status: string };
type ApprovalRow = { agent_id: string; status: string };
type EvalRow = { ai_event_id: string; score: number | null };
type EventRow = { id: string; agent_id: string | null };
type AutonomyRow = { agent_id: string; arc: Arc };

/**
 * Compute trust for every agent owned by the user in a single round-trip.
 * Returns one entry per agent (always, even with zero history).
 */
export async function computeAllAgentTrust(
  supabase: SupabaseClient,
  userId: string,
): Promise<AgentTrust[]> {
  const [agentsRes, runsRes, apprRes, eventsRes, autoRes] = await Promise.all([
    supabase.from("agents").select("id").eq("user_id", userId),
    supabase.from("agent_runs").select("agent_id,status").eq("user_id", userId),
    supabase.from("agent_approvals").select("agent_id,status").eq("user_id", userId),
    supabase
      .from("ai_events")
      .select("id,agent_id")
      .eq("user_id", userId)
      .not("agent_id", "is", null),
    supabase.from("agent_autonomy").select("agent_id,arc").eq("user_id", userId),
  ]);

  const agents = (agentsRes.data ?? []) as AgentRow[];
  const runs = (runsRes.data ?? []) as RunRow[];
  const apprs = (apprRes.data ?? []) as ApprovalRow[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const autonomy = new Map<string, Arc>(
    ((autoRes.data ?? []) as AutonomyRow[]).map((a) => [a.agent_id, a.arc]),
  );

  // Fetch evals only for this user's events.
  const eventIds = events.map((e) => e.id);
  let evals: EvalRow[] = [];
  if (eventIds.length > 0) {
    const { data: evalRows } = await supabase
      .from("ai_evals")
      .select("ai_event_id,score")
      .in("ai_event_id", eventIds);
    evals = (evalRows ?? []) as EvalRow[];
  }
  const eventToAgent = new Map<string, string>(events.map((e) => [e.id, e.agent_id as string]));

  const out: AgentTrust[] = [];
  for (const a of agents) {
    const aRuns = runs.filter((r) => r.agent_id === a.id);
    const missions_total = aRuns.length;
    const missions_completed = aRuns.filter((r) => r.status === "completed").length;
    const mission_success_rate = missions_total > 0 ? missions_completed / missions_total : 0;

    const aApprs = apprs.filter(
      (r) => r.agent_id === a.id && (r.status === "approved" || r.status === "rejected"),
    );
    const approvals_total = aApprs.length;
    const approvals_approved = aApprs.filter((r) => r.status === "approved").length;
    const approval_acceptance_rate = approvals_total > 0 ? approvals_approved / approvals_total : 0;

    const aEvals = evals.filter((e) => {
      const ag = eventToAgent.get(e.ai_event_id);
      return ag === a.id && typeof e.score === "number";
    });
    const evals_total = aEvals.length;
    const eval_mean_score =
      evals_total > 0 ? aEvals.reduce((s, e) => s + (e.score as number), 0) / evals_total : 0;

    const samples = missions_total + approvals_total + evals_total;

    const sMission = shrink(mission_success_rate, missions_total);
    const sApproval = shrink(approval_acceptance_rate, approvals_total);
    const sEval = shrink(eval_mean_score, evals_total);

    const raw = 0.4 * sMission + 0.3 * sApproval + 0.3 * sEval;
    const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);

    const suggested_arc = suggestArc(score, samples);
    const arc = autonomy.get(a.id) ?? "observing";

    out.push({
      agent_id: a.id,
      score,
      arc,
      suggested_arc,
      breakdown: {
        missions_total,
        missions_completed,
        mission_success_rate,
        approvals_total,
        approvals_approved,
        approval_acceptance_rate,
        evals_total,
        eval_mean_score,
        samples,
      },
    });
  }
  return out;
}

/** Look up just the arc for a single agent (used by the loop). */
export async function loadAgentArc(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
): Promise<Arc> {
  const { data } = await supabase
    .from("agent_autonomy")
    .select("arc")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .maybeSingle();
  return (data as { arc?: Arc } | null)?.arc ?? "observing";
}
