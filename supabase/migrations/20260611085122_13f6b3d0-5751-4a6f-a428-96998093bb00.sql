
-- F-DECISIONS-CAPTURE: extend decisions with source links + kind, backfill, index.
ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prd_id uuid REFERENCES public.prds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS decided_by_agent_slug text;

CREATE INDEX IF NOT EXISTS idx_decisions_mission_id ON public.decisions(mission_id);
CREATE INDEX IF NOT EXISTS idx_decisions_prd_id ON public.decisions(prd_id);
CREATE INDEX IF NOT EXISTS idx_decisions_source_kind ON public.decisions(source_kind);

-- Backfill source_kind for existing rows
UPDATE public.decisions
SET source_kind = CASE
  WHEN meeting_id IS NOT NULL THEN 'meeting'
  ELSE 'manual'
END
WHERE source_kind IS NULL;

-- Constrain to known kinds (nullable still allowed for old rows; new code always writes)
ALTER TABLE public.decisions
  DROP CONSTRAINT IF EXISTS decisions_source_kind_check;
ALTER TABLE public.decisions
  ADD CONSTRAINT decisions_source_kind_check
  CHECK (source_kind IS NULL OR source_kind IN ('meeting','mission','prd','manual'));

-- F-SEC-REALTIME-RLS (auto-fix): agent_runs realtime broadcast leaked rows across users
-- because the Realtime channel does not honor table RLS. No UI subscribes to it.
-- Remove from the publication; if a subscriber is added later, do it through a
-- workspace-scoped broadcast channel with realtime.messages policies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agent_runs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.agent_runs';
  END IF;
END $$;
