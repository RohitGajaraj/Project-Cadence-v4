-- TEST-SEED (v11 #1) - minimal deterministic dev/test data so the decision/lineage/
-- outcome SURFACES render while we build them. This is the as-needed dev enabler, NOT
-- the rich external showcase (that is DEMO-SEED-RICH, Tier 4, last).
--
-- Why this exists: a live-DB check showed the moat is cold in dev. Both demo accounts
-- carry 0 supersession edges and near-zero recorded outcomes, so the surfaces that read
-- them render empty: the provenance graph, the governing-decision (supersession) walk,
-- the Trust Ledger, and the memory-depth lift. You cannot build or QA an empty surface.
--
-- What this adds, per demo account, as one believable closed loop:
--   - two opportunities: the original bet (a blanket formal reply tone) and the bet that
--     replaced it (tone matched to the customer segment).
--   - two decisions: the retired one and the governing one (the latter shared, so the
--     public Trust Ledger view also renders).
--   - sixteen recorded outcomes (learnings): an EARLY cohort decided with little precedent
--     that mostly missed, and a LATER cohort decided with deep precedent that mostly
--     validated. This is exactly the shape the memory-depth lift reads, so it computes a
--     real number instead of "not enough data yet".
--   - sixteen memory rows forming the precedent timeline: one early anchor, fifteen built
--     up before the later cohort, so early bets sit at low depth and later bets at high
--     depth (the depth contrast the lift gate requires).
--   - three lineage edges: the live supersession (new opportunity supersedes old), the
--     retired prior belief (stamped valid_to + invalidated_by, the bitemporal record), and
--     the current belief the new opportunity promotes.
--
-- Idempotent: a single sentinel (an agent_memory row tagged metadata.seed = 'test-seed')
-- gates the whole per-user block, so re-applying is a no-op. Demo-scoped by email and
-- service-role applied (RLS bypassed on apply; the seeded rows stay owner-scoped so the
-- demo user reads them normally). No tables, columns, or policies are created or altered,
-- so the offline migration lint has nothing to flag. Non-destructive: only inserts.

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

    -- The first/default workspace (matches the w6 demo seed resolution). Both demo
    -- decision/lineage/learning surfaces read by user_id; workspace_id is set explicitly
    -- because decisions and artifact_lineage are NOT NULL on it and the default function
    -- needs an auth context this service-role apply does not have.
    SELECT id INTO v_ws FROM public.workspaces WHERE owner_id = v_user ORDER BY created_at LIMIT 1;
    CONTINUE WHEN v_ws IS NULL;

    -- Idempotency sentinel: if this account already carries the seed, skip the whole block.
    IF EXISTS (
      SELECT 1 FROM public.agent_memory
      WHERE user_id = v_user AND metadata->>'seed' = 'test-seed'
    ) THEN
      CONTINUE;
    END IF;

    -- (1) The two opportunities: the retired bet and the bet that replaced it.
    -- workspace_id is set explicitly: opportunities.workspace_id is NOT NULL and defaults to
    -- current_user_default_workspace(), which under a service-role apply has no auth context
    -- and would try to create a default workspace+account with a null owner and fail.
    INSERT INTO public.opportunities (user_id, workspace_id, title, problem, target_user, hypothesis, impact, confidence, ease, status)
    VALUES (
      v_user, v_ws,
      'Default every reply to a formal tone',
      'We assumed a formal, corporate voice reads as professional for every customer.',
      'SMB founders on the starter plan',
      'A single formal default raises perceived trust across the board.',
      7, 6, 5, 'archived'
    ) RETURNING id INTO v_opp_old;

    INSERT INTO public.opportunities (user_id, workspace_id, title, problem, target_user, hypothesis, impact, confidence, ease, status)
    VALUES (
      v_user, v_ws,
      'Match reply tone to the customer segment',
      'One tone fits no one. SMB wants direct, enterprise wants formal and accountable.',
      'Support agents across all plans',
      'Segment-aware tone lifts SMB reply rates without losing enterprise.',
      8, 7, 6, 'committed'
    ) RETURNING id INTO v_opp_new;

    -- (2) The two decisions. The governing one is shared so the public Trust Ledger renders.
    INSERT INTO public.decisions (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public)
    VALUES (
      v_user, v_ws,
      'Default every reply to a formal tone',
      'Picked early to look professional. Retired later once SMB reply rates fell and the segment data came in.',
      'approved', 'manual', 'strategist', false
    ) RETURNING id INTO v_dec_old;

    INSERT INTO public.decisions (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public)
    VALUES (
      v_user, v_ws,
      'Match reply tone to the customer segment',
      'The blanket formal default missed for SMB while enterprise still wanted it. Segment the tone instead of changing one global default.',
      'approved', 'manual', 'strategist', true
    ) RETURNING id INTO v_dec_gov;

    -- (3a) The recorded outcome that drove the supersession (the formal-tone miss).
    INSERT INTO public.learnings (user_id, workspace_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at)
    VALUES (
      v_user, v_ws, v_opp_old, 'missed',
      'We defaulted every reply to a formal tone. SMB founders read it as cold and reply rates dropped, so the bet missed.',
      'SMB reply rate', '-9pts', 6.0, 4.0, now() - make_interval(days => 200)
    ) RETURNING id INTO v_l_miss;

    -- (3b) The rest of the cohort. Early half (low precedent) mostly missed; later half
    -- (deep precedent) mostly validated. This is the memory-depth lift the moat metric reads.
    INSERT INTO public.learnings (user_id, workspace_id, verdict, summary, metric_label, metric_value, created_at)
    SELECT v_user, v_ws, t.verdict, t.summary, t.metric_label::text, t.metric_value::text, now() - make_interval(days => t.d)
    FROM (VALUES
      -- early cohort (decided with little precedent)
      (194, 'missed',    'Shipped a generic auto acknowledgement for new tickets. It did not move first-response satisfaction. Customers wanted a person, not a receipt.', NULL, NULL),
      (188, 'mixed',     'Added canned macros for billing questions. Faster for agents, but two enterprise accounts flagged the answers as templated.', 'handle time', '-30s'),
      (182, 'missed',    'Routed all off-hours tickets to one queue. It backed up and breached SLA on the first busy night.', NULL, NULL),
      (176, 'validated', 'Tagged tickets by product area at intake. Triage got faster and the tags held up over a month.', 'triage time', '-22%'),
      (170, 'missed',    'Tried a satisfaction survey after every reply. Response rate was tiny and the few scores skewed angry.', NULL, NULL),
      (164, 'mixed',     'Set a hard four hour SLA across every plan. Met it for paid plans, missed it badly for free, which created noise.', NULL, NULL),
      (158, 'validated', 'Gave agents a one click escalation to on-call. The path got used and cut time to a fix.', 'time to fix', '-1.8h'),
      -- later cohort (decided with deep precedent)
      (60,  'validated', 'Matched reply tone to the customer segment instead of one default. SMB reply rates recovered and enterprise stayed happy.', 'SMB reply rate', '+12pts'),
      (54,  'validated', 'Pre-filled the escalation note from the ticket history. On-call picked up the context faster.', NULL, NULL),
      (48,  'validated', 'Surfaced the nearest past decision when an agent opened a similar ticket. Agents reused the prior answer.', 'reuse rate', '41%'),
      (42,  'mixed',     'Auto-suggested a macro only when confidence was high. Helpful on common asks, quiet elsewhere, which is the point.', NULL, NULL),
      (36,  'validated', 'Split the off-hours queue by region. SLA held on the next busy night.', NULL, NULL),
      (30,  'validated', 'Scored opportunities with the recorded outcomes folded in. The ranking matched what actually shipped well.', NULL, NULL),
      (24,  'validated', 'Let the Critic flag a bet that contradicted a past miss before it shipped. It caught the formal-tone idea coming back.', NULL, NULL),
      (18,  'validated', 'Routed VIP accounts to a named owner. Response time on those accounts dropped and renewals held.', 'VIP response', '-2.1h')
    ) AS t(d, verdict, summary, metric_label, metric_value);

    -- (4) The precedent timeline. One early anchor plus fifteen built up before the later
    -- cohort, so early bets sit at depth 1 and later bets at depth 16. A few are marked
    -- recalled (last_used_at set) so the memory reuse stat is non-zero.
    INSERT INTO public.agent_memory (user_id, workspace_id, agent_slug, scope, kind, content, importance, metadata, last_used_at, created_at)
    SELECT v_user, v_ws, 'strategist', t.scope, t.kind, t.content, t.importance,
           jsonb_build_object('seed', 'test-seed'),
           CASE WHEN t.recalled THEN now() - make_interval(days => 5) ELSE NULL END,
           now() - make_interval(days => t.d)
    FROM (VALUES
      (210, 'workspace', 'pattern',    'Formal tone is not automatically professional. For SMB it can read as distant.', 4, true),
      (150, 'workspace', 'pattern',    'Off-hours tickets cluster by region, not by raw volume. Staff by region.', 4, true),
      (146, 'workspace', 'reflection', 'Enterprise accounts value a named owner more than speed alone.', 3, false),
      (142, 'workspace', 'outcome',    'Canned macros help on billing and hurt on anything with nuance.', 3, true),
      (138, 'workspace', 'pattern',    'Escalation works when the note carries the ticket history with it.', 4, false),
      (134, 'workspace', 'reflection', 'A four hour SLA only makes sense per plan, not shared across all plans.', 3, false),
      (130, 'workspace', 'pattern',    'Reply rate is a faster early read on tone than CSAT.', 4, true),
      (126, 'workspace', 'outcome',    'Tags set at intake save more time than tags added after triage.', 3, false),
      (122, 'workspace', 'pattern',    'Surfacing the nearest past decision is the highest reuse memory we have.', 5, true),
      (118, 'workspace', 'reflection', 'Free plan noise drowns paid signal when the SLA is shared.', 3, false),
      (114, 'workspace', 'outcome',    'VIP routing pays for itself in renewals, not just response time.', 4, false),
      (110, 'workspace', 'pattern',    'The Critic earns its keep when it remembers a past miss.', 5, true),
      (106, 'workspace', 'outcome',    'A region split fixed the off-hours queue that a single queue could not.', 3, false),
      (102, 'workspace', 'reflection', 'Outcomes belong in the ranking, not just in a report.', 4, false),
      (98,  'workspace', 'pattern',    'Two enterprise flags on a macro outweigh ten SMB thumbs up for that segment.', 3, false),
      (94,  'workspace', 'reflection', 'Context beats speed for the accounts that pay the most.', 4, true)
    ) AS t(d, scope, kind, content, importance, recalled);

    -- (5) The lineage. The live supersession is the edge the governing-decision walk reads;
    -- the retired edge carries the bitemporal stamp (valid_to + the learning that retired it);
    -- the current edge is the belief the new opportunity promotes.
    INSERT INTO public.artifact_lineage
      (user_id, workspace_id, parent_kind, parent_id, child_kind, child_id, relation, rationale, created_by_agent, inference, valid_to, invalidated_by)
    VALUES
      (v_user, v_ws, 'opportunity', v_opp_new, 'opportunity', v_opp_old, 'supersedes',
       'The segment matched tone validated where the blanket formal default missed for SMB.',
       'strategist', jsonb_build_object('verdict', 'missed', 'score', 0.82, 'source', 'test-seed'), NULL, NULL),
      (v_user, v_ws, 'opportunity', v_opp_old, 'decision', v_dec_old, 'promoted',
       'The old opportunity promoted this decision before the recorded outcome retired the belief.',
       'strategist', NULL, now(), v_l_miss),
      (v_user, v_ws, 'opportunity', v_opp_new, 'decision', v_dec_gov, 'promoted',
       'The governing decision the new opportunity promotes.',
       'strategist', NULL, NULL, NULL)
    ON CONFLICT (user_id, parent_kind, parent_id, child_kind, child_id, relation) DO NOTHING;

  END LOOP;
END $$;
