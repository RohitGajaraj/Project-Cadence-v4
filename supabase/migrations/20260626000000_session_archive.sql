-- SESSION-ORG — soft-archive for Build sessions (missions), + the memory-safe
-- deletion contract.
--
-- Run management gives the operator a three-dots menu on each Build session:
--   • Archive (soft)  — hide from the list, fully reversible, KEEPS EVERYTHING.
--   • Delete  (hard)  — removes the build's working artifacts.
--
-- WHY this is moat-safe (memory is the product's moat, so deletion must never
-- silently erase it): the existing FK rules on missions(id) already encode the
-- right contract — deleting a mission CASCADEs only the raw work product
--   (mission_steps, studio_changesets→studio_changes, agent_messages)
-- while DECISIONS are `ON DELETE SET NULL` — the typed decision/outcome memory
-- SURVIVES a delete (it just detaches from the gone build). So "delete a build"
-- removes the working log, never what was learned. Forgetting memory is a
-- separate, deliberate act, never a side effect of housekeeping.
-- Full rationale: docs/decisions/memory-on-delete.md.
--
-- This migration only adds the soft-archive marker. Archive (UPDATE archived_at)
-- and Delete (DELETE) are both already permitted to the owner by the existing
-- "Owners can write their missions" ALL policy, so no new RLS is needed.

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.missions.archived_at IS
  'SESSION-ORG: when set, the session is soft-archived (hidden from the default Build list, fully reversible). NULL = active.';

-- Partial index: the Build list filters to active (archived_at IS NULL) sessions
-- per owner; keep that read cheap as session history grows.
CREATE INDEX IF NOT EXISTS idx_missions_user_active
  ON public.missions (user_id, updated_at DESC)
  WHERE archived_at IS NULL;
