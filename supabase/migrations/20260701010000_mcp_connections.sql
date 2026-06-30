-- SF-MCP (Signal Fabric Phase 3): the mcp_source adapter's rate-limit + audit ledger.
--
-- This table holds ONLY engine-internal telemetry — a per-(workspace, server) call
-- counter, the rolling-window start, the last call timestamp, and a sanitized last
-- error string. It NEVER stores a server URL or a token: those live exclusively in
-- founder-controlled environment variables (MCP_<SERVER>_URL / MCP_<SERVER>_TOKEN),
-- which is the actual trust boundary for this feature. A user or a DB row can never
-- choose which external host gets fetched.
--
-- The server_id CHECK is the founder-curated allowlist of the four absorbed slots
-- (Linear, Gong, Granola, Enterpret). Adding a fifth server requires a code change
-- (the registry in src/lib/connectors/mcp/registry.ts) AND a migration to extend this
-- CHECK — never a migration-less runtime value, so the allowed-server set can't grow
-- silently.
--
-- No user-facing write surface: only ingestMcpSignals (service-role) writes rows.
-- Members can read for visibility (rate-limit/health surfacing), mirroring
-- scout_snapshots/scout_runs in 20260630121000_scout_watchtower.sql.
--
-- Idempotent (CREATE TABLE/INDEX IF NOT EXISTS; DROP-then-CREATE for policy/trigger);
-- MIG-LINT-safe (every column is nullable or defaulted; new table, no backfill).

CREATE TABLE IF NOT EXISTS public.mcp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  server_id text NOT NULL CHECK (server_id IN ('linear-mcp','gong','granola','enterpret')),
  last_called_at timestamptz,
  calls_today int NOT NULL DEFAULT 0,
  calls_window_started_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, server_id)
);
CREATE INDEX IF NOT EXISTS idx_mcp_connections_ws ON public.mcp_connections (workspace_id);

ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.mcp_connections TO authenticated;
GRANT ALL ON public.mcp_connections TO service_role;

DROP POLICY IF EXISTS mcp_connections_member_read ON public.mcp_connections;
CREATE POLICY mcp_connections_member_read ON public.mcp_connections
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS mcp_connections_updated_at ON public.mcp_connections;
CREATE TRIGGER mcp_connections_updated_at BEFORE UPDATE ON public.mcp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
