/**
 * BLD-GATE-SYNC: pure reconciliation for the human-gate state of missions and approvals.
 *
 * The problem (found 2026-06-29 against the live DB): a mission driven by a single agent run
 * that PAUSES on a HITL gate (e.g. `studio.commit`) stays `missions.status='running'` forever —
 * `advanceMissionCore` only syncs missions that have a `mission_steps` DAG, and `loop.server.ts`
 * (the frozen AI core) marks the RUN `waiting_approval` without touching the parent mission. So the
 * Delegate Desk maps the mission to the "working" lane (laneForStatus: running -> working) and the
 * operator is never told THEY are the blocker — the "why is the loop idle?" experience. Separately,
 * an approval that reached a terminal status (failed/executed/denied/cancelled) can be left with a
 * stale `escalation_state='pending'`, so it haunts every Needs-You surface (today/governance read
 * `escalation_state`, not `status`) as a phantom the operator can never clear.
 *
 * The fix is deterministic, model-free RECONCILIATION run by the existing per-minute cron sweepers
 * (resume-runs.ts for missions, approvals-tick.ts for approvals) — the Kubernetes-controller pattern
 * this codebase already uses. No edits to the frozen AI core. Both decisions are pure and total
 * (never throw) so the whole verdict is unit-tested with no DB, no publish, and no AI spend.
 *
 * Invariant relied upon (documented in missions.functions.ts): the resume sweeper resumes runs by
 * their OWN status, INDEPENDENT of the mission status, and `maybeCompleteMission` only finalizes a
 * mission whose status is `running`/`in_progress`. Therefore the mission MUST be flipped back to
 * `running` BEFORE its run resumes/completes — hence `classifyMissionGate` is symmetric
 * (block <-> unblock), and the sweeper applies `unblock` before the resume pass and `block` after it.
 */

/** Run statuses meaning "an agent is actively progressing" (i.e. NOT parked on a human gate). */
export const ACTIVE_RUN_STATUSES = [
  "queued",
  "running",
  "dispatched",
  "processing",
  "executing",
] as const;

/** Mission statuses the auto-advance loop drives; only these are eligible to be blocked. */
const RUNNING_STATUSES = new Set(["running", "in_progress"]);

/** Approval statuses that mean a human/system has already moved past "needs you". */
const DECIDED_APPROVAL_STATUSES = new Set([
  "executed",
  "denied",
  "failed",
  "cancelled",
  "approved",
  "resolved",
]);

/** Escalation states that surface an approval in the Needs-You / governance lists. */
const FLAGGED_ESCALATION_STATES = new Set(["pending", "expired"]);

const norm = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

export interface MissionGateInput {
  /** current `missions.status`. */
  status: string;
  /** statuses of this mission's `agent_runs` (any order; may be empty). */
  runStatuses: string[];
  /** # of this mission's `agent_approvals` that are genuinely still pending a human decision. */
  pendingGateCount: number;
}

export type GateAction = "block" | "unblock" | "none";

/**
 * Decide whether a mission's status should reconcile to reflect human-gate blocking.
 *
 *  - `block`   — a running/in_progress mission whose work is fully parked on a pending gate
 *                (>=1 run `waiting_approval`, >=1 pending gate, and NO run still progressing).
 *                The caller sets `missions.status='blocked'` so it surfaces in the Needs-You lane.
 *  - `unblock` — a `blocked` mission that is no longer gate-blocked (operator decided / runs
 *                terminal). The caller sets it back to `running` so the existing resume +
 *                `maybeCompleteMission` flow re-engages.
 *  - `none`    — leave as-is (still working, still genuinely blocked, terminal, or unplanned).
 */
export function classifyMissionGate(m: MissionGateInput): GateAction {
  const status = norm(m.status);
  const runs = m.runStatuses.map(norm);
  const hasWaiting = runs.includes("waiting_approval");
  const hasProgressing = runs.some((r) => (ACTIVE_RUN_STATUSES as readonly string[]).includes(r));
  // Fully parked on a human gate: a run is waiting, a gate is genuinely pending, and nothing
  // else is still moving. (Zero-run missions never satisfy this — that is KI-17's domain.)
  const gateBlocked = hasWaiting && m.pendingGateCount > 0 && !hasProgressing;

  if (RUNNING_STATUSES.has(status)) return gateBlocked ? "block" : "none";
  if (status === "blocked") return gateBlocked ? "none" : "unblock";
  return "none";
}

export interface ApprovalEscalationInput {
  /** `agent_approvals.status`. */
  status: string;
  /** `agent_approvals.escalation_state`. */
  escalationState: string;
  /** `agent_approvals.decided_at` (ISO string) or null. */
  decidedAt: string | null;
}

/**
 * True when an approval has been decided/terminal but is still FLAGGED as needing the operator —
 * the stale-`escalation_state` bug. The caller clears `escalation_state` to `'resolved'`.
 *
 * Deliberately leaves a consistently auto-expired approval alone (status=`expired` +
 * escalation_state=`expired`, undecided): that pairing is intentional (a missed-decision record the
 * operator may want to see), not a mismatch.
 */
export function needsEscalationResolve(a: ApprovalEscalationInput): boolean {
  const status = norm(a.status);
  const escalation = norm(a.escalationState);
  const decided = a.decidedAt != null || DECIDED_APPROVAL_STATUSES.has(status);
  return decided && FLAGGED_ESCALATION_STATES.has(escalation);
}
