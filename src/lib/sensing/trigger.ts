// AMBIENT-TRIGGER (v11 #4) - the pure self-initiation policy: given accumulated workspace
// state (signal clusters that grew, recorded outcomes), decide which missions to
// self-originate, with NO database, NO AI call, NO I/O. Deterministic + unit-testable. The
// `trigger-tick` cron is the thin server glue that loads state, calls this, and writes the
// proposed missions + their Trust-Ledger receipts.
//
// This is the complement to the event reactor (reactor.functions.ts), which reacts to
// DISCRETE events (signal.created, opportunity.scored). AMBIENT-TRIGGER reacts to ACCUMULATED
// STATE crossing a threshold - the "self-driving" behavior: no human start.
//
// Reversibility governance (v11): a proposal is only ever a PROPOSED mission (a status the
// resume-runs executor ignores), so the policy commits ZERO AI spend and nothing irreversible
// happens until a human/founder promotes it to running. `reversible` is carried so a future
// activation policy can auto-run reversible internal missions while always HITL-gating the rest.
//
// Idempotency: each proposal's TITLE is its stable identity (it embeds the cluster name or the
// outcome summary, so it is unique per trigger source). The tick passes the titles of already
// open `[auto]` missions; a proposal whose title is already open is dropped. The title is the
// only anchor recoverable from `missions` (no metadata column), so dedup keys on it.

export type ThemeState = {
  id: string;
  title: string;
  frequency: number;
  severity: number;
  status: string;
};

export type OutcomeState = {
  id: string;
  verdict: string;
  summary: string;
  opportunity_id?: string | null;
};

export type TriggerProposal = {
  kind: "cluster" | "missed-outcome";
  /** Stable identity = the mission title; the tick dedups open missions on this. */
  title: string;
  goal: string;
  rationale: string;
  /** True = internal analysis (re-rank / review / investigate), safe to auto-run later.
   *  All current proposals are reversible; the field exists so an activation policy can
   *  always HITL-gate an irreversible one. */
  reversible: boolean;
  /** Higher = more urgent; the tick originates the top-N by this. */
  priority: number;
};

/** A cluster earns a mission when it is unaddressed AND has crossed an attention threshold. */
export const CLUSTER_FREQUENCY_THRESHOLD = 5;
export const CLUSTER_SEVERITY_THRESHOLD = 4;
/** Statuses that mean a theme is still worth acting on (not already handled). */
const OPEN_THEME_STATUSES = new Set(["new", "open", "active", "investigating"]);
/** Max proposals one tick will originate, so a backlog spike cannot flood missions. */
export const MAX_PROPOSALS_PER_TICK = 5;

/** All auto-originated missions carry this title prefix, so the tick can find + dedup them. */
export const AUTO_TITLE_PREFIX = "[auto]";

function autoTitle(label: string): string {
  return `${AUTO_TITLE_PREFIX} ${label}`;
}

function truncate(s: string, n: number): string {
  const t = (s || "").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

/** True if a mission title was produced by this policy (so the tick collects only ours). */
export function isAutoMissionTitle(title: string | null | undefined): boolean {
  return typeof title === "string" && title.startsWith(`${AUTO_TITLE_PREFIX} `);
}

/**
 * Decide which missions to self-originate. Pure + deterministic.
 *  - themes: clusters with frequency/severity/status.
 *  - outcomes: recorded learnings (verdict).
 *  - openTitles: titles of `[auto]` missions already open (any non-terminal status) so a
 *    trigger never double-originates.
 * Returns the top MAX_PROPOSALS_PER_TICK by priority, never throwing on any input shape.
 */
export function evaluateTriggers(
  state: { themes?: ThemeState[]; outcomes?: OutcomeState[] },
  openTitles: ReadonlySet<string> = new Set(),
  opts?: { freqThreshold?: number; sevThreshold?: number; max?: number },
): TriggerProposal[] {
  const freqT = opts?.freqThreshold ?? CLUSTER_FREQUENCY_THRESHOLD;
  const sevT = opts?.sevThreshold ?? CLUSTER_SEVERITY_THRESHOLD;
  const max = opts?.max ?? MAX_PROPOSALS_PER_TICK;
  const out: TriggerProposal[] = [];

  for (const t of state.themes ?? []) {
    if (!t || typeof t.id !== "string") continue;
    if (!OPEN_THEME_STATUSES.has((t.status || "").toLowerCase())) continue;
    const freq = Number(t.frequency) || 0;
    const sev = Number(t.severity) || 0;
    if (freq < freqT && sev < sevT) continue;
    const name = truncate(t.title || "untitled", 80);
    const title = autoTitle(`Investigate the "${name}" cluster`);
    if (openTitles.has(title)) continue;
    out.push({
      kind: "cluster",
      title,
      goal: `A recurring signal cluster ("${name}") has grown past the attention threshold. Review the clustered signals, decide whether it warrants an opportunity, and re-rank if so.`,
      rationale: `Self-initiated: the "${name}" cluster crossed the attention threshold (frequency ${freq}, severity ${sev}) with no active mission. Reversible internal review, so proposed for activation.`,
      reversible: true,
      priority: freq + sev * 2,
    });
  }

  for (const o of state.outcomes ?? []) {
    if (!o || typeof o.id !== "string") continue;
    if ((o.verdict || "").toLowerCase() !== "missed") continue;
    const summary = truncate(o.summary || "a recorded bet", 60);
    const title = autoTitle(`Re-evaluate after a missed outcome: "${summary}"`);
    if (openTitles.has(title)) continue;
    out.push({
      kind: "missed-outcome",
      title,
      goal: `A recorded outcome missed: "${summary}". Re-evaluate the governing decision and re-rank the affected priorities so the miss informs the next move.`,
      rationale: `Self-initiated: a recorded outcome was marked missed ("${summary}"). Re-evaluation is reversible internal analysis, so proposed for activation.`,
      reversible: true,
      priority: 50, // a real miss outranks a merely-large cluster
    });
  }

  out.sort((a, b) => b.priority - a.priority);
  return out.slice(0, max);
}
