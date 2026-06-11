-- F-V5-INGEST-WEBHOOK — per-workspace ingest tokens for the public
-- /api/public/ingest-signals webhook (Zapier / Slack outgoing webhooks /
-- forms / scripts → signals rows). The endpoint looks tokens up via the
-- service-role client; operators manage them through src/lib/ingest.functions.ts.

CREATE TABLE IF NOT EXISTS public.ingest_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- Default bridge mirrors the tenancy retrofit (20260530120200) so inserts
  -- that omit workspace_id still land in the caller's default workspace.
  workspace_id uuid NOT NULL DEFAULT public.current_user_default_workspace(),
  token text NOT NULL UNIQUE,
  label text,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz NULL
);

-- Inline UNIQUE above already backs this with ingest_tokens_token_key; the
-- explicit IF NOT EXISTS form keeps the migration safe if the table pre-exists.
CREATE UNIQUE INDEX IF NOT EXISTS ingest_tokens_token_key ON public.ingest_tokens (token);
CREATE INDEX IF NOT EXISTS idx_ingest_tokens_ws_created ON public.ingest_tokens (workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingest_tokens TO authenticated;
GRANT ALL ON public.ingest_tokens TO service_role;

ALTER TABLE public.ingest_tokens ENABLE ROW LEVEL SECURITY;

-- Membership-keyed RLS, exact pattern from tenancy retrofit C/3 (20260530120200).
-- DROP-then-CREATE keeps the migration idempotent.
DROP POLICY IF EXISTS "ingest_tokens ws read" ON public.ingest_tokens;
CREATE POLICY "ingest_tokens ws read" ON public.ingest_tokens
  FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "ingest_tokens ws write" ON public.ingest_tokens;
CREATE POLICY "ingest_tokens ws write" ON public.ingest_tokens
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
