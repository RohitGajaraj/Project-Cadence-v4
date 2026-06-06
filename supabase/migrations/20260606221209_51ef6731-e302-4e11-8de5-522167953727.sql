
DO $$ BEGIN
  CREATE TYPE public.calendar_provider AS ENUM ('google', 'microsoft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NULL,
  provider public.calendar_provider NOT NULL,
  connection_id TEXT NOT NULL,
  account_email TEXT NULL,
  display_name TEXT NULL,
  last_sync_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, account_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_calendar_connections TO authenticated;
GRANT ALL ON public.user_calendar_connections TO service_role;

ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_connections_select" ON public.user_calendar_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_connections_insert" ON public.user_calendar_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_connections_update" ON public.user_calendar_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_connections_delete" ON public.user_calendar_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_ucc_updated_at ON public.user_calendar_connections;
CREATE TRIGGER update_ucc_updated_at BEFORE UPDATE ON public.user_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ucc_user ON public.user_calendar_connections(user_id);
