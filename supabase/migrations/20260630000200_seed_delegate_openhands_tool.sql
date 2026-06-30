-- BLD-04: add delegate.openhands to the default agent tool set.
--
-- Updates seed_default_agent_tools so new users get it automatically,
-- then backfills all existing users. ON CONFLICT DO NOTHING is safe for
-- repeated re-runs.

CREATE OR REPLACE FUNCTION public.seed_default_agent_tools(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in) VALUES
    (_user_id, 'repo.tree',            'Read repo tree',        'Studio: list the connected repo''s file tree (paths, types, sizes). Read-only.', 'read', 'auto', true),
    (_user_id, 'repo.read',            'Read repo files',       'Studio: read up to 8 files from the connected repo. Read-only.', 'read', 'auto', true),
    (_user_id, 'repo.search',          'Search repo code',      'Studio: GitHub code search scoped to the connected repo. Read-only.', 'read', 'auto', true),
    (_user_id, 'studio.stage',         'Stage changes',         'Studio: stage multi-file edits into the mission''s changeset. DB-only, no GitHub write.', 'write', 'auto', true),
    (_user_id, 'studio.commit',        'Commit changeset',      'Studio: commit ALL staged changes to an isolated studio/* branch via the Git Data API. Confirm-gated.', 'write', 'confirm', true),
    (_user_id, 'studio.pr.open',       'Open Studio PR',        'Studio: open a multi-file pull request from the changeset branch. Confirm-gated.', 'write', 'confirm', true),
    (_user_id, 'studio.pr.merge',      'Merge Studio PR',       'Studio: merge the changeset PR (squash). Review-gated, closes the loop in-platform.', 'write', 'review', true),
    (_user_id, 'studio.revert',        'Roll back release',     'Studio: roll back a merged release by synthesizing an inverse changeset. Flows through commit, PR, CI gate, merge. Review-gated.', 'write', 'review', true),
    -- BLD-04: external coding-agent delegation via OpenHands (Railway self-hosted).
    -- review mode: always pauses for human approval before any task leaves Cadence.
    (_user_id, 'delegate.openhands',   'Delegate to OpenHands', 'Delegate a build task to an external OpenHands coding agent working against a connected repo. Always requires human approval before the task leaves Cadence. Folds the result back into the mission when done.', 'write', 'review', true)
  ON CONFLICT (user_id, tool_name) DO NOTHING;
END;
$function$;

-- Backfill all existing users who don't yet have the delegate.openhands row.
INSERT INTO public.agent_tools (user_id, tool_name, display_name, description, category, mode, built_in)
SELECT p.id,
       'delegate.openhands',
       'Delegate to OpenHands',
       'Delegate a build task to an external OpenHands coding agent working against a connected repo. Always requires human approval before the task leaves Cadence. Folds the result back into the mission when done.',
       'write',
       'review',
       true
FROM public.profiles p
ON CONFLICT (user_id, tool_name) DO NOTHING;
