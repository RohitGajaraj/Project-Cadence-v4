-- K1: release notes for a shipped changeset.
--
-- The Studio agent ships a changeset (gated PR -> CI-gated merge); release notes
-- are a factual summary of WHAT shipped, generated from the changeset's files +
-- commit revisions + linked work order via the AI chokepoint and persisted here
-- so they are operator-reviewable and do not regenerate on every view. Deploy
-- itself stays external (Lovable -> Cloudflare); this is the human-readable
-- ship artifact, not a deploy trigger. Additive columns only.

ALTER TABLE public.studio_changesets ADD COLUMN IF NOT EXISTS release_notes text;
ALTER TABLE public.studio_changesets ADD COLUMN IF NOT EXISTS release_notes_at timestamptz;
