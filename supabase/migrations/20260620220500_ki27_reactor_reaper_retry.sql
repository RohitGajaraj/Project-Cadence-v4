-- KI-27: event-reactor staleness reaper + bounded retry.
--
-- KI-28 added a claim-first CAS so overlapping ticks can't double-dispatch, but it
-- reused the 'dispatched' status as the claim, leaving two residual gaps:
--   (a) an event claimed then lost to worker eviction before its terminal flip
--       stays 'dispatched'/claimed forever with no reaper to recover it;
--   (b) a transiently-failing dispatch is set terminal 'failed' with no retry.
--
-- This migration adds a dedicated 'processing' claim status plus retry-tracking
-- columns so the reactor can: claim pending->processing, reap rows stuck
-- 'processing' past a TTL, and bound-retry a failed dispatch (exponential backoff
-- via next_attempt_at) up to a cap before terminalizing 'failed'.
--
-- DROP-then-recreate the CHECK per the migration-safety rule. Verified by a
-- BEGIN..ROLLBACK dry-run on the live prod DB via the Lovable MCP before commit
-- (CHECK renders with 'processing'; columns + index add cleanly).

ALTER TABLE public.event_queue DROP CONSTRAINT IF EXISTS event_queue_status_check;
ALTER TABLE public.event_queue ADD CONSTRAINT event_queue_status_check
  CHECK (status = ANY (ARRAY['pending', 'processing', 'dispatched', 'skipped', 'failed']));

ALTER TABLE public.event_queue ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.event_queue ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

-- The cron tick selects pending rows whose backoff has elapsed; this index serves
-- both that filter and the reaper's status='processing' scan.
CREATE INDEX IF NOT EXISTS event_queue_pending_idx ON public.event_queue (status, next_attempt_at);
