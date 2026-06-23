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
import { isSupersessionRelation, type LineageEdgeLite } from "@/lib/trust-ledger.functions";

/** v1 provenance outcome surfaced on the public receipt — the honest "did it hold up?". */
export type PublicDecisionOutcome = "standing" | "superseded";

/**
 * PURE (TRUST-SHARE). The parent ids of ACTIVE supersedes/contradicts edges whose
 * child is one of the decision's own/source ids — i.e. the artifacts that overrode
 * this decision (same bitemporal rule as the Trust Ledger; a retired `valid_to`
 * edge is a reversal and is excluded). Returns the SUPERSEDERS so the caller can
 * gate disclosure on whether the superseder is itself public (privacy: a PRIVATE
 * override must never surface on a PUBLIC receipt).
 */
export function supersedingParentIds(
  childIds: (string | null | undefined)[],
  edges: LineageEdgeLite[] | null | undefined,
): string[] {
  const childSet = new Set(childIds.filter((x): x is string => typeof x === "string" && x !== ""));
  const parents = new Set<string>();
  for (const e of Array.isArray(edges) ? edges : []) {
    if (!e || !isSupersessionRelation(e.relation)) continue;
    const retired = typeof e.valid_to === "string" && e.valid_to.trim() !== "";
    if (retired) continue;
    if (typeof e.child_id === "string" && childSet.has(e.child_id) && typeof e.parent_id === "string" && e.parent_id) {
      parents.add(e.parent_id);
    }
  }
  return [...parents];
}

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
  /** TRUST-SHARE: the honest provenance outcome — does this call still stand? */
  outcome: PublicDecisionOutcome;
};

/**
 * Server-side (admin) supersession check for a public decision. Anon CANNOT read
 * `artifact_lineage` (its RLS is workspace-membership), so the boolean is computed
 * here and ONLY the safe enum is returned — the decision id + source ids never
 * leave the server. Fully tolerant: any miss / pre-migration column defaults to
 * "standing" (a public receipt never errors over a provenance lookup).
 */
async function computePublicOutcome(slug: string): Promise<PublicDecisionOutcome> {
  try {
    const admin = supabaseAdmin as unknown as SupabaseClient;
    const { data: row } = await admin
      .from("decisions")
      .select("id,mission_id,prd_id,meeting_id")
      .eq("share_slug", slug)
      .eq("is_public", true)
      .maybeSingle();
    if (!row) return "standing";
    const r = row as {
      id: string;
      mission_id: string | null;
      prd_id: string | null;
      meeting_id: string | null;
    };
    const childIds = [r.id, r.mission_id, r.prd_id, r.meeting_id].filter(
      (x): x is string => typeof x === "string" && x !== "",
    );
    if (!childIds.length) return "standing";
    const { data: edges, error } = await admin
      .from("artifact_lineage")
      .select("parent_id,child_id,relation,valid_to")
      .in("child_id", childIds)
      .in("relation", ["supersedes", "contradicts"]);
    if (error || !edges) return "standing";
    const parentIds = supersedingParentIds(childIds, edges as unknown as LineageEdgeLite[]);
    if (!parentIds.length) return "standing";
    // PRIVACY: only reveal "superseded" when the superseding decision is ITSELF
    // public. A private override must never leak onto a public receipt — the
    // owner controls what is public, so the public artifact reflects only public
    // provenance. A non-decision (or private) superseder leaves it "standing".
    const { data: pub } = await admin
      .from("decisions")
      .select("id")
      .in("id", parentIds)
      .eq("is_public", true)
      .limit(1);
    return pub && pub.length ? "superseded" : "standing";
  } catch {
    return "standing";
  }
}

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
      const outcome = await computePublicOutcome(data.slug);
      return {
        title: r.title,
        rationale: r.rationale ?? null,
        status: r.status,
        decided_by_agent_slug: r.decided_by_agent_slug ?? null,
        created_at: r.created_at,
        outcome,
      };
    } catch {
      return null;
    }
  });
