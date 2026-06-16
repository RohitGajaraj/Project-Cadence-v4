-- M-C: plan tier + billing identifiers on workspaces (the entitlements foundation).
--
-- v7 section 9 pricing: free (decision memory expires), pro (~$39/mo, persistent
-- memory + Critic everywhere + share links), team (outcome-anchored, a hypothesis).
-- This migration only adds the plan-state columns and protects them from client
-- writes. The plan->capability logic lives in src/lib/entitlements.ts; the plan is
-- changed ONLY by the Stripe webhook (service-role) via the billing surface.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz;

-- Guard the tier values. Wrapped in a DO block so re-runs do not error if present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_plan_tier_check'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_plan_tier_check
      CHECK (plan_tier IN ('free', 'pro', 'team'));
  END IF;
END $$;

-- The plan and its billing ids are set ONLY by billing (service-role). This trigger
-- closes both client write paths so the paywall can never be self-granted:
--   UPDATE: a member/owner editing the row (rename, etc.) keeps the prior billing
--           values; a PATCH that sets plan_tier='pro' is silently ignored.
--   INSERT: a client creating a workspace it owns cannot start it on a paid plan;
--           the new row is forced to free with no billing ids (the "ws owner manage"
--           RLS policy is FOR ALL, so INSERT must be guarded too, not just UPDATE).
CREATE OR REPLACE FUNCTION public.protect_workspace_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan_tier := 'free';
      NEW.stripe_customer_id := NULL;
      NEW.stripe_subscription_id := NULL;
      NEW.plan_updated_at := NULL;
    ELSE
      NEW.plan_tier := OLD.plan_tier;
      NEW.stripe_customer_id := OLD.stripe_customer_id;
      NEW.stripe_subscription_id := OLD.stripe_subscription_id;
      NEW.plan_updated_at := OLD.plan_updated_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_workspace_billing_columns ON public.workspaces;
CREATE TRIGGER trg_protect_workspace_billing_columns
  BEFORE INSERT OR UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_workspace_billing_columns();
