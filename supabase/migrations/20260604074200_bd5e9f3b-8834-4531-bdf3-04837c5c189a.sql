REVOKE EXECUTE ON FUNCTION public.ensure_user_default_workspace(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_default_workspace(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_default_workspace() TO authenticated, service_role;