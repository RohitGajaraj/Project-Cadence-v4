-- BYO-P3 WI4 — In-app changelog.
-- One entry per merged changeset that carries release notes (K1
-- generateReleaseNotes writes release_notes). Entries are self-materialized by
-- listChangelog / publishChangelogEntry from merged studio_changesets, so no
-- edit to the chokepoint-pinned merge handler is needed. Workspace-scoped RLS.

CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  product_id uuid,
  -- SET NULL (not CASCADE): a changelog entry is the DURABLE record of what
  -- shipped and stands alone via its denormalized columns. Deleting a build
  -- session hard-deletes its mission → changeset (two-hop CASCADE); the shipped
  -- history must survive that, matching deployments.changeset_id + prd_id below.
  changeset_id uuid REFERENCES public.studio_changesets(id) ON DELETE SET NULL,
  prd_id uuid REFERENCES public.prds(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  pr_number int,
  pr_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One changelog entry per changeset — re-publishing the same merge is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_changelog_changeset
  ON public.changelog_entries (changeset_id);
CREATE INDEX IF NOT EXISTS idx_changelog_ws
  ON public.changelog_entries (workspace_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_product
  ON public.changelog_entries (product_id, published_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.changelog_entries TO authenticated;
GRANT ALL ON public.changelog_entries TO service_role;

ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "changelog ws read" ON public.changelog_entries;
CREATE POLICY "changelog ws read" ON public.changelog_entries
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "changelog ws write" ON public.changelog_entries;
CREATE POLICY "changelog ws write" ON public.changelog_entries
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

-- Auto-feed: when a changeset becomes merged with release notes, materialize a
-- changelog entry. This fires from the (chokepoint-pinned) merge handler's
-- status write without that file being edited. SECURITY DEFINER so the entry is
-- created regardless of which workspace member triggered the merge. The TS
-- publishChangelogEntry() is the durable equivalent if a Lovable sync ever
-- reverts this trigger (TS interface is the source of truth per the BYO plan).
CREATE OR REPLACE FUNCTION public.studio_changeset_to_changelog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'merged'
     AND NEW.release_notes IS NOT NULL
     AND btrim(NEW.release_notes) <> '' THEN
    INSERT INTO public.changelog_entries
      (user_id, workspace_id, product_id, changeset_id, prd_id, title, body, pr_number, pr_url, published_at)
    VALUES (
      NEW.user_id, NEW.workspace_id, NEW.product_id, NEW.id, NEW.prd_id,
      COALESCE(NULLIF(btrim(NEW.title), ''), 'Shipped an update'),
      btrim(NEW.release_notes),
      NEW.pr_number, NEW.pr_url,
      COALESCE(NEW.release_notes_at, now())
    )
    ON CONFLICT (changeset_id) DO UPDATE
      SET title = EXCLUDED.title,
          body = EXCLUDED.body,
          pr_number = EXCLUDED.pr_number,
          pr_url = EXCLUDED.pr_url,
          prd_id = COALESCE(EXCLUDED.prd_id, public.changelog_entries.prd_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_studio_changeset_to_changelog ON public.studio_changesets;
CREATE TRIGGER trg_studio_changeset_to_changelog
  AFTER INSERT OR UPDATE OF status, release_notes ON public.studio_changesets
  FOR EACH ROW EXECUTE FUNCTION public.studio_changeset_to_changelog();

-- Backfill changelog entries for changesets already merged before this trigger.
INSERT INTO public.changelog_entries
  (user_id, workspace_id, product_id, changeset_id, prd_id, title, body, pr_number, pr_url, published_at)
SELECT user_id, workspace_id, product_id, id, prd_id,
       COALESCE(NULLIF(btrim(title), ''), 'Shipped an update'),
       btrim(release_notes), pr_number, pr_url, COALESCE(release_notes_at, now())
FROM public.studio_changesets
WHERE status = 'merged'
  AND release_notes IS NOT NULL
  AND btrim(release_notes) <> ''
ON CONFLICT (changeset_id) DO NOTHING;
