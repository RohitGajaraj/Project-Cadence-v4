CREATE OR REPLACE FUNCTION public.connection_owner_in_workspace(p_connection_id uuid, p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.connections c JOIN public.workspace_members wm ON wm.user_id = c.user_id
    WHERE c.id = p_connection_id AND wm.workspace_id = p_workspace_id);
$fn$;
GRANT EXECUTE ON FUNCTION public.connection_owner_in_workspace(uuid, uuid) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='connection_bindings_product_id_fkey') THEN
    ALTER TABLE public.connection_bindings ADD CONSTRAINT connection_bindings_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS connection_bindings_product_provider_kind_key
  ON public.connection_bindings (product_id, provider, resource_kind) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connection_bindings_product
  ON public.connection_bindings (workspace_id, product_id, provider, resource_kind) WHERE product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.product_in_workspace(p_product_id uuid, p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id=p_product_id AND workspace_id=p_workspace_id);
$fn$;
GRANT EXECUTE ON FUNCTION public.product_in_workspace(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Workspace bindings - insert" ON public.connection_bindings;
CREATE POLICY "Workspace bindings - insert" ON public.connection_bindings FOR INSERT WITH CHECK (
  is_workspace_member(workspace_id) AND created_by=auth.uid()
  AND public.connection_owner_in_workspace(connection_id, workspace_id)
  AND (product_id IS NULL OR public.product_in_workspace(product_id, workspace_id)));
DROP POLICY IF EXISTS "Workspace bindings - update" ON public.connection_bindings;
CREATE POLICY "Workspace bindings - update" ON public.connection_bindings FOR UPDATE
  USING (is_workspace_member(workspace_id) AND (created_by=auth.uid() OR can_manage_workspace(workspace_id)))
  WITH CHECK (is_workspace_member(workspace_id) AND (created_by=auth.uid() OR can_manage_workspace(workspace_id))
    AND public.connection_owner_in_workspace(connection_id, workspace_id)
    AND (product_id IS NULL OR public.product_in_workspace(product_id, workspace_id)));
DROP POLICY IF EXISTS "Workspace bindings - delete" ON public.connection_bindings;
CREATE POLICY "Workspace bindings - delete" ON public.connection_bindings FOR DELETE
  USING (is_workspace_member(workspace_id) AND (created_by=auth.uid() OR can_manage_workspace(workspace_id)));

create or replace function public.memory_expiry_enabled() returns boolean language sql stable set search_path to 'public' as $$
  select coalesce((select (value->>'enabled')::boolean from public.app_settings where key='memory_expiry_enabled'), false);
$$;
revoke execute on function public.memory_expiry_enabled() from public;
grant execute on function public.memory_expiry_enabled() to anon, authenticated, service_role;

create or replace function public.admin_set_memory_expiry_enabled(_enabled boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.app_settings(key,value,updated_at,updated_by)
  values('memory_expiry_enabled',jsonb_build_object('enabled',_enabled),now(),auth.uid())
  on conflict(key) do update set value=excluded.value,updated_at=now(),updated_by=auth.uid();
  insert into public.admin_audit_log(actor_user_id,action,target_kind,target_id,payload)
  values(auth.uid(),'memory_expiry.set_enabled','app_settings','memory_expiry_enabled',jsonb_build_object('enabled',_enabled));
  return _enabled;
end; $$;
revoke execute on function public.admin_set_memory_expiry_enabled(boolean) from public;
grant execute on function public.admin_set_memory_expiry_enabled(boolean) to authenticated, service_role;
insert into public.app_settings(key,value,updated_at) values('memory_expiry_enabled','{"enabled": false}',now()) on conflict(key) do nothing;

CREATE TABLE IF NOT EXISTS public.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, workspace_id uuid NOT NULL, product_id uuid,
  changeset_id uuid REFERENCES public.studio_changesets(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'github', environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('success','failure','pending','in_progress','unknown')),
  commit_sha text NOT NULL DEFAULT '', deploy_url text, triggered_by text, deployed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_deployments_capture ON public.deployments (changeset_id, environment, commit_sha);
CREATE INDEX IF NOT EXISTS idx_deployments_ws ON public.deployments (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_product ON public.deployments (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_changeset ON public.deployments (changeset_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deployments TO authenticated;
GRANT ALL ON public.deployments TO service_role;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deployments ws read" ON public.deployments;
CREATE POLICY "deployments ws read" ON public.deployments FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "deployments ws write" ON public.deployments;
CREATE POLICY "deployments ws write" ON public.deployments FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id=auth.uid());

ALTER TABLE public.studio_changesets ADD COLUMN IF NOT EXISTS prd_id uuid REFERENCES public.prds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_studio_changesets_prd ON public.studio_changesets (prd_id) WHERE prd_id IS NOT NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='missions' AND column_name='prd_id') THEN
    EXECUTE 'UPDATE public.studio_changesets cs SET prd_id=m.prd_id FROM public.missions m WHERE cs.prd_id IS NULL AND cs.mission_id=m.id AND m.prd_id IS NOT NULL';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, workspace_id uuid NOT NULL, product_id uuid,
  changeset_id uuid REFERENCES public.studio_changesets(id) ON DELETE CASCADE,
  prd_id uuid REFERENCES public.prds(id) ON DELETE SET NULL,
  title text NOT NULL, body text, pr_number int, pr_url text,
  released_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_changelog_changeset ON public.changelog_entries (changeset_id) WHERE changeset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_changelog_ws ON public.changelog_entries (workspace_id, released_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_product ON public.changelog_entries (product_id, released_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.changelog_entries TO authenticated;
GRANT ALL ON public.changelog_entries TO service_role;
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "changelog ws read" ON public.changelog_entries;
CREATE POLICY "changelog ws read" ON public.changelog_entries FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "changelog ws write" ON public.changelog_entries;
CREATE POLICY "changelog ws write" ON public.changelog_entries FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id=auth.uid());

ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS source_kind text;
UPDATE public.signals SET source_kind = CASE
  WHEN source IN ('github','posthog_analytics') THEN 'pull_connector'
  WHEN source='competitive_research' THEN 'web_scout'
  WHEN source='mcp' THEN 'mcp_source'
  WHEN source='webhook' THEN 'webhook' ELSE 'manual'
END WHERE source_kind IS NULL;
ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_source_kind_check;
ALTER TABLE public.signals ADD CONSTRAINT signals_source_kind_check
  CHECK (source_kind IS NULL OR source_kind IN ('pull_connector','web_scout','mcp_source','webhook','manual'));

CREATE TABLE IF NOT EXISTS public.scout_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('competitor-surface','market-news','social-reviews','hiring','tech-platform-shift','regulatory-compliance')),
  label text NOT NULL, url text, query text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  cadence text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('hourly','daily','weekly')),
  enabled boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz, next_check_at timestamptz,
  consecutive_unchanged int NOT NULL DEFAULT 0, error_count int NOT NULL DEFAULT 0, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scout_targets_url_or_query CHECK (url IS NOT NULL OR query IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_scout_targets_due ON public.scout_targets (enabled, next_check_at ASC NULLS FIRST) WHERE enabled=true;
CREATE INDEX IF NOT EXISTS idx_scout_targets_ws ON public.scout_targets (workspace_id);

CREATE TABLE IF NOT EXISTS public.scout_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES public.scout_targets(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_hash text NOT NULL, excerpt text NOT NULL DEFAULT '',
  char_count int NOT NULL DEFAULT 0, fetched_url text, status int,
  fetched_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_scout_snapshots_target ON public.scout_snapshots (target_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.scout_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.scout_targets(id) ON DELETE SET NULL,
  kind text,
  outcome text NOT NULL CHECK (outcome IN ('first-seen','unchanged','changed','error','skipped-cap')),
  changed boolean NOT NULL DEFAULT false,
  signal_id uuid REFERENCES public.signals(id) ON DELETE SET NULL,
  snapshot_id uuid REFERENCES public.scout_snapshots(id) ON DELETE SET NULL,
  fetch_count int NOT NULL DEFAULT 0, detail text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_scout_runs_ws_time ON public.scout_runs (workspace_id, created_at DESC);

ALTER TABLE public.scout_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_targets TO authenticated;
GRANT SELECT ON public.scout_snapshots TO authenticated;
GRANT SELECT ON public.scout_runs TO authenticated;
GRANT ALL ON public.scout_targets TO service_role;
GRANT ALL ON public.scout_snapshots TO service_role;
GRANT ALL ON public.scout_runs TO service_role;

DROP POLICY IF EXISTS scout_targets_member_read ON public.scout_targets;
CREATE POLICY scout_targets_member_read ON public.scout_targets FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS scout_targets_owner_write ON public.scout_targets;
CREATE POLICY scout_targets_owner_write ON public.scout_targets FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id=auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id=auth.uid()));
DROP POLICY IF EXISTS scout_snapshots_member_read ON public.scout_snapshots;
CREATE POLICY scout_snapshots_member_read ON public.scout_snapshots FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS scout_runs_member_read ON public.scout_runs;
CREATE POLICY scout_runs_member_read ON public.scout_runs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS scout_targets_updated_at ON public.scout_targets;
CREATE TRIGGER scout_targets_updated_at BEFORE UPDATE ON public.scout_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_scout_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_scout_at timestamptz,
  ADD COLUMN IF NOT EXISTS scout_daily_fetch_cap int NOT NULL DEFAULT 50;
CREATE INDEX IF NOT EXISTS idx_workspaces_auto_scout
  ON public.workspaces (auto_scout_enabled, last_auto_scout_at ASC NULLS FIRST) WHERE auto_scout_enabled=true;

DO $$
DECLARE base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='scout-tick';
  PERFORM cron.schedule('scout-tick','0 * * * *',
    format($job$
      SELECT net.http_post(url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-key', public.get_cron_hook_secret()),
        body := '{}'::jsonb) AS request_id;
    $job$, base_url || '/api/public/hooks/scout-tick'));
END $$;

ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS novelty real,
  ADD COLUMN IF NOT EXISTS novelty_basis jsonb,
  ADD COLUMN IF NOT EXISTS scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_signal_at timestamptz;
CREATE INDEX IF NOT EXISTS themes_embedding_hnsw ON public.themes USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_themes(
  query_embedding vector(1536), for_user uuid, exclude_id uuid DEFAULT NULL, match_count integer DEFAULT 6
) RETURNS TABLE (id uuid, title text, summary text, similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id, t.title, t.summary, 1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.themes t
  WHERE t.user_id = COALESCE(auth.uid(), for_user)
    AND t.embedding IS NOT NULL AND (exclude_id IS NULL OR t.id <> exclude_id)
  ORDER BY t.embedding <=> query_embedding LIMIT match_count;
$$;
REVOKE EXECUTE ON FUNCTION public.match_themes(vector, uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_themes(vector, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_themes(vector, uuid, uuid, integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  workspace_id uuid NOT NULL DEFAULT public.current_user_default_workspace() REFERENCES public.workspaces (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  theme_id uuid REFERENCES public.themes (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('prediction','risk','next_best_action','cost_of_inaction','hidden_connection')),
  headline text NOT NULL, detail text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb, recommended_action jsonb,
  score real, confidence real,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acted','dismissed','expired')),
  dedup_key text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS insights_ws_dedup_idx ON public.insights (workspace_id, dedup_key);
CREATE INDEX IF NOT EXISTS insights_ws_status_idx ON public.insights (workspace_id, status, score DESC);
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights TO authenticated;
GRANT ALL ON public.insights TO service_role;
DROP POLICY IF EXISTS "insights ws read" ON public.insights;
CREATE POLICY "insights ws read" ON public.insights FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insights ws write" ON public.insights;
CREATE POLICY "insights ws write" ON public.insights FOR ALL
  USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
DROP TRIGGER IF EXISTS insights_updated_at ON public.insights;
CREATE TRIGGER insights_updated_at BEFORE UPDATE ON public.insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_derive_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_derive_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_workspaces_auto_derive
  ON public.workspaces (auto_derive_enabled, last_auto_derive_at ASC NULLS FIRST) WHERE auto_derive_enabled=true;

ALTER TABLE public.user_api_keys ADD COLUMN IF NOT EXISTS model_id text;