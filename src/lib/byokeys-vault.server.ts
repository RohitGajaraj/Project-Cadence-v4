// BYO API key vault helpers — encrypt at rest via the connector AES-256-GCM
// vault, decrypt at use. The legacy plaintext `api_key` column was dropped from
// user_api_keys (migration 20260620211507) once all rows moved to the cipher
// columns, so this module reads/writes ONLY the encrypted columns.
// Server-only (uses CONNECTOR_SECRETS_KEY).
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "@/lib/connectors/crypto.server";

type KeyRow = {
  api_key_cipher: string | null;
  api_key_iv: string | null;
  key_version: number | null;
  base_url: string | null;
};

/**
 * Load the plaintext BYO key for a (user, provider) by decrypting the stored
 * cipher columns. Returns the decrypted key AND the stored `base_url` (so the live
 * call path can dispatch to a custom OpenAI-compatible endpoint, not just the
 * test path), or null when there is no row or it can't be decrypted.
 *
 * MODEL-AGNOSTIC: returning `base_url` is additive — existing callers that read
 * only `.api_key` (e.g. rag/embed.server.ts) are unaffected.
 */
export async function loadBYOKey(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
): Promise<{ api_key: string; base_url: string | null } | null> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("api_key_cipher,api_key_iv,key_version,base_url")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  const row = (data as KeyRow | null) ?? null;
  if (!row) return null;
  if (row.api_key_cipher && row.api_key_iv) {
    try {
      const pt = await decryptSecret({
        ciphertext: row.api_key_cipher,
        iv: row.api_key_iv,
        keyVersion: row.key_version,
      });
      return { api_key: pt, base_url: row.base_url ?? null };
    } catch (e) {
      console.error("[byokeys] decrypt failed", e);
    }
  }
  return null;
}

/**
 * Build the columns to upsert when saving a BYO key: the AES-GCM cipher + iv +
 * key version + a short non-secret prefix for display. The plaintext column no
 * longer exists, so nothing plaintext is written.
 */
export async function buildEncryptedKeyColumns(plaintext: string): Promise<{
  api_key_cipher: string;
  api_key_iv: string;
  key_version: number;
  api_key_prefix: string;
}> {
  const { ciphertext, iv, keyVersion } = await encryptSecret(plaintext);
  return {
    api_key_cipher: ciphertext,
    api_key_iv: iv,
    key_version: keyVersion,
    api_key_prefix: plaintext.slice(0, 4),
  };
}
