-- Ensure user_api_keys has the AES-GCM cipher columns the BYO-key vault writes.
--
-- The original f_conn migration (20260612080000) defined api_key_cipher / api_key_iv / key_version,
-- but they are absent on at least one live database (schema drift: a BYO-key save failed with
-- "Could not find the 'api_key_cipher' column of 'user_api_keys' in the schema cache", while the
-- later api_key_prefix add + api_key drop had been applied). This re-asserts the columns idempotently
-- so the vault (byokeys-vault.server.ts: buildEncryptedKeyColumns / loadBYOKey) can write + read them.
--
-- Safe + idempotent: ADD COLUMN IF NOT EXISTS adds nullable columns only (no data loss, no RLS
-- change). api_key_prefix is included defensively (no-op where it already exists). RLS on
-- user_api_keys ("own api keys all", auth.uid() = user_id) covers the new columns with no change.
ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS api_key_cipher text,
  ADD COLUMN IF NOT EXISTS api_key_iv text,
  ADD COLUMN IF NOT EXISTS key_version int,
  ADD COLUMN IF NOT EXISTS api_key_prefix text;

-- Refresh PostgREST's schema cache so the columns are immediately writable via the API.
NOTIFY pgrst, 'reload schema';
