// Q1-MCP Phase 4a - native MCP (Model Context Protocol) transport layer.
//
// Pure JSON-RPC 2.0 + MCP wire-protocol helpers. The `/api/mcp` route stays the
// I/O boundary (bearer auth, Supabase, rate-limit, audit); this module owns the
// PROTOCOL: method classification, the handshake (`initialize`/`ping`), tool
// discovery (`tools/list`), the `tools/call` content envelope, and notification
// detection. Everything here is pure (no network, no DB, no clock), so the wire
// protocol is fully unit-testable offline.
//
// Back-compat is a hard constraint: the four legacy flat methods
// (`search_signals` / `search_opportunities` / `get_prd` / `append_decision`)
// and the legacy `tools` / `resources` discovery are classified as `legacy` and
// dispatched through the route's unchanged code path, so existing curl/HTTP
// callers are byte-identical. The new standard methods are added alongside.
//
// Phase 4b (OAuth client registration + full write CRUD with per-lane scope)
// stays founder-gated; this slice closes only the transport-handshake gap that
// blocked standards-compliant MCP clients (e.g. Claude Desktop) from connecting.
// Spec: https://modelcontextprotocol.io/specification

export const MCP_SERVER_NAME = "cadence";
export const MCP_SERVER_VERSION = "1.0.0";

// MCP spec revisions this server understands; index 0 is the latest/preferred.
// `initialize` echoes the client's requested version when supported, else this.
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

// Standard JSON-RPC 2.0 error codes (https://www.jsonrpc.org/specification).
export const JSONRPC_PARSE_ERROR = -32700;
export const JSONRPC_INVALID_REQUEST = -32600;
export const JSONRPC_METHOD_NOT_FOUND = -32601;
export const JSONRPC_INVALID_PARAMS = -32602;
export const JSONRPC_INTERNAL_ERROR = -32603;

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// The canonical tool catalog. Single source of truth for BOTH the standard
// `tools/list` and the legacy `tools` discovery, so the two can never drift.
export const MCP_TOOLS: McpTool[] = [
  {
    name: "search_signals",
    description: "Search discovery signals by keyword, theme, or product",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", default: 20 },
        offset: { type: "number", default: 0 },
      },
    },
  },
  {
    name: "search_opportunities",
    description: "Search opportunities by title/problem or ICE score",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        min_ice: { type: "number", default: 0 },
        limit: { type: "number", default: 20 },
        offset: { type: "number", default: 0 },
      },
    },
  },
  {
    name: "get_prd",
    description: "Fetch a specific PRD with cited signals and requirements",
    inputSchema: {
      type: "object",
      properties: { prd_id: { type: "string" } },
      required: ["prd_id"],
    },
  },
  {
    name: "append_decision",
    description: "Append a decision to an opportunity (approval-gated)",
    inputSchema: {
      type: "object",
      properties: {
        opportunity_id: { type: "string" },
        decision: { type: "string" },
        metadata: { type: "object" },
      },
      required: ["opportunity_id", "decision"],
    },
  },
  {
    name: "export_skillpack",
    description:
      "Export a versioned, content-hashed bundle of this workspace's decision lessons (outcomes that validated, missed, or revised a decision) for an external agent to load as context",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 200 },
      },
    },
  },
];

export const MCP_TOOL_NAMES: readonly string[] = MCP_TOOLS.map((t) => t.name);

// The legacy discovery aliases that pre-date the standard methods.
const LEGACY_DISCOVERY_METHODS = new Set(["tools", "resources"]);

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
  id?: JsonRpcId;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

// The classified intent of an inbound request. The route switches on `kind`:
// standard kinds get spec-correct handlers; `legacy` falls through to the
// existing dispatch (byte-identical); `notification` gets no response body.
export type McpDispatch =
  | { kind: "initialize"; protocolVersion: string }
  | { kind: "ping" }
  | { kind: "tools/list" }
  | { kind: "resources/list" }
  | { kind: "prompts/list" }
  | { kind: "tools/call"; toolName: string; args: Record<string, unknown> }
  | { kind: "notification" }
  | { kind: "legacy"; method: string }
  | { kind: "error"; error: JsonRpcError };

/**
 * A JSON-RPC request is a NOTIFICATION when it carries no `id` member, OR when
 * its method is in the `notifications/*` namespace (e.g.
 * `notifications/initialized`). Notifications MUST receive no response at all.
 */
export function isNotification(req: JsonRpcRequest | null | undefined): boolean {
  if (!req) return true;
  if (typeof req.method === "string" && req.method.startsWith("notifications/")) {
    return true;
  }
  return req.id === undefined || req.id === null;
}

/**
 * Pick the protocol version to report from `initialize`. Echoes the client's
 * requested version when this server supports it, else falls back to the latest
 * supported version (per the MCP version-negotiation rule).
 */
export function negotiateProtocolVersion(requested?: unknown): string {
  if (
    typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
  ) {
    return requested;
  }
  return LATEST_PROTOCOL_VERSION;
}

/**
 * Classify an inbound JSON-RPC request into a transport intent. Pure: no auth,
 * no DB. The route does auth/rate-limit/dispatch based on the returned `kind`.
 */
export function classifyMcpRequest(req: JsonRpcRequest): McpDispatch {
  // Notifications first: no id (or notifications/* method) => no response.
  if (isNotification(req)) return { kind: "notification" };

  const method = typeof req.method === "string" ? req.method : "";
  const params = (req.params ?? {}) as Record<string, unknown>;

  switch (method) {
    case "initialize":
      return {
        kind: "initialize",
        protocolVersion: negotiateProtocolVersion(params.protocolVersion),
      };
    case "ping":
      return { kind: "ping" };
    case "tools/list":
      return { kind: "tools/list" };
    case "resources/list":
      return { kind: "resources/list" };
    case "prompts/list":
      return { kind: "prompts/list" };
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || name.length === 0) {
        return {
          kind: "error",
          error: { code: JSONRPC_INVALID_PARAMS, message: "Missing tool name" },
        };
      }
      if (!MCP_TOOL_NAMES.includes(name)) {
        return {
          kind: "error",
          error: { code: JSONRPC_INVALID_PARAMS, message: `Unknown tool: ${name}` },
        };
      }
      const rawArgs = params.arguments;
      const args =
        rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
          ? (rawArgs as Record<string, unknown>)
          : {};
      return { kind: "tools/call", toolName: name, args };
    }
    default:
      // Legacy flat tool methods + legacy discovery aliases route through the
      // route's unchanged dispatch path (back-compat, byte-identical).
      if (MCP_TOOL_NAMES.includes(method) || LEGACY_DISCOVERY_METHODS.has(method)) {
        return { kind: "legacy", method };
      }
      return {
        kind: "error",
        error: { code: JSONRPC_METHOD_NOT_FOUND, message: `Method not found: ${method}` },
      };
  }
}

/** The `initialize` result: capabilities + server identity + a usage hint. */
export function buildInitializeResult(protocolVersion: string) {
  return {
    protocolVersion,
    // Advertise only what we actually serve. resources/list and prompts/list
    // answer (empty) for client tolerance, but we do NOT advertise those
    // capabilities, so a conformant client never attempts resources/read etc.
    // (which would 404 with method-not-found). Phase 4b adds real resources.
    capabilities: {
      tools: { listChanged: false },
    },
    serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    instructions:
      "Cadence exposes read access to product signals, opportunities, and PRDs, an approval-gated decision append, and a versioned decision-lessons skill pack. Call tools/list to enumerate, then tools/call to invoke.",
  };
}

/** The `tools/list` result. */
export function buildToolsListResult(): { tools: McpTool[] } {
  return { tools: MCP_TOOLS };
}

/**
 * Wrap raw tool output in the MCP `tools/call` content envelope. Per the spec,
 * tool EXECUTION errors are reported in the result with `isError: true` (so a
 * calling model can see them), not as JSON-RPC protocol errors.
 */
export function buildToolCallResult(data: unknown, isError = false) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

/** Build a JSON-RPC success response. A null/absent id is reported as null. */
export function jsonRpcResult(id: JsonRpcId | undefined, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

/** Build a JSON-RPC error response. */
export function jsonRpcError(
  id: JsonRpcId | undefined,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  const error: JsonRpcError = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}
