// SF-FOCUS (Signal Fabric Phase 1) — novelty-vs-memory for a theme (server-only).
//
// "Is this theme NEW, or something the team already knows / already decided?" We embed the
// theme, take the max cosine similarity against (a) the decision/outcome MEMORY
// (match_agent_memory) and (b) PRIOR themes (match_themes), and map the closest match to a
// novelty in [0,1] (1 = unseen). Fail-safe: any embed/RPC error → novelty 1, embedding null,
// so clustering never breaks on an embeddings outage.

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "@/lib/rag/embed.server";
import { clamp01 } from "@/lib/brain/score";

export type NoveltyResult = {
  novelty: number; // 0..1 (1 = unseen)
  embedding: number[] | null; // null on embed failure → stored without a vector
  basis: {
    maxSim: number | null;
    maxMemorySim: number | null;
    maxThemeSim: number | null;
    memId: string | null;
    themeId: string | null;
  };
};

export async function computeNovelty(
  supabase: SupabaseClient,
  userId: string,
  theme: { id?: string | null; title: string; summary: string | null },
): Promise<NoveltyResult> {
  const emptyBasis = {
    maxSim: null,
    maxMemorySim: null,
    maxThemeSim: null,
    memId: null,
    themeId: null,
  };
  try {
    const text = `${theme.title}\n${theme.summary ?? ""}`.trim();
    const embedding = await embedOne(text, { supabase, userId, surfaceRef: "theme_novelty" });

    const [mem, thm] = await Promise.all([
      supabase.rpc("match_agent_memory", {
        query_embedding: embedding,
        for_user: userId,
        for_agent_slug: null,
        match_count: 5,
      }),
      supabase.rpc("match_themes", {
        query_embedding: embedding,
        for_user: userId,
        exclude_id: theme.id ?? null,
        match_count: 5,
      }),
    ]);

    const memTop = (mem.data ?? [])[0] as { id: string; similarity: number } | undefined;
    const thmTop = (thm.data ?? [])[0] as { id: string; similarity: number } | undefined;
    const maxMemorySim = memTop?.similarity ?? null;
    const maxThemeSim = thmTop?.similarity ?? null;
    const maxSim = Math.max(maxMemorySim ?? -1, maxThemeSim ?? -1);
    // Remap raw cosine: only similarity above ~0.5 counts as "seen"; below that is noise.
    const novelty = maxSim < 0 ? 1 : 1 - clamp01((maxSim - 0.5) / 0.5);

    return {
      novelty,
      embedding,
      basis: {
        maxSim: maxSim < 0 ? null : maxSim,
        maxMemorySim,
        maxThemeSim,
        memId: memTop?.id ?? null,
        themeId: thmTop?.id ?? null,
      },
    };
  } catch {
    return { novelty: 1, embedding: null, basis: emptyBasis };
  }
}
