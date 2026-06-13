-- v6 Phase 3 ("Proof & Launch") / Track 2 — the Gauntlet's ritual-retention
-- metric (Metric B) needs a real record of when the operator actually opened
-- their Today surface to run the daily ritual.
--
-- Idempotent: one row per user per UTC day (unique on (user_id, opened_on)),
-- written via an ON CONFLICT DO NOTHING upsert from the client, so repeated
-- Today opens never accumulate rows. Owner-scoped RLS mirrors agent_approvals /
-- tool_calls (auth.uid() = user_id). This applies on the next Lovable sync;
-- until then the read path degrades gracefully to "not enough data yet"
-- (gauntlet.functions.ts probes the table tolerantly).

CREATE TABLE IF NOT EXISTS public.ritual_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  -- UTC calendar day of the open — the per-day dedupe key (see unique index).
  opened_on date NOT NULL DEFAULT (timezone('utc', now()))::date,
  calls_shown int,
  calls_cleared int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ritual_sessions TO authenticated;
GRANT ALL ON public.ritual_sessions TO service_role;

ALTER TABLE public.ritual_sessions ENABLE ROW LEVEL SECURITY;

-- Owner-scoped: a user only ever sees and writes their own ritual sessions.
-- DROP-then-CREATE keeps the migration idempotent.
DROP POLICY IF EXISTS "own ritual_sessions all" ON public.ritual_sessions;
CREATE POLICY "own ritual_sessions all" ON public.ritual_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- One ritual session per user per UTC day — recordRitualSession upserts onto
-- this, so repeated opens are idempotent (and the 30-day read can never exceed
-- ~30 rows per user).
CREATE UNIQUE INDEX IF NOT EXISTS ritual_sessions_user_day_idx
  ON public.ritual_sessions (user_id, opened_on);
