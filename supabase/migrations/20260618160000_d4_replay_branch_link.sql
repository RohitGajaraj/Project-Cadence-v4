-- D4-REPLAY: track which mission a replay branched from.
--
-- "Replay-and-branch" re-runs a mission's goal as a NEW mission (optionally with
-- a different model). This column records the parent so the cockpit can show
-- "Replayed from <original>" and a future checkpoint-diff (D4b) can line the two
-- runs up. Additive, nullable, idempotent: applying it commits no behavior
-- change and costs nothing. ON DELETE SET NULL so deleting an original never
-- orphans or cascades into its replays.
--
-- Pre-migration tolerance: the app sets this column on replay inside a
-- try/catch and reads it via a separate error-tolerant select, so both paths
-- degrade cleanly until this migration applies via Lovable sync.

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS replayed_from_mission_id uuid
  REFERENCES public.missions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_missions_replayed_from
  ON public.missions (replayed_from_mission_id)
  WHERE replayed_from_mission_id IS NOT NULL;
