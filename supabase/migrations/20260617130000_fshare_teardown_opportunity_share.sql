-- F-SHARE-TEARDOWN — make a WEDGE Critic-teardown publicly shareable (the viral loop).
--
-- WHY: the teardown is Cadence's sharpest brand artifact ("here is the feature I
-- believed in, here is the honest red-team — risks, what would kill it, what I
-- cannot prove yet"). A public /t/<share_slug> link carries that reasoning, and the
-- "Made with Cadence" mark, to wherever a PM posts it. This mirrors the shipped
-- shareable-decision rails (20260614170000_p3_decisions_share.sql) onto the
-- `opportunities` table, where the wedge already persists its verdict in
-- `critic_review` (jsonb). No new AI infra.
--
-- SECURITY — opportunities becomes an anonymous-read surface, so every gate is at
-- the DATABASE WIRE, not in app code (the anon publishable key ships in the browser
-- bundle; an app-side select is convenience/typing only, NOT a boundary). Three
-- DB-enforced gates, identical in shape to the decisions migration:
--   1. COLUMN-level grant — anon may SELECT ONLY the safe columns (title +
--      critic_review + created_at + the share fields). user_id / workspace_id /
--      project_id / theme_id / problem / target_user / hypothesis / ICE are never
--      granted, so a direct `?select=user_id` REST probe returns "permission denied".
--      critic_review is the AI's red-team of the idea — it carries no PII.
--   2. RLS policy scoped TO anon — anon reads ONLY is_public rows; scoping to the
--      anon role keeps it from OR-ing into authenticated opportunity reads (an
--      unscoped policy would leak other tenants' public opps into the app).
--   3. Realtime OUT — opportunities is removed from the supabase_realtime
--      publication (Realtime broadcasts full WAL rows, ignoring column grants). The
--      app subscribes to nothing over Realtime (verified), so this is pure hardening.
-- Default is private (is_public = false).

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS share_slug text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_public  boolean NOT NULL DEFAULT false;

-- Backfill a unique slug for existing rows; new rows get the same from the default.
-- share_slug is the ONLY credential for anonymous read (a public capability URL), so it
-- MUST be unguessable. Use a CSPRNG — gen_random_uuid() (~122-bit, core in PG13+)
-- rendered as 32-char hex — NOT md5(random()) (a seedable, predictable PRNG).
-- gen_random_uuid() is volatile → evaluated per row, so the backfill is collision-free;
-- the unique index below is the backstop.
UPDATE public.opportunities
   SET share_slug = replace(gen_random_uuid()::text, '-', '')
 WHERE share_slug IS NULL;
ALTER TABLE public.opportunities ALTER COLUMN share_slug SET DEFAULT replace(gen_random_uuid()::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_share_slug_key ON public.opportunities (share_slug);

-- (1) COLUMN-scoped anon grant — NEVER a table-wide grant (that would let anon read
-- user_id / workspace_id / *_id of public rows via a direct PostgREST select). The
-- REVOKE first ensures no table-wide SELECT lingers.
REVOKE SELECT ON public.opportunities FROM anon;
GRANT SELECT (share_slug, title, critic_review, created_at, is_public)
  ON public.opportunities TO anon;

-- (2) RLS: anon reads ONLY is_public rows. Scoped TO anon so it cannot widen
-- authenticated reads; the owner policies are unchanged.
DROP POLICY IF EXISTS "public teardowns readable" ON public.opportunities;
CREATE POLICY "public teardowns readable" ON public.opportunities
  FOR SELECT TO anon USING (is_public = true);

-- (3) Realtime broadcasts full rows ignoring column grants — drop opportunities from
-- the publication (no client subscribes to it). Mirrors the decisions/agent_runs hardening.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'opportunities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.opportunities';
  END IF;
END $$;
