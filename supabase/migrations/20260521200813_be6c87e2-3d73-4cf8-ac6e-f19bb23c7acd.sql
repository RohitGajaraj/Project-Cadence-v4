
CREATE EXTENSION IF NOT EXISTS vector;

-- SIGNALS
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  source TEXT NOT NULL DEFAULT 'manual',
  title TEXT,
  content TEXT NOT NULL,
  url TEXT,
  sentiment TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  theme_id UUID,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own signals all" ON public.signals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX signals_user_idx ON public.signals(user_id);
CREATE INDEX signals_theme_idx ON public.signals(theme_id);

-- THEMES
CREATE TABLE public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  frequency INTEGER NOT NULL DEFAULT 0,
  severity INTEGER NOT NULL DEFAULT 3,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own themes all" ON public.themes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- OPPORTUNITIES
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  theme_id UUID,
  title TEXT NOT NULL,
  problem TEXT NOT NULL DEFAULT '',
  target_user TEXT,
  hypothesis TEXT,
  impact INTEGER NOT NULL DEFAULT 5,
  confidence INTEGER NOT NULL DEFAULT 5,
  ease INTEGER NOT NULL DEFAULT 5,
  ice_score NUMERIC GENERATED ALWAYS AS ((impact + confidence + ease)::numeric / 3) STORED,
  status TEXT NOT NULL DEFAULT 'backlog',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own opportunities all" ON public.opportunities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PRDs
CREATE TABLE public.prds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  opportunity_id UUID,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prds all" ON public.prds FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- match_signals RPC for semantic search
CREATE OR REPLACE FUNCTION public.match_signals(
  query_embedding vector(1536),
  match_count int DEFAULT 8,
  for_user uuid DEFAULT NULL
) RETURNS TABLE (id uuid, content text, title text, similarity float)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT s.id, s.content, s.title, 1 - (s.embedding <=> query_embedding) AS similarity
  FROM public.signals s
  WHERE s.embedding IS NOT NULL
    AND (for_user IS NULL OR s.user_id = for_user)
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;
