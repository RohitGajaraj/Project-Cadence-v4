/**
 * Deterministic mission advance (v6 Phase 1 — "the loop runs itself").
 *
 * Once the orchestrator has planned a mission's DAG (mission.plan) and dispatched
 * its first wave, the rest of the mission no longer needs the orchestrator model:
 * advancing is mechanical. This module is that engine —
 *   reflect child-run outcomes onto steps (+ bounded retry)
 *     → claim & dispatch every newly-ready step (threading memory into the hop)
 *       → finalize when the whole DAG is terminal.
 * It is:
 *   - model-free (no callModel) → cheap, deterministic, and safe to run every tick,
 *   - admin-client compatible → called by the resume-runs sweeper (admin client)
 *     AND by the advanceMission server fn (user client),
 *   - concurrency-safe on dispatch → claim-first CAS, so overlapping sweeper
 *     ticks can never double-enqueue the same step.
 *
 * The orchestrator model still owns the INITIAL plan + wave-0 dispatch; from
 * there this carries the mission to completion unattended (Appendix B: this is
 * the "mid-loop hops need the orchestrator re-invoked" gap, closed).
 *
 * Pre-migration tolerant: the retry columns (attempts/max_attempts/next_retry_at)
 * land on the next Lovable sync. Until then `hasRetryColumns` probes false and the
 * engine degrades to the prior behavior (no retry — a failed hop terminalizes),
 * while auto-advance + memory threading still work. No deploy-order dependency.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enqueueHandoff,
  maybeCompleteMission,
  resolveAgent,
  type HandoffPayload,
} from "./handoff.server";
import { recallMemoryRefs } from "./memory.server";
import { DEFAULT_MAX_ATTEMPTS, nextRetryAtIso, shouldRetryStep } from "./retry";

export type MissionLite = {
  id: string;
  user_id: string;
  workspace_id: string;
  goal: string;
  status: string;
};

type MissionStepRow = {
  id: string;
  idx: number;
  agent_slug: string;
  sub_goal: string;
  depends_on: number[];
  status: string;
  run_id: string | null;
  rationale: string | null;
  dispatched_at: string | null;
  /** Retry-tracking columns — absent until the P1 migration applies. */
  attempts?: number | null;
  max_attempts?: number | null;
};

/** A step claimed (status='dispatched') but left with no run_id this long is
 *  treated as a lost dispatch (worker eviction between claim and enqueue). */
const DISPATCH_LOST_MS = 3 * 60 * 1000;

type SenderCtx = {
  agentId: string | null;
  agentSlug: string | null;
  runId: string | null;
  traceId: string | null;
};

// Per-isolate cache of whether the retry columns exist yet (cheap, self-healing:
// a worker that probed false before the migration is recycled and re-probes).
let retryColsCache: boolean | null = null;

async function hasRetryColumns(supabase: SupabaseClient): Promise<boolean> {
  if (retryColsCache !== null) return retryColsCache;
  const { error } = await supabase.from("mission_steps").select("max_attempts").limit(1);
  if (!error) {
    retryColsCache = true;
    return true;
  }
  // Cache `false` ONLY for a genuine missing-column error (pre-migration). A
  // transient error (network/permission) degrades to no-retry for THIS call but
  // stays uncached, so a later call re-probes once the column lands — otherwise
  // one blip would disable retry for the whole isolate lifetime.
  const code = (error as { code?: string }).code;
  const missingColumn =
    code === "42703" ||
    code === "PGRST204" ||
    /max_attempts|column .* does not exist/i.test(error.message ?? "");
  if (missingColumn) retryColsCache = false;
  return false;
}

/**
 * When a step's child run failed (or its dispatch threw), decide retry vs. give
 * up. With the retry columns present and attempts under the ceiling, re-queue
 * the step to 'planned' with an exponential backoff (next_retry_at); otherwise
 * terminalize it 'failed'. Returns the chosen outcome.
 */
async function failOrRequeueStep(
  supabase: SupabaseClient,
  step: MissionStepRow,
  errorMsg: string,
  retryCols: boolean,
): Promise<"retry" | "failed"> {
  const attempts = step.attempts ?? 0;
  const maxAttempts = step.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
  const err = errorMsg.slice(0, 2000);
  if (retryCols && shouldRetryStep({ attempts, maxAttempts })) {
    await supabase
      .from("mission_steps")
      .update({
        status: "planned",
        error: err,
        next_retry_at: nextRetryAtIso(Date.now(), attempts),
      })
      .eq("id", step.id);
    return "retry";
  }
  await supabase
    .from("mission_steps")
    .update({ status: "failed", error: err, completed_at: new Date().toISOString() })
    .eq("id", step.id);
  return "failed";
}

/**
 * Cross-check every in-flight mission_step.run_id against agent_runs.status and
 * reflect the terminal state back onto the step. A failed/halted child triggers
 * the bounded-retry decision. Cheap; shared by the orchestrator tools and the
 * auto-advance sweeper so progress is always fresh without a separate reactor.
 */
export async function reflectStepStatusFromRuns(
  supabase: SupabaseClient,
  missionId: string,
): Promise<void> {
  const { data: pending } = await supabase
    .from("mission_steps")
    .select("*")
    .eq("mission_id", missionId)
    .in("status", ["dispatched", "running"]);
  const rows = (pending ?? []) as MissionStepRow[];
  if (rows.length === 0) return;

  const retryCols = await hasRetryColumns(supabase);

  // Recover steps stranded in 'dispatched' with no run_id: the claim flipped
  // planned→dispatched but the worker died before enqueue created the child run.
  // After a staleness window, requeue (bounded) or fail so the mission can't
  // hang. Their attempt was already counted at claim time. Done before the
  // run_id early-return below so an all-stranded mission still recovers.
  const lostCutoff = new Date(Date.now() - DISPATCH_LOST_MS).toISOString();
  for (const row of rows) {
    if (
      !row.run_id &&
      row.status === "dispatched" &&
      row.dispatched_at &&
      row.dispatched_at < lostCutoff
    ) {
      await failOrRequeueStep(
        supabase,
        row,
        "dispatch lost before a child run was created (worker eviction)",
        retryCols,
      );
    }
  }

  const runIds = rows.map((r) => r.run_id).filter((x): x is string => !!x);
  if (runIds.length === 0) return;

  const { data: runs } = await supabase
    .from("agent_runs")
    .select("id,status,output,halted_reason")
    .in("id", runIds);
  const byRun = new Map<
    string,
    { status: string; output: string | null; halted_reason: string | null }
  >(
    (runs ?? []).map((r) => [
      (r as { id: string }).id,
      r as { id: string; status: string; output: string | null; halted_reason: string | null },
    ]),
  );

  for (const row of rows) {
    if (!row.run_id) continue;
    const run = byRun.get(row.run_id);
    if (!run) continue;
    if (run.status === "running" && row.status !== "running") {
      await supabase.from("mission_steps").update({ status: "running" }).eq("id", row.id);
    } else if (run.status === "completed") {
      await supabase
        .from("mission_steps")
        .update({
          status: "done",
          result: run.output ? { output: run.output } : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    } else if (run.status === "halted" || run.status === "failed") {
      await failOrRequeueStep(
        supabase,
        row,
        run.halted_reason ?? run.output ?? `child run ${run.status}`,
        retryCols,
      );
    }
  }
}

/**
 * Dispatch every mission step whose dependencies are satisfied (and whose retry
 * backoff, if any, has elapsed — enforced by next_ready_mission_steps). Each
 * dispatch is claim-first (CAS planned→dispatched) so concurrent ticks can't
 * double-enqueue, and threads memory relevant to the hop into the handoff
 * payload (memory_refs + last_used_at). Idempotent.
 */
export async function dispatchReadySteps(
  supabase: SupabaseClient,
  mission: MissionLite,
  from: SenderCtx,
): Promise<{
  dispatched: { idx: number; agent_slug: string; run_id: string }[];
  failed: { idx: number; agent_slug: string; error: string }[];
}> {
  const retryCols = await hasRetryColumns(supabase);
  const { data: ready, error } = await supabase.rpc("next_ready_mission_steps", {
    p_mission_id: mission.id,
  });
  if (error) throw new Error(error.message);
  const readyRows = (ready ?? []) as MissionStepRow[];

  const dispatched: { idx: number; agent_slug: string; run_id: string }[] = [];
  const failed: { idx: number; agent_slug: string; error: string }[] = [];

  for (const step of readyRows) {
    const attemptNo = (step.attempts ?? 0) + 1;
    // CAS claim: only the caller that flips planned→dispatched proceeds to
    // enqueue. The loser matches zero rows and skips — no double dispatch.
    const claim: Record<string, unknown> = {
      status: "dispatched",
      dispatched_at: new Date().toISOString(),
    };
    if (retryCols) claim.attempts = attemptNo;
    const { data: claimed } = await supabase
      .from("mission_steps")
      .update(claim)
      .eq("id", step.id)
      .eq("status", "planned")
      .select("id");
    if (!claimed?.length) continue;

    try {
      const to = await resolveAgent(supabase, mission.user_id, { agent_slug: step.agent_slug });

      // Thread memory relevant to THIS hop into the handoff + mark it used.
      let memoryRefs: { id: string; summary?: string }[] | undefined;
      try {
        const recalled = await recallMemoryRefs(
          supabase,
          mission.user_id,
          step.agent_slug,
          step.sub_goal,
          { touch: true, maxItems: 4 },
        );
        memoryRefs = recalled.refs.length ? recalled.refs : undefined;
      } catch {
        /* recall failure is non-fatal — dispatch proceeds without refs */
      }

      const payload: HandoffPayload = {
        task: step.sub_goal,
        context: {
          mission_step_idx: step.idx,
          orchestrator_run_id: from.runId ?? null,
          orchestrator_trace_id: from.traceId ?? null,
          rationale: step.rationale ?? undefined,
          attempt: retryCols ? attemptNo : undefined,
        },
        ...(memoryRefs ? { memory_refs: memoryRefs } : {}),
      };

      const handoffRes = await enqueueHandoff(supabase, mission.user_id, {
        mission_id: mission.id,
        workspace_id: mission.workspace_id,
        from_agent_id: from.agentId,
        from_agent_slug: from.agentSlug,
        to,
        payload,
        source_run_id: from.runId,
        source_trace_id: from.traceId,
      });

      await supabase
        .from("mission_steps")
        .update({ run_id: handoffRes.queued_run_id, message_id: handoffRes.message_id })
        .eq("id", step.id);

      dispatched.push({
        idx: step.idx,
        agent_slug: step.agent_slug,
        run_id: handoffRes.queued_run_id,
      });
    } catch (e) {
      // Enqueue threw AFTER the claim — don't leave the step hung in
      // 'dispatched' with no run; retry it (bounded) or terminalize.
      const msg = e instanceof Error ? e.message : String(e);
      await failOrRequeueStep(supabase, { ...step, attempts: attemptNo }, msg, retryCols);
      failed.push({ idx: step.idx, agent_slug: step.agent_slug, error: msg });
    }
  }

  return { dispatched, failed };
}

/**
 * Advance a single mission one tick, deterministically and model-free:
 * reflect → dispatch ready → finalize. Safe to call repeatedly and concurrently;
 * a no-op for missions with no ready work or no DAG. Returns a small summary.
 */
export async function advanceMissionCore(
  supabase: SupabaseClient,
  mission: MissionLite,
): Promise<{ dispatched: number; failed: number; finalized: boolean }> {
  if (mission.status !== "running" && mission.status !== "in_progress") {
    return { dispatched: 0, failed: 0, finalized: false };
  }

  // 1. Reflect child outcomes onto steps (+ bounded retry requeue).
  await reflectStepStatusFromRuns(supabase, mission.id);

  // 2. Resolve the orchestrator as the conceptual sender (best-effort — the
  //    handoff contract allows a null sender).
  let from: SenderCtx = { agentId: null, agentSlug: null, runId: null, traceId: null };
  try {
    const orch = await resolveAgent(supabase, mission.user_id, { agent_slug: "orchestrator" });
    from = { agentId: orch.id, agentSlug: orch.slug, runId: null, traceId: null };
  } catch {
    /* non-fatal */
  }

  // 3. Dispatch every newly-ready step.
  const { dispatched, failed } = await dispatchReadySteps(supabase, mission, from);

  // 4. Finalize when the DAG is fully terminal (failure-aware + idempotent).
  await maybeCompleteMission(supabase, mission.id);
  const { data: m } = await supabase
    .from("missions")
    .select("status")
    .eq("id", mission.id)
    .maybeSingle();
  const finalized = m ? m.status !== "running" && m.status !== "in_progress" : false;

  return { dispatched: dispatched.length, failed: failed.length, finalized };
}
