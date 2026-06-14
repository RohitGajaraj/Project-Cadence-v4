-- v6 M1 · H1 — PRD → engineering task-graph. The Planner step: a spec is
-- decomposed into a dependency-ordered set of engineering tasks agents can
-- execute. `tasks` already carries prd_id / estimate_hours / assignee_kind /
-- agent_id / priority / status; this adds the GRAPH dimensions so a generated
-- plan is a DAG (not a flat list):
--   seq        — order within the PRD's graph (1-based)
--   depends_on — jsonb array of the seq numbers this task waits on (the edges)
--   risk       — a short risk flag the Planner raised (nullable)
--   detail     — a one-line task description (tasks had only `title`)
-- Generated-graph rows are identifiable by `seq IS NOT NULL`, so re-generating
-- replaces the prior graph without touching manually-added tasks.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS seq        int,
  ADD COLUMN IF NOT EXISTS depends_on jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risk       text,
  ADD COLUMN IF NOT EXISTS detail     text;
