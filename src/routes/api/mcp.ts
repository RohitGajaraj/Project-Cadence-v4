import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";

/**
 * Q1-MCP · Model Context Protocol (MCP) server.
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

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Parse the MCP request
          const body = await request.json().catch(() => ({}));
          const mcpReq = body as MCPRequest;

          // 2. Extract and validate bearer token
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32003, message: "Missing bearer token" },
                id: mcpReq.id,
              } as MCPResponse),
              { status: 401, headers: { "Content-Type": "application/json" } }
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
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          // 3. Validate token against the DB (stub; real impl queries mcp_tokens)
          // TODO: Query mcp_tokens, validate secret hash, check revoked_at, check rate limit
          const secretHash = crypto
            .createHash("sha256")
            .update(secret)
            .digest("hex");

          // For now, return a stub to demonstrate the structure
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: {
                message:
                  'MCP server is ready. Valid methods: ["search_signals", "search_opportunities", "get_prd", "append_decision", "tools", "resources"]',
                methods: [
                  {
                    name: "search_signals",
                    description:
                      "Search discovery signals by keyword, theme, or product",
                  },
                  {
                    name: "search_opportunities",
                    description:
                      "Search opportunities by title/problem or ICE score",
                  },
                  {
                    name: "get_prd",
                    description:
                      "Fetch a specific PRD with cited signals and requirements",
                  },
                  {
                    name: "append_decision",
                    description:
                      "Append a decision to an opportunity (approval-gated, audit-logged)",
                  },
                ],
              },
              id: mcpReq.id,
            } as MCPResponse),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        } catch (err) {
          const error = err instanceof Error ? err.message : "Unknown error";
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: error },
            } as MCPResponse),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },

      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, Accept",
          },
        }),
    },
  },
});
