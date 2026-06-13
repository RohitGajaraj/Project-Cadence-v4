-- v6 Phase 1 ("The Loop Runs Itself") — make memory_refs[] real on the
-- AUTONOMOUS path.
--
-- match_agent_memory filtered strictly by auth.uid(), so the service-role
-- mission-advance sweeper (auth.uid() = NULL) matched zero semantic memories and
-- could only thread reflections into a mid-loop handoff. COALESCE(auth.uid(),
-- for_user) keeps the security boundary intact for authenticated users —
-- auth.uid() always wins, so a user can never read another user's memory — while
-- letting the trusted service-role caller scope to the explicit for_user it
-- already passes. The function stays REVOKEd from anon, so no unauthenticated
-- access. memory.server.ts already passes for_user, so this lights up the
-- autonomous path with zero code change (claim never outruns wiring).

CREATE OR REPLACE FUNCTION public.match_agent_memory(
  query_embedding vector(1536),
  for_user uuid,
  for_agent_slug text DEFAULT NULL,
  match_count integer DEFAULT 6
) RETURNS TABLE (
  id uuid, content text, kind text, importance integer,
  agent_slug text, similarity double precision
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.id, m.content, m.kind, m.importance, m.agent_slug,
         1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.user_id = COALESCE(auth.uid(), for_user)
    AND m.embedding IS NOT NULL
    AND (for_agent_slug IS NULL OR m.agent_slug = for_agent_slug OR m.scope = 'global')
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) TO service_role;
