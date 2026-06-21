import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Q1-MCP · Read-only MCP (Model Context Protocol) server functions.
 *
 * External agents call Cadence via MCP to read signals/opportunities/PRDs
 * and append decisions, governed by workspace scope, rate limits, and audit.
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
    const secretHash = crypto
      .createHash("sha256")
      .update(secret)
      .digest("hex");

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
// MCP Tool Implementations (read-only + append decision)
// ─────────────────────────────────────────────────────────────────────

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
  let q = supabaseClient
    .from("signals")
    .select(
      "id, title, source, summary, product_id, created_at, products!inner(id, name)",
    )
    .eq("workspace_id", workspace_id);

  if (query) {
    q = q.or(`title.ilike.%${query}%, summary.ilike.%${query}%`);
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
  let q = supabaseClient
    .from("opportunities")
    .select("id, title, problem, hypothesis, predicted_ice, roadmap_status, created_at")
    .eq("workspace_id", workspace_id);

  if (query) {
    q = q.or(`title.ilike.%${query}%, problem.ilike.%${query}%`);
  }

  const { data, error } = await q
    .gte("predicted_ice", min_ice)
    .range(offset, offset + limit - 1)
    .order("predicted_ice", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Get a specific PRD by ID with cited signals.
 * Called by the MCP server route handler.
 */
export async function getPRD(
  supabaseClient: any,
  workspace_id: string,
  prd_id: string,
) {
  const { data: prd, error: prdError } = await supabaseClient
    .from("prd")
    .select(
      "id, title, opportunity_id, definition, acceptance_criteria, success_metrics, created_at",
    )
    .eq("workspace_id", workspace_id)
    .eq("id", prd_id)
    .single();

  if (prdError) throw new Error("PRD not found");
  return prd;
}

/**
 * Append a decision to an opportunity.
 * Creates a decision_queue entry for approval before persisting.
 * Called by the MCP server route handler.
 */
export async function appendDecision(
  supabaseClient: any,
  workspace_id: string,
  opportunity_id: string,
  decision_text: string,
  metadata: Record<string, unknown> = {},
) {
  const { data: decision, error } = await supabaseClient
    .from("decisions")
    .insert({
      workspace_id,
      opportunity_id,
      decision: decision_text,
      verdict: "pending",
      metadata,
    })
    .select("id, opportunity_id, verdict, created_at")
    .single();

  if (error) throw new Error(error.message);

  // Queue for approval (no auto-apply from external source)
  const { error: queueError } = await supabaseClient
    .from("decision_queue")
    .insert({
      workspace_id,
      decision_id: decision.id,
      status: "pending_review",
      external_source: "mcp",
    });

  if (queueError) {
    console.warn("Failed to queue decision for approval:", queueError);
  }

  return {
    decision_id: decision.id,
    opportunity_id: decision.opportunity_id,
    status: "pending_review",
    created_at: decision.created_at,
  };
}
