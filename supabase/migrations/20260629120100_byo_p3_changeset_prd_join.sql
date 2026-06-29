-- BYO-P3 WI2 — Build-merge → PRD join.
-- A studio changeset can now point back at the PRD it was dispatched from, so a
-- merge feeds the existing Ship → Learn loop (recordOutcome) and the in-app
-- changelog without re-deriving the link each time. The column is self-healed
-- from artifact_lineage (the prd → mission "dispatched" edge) by
-- getChangesetByPrd when dispatch did not set it directly. Additive + nullable.
ALTER TABLE public.studio_changesets
  ADD COLUMN IF NOT EXISTS prd_id uuid REFERENCES public.prds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_studio_changesets_prd
  ON public.studio_changesets (prd_id);

-- Auto-link: the changeset is created lazily by the agent (studio.stage, in the
-- chokepoint-pinned registry) keyed by mission_id. At that moment the prd →
-- mission "dispatched" edge already exists in artifact_lineage (written by
-- dispatchStudioSession). This BEFORE INSERT trigger stamps prd_id from that
-- edge without any edit to the pinned tool handler. SECURITY DEFINER so the
-- lineage lookup is not constrained by the inserter's RLS view.
CREATE OR REPLACE FUNCTION public.studio_changeset_link_prd()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.prd_id IS NULL AND NEW.mission_id IS NOT NULL THEN
    SELECT parent_id INTO NEW.prd_id
    FROM public.artifact_lineage
    WHERE child_kind = 'mission'
      AND child_id = NEW.mission_id
      AND parent_kind = 'prd'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_studio_changeset_link_prd ON public.studio_changesets;
CREATE TRIGGER trg_studio_changeset_link_prd
  BEFORE INSERT ON public.studio_changesets
  FOR EACH ROW EXECUTE FUNCTION public.studio_changeset_link_prd();

-- Backfill existing changesets from their mission's dispatch lineage.
UPDATE public.studio_changesets cs
SET prd_id = al.parent_id
FROM public.artifact_lineage al
WHERE cs.prd_id IS NULL
  AND cs.mission_id IS NOT NULL
  AND al.child_kind = 'mission'
  AND al.child_id = cs.mission_id
  AND al.parent_kind = 'prd';
