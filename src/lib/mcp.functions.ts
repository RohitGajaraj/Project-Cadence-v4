import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSkillpack, clampSkillpackLimit, type SkillpackLessonInput } from "./skillpack";
import { supersededChildIds, type LineageEdgeLite } from "./trust-ledger.functions";

/**
 * Q1-MCP · Read-only MCP (Model Context Protocol) server functions.
 *
 * External agents call Cadence via MCP to read signals/opportunities/decisions/
 * PRDs/roadmap and export a decision-lessons skill pack, governed by workspace
 * scope, rate limits, and audit. The decision-WRITE half is founder-gated
 * (Phase 4b) and is intentionally not exposed here.
 */

export interface MCPTokenInfo {
  id: string;
  workspace_id: string;
  slug: string;
  rate_limit_per_min: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Token Management (workspace scoped, auth required)
// ─────────────────────────────────────────────────────────────────────

export const listMCPTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspace_id: z.string().uuid(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: tokens, error } = await supabase
      .from("mcp_tokens")
      .select("id,workspace_id,slug,rate_limit_per_min,created_at,last_used_at,revoked_at")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (tokens ?? []) as MCPTokenInfo[];
  });

export const issueMCPToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        slug: z.string().min(1).max(100),
        rate_limit_per_min: z.number().int().min(1).max(1000).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    // requireSupabaseAuth puts the caller on context.userId (not context.auth);
    // the old `auth.user.id` threw "Cannot read properties of undefined
    // (reading 'user')", which 500'd every token issue and made the whole MCP
    // server unreachable (no token could ever be minted).
    const { supabase, userId } = context;
    if (!userId) throw new Error("Unauthorized");

    // Generate random secret and hash
    const crypto = await import("crypto");
    const secret = crypto.randomBytes(32).toString("hex");
    const secretHash = crypto.createHash("sha256").update(secret).digest("hex");

    const { data: token, error } = await supabase.rpc("issue_mcp_token", {
      _workspace_id: data.workspace_id,
      _user_id: userId,
      _slug: data.slug,
      _secret_hash: secretHash,
      _rate_limit_per_min: data.rate_limit_per_min || 60,
    });

    if (error) throw new Error(error.message);

    // Return token only once (never stored plaintext)
    return {
      token_id: (token as { id: string }).id,
      display_token: `${data.slug}:${secret}`,
      slug: data.slug,
      created_at: (token as { created_at: string }).created_at,
    };
  });

export const revokeMCPToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        token_id: z.string().uuid(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("revoke_mcp_token", {
      _token_id: data.token_id,
    });

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─────────────────────────────────────────────────────────────────────
// Audit Logging (service-role only, called from MCP route)
// ─────────────────────────────────────────────────────────────────────

export interface LogAPICallInput {
  token_id: string;
  workspace_id: string;
  tool_name: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  result: "success" | "rate_limit" | "not_found" | "error" | "permission_denied";
  error_message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Server-side only: log an MCP tool call to the audit trail.
 * Used by the /api/mcp route handler (service-role context).
 */
export async function logMCPCall(input: LogAPICallInput, supabaseClient: any) {
  const { error } = await supabaseClient.rpc("log_api_call", {
    _token_id: input.token_id,
    _workspace_id: input.workspace_id,
    _tool_name: input.tool_name,
    _input_tokens: input.input_tokens || 0,
    _output_tokens: input.output_tokens || 0,
    _cost_usd: input.cost_usd || 0,
    _result: input.result,
    _error_message: input.error_message || null,
    _metadata: input.metadata || {},
  });

  if (error) {
    console.error("Failed to log API call:", error);
    return null;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// MCP Tool Implementations (read-only)
// ─────────────────────────────────────────────────────────────────────

/**
 * PURE. Sanitize a caller-supplied keyword before it is interpolated into a
 * PostgREST `.or(...)` filter string. The `.or()` grammar is a comma-separated
 * list of conditions with parenthesized nesting, so a raw comma/paren/backslash
 * in the query could inject an extra OR branch (e.g. an always-true condition
 * that widens the result set within the caller's own workspace). The tenant
 * boundary still holds (workspace_id is a separate AND'd filter), but we strip
 * the structural characters so the keyword can only ever be a literal `ilike`
 * pattern. `%`/`_` are left intact — they are the intended wildcards.
 */
export function sanitizeIlikeQuery(query: string | null | undefined): string {
  return (query ?? "").replace(/[,()\\]/g, "").trim();
}

/**
 * Search signals by keyword, theme, or product.
 * Called by the MCP server route handler.
 */
export async function searchSignals(
  supabaseClient: any,
  workspace_id: string,
  query: string,
  limit: number = 20,
  offset: number = 0,
) {
  // Live-schema-correct projection (verified against the production schema): the
  // body column is `content` (not `summary`), and there is no `products` table to
  // embed. Safe projection — no owner/workspace ids leak to the external caller.
  let q = supabaseClient
    .from("signals")
    .select("id, title, source, content, product_id, created_at")
    .eq("workspace_id", workspace_id);

  const safe = sanitizeIlikeQuery(query);
  if (safe) {
    q = q.or(`title.ilike.%${safe}%, content.ilike.%${safe}%`);
  }

  const { data, error } = await q
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Search opportunities by keyword or ICE criteria.
 * Called by the MCP server route handler.
 */
export async function searchOpportunities(
  supabaseClient: any,
  workspace_id: string,
  query: string,
  min_ice: number = 0,
  limit: number = 20,
  offset: number = 0,
) {
  // Live-schema-correct projection: the ICE column is `ice_score` (not
  // `predicted_ice`) and the roadmap column is `roadmap_bucket` (not
  // `roadmap_status`). Safe projection — no owner/workspace ids.
  let q = supabaseClient
    .from("opportunities")
    .select("id, title, problem, hypothesis, ice_score, roadmap_bucket, created_at")
    .eq("workspace_id", workspace_id);

  const safe = sanitizeIlikeQuery(query);
  if (safe) {
    q = q.or(`title.ilike.%${safe}%, problem.ilike.%${safe}%`);
  }
  // Only apply the ICE floor when a real minimum is requested. `ice_score >= 0`
  // would silently drop unscored (NULL ICE) opportunities — `NULL >= 0` is NULL,
  // so they would vanish from a default (min_ice = 0) search.
  if (min_ice > 0) {
    q = q.gte("ice_score", min_ice);
  }

  const { data, error } = await q
    .range(offset, offset + limit - 1)
    .order("ice_score", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * PURE (INTEROP-V11). Tag each decision with its honest provenance outcome
 * ("standing" | "superseded") from the supersession map — the same bitemporal
 * rule as the Trust Ledger, so the MCP read and the in-app ledger never disagree.
 */
export function applyDecisionOutcomes<T extends { id: string }>(
  decisions: T[] | null | undefined,
  superseded: Map<string, string>,
): (T & { outcome: "standing" | "superseded" })[] {
  return (Array.isArray(decisions) ? decisions : []).map((d) => ({
    ...d,
    outcome: superseded.has(d.id) ? ("superseded" as const) : ("standing" as const),
  }));
}

/**
 * INTEROP-V11 · Read-only decision-brain access for external agents. Returns the
 * workspace's decisions (safe projection — no owner/workspace/linked ids) each
 * tagged with its standing/superseded outcome, so a peer agent can query "what
 * did this team decide, and did it hold up?". Workspace-scoped + audited like the
 * other MCP read tools. Called by the MCP server route handler.
 */
export async function searchDecisions(
  supabaseClient: any,
  workspace_id: string,
  query: string,
  limit: number = 20,
  offset: number = 0,
) {
  let q = supabaseClient
    .from("decisions")
    .select("id, title, rationale, status, source_kind, decided_by_agent_slug, created_at")
    .eq("workspace_id", workspace_id);

  const safe = sanitizeIlikeQuery(query);
  if (safe) {
    q = q.or(`title.ilike.%${safe}%, rationale.ilike.%${safe}%`);
  }

  const { data: rows, error } = await q
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const decisions = (rows || []) as Array<{ id: string }>;

  // The honest provenance outcome via the bitemporal lineage. Tolerant: any error
  // (incl. a pre-migration missing valid_to) leaves every decision "standing".
  let superseded = new Map<string, string>();
  if (decisions.length) {
    const { data: edges, error: lErr } = await supabaseClient
      .from("artifact_lineage")
      .select("parent_id, child_id, relation, valid_to")
      .eq("workspace_id", workspace_id)
      .in(
        "child_id",
        decisions.map((d) => d.id),
      )
      .in("relation", ["supersedes", "contradicts"]);
    if (!lErr && edges) superseded = supersededChildIds(edges as unknown as LineageEdgeLite[]);
  }
  return applyDecisionOutcomes(decisions as Array<{ id: string }>, superseded);
}

/**
 * Get a specific PRD (spec) by ID.
 * Called by the MCP server route handler.
 *
 * Live-schema-correct: the table is `prds` (not `prd`) and the spec body is
 * `body_md` (the columns `definition`/`acceptance_criteria`/`success_metrics`
 * never existed in production). Safe projection — no owner/workspace ids.
 */
export async function getPRD(supabaseClient: any, workspace_id: string, prd_id: string) {
  const { data: prd, error: prdError } = await supabaseClient
    .from("prds")
    .select("id, title, opportunity_id, status, body_md, created_at, shipped_at")
    .eq("workspace_id", workspace_id)
    .eq("id", prd_id)
    .single();

  if (prdError) throw new Error("PRD not found");
  return prd;
}

/**
 * INTEROP-V11 · Read-only SPEC DISCOVERY for external agents. `get_prd` needs the
 * exact id; this lets a peer agent FIND specs by keyword (title or body) and/or
 * status, the missing half of the spec-read surface. Workspace-scoped + audited
 * like the other MCP read tools. Called by the MCP server route handler.
 */
export async function searchPRDs(
  supabaseClient: any,
  workspace_id: string,
  query: string,
  status: string = "",
  limit: number = 20,
  offset: number = 0,
) {
  let q = supabaseClient
    .from("prds")
    .select("id, title, status, opportunity_id, created_at, shipped_at")
    .eq("workspace_id", workspace_id);

  const safe = sanitizeIlikeQuery(query);
  if (safe) {
    q = q.or(`title.ilike.%${safe}%, body_md.ilike.%${safe}%`);
  }
  if (status) {
    q = q.eq("status", status);
  }

  const { data, error } = await q
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export type RoadmapItemLite = {
  id: string;
  title: string;
  ice_score: number | null;
  roadmap_bucket: string | null;
};

export type RoadmapView = {
  now: RoadmapItemLite[];
  next: RoadmapItemLite[];
  later: RoadmapItemLite[];
  unbucketed: RoadmapItemLite[];
};

/**
 * PURE (INTEROP-V11). Group opportunities into the roadmap buckets an external
 * agent expects (now / next / later), with everything else under `unbucketed`
 * (the bucket is optional in the live schema, so this is honest, not empty).
 * Within a bucket, highest ICE first.
 */
export function groupByRoadmapBucket(
  rows: RoadmapItemLite[] | null | undefined,
): RoadmapView {
  const view: RoadmapView = { now: [], next: [], later: [], unbucketed: [] };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.id !== "string" || !r.id) continue;
    // String() coerces a non-string bucket (a future/misconfigured column type)
    // safely to "unbucketed" instead of throwing on .trim().
    const bucket = String(r.roadmap_bucket ?? "").trim().toLowerCase();
    if (bucket === "now") view.now.push(r);
    else if (bucket === "next") view.next.push(r);
    else if (bucket === "later") view.later.push(r);
    else view.unbucketed.push(r);
  }
  const byIce = (a: RoadmapItemLite, b: RoadmapItemLite) => (b.ice_score ?? 0) - (a.ice_score ?? 0);
  view.now.sort(byIce);
  view.next.sort(byIce);
  view.later.sort(byIce);
  view.unbucketed.sort(byIce);
  return view;
}

/**
 * INTEROP-V11 · Read-only ROADMAP access for external agents — the workspace's
 * opportunities arranged into now/next/later buckets (+ unbucketed), highest ICE
 * first. Workspace-scoped + audited. Called by the MCP server route handler.
 */
export async function getRoadmap(
  supabaseClient: any,
  workspace_id: string,
  limit: number = 200,
): Promise<RoadmapView> {
  const capped = Math.max(1, Math.min(limit, 500));
  const { data, error } = await supabaseClient
    .from("opportunities")
    .select("id, title, ice_score, roadmap_bucket")
    .eq("workspace_id", workspace_id)
    .order("ice_score", { ascending: false })
    .limit(capped);

  if (error) throw new Error(error.message);
  return groupByRoadmapBucket((data ?? []) as RoadmapItemLite[]);
}

/**
 * Export a versioned skill pack: the workspace's distilled outcome->lesson
 * `learnings` (validated / missed / mixed decisions, with the ICE move each
 * caused), bundled by the pure `buildSkillpack` into a deterministic,
 * content-fingerprinted envelope an external agent can load as context.
 *
 * Scoped EXPLICITLY by `workspace_id` (the MCP route runs service-role, so the
 * `.eq("workspace_id", ...)` filter is the tenant boundary, not RLS), mirroring
 * the other read tools. Read-only: no writes, no AI, no spend.
 */
export async function exportSkillpack(supabaseClient: any, workspace_id: string, limit?: number) {
  const cap = clampSkillpackLimit(limit);
  // The `id` secondary sort is LOAD-BEARING for the content_hash promise, not
  // cosmetic: `ORDER BY created_at DESC LIMIT cap` alone returns an arbitrary
  // subset of any rows whose created_at ties at the LIMIT boundary, so two
  // exports of an UNCHANGED workspace (>cap learnings, millisecond-clustered
  // timestamps) could fetch different boundary rows and hash differently. Adding
  // `id ASC` matches buildSkillpack's in-memory tiebreak, so the DB top-N is
  // stable and the version fingerprint is reproducible.
  //
  // Tenant scope: `.eq("workspace_id", ...)` on `learnings` is the only boundary
  // (the route runs service-role, RLS OFF). The `opportunity` embed has no
  // workspace predicate, so it is safe ONLY because a learning is co-tenant with
  // its opportunity by construction (recordOutcome writes both from one PRD; WM-F6
  // move_product reassigns them in lockstep). A future migration that lets a
  // learning point at a cross-workspace opportunity would need its own guard here.
  const { data, error } = await supabaseClient
    .from("learnings")
    .select(
      "id, verdict, summary, prior_ice, new_ice, created_at, opportunity:opportunities(title)",
    )
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(cap);

  if (error) throw new Error(error.message);

  // Flatten the to-one opportunity embed (PostgREST may widen it to an array),
  // mirroring getCompounding/listLearnings so the wire shape stays flat.
  type Wire = {
    id: string;
    verdict: string;
    summary: string | null;
    prior_ice: number | string | null;
    new_ice: number | string | null;
    created_at: string;
    opportunity: { title: string | null } | { title: string | null }[] | null;
  };
  const lessons: SkillpackLessonInput[] = ((data ?? []) as Wire[]).map(
    ({ opportunity, ...rest }) => {
      const opp = Array.isArray(opportunity) ? opportunity[0] : opportunity;
      return {
        id: rest.id,
        verdict: rest.verdict,
        summary: rest.summary ?? "",
        prior_ice: rest.prior_ice,
        new_ice: rest.new_ice,
        created_at: rest.created_at,
        opportunity_title: opp?.title ?? null,
      };
    },
  );

  return buildSkillpack({
    workspaceId: workspace_id,
    lessons,
    generatedAt: new Date().toISOString(),
    limit: cap,
  });
}
