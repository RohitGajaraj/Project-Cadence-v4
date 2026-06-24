-- EVENT-REACTOR-LIVE (v11 #1) — widen the event reactor's vocabulary to the ambient-loop
-- event types, and fan them out into the existing event_queue exactly like the original
-- signal.created / opportunity.scored / prd.approved triggers.
--
-- The reactor (20260606150319) shipped 3 event types. The ambient self-initiating loop also
-- produces three more first-class events whose source tables already exist:
--   signal.clustered  -> a new theme is formed from signals      (source: public.themes)
--   outcome.recorded  -> a decision's real outcome is recorded   (source: public.learnings)
--   decision.made     -> a decision is recorded                  (source: public.decisions)
-- This migration lets a workspace SUBSCRIBE to those events (the CHECK rejected them before)
-- and fans each one into event_queue for matching enabled subscriptions.
--
-- ADDITIVE + DORMANT-SAFE: like the original triggers, each fan-out only inserts WHERE an
-- enabled subscription for that event_type exists. The default seed creates NO subscriptions
-- for these new types, so until a user/founder adds one, the triggers are pure no-ops (a cheap
-- indexed SELECT that returns zero rows) — no behavior change, and no overlap with the ambient
-- trigger-tick's own self-initiation path.
--
-- drift.detected is intentionally NOT wired here: public.drift_snapshots is a per-surface/per-day
-- METRICS rollup with no workspace_id column and no discrete "drift crossed a threshold" event, so
-- a fan-out on its INSERT would fire on every metrics row and could not populate event_queue's
-- NOT NULL workspace_id. It needs a designed, workspace-scoped drift-event source first.

-- ── 1. Widen the subscribable event_type vocabulary ──────────────────────────
ALTER TABLE public.event_subscriptions DROP CONSTRAINT event_subscriptions_event_type_check;
ALTER TABLE public.event_subscriptions ADD CONSTRAINT event_subscriptions_event_type_check
  CHECK (event_type IN (
    'signal.created', 'opportunity.scored', 'prd.approved',
    'signal.clustered', 'outcome.recorded', 'decision.made'
  ));

-- ── 2. Fan-out helpers (SECURITY DEFINER, mirror the original pattern) ────────
CREATE OR REPLACE FUNCTION public.reactor_fanout_theme_clustered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_queue
    (user_id, workspace_id, subscription_id, event_type, source_table, source_id, payload, approval_mode, target_agent_slug)
  SELECT
    NEW.user_id, NEW.workspace_id, s.id, 'signal.clustered', 'themes', NEW.id,
    jsonb_build_object('title', NEW.title, 'summary', LEFT(COALESCE(NEW.summary,''), 600),
                       'severity', NEW.severity, 'frequency', NEW.frequency),
    s.approval_mode, s.target_agent_slug
  FROM public.event_subscriptions s
  WHERE s.enabled
    AND s.event_type = 'signal.clustered'
    AND s.workspace_id = NEW.workspace_id
  ON CONFLICT ON CONSTRAINT event_queue_dedup DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reactor_fanout_outcome_recorded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_queue
    (user_id, workspace_id, subscription_id, event_type, source_table, source_id, payload, approval_mode, target_agent_slug)
  SELECT
    NEW.user_id, NEW.workspace_id, s.id, 'outcome.recorded', 'learnings', NEW.id,
    jsonb_build_object('verdict', NEW.verdict, 'summary', LEFT(COALESCE(NEW.summary,''), 600),
                       'prior_ice', NEW.prior_ice, 'new_ice', NEW.new_ice,
                       'metric_label', NEW.metric_label, 'metric_value', NEW.metric_value),
    s.approval_mode, s.target_agent_slug
  FROM public.event_subscriptions s
  WHERE s.enabled
    AND s.event_type = 'outcome.recorded'
    AND s.workspace_id = NEW.workspace_id
  ON CONFLICT ON CONSTRAINT event_queue_dedup DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reactor_fanout_decision_made()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_queue
    (user_id, workspace_id, subscription_id, event_type, source_table, source_id, payload, approval_mode, target_agent_slug)
  SELECT
    NEW.user_id, NEW.workspace_id, s.id, 'decision.made', 'decisions', NEW.id,
    jsonb_build_object('title', NEW.title, 'rationale', LEFT(COALESCE(NEW.rationale,''), 600),
                       'status', NEW.status, 'source_kind', NEW.source_kind),
    s.approval_mode, s.target_agent_slug
  FROM public.event_subscriptions s
  WHERE s.enabled
    AND s.event_type = 'decision.made'
    AND s.workspace_id = NEW.workspace_id
  ON CONFLICT ON CONSTRAINT event_queue_dedup DO NOTHING;
  RETURN NEW;
END $$;

-- ── 3. Attach the triggers (idempotent) ──────────────────────────────────────
DROP TRIGGER IF EXISTS themes_reactor_fanout ON public.themes;
CREATE TRIGGER themes_reactor_fanout
  AFTER INSERT ON public.themes
  FOR EACH ROW EXECUTE FUNCTION public.reactor_fanout_theme_clustered();

DROP TRIGGER IF EXISTS learnings_reactor_fanout ON public.learnings;
CREATE TRIGGER learnings_reactor_fanout
  AFTER INSERT ON public.learnings
  FOR EACH ROW EXECUTE FUNCTION public.reactor_fanout_outcome_recorded();

DROP TRIGGER IF EXISTS decisions_reactor_fanout ON public.decisions;
CREATE TRIGGER decisions_reactor_fanout
  AFTER INSERT ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.reactor_fanout_decision_made();

-- ── 4. Lock down the helpers (same posture as the original three) ─────────────
REVOKE EXECUTE ON FUNCTION public.reactor_fanout_theme_clustered() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactor_fanout_outcome_recorded() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactor_fanout_decision_made() FROM PUBLIC, anon, authenticated;
