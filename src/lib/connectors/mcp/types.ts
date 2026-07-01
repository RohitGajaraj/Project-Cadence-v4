/**
 * SF-MCP (Signal Fabric Phase 3) — shared types for the mcp_source adapter.
 * Client-safe (types only, no server imports) so the registry and any future
 * settings UI can import without pulling in server-only code.
 */

/** The founder-curated allowlist of absorbed MCP server slots (mirrors the DB CHECK
 *  on mcp_connections.server_id — extending this list also requires a migration). */
export type McpServerId = "linear-mcp" | "gong" | "granola" | "enterpret";

/** One content block from an MCP tools/call result, reshaped to text-only. */
export type McpContentBlock = { type: string; text?: string };

/** Per-slot config: every value is an env var NAME, never the value itself — the
 *  actual URL/token only ever come from process.env at call time. */
export type McpServerSpec = {
  id: McpServerId;
  label: string;
  urlEnv: string;
  tokenEnv: string;
  toolEnv: string;
  argsEnv: string;
};
