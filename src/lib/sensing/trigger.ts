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

/** Signal-volume counts passed by trigger-tick for Watch/Listen threshold checks.
 *  Both fields are bounded to the SAME 24h window so a workspace with a large
 *  historical backlog does not trigger perpetual re-proposals. */
export type SignalSenseState = {
  /** Signals inserted in the last 24 hours (all sources). */
  newSignalCount: number;
  /** Pull-connector signals inserted in the last 24 hours (source_kind='pull_connector'). */
  customerSignalCount: number;
};

export type TriggerProposal = {
  kind: "cluster" | "missed-outcome" | "watch-scan" | "customer-listen";
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
  /** Pre-assigned agent slug (discovery-scout / customer-insights). Tick looks up the
   *  UUID and sets current_agent_id so the mission arrives pre-routed to the right
   *  Sense agent. Absent for cluster/missed-outcome proposals (no default assignment). */
  agentSlug?: string;
};

/** A cluster earns a mission when it is unaddressed AND has crossed an attention threshold. */
export const CLUSTER_FREQUENCY_THRESHOLD = 5;
export const CLUSTER_SEVERITY_THRESHOLD = 4;
/** New signals in the last 24h that warrant a Watch (discovery-scout) scan. */
export const WATCH_SIGNAL_THRESHOLD = 10;
/** Customer feedback signals (pull_connector) that warrant a Listen (customer-insights) scan. */
export const LISTEN_SIGNAL_THRESHOLD = 5;
/** Statuses that mean a theme is still worth acting on (not already handled). */
const OPEN_THEME_STATUSES = new Set(["new", "open", "active", "investigating"]);
/** Max proposals one tick will originate, so a backlog spike cannot flood missions. */
export const MAX_PROPOSALS_PER_TICK = 5;

/** All auto-originated missions carry this title prefix, so the tick can find + dedup them. */
export const AUTO_TITLE_PREFIX = "[auto]";

// ---------------------------------------------------------------------------
// SF-AUTOTRIGGER — auto-promotion policy (pure, no I/O)
// ---------------------------------------------------------------------------

/** Max missions the auto-trigger may promote in a 24h window per workspace.
 *  Keeps AI spend bounded (~$0.03 × cap). Founder-confirmed: 2/day. */
export const AUTO_TRIGGER_DAILY_CAP = 2;

/**
 * Pure eligibility check: should a just-created proposed mission be
 * auto-promoted to 'queued' without human approval?
 *
 * All four conditions must be true simultaneously:
 *  1. flagEnabled   — BRAIN_AUTO_TRIGGER=1 in env (default OFF; founder's circuit breaker)
 *  2. reversible    — the TriggerProposal is marked reversible (Watch/Listen scan kinds)
 *  3. ambientCount  — no actively mid-sprint missions in this workspace: running / in_progress /
 *                     waiting_approval (HITL-paused but active) / queued (starts imminently) /
 *                     blocked (stalled on a gate). Excludes 'proposed' (the status being created).
 *  4. autoTodayCount < AUTO_TRIGGER_DAILY_CAP — daily spend cap not yet hit
 *
 * Extracted as a pure function so it can be unit-tested without DB mocks.
 * The trigger-tick calls this after creating the proposed mission and, if true,
 * flips status→'queued' and stamps auto_trigger_source='auto'.
 */
export function shouldAutoPromote(opts: {
  flagEnabled: boolean;
  reversible: boolean;
  ambientCount: number; // mid-sprint missions (running/in_progress/waiting_approval/queued/blocked)
  autoTodayCount: number; // missions already auto-promoted today (created_at >= today UTC)
}): boolean {
  return (
    opts.flagEnabled &&
    opts.reversible &&
    opts.ambientCount === 0 &&
    opts.autoTodayCount < AUTO_TRIGGER_DAILY_CAP
  );
}

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
 *  - signals: optional Watch/Listen signal-volume counts for sense-agent proposals.
 *  - openTitles: titles of `[auto]` missions already open (any non-terminal status) so a
 *    trigger never double-originates.
 * Returns the top MAX_PROPOSALS_PER_TICK by priority, never throwing on any input shape.
 */
export function evaluateTriggers(
  state: { themes?: ThemeState[]; outcomes?: OutcomeState[]; signals?: SignalSenseState },
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

  // Watch proposal: enough new signals arrived to warrant a Watch (discovery-scout) scan.
  const newCount = state.signals?.newSignalCount ?? 0;
  if (newCount >= WATCH_SIGNAL_THRESHOLD) {
    const title = autoTitle("Watch: review recent signals");
    if (!openTitles.has(title)) {
      out.push({
        kind: "watch-scan",
        title,
        goal: `${newCount} new signals arrived in the last 24 hours. Review and frame what changed — identify emerging clusters, surface framed opportunities, and log anything worth tracking.`,
        rationale: `Self-initiated: ${newCount} new signals crossed the Watch threshold (${WATCH_SIGNAL_THRESHOLD}). Dispatched to the Watch agent (discovery-scout) for review and framing.`,
        reversible: true,
        priority: 30,
        agentSlug: "discovery-scout",
      });
    }
  }

  // Listen proposal: enough customer feedback signals arrived to warrant clustering.
  const customerCount = state.signals?.customerSignalCount ?? 0;
  if (customerCount >= LISTEN_SIGNAL_THRESHOLD) {
    const title = autoTitle("Listen: cluster customer feedback");
    if (!openTitles.has(title)) {
      out.push({
        kind: "customer-listen",
        title,
        goal: `${customerCount} customer feedback signals from connected sources need clustering. Group them into named themes with verbatim quotes and counts, ready for the Strategist to rank.`,
        rationale: `Self-initiated: ${customerCount} customer feedback signals crossed the Listen threshold (${LISTEN_SIGNAL_THRESHOLD}). Dispatched to the Listen agent (customer-insights) for theme clustering.`,
        reversible: true,
        priority: 25,
        agentSlug: "customer-insights",
      });
    }
  }

  out.sort((a, b) => b.priority - a.priority);
  return out.slice(0, max);
}
