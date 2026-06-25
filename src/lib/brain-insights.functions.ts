/**
 * BRAIN-UX-V11 — human LENSES on the decision/memory graph (floor) + AI analyst ceiling.
 * Floor: pure rule-based lenses (beliefs, learned, timeline, why, unresolved). No AI.
 * Ceiling (getBrainAnalysis): agent-volunteered intelligence via callModel("copilot").
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LineageEdgeLite } from "@/lib/trust-ledger.functions";
import { callModel } from "@/lib/ai/runtime.server";

export type BrainBeliefs = { standing: number; superseded: number };

export type LearnedSummary = {
  total: number;
  validated: number;
  missed: number;
  mixed: number;
  other: number;
  /** validated / (validated + missed); null when there is no decisive outcome yet. */
  hitRate: number | null;
};

export type TimelineBucket = {
  month: string;
  decisions: number;
  superseded: number;
  learnings: number;
};

export type BrainInsight = { tone: "positive" | "watch" | "neutral"; text: string };

export type RecentLearning = {
  summary: string;
  verdict: string;
  metricLabel: string | null;
  metricValue: string | null;
  iceShift: number | null;
  createdAt: string;
};

export type RecentBelief = {
  title: string;
  status: string;
  superseded: boolean;
  createdAt: string;
  /** The decision's own recorded "why" — null when none was captured. */
  rationale: string | null;
  /** The title of the decision that superseded this one (the "why it changed"), when known. */
  revisedBy: string | null;
};

/** An open question: two recorded artifacts flagged as in tension, not yet reconciled. */
export type OpenContradiction = { title: string; detail: string };

export type UnresolvedQuestions = {
  /** Total open items (listed contradictions + mixed/inconclusive outcomes). */
  count: number;
  contradictions: OpenContradiction[];
  /** Outcomes that came back mixed/inconclusive — unsettled signal. */
  mixedOutcomes: number;
};

export type BrainInsights = {
  beliefs: BrainBeliefs;
  learned: LearnedSummary;
  timeline: TimelineBucket[];
  insights: BrainInsight[];
  recentLearnings: RecentLearning[];
  recentBeliefs: RecentBelief[];
  unresolved: UnresolvedQuestions;
};

type DecisionLite = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  rationale: string | null;
  mission_id: string | null;
  prd_id: string | null;
  meeting_id: string | null;
};
type LearningLite = {
  verdict: string | null;
  summary: string | null;
  metric_label: string | null;
  metric_value: string | null;
  prior_ice: number | null;
  new_ice: number | null;
  created_at: string;
};

const POSITIVE = new Set(["validated", "confirmed", "win"]);
const NEGATIVE = new Set(["missed", "invalidated", "refuted", "loss"]);
const NEUTRAL = new Set(["mixed", "inconclusive", "partial"]);

/** PURE. Tally learnings by verdict and derive the decisive hit rate. */
export function summarizeLearnings(
  rows: { verdict: string | null }[] | null | undefined,
): LearnedSummary {
  let validated = 0,
    missed = 0,
    mixed = 0,
    other = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    const v = (r?.verdict ?? "").trim().toLowerCase();
    if (POSITIVE.has(v)) validated++;
    else if (NEGATIVE.has(v)) missed++;
    else if (NEUTRAL.has(v)) mixed++;
    else other++;
  }
  const decisive = validated + missed;
  return {
    total: validated + missed + mixed + other,
    validated,
    missed,
    mixed,
    other,
    hitRate: decisive > 0 ? Math.round((validated / decisive) * 100) : null,
  };
}

/** PURE. A decision is superseded if its id OR its source artifact is the child of an active supersession edge. */
export function isDecisionSuperseded(d: DecisionLite, superseded: Map<string, string>): boolean {
  return [d.id, d.mission_id, d.prd_id, d.meeting_id].some(
    (id) => typeof id === "string" && id !== "" && superseded.has(id),
  );
}

/** PURE. Month key (YYYY-MM) from an ISO timestamp without touching Date (resume/test safe). */
export function monthKey(iso: string | null | undefined): string | null {
  if (typeof iso !== "string" || iso.length < 7) return null;
  const k = iso.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(k) ? k : null;
}

/** PURE. Group decisions (+ which are superseded) and learnings into the most-recent `limit` month buckets, oldest→newest. */
export function buildTimeline(
  decisions: DecisionLite[],
  superseded: Map<string, string>,
  learnings: { created_at: string }[],
  limit = 6,
): TimelineBucket[] {
  const map = new Map<string, TimelineBucket>();
  const bucket = (m: string) =>
    map.get(m) ??
    (map.set(m, { month: m, decisions: 0, superseded: 0, learnings: 0 }), map.get(m)!);
  for (const d of Array.isArray(decisions) ? decisions : []) {
    const m = monthKey(d.created_at);
    if (!m) continue;
    const b = bucket(m);
    b.decisions++;
    if (isDecisionSuperseded(d, superseded)) b.superseded++;
  }
  for (const l of Array.isArray(learnings) ? learnings : []) {
    const m = monthKey(l.created_at);
    if (!m) continue;
    bucket(m).learnings++;
  }
  return [...map.values()]
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
    .slice(-limit);
}

/** PURE. Plain-language, honest, rule-based observations (the "analyst" floor). Voice: signal-first, honest when sparse. */
export function derivePatterns(beliefs: BrainBeliefs, learned: LearnedSummary): BrainInsight[] {
  const out: BrainInsight[] = [];
  const totalDecisions = beliefs.standing + beliefs.superseded;

  if (totalDecisions === 0 && learned.total === 0) {
    out.push({
      tone: "neutral",
      text: "Cadence is still gathering precedent. These lenses sharpen as decisions get made and their outcomes come back.",
    });
    return out;
  }

  if (learned.hitRate !== null) {
    const decisive = learned.validated + learned.missed;
    out.push({
      tone: learned.hitRate >= 60 ? "positive" : "watch",
      text:
        learned.hitRate >= 60
          ? `Your calls are landing: ${learned.hitRate}% of ${decisive} decisive outcomes validated.`
          : `Worth a look: only ${learned.hitRate}% of ${decisive} decisive outcomes validated — the misses may share a pattern.`,
    });
  }
  if (learned.mixed > 0) {
    out.push({
      tone: "neutral",
      text: `${learned.mixed} outcome${learned.mixed === 1 ? "" : "s"} came back mixed — partial signal, not a clean win or loss.`,
    });
  }

  if (totalDecisions > 0) {
    if (beliefs.superseded > 0) {
      out.push({
        tone: "neutral",
        text: `${beliefs.superseded} of ${totalDecisions} decisions have been revised since — the belief set is evolving, not frozen.`,
      });
    } else {
      out.push({
        tone: "positive",
        text: `All ${totalDecisions} recorded decisions still stand — none has been superseded.`,
      });
    }
  }

  return out;
}

/**
 * PURE. The id of the artifact that superseded a decision — checked via the
 * decision's own id AND its source artifacts (a decision is revised when its
 * source prd/mission/meeting is). Returns the superseding parent id, or null.
 * This powers the per-decision "why it changed" lens.
 */
export function supersedingIdFor(
  d: Pick<DecisionLite, "id" | "mission_id" | "prd_id" | "meeting_id">,
  superseded: Map<string, string>,
): string | null {
  for (const id of [d.id, d.mission_id, d.prd_id, d.meeting_id]) {
    if (typeof id === "string" && id !== "" && superseded.has(id)) {
      return superseded.get(id) || null;
    }
  }
  return null;
}

/**
 * PURE. child -> superseding parent for ACTIVE `supersedes` edges ONLY. This is
 * the narrow "revised" map for the Brain panel: a decision is "revised" when a
 * later decision genuinely REPLACED it. `contradicts` is deliberately excluded —
 * a contradiction is an OPEN conflict (it routes to the unresolved lens), not a
 * settled revision. (The shared `supersededChildIds` lumps both together because
 * the Trust Ledger asks the different question "is this still the active belief".)
 */
export function supersedesParentMap(
  edges: LineageEdgeLite[] | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of Array.isArray(edges) ? edges : []) {
    if (!e || (e.relation ?? "").trim().toLowerCase() !== "supersedes") continue;
    const retired = typeof e.valid_to === "string" && e.valid_to.trim() !== "";
    if (retired) continue;
    if (typeof e.child_id === "string" && e.child_id) {
      out.set(e.child_id, typeof e.parent_id === "string" ? e.parent_id : "");
    }
  }
  return out;
}

/**
 * PURE. childIds that were genuinely RESOLVED by an active `supersedes` edge
 * (NOT a `contradicts` flag). A contradiction whose endpoint was later
 * superseded is settled; one that was not is still an open question.
 */
export function resolvedChildIds(edges: LineageEdgeLite[] | null | undefined): Set<string> {
  return new Set(supersedesParentMap(edges).keys());
}

export type ContradictionPair = { aId: string; bId: string };

/** PURE. Active (`valid_to` null) `contradicts` edges, deduped to unordered id pairs. */
export function activeContradictions(
  edges: LineageEdgeLite[] | null | undefined,
): ContradictionPair[] {
  const out: ContradictionPair[] = [];
  const seen = new Set<string>();
  for (const e of Array.isArray(edges) ? edges : []) {
    if (!e || (e.relation ?? "").trim().toLowerCase() !== "contradicts") continue;
    const retired = typeof e.valid_to === "string" && e.valid_to.trim() !== "";
    if (retired) continue;
    const a = typeof e.parent_id === "string" ? e.parent_id : "";
    const b = typeof e.child_id === "string" ? e.child_id : "";
    if (!a || !b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ aId: a, bId: b });
  }
  return out;
}

/**
 * PURE. The "what's unresolved" lens. An open contradiction is an ACTIVE
 * `contradicts` pair that touches a known decision AND was not settled by a real
 * supersession on either endpoint. Mixed/inconclusive outcomes are surfaced as a
 * second, honest class of unsettled signal. Voice: signal-first, honest.
 */
export function deriveUnresolved(
  decisions: Pick<DecisionLite, "id" | "title">[],
  contradictions: ContradictionPair[],
  resolved: Set<string>,
  learned: LearnedSummary,
  limit = 6,
): UnresolvedQuestions {
  const titleById = new Map<string, string>();
  for (const d of Array.isArray(decisions) ? decisions : []) {
    if (d && typeof d.id === "string" && d.id) titleById.set(d.id, d.title ?? "");
  }
  const out: OpenContradiction[] = [];
  let openCount = 0; // count ALL qualifying contradictions (pre-cap) so `count` stays an honest total
  for (const c of Array.isArray(contradictions) ? contradictions : []) {
    if (resolved.has(c.aId) || resolved.has(c.bId)) continue; // a real supersession settled it
    const known = titleById.has(c.aId) ? c.aId : titleById.has(c.bId) ? c.bId : null;
    if (!known) continue; // keep the lens decision-focused
    openCount++;
    if (out.length < limit) {
      out.push({
        title: titleById.get(known) || "A recorded decision",
        detail: "Flagged as conflicting with another recorded decision — not yet reconciled.",
      });
    }
  }
  return { count: openCount + learned.mixed, contradictions: out, mixedOutcomes: learned.mixed };
}

const Schema = z.object({ workspaceId: z.string().uuid().optional() }).partial();

export const getBrainInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Schema.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<BrainInsights> => {
    const supabase = context.supabase as SupabaseClient;
    let workspaceId = data?.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase.rpc("current_user_default_workspace");
      workspaceId = (ws as string | null) ?? null;
    }
    const empty: BrainInsights = {
      beliefs: { standing: 0, superseded: 0 },
      learned: summarizeLearnings([]),
      timeline: [],
      insights: derivePatterns({ standing: 0, superseded: 0 }, summarizeLearnings([])),
      recentLearnings: [],
      recentBeliefs: [],
      unresolved: { count: 0, contradictions: [], mixedOutcomes: 0 },
    };
    if (!workspaceId) return empty;

    const [decisionsRes, learningsRes] = await Promise.all([
      supabase
        .from("decisions")
        .select("id,title,status,created_at,rationale,mission_id,prd_id,meeting_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("learnings")
        .select("verdict,summary,metric_label,metric_value,prior_ice,new_ice,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (decisionsRes.error) throw new Error(decisionsRes.error.message);
    if (learningsRes.error) throw new Error(learningsRes.error.message);
    const decisions = (decisionsRes.data ?? []) as DecisionLite[];
    const learnings = (learningsRes.data ?? []) as LearningLite[];

    // Bitemporal lineage for supersession (same rule as the Trust Ledger), with the
    // pre-migration valid_to fallback so the lens never errors to empty.
    let edges: LineageEdgeLite[] = [];
    {
      const run = (sel: string) =>
        supabase.from("artifact_lineage").select(sel).eq("workspace_id", workspaceId).limit(2000);
      let res = await run("parent_kind,parent_id,child_kind,child_id,relation,valid_to");
      const m = (res.error?.message ?? "").toLowerCase();
      if (res.error && m.includes("does not exist") && m.includes("valid_to")) {
        res = await run("parent_kind,parent_id,child_kind,child_id,relation");
      }
      if (!res.error) edges = (res.data ?? []) as unknown as LineageEdgeLite[];
    }
    // "Revised" in the Brain panel = a true `supersedes` replacement only.
    // `contradicts` is an OPEN conflict and routes to the unresolved lens below,
    // so the "revised" and "unresolved" states stay disjoint (no decision is both).
    const superseded = supersedesParentMap(edges);

    let standing = 0,
      supersededCount = 0;
    for (const d of decisions) isDecisionSuperseded(d, superseded) ? supersededCount++ : standing++;
    const beliefs: BrainBeliefs = { standing, superseded: supersededCount };
    const learned = summarizeLearnings(learnings);

    // "Why it changed" needs the superseding decision's title; map id -> title once.
    const titleById = new Map(decisions.map((d) => [d.id, d.title]));
    const recentBeliefs: RecentBelief[] = decisions.slice(0, 6).map((d) => {
      const supersedingId = supersedingIdFor(d, superseded);
      return {
        title: d.title,
        status: d.status,
        superseded: isDecisionSuperseded(d, superseded),
        createdAt: d.created_at,
        rationale: (d.rationale ?? "").trim() || null,
        revisedBy: supersedingId ? (titleById.get(supersedingId) ?? null) : null,
      };
    });

    // The "what's unresolved" lens: open contradictions (not settled by a real
    // supersession) + mixed outcomes. Reuses the already-fetched lineage edges.
    const unresolved = deriveUnresolved(
      decisions,
      activeContradictions(edges),
      resolvedChildIds(edges),
      learned,
    );
    const recentLearnings: RecentLearning[] = learnings.slice(0, 6).map((l) => ({
      summary: l.summary ?? "",
      verdict: l.verdict ?? "",
      metricLabel: l.metric_label ?? null,
      metricValue: l.metric_value ?? null,
      iceShift:
        typeof l.new_ice === "number" && typeof l.prior_ice === "number"
          ? Math.round((l.new_ice - l.prior_ice) * 10) / 10
          : null,
      createdAt: l.created_at,
    }));

    return {
      beliefs,
      learned,
      timeline: buildTimeline(decisions, superseded, learnings),
      insights: derivePatterns(beliefs, learned),
      recentLearnings,
      recentBeliefs,
      unresolved,
    };
  });

// ─── AI Analyst ceiling (BRAIN-UX-V11) ──────────────────────────────────────
// Agent-volunteered intelligence: predictions, next-best-action, risk flags.
// Uses "copilot" surface (no new CallSurface → no chokepoint required).
// Designed to be called lazily (on demand, not on every render) — React Query
// staleTime handles cache; the AI call fires at most once per ~30 min per workspace.

export type BrainSignal = {
  kind: "prediction" | "action" | "risk" | "connection";
  text: string;
};

export type BrainAnalysis = {
  signals: BrainSignal[];
  sparse: boolean; // true when the workspace has too little data for meaningful analysis
};

const MODEL = "claude-haiku-4-5-20251001" as const;

const ANALYST_SYSTEM = `You are the Cadence intelligence analyst. You volunteer useful intelligence from a PM's decision and outcome graph.
Rules:
- Signal-first: lead with the insight, not the reasoning.
- Short: each signal is one sentence, max 18 words.
- Honest: if data is sparse say so. Never fabricate patterns.
- No em dashes, no en dashes, no AI cliches ("delve", "leverage", "unlock", "game-changer").
- Output ONLY a JSON array of objects with shape: [{kind, text}]
  kind = "prediction" | "action" | "risk" | "connection"
  Maximum 4 signals total.`;

export const getBrainAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrainAnalysis> => {
    const { supabase, userId } = context;

    // Get workspace scope
    const { data: member } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const workspaceId = member?.workspace_id ?? null;
    if (!workspaceId) return { signals: [], sparse: true };

    const [decisionsRes, learningsRes] = await Promise.all([
      supabase
        .from("decisions")
        .select("title,status,rationale,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("learnings")
        .select("verdict,summary,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const decisions = decisionsRes.data ?? [];
    const learnings = learningsRes.data ?? [];

    // Sparse guard: need at least 3 decisions OR 3 outcomes to say anything meaningful
    if (decisions.length < 3 && learnings.length < 3) {
      return { signals: [], sparse: true };
    }

    const prompt = `WORKSPACE DECISIONS (most recent first, max 30):
${JSON.stringify(decisions.map((d) => ({ title: d.title, status: d.status, rationale: d.rationale, when: d.created_at?.slice(0, 10) })))}

WORKSPACE OUTCOMES (most recent first, max 20):
${JSON.stringify(learnings.map((l) => ({ verdict: l.verdict, summary: l.summary, when: l.created_at?.slice(0, 10) })))}

Volunteer 2-4 signals. Each must be genuinely useful to the PM owning this data. Prefer predictions and the single highest-value action. Surface a connection or risk only if the data clearly supports it. Output ONLY the JSON array.`;

    const res = await callModel(supabase as never, userId, {
      surface: "copilot",
      model: MODEL,
      messages: [
        { role: "system", content: ANALYST_SYSTEM },
        { role: "user", content: prompt },
      ],
    });

    let signals: BrainSignal[] = [];
    try {
      const raw = res.output?.trim() ?? "[]";
      const parsed = JSON.parse(
        raw.startsWith("[") ? raw : raw.replace(/^[^[]*/, "").replace(/[^\]]*$/, ""),
      ) as unknown[];
      signals = (parsed as BrainSignal[]).filter(
        (s) => s && typeof s.kind === "string" && typeof s.text === "string" && s.text.length > 0,
      );
    } catch {
      // non-parseable output → return empty rather than crashing
    }

    return { signals, sparse: signals.length === 0 };
  });
