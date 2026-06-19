-- WM-M15b: Response cache for repeated identical AI calls
-- A content-hash cache serves repeated identical calls from cache, avoiding provider calls
-- and their full COGS. This is a direct margin win that never overrides the caller's
-- model choice (unlike routing), making it safer to apply broadly.

-- Cache store: user_id + model + cache_key (SHA256 of normalized messages + responseFormat)
-- + response metadata (tokens, output_text) + TTL (default 7 days, conservative).
-- RLS: user can only read their own cache entries (and only during their own calls).
-- Note: This table is append-only in this migration (cache writes happen at the chokepoint,
-- cache reads + deletes of expired entries happen at the chokepoint).
CREATE TABLE ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model text NOT NULL,
  cache_key text NOT NULL,
  prompt_tokens integer NOT NULL,
  completion_tokens integer NOT NULL,
  output_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT positive_tokens CHECK (prompt_tokens >= 0 AND completion_tokens >= 0)
);

-- Composite index for efficient cache lookups: (user_id, model, cache_key, created_at DESC).
-- A single index scan finds the most recent entry for a key; the expires_at comparison is
-- a residual filter at query time. NOTE: a partial WHERE expires_at > now() predicate is NOT
-- used because now() is STABLE (not IMMUTABLE) and Postgres rejects it in an index predicate
-- (ERROR 42P17) — that defect made the originally shipped migration fail to apply.
CREATE INDEX idx_ai_response_cache_lookup ON ai_response_cache
  (user_id, model, cache_key, created_at DESC);

-- Index for cleanup: find expired entries efficiently (plain index; the same now()-in-predicate
-- limitation applies, so the expiry comparison is done at query time against this index).
CREATE INDEX idx_ai_response_cache_expired ON ai_response_cache (expires_at);

-- RLS: Disable RLS (service-role only writes; users never query the cache directly).
-- The chokepoint (runtime.server.ts) reads + writes on service-role, so no user RLS policy needed.
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;

-- No RLS policy: service-role-only table. Users never query it directly; the chokepoint
-- (runtime.server.ts) reads + writes on service-role.

COMMENT ON TABLE ai_response_cache IS 'Cache for repeated identical AI calls (model + messages + responseFormat). Service-role-only writes. Read at the chokepoint before provider calls.';
COMMENT ON COLUMN ai_response_cache.cache_key IS 'SHA256 hash of (model, normalized messages, responseFormat). Used as cache lookup key.';
COMMENT ON COLUMN ai_response_cache.expires_at IS 'TTL boundary; cache is valid only while expires_at > now(). Default 7 days.';
