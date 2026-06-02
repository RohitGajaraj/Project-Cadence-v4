
-- 1. Add UPDATE policy for studio-attachments storage bucket (owner-scoped)
CREATE POLICY "studio attachments owner update"
ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'studio-attachments' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'studio-attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 2. Add RLS policies on realtime.messages so only authenticated users can subscribe,
-- and topic must be scoped to their own auth.uid()
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read own-topic realtime messages"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  (realtime.topic() = (auth.uid())::text)
  OR (realtime.topic() LIKE (auth.uid())::text || ':%')
);

-- 3. Harden SECURITY DEFINER functions: revoke EXECUTE from public/anon/authenticated
-- on internal-only functions (only called by triggers / service role).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_agents(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_guardrails(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_agent_tools(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_prompt_templates(uuid) FROM PUBLIC, anon, authenticated;

-- 4. Harden match_* SECURITY DEFINER functions so they ignore the caller-supplied
-- for_user argument and always scope to auth.uid(). Revoke from anon; keep
-- authenticated execute (callers pass auth.uid() but we now enforce it).
CREATE OR REPLACE FUNCTION public.match_rag_chunks(
  query_embedding vector,
  for_user uuid,
  match_count integer DEFAULT 8,
  source_kinds text[] DEFAULT NULL::text[]
)
RETURNS TABLE(id uuid, source_kind text, source_id uuid, title text, content text, chunk_index integer, metadata jsonb, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.source_kind, c.source_id, c.title, c.content, c.chunk_index, c.metadata,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks c
  WHERE c.user_id = auth.uid()
    AND c.embedding IS NOT NULL
    AND (source_kinds IS NULL OR c.source_kind = ANY(source_kinds))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_agent_memory(
  query_embedding vector,
  for_user uuid,
  for_agent_slug text DEFAULT NULL::text,
  match_count integer DEFAULT 6
)
RETURNS TABLE(id uuid, content text, kind text, importance integer, agent_slug text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT m.id, m.content, m.kind, m.importance, m.agent_slug,
         1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.user_id = auth.uid()
    AND m.embedding IS NOT NULL
    AND (for_agent_slug IS NULL OR m.agent_slug = for_agent_slug OR m.scope = 'global')
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_signals(
  query_embedding vector,
  match_count integer DEFAULT 8,
  for_user uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, content text, title text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.id, s.content, s.title, 1 - (s.embedding <=> query_embedding) AS similarity
  FROM public.signals s
  WHERE s.embedding IS NOT NULL
    AND s.user_id = auth.uid()
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$function$;

REVOKE EXECUTE ON FUNCTION public.match_rag_chunks(vector, uuid, integer, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_signals(vector, integer, uuid) FROM PUBLIC, anon;
