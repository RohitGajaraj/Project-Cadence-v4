-- H2 · Outcome roadmap (Now/Next/Later).
--
-- Each opportunity can be COMMITTED to a Now/Next/Later bucket with a declared
-- outcome and a measure. This is the outcome / commitment layer over the
-- agent-ranked opportunities, NOT the manual task/sprint kanban that v6 deleted:
-- the human chooses the bucket, and the agent's continuous ICE ranking orders
-- within it. Read/write rides the existing "own opportunities all" RLS policy
-- (FOR ALL on user_id), so the new columns are already user-scoped.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS; the CHECK is dropped-then-added).

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS roadmap_bucket text,
  ADD COLUMN IF NOT EXISTS roadmap_outcome text,
  ADD COLUMN IF NOT EXISTS roadmap_measure text;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_roadmap_bucket_check;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_roadmap_bucket_check
  CHECK (roadmap_bucket IS NULL OR roadmap_bucket IN ('now', 'next', 'later'));

-- Index the committed items (the common read: roadmap board for a user).
CREATE INDEX IF NOT EXISTS opportunities_roadmap_idx
  ON public.opportunities (user_id, roadmap_bucket)
  WHERE roadmap_bucket IS NOT NULL;
