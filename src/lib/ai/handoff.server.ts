/**
 * Agent-to-Agent (A2A) handoff (Bundle 4 / E1–E5).
 *
 * A `mission` groups multiple `agent_runs` rows under one operator intent.
 * Each hop is recorded as an `agent_messages` row with a STRUCTURED payload
 * (never prompt-stuffed). When the receiver run starts, the loop calls
 * `consumeInboundHandoff` to fetch the latest unconsumed message and
 * `renderHandoffBlock` to inject the payload into the receiver's system
 * prompt — same pattern as the workspace brief block.
 *
 * Failure policy (MVP): on hop failure the mission stops at the failed run.
 * The operator sees it in /traces (and the mission page) and can re-dispatch.
 * No automatic retry — matches "agents do, humans govern at decision points".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type HandoffPayload = {
  /** Short headline the receiver should solve next. */
  task: string;
  /** Structured context the sender already gathered (free-form jsonb). */
  context?: Record<string, unknown>;
  /** Stable IDs the receiver can read with its own tools (PRDs, themes, opps…). */
  artifacts?: { kind: string; id: string; title?: string }[];
  /** What the sender explicitly leaves to the receiver's judgement. */
  open_questions?: string[];
  /** Hard constraints the receiver must respect. */
  constraints?: string[];
};

export type MissionRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  goal: string;
  status: string;
  current_agent_id: string | null;
  hop_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export async function createMission(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  input: { title: string; goal: string; starting_agent_id: string },
): Promise<MissionRow> {
  const { data, error } = await supabase
    .from("missions")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      title: input.title.slice(0, 200),
      goal: input.goal,
      current_agent_id: input.starting_agent_id,
      status: "running",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MissionRow;
}

/**
 * Resolve a target agent by slug (preferred) or id, scoped to the user's roster.
 * Returns { id, slug, name } for downstream insertion.
 */
export async function resolveAgent(
  supabase: SupabaseClient,
  userId: string,
  ref: { agent_slug?: string; agent_id?: string },
): Promise<{ id: string; slug: string; name: string }> {
  let q = supabase.from("agents").select("id,slug,name").eq("user_id", userId).limit(1);
  if (ref.agent_id) q = q.eq("id", ref.agent_id);
  else if (ref.agent_slug) q = q.eq("slug", ref.agent_slug);
  else throw new Error("resolveAgent: pass agent_slug or agent_id");
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Agent not found: ${ref.agent_slug ?? ref.agent_id}`);
  return data as { id: string; slug: string; name: string };
}

/**
 * Record a handoff message AND enqueue a child `agent_runs` row for the receiver.
 * The resume-runs sweeper picks the queued run up on its next tick (or another
 * call site can resume it immediately). Returns ids for both rows.
 */
export async function enqueueHandoff(
  supabase: SupabaseClient,
  userId: string,
  args: {
    mission_id: string;
    workspace_id: string;
    from_agent_id: string | null;
    from_agent_slug: string | null;
    to: { id: string; slug: string; name: string };
    payload: HandoffPayload;
    source_run_id: string | null;
    source_trace_id: string | null;
    mission_spend_cap_usd?: number | null;
    mission_token_cap?: number | null;
  },
): Promise<{ message_id: string; queued_run_id: string }> {
  const { data: msg, error: mErr } = await supabase
    .from("agent_messages")
    .insert({
      user_id: userId,
      workspace_id: args.workspace_id,
      mission_id: args.mission_id,
      from_agent_id: args.from_agent_id,
      from_agent_slug: args.from_agent_slug,
      to_agent_id: args.to.id,
      to_agent_slug: args.to.slug,
      kind: "handoff",
      payload: args.payload as unknown as Record<string, unknown>,
      source_run_id: args.source_run_id,
      source_trace_id: args.source_trace_id,
    })
    .select("id")
    .single();
  if (mErr) throw new Error(mErr.message);

  // Compose the receiver's goal from the structured payload so even fallback
  // (no inbound-handoff load) still gives them something to work on.
  const composedGoal = [
    args.payload.task,
    args.payload.constraints?.length
      ? `Constraints:\n- ${args.payload.constraints.join("\n- ")}`
      : "",
    args.payload.open_questions?.length
      ? `Open questions:\n- ${args.payload.open_questions.join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: run, error: rErr } = await supabase
    .from("agent_runs")
    .insert({
      user_id: userId,
      agent_id: args.to.id,
      agent_slug: args.to.slug,
      agent_name: args.to.name,
      input: composedGoal || args.payload.task,
      status: "queued",
      workspace_id: args.workspace_id,
      mission_id: args.mission_id,
      mission_spend_cap_usd: args.mission_spend_cap_usd ?? null,
      mission_token_cap: args.mission_token_cap ?? null,
    })
    .select("id")
    .single();
  if (rErr) throw new Error(rErr.message);

  return { message_id: (msg as { id: string }).id, queued_run_id: (run as { id: string }).id };
}

/**
 * Fetch the latest unconsumed handoff addressed to this agent within a mission,
 * and mark it consumed by `runId`. Returns null when there's nothing inbound
 * (e.g. the first hop of a mission, started directly by the operator).
 */
export async function consumeInboundHandoff(
  supabase: SupabaseClient,
  args: { mission_id: string; to_agent_id: string; run_id: string },
): Promise<{ from_agent_slug: string | null; payload: HandoffPayload } | null> {
  const { data } = await supabase
    .from("agent_messages")
    .select("id,from_agent_slug,payload,consumed_by_run_id")
    .eq("mission_id", args.mission_id)
    .eq("to_agent_id", args.to_agent_id)
    .is("consumed_by_run_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const msg = data as { id: string; from_agent_slug: string | null; payload: HandoffPayload };
  await supabase
    .from("agent_messages")
    .update({ consumed_by_run_id: args.run_id, consumed_at: new Date().toISOString() })
    .eq("id", msg.id);
  return { from_agent_slug: msg.from_agent_slug, payload: msg.payload };
}

/**
 * Render an inbound handoff as a labelled plain-text block, suitable for
 * injection into the receiver's system prompt right after the workspace brief.
 * Mirrors `renderBriefBlock` style so the receiver knows the source.
 */
export function renderHandoffBlock(
  inbound: { from_agent_slug: string | null; payload: HandoffPayload } | null,
): string {
  if (!inbound) return "";
  const p = inbound.payload;
  const from = inbound.from_agent_slug ?? "operator";
  const sections: string[] = [];
  sections.push(`Task to solve next:\n${p.task}`);
  if (p.context && Object.keys(p.context).length) {
    sections.push(`Context (structured):\n${JSON.stringify(p.context, null, 2)}`);
  }
  if (p.artifacts?.length) {
    sections.push(
      "Artifacts you can read with your tools:\n" +
        p.artifacts.map((a) => `- ${a.kind} ${a.id}${a.title ? ` — ${a.title}` : ""}`).join("\n"),
    );
  }
  if (p.constraints?.length) {
    sections.push("Constraints (hard):\n- " + p.constraints.join("\n- "));
  }
  if (p.open_questions?.length) {
    sections.push("Open questions left for you:\n- " + p.open_questions.join("\n- "));
  }
  return `\n--- Handoff from ${from} (mission context, authoritative) ---\n${sections.join("\n\n")}\n--- End handoff ---\n`;
}

/**
 * Mark a mission completed when its tail run ends successfully and no further
 * handoff was emitted. Called by the loop on `final`.
 */
export async function maybeCompleteMission(
  supabase: SupabaseClient,
  missionId: string,
): Promise<void> {
  // If there's still an unconsumed inbound message, the mission is still moving.
  const { count } = await supabase
    .from("agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("mission_id", missionId)
    .is("consumed_by_run_id", null);
  if ((count ?? 0) > 0) return;
  const { data: updated } = await supabase
    .from("missions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", missionId)
    .eq("status", "running")
    .select("id,user_id,workspace_id,title,goal")
    .maybeSingle();

  // F-DECISIONS-CAPTURE: a mission completing is a captured decision.
  // Idempotent: skip if a row already exists for this mission.
  if (updated) {
    const { count: existing } = await supabase
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("mission_id", updated.id);
    if ((existing ?? 0) === 0) {
      // Pull the final hop's output as the rationale (best-effort).
      const { data: lastRun } = await supabase
        .from("agent_runs")
        .select("output,agent_slug")
        .eq("mission_id", updated.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rationale = (lastRun?.output ?? updated.goal ?? "").slice(0, 2000);
      await supabase.from("decisions").insert({
        user_id: updated.user_id,
        workspace_id: updated.workspace_id,
        title: `Mission completed: ${(updated.title ?? "Untitled").slice(0, 240)}`,
        rationale,
        status: "approved",
        mission_id: updated.id,
        source_kind: "mission",
        decided_by_agent_slug: lastRun?.agent_slug ?? null,
      });
    }
  }
}
