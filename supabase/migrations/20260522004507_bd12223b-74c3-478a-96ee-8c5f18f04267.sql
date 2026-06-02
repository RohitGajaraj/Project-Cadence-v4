CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_kind text NOT NULL,
  source_id uuid,
  title text,
  content text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  token_estimate integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rag_chunks_user_source_idx
  ON public.rag_chunks (user_id, source_kind, source_id);

CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw
  ON public.rag_chunks USING hnsw (embedding vector_cosine_ops);

CREATE UNIQUE INDEX IF NOT EXISTS rag_chunks_dedupe_idx
  ON public.rag_chunks (user_id, source_kind, source_id, chunk_index);

ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rag_chunks all" ON public.rag_chunks;
CREATE POLICY "own rag_chunks all"
  ON public.rag_chunks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS rag_chunks_set_updated_at ON public.rag_chunks;
CREATE TRIGGER rag_chunks_set_updated_at
  BEFORE UPDATE ON public.rag_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.match_rag_chunks(
  query_embedding vector(1536),
  for_user uuid,
  match_count integer DEFAULT 8,
  source_kinds text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_kind text,
  source_id uuid,
  title text,
  content text,
  chunk_index integer,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.id,
    c.source_kind,
    c.source_id,
    c.title,
    c.content,
    c.chunk_index,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks c
  WHERE c.user_id = for_user
    AND c.embedding IS NOT NULL
    AND (source_kinds IS NULL OR c.source_kind = ANY(source_kinds))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;