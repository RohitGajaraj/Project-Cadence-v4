// BYO API key vault helpers — encrypt at rest via the connector AES-256-GCM
// vault, decrypt at use. Legacy rows that still have a plaintext `api_key`
// value are returned as-is so the runtime keeps working during the rollover.
// Server-only (uses CONNECTOR_SECRETS_KEY).
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "@/lib/connectors/crypto.server";

type KeyRow = {
  api_key: string | null;
  api_key_cipher: string | null;
  api_key_iv: string | null;
  key_version: number | null;
};

/**
 * Load the plaintext BYO key for a (user, provider). Prefers the encrypted
 * cipher columns; falls back to a legacy plaintext row if present.
 */
export async function loadBYOKey(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
): Promise<{ api_key: string } | null> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("api_key,api_key_cipher,api_key_iv,key_version")
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
      return { api_key: pt };
    } catch (e) {
      console.error("[byokeys] decrypt failed; falling back to legacy plaintext", e);
    }
  }
  return row.api_key ? { api_key: row.api_key } : null;
}

/**
 * Build the columns to upsert when saving a BYO key. Encrypts the plaintext
 * and stores cipher + iv + version + short prefix; the legacy `api_key`
 * column is explicitly null'd so plaintext is not retained at rest.
 */
export async function buildEncryptedKeyColumns(plaintext: string): Promise<{
  api_key: null;
  api_key_cipher: string;
  api_key_iv: string;
  key_version: number;
  api_key_prefix: string;
}> {
  const { ciphertext, iv, keyVersion } = await encryptSecret(plaintext);
  return {
    api_key: null,
    api_key_cipher: ciphertext,
    api_key_iv: iv,
    key_version: keyVersion,
    api_key_prefix: plaintext.slice(0, 4),
  };
}