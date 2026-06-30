-- SF-AUTOTRIGGER (Phase 3): add auto_trigger_source to missions.
--
-- WHY: When BRAIN_AUTO_TRIGGER=1 and a proposed [auto] mission meets all
-- four eligibility conditions (reversible + ambient arc + daily cap), the
-- trigger-tick promotes it from 'proposed' to 'queued' automatically.
-- auto_trigger_source records that promotion so:
--   1. The daily-cap count can be derived by querying missions WHERE
--      auto_trigger_source='auto' AND updated_at >= today.
--   2. The Trust Ledger can show "auto-promoted" provenance on the receipt.
--   3. Operators can audit exactly which missions ran without human approval.
--
-- Column is nullable: NULL means human-initiated or HITL-promoted.
-- 'auto' means auto-promoted by the BRAIN_AUTO_TRIGGER path.
--
-- Chokepoint-free: no edit to loop.server.ts / runtime.server.ts /
-- registry.server.ts. Promotion is a DB status write in trigger-tick;
-- the resume-runs sweeper runs it exactly like any other queued mission.

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS auto_trigger_source text
  CHECK (auto_trigger_source IS NULL OR auto_trigger_source = 'auto');

COMMENT ON COLUMN public.missions.auto_trigger_source IS
  'Set to ''auto'' when the mission was auto-promoted proposed→queued by the BRAIN_AUTO_TRIGGER path. NULL for human-promoted missions.';

-- RLS: auto_trigger_source follows existing missions policies (no change needed;
-- members can read; owner/service-role can write).
