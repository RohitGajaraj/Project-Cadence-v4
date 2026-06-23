/**
 * BRAIN-UX-V11 (floor) — make the Brain human-useful: rule-based human LENSES on
 * the decision/memory graph, not a node graph. This is the legibility FLOOR:
 *   - Beliefs:   current beliefs (standing decisions) vs revised (superseded)
 *   - Learned:   recorded outcomes by verdict + the hit rate + the ICE shift
 *   - Timeline:  how decisions + outcomes accrued, month by month
 *   - Insights:  plain-language, honest, rule-based observations the data supports
 *
 * It composes EXISTING data only (`decisions`, bitemporal `artifact_lineage`,
 * `learnings`) — NO migration, NO AI/chokepoint. The open "agent volunteering
 * intelligence" CEILING (predictions, next-best-action) needs the AI chokepoint
 * and is a deliberate follow-on. The lens math is PURE + unit-tested; the server
 * fn is a thin DB-to-helper adapter.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supersededChildIds, type LineageEdgeLite } from "@/lib/trust-ledger.functions";

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

export type TimelineBucket = { month: string; decisions: number; superseded: number; learnings: number };

export type BrainInsight = { tone: "positive" | "watch" | "neutral"; text: string };

export type RecentLearning = {
  summary: string;
  verdict: string;
  metricLabel: string | null;
  metricValue: string | null;
  iceShift: number | null;
  createdAt: string;
};

export type RecentBelief = { title: string; status: string; superseded: boolean; createdAt: string };

export type BrainInsights = {
  beliefs: BrainBeliefs;
  learned: LearnedSummary;
  timeline: TimelineBucket[];
  insights: BrainInsight[];
  recentLearnings: RecentLearning[];
  recentBeliefs: RecentBelief[];
};

type DecisionLite = {
  id: string;
  title: string;
  status: string;
  created_at: string;
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
export function summarizeLearnings(rows: { verdict: string | null }[] | null | undefined): LearnedSummary {
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
    map.get(m) ?? (map.set(m, { month: m, decisions: 0, superseded: 0, learnings: 0 }), map.get(m)!);
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
  return [...map.values()].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0)).slice(-limit);
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
    out.push({ tone: "neutral", text: `${learned.mixed} outcome${learned.mixed === 1 ? "" : "s"} came back mixed — partial signal, not a clean win or loss.` });
  }

  if (totalDecisions > 0) {
    if (beliefs.superseded > 0) {
      out.push({
        tone: "neutral",
        text: `${beliefs.superseded} of ${totalDecisions} decisions have been revised since — the belief set is evolving, not frozen.`,
      });
    } else {
      out.push({ tone: "positive", text: `All ${totalDecisions} recorded decisions still stand — none has been superseded.` });
    }
  }

  return out;
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
    };
    if (!workspaceId) return empty;

    const [decisionsRes, learningsRes] = await Promise.all([
      supabase
        .from("decisions")
        .select("id,title,status,created_at,mission_id,prd_id,meeting_id")
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
    const superseded = supersededChildIds(edges);

    let standing = 0,
      supersededCount = 0;
    for (const d of decisions) (isDecisionSuperseded(d, superseded) ? supersededCount++ : standing++);
    const beliefs: BrainBeliefs = { standing, superseded: supersededCount };
    const learned = summarizeLearnings(learnings);

    const recentBeliefs: RecentBelief[] = decisions.slice(0, 6).map((d) => ({
      title: d.title,
      status: d.status,
      superseded: isDecisionSuperseded(d, superseded),
      createdAt: d.created_at,
    }));
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
    };
  });
