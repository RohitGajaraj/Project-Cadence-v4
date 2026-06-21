-- FND-0.5: per-agent blast-radius cap (max_tool_risk).
--
-- A per-agent ceiling on the blast radius of the tools an agent may call. The agent loop drops
-- any enabled tool whose static blast-radius tier (reversibility x scope, see tool-consequences.ts)
-- exceeds this cap, so a scoped agent cannot reach beyond its remit — stricter than the global
-- min-confirm floor (which only gates high-blast tools; this removes them from the agent entirely).
--
-- Nullable, no backfill: NULL = unrestricted = today's behavior, so existing agents are unchanged.
-- RLS is already enforced by the agents table's "own agents all" policy (auth.uid() = user_id),
-- which covers this new column with no policy change.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS max_tool_risk text
  CHECK (max_tool_risk IS NULL OR max_tool_risk IN ('low', 'medium', 'high'));
