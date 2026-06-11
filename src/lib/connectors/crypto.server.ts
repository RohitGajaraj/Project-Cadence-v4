// F-CONN Phase 1 — connector secret vault crypto (server-only).
// WebCrypto AES-256-GCM; key comes from CONNECTOR_SECRETS_KEY (base64, 32 bytes,
// wrangler secret). The key is read lazily so an unconfigured environment never
// throws at import time — only when encryption/decryption is actually attempted.

const KEY_VERSION = 1;

// ---- base64 helpers (shared by github.server.ts for JWT/state encoding) ----

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return base64ToBytes(b64 + pad);
}

// ---- AES-256-GCM vault ----

async function vaultKey(): Promise<CryptoKey> {
  const raw = process.env.CONNECTOR_SECRETS_KEY;
  if (!raw) {
    throw new Error(
      "CONNECTOR_SECRETS_KEY is not set — connector secret vault is setup pending. Generate one with `openssl rand -base64 32` and add it as a server secret.",
    );
  }
  const bytes = base64ToBytes(raw.trim());
  if (bytes.length !== 32) {
    throw new Error(
      `CONNECTOR_SECRETS_KEY must be base64 for exactly 32 bytes (got ${bytes.length}).`,
    );
  }
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(
  plaintext: string,
): Promise<{ ciphertext: string; iv: string; keyVersion: number }> {
  const key = await vaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
    keyVersion: KEY_VERSION,
  };
}

export async function decryptSecret(args: {
  ciphertext: string;
  iv: string;
  keyVersion?: number | null;
}): Promise<string> {
  if (args.keyVersion != null && args.keyVersion !== KEY_VERSION) {
    throw new Error(`Unsupported connector secret key_version ${args.keyVersion}.`);
  }
  const key = await vaultKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(args.iv) },
    key,
    base64ToBytes(args.ciphertext),
  );
  return new TextDecoder().decode(pt);
}
