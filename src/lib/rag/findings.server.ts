/**
 * F-BRAIN — distilled research findings: the brain's compounding memory.
 *
 * Writes one rag_chunks row with source_kind 'finding' so future questions
 * recall past answers through the normal retriever. Embedding is best-effort:
 * the LOVABLE embed API may be absent locally, so embed failures degrade to a
 * row WITHOUT a vector (the embedding column is nullable — see
 * supabase/migrations/20260522004507) which the retriever's ILIKE keyword
 * fallback can still find. Never throws — callers fire-and-forget.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "./embed.server";

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function indexFinding(
  supabase: SupabaseClient,
  userId: string,
  input: { title: string; content: string; conversationId?: string | null },
): Promise<{ indexed: boolean }> {
  try {
    const title = input.title.trim().slice(0, 200) || "Research finding";
    const content = input.content.trim().slice(0, 8000);
    if (!content) return { indexed: false };
    const sourceId = input.conversationId ?? null;

    let embedding: number[] | null = null;
    try {
      embedding = await embedOne(content);
    } catch (e) {
      console.error("[brain] embedding unavailable — storing finding without vector:", e);
    }

    // rag_chunks has a UNIQUE index on (user_id, source_kind, source_id,
    // chunk_index), so successive findings in one conversation take the next
    // chunk_index (first one is 0). NULL source_ids never collide.
    let chunkIndex = 0;
    if (sourceId) {
      const { data: last } = await supabase
        .from("rag_chunks")
        .select("chunk_index")
        .eq("user_id", userId)
        .eq("source_kind", "finding")
        .eq("source_id", sourceId)
        .order("chunk_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      chunkIndex = ((last as { chunk_index: number } | null)?.chunk_index ?? -1) + 1;
    }

    // Column set mirrors indexer.server.ts. workspace_id stays unset: it is
    // nullable (tenancy migration B) and the insert passes RLS through the
    // user-scoped "own rag_chunks all" policy.
    const { error } = await supabase.from("rag_chunks").insert({
      user_id: userId,
      source_kind: "finding",
      source_id: sourceId,
      title,
      content,
      chunk_index: chunkIndex,
      token_estimate: Math.ceil(content.length / 4),
      metadata: {},
      content_hash: await sha256(content),
      embedding: embedding ? (embedding as unknown as string) : null,
    });
    if (error) {
      console.error("[brain] indexFinding insert failed:", error);
      return { indexed: false };
    }
    return { indexed: embedding !== null };
  } catch (e) {
    console.error("[brain] indexFinding failed:", e);
    return { indexed: false };
  }
}
