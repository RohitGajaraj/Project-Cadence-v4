-- F-DESIGN-EMBER screen 3 (Brain/Chat): persist the AI message meta so the
-- footer contract (judge · model · latency · tokens · cost · sources) survives
-- reloads and refetches. Previously meta was stream-only and every refetch
-- wiped footers + citation badges, breaking the DESIGN.md non-negotiable
-- "every AI utterance carries its footer".
--
-- Additive + nullable: old rows simply render no footer. RLS on
-- public.messages is unchanged (column rides the existing row policies).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;
