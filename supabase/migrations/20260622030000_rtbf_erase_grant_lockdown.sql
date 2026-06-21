-- DATA-RETENTION-b security: lock the right-to-be-forgotten hard-delete RPCs to service_role.
--
-- Found by a live prod grant audit (2026-06-22, lane 2): `forget_account(_account_id)` and
-- `forget_workspace(_workspace_id)` — SECURITY DEFINER functions that HARD-DELETE all of an
-- account's / workspace's tenant data — were EXECUTABLE by anon/authenticated. They are a
-- service-role-only compliance operation (driven by the `src/lib/compliance/erasure.ts` layer
-- on a verified erasure request), never a client-direct call. They are flag-gated dormant today
-- (`right_to_erasure_enabled()` = false, so they raise + no-op while disabled), so there was no
-- live exposure — but the moment RTBF is activated they would be anon-callable data destruction
-- (a client could `POST /rest/v1/rpc/forget_workspace` and nuke a workspace). Lock them now.
--
-- (`purge_old_telemetry` was already correctly anon/auth-denied; no change needed there.)
-- Prod fix applied directly via the Lovable DB the same session; this keeps repo source in
-- lockstep. Idempotent + forward-only.

revoke execute on function public.forget_account(uuid)   from public, anon, authenticated;
grant  execute on function public.forget_account(uuid)   to service_role;

revoke execute on function public.forget_workspace(uuid) from public, anon, authenticated;
grant  execute on function public.forget_workspace(uuid) to service_role;
