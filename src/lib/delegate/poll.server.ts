/**
 * BLD-04: poll + fold functions for the governed delegate-out cycle.
 *
 * pollDelegateJob — hits the external agent's status endpoint (dormant-safe:
 *   returns { status: 'disabled' } when the delegation env is not configured,
 *   never touches the network; fail-safe otherwise: transport errors return
 *   { status: 'unknown' } instead of throwing).
 *
 * foldDelegateResult — writes the resolved result back to mission_steps and
 *   agent_runs once the external job reaches a terminal status. Best-effort:
 *   logs errors but never throws so the caller degrades gracefully.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { delegateEnabled } from "./openhands.server";

/** Normalized status bucket for a polled external delegate job. */
export type DelegateJobStatus =
  | "disabled" // delegation env is off; poll was skipped
  | "queued" // external agent accepted the task but hasn't started yet
  | "running" // external agent is actively working
  | "done" // external agent completed the task successfully
  | "failed" // external agent failed or was cancelled
  | "unknown"; // poll returned an unrecognised status or transport error

export interface DelegatePollResult {
  status: DelegateJobStatus;
  /** Provider-side result text (present when status='done'). */
  result?: string | null;
  /** Error text from the provider or transport (present when status='failed'/'unknown'). */
  error?: string | null;
}

const POLL_TIMEOUT_MS = 15_000;

// OpenHands 0.38+ conversation statuses. "stopped" is terminal (task finished or
// user stopped it); we treat it as done and surface last_agent_message as the result.
const DONE_STATUSES = new Set(["done", "completed", "finished", "success", "stopped"]);
const RUNNING_STATUSES = new Set(["queued", "running", "pending", "accepted", "started", "awaiting_user_input"]);
const FAILED_STATUSES = new Set(["failed", "error", "rejected", "cancelled", "canceled"]);

/**
 * Poll the OpenHands endpoint for the live status of an external job.
 *
 * Dormancy invariant: if `delegateEnabled()` is false OR `OPENHANDS_ENDPOINT`
 * is unset, returns `{ status: 'disabled' }` immediately with no network call
 * (mirrors the submit-side dormancy guarantee in `openhands.server.ts`).
 */
export async function pollDelegateJob(externalJobId: string): Promise<DelegatePollResult> {
  if (!delegateEnabled() || !process.env.OPENHANDS_ENDPOINT) {
    return { status: "disabled" };
  }
  const endpoint = (process.env.OPENHANDS_ENDPOINT as string).replace(/\/$/, "");
  const apiKey = process.env.OPENHANDS_API_KEY;
  try {
    const res = await fetch(`${endpoint}/api/v1/tasks/${encodeURIComponent(externalJobId)}`, {
      headers: {
        accept: "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    if (!res.ok) return { status: "unknown", error: `http ${res.status}` };
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json) return { status: "unknown", error: "empty response" };
    const raw = typeof json.status === "string" ? json.status.toLowerCase() : "";
    if (DONE_STATUSES.has(raw)) {
      // OpenHands 0.38+: final agent output is in last_agent_message.
      const result =
        typeof json.last_agent_message === "string" ? json.last_agent_message : null;
      return { status: "done", result };
    }
    if (FAILED_STATUSES.has(raw)) {
      const error =
        typeof json.error === "string"
          ? json.error
          : typeof json.last_agent_message === "string"
            ? json.last_agent_message
            : `openhands: ${raw}`;
      return { status: "failed", error };
    }
    if (RUNNING_STATUSES.has(raw)) return { status: "running" };
    return { status: "unknown" };
  } catch (err) {
    return {
      status: "unknown",
      error: err instanceof Error ? err.name : "error",
    };
  }
}

export interface FoldInput {
  runId: string;
  missionId: string;
  provider: string;
  externalJobId: string;
  pollResult: DelegatePollResult;
  supabase: SupabaseClient;
}

/**
 * Fold an external delegate job's terminal result back into the mission:
 * 1. Update the `mission_steps` row where `run_id = runId` → done/failed + result.
 * 2. Update `agent_runs.delegate_meta.poll_status` + `agent_runs.status`.
 *
 * Only call on terminal statuses (done/failed). Non-terminal statuses are logged
 * and silently returned so callers can poll again later.
 */
export async function foldDelegateResult({
  runId,
  missionId,
  provider,
  externalJobId,
  pollResult,
  supabase,
}: FoldInput): Promise<void> {
  if (pollResult.status !== "done" && pollResult.status !== "failed") {
    console.warn(
      `[delegate-fold] called with non-terminal status '${pollResult.status}' for run ${runId}; skipping fold`,
    );
    return;
  }
  try {
    const stepStatus = pollResult.status === "done" ? "done" : "failed";
    const now = new Date().toISOString();
    const resultPayload: Record<string, unknown> = {
      provider,
      external_job_id: externalJobId,
    };
    if (pollResult.result) resultPayload.delegate_result = pollResult.result;
    if (pollResult.error) resultPayload.delegate_error = pollResult.error;

    const { error: stepErr } = await supabase
      .from("mission_steps")
      .update({
        status: stepStatus,
        result: resultPayload,
        completed_at: now,
        updated_at: now,
      })
      .eq("mission_id", missionId)
      .eq("run_id", runId);
    if (stepErr) {
      console.error("[delegate-fold] mission_steps update failed:", stepErr.message);
    }

    const { error: runErr } = await supabase
      .from("agent_runs")
      .update({
        status: stepStatus,
        delegate_meta: {
          provider,
          external_job_id: externalJobId,
          poll_status: pollResult.status,
          last_polled_at: now,
        },
      })
      .eq("id", runId);
    if (runErr) {
      console.error("[delegate-fold] agent_runs update failed:", runErr.message);
    }
  } catch (err) {
    console.error("[delegate-fold] unexpected error; degrading silently:", err);
  }
}
