
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.docs(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  icon text DEFAULT '📄',
  content_json jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_text text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  position numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_user ON public.docs(user_id);
CREATE INDEX idx_docs_parent ON public.docs(parent_id);
CREATE INDEX idx_docs_project ON public.docs(project_id);
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs all" ON public.docs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.doc_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  content_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_versions_doc ON public.doc_versions(doc_id, created_at DESC);
ALTER TABLE public.doc_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own doc_versions all" ON public.doc_versions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  account_label text,
  scopes text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integrations all" ON public.user_integrations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_integrations_updated BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sync_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  local_kind text NOT NULL,
  local_id uuid NOT NULL,
  external_id text NOT NULL,
  external_url text,
  version_local bigint NOT NULL DEFAULT 0,
  version_remote bigint NOT NULL DEFAULT 0,
  last_pulled_at timestamptz,
  last_pushed_at timestamptz,
  conflict boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, local_kind, local_id),
  UNIQUE (provider, external_id)
);
CREATE INDEX idx_sync_user ON public.sync_mappings(user_id);
ALTER TABLE public.sync_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sync_mappings all" ON public.sync_mappings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_sync_mappings_updated BEFORE UPDATE ON public.sync_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
