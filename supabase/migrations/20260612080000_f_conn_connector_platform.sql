-- F-CONN Phase 1 — self-serve connector platform foundation.
-- Account-level connections (user owns the credential), workspace-level
-- connection_bindings (which resource this workspace uses), and a service-role
-- only secret vault (connection_secrets). Credentials are resolved through the
-- single chokepoint src/lib/connectors/resolve.server.ts; env fallbacks
-- (GITHUB_TOKEN/GITHUB_REPO etc.) stay live until a binding exists.

-- ============ connection_secrets (service-role only vault) ============
-- AES-256-GCM ciphertext, key held in CONNECTOR_SECRETS_KEY (wrangler secret).
CREATE TABLE IF NOT EXISTS public.connection_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciphertext text NOT NULL, -- base64
  iv text NOT NULL,         -- base64
  key_version int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- RLS enabled with NO policies on purpose: nobody but service_role reads secrets.
ALTER TABLE public.connection_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connection_secrets FROM anon;
REVOKE ALL ON public.connection_secrets FROM authenticated;
GRANT ALL ON public.connection_secrets TO service_role;

-- ============ connections (account-level, user-owned) ============
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  auth_kind text NOT NULL CHECK (auth_kind IN ('github_app','oauth_gateway','api_key','token')),
  external_handle text, -- GitHub App installation_id or gateway connection_id
  secret_id uuid REFERENCES public.connection_secrets(id) ON DELETE SET NULL,
  account_label text,
  account_email text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error','disconnected')),
  status_detail text,
  scopes text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS connections_user_provider_label_key
  ON public.connections (user_id, provider, COALESCE(account_label, ''));
CREATE INDEX IF NOT EXISTS idx_connections_user_provider
  ON public.connections (user_id, provider);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Own-row RLS; DROP-then-CREATE keeps the migration idempotent.
DROP POLICY IF EXISTS "connections own rows" ON public.connections;
CREATE POLICY "connections own rows" ON public.connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS connections_updated_at ON public.connections;
CREATE TRIGGER connections_updated_at
BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ connection_bindings (workspace-level resource choice) ============
CREATE TABLE IF NOT EXISTS public.connection_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  product_id uuid NULL,
  provider text NOT NULL,
  resource_kind text NOT NULL,
  resource_id text NOT NULL, -- e.g. 'owner/name' for GitHub repos
  resource_label text,
  config jsonb DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One workspace-level binding per provider+resource_kind (product-level
-- bindings arrive in a later phase, hence the partial index).
CREATE UNIQUE INDEX IF NOT EXISTS connection_bindings_ws_provider_kind_key
  ON public.connection_bindings (workspace_id, provider, resource_kind)
  WHERE product_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_connection_bindings_ws
  ON public.connection_bindings (workspace_id, provider);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_bindings TO authenticated;
GRANT ALL ON public.connection_bindings TO service_role;

ALTER TABLE public.connection_bindings ENABLE ROW LEVEL SECURITY;

-- Membership-keyed RLS, same pattern as 20260611190000_f_v5_ingest_webhook_tokens.
DROP POLICY IF EXISTS "connection_bindings ws read" ON public.connection_bindings;
CREATE POLICY "connection_bindings ws read" ON public.connection_bindings
  FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "connection_bindings ws write" ON public.connection_bindings;
CREATE POLICY "connection_bindings ws write" ON public.connection_bindings
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS connection_bindings_updated_at ON public.connection_bindings;
CREATE TRIGGER connection_bindings_updated_at
BEFORE UPDATE ON public.connection_bindings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ user_api_keys — encrypted-at-rest columns ============
-- Plaintext api_key column stays for back-compat; new writes go to the
-- cipher columns once src/lib/connectors/crypto.server.ts is wired in.
ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS api_key_cipher text,
  ADD COLUMN IF NOT EXISTS api_key_iv text,
  ADD COLUMN IF NOT EXISTS key_version int;
