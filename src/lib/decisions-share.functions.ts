// v6 Phase 3 — the shareable-decision viral loop (server functions).
//
// Three fns: getDecisionShareState + setDecisionShared are AUTHED (owner toggles
// a decision public/private — RLS guarantees ownership); getPublicDecision is
// PUBLIC (no auth) and powers the anonymous /d/<slug> route.
//
// SECURITY (getPublicDecision): the boundary is at the DATABASE WIRE, not here.
// The migration grants anon SELECT on ONLY the safe columns (so user_id /
// workspace_id / *_id are never readable — even by a direct PostgREST call with
// the bundled anon key) and an RLS policy scoped TO anon limits reads to is_public
// rows. This function's select is a convenience projection, NOT the gate (an
// app-side allow-list cannot constrain a direct REST caller). Returns null for
// not-found/private.
//
// PRE-MIGRATION TOLERANT: the share columns land on the next Lovable sync. Until
// then the authed fns report { available: false } and the public read returns
// null — nothing throws.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as anonSupabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkPublicDecisionRateLimit } from "@/lib/decisions-ratelimit.server";

/**
 * Resolve the caller's IP for the per-IP public-read rate limit. Cloudflare
 * Workers sets cf-connecting-ip and overwrites it before forwarding, so a client
 * cannot spoof it: that is the trustworthy production key. x-forwarded-for and
 * x-real-ip are dev / non-CF fallbacks only (a client CAN set those outside a CF
 * Workers context); they are acceptable here because the limiter fails open.
 * Returns null when no request context / header resolves, which skips the limit.
 */
function getClientIp(): string | null {
  try {
    const cf = getRequestHeader("cf-connecting-ip");
    if (cf) return cf.trim();
    const xff = getRequestHeader("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() || null;
    const xreal = getRequestHeader("x-real-ip");
    if (xreal) return xreal.trim();
  } catch {
    // no active request context (e.g. prerender), so fail open.
  }
  return null;
}

function isMissingShareColumn(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  const code = e.code;
  return (
    code === "42703" || // undefined_column
    code === "42P01" || // undefined_table
    code === "PGRST204" ||
    code === "PGRST205" ||
    /column .* does not exist|could not find the .* column/i.test(e.message ?? "")
  );
}

export type DecisionShareState = {
  /** false until the share columns are applied on the live DB (next Lovable sync). */
  available: boolean;
  is_public: boolean;
  share_slug: string | null;
};

/** Authed — the current share state for a decision the caller owns. Tolerant. */
export const getDecisionShareState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<DecisionShareState> => {
    const { data: row, error } = await context.supabase
      .from("decisions")
      .select("share_slug,is_public")
      .eq("id", data.id)
      .maybeSingle();
    if (error) {
      if (isMissingShareColumn(error))
        return { available: false, is_public: false, share_slug: null };
      throw new Error(error.message);
    }
    const r = (row ?? {}) as { share_slug?: string | null; is_public?: boolean };
    return { available: true, is_public: !!r.is_public, share_slug: r.share_slug ?? null };
  });

/** Authed — make a decision public/private. RLS ensures the caller owns it. Tolerant. */
export const setDecisionShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), isPublic: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<DecisionShareState> => {
    const { data: row, error } = await context.supabase
      .from("decisions")
      // `as never` escapes the pre-migration generated types (the column lands on sync).
      .update({ is_public: data.isPublic } as never)
      .eq("id", data.id)
      .select("share_slug,is_public")
      .maybeSingle();
    if (error) {
      if (isMissingShareColumn(error))
        return { available: false, is_public: false, share_slug: null };
      throw new Error(error.message);
    }
    const r = (row ?? {}) as { share_slug?: string | null; is_public?: boolean };
    return { available: true, is_public: !!r.is_public, share_slug: r.share_slug ?? null };
  });

export type PublicDecision = {
  title: string;
  rationale: string | null;
  status: string;
  decided_by_agent_slug: string | null;
  created_at: string;
};

/** PUBLIC (no auth) — the safe, minimal projection behind /d/<slug>. */
export const getPublicDecision = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(6).max(64) }).parse(i))
  .handler(async ({ data }): Promise<PublicDecision | null> => {
    // Per-IP anti-abuse guard (Phase 3). Runs BEFORE the read so a hammering
    // client can't even reach the DB. Fail-open: only blocks when we both
    // resolve a client IP AND it has exceeded the rolling cap. A blocked caller
    // sees the same "not available" page as a private/missing slug, which is fine
    // because slugs are unguessable, so this is anti-DoS, not anti-enumeration.
    try {
      const ip = getClientIp();
      if (ip) {
        const rl = await checkPublicDecisionRateLimit(
          supabaseAdmin as unknown as SupabaseClient,
          ip,
        );
        if (!rl.allowed) return null;
      }
    } catch {
      // never let the limiter break a legitimate read.
    }

    try {
      const { data: row, error } = await anonSupabase
        .from("decisions")
        // SAFE ALLOW-LIST ONLY — never user_id / workspace_id / linked-entity ids, never a join.
        .select("title,rationale,status,decided_by_agent_slug,created_at,is_public")
        .eq("share_slug", data.slug)
        .eq("is_public", true)
        .maybeSingle();
      if (error || !row) return null;
      const r = row as PublicDecision & { is_public?: boolean };
      if (!r.is_public) return null; // belt-and-suspenders over the RLS gate
      return {
        title: r.title,
        rationale: r.rationale ?? null,
        status: r.status,
        decided_by_agent_slug: r.decided_by_agent_slug ?? null,
        created_at: r.created_at,
      };
    } catch {
      return null;
    }
  });
