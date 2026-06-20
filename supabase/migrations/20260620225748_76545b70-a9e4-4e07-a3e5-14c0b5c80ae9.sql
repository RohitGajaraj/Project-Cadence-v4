REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.accounts FROM anon, authenticated;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.workspaces FROM anon, authenticated;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.subscriptions FROM anon, authenticated;