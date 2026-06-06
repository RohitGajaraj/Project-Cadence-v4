
-- 1) Tighten WITH CHECK on workspace-scoped write policies so members can only
--    write rows attributed to their own user_id. SELECT path stays workspace-wide.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'projects','conversations','messages','signals','opportunities','prds',
    'themes','decisions','tasks','docs','doc_versions','tool_calls',
    'ai_events','ai_evals','ai_feedback','rag_chunks','artifact_lineage',
    'guardrail_hits'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' ws write', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
         WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid())',
      t || ' ws insert own', t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (public.is_workspace_member(workspace_id) AND user_id = auth.uid())
         WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid())',
      t || ' ws update own', t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (public.is_workspace_member(workspace_id) AND user_id = auth.uid())',
      t || ' ws delete own', t
    );
  END LOOP;
END $$;

-- 2) Pin search_path on the one project-owned function that was missing it.
ALTER FUNCTION public.touch_event_subscriptions_updated_at() SET search_path = public;
