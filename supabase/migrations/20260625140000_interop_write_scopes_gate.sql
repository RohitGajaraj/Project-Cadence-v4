-- INTEROP-V11 · Q2 — the outward GOVERNED WRITE surface for the MCP / A2A server.
--
-- The MCP server has been READ-ONLY (the earlier append_decision write tool was removed
-- 2026-06-24 because it inserted into a `decision_queue` table + columns that do not exist
-- in the live schema, so it could never succeed). The founder lifted the Q2 scopes/audit
-- gate on 2026-06-25; this migration adds the DB half of a governed write surface that
-- cannot repeat that drift bug, because the single write tool reuses the SAME live `signals`
-- insert path the F-V5-INGEST-WEBHOOK door already uses (schema verified against prod).
--
-- TWO INDEPENDENT LOCKS gate every external write — both must be open:
--   1. per-token SCOPE  — a token must carry the tool's required scope (e.g. `write:signal`).
--                          Existing tokens default to `{}` = read-only, so nothing changes
--                          for any token already issued.
--   2. a global DORMANT GATE — `interop_write_enabled()` defaults FALSE and is flipped only by
--                          an admin (`admin_set_interop_write_enabled`), mirroring the proven
--                          `credits_enabled()` / app_settings pattern. The write surface ships
--                          DORMANT: even a correctly write-scoped token cannot write until a
--                          founder flips the gate on. Fully reversible (flip it back off).
--
-- Reads never require a scope and never consult the gate — this migration is a no-op for the
-- existing read tools.

-- 1. Per-token capability scopes. Default '{}' keeps every existing + future token read-only
--    until it is explicitly minted with a write scope.
ALTER TABLE public.mcp_tokens
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.mcp_tokens.scopes IS
  'Capability scopes this token may exercise (e.g. write:signal). Empty array = read-only. Reads never require a scope; every write tool requires its named scope AND the global interop_write_enabled() gate.';

-- 2. issue_mcp_token gains an optional _scopes arg. Dropping the old 5-arg signature and
--    recreating with a defaulted 6th arg keeps every existing 5-named-arg caller working
--    (the default fills _scopes = '{}'), with no overload ambiguity.
DROP FUNCTION IF EXISTS public.issue_mcp_token(UUID, UUID, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.issue_mcp_token(
  _workspace_id UUID,
  _user_id UUID,
  _slug TEXT,
  _secret_hash TEXT,
  _rate_limit_per_min INTEGER DEFAULT 60,
  _scopes TEXT[] DEFAULT '{}'
)
RETURNS mcp_tokens AS $$
DECLARE
  token mcp_tokens;
BEGIN
  INSERT INTO public.mcp_tokens (
    workspace_id, user_id, slug, secret_hash, rate_limit_per_min, scopes
  ) VALUES (
    _workspace_id, _user_id, _slug, _secret_hash, _rate_limit_per_min, COALESCE(_scopes, '{}')
  )
  RETURNING * INTO token;
  RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.issue_mcp_token(UUID, UUID, TEXT, TEXT, INTEGER, TEXT[])
  FROM PUBLIC, anon, authenticated;

-- 3. The global dormant gate. Reads the app_settings flag (default FALSE when unset). The
--    `#>> '{}'` extraction pulls the scalar text out of the jsonb value, then casts to boolean —
--    robust across the to_jsonb(true/false) values the admin setter writes.
CREATE OR REPLACE FUNCTION public.interop_write_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key = 'interop_write_enabled'),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.interop_write_enabled() TO authenticated, service_role;

-- 4. Admin-only setter, mirroring admin_set_credits_enabled. Writes the app_settings flag;
--    only an admin can flip the outward write surface on or off.
CREATE OR REPLACE FUNCTION public.admin_set_interop_write_enabled(_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  INSERT INTO public.app_settings (key, value, updated_at, updated_by)
  VALUES ('interop_write_enabled', to_jsonb(_enabled), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = excluded.value, updated_at = now(), updated_by = auth.uid();
  RETURN _enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_interop_write_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_interop_write_enabled(boolean) TO authenticated;
