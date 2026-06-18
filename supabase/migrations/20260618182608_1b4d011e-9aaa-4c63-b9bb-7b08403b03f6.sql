-- H2 Outcome roadmap
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS roadmap_bucket text,
  ADD COLUMN IF NOT EXISTS roadmap_outcome text,
  ADD COLUMN IF NOT EXISTS roadmap_measure text;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_roadmap_bucket_check;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_roadmap_bucket_check
  CHECK (roadmap_bucket IS NULL OR roadmap_bucket IN ('now', 'next', 'later'));

CREATE INDEX IF NOT EXISTS opportunities_roadmap_idx
  ON public.opportunities (user_id, roadmap_bucket)
  WHERE roadmap_bucket IS NOT NULL;

-- F-SHARE-TEARDOWN
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS share_slug text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_public  boolean NOT NULL DEFAULT false;

UPDATE public.opportunities
   SET share_slug = replace(gen_random_uuid()::text, '-', '')
 WHERE share_slug IS NULL;
ALTER TABLE public.opportunities ALTER COLUMN share_slug SET DEFAULT replace(gen_random_uuid()::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_share_slug_key ON public.opportunities (share_slug);

REVOKE SELECT ON public.opportunities FROM anon;
GRANT SELECT (share_slug, title, critic_review, created_at, is_public)
  ON public.opportunities TO anon;

DROP POLICY IF EXISTS "public teardowns readable" ON public.opportunities;
CREATE POLICY "public teardowns readable" ON public.opportunities
  FOR SELECT TO anon USING (is_public = true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'opportunities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.opportunities';
  END IF;
END $$;

-- F3 auto-cluster
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_cluster_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_cluster_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workspaces_auto_cluster
  ON public.workspaces (auto_cluster_enabled, last_auto_cluster_at ASC NULLS FIRST)
  WHERE auto_cluster_enabled = true;

-- D4 replay-branch
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS replayed_from_mission_id uuid
  REFERENCES public.missions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_missions_replayed_from
  ON public.missions (replayed_from_mission_id)
  WHERE replayed_from_mission_id IS NOT NULL;