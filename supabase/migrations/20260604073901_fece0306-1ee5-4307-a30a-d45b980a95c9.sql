REVOKE EXECUTE ON FUNCTION public.ensure_user_default_workspace(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_default_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_default_workspace(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_default_workspace() TO authenticated, service_role;