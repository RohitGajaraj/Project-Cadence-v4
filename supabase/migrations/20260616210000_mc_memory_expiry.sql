-- M-C: memory expiry (the monetization mechanic from v7 section 9).
--
-- Free workspaces keep distilled memory for 14 days, then it expires; pro/team
-- keep it forever. This is the core "charge for memory persistence" gate (founder
-- course-correction #3). Depends on workspaces.plan_tier (migration 20260616200000,
-- which applies first).
--
-- Design: a BEFORE INSERT trigger stamps expires_at from the OWNER's plan, so the
-- TS write path is unchanged and stays pre-migration tolerant (until this applies
-- the column does not exist and no code references it). The recall RPC hard-filters
-- expired rows, and memory-tick (the daily cron) hard-deletes them. Existing rows
-- are grandfathered (expires_at stays NULL = never expires) so the feature never
-- retroactively wipes anyone's memory, including the demo seed.

ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Partial index: the recall filter and the sweep only ever look at non-null rows.
CREATE INDEX IF NOT EXISTS agent_memory_expires_at_idx
  ON public.agent_memory (expires_at)
  WHERE expires_at IS NOT NULL;

-- Stamp expiry on insert from the owner's plan. 14 days mirrors
-- FREE_MEMORY_RETENTION_DAYS in src/lib/entitlements.ts (keep the two in sync).
CREATE OR REPLACE FUNCTION public.set_agent_memory_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid boolean;
BEGIN
  -- ONLY the service-role may pin an explicit expires_at (e.g. a permanent row).
  -- For every other caller the value is recomputed from the plan and any
  -- client-supplied expires_at is ignored, so a free user cannot self-grant
  -- permanent memory by inserting a far-future timestamp via PostgREST.
  IF coalesce(auth.role(), '') = 'service_role' AND NEW.expires_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Paid if the memory's owner is a MEMBER (owner or invited) of any pro/team
  -- workspace, not only the workspace owner, so team members keep their memory.
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = NEW.user_id AND w.plan_tier IN ('pro', 'team')
  ) INTO v_paid;
  IF v_paid THEN
    NEW.expires_at := NULL;  -- paid: never expires (overrides any client value)
  ELSE
    -- Free tier: memory expires 14 days after it is created.
    NEW.expires_at := COALESCE(NEW.created_at, now()) + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_agent_memory_expiry ON public.agent_memory;
CREATE TRIGGER trg_set_agent_memory_expiry
  BEFORE INSERT ON public.agent_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agent_memory_expiry();

-- Recall hard-filters expired memory (belt-and-suspenders with the daily sweep,
-- so an expired free memory is never recalled even between sweeps). Body copied
-- verbatim from 20260614091000 with the single expiry predicate added.
CREATE OR REPLACE FUNCTION public.match_agent_memory(
  query_embedding vector(1536),
  for_user uuid,
  for_agent_slug text DEFAULT NULL,
  match_count integer DEFAULT 6
) RETURNS TABLE (
  id uuid, content text, kind text, importance integer,
  agent_slug text, similarity double precision
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.id, m.content, m.kind, m.importance, m.agent_slug,
         1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.user_id = COALESCE(auth.uid(), for_user)
    AND m.embedding IS NOT NULL
    AND (m.expires_at IS NULL OR m.expires_at > now())
    AND (for_agent_slug IS NULL OR m.agent_slug = for_agent_slug OR m.scope = 'global')
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, uuid, text, integer) TO service_role;
