-- ============ user_api_keys ============
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  label text,
  api_key text NOT NULL,
  base_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, label)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own api keys all" ON public.user_api_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_api_keys_updated_at
BEFORE UPDATE ON public.user_api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ calendar_events ============
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  title text NOT NULL DEFAULT '(no title)',
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed',
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  hangout_link text,
  html_link text,
  organizer_email text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own calendar_events all" ON public.calendar_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS calendar_events_user_start_idx
  ON public.calendar_events (user_id, start_at DESC);

CREATE TRIGGER calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ agents: schedule columns ============
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS cron_schedule text,
  ADD COLUMN IF NOT EXISTS cron_input text,
  ADD COLUMN IF NOT EXISTS last_scheduled_run_at timestamptz;

CREATE INDEX IF NOT EXISTS agents_cron_idx
  ON public.agents (user_id, cron_schedule)
  WHERE cron_schedule IS NOT NULL;