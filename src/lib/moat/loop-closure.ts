/**
 * LOOP-PROVE (v11 #5) — PURE closure proof for the decision→outcome→supersession loop.
 *
 * The moat's promise is a LOOP that closes: a decision is made → an outcome is recorded
 * against it → that outcome supersedes (or contradicts) the prior belief → the next time a
 * similar precedent is cited, the graph resolves it forward to the CURRENT governing
 * decision instead of the stale match. DBR (H1) / LRN-02 / W1-AUTO / MOAT-METRIC all
 * implement pieces of this, but nothing ever ASSERTED the chain produces real edges end to
 * end — so a silently cold moat (0 edges) looks identical to a working one until you stare
 * at the data.
 *
 * This module is that assertion. It composes the EXISTING engine (`resolveGoverning`'s
 * supersession walk) over raw graph rows and reports, stage by stage, whether the loop is
 * closed and — when it is not — which exact stage is cold. It is the diagnostic behind
 * "prove the loop closes on real data": run it against live data and `closed === true` is
 * the proof; against an empty graph it names the missing stage instead of failing silent.
 *
 * PURE: no db, no network, no AI; unit-verifiable in isolation. It REUSES the decision-brain
 * core rather than re-deriving the walk, so the proof can never drift from the engine it
 * proves. NO migration, NO chokepoint.
 */
import { resolveGoverning } from "@/lib/ai/governing-decision";
import { classifyRelation, type RawLineageEdge } from "@/lib/knowledge-graph-view";

/** Decisive recorded outcomes — the verdicts that actually move a belief. Mirrors the
 * Brain's verdict vocabulary so the proof and the UI summary agree on "a recorded outcome". */
const DECISIVE_VERDICTS = new Set([
  "validated",
  "confirmed",
  "win",
  "missed",
  "invalidated",
  "refuted",
  "loss",
  "mixed",
  "inconclusive",
  "partial",
]);

/** A current (in-force) edge: `valid_to` absent/null/blank. Same rule as governing-decision
 * and the Trust Ledger (invalidate-don't-delete) — a stamped `valid_to` means a still-later
 * outcome reversed the assertion, so it no longer counts toward a closed present-day loop. */
function isCurrent(edge: { valid_to?: string | null }): boolean {
  return !(typeof edge.valid_to === "string" && edge.valid_to.trim().length > 0);
}

export type LoopStageCounts = {
  /** Governing nodes that exist at all (decisions recorded). */
  decisions: number;
  /** Recorded outcomes: learnings carrying a decisive verdict. */
  outcomesRecorded: number;
  /** Current `supersedes` edges (a belief was replaced). */
  supersessionEdges: number;
  /** Current `contradicts` edges (a later outcome invalidated a belief). */
  contradictionEdges: number;
  /** Superseded precedents that resolve forward ≥1 hop to a later governing decision. */
  governingResolutions: number;
};

export type LoopWarmth = "cold" | "warming" | "warm";

/** An end-to-end resolved chain: a precedent walked forward to its current governing node. */
export type ClosedChain = {
  fromKind: string;
  fromId: string;
  governingKind: string;
  governingId: string;
  /** Supersession hops to the governing decision (≥1 by construction here). */
  hops: number;
  /** A current `contradicts` edge also targets the precedent. */
  contradicted: boolean;
};

export type LoopClosureReport = {
  /** The full chain produced ≥1 real end-to-end edge: outcomes + supersession + a forward
   * governing resolution all present. The literal proof the loop closes. */
  closed: boolean;
  /** cold = no supersession edges at all; warming = edges exist but the loop is not closed;
   * warm = closed. The single headline a surface can show. */
  warmth: LoopWarmth;
  counts: LoopStageCounts;
  /** Example resolved chains (bounded), newest-first by input order. */
  chains: ClosedChain[];
  /** Plain-language diagnosis of the cold stage(s); empty when closed. */
  gaps: string[];
};

export type LoopClosureInput = {
  /** artifact_lineage rows (bitemporal). */
  edges: readonly RawLineageEdge[];
  /** Decision nodes — used for the total count and as fallback resolution candidates. */
  decisions?: readonly { id: string; kind?: string | null }[];
  /** learnings rows — a recorded outcome is one with a decisive verdict. */
  learnings?: readonly { verdict?: string | null }[];
  /** Cap on returned example chains. */
  maxChains?: number;
};

/** Normalise an edge's `kind`-bearing fields defensively (rows can arrive partial). */
function edgeChild(e: RawLineageEdge): { kind: string; id: string } | null {
  if (!e || typeof e.child_id !== "string" || !e.child_id.trim()) return null;
  const kind = typeof e.child_kind === "string" && e.child_kind.trim() ? e.child_kind : "decision";
  return { kind, id: e.child_id.trim() };
}

/**
 * PURE. Prove (or diagnose) the decision→outcome→supersession→governing loop over raw rows.
 *
 * Closure candidates are the children of CURRENT `supersedes` edges (the precedents that got
 * replaced); each is walked forward with the engine's own `resolveGoverning`. A candidate
 * that lands on a later node (governingId !== its id) is a real forward resolution — the
 * structural proof a belief was corrected to its current replacement. The loop is `closed`
 * only when a recorded outcome, a supersession edge, AND such a resolution all exist, so a
 * graph that has edges but no recorded outcomes reads as `warming`, not done.
 */
export function computeLoopClosure(input: LoopClosureInput): LoopClosureReport {
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const decisions = Array.isArray(input.decisions) ? input.decisions : [];
  const learnings = Array.isArray(input.learnings) ? input.learnings : [];
  const maxChains = Math.max(1, input.maxChains ?? 6);

  // Stage 1 — recorded outcomes.
  let outcomesRecorded = 0;
  for (const l of learnings) {
    const v = typeof l?.verdict === "string" ? l.verdict.trim().toLowerCase() : "";
    if (v && DECISIVE_VERDICTS.has(v)) outcomesRecorded += 1;
  }

  // Stage 2 — current supersession / contradiction edges, and the superseded-precedent set.
  let supersessionEdges = 0;
  let contradictionEdges = 0;
  const candidates: { kind: string; id: string }[] = [];
  const seenCand = new Set<string>();
  for (const e of edges) {
    if (!e || !isCurrent(e)) continue;
    const rel = classifyRelation(e.relation);
    if (rel === "supersedes") {
      supersessionEdges += 1;
      const child = edgeChild(e);
      if (child && !seenCand.has(child.id)) {
        seenCand.add(child.id);
        candidates.push(child);
      }
    } else if (rel === "contradicts") {
      contradictionEdges += 1;
    }
  }

  // Stage 3 — walk each superseded precedent forward to its governing decision.
  const chains: ClosedChain[] = [];
  let governingResolutions = 0;
  for (const c of candidates) {
    const res = resolveGoverning(c.kind, c.id, edges);
    if (res.governingId === c.id) continue; // did not move forward — not a resolution
    governingResolutions += 1;
    if (chains.length < maxChains) {
      chains.push({
        fromKind: c.kind,
        fromId: c.id,
        governingKind: res.governingKind,
        governingId: res.governingId,
        hops: res.hops,
        contradicted: res.contradicted,
      });
    }
  }

  const counts: LoopStageCounts = {
    decisions: decisions.length,
    outcomesRecorded,
    supersessionEdges,
    contradictionEdges,
    governingResolutions,
  };

  const closed = outcomesRecorded > 0 && supersessionEdges > 0 && governingResolutions > 0;

  let warmth: LoopWarmth;
  if (closed) warmth = "warm";
  else if (supersessionEdges > 0) warmth = "warming";
  else warmth = "cold";

  const gaps: string[] = [];
  if (!closed) {
    if (counts.decisions === 0) {
      gaps.push("No decisions recorded yet — the loop has nothing to govern.");
    }
    if (outcomesRecorded === 0) {
      gaps.push(
        "No recorded outcomes (learnings with a verdict) — the loop has no feedback to learn from.",
      );
    }
    if (supersessionEdges === 0) {
      gaps.push(
        "No supersession edges — beliefs are never replaced; the decision graph is flat (a cold moat).",
      );
    } else if (governingResolutions === 0) {
      gaps.push(
        "Supersession edges exist but none resolve a precedent forward to a later governing decision — the chain does not close.",
      );
    }
  }

  return { closed, warmth, counts, chains, gaps };
}
