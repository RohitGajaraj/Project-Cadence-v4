import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// F-V5-INGEST-WEBHOOK — per-workspace ingest-token management for the public
// /api/public/ingest-signals webhook. One active token per workspace
// (active = revoked_at IS NULL); rotation revokes before inserting. Tokens are
// stored as SHA-256 hashes (+ short prefix for UI preview); the plaintext is
// shown ONCE in the rotate response and never persisted in the database.
// public.ingest_tokens is not yet in the generated Database types, so these
// handlers use the untyped-client cast precedent (see outcome.functions.ts).

const TOKEN_COLUMNS = "id,token_prefix,label,created_at";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The workspace's active ingest token (newest, revoked_at IS NULL), or null. */
export const getIngestToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data, error } = await db
      .from("ingest_tokens")
      .select(TOKEN_COLUMNS)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { token: data ?? null };
  });

/** Revoke any active token and mint a fresh one (64-char crypto-random hex). */
export const rotateIngestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    // RLS (is_workspace_member) scopes this to the caller's workspace tokens.
    const { error: revokeError } = await db
      .from("ingest_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .is("revoked_at", null);
    if (revokeError) throw new Error(revokeError.message);

    const token = randomBytes(32).toString("hex");
    const token_hash = hashToken(token);
    const token_prefix = token.slice(0, 8);
    // workspace_id lands via the current_user_default_workspace() column default.
    const { data, error } = await db
      .from("ingest_tokens")
      .insert({ user_id: context.userId, token_hash, token_prefix })
      .select(TOKEN_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    // Return the plaintext token ONCE so the user can copy it; never persisted.
    return { token: { ...(data as Record<string, unknown>), token } };
  });

/** Revoke the active token without minting a replacement. */
export const revokeIngestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { error } = await db
      .from("ingest_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
