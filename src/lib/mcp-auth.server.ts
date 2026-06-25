// Shared bearer-token validation + rate-limiting for MCP and A2A routes.
// Extracted so both transports use identical auth without code duplication.
import crypto from "crypto";

interface TokenRow {
  id: string;
  workspace_id: string;
  user_id: string;
  rate_limit_per_min: number;
  revoked_at: string | null;
  scopes: string[] | null;
}

export interface TokenValidationResult {
  valid: boolean;
  token_id?: string;
  workspace_id?: string;
  user_id?: string;
  rate_limit_per_min?: number;
  scopes?: string[];
  error?: string;
}

/**
 * Parse a bearer token from an Authorization header (format: "Bearer slug:secret").
 * Returns { slug, secretHash } on success, null on malformed input.
 */
export function parseBearerToken(
  authHeader: string | null,
): { slug: string; secretHash: string } | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7).trim();
  const colonIdx = raw.indexOf(":");
  if (colonIdx < 1) return null;
  const slug = raw.slice(0, colonIdx);
  const secret = raw.slice(colonIdx + 1);
  if (!slug || !secret) return null;
  const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
  return { slug, secretHash };
}

/**
 * Validate an MCP/A2A bearer token against the mcp_tokens table.
 * Degrades gracefully when the `scopes` column is absent (split-deploy safety):
 * if PostgREST returns a 42703 undefined_column error, re-selects without
 * `scopes` and defaults to read-only (scopes = []).
 */
export async function validateToken(
  supabase: any,
  slug: string,
  secretHash: string,
): Promise<TokenValidationResult> {
  const selectToken = (cols: string) =>
    supabase
      .from("mcp_tokens")
      .select(cols)
      .eq("slug", slug)
      .eq("secret_hash", secretHash)
      .is("revoked_at", null)
      .maybeSingle();
  try {
    let { data: token, error } = await selectToken(
      "id, workspace_id, user_id, rate_limit_per_min, revoked_at, scopes",
    );
    if (error && (error.code === "42703" || /scopes/i.test(error.message ?? ""))) {
      ({ data: token, error } = await selectToken(
        "id, workspace_id, user_id, rate_limit_per_min, revoked_at",
      ));
    }
    if (error) return { valid: false, error: "Token lookup failed" };
    const tokenRow = token as TokenRow | null;
    if (!tokenRow) return { valid: false, error: "Invalid token" };
    return {
      valid: true,
      token_id: tokenRow.id,
      workspace_id: tokenRow.workspace_id,
      user_id: tokenRow.user_id,
      rate_limit_per_min: tokenRow.rate_limit_per_min,
      scopes: Array.isArray(tokenRow.scopes) ? tokenRow.scopes : [],
    };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Check if a token has exceeded its per-minute rate limit.
 * Fails open on DB error (availability over strictness).
 */
export async function checkRateLimit(
  supabase: any,
  token_id: string,
  rate_limit: number,
): Promise<{ allowed: boolean; current_count: number }> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count, error } = await supabase
      .from("api_calls")
      .select("*", { count: "exact", head: true })
      .eq("token_id", token_id)
      .gte("created_at", oneMinuteAgo);
    if (error) {
      console.error("Rate limit check failed:", error);
      return { allowed: true, current_count: 0 };
    }
    return { allowed: (count || 0) < rate_limit, current_count: count || 0 };
  } catch {
    return { allowed: true, current_count: 0 };
  }
}

/**
 * Resolve the global outward-write gate. Fails CLOSED so a DB error never
 * accidentally enables writes.
 */
export async function resolveWriteEnabled(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("interop_write_enabled");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
