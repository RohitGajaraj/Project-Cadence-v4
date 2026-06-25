-- Combined application of 4 pending Git migrations: 20260624030000, 20260624040000, 20260624050000, 20260625000000
DO $$
DECLARE
  demo_email text;
  v_user     uuid;
  v_ws       uuid;
  v_opp_old  uuid;
  v_opp_new  uuid;
  v_dec_old  uuid;
  v_dec_gov  uuid;
  v_l_miss   uuid;
BEGIN
  FOREACH demo_email IN ARRAY ARRAY['demo@redcadence.app', 'demo2@redcadence.app'] LOOP
    SELECT id INTO v_user FROM auth.users WHERE email = demo_email LIMIT 1;
    CONTINUE WHEN v_user IS NULL;
    SELECT id INTO v_ws FROM public.workspaces WHERE owner_id = v_user ORDER BY created_at LIMIT 1;
    CONTINUE WHEN v_ws IS NULL;
    IF EXISTS (SELECT 1 FROM public.agent_memory WHERE user_id = v_user AND metadata->>'seed' = 'test-seed') THEN
      CONTINUE;
    END IF;

    INSERT INTO public.opportunities (user_id, workspace_id, title, problem, target_user, hypothesis, impact, confidence, ease, status)
    VALUES (v_user, v_ws, 'Default every reply to a formal tone',
      'We assumed a formal, corporate voice reads as professional for every customer.',
      'SMB founders on the starter plan',
      'A single formal default raises perceived trust across the board.',
      7, 6, 5, 'archived') RETURNING id INTO v_opp_old;

    INSERT INTO public.opportunities (user_id, workspace_id, title, problem, target_user, hypothesis, impact, confidence, ease, status)
    VALUES (v_user, v_ws, 'Match reply tone to the customer segment',
      'One tone fits no one. SMB wants direct, enterprise wants formal and accountable.',
      'Support agents across all plans',
      'Segment-aware tone lifts SMB reply rates without losing enterprise.',
      8, 7, 6, 'committed') RETURNING id INTO v_opp_new;

    INSERT INTO public.decisions (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public)
    VALUES (v_user, v_ws, 'Default every reply to a formal tone',
      'Picked early to look professional. Retired later once SMB reply rates fell and the segment data came in.',
      'approved', 'manual', 'strategist', false) RETURNING id INTO v_dec_old;

    INSERT INTO public.decisions (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public)
    VALUES (v_user, v_ws, 'Match reply tone to the customer segment',
      'The blanket formal default missed for SMB while enterprise still wanted it. Segment the tone instead of changing one global default.',
      'approved', 'manual', 'strategist', true) RETURNING id INTO v_dec_gov;

    INSERT INTO public.learnings (user_id, workspace_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at)
    VALUES (v_user, v_ws, v_opp_old, 'missed',
      'We defaulted every reply to a formal tone. SMB founders read it as cold and reply rates dropped, so the bet missed.',
      'SMB reply rate', '-9pts', 6.0, 4.0, now() - make_interval(days => 200)) RETURNING id INTO v_l_miss;

    INSERT INTO public.learnings (user_id, workspace_id, verdict, summary, metric_label, metric_value, created_at)
    SELECT v_user, v_ws, t.verdict, t.summary, t.metric_label::text, t.metric_value::text, now() - make_interval(days => t.d)
    FROM (VALUES
      (194, 'missed',    'Shipped a generic auto acknowledgement for new tickets. It did not move first-response satisfaction. Customers wanted a person, not a receipt.', NULL, NULL),
      (188, 'mixed',     'Added canned macros for billing questions. Faster for agents, but two enterprise accounts flagged the answers as templated.', 'handle time', '-30s'),
      (182, 'missed',    'Routed all off-hours tickets to one queue. It backed up and breached SLA on the first busy night.', NULL, NULL),
      (176, 'validated', 'Tagged tickets by product area at intake. Triage got faster and the tags held up over a month.', 'triage time', '-22%'),
      (170, 'missed',    'Tried a satisfaction survey after every reply. Response rate was tiny and the few scores skewed angry.', NULL, NULL),
      (164, 'mixed',     'Set a hard four hour SLA across every plan. Met it for paid plans, missed it badly for free, which created noise.', NULL, NULL),
      (158, 'validated', 'Gave agents a one click escalation to on-call. The path got used and cut time to a fix.', 'time to fix', '-1.8h'),
      (60,  'validated', 'Matched reply tone to the customer segment instead of one default. SMB reply rates recovered and enterprise stayed happy.', 'SMB reply rate', '+12pts'),
      (54,  'validated', 'Pre-filled the escalation note from the ticket history. On-call picked up the context faster.', NULL, NULL),
      (48,  'validated', 'Surfaced the nearest past decision when an agent opened a similar ticket. Agents reused the prior answer.', 'reuse rate', '41%'),
      (42,  'mixed',     'Auto-suggested a macro only when confidence was high. Helpful on common asks, quiet elsewhere, which is the point.', NULL, NULL),
      (36,  'validated', 'Split the off-hours queue by region. SLA held on the next busy night.', NULL, NULL),
      (30,  'validated', 'Scored opportunities with the recorded outcomes folded in. The ranking matched what actually shipped well.', NULL, NULL),
      (24,  'validated', 'Let the Critic flag a bet that contradicted a past miss before it shipped. It caught the formal-tone idea coming back.', NULL, NULL),
      (18,  'validated', 'Routed VIP accounts to a named owner. Response time on those accounts dropped and renewals held.', 'VIP response', '-2.1h')
    ) AS t(d, verdict, summary, metric_label, metric_value);

    INSERT INTO public.agent_memory (user_id, workspace_id, agent_slug, scope, kind, content, importance, metadata, last_used_at, created_at)
    SELECT v_user, v_ws, 'strategist', t.scope, t.kind, t.content, t.importance,
           jsonb_build_object('seed', 'test-seed'),
           CASE WHEN t.recalled THEN now() - make_interval(days => 5) ELSE NULL END,
           now() - make_interval(days => t.d)
    FROM (VALUES
      (210, 'workspace', 'pattern',    'Formal tone is not automatically professional. For SMB it can read as distant.', 4, true),
      (150, 'workspace', 'pattern',    'Off-hours tickets cluster by region, not by raw volume. Staff by region.', 4, true),
      (146, 'workspace', 'reflection', 'Enterprise accounts value a named owner more than speed alone.', 3, false),
      (142, 'workspace', 'pattern',    'High-confidence macros help; low-confidence macros annoy.', 3, true),
      (138, 'workspace', 'reflection', 'Triage tags are only useful if intake enforces them.', 3, false),
      (134, 'workspace', 'pattern',    'Hard global SLAs leak; tiered SLAs hold.', 4, true),
      (130, 'workspace', 'reflection', 'One-click escalation is reused when on-call context is prefilled.', 3, false),
      (126, 'workspace', 'pattern',    'Surveys after every reply skew angry. Sample, do not blanket.', 3, false),
      (122, 'workspace', 'reflection', 'Reusing the nearest past decision is the highest-leverage agent assist.', 4, true),
      (118, 'workspace', 'pattern',    'Segmenting tone beats changing a global default.', 4, true),
      (114, 'workspace', 'reflection', 'Outcomes-folded-in scoring matches what actually ships well.', 3, false),
      (110, 'workspace', 'pattern',    'The Critic catches retried ideas that already missed.', 4, true),
      (106, 'workspace', 'reflection', 'VIP routing to a named owner moves the renewal needle.', 4, false),
      (102, 'workspace', 'pattern',    'Region-split queues fix off-hours SLA without adding headcount.', 3, false),
      (98,  'workspace', 'reflection', 'Pre-filled escalation notes are the cheapest time-to-fix lever.', 3, false),
      (94,  'workspace', 'pattern',    'Confidence-gated automation earns trust faster than always-on automation.', 4, true)
    ) AS t(d, scope, kind, content, importance, recalled);

    -- Lineage: the supersession edge + the retired prior belief + the new belief
    INSERT INTO public.artifact_lineage (user_id, workspace_id, from_artifact_type, from_artifact_id, to_artifact_type, to_artifact_id, relation, valid_from, valid_to, invalidated_by_decision_id)
    VALUES
      (v_user, v_ws, 'decision', v_dec_old, 'decision', v_dec_gov, 'supersedes', now() - make_interval(days => 200), NULL, NULL),
      (v_user, v_ws, 'opportunity', v_opp_old, 'opportunity', v_opp_new, 'supersedes', now() - make_interval(days => 200), NULL, NULL),
      (v_user, v_ws, 'decision', v_dec_old, 'opportunity', v_opp_old, 'promotes', now() - make_interval(days => 220), now() - make_interval(days => 60), v_dec_gov)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- AMBIENT-SENSE
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_sense_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_sense_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workspaces_auto_sense
  ON public.workspaces (auto_sense_enabled, last_auto_sense_at ASC NULLS FIRST)
  WHERE auto_sense_enabled = true;

DO $$
DECLARE demo_email text; v_user uuid;
BEGIN
  FOREACH demo_email IN ARRAY ARRAY['demo@redcadence.app', 'demo2@redcadence.app'] LOOP
    SELECT id INTO v_user FROM auth.users WHERE email = demo_email LIMIT 1;
    CONTINUE WHEN v_user IS NULL;
    UPDATE public.workspaces SET auto_sense_enabled = true WHERE owner_id = v_user;
  END LOOP;
END $$;

-- AMBIENT-TRIGGER
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_trigger_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_trigger_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workspaces_auto_trigger
  ON public.workspaces (auto_trigger_enabled, last_auto_trigger_at ASC NULLS FIRST)
  WHERE auto_trigger_enabled = true;

DO $$
DECLARE demo_email text; v_user uuid;
BEGIN
  FOREACH demo_email IN ARRAY ARRAY['demo@redcadence.app', 'demo2@redcadence.app'] LOOP
    SELECT id INTO v_user FROM auth.users WHERE email = demo_email LIMIT 1;
    CONTINUE WHEN v_user IS NULL;
    UPDATE public.workspaces SET auto_trigger_enabled = true WHERE owner_id = v_user;
  END LOOP;
END $$;

-- AMBIENT CRON SCHEDULES
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base_url text := 'https://project--371dd588-1b70-4629-9bb5-9f003f3af373.lovable.app';
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('approvals-tick','event-reactor-tick','memory-tick-daily','resume-runs','sense-tick','trigger-tick');

  PERFORM cron.schedule(
    'sense-tick',
    '*/5 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-key', public.get_cron_hook_secret()),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/sense-tick')
  );

  PERFORM cron.schedule(
    'trigger-tick',
    '*/15 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-key', public.get_cron_hook_secret()),
        body := '{}'::jsonb
      ) AS request_id;
    $job$, base_url || '/api/public/hooks/trigger-tick')
  );
END $$;