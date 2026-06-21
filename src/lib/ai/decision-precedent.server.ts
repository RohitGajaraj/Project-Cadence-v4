/**
 * Decision precedent engine (Decision Brain, increment 1 / Ambient Precedent).
 *
 * Semantic recall over the workspace's OUTCOME memories (the rows rememberOutcome
 * writes to agent_memory with embeddings), gated by a similarity threshold, so a
 * decision surface can show "you reasoned this way before; here is how it went."
 * Best-effort + fail-safe: any failure returns []. Migration-free: reuses the
 * existing match_agent_memory RPC + a cheap id-keyed metadata read.
 *
 * .server.ts - Worker-only; never bundled to the client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "@/lib/rag/embed.server";
import {
  OUTCOME_MEMORY_KIND,
  type DecisionPrecedentRow,
  type OutcomeVerdict,
} from "./outcome-memory";

/** Similarity floor (1 - cosine distance). Tunable; start conservative and tune on live data. */
export const PRECEDENT_THRESHOLD = 0.3;
/** Max outcomes surfaced at any decision point. */
export const PRECEDENT_MAX = 3;
/** Semantic candidate pool pulled before filtering to outcomes. */
const CANDIDATE_POOL = 20;

export type PrecedentMatch = DecisionPrecedentRow & {
  id: string;
  prdId: string | null;
  opportunityId: string | null;
  score: number;
};

type RawPrecedentCandidate = {
  id: string;
  kind: string;
  similarity: number;
  content: string;
  metadata: {
    verdict?: string;
    prior_ice?: number | null;
    new_ice?: number | null;
    prd_id?: string | null;
    opportunity_id?: string | null;
    prd_title?: string | null;
    opp_title?: string | null;
  } | null;
};

const VERDICTS: OutcomeVerdict[] = ["validated", "missed", "mixed"];

/** PURE: outcome-kind candidates above the threshold, score-sorted, capped, mapped to rows. */
export function rankPrecedent(
  candidates: RawPrecedentCandidate[],
  threshold = PRECEDENT_THRESHOLD,
  max = PRECEDENT_MAX,
): PrecedentMatch[] {
  return candidates
    .filter((c) => c.kind === OUTCOME_MEMORY_KIND && c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, max)
    .map((c) => {
      const m = c.metadata ?? {};
      const verdict: OutcomeVerdict = VERDICTS.includes(m.verdict as OutcomeVerdict)
        ? (m.verdict as OutcomeVerdict)
        : "mixed";
      return {
        id: c.id,
        title: m.prd_title?.trim() || m.opp_title?.trim() || null,
        verdict,
        summary: c.content,
        priorIce: typeof m.prior_ice === "number" ? m.prior_ice : null,
        newIce: typeof m.new_ice === "number" ? m.new_ice : null,
        prdId: m.prd_id ?? null,
        opportunityId: m.opportunity_id ?? null,
        score: c.similarity,
      };
    });
}

/** Live engine: embed the decision text, semantic-match outcomes, threshold + cap. */
export async function loadDecisionPrecedent(
  supabase: SupabaseClient,
  args: { userId: string; workspaceId: string | null; text: string; excludeId?: string },
): Promise<PrecedentMatch[]> {
  const text = args.text?.trim();
  if (!text) return [];
  try {
    // EMBED-CHOKEPOINT: thread context so this precedent embedding logs + BYO-routes.
    const v = await embedOne(text, { supabase, userId: args.userId, surfaceRef: "precedent" });
    if (!Array.isArray(v) || v.length === 0) return [];
    const base = {
      query_embedding: v as unknown as string,
      for_user: args.userId,
      for_agent_slug: "critic", // global-scope outcome rows surface regardless of slug
      match_count: CANDIDATE_POOL,
    };
    const withWs = { ...base, for_workspace: args.workspaceId };
    let res = await supabase.rpc("match_agent_memory", withWs);
    if (res.error?.code === "PGRST202") res = await supabase.rpc("match_agent_memory", base);
    const hits = (res.data ?? []) as Array<{
      id: string;
      content: string;
      kind: string;
      similarity: number;
    }>;
    const outcomeHits = hits.filter(
      (h) => h.kind === OUTCOME_MEMORY_KIND && h.id !== args.excludeId,
    );
    if (!outcomeHits.length) return [];

    // match_agent_memory does not return metadata; fetch it for the surviving ids.
    const meta = await supabase
      .from("agent_memory")
      .select("id,metadata")
      .in(
        "id",
        outcomeHits.map((h) => h.id),
      );
    const metaById = new Map(
      ((meta.data ?? []) as Array<{ id: string; metadata: unknown }>).map((r) => [
        r.id,
        r.metadata,
      ]),
    );
    const candidates: RawPrecedentCandidate[] = outcomeHits.map((h) => ({
      id: h.id,
      kind: h.kind,
      similarity: h.similarity,
      content: h.content,
      metadata: (metaById.get(h.id) as RawPrecedentCandidate["metadata"]) ?? null,
    }));
    return rankPrecedent(candidates);
  } catch {
    return [];
  }
}
