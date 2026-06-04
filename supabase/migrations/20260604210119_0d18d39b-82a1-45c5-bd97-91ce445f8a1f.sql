
REVOKE EXECUTE ON FUNCTION public.seed_default_agent_tools(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_agents(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_guardrails(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_prompt_templates(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_workspace(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_pm_lifecycle_tools(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_mission_on_message() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_user_default_workspace(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.halt_agent_run(uuid, text) FROM anon, authenticated;
