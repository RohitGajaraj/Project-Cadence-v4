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

/**
 * The OpenHands 0.38+ conversation-create request body (`POST /api/conversations`).
 * `repository` is in "owner/repo" format (extracted from a full clone URL).
 */
export interface OpenHandsTaskRequest {
  initial_user_msg: string;
  repository?: string;
  selected_branch?: string;
}

/** Max chars of task text forwarded to the external agent (bounded, predictable). */
export const DELEGATE_TASK_MAX_CHARS = 8000;

/**
 * Pure mapping: a normalized {@link DelegateRequest} to the OpenHands conversation body.
 * Extracts `owner/repo` from a full clone URL. Bounded + deterministic.
 */
export function buildOpenHandsRequest(req: DelegateRequest): OpenHandsTaskRequest {
  const task = typeof req.task === "string" ? req.task : "";
  // Strip protocol + host, strip trailing .git → "owner/repo" format OpenHands expects.
  const repoPath = req.repoUrl
    ? req.repoUrl.replace(/^https?:\/\/[^/]+\//, "").replace(/\.git$/, "")
    : undefined;
  const body: OpenHandsTaskRequest = {
    initial_user_msg: task.slice(0, DELEGATE_TASK_MAX_CHARS),
  };
  if (repoPath) body.repository = repoPath;
  if (req.baseBranch) body.selected_branch = req.baseBranch;
  return body;
}

/** The subset of an OpenHands conversation-create response the seam reads. */
export interface OpenHandsTaskResponse {
  conversation_id?: string | null;
}

/**
 * Pure mapping: an OpenHands conversation-create response to a {@link DelegateVerdict}.
 * Accepts only when a `conversation_id` is present (so a malformed/empty response is
 * treated as a refusal, never a phantom acceptance). Deterministic.
 */
export function mapOpenHandsResponse(
  resp: OpenHandsTaskResponse | null | undefined,
): DelegateVerdict {
  const jobId =
    typeof resp?.conversation_id === "string" && resp.conversation_id
      ? resp.conversation_id
      : null;
  return {
    provider: "openhands",
    accepted: jobId != null,
    externalJobId: jobId,
    reason: jobId != null ? "openhands: accepted" : "openhands refused (no conversation_id)",
  };
}
