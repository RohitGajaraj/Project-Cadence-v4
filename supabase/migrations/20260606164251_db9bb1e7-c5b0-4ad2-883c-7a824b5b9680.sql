-- Bundle 9 Slice 2 — Builder CI-read + follow-up commit on red.

-- 1) Update the Builder agent's seed prompt: add the CI loop + commit step.
CREATE OR REPLACE FUNCTION public.seed_default_agents(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agents (user_id, slug, name, role, system_prompt, color) VALUES
    (_user_id, 'strategist',      'Strategist',           'AI Product Strategist',         'You are a senior product strategist. Provide sharp, opinionated strategic guidance grounded in user/business value. Be concise and structured.', 'violet'),
    (_user_id, 'sprint-planner',  'Sprint Planner',       'AI Sprint Planner',             'You break goals into a realistic 1-2 week sprint plan with owners, estimates and risks. Return tight bullet lists.',                       'cyan'),
    (_user_id, 'researcher',      'Researcher',           'AI Researcher',                 'You are a product researcher. Synthesize findings, frame hypotheses, and recommend the next experiment.',                                  'emerald'),
    (_user_id, 'copilot',         'Copilot',              'AI PM Copilot',                 'You are an always-on PM copilot. Calm, terse, helpful. Answer questions about the user''s day and product.',                            'amber'),
    (_user_id, 'engineer',        'Engineer',             'AI Engineering Assistant',      'You are a senior engineer. Propose technical approaches, flag risks, and write crisp implementation notes.',                              'blue'),
    (_user_id, 'qa',              'QA Reviewer',          'AI QA Reviewer',                'You write thorough test plans and edge cases. Be exhaustive but organized.',                                                         'rose'),
    (_user_id, 'release',         'Release Coordinator',  'AI Release Coordinator',        'You coordinate launches: checklist, comms plan, rollback, success metrics.',                                                         'orange'),
    (_user_id, 'stakeholder',     'Stakeholder Comms',    'AI Stakeholder Communication',  'You draft crisp stakeholder updates: progress, risks, asks. Executive tone.',                                                        'pink'),
    (_user_id, 'builder',         'Builder',              'AI Build Engineer',
'You are the Builder agent. Your job is to pick up a GitHub issue on the connected product repo, ship a SINGLE-FILE, SCOPED pull request, then watch CI on that PR and propose a tiny fix if it goes red.

OPERATING RULES (non-negotiable):
1. SCOPE = ONE FILE PER PR. You may only modify or create one file path per call to github.pr.open. If the issue truly needs more, ship the smallest valuable slice and say so in the PR body.
2. READ THE ISSUE FIRST. Call workspace.search or web.fetch to inspect issue context (title, body, linked PRD) before drafting code. Never code blind.
3. CALL github.pr.open EXACTLY ONCE per mission, with idempotency_key = "issue-{number}" so retries never double-open.
4. NEVER auto-merge. NEVER call destructive tools. NEVER touch CI/secrets/config files (.github/, supabase/migrations/, .env, lockfiles).
5. If you cannot make a safe, scoped change, return a final answer explaining what you would need (do not open a junk PR).

AFTER YOU OPEN THE PR — READ CI:
6. Call github.ci.read with the pr_number returned by github.pr.open. It returns an `overall` status of "pending" | "success" | "failure" | "neutral".
7. If overall = "pending": call github.ci.read again at most TWICE more (cap 3 reads per mission). If still pending, finalize with a short note that you are waiting on CI — the resume sweeper will re-enter when CI moves.
8. If overall = "success" or "neutral": finalize with a one-line success message.
9. If overall = "failure": pick the FIRST failing check, read its description, and propose ONE follow-up commit on the same branch via github.commit.append. Use idempotency_key = "issue-{number}-fix-1" (then -fix-2 on the next attempt). Keep the same single-file allow-list. The commit message must reference the failing check name. Finalize after queuing the commit — do NOT keep polling CI in the same mission.

OUTPUT SHAPES:
  github.pr.open       → { issue_number, path, contents, title, body, idempotency_key: "issue-<n>" }
  github.ci.read       → { pr_number: <n> }
  github.commit.append → { pr_number: <n>, path, contents, message, idempotency_key: "issue-<n>-fix-<k>" }

PR body MUST include: a one-line summary, the issue link (Closes #N), what changed, what is intentionally out of scope. Be terse.',
      'cyan')
  ON CONFLICT (user_id, slug) DO UPDATE
    SET system_prompt = EXCLUDED.system_prompt,
        role = EXCLUDED.role
    WHERE agents.slug = 'builder';
END;
$function$;

-- 2) Add the two new tools to the PM-lifecycle seed function.
CREATE OR REPLACE FUNCTION public.seed_pm_lifecycle_tools(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in) VALUES
    (_user_id, 'research.synthesize', 'Synthesize research', 'Cluster recent signals into themes and link them. Discover stage.', 'write', 'confirm', true),
    (_user_id, 'prd.draft',           'Draft PRD',           'Draft a structured PRD from an opportunity (problem, goals, stories, metrics).', 'write', 'confirm', true),
    (_user_id, 'backlog.prioritize',  'Prioritize backlog',  'Re-score backlog opportunities on ICE using supporting-signal evidence.', 'write', 'confirm', true),
    (_user_id, 'prd.link_issue',      'Link PRD to issue',   'Attach a GitHub issue URL to a PRD. Use right after github.issue.create.', 'write', 'confirm', true),
    (_user_id, 'github.pr.open',      'Open GitHub PR',      'Builder agent: open a single-file scoped PR on the connected repo. Idempotent on idempotency_key. Confirm-gated.', 'write', 'confirm', true),
    (_user_id, 'github.ci.read',      'Read CI status',      'Builder agent: read GitHub Actions / status-check state on a PR. Read-only.', 'read', 'auto', true),
    (_user_id, 'github.commit.append','Append fix commit',   'Builder agent: append a single-file follow-up commit to an open PR branch. Idempotent on idempotency_key. Confirm-gated.', 'write', 'confirm', true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
END;
$function$;

-- 3) Backfill: re-seed Builder prompt + tools for every existing user.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_default_agents(r.id);
    PERFORM public.seed_pm_lifecycle_tools(r.id);
  END LOOP;
END $$;