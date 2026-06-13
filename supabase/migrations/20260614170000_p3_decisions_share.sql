-- v6 Phase 3 ("Proof & Launch") — the shareable-decision viral loop.
--
-- WHY: §7's growth loop — a PM can make a single decision public and share it at
-- /d/<share_slug> (the viral payload), carrying a "Made with Cadence" mark.
-- Mirrors the prototype-share pattern (share_slug / is_public + the /p/$slug route).
--
-- SECURITY — this is the app's FIRST anonymous-read surface, so every gate is at
-- the DATABASE WIRE, not in app code. The anon publishable key ships in the
-- browser bundle, so anyone can call PostgREST directly; an app-side field
-- allow-list (getPublicDecision's select) is convenience/typing only, NOT a
-- boundary. Three DB-enforced gates:
--   1. COLUMN-level grant — anon may SELECT ONLY the safe columns; user_id /
--      workspace_id / project_id / *_id are never granted, so a direct
--      `?select=user_id` REST probe returns "permission denied for column".
--   2. RLS policy scoped TO anon — anon reads ONLY is_public rows; scoping to the
--      anon role keeps it from OR-ing into authenticated listDecisions (an
--      unscoped policy would leak other tenants' public decisions into the app).
--   3. Realtime OUT — decisions is removed from the supabase_realtime publication
--      (Realtime broadcasts full WAL rows, ignoring column grants); no client
--      subscribes to it, so this is pure hardening (mirrors the agent_runs fix).
-- Default is private (is_public = false).

ALTER TABLE public.decisions ADD COLUMN IF NOT EXISTS share_slug text;
ALTER TABLE public.decisions ADD COLUMN IF NOT EXISTS is_public  boolean NOT NULL DEFAULT false;

-- Backfill a unique slug for existing rows; new rows get the same from the default.
-- share_slug is the ONLY credential for anonymous read (a public capability URL), so it
-- MUST be unguessable. Use a CSPRNG — gen_random_uuid() (~122-bit, core in PG13+, no
-- pgcrypto dependency) rendered as 32-char URL-safe hex — NOT md5(random()): random() is
-- a seedable PRNG (predictable), and a 16-hex md5(random()) is bounded by one PRNG draw
-- (~64-bit). gen_random_uuid() is volatile → evaluated per row, so the backfill is
-- collision-free; the unique index below is the backstop (122-bit collisions never happen).
UPDATE public.decisions
   SET share_slug = replace(gen_random_uuid()::text, '-', '')
 WHERE share_slug IS NULL;
ALTER TABLE public.decisions ALTER COLUMN share_slug SET DEFAULT replace(gen_random_uuid()::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS decisions_share_slug_key ON public.decisions (share_slug);

-- (1) COLUMN-scoped anon grant — NEVER a table-wide grant (that would let anon read
-- user_id / workspace_id / *_id of public rows via a direct PostgREST select). The
-- REVOKE first ensures no table-wide SELECT lingers.
REVOKE SELECT ON public.decisions FROM anon;
GRANT SELECT (share_slug, title, rationale, status, decided_by_agent_slug, created_at, is_public)
  ON public.decisions TO anon;

-- (2) RLS: anon reads ONLY is_public rows. Scoped TO anon so it cannot widen
-- authenticated reads; the owner policy "own decisions all" is unchanged.
DROP POLICY IF EXISTS "public decisions readable" ON public.decisions;
CREATE POLICY "public decisions readable" ON public.decisions
  FOR SELECT TO anon USING (is_public = true);

-- (3) Realtime broadcasts full rows ignoring column grants — drop decisions from
-- the publication (no client subscribes to it). Mirrors the agent_runs hardening.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'decisions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.decisions';
  END IF;
END $$;
