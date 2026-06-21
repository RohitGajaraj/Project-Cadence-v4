REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.accounts FROM anon, authenticated;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.subscriptions FROM anon, authenticated;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.workspaces FROM anon, authenticated;
GRANT SELECT ON public.accounts TO service_role;
GRANT SELECT ON public.subscriptions TO service_role;
GRANT SELECT ON public.workspaces TO service_role;