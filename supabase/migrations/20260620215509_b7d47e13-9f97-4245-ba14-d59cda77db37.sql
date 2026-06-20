
-- Admin: list users, grant credits, and CRUD pricing_plans (so admins can add a new tier without a code deploy).
-- All RPCs gate on has_role(auth.uid(),'admin').

-- ─── 1) Single recommended invariant on pricing_plans ───
CREATE OR REPLACE FUNCTION public._enforce_single_recommended_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.recommended = true THEN
    UPDATE public.pricing_plans SET recommended = false
     WHERE tier <> NEW.tier AND recommended = true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_single_recommended_plan ON public.pricing_plans;
CREATE TRIGGER trg_single_recommended_plan
AFTER INSERT OR UPDATE OF recommended ON public.pricing_plans
FOR EACH ROW WHEN (NEW.recommended = true)
EXECUTE FUNCTION public._enforce_single_recommended_plan();

-- ─── 2) Admin RPC: list users ───
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT NULL, _limit int DEFAULT 200)
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  is_admin boolean,
  primary_account_id uuid,
  plan_tier text,
  balance_credits bigint,
  topup_credits bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  RETURN QUERY
  WITH primary_acct AS (
    SELECT DISTINCT ON (m.user_id)
      m.user_id, m.account_id
    FROM public.account_members m
    ORDER BY m.user_id, m.role = 'owner' DESC, m.created_at ASC
  )
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin,
    pa.account_id AS primary_account_id,
    COALESCE(a.plan_tier, 'free') AS plan_tier,
    COALESCE(c.balance_credits, 0) AS balance_credits,
    COALESCE(c.topup_credits, 0) AS topup_credits
  FROM auth.users u
  LEFT JOIN primary_acct pa ON pa.user_id = u.id
  LEFT JOIN public.accounts a ON a.id = pa.account_id
  LEFT JOIN public.account_credits c ON c.account_id = pa.account_id
  WHERE _search IS NULL
     OR u.email ILIKE '%' || _search || '%'
  ORDER BY u.created_at DESC
  LIMIT _limit;
END $$;

-- ─── 3) Admin RPC: grant credits to a user's primary account ───
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  _user_id uuid,
  _credits bigint,
  _reason text DEFAULT 'admin_grant'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _account_id uuid;
  _new_balance bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  IF _credits IS NULL OR _credits = 0 THEN
    RAISE EXCEPTION 'credits must be non-zero';
  END IF;

  -- Pick primary account (owner first, else earliest membership).
  SELECT account_id INTO _account_id
  FROM public.account_members
  WHERE user_id = _user_id
  ORDER BY role = 'owner' DESC, created_at ASC
  LIMIT 1;

  IF _account_id IS NULL THEN
    RAISE EXCEPTION 'user has no account';
  END IF;

  -- Ensure account_credits row exists.
  INSERT INTO public.account_credits (account_id, balance_credits, monthly_grant_credits, topup_credits, cycle_anchor)
  VALUES (_account_id, 0, 0, 0, now())
  ON CONFLICT (account_id) DO NOTHING;

  UPDATE public.account_credits
     SET balance_credits = balance_credits + _credits,
         topup_credits = GREATEST(0, topup_credits + _credits),
         updated_at = now()
   WHERE account_id = _account_id
   RETURNING balance_credits INTO _new_balance;

  INSERT INTO public.credit_ledger (account_id, user_id, delta_credits, reason, surface)
  VALUES (_account_id, _user_id, _credits, _reason, 'admin');

  RETURN jsonb_build_object(
    'account_id', _account_id,
    'new_balance', _new_balance
  );
END $$;

-- ─── 4) Admin RPC: upsert / delete pricing_plans ───
CREATE OR REPLACE FUNCTION public.admin_upsert_plan(
  _tier text,
  _display_name text,
  _tagline text DEFAULT NULL,
  _audience text DEFAULT 'general',
  _sort_order int DEFAULT 50,
  _recommended boolean DEFAULT false,
  _active boolean DEFAULT true
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  INSERT INTO public.pricing_plans (tier, display_name, tagline, audience, sort_order, recommended, active)
  VALUES (_tier, _display_name, _tagline, _audience, _sort_order, _recommended, _active)
  ON CONFLICT (tier) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        tagline = EXCLUDED.tagline,
        audience = EXCLUDED.audience,
        sort_order = EXCLUDED.sort_order,
        recommended = EXCLUDED.recommended,
        active = EXCLUDED.active,
        updated_at = now();

  RETURN _tier;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_plan(_tier text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pricing_bundles WHERE tier = _tier) THEN
    RAISE EXCEPTION 'cannot delete plan with existing bundles';
  END IF;
  DELETE FROM public.pricing_plans WHERE tier = _tier;
END $$;

-- ─── 5) Grants ───
REVOKE ALL ON FUNCTION public.admin_list_users(text, int) FROM public;
REVOKE ALL ON FUNCTION public.admin_grant_credits(uuid, bigint, text) FROM public;
REVOKE ALL ON FUNCTION public.admin_upsert_plan(text, text, text, text, int, boolean, boolean) FROM public;
REVOKE ALL ON FUNCTION public.admin_delete_plan(text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_credits(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_plan(text, text, text, text, int, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_plan(text) TO authenticated;
