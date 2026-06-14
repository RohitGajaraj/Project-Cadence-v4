ALTER TABLE public.mission_steps ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.mission_steps ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 2;
ALTER TABLE public.mission_steps ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE OR REPLACE FUNCTION public.next_ready_mission_steps(p_mission_id uuid)
RETURNS SETOF public.mission_steps LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ms.* FROM public.mission_steps ms
  WHERE ms.mission_id = p_mission_id AND ms.status = 'planned'
    AND (ms.next_retry_at IS NULL OR ms.next_retry_at <= now())
    AND NOT EXISTS (SELECT 1 FROM unnest(ms.depends_on) AS dep(idx)
      WHERE NOT EXISTS (SELECT 1 FROM public.mission_steps d
        WHERE d.mission_id = ms.mission_id AND d.idx = dep.idx AND d.status = 'done'))
  ORDER BY ms.idx;
$$;
GRANT EXECUTE ON FUNCTION public.next_ready_mission_steps(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.match_agent_memory(query_embedding vector(1536), for_user uuid, for_agent_slug text DEFAULT NULL, match_count integer DEFAULT 6)
RETURNS TABLE (id uuid, content text, kind text, importance integer, agent_slug text, similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.id, m.content, m.kind, m.importance, m.agent_slug, 1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memory m WHERE m.user_id = COALESCE(auth.uid(), for_user) AND m.embedding IS NOT NULL
    AND (for_agent_slug IS NULL OR m.agent_slug = for_agent_slug OR m.scope = 'global')
  ORDER BY m.embedding <=> query_embedding LIMIT match_count;
$$;
REVOKE EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_demo boolean := COALESCE(NEW.email LIKE 'demo%@redcadence.app', false);
BEGIN
  BEGIN INSERT INTO public.profiles (id, email, full_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)) ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'handle_new_user: profile insert failed for % (%): %', NEW.id, NEW.email, SQLERRM; END;
  IF NOT is_demo THEN
    BEGIN PERFORM public.ensure_default_workspace(NEW.id);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'handle_new_user: ensure_default_workspace failed for %: %', NEW.id, SQLERRM; END;
  END IF;
  BEGIN PERFORM public.seed_default_agent_tools(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'handle_new_user: seed_default_agent_tools failed for %: %', NEW.id, SQLERRM; END;
  BEGIN PERFORM public.seed_default_event_subscriptions(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'handle_new_user: seed_default_event_subscriptions failed for %: %', NEW.id, SQLERRM; END;
  BEGIN PERFORM public.seed_studio_tools(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'handle_new_user: seed_studio_tools failed for %: %', NEW.id, SQLERRM; END;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.ritual_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_on date NOT NULL DEFAULT (timezone('utc', now()))::date,
  calls_shown int, calls_cleared int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ritual_sessions TO authenticated;
GRANT ALL ON public.ritual_sessions TO service_role;
ALTER TABLE public.ritual_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own ritual_sessions all" ON public.ritual_sessions;
CREATE POLICY "own ritual_sessions all" ON public.ritual_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ritual_sessions_user_day_idx ON public.ritual_sessions (user_id, opened_on);

ALTER TABLE public.eval_runs ALTER COLUMN avg_score TYPE numeric(6,3);
ALTER TABLE public.eval_case_results ALTER COLUMN score TYPE numeric(6,3);
UPDATE public.eval_runs SET avg_score = round(avg_score * 100, 3) WHERE avg_score IS NOT NULL AND avg_score <= 1;
UPDATE public.eval_case_results SET score = round(score * 100, 3) WHERE score IS NOT NULL AND score <= 1;
UPDATE public.drift_snapshots SET avg_eval_score = round(avg_eval_score * 100, 3) WHERE avg_eval_score IS NOT NULL AND avg_eval_score <= 1;

ALTER TABLE public.decisions ADD COLUMN IF NOT EXISTS share_slug text;
ALTER TABLE public.decisions ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
UPDATE public.decisions SET share_slug = replace(gen_random_uuid()::text, '-', '') WHERE share_slug IS NULL;
ALTER TABLE public.decisions ALTER COLUMN share_slug SET DEFAULT replace(gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX IF NOT EXISTS decisions_share_slug_key ON public.decisions (share_slug);
REVOKE SELECT ON public.decisions FROM anon;
GRANT SELECT (share_slug, title, rationale, status, decided_by_agent_slug, created_at, is_public) ON public.decisions TO anon;
DROP POLICY IF EXISTS "public decisions readable" ON public.decisions;
CREATE POLICY "public decisions readable" ON public.decisions FOR SELECT TO anon USING (is_public = true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'decisions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.decisions';
  END IF;
END $$;

REVOKE SELECT ON public.prototypes FROM anon;
GRANT SELECT (id, share_slug, name, description, entry_path, is_public) ON public.prototypes TO anon;
REVOKE SELECT ON public.prototype_files FROM anon;
GRANT SELECT (prototype_id, path, content, language) ON public.prototype_files TO anon;
DROP POLICY IF EXISTS "public prototypes readable" ON public.prototypes;
CREATE POLICY "public prototypes readable" ON public.prototypes FOR SELECT TO anon USING (is_public = true);
DROP POLICY IF EXISTS "public prototype_files readable" ON public.prototype_files;
CREATE POLICY "public prototype_files readable" ON public.prototype_files FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.prototypes p WHERE p.id = prototype_id AND p.is_public = true));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS seq int,
  ADD COLUMN IF NOT EXISTS depends_on jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risk text,
  ADD COLUMN IF NOT EXISTS detail text;

CREATE OR REPLACE FUNCTION public.seed_default_event_subscriptions(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id uuid;
BEGIN
  FOR ws_id IN SELECT id FROM public.workspaces WHERE owner_id = p_user_id LOOP
    INSERT INTO public.event_subscriptions (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'signal.created', 'discovery-scout', 'auto', '{}'::jsonb, true
    WHERE NOT EXISTS (SELECT 1 FROM public.event_subscriptions WHERE workspace_id = ws_id AND event_type = 'signal.created' AND is_default);
    INSERT INTO public.event_subscriptions (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'opportunity.scored', 'strategist', 'confirm', jsonb_build_object('min_score', 8.0), true
    WHERE NOT EXISTS (SELECT 1 FROM public.event_subscriptions WHERE workspace_id = ws_id AND event_type = 'opportunity.scored' AND is_default);
    INSERT INTO public.event_subscriptions (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'prd.approved', 'orchestrator', 'confirm', '{}'::jsonb, true
    WHERE NOT EXISTS (SELECT 1 FROM public.event_subscriptions WHERE workspace_id = ws_id AND event_type = 'prd.approved' AND is_default);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_default_event_subscriptions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_event_subscriptions(uuid) TO authenticated, service_role;

UPDATE public.event_subscriptions SET target_agent_slug = 'discovery-scout', updated_at = now()
WHERE event_type = 'signal.created' AND target_agent_slug = 'discovery' AND is_default;