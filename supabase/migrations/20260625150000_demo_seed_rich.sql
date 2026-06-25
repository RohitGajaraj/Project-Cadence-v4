-- DEMO-SEED-RICH: deterministic, idempotent, multi-domain showcase seed.
-- Scope: demo@redcadence.app + demo2@redcadence.app only (no production data touched).
-- Sentinel: agent_memory.metadata->>'seed' = 'demo-seed-rich'
-- Story arc: 4 product domains — pricing, onboarding, feature discovery, competitor parity.
-- Key moat proof: artifact_lineage graph with 8 edge types shows memory driving better decisions.
-- Layered on top of TEST-SEED (#1, sentinel 'test-seed'); does NOT re-insert its rows.

DO $$
DECLARE
  demo_emails TEXT[] := ARRAY['demo@redcadence.app', 'demo2@redcadence.app'];
  demo_email  TEXT;
  v_user      UUID;
  v_ws        UUID;
  v_agent     UUID;

  -- theme IDs
  v_theme_pricing    UUID;
  v_theme_onboard    UUID;
  v_theme_discovery  UUID;

  -- opportunity IDs
  v_opp_usage_price  UUID;
  v_opp_ai_spotlight UUID;
  v_opp_nudges       UUID;
  v_opp_parity       UUID;

  -- decision IDs
  v_dec_kill_parity  UUID;
  v_dec_coaching_v1  UUID;
  v_dec_usage_price  UUID;
  v_dec_ai_spotlight UUID;
  v_dec_nudges       UUID;

  -- learning IDs
  v_l_parity_miss    UUID;
  v_l_coaching_fric  UUID;
  v_l_price_lift     UUID;
  v_l_spotlight_lift UUID;
  v_l_nudge_win      UUID;

BEGIN
  FOREACH demo_email IN ARRAY demo_emails LOOP

    -- resolve user + workspace
    SELECT au.id INTO v_user
      FROM auth.users au
     WHERE au.email = demo_email
     LIMIT 1;
    IF v_user IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_ws
      FROM public.workspaces
     WHERE owner_id = v_user
     LIMIT 1;
    IF v_ws IS NULL THEN CONTINUE; END IF;

    -- idempotency guard
    IF EXISTS (
      SELECT 1 FROM public.agent_memory
       WHERE user_id = v_user
         AND metadata->>'seed' = 'demo-seed-rich'
    ) THEN CONTINUE; END IF;

    -- ──────────────────────────────────────────────────────────────────────
    -- 1. THEMES
    -- ──────────────────────────────────────────────────────────────────────
    INSERT INTO public.themes (user_id, title, summary, frequency, severity, confidence, status, created_at)
    VALUES (
      v_user,
      'Pricing model mismatch',
      'Users on flat plans hit the value ceiling early. 25% of month-2 churn traces back to pricing surprise rather than product quality.',
      4, 4, 0.82, 'confirmed',
      now() - make_interval(days => 240)
    ) RETURNING id INTO v_theme_pricing;

    INSERT INTO public.themes (user_id, title, summary, frequency, severity, confidence, status, created_at)
    VALUES (
      v_user,
      'Onboarding drop-off',
      'New users stall before completing first workspace setup. Analytics shows a 38% drop at the agent-configuration step.',
      5, 4, 0.88, 'confirmed',
      now() - make_interval(days => 210)
    ) RETURNING id INTO v_theme_onboard;

    INSERT INTO public.themes (user_id, title, summary, frequency, severity, confidence, status, created_at)
    VALUES (
      v_user,
      'Feature discoverability gap',
      'Power users discover AI-driven surfaces by accident. Export, spotlight, and precedent recall all have low organic adoption.',
      3, 3, 0.74, 'confirmed',
      now() - make_interval(days => 180)
    ) RETURNING id INTO v_theme_discovery;

    -- ──────────────────────────────────────────────────────────────────────
    -- 2. SIGNALS
    -- ──────────────────────────────────────────────────────────────────────
    INSERT INTO public.signals (user_id, source, title, content, sentiment, tags, theme_id, created_at)
    VALUES
    (
      v_user, 'analytics',
      'Free-to-paid conversion dropped 14 pts in Q1',
      'Trial-to-paid conversion fell from 31% to 17% after the pricing page update. Exit-survey: 42% cited "not sure what I get for the price".',
      'negative', ARRAY['pricing','conversion','trial'],
      v_theme_pricing, now() - make_interval(days => 230)
    ),
    (
      v_user, 'crm',
      'Month-2 churn spike — pricing surprise',
      '25% of churned accounts cited the end-of-trial invoice as unexpected. ARPU was $49; perceived value anchored at $19 (competitor pricing).',
      'negative', ARRAY['pricing','churn','arpu'],
      v_theme_pricing, now() - make_interval(days => 220)
    ),
    (
      v_user, 'analytics',
      'Onboarding funnel: 38% drop at agent config step',
      'Users who reach agent config and abandon never return. The step requires reading docs. Average time-in-step before drop: 4 minutes.',
      'negative', ARRAY['onboarding','activation','drop-off'],
      v_theme_onboard, now() - make_interval(days => 200)
    ),
    (
      v_user, 'interview',
      'Power users find spotlight by accident',
      '"I stumbled onto the precedent timeline after two months. Why is it buried?" — 3 of 5 interviewed power users said the same.',
      'negative', ARRAY['discovery','ux','power-users'],
      v_theme_discovery, now() - make_interval(days => 175)
    ),
    (
      v_user, 'market',
      'Competitor shipped export templates this quarter',
      'Linear and Notion both added templated export in Q1. No measurable churn signal yet but the gap is closing.',
      'neutral', ARRAY['competitor','parity','export'],
      v_theme_discovery, now() - make_interval(days => 160)
    ),
    (
      v_user, 'support',
      'Usage spikes in power accounts at month end',
      'Enterprise-tier accounts exhaust their seat allocation 10 days before renewal. 8 accounts asked for burst pricing.',
      'neutral', ARRAY['pricing','usage','enterprise'],
      v_theme_pricing, now() - make_interval(days => 150)
    );

    -- ──────────────────────────────────────────────────────────────────────
    -- 3. OPPORTUNITIES
    -- ──────────────────────────────────────────────────────────────────────
    INSERT INTO public.opportunities
      (user_id, workspace_id, theme_id, title, problem, target_user, hypothesis, impact, confidence, ease, status, created_at)
    VALUES (
      v_user, v_ws, v_theme_pricing,
      'Usage-based pricing tier',
      'Flat plans create a value ceiling that triggers churn at month 2. High-usage accounts want to burst without committing to a higher seat tier.',
      'Growth-stage teams (5-25 users) with variable workloads',
      'Adding a usage-based top-up tier will reduce pricing-surprise churn by letting users pay for what they consume, matching perceived value to cost.',
      8, 7, 6, 'closed',
      now() - make_interval(days => 215)
    ) RETURNING id INTO v_opp_usage_price;

    INSERT INTO public.opportunities
      (user_id, workspace_id, theme_id, title, problem, target_user, hypothesis, impact, confidence, ease, status, created_at)
    VALUES (
      v_user, v_ws, v_theme_discovery,
      'AI decision spotlight',
      'Power users discover the precedent and provenance surfaces by accident, months after signup. Low discoverability means the core moat is invisible at first use.',
      'Product managers in their first 30 days',
      'Surfacing the AI spotlight in the first session — showing what the system inferred and why — will accelerate aha-moment arrival and reduce time-to-value.',
      9, 8, 7, 'closed',
      now() - make_interval(days => 170)
    ) RETURNING id INTO v_opp_ai_spotlight;

    INSERT INTO public.opportunities
      (user_id, workspace_id, theme_id, title, problem, target_user, hypothesis, impact, confidence, ease, status, created_at)
    VALUES (
      v_user, v_ws, v_theme_onboard,
      'Contextual onboarding nudges',
      'New users stall at agent configuration because the step requires doc-reading. In-app coaching v1 reduced drop-off but the fixed flow felt patronising to returning users.',
      'New users in the first 7 days',
      'Replacing the fixed coaching flow with context-sensitive nudges (surface a tip only when the user hesitates at a known stall point) will raise D7 activation without annoying experienced users.',
      8, 7, 7, 'active',
      now() - make_interval(days => 80)
    ) RETURNING id INTO v_opp_nudges;

    INSERT INTO public.opportunities
      (user_id, workspace_id, theme_id, title, problem, target_user, hypothesis, impact, confidence, ease, status, created_at)
    VALUES (
      v_user, v_ws, v_theme_discovery,
      'Export templates (competitor parity)',
      'Linear and Notion shipped templated export in Q1. The gap may cause switching in template-driven workflows.',
      'Teams that export decision records to external tools',
      'Shipping templated export would close the parity gap and retain template-driven users.',
      4, 4, 5, 'killed',
      now() - make_interval(days => 155)
    ) RETURNING id INTO v_opp_parity;

    -- ──────────────────────────────────────────────────────────────────────
    -- 4. DECISIONS
    -- ──────────────────────────────────────────────────────────────────────
    INSERT INTO public.decisions
      (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public, created_at)
    VALUES (
      v_user, v_ws,
      'Kill the export-templates parity bet',
      'Critic flagged pattern match: 2 of 2 prior table-stakes parity bets in this workspace delivered weak retention (the formal-tone bet and the macro-suggestions bet both missed). Export templates are differentiator-neutral — they copy a commodity feature, not our AI-native edge. Building them crowds sprint capacity with work that cannot compound. The Critic caught this before any code was written. Decision: kill, redirect capacity to AI spotlight.',
      'standing', 'critic', 'strategist', true,
      now() - make_interval(days => 148)
    ) RETURNING id INTO v_dec_kill_parity;

    INSERT INTO public.decisions
      (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public, created_at)
    VALUES (
      v_user, v_ws,
      'Ship in-app coaching v1',
      'Onboarding drop-off at agent config is the highest-impact activation lever (38% loss, recoverable). A fixed-step coaching overlay with three guided prompts will walk users through the stall point. Risk: feels patronising to returning users — acceptable for v1; we will monitor the returning-user skip rate and iterate.',
      'superseded', 'roadmap', 'strategist', false,
      now() - make_interval(days => 195)
    ) RETURNING id INTO v_dec_coaching_v1;

    INSERT INTO public.decisions
      (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public, created_at)
    VALUES (
      v_user, v_ws,
      'Ship usage-based pricing top-up tier',
      'Month-2 churn from pricing surprise is measurable and addressable without rearchitecting the plan structure. A usage top-up (per-action credits above the seat limit) lets high-usage accounts burst without upgrading seats. This matches perceived value to cost and should cut pricing-surprise churn. Pricing: $0.09 per action above plan limit.',
      'standing', 'roadmap', 'strategist', true,
      now() - make_interval(days => 185)
    ) RETURNING id INTO v_dec_usage_price;

    INSERT INTO public.decisions
      (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public, created_at)
    VALUES (
      v_user, v_ws,
      'Ship AI decision spotlight in first session',
      'Power users cite the precedent timeline as the aha moment, but they discover it 2+ months in. Surfacing one live spotlight card in the first session — showing what the system inferred and why — will pull that aha moment forward. Implementation: a non-blocking banner in the first mission completion view.',
      'standing', 'roadmap', 'prd-writer', true,
      now() - make_interval(days => 145)
    ) RETURNING id INTO v_dec_ai_spotlight;

    INSERT INTO public.decisions
      (user_id, workspace_id, title, rationale, status, source_kind, decided_by_agent_slug, is_public, created_at)
    VALUES (
      v_user, v_ws,
      'Retire in-app coaching v1, ship contextual nudges',
      'Coaching v1 delivered a +11pt D7-activation lift but the fixed flow drew negative feedback from users who returned after 3+ days (felt patronising, 14% skip on re-entry). Contextual nudges — a tip that surfaces only when the user hesitates at a known stall point for 8+ seconds — retains the activation lift while eliminating the friction for experienced users. Supersedes the coaching v1 decision (2025-12-28).',
      'standing', 'retrospective', 'strategist', false,
      now() - make_interval(days => 75)
    ) RETURNING id INTO v_dec_nudges;

    -- ──────────────────────────────────────────────────────────────────────
    -- 5. LEARNINGS
    -- ──────────────────────────────────────────────────────────────────────
    INSERT INTO public.learnings
      (user_id, workspace_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at)
    VALUES (
      v_user, v_ws, v_opp_parity,
      'missed',
      'Two prior table-stakes parity bets (formal tone, canned macros) both missed retention targets. The hypothesis that closing the competitor gap retains users does not hold when the gap is on a commodity feature — users who care about templates were not our ICP.',
      'retention uplift', '0pts', 4.3, 2.1,
      now() - make_interval(days => 140)
    ) RETURNING id INTO v_l_parity_miss;

    INSERT INTO public.learnings
      (user_id, workspace_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at)
    VALUES (
      v_user, v_ws, v_opp_nudges,
      'mixed',
      'Coaching v1 raised D7-activation by 11pts on new users, but returning users skipped the overlay 14% of the time and flagged it as patronising in 3 of 5 support tickets that week. The win was real but the experience had a ceiling — the fixed flow does not adapt.',
      'D7 activation', '+11pts', 5.0, 6.2,
      now() - make_interval(days => 90)
    ) RETURNING id INTO v_l_coaching_fric;

    INSERT INTO public.learnings
      (user_id, workspace_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at)
    VALUES (
      v_user, v_ws, v_opp_usage_price,
      'validated',
      'Month-2 churn dropped 19pts in the cohort that adopted the usage top-up. ARPU increased 18% as high-usage accounts opted into burst credits rather than churning. The pricing-surprise complaint disappeared from support in that cohort.',
      'ARPU', '+18%', 6.7, 8.4,
      now() - make_interval(days => 120)
    ) RETURNING id INTO v_l_price_lift;

    INSERT INTO public.learnings
      (user_id, workspace_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at)
    VALUES (
      v_user, v_ws, v_opp_ai_spotlight,
      'validated',
      'The spotlight card in the first session pulled aha-moment arrival forward from median day 47 to median day 4. Feature discovery rate for precedent recall rose 34%. Users who saw the spotlight were 2.4x more likely to use the system-explained-why flow within 7 days.',
      'discovery rate', '+34%', 7.2, 9.1,
      now() - make_interval(days => 105)
    ) RETURNING id INTO v_l_spotlight_lift;

    INSERT INTO public.learnings
      (user_id, workspace_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at)
    VALUES (
      v_user, v_ws, v_opp_nudges,
      'validated',
      'Contextual nudges raised D7-activation a further 10pts over coaching v1 (total +21pts vs control) while eliminating the returning-user friction. The 8-second hesitation trigger was the key insight — it fires only when the user genuinely stalls, not on every session.',
      'D7 activation', '+21pts vs control', 6.2, 8.7,
      now() - make_interval(days => 40)
    ) RETURNING id INTO v_l_nudge_win;

    -- Additional cohort learnings to fill the learning timeline
    INSERT INTO public.learnings
      (user_id, workspace_id, verdict, summary, metric_label, metric_value, created_at)
    SELECT v_user, v_ws, t.verdict, t.summary, t.metric_label, t.metric_value,
           now() - make_interval(days => t.d)
    FROM (VALUES
      (250, 'missed',    'Tried A/B testing the pricing page headline alone. No conversion lift — the issue was the plan comparison table, not the headline.', NULL, NULL),
      (235, 'mixed',     'Ran a discount campaign for churned accounts. 30% reactivated but none stayed past month 2. Price sensitivity was not the root cause.', 'reactivation', '30%'),
      (220, 'missed',    'Added a product-tour modal on first login. Users skipped it immediately (87% skip rate). Opt-in tours do not work for our persona.', 'completion rate', '13%'),
      (165, 'validated', 'Added a one-line "why this recommendation" label below each AI suggestion. Trust scores in NPS comments rose noticeably.', NULL, NULL),
      (130, 'validated', 'Surfaced the decision count in the workspace header. Teams with visible counts logged 2x more decisions per week.', 'decision logging', '+2x'),
      (95,  'mixed',     'Auto-played the precedent panel on workspace load. Power users loved it; new users found it confusing without context.', NULL, NULL),
      (55,  'validated', 'Added a "Critic caught this" badge on decisions where the AI flagged a prior-miss pattern. Users reported higher confidence in the kill decisions.', 'kill-decision confidence', 'high'),
      (20,  'validated', 'The supersession chain (coaching v1 -> nudges) completed in 60 days, below the 90-day historical average. Faster iteration is compounding.', NULL, NULL)
    ) AS t(d, verdict, summary, metric_label, metric_value);

    -- ──────────────────────────────────────────────────────────────────────
    -- 6. ARTIFACT LINEAGE (the reasoning graph — 8 edges)
    -- ──────────────────────────────────────────────────────────────────────
    INSERT INTO public.artifact_lineage
      (user_id, workspace_id, parent_kind, parent_id, child_kind, child_id,
       relation, rationale, created_by_agent, inference, created_at)
    VALUES

    -- D_kill_parity contradicts O_parity (the Critic killed the opportunity)
    (v_user, v_ws,
     'decision', v_dec_kill_parity, 'opportunity', v_opp_parity,
     'contradicts',
     'The kill decision directly refutes the hypothesis behind the parity opportunity: table-stakes parity features have not retained users in this workspace. The Critic matched 2 prior misses before any code was written.',
     'strategist', true,
     now() - make_interval(days => 148)),

    -- D_ai_spotlight promotes O_ai_spotlight (opportunity promoted to a shipped decision)
    (v_user, v_ws,
     'opportunity', v_opp_ai_spotlight, 'decision', v_dec_ai_spotlight,
     'promotes',
     'The spotlight opportunity was evaluated by the PRD Writer, scored ICE 9/8/7, and promoted directly to a shipped decision. No intermediate PRD step — high confidence from prior moat-feature wins.',
     'prd-writer', false,
     now() - make_interval(days => 145)),

    -- D_nudges supersedes D_coaching_v1 (the key supersession edge)
    (v_user, v_ws,
     'decision', v_dec_nudges, 'decision', v_dec_coaching_v1,
     'supersedes',
     'Contextual nudges supersede in-app coaching v1. The v1 decision was sound at the time (mixed outcome: +11pts D7) but the fixed flow pattern failed returning users. The nudge design preserves the activation gain while eliminating the pattern that generated friction.',
     'strategist', true,
     now() - make_interval(days => 75)),

    -- D_usage_price validates O_usage_price (decision validates the opportunity hypothesis)
    (v_user, v_ws,
     'decision', v_dec_usage_price, 'opportunity', v_opp_usage_price,
     'validates',
     'The usage pricing decision directly tests the opportunity hypothesis: burst-tier pricing reduces pricing-surprise churn. The validated learning confirms the hypothesis held (month-2 churn -19pts, ARPU +18%).',
     'strategist', false,
     now() - make_interval(days => 185)),

    -- L_parity_miss validates D_kill_parity (learning confirms the kill was right)
    (v_user, v_ws,
     'learning', v_l_parity_miss, 'decision', v_dec_kill_parity,
     'validates',
     'The post-mortem learning confirms the kill decision: 0pt retention uplift from the prior parity bets matches the Critic prediction. The decision to kill before building was correct.',
     'strategist', true,
     now() - make_interval(days => 140)),

    -- L_coaching_fric derived-from D_coaching_v1 (learning derived from the coaching decision)
    (v_user, v_ws,
     'learning', v_l_coaching_fric, 'decision', v_dec_coaching_v1,
     'derived-from',
     'The coaching friction learning is derived from running the coaching v1 decision: the outcome (mixed) surfaced the returning-user skip pattern that motivated the nudges supersession.',
     'strategist', false,
     now() - make_interval(days => 90)),

    -- D_nudges cites L_coaching_fric (nudge decision explicitly references the friction learning)
    (v_user, v_ws,
     'decision', v_dec_nudges, 'learning', v_l_coaching_fric,
     'cites',
     'The contextual nudge decision rationale explicitly cites the coaching friction learning: the 14% returning-user skip rate and the 3 support tickets are the evidence that motivated the supersession.',
     'strategist', false,
     now() - make_interval(days => 75)),

    -- L_spotlight_lift validates D_ai_spotlight (learning confirms the spotlight shipped right)
    (v_user, v_ws,
     'learning', v_l_spotlight_lift, 'decision', v_dec_ai_spotlight,
     'validates',
     'Discovery rate +34%, aha-moment arrival from day 47 to day 4. The spotlight decision hypothesis (pull aha-moment forward) was validated in the first cohort.',
     'prd-writer', true,
     now() - make_interval(days => 105))

    ON CONFLICT (user_id, parent_kind, parent_id, child_kind, child_id, relation) DO NOTHING;

    -- ──────────────────────────────────────────────────────────────────────
    -- 7. AGENT MEMORY (precedent pattern library — 6 entries)
    -- ──────────────────────────────────────────────────────────────────────
    INSERT INTO public.agent_memory
      (user_id, agent_slug, scope, kind, content, importance, metadata, created_at)
    VALUES

    (v_user, 'strategist', 'workspace', 'precedent',
     'Competitor parity bets in this workspace: 2 of 2 killed before building, 0 shipped. Pattern: table-stakes parity features do not retain our ICP (AI-native PMs who chose us for the decision layer, not for feature breadth). Future parity proposals should cite this record and require a strong counter-argument to proceed.',
     5, jsonb_build_object('seed', 'demo-seed-rich', 'domain', 'strategy', 'pattern_id', 'parity-bets-weak'),
     now() - make_interval(days => 140)),

    (v_user, 'strategist', 'workspace', 'precedent',
     'Onboarding iteration arc: fixed coaching overlay (v1, mixed) -> contextual hesitation-triggered nudge (v2, validated). Key insight: the trigger timing (8-second stall) was the unlock. Fixed-flow coaching created returning-user friction; context-sensitive delivery did not. Apply this pattern before choosing any fixed-flow tutorial approach.',
     4, jsonb_build_object('seed', 'demo-seed-rich', 'domain', 'onboarding', 'pattern_id', 'coaching-arc'),
     now() - make_interval(days => 40)),

    (v_user, 'strategist', 'workspace', 'precedent',
     'AI-native feature bets vs. parity bets: AI spotlight delivered +34% discovery rate and pulled aha-moment from day 47 to day 4. No parity bet in this workspace has delivered comparable impact. Confidence weight: AI-native > parity for ICE scoring in this workspace.',
     5, jsonb_build_object('seed', 'demo-seed-rich', 'domain', 'strategy', 'pattern_id', 'ai-native-vs-parity'),
     now() - make_interval(days => 105)),

    (v_user, 'strategist', 'workspace', 'note',
     'Usage-based pricing reduced pricing-surprise churn from 25% of month-2 exits to under 6%. The $0.09/action burst rate was accepted without pushback. For future pricing tiers: usage-based top-ups are low-friction to add and high-impact on churn reduction. Consider for any new plan tier.',
     4, jsonb_build_object('seed', 'demo-seed-rich', 'domain', 'pricing', 'pattern_id', 'usage-pricing-works'),
     now() - make_interval(days => 120)),

    (v_user, 'strategist', 'workspace', 'precedent',
     'The Critic caught the export-templates recurrence before any code was written. The pattern match (2 prior parity misses) was available in the lineage graph. This is the moat working as designed: memory preventing repeated mistakes. Document this in investor material as a live example of the "memory-as-moat" thesis.',
     5, jsonb_build_object('seed', 'demo-seed-rich', 'domain', 'product', 'pattern_id', 'critic-kill-confirmed'),
     now() - make_interval(days => 130)),

    (v_user, 'discovery-scout', 'workspace', 'note',
     'Supersession chain completion time: coaching v1 -> nudges took 60 days (issue detected at day 90 post-launch, decision at day 120, supersession shipped at day 195, learning validated at day 230). Below the 90-day historical workspace average. Signal: the retrospective loop is tightening. Goal: under 45 days by end of quarter.',
     3, jsonb_build_object('seed', 'demo-seed-rich', 'domain', 'process', 'pattern_id', 'supersession-velocity'),
     now() - make_interval(days => 35));

    -- ──────────────────────────────────────────────────────────────────────
    -- 8. AGENT APPROVALS (Trust Ledger entries — 3 varied statuses)
    -- ──────────────────────────────────────────────────────────────────────
    SELECT id INTO v_agent FROM public.agents
     WHERE user_id = v_user AND slug = 'strategist' LIMIT 1;
    IF v_agent IS NULL THEN
      SELECT id INTO v_agent FROM public.agents WHERE user_id = v_user LIMIT 1;
    END IF;

    IF v_agent IS NOT NULL THEN

      -- (a) Critic kill recommendation — approved by human (the Trust Ledger "approved" receipt)
      IF NOT EXISTS (
        SELECT 1 FROM public.agent_approvals
         WHERE user_id = v_user AND tool_name = 'decisions.kill'
           AND rationale LIKE 'Demo seed rich:%'
      ) THEN
        INSERT INTO public.agent_approvals
          (user_id, agent_id, agent_slug, trace_id, tool_name, args, rationale, decision_reason,
           status, decided_at, decided_by, escalation_state, workspace_id)
        VALUES (
          v_user, v_agent, 'strategist', gen_random_uuid(),
          'decisions.kill',
          jsonb_build_object(
            'opportunity_id', v_opp_parity,
            'reason', 'pattern-match: 2 prior parity misses in this workspace; no counter-argument filed'
          ),
          'Demo seed rich: Critic recommends killing the export-templates parity bet. Pattern match on 2 prior misses.',
          'Approved: parity bet confirmed weak by precedent record. Kill before any sprint capacity is allocated.',
          'approved', now() - make_interval(days => 149), v_user,
          'resolved', v_ws
        );
      END IF;

      -- (b) PRD draft for AI spotlight — auto-executed (the Trust Ledger "executed" receipt)
      IF NOT EXISTS (
        SELECT 1 FROM public.agent_approvals
         WHERE user_id = v_user AND tool_name = 'prd.draft'
           AND rationale LIKE 'Demo seed rich:%'
      ) THEN
        INSERT INTO public.agent_approvals
          (user_id, agent_id, agent_slug, trace_id, tool_name, args, rationale, decision_reason,
           status, decided_at, escalation_state, workspace_id)
        VALUES (
          v_user, v_agent, 'prd-writer', gen_random_uuid(),
          'prd.draft',
          jsonb_build_object(
            'opportunity_id', v_opp_ai_spotlight,
            'mode', 'auto',
            'confidence_threshold', 0.85
          ),
          'Demo seed rich: PRD Writer auto-drafts the AI spotlight PRD. Confidence 0.91 — above auto-execute threshold.',
          'Auto-executed: PRD draft confidence 0.91 exceeded the 0.85 auto-execute threshold. Draft staged for review.',
          'executed', now() - make_interval(days => 168),
          'resolved', v_ws
        );
      END IF;

      -- (c) Pricing A/B test proposal — pending (the Trust Ledger "needs you" receipt)
      IF NOT EXISTS (
        SELECT 1 FROM public.agent_approvals
         WHERE user_id = v_user AND tool_name = 'experiments.create'
           AND rationale LIKE 'Demo seed rich:%'
      ) THEN
        INSERT INTO public.agent_approvals
          (user_id, agent_id, agent_slug, trace_id, tool_name, args, rationale,
           status, escalation_state, expires_at, workspace_id)
        VALUES (
          v_user, v_agent, 'data-analyst', gen_random_uuid(),
          'experiments.create',
          jsonb_build_object(
            'name', 'Usage top-up pricing A/B — holdout vs early adopter cohort',
            'hypothesis', 'Presenting the top-up tier at month-1 (vs. month-2 at invoice) reduces churn by anchoring value earlier',
            'variant_split', 0.5,
            'duration_days', 30
          ),
          'Demo seed rich: Data Analyst proposes a 30-day A/B test to validate early top-up presentation timing.',
          'pending', 'pending',
          now() + make_interval(days => 3),
          v_ws
        );
      END IF;

    END IF;

  END LOOP;
END $$;
