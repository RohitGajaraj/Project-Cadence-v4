-- Defense-in-depth: explicitly deny authenticated access to NULL-user rows.
-- Background jobs insert these via service-role (which bypasses RLS).
-- Without this, a future permissive policy could accidentally expose them.
CREATE POLICY "deny null user rows to authenticated"
  ON public.idempotency_keys
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);