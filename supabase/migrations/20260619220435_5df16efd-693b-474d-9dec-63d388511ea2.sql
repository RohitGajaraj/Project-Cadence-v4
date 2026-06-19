
-- Harden Stripe billing columns: only service_role can read
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.accounts FROM authenticated, anon;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.workspaces FROM authenticated, anon;

-- Harden workspace invitation tokens: token column not readable by clients.
-- Inviters get the token only at creation via the new SECURITY DEFINER RPC below.
-- The SECURITY DEFINER accept_workspace_invitation RPC continues to redeem by token.
REVOKE SELECT (token) ON public.workspace_invitations FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.create_workspace_invitation(
  _workspace_id uuid,
  _email text,
  _role text DEFAULT 'member'
) RETURNS TABLE(id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; v_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;
  IF NOT public.has_workspace_role(_workspace_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Only workspace owners or admins can invite members.';
  END IF;
  IF _role NOT IN ('admin','member','viewer') THEN
    RAISE EXCEPTION 'Invalid role.';
  END IF;
  INSERT INTO public.workspace_invitations (workspace_id, email, role, invited_by)
  VALUES (_workspace_id, _email, _role, auth.uid())
  RETURNING workspace_invitations.id, workspace_invitations.token
  INTO v_id, v_token;
  RETURN QUERY SELECT v_id, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_invitation(uuid, text, text) TO authenticated;

-- Purge legacy plaintext API keys; allow nulls going forward (encrypted columns are the source of truth)
ALTER TABLE public.user_api_keys ALTER COLUMN api_key DROP NOT NULL;
UPDATE public.user_api_keys SET api_key = NULL WHERE api_key IS NOT NULL;
