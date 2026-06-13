-- v6 Phase 3 — KI-17: harden the prototype /p/$slug public-share surface.
--
-- WHY: the prototype share surface predates and shares the exact anon-leak pattern
-- the viral-loop (decisions) fix closed in 20260614170000. `prototypes` and
-- `prototype_files` each granted anon a TABLE-WIDE SELECT (20260602204826:359/374)
-- and their public-read policies have NO `TO anon` scope. Consequences:
--   (1) anon could read owner `user_id` / `prd_id` / `project_id` of any public
--       prototype (and `user_id` of its files) via a DIRECT PostgREST select with
--       the bundled anon key — RLS gates rows, GRANT gates columns;
--   (2) the unscoped policies ORed into AUTHENTICATED reads, so an authenticated
--       user's prototypes query saw other tenants' public prototypes (cross-tenant).
-- (Neither table is in the supabase_realtime publication, so no Realtime drop is
-- needed — unlike decisions.) No app change: /p/$slug already selects only the safe
-- columns (prototypes: id/name/entry_path/is_public + share_slug filter;
-- prototype_files: path/content/language + prototype_id filter).

-- (1) COLUMN-scoped anon grants — only what /p/$slug needs; never user_id / *_id.
REVOKE SELECT ON public.prototypes FROM anon;
GRANT SELECT (id, share_slug, name, description, entry_path, is_public)
  ON public.prototypes TO anon;

REVOKE SELECT ON public.prototype_files FROM anon;
GRANT SELECT (prototype_id, path, content, language)
  ON public.prototype_files TO anon;

-- (2) Scope the public-read policies TO anon so they can't widen authenticated reads.
-- The files policy's EXISTS subquery still works: anon is granted prototypes.id +
-- prototypes.is_public, which is all the subquery reads.
DROP POLICY IF EXISTS "public prototypes readable" ON public.prototypes;
CREATE POLICY "public prototypes readable" ON public.prototypes
  FOR SELECT TO anon USING (is_public = true);

DROP POLICY IF EXISTS "public prototype_files readable" ON public.prototype_files;
CREATE POLICY "public prototype_files readable" ON public.prototype_files
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.prototypes p WHERE p.id = prototype_id AND p.is_public = true)
  );
