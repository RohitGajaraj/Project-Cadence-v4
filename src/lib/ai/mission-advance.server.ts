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

/** KI-15: an inbound handoff left unconsumed this long is treated as stale (its
 *  receiver run was never started, e.g. a non-orchestrated single mission whose
 *  one handoff was dropped). Past this window the message no longer blocks
 *  completion, so the mission can finalize instead of sitting 'running' forever.
 *  Conservative on purpose: a recently-unconsumed message still blocks (the
 *  receiver may simply not have picked it up yet). */
const UNCONSUMED_STALE_MS = 15 * 60 * 1000;

/** KI-16b: per-mission per-tick dispatch cap. `dispatchReadySteps` enqueues at
 *  most this many ready steps per advance, so a wide or runaway DAG degrades to
 *  bounded backpressure (the uncapped remainder stays 'planned' and is returned
 *  again on the next tick) instead of an unbounded enqueue burst in a single
 *  Worker tick. This bounds per-tick WORK (resolveAgent + memory recall + enqueue
 *  per step) under the Cloudflare Workers execution budget; the running-concurrency
 *  cap (MAX_RUNNING_PER_WORKSPACE in loop.server.ts) separately bounds how many
 *  run at once. Env-tunable; sane default 10 (2x the running cap, enough to keep
 *  the pipeline fed without a large per-tick burst). */
const DISPATCH_CAP = Math.max(1, Number(process.env.MISSION_STEP_DISPATCH_CAP) || 10);

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
 * Fetch a mission's ready steps (dependencies satisfied + retry backoff elapsed,
 * enforced by next_ready_mission_steps) and apply the KI-16b per-tick dispatch
 * cap: return at most `cap` rows, preserving the RPC's order so the cap is
 * deterministic and no step starves (the uncapped remainder is still 'planned'
 * and is returned again on the next tick). Throws on RPC error.
 */
export async function selectDispatchBatch(
  supabase: SupabaseClient,
  missionId: string,
  cap: number = DISPATCH_CAP,
): Promise<MissionStepRow[]> {
  const { data: ready, error } = await supabase.rpc("next_ready_mission_steps", {
    p_mission_id: missionId,
  });
  if (error) throw new Error(error.message);
  const rows = (ready ?? []) as MissionStepRow[];
  return rows.slice(0, Math.max(1, cap));
}

/**
 * Dispatch the mission steps whose dependencies are satisfied (and whose retry
 * backoff, if any, has elapsed — enforced by next_ready_mission_steps), up to the
 * KI-16b per-tick cap. Each dispatch is claim-first (CAS planned→dispatched) so
 * concurrent ticks can't double-enqueue, and threads memory relevant to the hop
 * into the handoff payload (memory_refs + last_used_at). Idempotent.
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
  // KI-16b: bound how many ready steps this mission dispatches this tick.
  const readyRows = await selectDispatchBatch(supabase, mission.id, DISPATCH_CAP);

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
          mission.workspace_id ?? null,
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
 * KI-15: clear the completion block left by an orphaned handoff. maybeCompleteMission
 * refuses to finalize while ANY agent_messages row is unconsumed, so a single
 * non-orchestrated mission whose only handoff was never picked up sits 'running'
 * forever. Here we mark messages older than UNCONSUMED_STALE_MS consumed, attributing
 * them to the mission's tail run (the run that effectively absorbed the orphan) so the
 * UI's message-to-run mapping stays honest and consumeInboundHandoff can no longer
 * re-serve them. Recently-unconsumed messages are left alone and still block as today.
 * Returns true when at least one stale message was cleared.
 *
 * Live-receiver guard (correctness): enqueueHandoff always creates a queued
 * receiver run alongside the message, and that run is what consumeInboundHandoff
 * later marks the message consumed by. So a message is only TRULY orphaned once
 * no live run (queued / running / waiting_approval) remains to pick it up. Under
 * backlog or BATCH starvation the receiver run can simply be late, and stealing
 * its message would make it resume WITHOUT its handoff payload (lost task
 * context). While any live run exists the mission is still moving and would not
 * complete anyway, so we leave every message untouched and retry next tick.
 */
async function sweepStaleUnconsumedMessages(
  supabase: SupabaseClient,
  missionId: string,
): Promise<boolean> {
  // If any run is still live, an inbound message may yet be consumed by it, so
  // do not steal it. (Also: a live run keeps the mission from completing, so
  // there is nothing to unblock here yet.)
  const { count: liveRuns } = await supabase
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("mission_id", missionId)
    .in("status", ["queued", "running", "waiting_approval"]);
  if ((liveRuns ?? 0) > 0) return false;

  const staleCutoff = new Date(Date.now() - UNCONSUMED_STALE_MS).toISOString();
  const { data: staleRows } = await supabase
    .from("agent_messages")
    .select("id")
    .eq("mission_id", missionId)
    .is("consumed_by_run_id", null)
    .lt("created_at", staleCutoff);
  const ids = (staleRows ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return false;

  // Attribute the orphan to the mission's most recent run (best-effort). A
  // running mission realistically always has one; in the rare case it does not,
  // leave the message untouched (stay conservative) and retry next tick once a
  // run exists, since the completion guard keys on consumed_by_run_id.
  const { data: tailRun } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const tailRunId = (tailRun as { id: string } | null)?.id ?? null;
  if (!tailRunId) return false;

  await supabase
    .from("agent_messages")
    .update({ consumed_by_run_id: tailRunId, consumed_at: new Date().toISOString() })
    .in("id", ids)
    .is("consumed_by_run_id", null);
  return true;
}

/**
 * Pure DAG analysis for the skip-cascade: given the mission's steps (idx, status,
 * depends_on), return a map of idx -> the failed/skipped upstream dep idx for
 * every still-pending step that can never become ready because it (transitively)
 * depends on a 'failed' step. Iterates to a fixpoint so a poisoned step also
 * poisons ITS dependents. Only 'planned'/'dispatched' steps are candidates;
 * terminal ('done'/'failed'/'skipped') and in-flight ('running') steps are left
 * untouched. Exported for unit testing.
 */
export function computePoisonedSteps(
  steps: { idx: number; status: string; depends_on: number[] | null }[],
): Map<number, number> {
  const statusByIdx = new Map(steps.map((s) => [s.idx, s.status]));
  const poisonedBy = new Map<number, number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of steps) {
      if (poisonedBy.has(s.idx)) continue;
      if (s.status !== "planned" && s.status !== "dispatched") continue;
      for (const dep of s.depends_on ?? []) {
        if (statusByIdx.get(dep) === "failed" || poisonedBy.has(dep)) {
          poisonedBy.set(s.idx, dep);
          changed = true;
          break;
        }
      }
    }
  }
  return poisonedBy;
}

/**
 * Skip-cascade writer: terminalize the pending dependents of any 'failed' step as
 * 'skipped' so the DAG can finalize. Without this, next_ready_mission_steps never
 * returns a step with a failed dependency (it requires every dep 'done') and
 * maybeCompleteMission never sees an all-terminal DAG, so the mission hangs
 * 'running' forever. Idempotent and concurrency-safe: each write CAS-guards on the
 * pending statuses, so a re-run (or an overlapping tick) is a no-op and never
 * clobbers a step that legitimately progressed. Returns the count newly skipped.
 */
export async function cascadeSkipFailedDependents(
  supabase: SupabaseClient,
  missionId: string,
): Promise<number> {
  const { data: rows } = await supabase
    .from("mission_steps")
    .select("id,idx,status,depends_on")
    .eq("mission_id", missionId);
  const steps = (rows ?? []) as {
    id: string;
    idx: number;
    status: string;
    depends_on: number[] | null;
  }[];
  if (steps.length === 0) return 0;

  const poisonedBy = computePoisonedSteps(steps);
  if (poisonedBy.size === 0) return 0;

  const now = new Date().toISOString();
  let skipped = 0;
  for (const s of steps) {
    const depIdx = poisonedBy.get(s.idx);
    if (depIdx === undefined) continue;
    const { data: updated } = await supabase
      .from("mission_steps")
      .update({
        status: "skipped",
        error: `Skipped: upstream step #${depIdx} failed`,
        completed_at: now,
      })
      .eq("id", s.id)
      .in("status", ["planned", "dispatched"])
      .select("id");
    if (updated?.length) skipped += updated.length;
  }
  return skipped;
}

/**
 * Advance a single mission one tick, deterministically and model-free:
 * reflect → dispatch ready → skip-cascade failed dependents → finalize. Safe to
 * call repeatedly and concurrently; a no-op for missions with no ready work or no
 * DAG. Returns a small summary.
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

  // 3b. KI-15: release an orphaned-handoff completion block (stale unconsumed
  //     message) so a dropped single hop can't pin the mission 'running' forever.
  await sweepStaleUnconsumedMessages(supabase, mission.id);

  // 3c. Skip-cascade: a failed step's dependents can never become ready (the
  //     ready-RPC requires every dependency 'done'), so without this they sit
  //     'planned' forever and the mission can never reach an all-terminal state
  //     for maybeCompleteMission to finalize — it would hang 'running' for good.
  //     Mark them 'skipped' so the DAG terminalizes (as completed_with_failures).
  await cascadeSkipFailedDependents(supabase, mission.id);

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
