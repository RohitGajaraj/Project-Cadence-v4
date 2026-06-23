import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  searchSignals,
  searchOpportunities,
  searchDecisions,
  getPRD,
  appendDecision,
  exportSkillpack,
  logMCPCall,
} from "@/lib/mcp.functions";
import {
  buildInitializeResult,
  buildToolCallResult,
  buildToolsListResult,
  classifyMcpRequest,
  jsonRpcError,
  jsonRpcResult,
  JSONRPC_INVALID_REQUEST,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@/lib/mcp-protocol";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
} as const;

/**
 * Q1-MCP · Model Context Protocol (MCP) server — Phase 2.
 *
 * External agents (Claude with MCP, other AI frameworks) call Cadence to:
 * - Read signals (search)
 * - Read opportunities (search)
 * - Read PRDs (fetch)
 * - Append decisions (write, approval-gated)
 *
 * All calls are authenticated via bearer token, rate-limited, and audited.
 *
 * Spec: https://modelcontextprotocol.io/specification
 */

interface MCPRequest {
  jsonrpc: string;
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

interface MCPResponse {
  jsonrpc: string;
  result?: unknown;
  error?: { code: number; message: string };
  id?: string | number;
}

interface TokenRow {
  id: string;
  workspace_id: string;
  rate_limit_per_min: number;
  revoked_at: string | null;
}

interface TokenValidationResult {
  valid: boolean;
  token_id?: string;
  workspace_id?: string;
  rate_limit_per_min?: number;
  error?: string;
}

/**
 * Validate an MCP bearer token against the mcp_tokens table.
 * Returns token_id, workspace_id, and rate limit if valid.
 */
async function validateToken(
  supabase: any,
  slug: string,
  secretHash: string,
): Promise<TokenValidationResult> {
  try {
    const { data: token, error } = await supabase
      .from("mcp_tokens")
      .select("id, workspace_id, rate_limit_per_min, revoked_at")
      .eq("slug", slug)
      .eq("secret_hash", secretHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) {
      return { valid: false, error: "Token lookup failed" };
    }

    const tokenRow = token as TokenRow | null;
    if (!tokenRow) {
      return { valid: false, error: "Invalid token" };
    }

    return {
      valid: true,
      token_id: tokenRow.id,
      workspace_id: tokenRow.workspace_id,
      rate_limit_per_min: tokenRow.rate_limit_per_min,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Check if a token has exceeded its rate limit in the current minute.
 */
async function checkRateLimit(
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
      // Fail open on error (allow the call to proceed)
      return { allowed: true, current_count: 0 };
    }

    const current_count = count || 0;
    return {
      allowed: current_count < rate_limit,
      current_count,
    };
  } catch (err) {
    console.error("Rate limit check error:", err);
    return { allowed: true, current_count: 0 };
  }
}

/**
 * Dispatch an MCP tool call based on the method name.
 */
async function dispatchTool(
  supabase: any,
  method: string,
  workspace_id: string,
  params: Record<string, unknown>,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (method) {
      case "search_signals": {
        const query = (params.query as string) || "";
        const limit = Math.min((params.limit as number) || 20, 100);
        const offset = (params.offset as number) || 0;

        const data = await searchSignals(supabase, workspace_id, query, limit, offset);
        return { success: true, data };
      }

      case "search_opportunities": {
        const query = (params.query as string) || "";
        const min_ice = (params.min_ice as number) || 0;
        const limit = Math.min((params.limit as number) || 20, 100);
        const offset = (params.offset as number) || 0;

        const data = await searchOpportunities(
          supabase,
          workspace_id,
          query,
          min_ice,
          limit,
          offset,
        );
        return { success: true, data };
      }

      case "search_decisions": {
        const query = (params.query as string) || "";
        const limit = Math.min((params.limit as number) || 20, 100);
        const offset = (params.offset as number) || 0;

        const data = await searchDecisions(supabase, workspace_id, query, limit, offset);
        return { success: true, data };
      }

      case "get_prd": {
        const prd_id = params.prd_id as string;
        if (!prd_id) {
          return { success: false, error: "Missing required parameter: prd_id" };
        }

        const data = await getPRD(supabase, workspace_id, prd_id);
        return { success: true, data };
      }

      case "append_decision": {
        const opportunity_id = params.opportunity_id as string;
        const decision_text = params.decision as string;
        const metadata = (params.metadata as Record<string, unknown>) || {};

        if (!opportunity_id || !decision_text) {
          return {
            success: false,
            error: "Missing required parameters: opportunity_id, decision",
          };
        }

        const data = await appendDecision(
          supabase,
          workspace_id,
          opportunity_id,
          decision_text,
          metadata,
        );
        return { success: true, data };
      }

      case "export_skillpack": {
        // Optional `limit`; exportSkillpack clamps it into [1, 500].
        const limit = typeof params.limit === "number" ? params.limit : undefined;
        const data = await exportSkillpack(supabase, workspace_id, limit);
        return { success: true, data };
      }

      case "tools":
      case "resources":
        // Legacy discovery aliases. The tool catalog lives in mcp-protocol.ts
        // so legacy discovery and the standard tools/list never drift.
        return { success: true, data: buildToolsListResult() };

      default:
        return { success: false, error: `Unknown method: ${method}` };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error };
  }
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now();
        let mcpReq: MCPRequest = { jsonrpc: "2.0", method: "unknown" };
        let token_id: string | undefined;
        let workspace_id: string | undefined;

        try {
          // 1. Parse the MCP request
          const body = await request.json().catch(() => ({}));
          mcpReq = {
            jsonrpc: (body as any).jsonrpc || "2.0",
            method: (body as any).method || "unknown",
            params: (body as any).params,
            id: (body as any).id,
          };

          // 1b. Classify the request (pure; no auth/DB). MCP notifications
          //     (e.g. notifications/initialized) carry no id and MUST get no
          //     response body, so acknowledge with 202 before any auth/DB work.
          const dispatch = classifyMcpRequest(mcpReq);
          if (dispatch.kind === "notification") {
            return new Response(null, {
              status: 202,
              headers: { "Access-Control-Allow-Origin": "*" },
            });
          }

          // 1c. Transport: reject a pinned MCP-Protocol-Version we cannot speak
          //     (Streamable HTTP MUST). Absent is lenient (negotiated at
          //     initialize); a well-behaved client only ever pins a version we
          //     returned, so this fires only for a broken client.
          const pinnedVersion = request.headers.get("mcp-protocol-version");
          if (
            pinnedVersion &&
            !(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(pinnedVersion)
          ) {
            return new Response(
              JSON.stringify(
                jsonRpcError(
                  mcpReq.id,
                  JSONRPC_INVALID_REQUEST,
                  `Unsupported MCP-Protocol-Version: ${pinnedVersion}`,
                ),
              ),
              { status: 400, headers: JSON_HEADERS },
            );
          }

          // 2. Extract and validate bearer token
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32003, message: "Missing bearer token" },
                id: mcpReq.id,
              } as MCPResponse),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const token = authHeader.slice(7); // "Bearer " prefix
          const [slug, secret] = token.split(":");
          if (!slug || !secret) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32003, message: "Invalid token format" },
                id: mcpReq.id,
              } as MCPResponse),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          // 3. Hash the secret and validate token
          const secretHash = crypto.createHash("sha256").update(secret).digest("hex");

          // Create service-role client to validate token (no user context)
          const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || "",
            { auth: { persistSession: false } },
          ) as any;

          const validation = await validateToken(supabase, slug, secretHash);
          if (!validation.valid) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                error: {
                  code: -32003,
                  message: validation.error || "Invalid token",
                },
                id: mcpReq.id,
              } as MCPResponse),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          token_id = validation.token_id;
          workspace_id = validation.workspace_id;

          if (!token_id || !workspace_id) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32003, message: "Token validation failed" },
                id: mcpReq.id,
              } as MCPResponse),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          // 4. Check rate limit
          const rateLimitResult = await checkRateLimit(
            supabase,
            token_id,
            validation.rate_limit_per_min || 60,
          );

          if (!rateLimitResult.allowed) {
            // Log the rate-limit rejection
            await logMCPCall(
              {
                token_id,
                workspace_id,
                tool_name: mcpReq.method,
                result: "rate_limit",
              },
              supabase,
            );

            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                error: {
                  code: -32002,
                  message: "Rate limit exceeded",
                },
                id: mcpReq.id,
              } as MCPResponse),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }

          // 5a. Standard MCP methods get spec-correct handlers. Legacy flat
          //     methods (search_signals, etc.) and the legacy tools/resources
          //     discovery fall through to the unchanged block below, so every
          //     existing HTTP caller stays byte-identical.
          if (
            dispatch.kind === "initialize" ||
            dispatch.kind === "ping" ||
            dispatch.kind === "tools/list" ||
            dispatch.kind === "resources/list" ||
            dispatch.kind === "prompts/list"
          ) {
            const result =
              dispatch.kind === "initialize"
                ? buildInitializeResult(dispatch.protocolVersion)
                : dispatch.kind === "tools/list"
                  ? buildToolsListResult()
                  : dispatch.kind === "resources/list"
                    ? { resources: [] }
                    : dispatch.kind === "prompts/list"
                      ? { prompts: [] }
                      : {}; // ping
            await logMCPCall(
              {
                token_id,
                workspace_id,
                tool_name: dispatch.kind,
                result: "success",
                metadata: { elapsed_ms: Date.now() - startTime },
              },
              supabase,
            );
            return new Response(JSON.stringify(jsonRpcResult(mcpReq.id, result)), {
              status: 200,
              headers: JSON_HEADERS,
            });
          }

          // 5b. Classification-level errors (unknown method / unknown or
          //     missing tool name). Reported as a JSON-RPC error over HTTP 200
          //     per the MCP-over-HTTP transport (clients read the body).
          if (dispatch.kind === "error") {
            // For a tools/call rejection the method is "tools/call"; record the
            // attempted tool name so the audit trail shows what was probed.
            const attemptedTool =
              typeof mcpReq.params?.name === "string" ? mcpReq.params.name : undefined;
            await logMCPCall(
              {
                token_id,
                workspace_id,
                tool_name: mcpReq.method,
                result: "error",
                error_message: dispatch.error.message,
                metadata: { elapsed_ms: Date.now() - startTime, attempted_tool: attemptedTool },
              },
              supabase,
            );
            return new Response(
              JSON.stringify(jsonRpcError(mcpReq.id, dispatch.error.code, dispatch.error.message)),
              { status: 200, headers: JSON_HEADERS },
            );
          }

          // 5c. Standard tools/call: dispatch the named tool, then wrap the
          //     output in the MCP content envelope. Tool EXECUTION errors are
          //     reported in the result (isError) so a calling model sees them,
          //     not as a JSON-RPC protocol error.
          if (dispatch.kind === "tools/call") {
            const callResult = await dispatchTool(
              supabase,
              dispatch.toolName,
              workspace_id,
              dispatch.args,
            );
            await logMCPCall(
              {
                token_id,
                workspace_id,
                tool_name: dispatch.toolName,
                result: callResult.success ? "success" : "error",
                error_message: callResult.error,
                metadata: { elapsed_ms: Date.now() - startTime },
              },
              supabase,
            );
            const envelope = buildToolCallResult(
              callResult.success ? callResult.data : (callResult.error ?? "Tool execution failed"),
              !callResult.success,
            );
            return new Response(JSON.stringify(jsonRpcResult(mcpReq.id, envelope)), {
              status: 200,
              headers: JSON_HEADERS,
            });
          }

          // 5. Dispatch the tool (legacy flat-method path, unchanged)
          const toolResult = await dispatchTool(
            supabase,
            mcpReq.method,
            workspace_id,
            mcpReq.params || {},
          );

          // 6. Log the call (success or failure)
          const elapsedMs = Date.now() - startTime;
          await logMCPCall(
            {
              token_id,
              workspace_id,
              tool_name: mcpReq.method,
              result: toolResult.success ? "success" : "error",
              error_message: toolResult.error,
              metadata: {
                elapsed_ms: elapsedMs,
              },
            },
            supabase,
          );

          if (!toolResult.success) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                error: {
                  code: -32603,
                  message: toolResult.error || "Tool execution failed",
                },
                id: mcpReq.id,
              } as MCPResponse),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // 7. Return success response
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: toolResult.data,
              id: mcpReq.id,
            } as MCPResponse),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        } catch (err) {
          const internalError = err instanceof Error ? err.message : "Unknown error";
          console.error("[mcp]", internalError);
          const error = "internal error";

          // Attempt to log the error
          if (token_id && workspace_id) {
            const supabase = createClient(
              process.env.SUPABASE_URL || "",
              process.env.SUPABASE_SERVICE_ROLE_KEY || "",
              { auth: { persistSession: false } },
            ) as any;
            await logMCPCall(
              {
                token_id,
                workspace_id,
                tool_name: mcpReq.method,
                result: "error",
                error_message: internalError,
              },
              supabase,
            );
          }

          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: error },
              id: mcpReq.id,
            } as MCPResponse),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
          },
        }),
    },
  },
});
