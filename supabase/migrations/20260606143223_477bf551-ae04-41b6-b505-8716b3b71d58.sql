
-- 1. Fix missing GRANTs on agent_memory so PostgREST/admin can reach it.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_memory TO authenticated;
GRANT ALL ON public.agent_memory TO service_role;

-- 2. Index for memory-tick decay sweeps (low-importance, old, unused).
CREATE INDEX IF NOT EXISTS agent_memory_decay_idx
  ON public.agent_memory (importance, COALESCE(last_used_at, created_at));

-- 3. List recent reflections for a single agent (UI panel + recallMemory upgrade).
CREATE OR REPLACE FUNCTION public.recent_agent_reflections(
  for_user uuid,
  for_agent_slug text,
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  importance integer,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.content, m.importance, m.metadata, m.created_at
  FROM public.agent_memory m
  WHERE m.user_id = for_user
    AND m.kind = 'reflection'
    AND (for_agent_slug IS NULL OR m.agent_slug = for_agent_slug OR m.scope = 'global')
  ORDER BY m.importance DESC, m.created_at DESC
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;

GRANT EXECUTE ON FUNCTION public.recent_agent_reflections(uuid, text, integer) TO authenticated, service_role;

-- 4. Auto-advance an agent's autonomy arc based on recent run history.
--    Counts only completed runs (no failures/halts) and rejects since the last
--    arc change. Never moves backwards; never auto-promotes past 'trusted'.
CREATE OR REPLACE FUNCTION public.auto_advance_agent_arc(
  p_user_id uuid,
  p_agent_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_arc text;
  arc_set_at timestamptz;
  clean_runs integer;
  rejected integer;
  new_arc text;
BEGIN
  -- Bootstrap autonomy row if missing.
  INSERT INTO public.agent_autonomy (user_id, agent_id, arc)
  VALUES (p_user_id, p_agent_id, 'observing')
  ON CONFLICT (user_id, agent_id) DO NOTHING;

  SELECT arc, set_at INTO current_arc, arc_set_at
  FROM public.agent_autonomy
  WHERE user_id = p_user_id AND agent_id = p_agent_id
  FOR UPDATE;

  -- We only auto-promote out of observing / proving. Trusted+ stays put.
  IF current_arc NOT IN ('observing', 'proving') THEN
    RETURN current_arc;
  END IF;

  -- Count rejected approvals since the last arc change — any rejection blocks promotion.
  SELECT COUNT(*) INTO rejected
  FROM public.agent_approvals
  WHERE user_id = p_user_id
    AND agent_id = p_agent_id
    AND status = 'rejected'
    AND COALESCE(decided_at, created_at) >= arc_set_at;

  IF rejected > 0 THEN
    RETURN current_arc;
  END IF;

  -- Count completed runs since the last arc change. Tolerate both legacy
  -- 'complete' (single-shot agent_loop.runAgent) and modern 'completed' (loop.server.ts).
  SELECT COUNT(*) INTO clean_runs
  FROM public.agent_runs
  WHERE user_id = p_user_id
    AND agent_id = p_agent_id
    AND status IN ('completed', 'complete')
    AND created_at >= arc_set_at;

  new_arc := current_arc;
  IF current_arc = 'observing' AND clean_runs >= 5 THEN
    new_arc := 'proving';
  ELSIF current_arc = 'proving' AND clean_runs >= 20 THEN
    new_arc := 'trusted';
  END IF;

  IF new_arc <> current_arc THEN
    UPDATE public.agent_autonomy
       SET arc = new_arc,
           set_by = NULL,             -- NULL = system-promoted, not operator
           set_at = now(),
           updated_at = now()
     WHERE user_id = p_user_id AND agent_id = p_agent_id;
  END IF;

  RETURN new_arc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_advance_agent_arc(uuid, uuid) TO authenticated, service_role;
