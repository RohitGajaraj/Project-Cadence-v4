CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP POLICY IF EXISTS "own ritual_sessions all" ON public.ritual_sessions;
CREATE POLICY "own ritual_sessions all" ON public.ritual_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.ingest_tokens
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS token_prefix text;

UPDATE public.ingest_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex'),
    token_prefix = left(token, 8)
WHERE token IS NOT NULL AND token_hash IS NULL;

ALTER TABLE public.ingest_tokens ALTER COLUMN token_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ingest_tokens_token_hash_key ON public.ingest_tokens (token_hash);

ALTER TABLE public.ingest_tokens DROP CONSTRAINT IF EXISTS ingest_tokens_token_key;
ALTER TABLE public.ingest_tokens DROP COLUMN IF EXISTS token;

DROP POLICY IF EXISTS "ingest_tokens ws read" ON public.ingest_tokens;
DROP POLICY IF EXISTS "ingest_tokens ws write" ON public.ingest_tokens;
DROP POLICY IF EXISTS "ingest_tokens owner read" ON public.ingest_tokens;
DROP POLICY IF EXISTS "ingest_tokens owner write" ON public.ingest_tokens;
CREATE POLICY "ingest_tokens owner read" ON public.ingest_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ingest_tokens owner write" ON public.ingest_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id))
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id));

ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS api_key_prefix text;

UPDATE public.user_api_keys
SET api_key_prefix = left(api_key, 4)
WHERE api_key IS NOT NULL AND api_key_prefix IS NULL;