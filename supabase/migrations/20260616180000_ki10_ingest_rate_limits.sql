-- KI-10 — Rate limiting for the public ingest endpoint.
--
-- Tracks request counts per ingest token in a rolling 1-hour window.
-- The ingest-ratelimit.server.ts checker enforces a 100 signals/hour cap.

CREATE TABLE IF NOT EXISTS public.ingest_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL UNIQUE,
  request_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_token_id
    FOREIGN KEY (token_id)
    REFERENCES public.ingest_tokens(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ingest_rate_limits_token ON public.ingest_rate_limits (token_id);
CREATE INDEX IF NOT EXISTS idx_ingest_rate_limits_window ON public.ingest_rate_limits (window_start DESC);

-- Basic RLS: no direct SELECT/UPDATE/DELETE; the checker uses service-role.
GRANT SELECT, INSERT, UPDATE ON public.ingest_rate_limits TO service_role;
ALTER TABLE public.ingest_rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny all unauthenticated access.
CREATE POLICY "ingest_rate_limits deny authenticated" ON public.ingest_rate_limits
  FOR ALL USING (false);
