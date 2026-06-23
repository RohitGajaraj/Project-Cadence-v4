/**
 * PLAYBOOK-REGISTRY (v11 #17) — PURE versioned registry of opinionated PM method.
 *
 * "Institutional product judgment as software": for each station of the loop, bind a named,
 * versioned PM method (JTBD, RICE, discovery interviews, the PRD spine, positioning) to the
 * workspace's own decision-memory, and rank the available methods by their per-outcome track
 * record IN THIS WORKSPACE. The Critic already proves the binding live; this generalizes it
 * into a registry every station can draw on.
 *
 * The DEFINITIONS are industry-standard frameworks (not founder taste) carried here as
 * versioned data; the LEARNING half — which method actually works here — comes from
 * `playbook_runs` (one row per application, stamped with the eventual verdict). This module is
 * the PURE core: the registry + station selection + per-outcome ranking, unit-verifiable with
 * no db/network/AI. The server adapter joins it to live runs.
 */

export type PlaybookStation =
  | "discovery"
  | "prioritization"
  | "prd"
  | "positioning"
  | "validation";

export type PlaybookDefinition = {
  id: string;
  /** Bump when the steps/framing change so a recorded run pins the version it used. */
  version: number;
  station: PlaybookStation;
  name: string;
  /** One-line, signal-first summary of when to reach for it. */
  summary: string;
  /** The opinionated method, as ordered steps. */
  steps: string[];
  /** What a good outcome looks like (the signal the ranking learns against). */
  rankingSignal: string;
};

/**
 * The registry. Standard frameworks, versioned. Adding a method or bumping a version is a
 * code change (reviewable, diffable) — never a silent runtime mutation.
 */
export const PLAYBOOK_REGISTRY: readonly PlaybookDefinition[] = [
  {
    id: "jtbd",
    version: 1,
    station: "discovery",
    name: "Jobs to be Done",
    summary: "Frame the demand as a job the user hires the product to do, not a feature ask.",
    steps: [
      "State the job: when [situation], the user wants to [motivation], so they can [outcome].",
      "Find the current hire (the workaround) and why it underperforms.",
      "Name the forces: push of the problem, pull of the new way, anxiety, and habit.",
      "Write the success metric as the job done, not the feature shipped.",
    ],
    rankingSignal: "bets framed as jobs validate more often than feature-first bets",
  },
  {
    id: "discovery-interview",
    version: 1,
    station: "discovery",
    name: "Continuous discovery interviews",
    summary: "Talk to the customer weekly; mine stories, not opinions.",
    steps: [
      "Recruit from the actual segment, not whoever is easiest to reach.",
      "Ask for the last time they hit the problem; collect the story, not a forecast.",
      "Map the opportunity space before jumping to a solution.",
      "Triangulate across interviews before you act on any one.",
    ],
    rankingSignal: "opportunities grounded in interviews beat opinion-led ones",
  },
  {
    id: "rice",
    version: 1,
    station: "prioritization",
    name: "RICE",
    summary: "Score by Reach, Impact, Confidence, Effort to compare unlike bets.",
    steps: [
      "Reach: how many users per period, from real data.",
      "Impact: the per-user effect, on a coarse scale (0.25 to 3).",
      "Confidence: discount for how much you actually know (50/80/100%).",
      "Effort: person-months. Score = (Reach x Impact x Confidence) / Effort.",
    ],
    rankingSignal: "higher-RICE bets that shipped should validate more than low-RICE ones",
  },
  {
    id: "prd-spine",
    version: 1,
    station: "prd",
    name: "The PRD spine",
    summary: "Problem, the user, the bet, the cut line, and how you will know.",
    steps: [
      "Problem + who has it + the evidence it is real.",
      "The bet: the smallest thing that could move the metric.",
      "Explicit non-goals and the cut line for v1.",
      "Success + guardrail metrics, decided before launch.",
    ],
    rankingSignal: "PRDs with a pre-committed metric resolve decisively more often",
  },
  {
    id: "positioning-statement",
    version: 1,
    station: "positioning",
    name: "Positioning statement",
    summary: "For [segment] who [need], [product] is the [category] that [differentiator].",
    steps: [
      "Pick the one segment that feels the pain most acutely.",
      "Name the category the buyer already shops in.",
      "State the single differentiator, not a feature list.",
      "Test it against the strongest alternative the buyer would pick instead.",
    ],
    rankingSignal: "decisions tied to a sharp positioning hold up better than diffuse ones",
  },
  {
    id: "assumption-test",
    version: 1,
    station: "validation",
    name: "Riskiest-assumption test",
    summary: "Test the assumption that would sink the bet, cheaply, before building.",
    steps: [
      "List the assumptions the bet depends on.",
      "Rank by (impact if wrong) x (uncertainty).",
      "Design the cheapest test for the riskiest one.",
      "Pre-commit the pass/fail line so the result is decisive.",
    ],
    rankingSignal: "bets with a passed assumption test validate more than untested ones",
  },
];

/** PURE. The playbooks bound to a station, in registry order. */
export function selectPlaybooksForStation(station: PlaybookStation): PlaybookDefinition[] {
  return PLAYBOOK_REGISTRY.filter((p) => p.station === station);
}

/** PURE. Look up a specific playbook by id. */
export function findPlaybook(id: string): PlaybookDefinition | null {
  return PLAYBOOK_REGISTRY.find((p) => p.id === id) ?? null;
}

/** A recorded application of a playbook (from `playbook_runs`). */
export type PlaybookRun = { playbook_id: string; verdict?: string | null };

const POSITIVE = new Set(["validated", "confirmed", "win"]);
const NEGATIVE = new Set(["missed", "invalidated", "refuted", "loss"]);

export type PlaybookRanking = {
  playbook: PlaybookDefinition;
  runs: number;
  /** Runs with a decisive verdict (validated or missed). */
  decisive: number;
  validated: number;
  /** validated / decisive; null when no decisive run yet. */
  winRate: number | null;
};

/**
 * PURE. Rank a station's playbooks by their per-outcome track record in this workspace.
 * Ordering: playbooks WITH a decisive track record first, by win rate (then by volume);
 * untried playbooks keep registry order behind them. This is what makes the registry learn —
 * a method that keeps validating rises; one that keeps missing sinks. Empty runs => registry
 * order, all null winRate (honest "no track record yet").
 */
export function rankPlaybooksByOutcome(
  station: PlaybookStation,
  runs: readonly PlaybookRun[],
): PlaybookRanking[] {
  const byId = new Map<string, { runs: number; decisive: number; validated: number }>();
  for (const r of Array.isArray(runs) ? runs : []) {
    if (!r || typeof r.playbook_id !== "string") continue;
    const agg = byId.get(r.playbook_id) ?? { runs: 0, decisive: 0, validated: 0 };
    agg.runs += 1;
    const v = typeof r.verdict === "string" ? r.verdict.trim().toLowerCase() : "";
    if (POSITIVE.has(v)) {
      agg.decisive += 1;
      agg.validated += 1;
    } else if (NEGATIVE.has(v)) {
      agg.decisive += 1;
    }
    byId.set(r.playbook_id, agg);
  }

  const ranked: PlaybookRanking[] = selectPlaybooksForStation(station).map((playbook, idx) => {
    const agg = byId.get(playbook.id) ?? { runs: 0, decisive: 0, validated: 0 };
    return {
      playbook,
      runs: agg.runs,
      decisive: agg.decisive,
      validated: agg.validated,
      winRate: agg.decisive > 0 ? Math.round((agg.validated / agg.decisive) * 100) / 100 : null,
      _idx: idx,
    } as PlaybookRanking & { _idx: number };
  });

  ranked.sort((a, b) => {
    const ar = a as PlaybookRanking & { _idx: number };
    const br = b as PlaybookRanking & { _idx: number };
    // Decisive track record first.
    if ((a.winRate === null) !== (b.winRate === null)) return a.winRate === null ? 1 : -1;
    if (a.winRate !== null && b.winRate !== null && a.winRate !== b.winRate) {
      return b.winRate - a.winRate;
    }
    if (a.runs !== b.runs) return b.runs - a.runs;
    return ar._idx - br._idx; // stable: registry order
  });

  return ranked.map(({ playbook, runs, decisive, validated, winRate }) => ({
    playbook,
    runs,
    decisive,
    validated,
    winRate,
  }));
}
