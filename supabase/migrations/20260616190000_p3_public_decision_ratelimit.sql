-- Phase 3: per-IP rate limit for the public shareable-decision page (/d/<slug>).
--
-- Closes the one deferred gate on the viral loop before heavy promotion: the
-- anonymous getPublicDecision read is now capped per client IP via a rolling
-- window, mirroring KI-10's ingest_rate_limits table.
--
-- Slugs are unguessable 32-hex CSPRNG values, so this is anti-abuse / anti-DoS
-- of the public SSR read, NOT anti-enumeration. Keyed by client_ip (text), not
-- a token FK. Service-role only; src/lib/decisions-ratelimit.server.ts writes
-- via supabaseAdmin and fails OPEN on any DB error, so a limiter-table outage
-- never makes a legitimate shared link 404.

CREATE TABLE IF NOT EXISTS public.public_decision_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip text NOT NULL UNIQUE,
  request_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_decision_rate_limits_window
  ON public.public_decision_rate_limits (window_start DESC);

-- Service-role only; the checker uses supabaseAdmin. (service_role bypasses RLS,
-- so the policy below governs the anon/authenticated roles, which never touch it.)
-- DELETE granted so a future periodic prune can drop stale rows (rows accumulate
-- at O(unique IPs seen); window resets happen in-place via upsert, no auto-prune yet).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_decision_rate_limits TO service_role;
ALTER TABLE public.public_decision_rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny all non-service-role access.
CREATE POLICY "public_decision_rate_limits deny all"
  ON public.public_decision_rate_limits
  FOR ALL USING (false);
