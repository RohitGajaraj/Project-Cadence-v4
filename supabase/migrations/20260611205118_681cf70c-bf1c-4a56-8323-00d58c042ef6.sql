CREATE TABLE public.connection_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciphertext text NOT NULL,
  iv text NOT NULL,
  key_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.connection_secrets TO service_role;
ALTER TABLE public.connection_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  auth_kind text NOT NULL CHECK (auth_kind IN ('github_app','oauth_gateway','api_key','token')),
  external_handle text,
  secret_id uuid REFERENCES public.connection_secrets(id) ON DELETE SET NULL,
  account_label text,
  account_email text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error','disconnected')),
  status_detail text,
  scopes text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX connections_user_id_idx ON public.connections(user_id);
CREATE INDEX connections_provider_idx ON public.connections(provider);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own connections - select" ON public.connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own connections - insert" ON public.connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own connections - update" ON public.connections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own connections - delete" ON public.connections FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.connection_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  resource_kind text NOT NULL,
  resource_id text NOT NULL,
  resource_label text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX connection_bindings_workspace_idx ON public.connection_bindings(workspace_id);
CREATE INDEX connection_bindings_connection_idx ON public.connection_bindings(connection_id);
CREATE UNIQUE INDEX connection_bindings_ws_provider_kind_uq
  ON public.connection_bindings(workspace_id, provider, resource_kind)
  WHERE product_id IS NULL;
CREATE UNIQUE INDEX connection_bindings_ws_product_provider_kind_uq
  ON public.connection_bindings(workspace_id, product_id, provider, resource_kind)
  WHERE product_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_bindings TO authenticated;
GRANT ALL ON public.connection_bindings TO service_role;
ALTER TABLE public.connection_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace bindings - select" ON public.connection_bindings FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace bindings - insert" ON public.connection_bindings FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY "Workspace bindings - update" ON public.connection_bindings FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace bindings - delete" ON public.connection_bindings FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_connection_bindings_updated_at BEFORE UPDATE ON public.connection_bindings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_connection_secrets_updated_at BEFORE UPDATE ON public.connection_secrets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();