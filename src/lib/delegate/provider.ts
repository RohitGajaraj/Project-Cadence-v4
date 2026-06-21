/**
 * BLD-04 (Delegate-out to external coding agents): the `DelegateProvider` seam.
 *
 * One swappable abstraction for "hand a build task off to an external coding
 * agent, still governed". The first wired target is OpenHands self-host (Apache,
 * free); Devin / Claude-Code / SWE-agent are reserved ids that plug in behind the
 * same interface once the founder confirms the BYO endpoint + key. The whole
 * capability is DORMANT by default: with no `DELEGATE_OUTBOUND_ENABLED` flag and
 * no endpoint configured, the resolver returns the {@link nullDelegateProvider}
 * floor, which accepts nothing, so a misconfiguration can never silently fan a
 * build out to an unconfigured external agent.
 *
 * This module is PURE (no env, no I/O): the contract, the null floor, and the
 * request/response mapping. The env-reading + network adapter lives in the
 * server-only seam `openhands.server.ts`, so this file is safe to import anywhere.
 *
 * Mirrors the proven SANDBOX `ExecProvider` seam (`@/lib/exec/provider`): scaffold
 * the seam + ship the dormant floor; do NOT provision an account, add a secret, or
 * turn on outbound delegation (those are founder-only). Wiring the tool into the
 * live agent loop (the registry + the loop's review-force) is a separate increment
 * (it touches the pinned chokepoint files); see `docs/features/bld04-delegate-out.md`.
 */

/** Every external coding-agent backend we know about. */
export type DelegateProviderId = "openhands" | "devin" | "claude-code" | "swe-agent";

/** A normalized request to delegate one build task to an external coding agent. */
export interface DelegateRequest {
  /** What to build, the canonical task/goal text. */
  task: string;
  /** Repository the external agent should work against. */
  repoUrl: string;
  /** Branch the external agent should base its work on. */
  baseBranch: string;
  /** Structured context forwarded verbatim (treated as opaque by the seam). */
  context?: Record<string, unknown>;
  /** The originating Cadence run id, so a future callback can resume the run. */
  cadenceRunId?: string | null;
}

/** An external backend's verdict on a delegation attempt. */
export interface DelegateVerdict {
  provider: DelegateProviderId;
  /** True when the external agent accepted the task and started/queued it. */
  accepted: boolean;
  /** The external agent's own job/task id, for later polling (null if not accepted). */
  externalJobId: string | null;
  /** Human-readable reason (the external status, or why it was refused/disabled). */
  reason: string;
}

export interface DelegateProvider {
  readonly id: DelegateProviderId;
  /** Whether this backend is wired AND permitted (flag + credentials) right now. */
  readonly available: boolean;
  submit(req: DelegateRequest): Promise<DelegateVerdict>;
}

/**
 * The dormant floor: accepts nothing. This is what the resolver returns whenever
 * outbound delegation is disabled or no live adapter matches, so a delegation
 * attempt degrades to a clear "disabled" verdict instead of an error or a silent
 * hand-off to an unconfigured endpoint.
 */
export const nullDelegateProvider: DelegateProvider = {
  id: "openhands",
  available: false,
  async submit(): Promise<DelegateVerdict> {
    return {
      provider: "openhands",
      accepted: false,
      externalJobId: null,
      reason: "delegate-out is disabled (no DELEGATE_OUTBOUND_ENABLED / endpoint configured)",
    };
  },
};

/**
 * Reserved backends named behind the seam but not yet wired (each needs its own
 * adapter + a founder-supplied BYO endpoint/key). Listed here so the resolver and
 * the docs stay the single source of "what can plug in", with nobody hard-coding
 * a provider id elsewhere.
 */
export const RESERVED_DELEGATE_PROVIDER_IDS: readonly DelegateProviderId[] = [
  "devin",
  "claude-code",
  "swe-agent",
];

/** The OpenHands self-host task-submit request body (their `/api/v1/tasks` POST). */
export interface OpenHandsTaskRequest {
  goal: string;
  repo: string;
  branch: string;
  metadata: Record<string, unknown>;
}

/** Max chars of task text forwarded to the external agent (bounded, predictable). */
export const DELEGATE_TASK_MAX_CHARS = 8000;

/**
 * Pure mapping: a normalized {@link DelegateRequest} to the OpenHands task body.
 * Bounded + deterministic, so it is unit-testable with no network.
 */
export function buildOpenHandsRequest(req: DelegateRequest): OpenHandsTaskRequest {
  const task = typeof req.task === "string" ? req.task : "";
  return {
    goal: task.slice(0, DELEGATE_TASK_MAX_CHARS),
    repo: req.repoUrl,
    branch: req.baseBranch,
    metadata: {
      context: req.context ?? {},
      cadence_run_id: req.cadenceRunId ?? null,
    },
  };
}

/** The subset of an OpenHands task-submit response the seam reads. */
export interface OpenHandsTaskResponse {
  task_id?: string | null;
  status?: string | null;
}

/** Statuses that mean OpenHands accepted the task (started or queued it). */
const ACCEPTED_STATUSES = new Set(["queued", "running", "pending", "accepted", "started"]);

/**
 * Pure mapping: an OpenHands task-submit response to a {@link DelegateVerdict}.
 * Accepts only on a known accepted-status WITH a task id (so a malformed/empty
 * response is treated as a refusal, never a phantom acceptance). Deterministic.
 */
export function mapOpenHandsResponse(
  resp: OpenHandsTaskResponse | null | undefined,
): DelegateVerdict {
  const status = typeof resp?.status === "string" ? resp.status.toLowerCase() : "";
  const jobId = typeof resp?.task_id === "string" && resp.task_id ? resp.task_id : null;
  const accepted = jobId != null && ACCEPTED_STATUSES.has(status);
  return {
    provider: "openhands",
    accepted,
    externalJobId: accepted ? jobId : null,
    reason: accepted ? `openhands: ${status}` : `openhands refused (status="${status || "none"}")`,
  };
}
