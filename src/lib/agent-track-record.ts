/**
 * CORE-UX-TRUST (v11) — the per-agent TRACK RECORD shown at the point of decision.
 * "Scout · approved 44/47" — the agent's historical approval acceptance, so a human
 * deciding a gate sees this agent's standing instead of a blind yes/no. This is the
 * v11 "move trust to the point of decision" pillar.
 *
 * PURE aggregation over `agent_approvals` history; the server fn is a thin adapter.
 * Honesty rule (claim-never-outruns-wiring, per DecisionCard's own doctrine): we
 * surface ONLY the approval record we actually record. Tool-gate ROLLBACKS are not
 * tracked, so we deliberately do NOT claim "0 rollbacks" — that would be a hollow
 * metric. Rollback-aware standing is a follow-on once a rollback signal exists.
 */

// The record measures the human's APPROVE-vs-REJECT judgment of this agent, so it
// keys off what the human decided, NOT how execution then turned out. A human
// approved the gate when status reaches `approved` (decided), `executed` (approved
// + ran ok), or `failed` (approved + ran but the tool errored) — all three mean
// "you said yes". `rejected` is the decided negative. Everything else (`pending`,
// `expired`-undecided, `cancelled` = withdrawn, not a clean yes/no) is not a
// judgment and never counts toward the record — the loop below drops it.
const APPROVED = new Set(["approved", "executed", "failed"]);
const REJECTED = new Set(["rejected"]);

export type AgentTrackRecord = { approved: number; total: number };

export type DecidedApprovalRow = {
  agent_slug: string | null;
  status: string | null;
  decided_at?: string | null;
};

/**
 * PURE. Tally each agent's DECIDED approvals into approved / total (= approved +
 * rejected). Only rows the human actually judged count — pending / expired-undecided
 * do not, so the ratio is an honest acceptance record.
 */
export function summarizeAgentRecords(
  rows: DecidedApprovalRow[] | null | undefined,
): Map<string, AgentTrackRecord> {
  const out = new Map<string, AgentTrackRecord>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const slug = (r?.agent_slug ?? "").trim();
    if (!slug) continue;
    const status = (r?.status ?? "").trim().toLowerCase();
    const isApproved = APPROVED.has(status);
    const isRejected = REJECTED.has(status);
    if (!isApproved && !isRejected) continue; // not a decided judgment
    const rec = out.get(slug) ?? { approved: 0, total: 0 };
    if (isApproved) rec.approved++;
    rec.total++;
    out.set(slug, rec);
  }
  return out;
}

/**
 * PURE. Human-readable record, or null when the agent has no decided history yet
 * (so the UI shows nothing rather than a hollow "0/0"). Voice: signal-first.
 */
export function formatTrackRecord(rec: AgentTrackRecord | null | undefined): string | null {
  if (!rec || rec.total <= 0) return null;
  return `approved ${rec.approved}/${rec.total}`;
}

/** PURE. Flatten the Map to a plain object for transport in a server-fn payload. */
export function trackRecordsToObject(
  m: Map<string, AgentTrackRecord>,
): Record<string, AgentTrackRecord> {
  const out: Record<string, AgentTrackRecord> = {};
  for (const [k, v] of m) out[k] = v;
  return out;
}
