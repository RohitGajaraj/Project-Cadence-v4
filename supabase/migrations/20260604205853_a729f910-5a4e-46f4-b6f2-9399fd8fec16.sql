-- Tighten RLS: re-scope all public-schema policies currently granted to the
-- PUBLIC role so they apply only to AUTHENTICATED. The USING/WITH CHECK
-- expressions already gate by auth.uid()/workspace membership, but applying
-- policies to `public` lets anonymous sessions evaluate them. This is a
-- defense-in-depth fix flagged by the security scanner across many tables
-- (calendar_events, meetings, user_api_keys, user_integrations, and ~45 more).

DO $$
DECLARE
  r record;
  cmd_kw text;
  using_clause text;
  check_clause text;
  sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY(roles)
  LOOP
    CASE r.cmd
      WHEN 'ALL'    THEN cmd_kw := 'ALL';
      WHEN 'SELECT' THEN cmd_kw := 'SELECT';
      WHEN 'INSERT' THEN cmd_kw := 'INSERT';
      WHEN 'UPDATE' THEN cmd_kw := 'UPDATE';
      WHEN 'DELETE' THEN cmd_kw := 'DELETE';
      ELSE cmd_kw := 'ALL';
    END CASE;

    using_clause := CASE WHEN r.qual IS NOT NULL THEN ' USING (' || r.qual || ')' ELSE '' END;
    check_clause := CASE WHEN r.with_check IS NOT NULL THEN ' WITH CHECK (' || r.with_check || ')' ELSE '' END;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    sql := format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO authenticated%s%s',
      r.policyname, r.schemaname, r.tablename, cmd_kw, using_clause, check_clause
    );
    EXECUTE sql;
  END LOOP;
END $$;