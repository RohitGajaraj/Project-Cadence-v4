/**
 * Index user content (docs, PRDs, notes, signals) into rag_chunks.
 * Idempotent — skips rows whose content_hash already exists for the same
 * (user_id, source_kind, source_id, chunk_index).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts } from "./embed.server";

const CHUNK_SIZE = 1100; // chars
const CHUNK_OVERLAP = 150;

export function chunk(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type IndexItem = {
  source_kind: "doc" | "prd" | "note" | "signal" | "meeting";
  source_id: string;
  title?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
};

export async function indexItems(
  supabase: SupabaseClient,
  userId: string,
  items: IndexItem[],
): Promise<{ indexed: number; skipped: number }> {
  let indexed = 0,
    skipped = 0;
  for (const item of items) {
    const pieces = chunk(item.content);
    if (pieces.length === 0) continue;
    const hashes = await Promise.all(pieces.map(sha256));

    // Find existing chunk hashes for this source to skip unchanged.
    const { data: existing } = await supabase
      .from("rag_chunks")
      .select("chunk_index,content_hash")
      .eq("user_id", userId)
      .eq("source_kind", item.source_kind)
      .eq("source_id", item.source_id);
    const existingMap = new Map<number, string>();
    (existing ?? []).forEach((r: { chunk_index: number; content_hash: string | null }) => {
      if (r.content_hash) existingMap.set(r.chunk_index, r.content_hash);
    });

    const toEmbedIdx: number[] = [];
    pieces.forEach((_p, idx) => {
      if (existingMap.get(idx) !== hashes[idx]) toEmbedIdx.push(idx);
      else skipped++;
    });
    if (toEmbedIdx.length === 0) continue;

    const vectors = await embedTexts(
      toEmbedIdx.map((i) => pieces[i]),
      {
        supabase,
        userId,
        surfaceRef: item.source_kind,
      },
    );
    const rows = toEmbedIdx.map((idx, k) => ({
      user_id: userId,
      source_kind: item.source_kind,
      source_id: item.source_id,
      title: item.title ?? null,
      content: pieces[idx],
      chunk_index: idx,
      token_estimate: Math.ceil(pieces[idx].length / 4),
      metadata: item.metadata ?? {},
      content_hash: hashes[idx],
      embedding: vectors[k] as unknown as string,
    }));
    // upsert on (user_id, source_kind, source_id, chunk_index)
    const { error } = await supabase
      .from("rag_chunks")
      .upsert(rows, { onConflict: "user_id,source_kind,source_id,chunk_index" });
    if (error) {
      console.error("indexItems upsert", error);
      continue;
    }
    indexed += rows.length;
  }
  return { indexed, skipped };
}

/**
 * Pull latest user content from all source tables and index it.
 * Called from the hourly indexer-tick cron.
 */
export async function indexUserCorpus(
  supabase: SupabaseClient,
  userId: string,
  limit = 200,
): Promise<{ indexed: number; skipped: number; sources: number }> {
  const items: IndexItem[] = [];

  const { data: docs } = await supabase
    .from("docs")
    .select("id,title,content_text")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(limit);
  (docs ?? []).forEach((d: { id: string; title: string; content_text: string }) => {
    if (d.content_text)
      items.push({ source_kind: "doc", source_id: d.id, title: d.title, content: d.content_text });
  });

  const { data: prds } = await supabase
    .from("prds")
    .select("id,title,body_md")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  (prds ?? []).forEach((p: { id: string; title: string; body_md: string }) => {
    if (p.body_md)
      items.push({ source_kind: "prd", source_id: p.id, title: p.title, content: p.body_md });
  });

  const { data: notes } = await supabase
    .from("notes")
    .select("id,body,tags")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  (notes ?? []).forEach((n: { id: string; body: string; tags: string[] }) => {
    if (n.body)
      items.push({
        source_kind: "note",
        source_id: n.id,
        title: (n.tags ?? []).join(", ") || null,
        content: n.body,
      });
  });

  const { data: signals } = await supabase
    .from("signals")
    .select("id,title,content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  (signals ?? []).forEach((s: { id: string; title: string | null; content: string }) => {
    if (s.content)
      items.push({ source_kind: "signal", source_id: s.id, title: s.title, content: s.content });
  });

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id,title,summary,transcript")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  (meetings ?? []).forEach(
    (m: { id: string; title: string; summary: string | null; transcript: string | null }) => {
      const c = [m.summary, m.transcript].filter(Boolean).join("\n\n");
      if (c) items.push({ source_kind: "meeting", source_id: m.id, title: m.title, content: c });
    },
  );

  const r = await indexItems(supabase, userId, items);
  return { ...r, sources: items.length };
}
