-- SF-FOCUS (Signal Fabric Phase 1): theme scoring + novelty-vs-memory + the insights table.
--
-- Turns clustered themes into a ranked "Focus on this next" recommendation. Adds the
-- scoring inputs to themes (embedding + novelty), a match_themes RPC (the "have we seen
-- this before" query, twin of match_agent_memory), and an insights table for the derived
-- "Focus next" cards. Additive + idempotent; zero behaviour change on apply (the read path
-- is lazy and the auto-derive flag is dormant by default).

-- (a) Theme scoring columns + HNSW index (mirrors signals.embedding + the f3 additive idiom).
ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS embedding      vector(1536),
  ADD COLUMN IF NOT EXISTS novelty        real,         -- 0..1 (1 = unseen vs memory + prior themes)
  ADD COLUMN IF NOT EXISTS novelty_basis  jsonb,        -- {maxSim, maxMemorySim, maxThemeSim, memId, themeId}
  ADD COLUMN IF NOT EXISTS scored_at      timestamptz,  -- when novelty/embedding were last computed
  ADD COLUMN IF NOT EXISTS last_signal_at timestamptz;  -- newest member-signal time (recency basis)

CREATE INDEX IF NOT EXISTS themes_embedding_hnsw
  ON public.themes USING hnsw (embedding vector_cosine_ops);

-- (b) match_themes: cosine-nearest prior themes for a query embedding (clone of
--     match_agent_memory; exclude_id so a theme never matches itself).
CREATE OR REPLACE FUNCTION public.match_themes(
  query_embedding vector(1536),
  for_user        uuid,
  exclude_id      uuid    DEFAULT NULL,
  match_count     integer DEFAULT 6
) RETURNS TABLE (id uuid, title text, summary text, similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id, t.title, t.summary,
         1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.themes t
  WHERE t.user_id = COALESCE(auth.uid(), for_user)
    AND t.embedding IS NOT NULL
    AND (exclude_id IS NULL OR t.id <> exclude_id)
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
$$;
REVOKE EXECUTE ON FUNCTION public.match_themes(vector, uuid, uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.match_themes(vector, uuid, uuid, integer) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.match_themes(vector, uuid, uuid, integer) TO service_role;

-- (c) insights: the derived "Focus on this next" cards (workspace-scoped, dedup'd per day).
CREATE TABLE IF NOT EXISTS public.insights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  workspace_id  uuid NOT NULL DEFAULT public.current_user_default_workspace()
                  REFERENCES public.workspaces (id) ON DELETE CASCADE,
  product_id    uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  theme_id      uuid REFERENCES public.themes (id) ON DELETE SET NULL,
  kind          text NOT NULL CHECK (kind IN
                  ('prediction','risk','next_best_action','cost_of_inaction','hidden_connection')),
  headline      text NOT NULL,
  detail        text NOT NULL DEFAULT '',
  evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_action jsonb,                  -- {agent_slug, goal}
  score         real,
  confidence    real,
  status        text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','acted','dismissed','expired')),
  dedup_key     text,                         -- e.g. 'next_best_action:<theme_id>:<yyyy-mm-dd>'
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Non-partial unique index so the getFocusNext upsert's ON CONFLICT (workspace_id, dedup_key)
-- matches it. NULL dedup_keys stay distinct (Postgres NULLS DISTINCT default), so insights
-- without a dedup_key still insert freely; uniqueness is enforced only on real keys.
CREATE UNIQUE INDEX IF NOT EXISTS insights_ws_dedup_idx
  ON public.insights (workspace_id, dedup_key);
CREATE INDEX IF NOT EXISTS insights_ws_status_idx
  ON public.insights (workspace_id, status, score DESC);

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights TO authenticated;
GRANT ALL ON public.insights TO service_role;

DROP POLICY IF EXISTS "insights ws read" ON public.insights;
CREATE POLICY "insights ws read" ON public.insights FOR SELECT
  USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insights ws write" ON public.insights;
CREATE POLICY "insights ws write" ON public.insights FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS insights_updated_at ON public.insights;
CREATE TRIGGER insights_updated_at BEFORE UPDATE ON public.insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- (d) Workspace auto-derive flag (dormant in Slice A; the read path derives lazily).
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_derive_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_derive_at  timestamptz;
CREATE INDEX IF NOT EXISTS idx_workspaces_auto_derive
  ON public.workspaces (auto_derive_enabled, last_auto_derive_at ASC NULLS FIRST)
  WHERE auto_derive_enabled = true;
