
-- ============ event_subscriptions ============
CREATE TABLE public.event_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('signal.created','opportunity.scored','prd.approved')),
  target_agent_slug text NOT NULL,
  approval_mode text NOT NULL DEFAULT 'confirm' CHECK (approval_mode IN ('auto','confirm')),
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_subscriptions_lookup_idx
  ON public.event_subscriptions (workspace_id, event_type) WHERE enabled;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_subscriptions TO authenticated;
GRANT ALL ON public.event_subscriptions TO service_role;
ALTER TABLE public.event_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_subscriptions ws read" ON public.event_subscriptions
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "event_subscriptions ws write" ON public.event_subscriptions
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id) AND user_id = auth.uid())
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_event_subscriptions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER event_subscriptions_touch
  BEFORE UPDATE ON public.event_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_event_subscriptions_updated_at();

-- ============ event_queue ============
CREATE TABLE public.event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.event_subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatched','skipped','failed')),
  approval_mode text NOT NULL CHECK (approval_mode IN ('auto','confirm')),
  target_agent_slug text NOT NULL,
  mission_id uuid,
  run_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  decided_at timestamptz,
  CONSTRAINT event_queue_dedup UNIQUE (subscription_id, source_id)
);
CREATE INDEX event_queue_pending_idx
  ON public.event_queue (status, created_at) WHERE status = 'pending';
CREATE INDEX event_queue_workspace_idx
  ON public.event_queue (workspace_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_queue TO authenticated;
GRANT ALL ON public.event_queue TO service_role;
ALTER TABLE public.event_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_queue ws read" ON public.event_queue
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "event_queue user decide" ON public.event_queue
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id) AND user_id = auth.uid())
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

-- ============ Trigger fan-out helpers ============
-- All three triggers run as SECURITY DEFINER so they can write event_queue
-- across RLS even when the originating insert came from the user role.
CREATE OR REPLACE FUNCTION public.reactor_fanout_signal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_queue
    (user_id, workspace_id, subscription_id, event_type, source_table, source_id, payload, approval_mode, target_agent_slug)
  SELECT
    NEW.user_id, NEW.workspace_id, s.id, 'signal.created', 'signals', NEW.id,
    jsonb_build_object('title', NEW.title, 'source', NEW.source, 'content', LEFT(COALESCE(NEW.content,''), 600)),
    s.approval_mode, s.target_agent_slug
  FROM public.event_subscriptions s
  WHERE s.enabled
    AND s.event_type = 'signal.created'
    AND s.workspace_id = NEW.workspace_id
  ON CONFLICT ON CONSTRAINT event_queue_dedup DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reactor_fanout_opportunity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  min_score numeric;
BEGIN
  -- Only fire on inserts or when ICE inputs change
  IF TG_OP = 'UPDATE' AND
     (OLD.impact, OLD.confidence, OLD.ease) IS NOT DISTINCT FROM (NEW.impact, NEW.confidence, NEW.ease) THEN
    RETURN NEW;
  END IF;
  FOR min_score IN
    SELECT COALESCE((s.filter->>'min_score')::numeric, 8.0)
    FROM public.event_subscriptions s
    WHERE s.enabled
      AND s.event_type = 'opportunity.scored'
      AND s.workspace_id = NEW.workspace_id
  LOOP
    NULL; -- loop body unused; computed inline below
  END LOOP;
  INSERT INTO public.event_queue
    (user_id, workspace_id, subscription_id, event_type, source_table, source_id, payload, approval_mode, target_agent_slug)
  SELECT
    NEW.user_id, NEW.workspace_id, s.id, 'opportunity.scored', 'opportunities', NEW.id,
    jsonb_build_object('title', NEW.title, 'problem', LEFT(COALESCE(NEW.problem,''), 600),
                       'ice_score', NEW.ice_score, 'impact', NEW.impact,
                       'confidence', NEW.confidence, 'ease', NEW.ease),
    s.approval_mode, s.target_agent_slug
  FROM public.event_subscriptions s
  WHERE s.enabled
    AND s.event_type = 'opportunity.scored'
    AND s.workspace_id = NEW.workspace_id
    AND NEW.ice_score IS NOT NULL
    AND NEW.ice_score >= COALESCE((s.filter->>'min_score')::numeric, 8.0)
  ON CONFLICT ON CONSTRAINT event_queue_dedup DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reactor_fanout_prd_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;
  INSERT INTO public.event_queue
    (user_id, workspace_id, subscription_id, event_type, source_table, source_id, payload, approval_mode, target_agent_slug)
  SELECT
    NEW.user_id, NEW.workspace_id, s.id, 'prd.approved', 'prds', NEW.id,
    jsonb_build_object('title', NEW.title, 'github_issue_url', NEW.github_issue_url),
    s.approval_mode, s.target_agent_slug
  FROM public.event_subscriptions s
  WHERE s.enabled
    AND s.event_type = 'prd.approved'
    AND s.workspace_id = NEW.workspace_id
  ON CONFLICT ON CONSTRAINT event_queue_dedup DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER signals_reactor_fanout
  AFTER INSERT ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.reactor_fanout_signal();

CREATE TRIGGER opportunities_reactor_fanout
  AFTER INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.reactor_fanout_opportunity();

CREATE TRIGGER prds_reactor_fanout
  AFTER INSERT OR UPDATE ON public.prds
  FOR EACH ROW EXECUTE FUNCTION public.reactor_fanout_prd_approved();

REVOKE EXECUTE ON FUNCTION public.reactor_fanout_signal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactor_fanout_opportunity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactor_fanout_prd_approved() FROM PUBLIC, anon, authenticated;

-- ============ Default subscription seed ============
CREATE OR REPLACE FUNCTION public.seed_default_event_subscriptions(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id uuid;
BEGIN
  -- Seed in every workspace the user owns
  FOR ws_id IN
    SELECT id FROM public.workspaces WHERE owner_id = p_user_id
  LOOP
    INSERT INTO public.event_subscriptions
      (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'signal.created', 'discovery', 'auto', '{}'::jsonb, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_subscriptions
      WHERE workspace_id = ws_id AND event_type = 'signal.created' AND is_default
    );

    INSERT INTO public.event_subscriptions
      (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'opportunity.scored', 'strategist', 'confirm',
           jsonb_build_object('min_score', 8.0), true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_subscriptions
      WHERE workspace_id = ws_id AND event_type = 'opportunity.scored' AND is_default
    );

    INSERT INTO public.event_subscriptions
      (user_id, workspace_id, event_type, target_agent_slug, approval_mode, filter, is_default)
    SELECT p_user_id, ws_id, 'prd.approved', 'orchestrator', 'confirm', '{}'::jsonb, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_subscriptions
      WHERE workspace_id = ws_id AND event_type = 'prd.approved' AND is_default
    );
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_default_event_subscriptions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_event_subscriptions(uuid) TO authenticated, service_role;

-- Patch handle_new_user to also seed reactor defaults for new accounts.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_demo boolean := COALESCE(NEW.email LIKE 'demo%@redcadence.app', false);
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  IF NOT is_demo THEN
    PERFORM public.ensure_default_workspace(NEW.id);
  END IF;

  PERFORM public.seed_default_agent_tools(NEW.id);
  PERFORM public.seed_default_event_subscriptions(NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill subscriptions for every existing user that has a workspace.
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT DISTINCT owner_id AS id FROM public.workspaces WHERE owner_id IS NOT NULL LOOP
    PERFORM public.seed_default_event_subscriptions(u.id);
  END LOOP;
END $$;
