-- Q1 (P1) · MCP server — token management + audit trail.
--
-- Cadence as a neutral brain: external agents use MCP (Model Context Protocol) to
-- read signals/opps/PRDs and append decisions, governed. This migration adds:
--
-- 1. mcp_tokens: issued per workspace+user, revocable, rate-limited.
-- 2. api_calls: audit trail for all MCP calls (read/write, cost, result).
--
-- Scoping: mcp_tokens are workspace-scoped; a token can only read/write its workspace.
-- RLS: mcp_tokens is read-only to the workspace (service role issues + revokes).
--      api_calls is append-only (service role logs calls).

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  rate_limit_per_min INTEGER DEFAULT 60,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  revoked_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(workspace_id, slug),
  UNIQUE(workspace_id, secret_hash)
);

ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY mcp_tokens_workspace_read ON mcp_tokens
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY mcp_tokens_service_only_write ON mcp_tokens
  FOR INSERT WITH CHECK (false);

CREATE POLICY mcp_tokens_service_only_update ON mcp_tokens
  FOR UPDATE USING (false);

CREATE POLICY mcp_tokens_service_only_delete ON mcp_tokens
  FOR DELETE USING (false);

CREATE INDEX idx_mcp_tokens_workspace ON mcp_tokens(workspace_id);
CREATE INDEX idx_mcp_tokens_user ON mcp_tokens(user_id);
CREATE INDEX idx_mcp_tokens_revoked ON mcp_tokens(revoked_at) WHERE revoked_at IS NULL;

---

CREATE TABLE IF NOT EXISTS api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES mcp_tokens(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  result VARCHAR(20) NOT NULL DEFAULT 'unknown',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE api_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_calls_workspace_read ON api_calls
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY api_calls_service_only_write ON api_calls
  FOR INSERT WITH CHECK (false);

CREATE INDEX idx_api_calls_token ON api_calls(token_id);
CREATE INDEX idx_api_calls_workspace ON api_calls(workspace_id);
CREATE INDEX idx_api_calls_created ON api_calls(created_at DESC);

---

CREATE OR REPLACE FUNCTION public.issue_mcp_token(
  _workspace_id UUID,
  _user_id UUID,
  _slug TEXT,
  _secret_hash TEXT,
  _rate_limit_per_min INTEGER DEFAULT 60
)
RETURNS mcp_tokens AS $$
DECLARE
  token mcp_tokens;
BEGIN
  INSERT INTO public.mcp_tokens (
    workspace_id, user_id, slug, secret_hash, rate_limit_per_min
  ) VALUES (
    _workspace_id, _user_id, _slug, _secret_hash, _rate_limit_per_min
  )
  RETURNING * INTO token;
  RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.issue_mcp_token FROM PUBLIC, anon, authenticated;

---

CREATE OR REPLACE FUNCTION public.revoke_mcp_token(_token_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.mcp_tokens
  SET revoked_at = now()
  WHERE id = _token_id AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.revoke_mcp_token FROM PUBLIC, anon, authenticated;

---

CREATE OR REPLACE FUNCTION public.log_api_call(
  _token_id UUID,
  _workspace_id UUID,
  _tool_name TEXT,
  _input_tokens INTEGER,
  _output_tokens INTEGER,
  _cost_usd DECIMAL,
  _result VARCHAR,
  _error_message TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
)
RETURNS api_calls AS $$
DECLARE
  call api_calls;
BEGIN
  INSERT INTO public.api_calls (
    token_id, workspace_id, tool_name, input_tokens, output_tokens,
    cost_usd, result, error_message, metadata
  ) VALUES (
    _token_id, _workspace_id, _tool_name, _input_tokens, _output_tokens,
    _cost_usd, _result, _error_message, COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING * INTO call;
  RETURN call;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.log_api_call FROM PUBLIC, anon, authenticated;
