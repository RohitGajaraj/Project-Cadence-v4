// F-SHARE-TEARDOWN — the shareable Critic-teardown viral loop (server functions).
//
// Three fns, mirroring decisions-share.functions.ts exactly in shape:
//   getTeardownShareState + setTeardownShared are AUTHED (the owner toggles a
//   teardown public/private — RLS guarantees ownership); getPublicTeardown is
//   PUBLIC (no auth) and powers the anonymous /t/<slug> route.
//
// SECURITY (getPublicTeardown): the boundary is at the DATABASE WIRE (see the
// migration 20260617130000). The anon role is granted SELECT on ONLY the safe
// columns and an RLS policy scoped TO anon limits reads to is_public rows. This
// function's select is a convenience projection, NOT the gate. critic_review is the
// AI red-team of the idea — no PII — but it is untyped jsonb at the DB, so we
// normalize it here and return null for a malformed/absent verdict.
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
import { scanEgressForSecrets, describeEgressSecrets } from "@/lib/egress-guardrails";
import { scanEgressForPii, describeEgressPii } from "@/lib/pii-egress";
import type { CriticReview } from "@/lib/discovery.functions";

/**
 * Resolve the caller's IP for the per-IP public-read rate limit. cf-connecting-ip
 * is Cloudflare-set and unspoofable in production; x-forwarded-for / x-real-ip are
 * dev fallbacks. Returns null when no request context resolves (skips the limit).
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

export type TeardownShareState = {
  /** false until the share columns are applied on the live DB (next Lovable sync). */
  available: boolean;
  is_public: boolean;
  share_slug: string | null;
};

/** Authed — the current share state for a teardown (opportunity) the caller owns. Tolerant. */
export const getTeardownShareState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<TeardownShareState> => {
    const { data: row, error } = await context.supabase
      .from("opportunities")
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

/** Authed — make a teardown public/private. RLS ensures the caller owns it. Tolerant. */
export const setTeardownShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), isPublic: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<TeardownShareState> => {
    // Public-egress floor: before making a teardown anon-readable, refuse if its title or
    // Critic review carries a high-confidence secret or customer PII — the same floor as
    // announcements (SEC-EGRESS-GUARD + SEC-PII-EGRESS). Un-sharing needs no scan.
    if (data.isPublic) {
      const { data: content } = await context.supabase
        .from("opportunities")
        .select("title,critic_review")
        .eq("id", data.id)
        .maybeSingle();
      if (content) {
        const c = content as { title?: string | null; critic_review?: unknown };
        const review =
          typeof c.critic_review === "string"
            ? c.critic_review
            : JSON.stringify(c.critic_review ?? "");
        const text = `${c.title ?? ""}\n${review}`;
        const secret = scanEgressForSecrets(text);
        if (secret.blocked) throw new Error(describeEgressSecrets(secret.ruleNames));
        const pii = scanEgressForPii(text);
        if (pii.blocked) throw new Error(describeEgressPii(pii.types));
      }
    }
    const { data: row, error } = await context.supabase
      .from("opportunities")
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

export type PublicTeardown = {
  title: string;
  verdict: CriticReview["verdict"];
  summary: string;
  risks: string[];
  kill_criteria: string[];
  missing_evidence: string[];
  confidence: number;
  created_at: string;
};

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
}

/**
 * critic_review is untyped jsonb at the DB. Validate it into the safe public shape,
 * or return null (→ the /t page reads "not available") when it is absent or malformed
 * — so a shared opportunity that was never torn down never renders an empty card.
 */
function normalizeReview(j: unknown): Omit<PublicTeardown, "title" | "created_at"> | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const verdict = o.verdict;
  if (verdict !== "ship" && verdict !== "revise" && verdict !== "kill") return null;
  const confidence = typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0;
  return {
    verdict,
    summary: typeof o.summary === "string" ? o.summary : "",
    risks: asStringArray(o.risks),
    kill_criteria: asStringArray(o.kill_criteria),
    missing_evidence: asStringArray(o.missing_evidence),
    confidence,
  };
}

/** PUBLIC (no auth) — the safe, minimal projection behind /t/<slug>. */
export const getPublicTeardown = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(6).max(64) }).parse(i))
  .handler(async ({ data }): Promise<PublicTeardown | null> => {
    // Per-IP anti-abuse guard. Reuses the decisions limiter (a shared per-IP bucket
    // across /d and /t — acceptable: more conservative, anti-DoS not anti-enumeration,
    // and it fails open). Runs BEFORE the read.
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
        .from("opportunities")
        // SAFE ALLOW-LIST ONLY — never user_id / workspace_id / project_id, never a join.
        .select("title,critic_review,created_at,is_public")
        .eq("share_slug", data.slug)
        .eq("is_public", true)
        .maybeSingle();
      if (error || !row) return null;
      const r = row as {
        title: string;
        critic_review: unknown;
        created_at: string;
        is_public?: boolean;
      };
      if (!r.is_public) return null; // belt-and-suspenders over the RLS gate
      const review = normalizeReview(r.critic_review);
      if (!review) return null; // shared, but no teardown to show
      return { title: r.title, created_at: r.created_at, ...review };
    } catch {
      return null;
    }
  });
