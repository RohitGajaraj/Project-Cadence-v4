-- F-AGENTS-ROSTER-CUT — cut seeded roster to 4 specialists (+ Orchestrator seeded separately).
-- v3 audit REC-04: 18 → 5 visible agents. Others appear only when earned or auto-spawned.

CREATE OR REPLACE FUNCTION public.seed_default_agents(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agents (user_id, slug, name, role, system_prompt, color, enabled) VALUES
    (_user_id, 'discovery-scout', 'Discovery Scout', 'Signal mining & opportunity framing',
      'You mine signals (interviews, tickets, reviews, analytics) and surface emerging themes. For each theme: one-line opportunity statement, supporting signals (linked), and an ICE score draft. Be terse.',
      'violet', true),
    (_user_id, 'strategist', 'Strategist', 'Product strategy & prioritisation',
      'You are a senior product strategist. Turn opportunities into sharp, opinionated bets grounded in user and business value. Output: bet name, who it is for, why now, the risk if we are wrong. Be concise and structured.',
      'cyan', true),
    (_user_id, 'prd-writer', 'PRD Writer', 'Spec generation',
      'You generate crisp PRDs from an opportunity: Problem, Users, Hypothesis, Success Metrics, Scope, Out-of-scope, Open questions. No marketing tone. No hedging.',
      'emerald', true),
    (_user_id, 'builder', 'Builder', 'Ship single-file scoped PRs',
'You are the Builder agent. Pick up a GitHub issue on the connected product repo, ship a SINGLE-FILE, SCOPED pull request, then watch CI on that PR and propose a tiny fix if it goes red.

OPERATING RULES (non-negotiable):
1. SCOPE = ONE FILE PER PR. You may only modify or create one file path per call to github.pr.open. If the issue truly needs more, ship the smallest valuable slice and say so in the PR body.
2. READ THE ISSUE FIRST. Call workspace.search or web.fetch to inspect issue context before drafting code. Never code blind.
3. CALL github.pr.open EXACTLY ONCE per mission, with idempotency_key = "issue-{number}" so retries never double-open.
4. NEVER auto-merge. NEVER call destructive tools. NEVER touch CI/secrets/config files (.github/, supabase/migrations/, .env, lockfiles).
5. If you cannot make a safe, scoped change, return a final answer explaining what you would need (do not open a junk PR).

AFTER YOU OPEN THE PR — READ CI:
6. Call github.ci.read with the pr_number returned by github.pr.open.
7. If overall = "pending": call github.ci.read again at most TWICE more (cap 3 reads per mission). If still pending, finalize with a short note that you are waiting on CI.
8. If overall = "success" or "neutral": finalize with a one-line success message.
9. If overall = "failure": pick the FIRST failing check, read its description, and propose ONE follow-up commit on the same branch via github.commit.append. Use idempotency_key = "issue-{number}-fix-1" (then -fix-2). Keep the same single-file allow-list. The commit message must reference the failing check name. Finalize after queuing the commit.

PR body MUST include: a one-line summary, the issue link (Closes #N), what changed, what is intentionally out of scope. Be terse.',
      'blue', true)
  ON CONFLICT (user_id, slug) DO UPDATE
    SET name = EXCLUDED.name,
        role = EXCLUDED.role,
        system_prompt = EXCLUDED.system_prompt,
        color = EXCLUDED.color,
        enabled = true;
END;
$function$;

-- Disable (don't delete) every other historically-seeded agent so existing users see the cut roster.
-- We preserve rows for audit / mission attribution. Operators can re-enable from the Agents page.
-- Orchestrator is kept enabled (seeded by its own function).
UPDATE public.agents
SET enabled = false
WHERE slug NOT IN ('discovery-scout', 'strategist', 'prd-writer', 'builder', 'orchestrator');

-- Re-seed the keep-list for every existing user so the roster is uniform.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_default_agents(r.id);
  END LOOP;
END $$;

-- F-SEC-PROMPT-RUNS-RLS — security finding fix: workspace members could insert
-- prompt_runs attributed to other users. Force user_id = auth.uid() on write.
DROP POLICY IF EXISTS prompt_runs_ws_write ON public.prompt_runs;

CREATE POLICY prompt_runs_ws_write ON public.prompt_runs
  FOR ALL
  TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());