/**
 * SF-MCP (Signal Fabric Phase 3) — the registry of absorbed hosted MCP servers.
 *
 * Each slot's serverUrl/token/tool/args are 100% env-config (the "via config" the
 * spec calls for) — no per-vendor business logic lives in code, because we have no
 * verified live schema for Gong/Granola/Enterpret's hosted MCP tools. argsEnv holds
 * an optional JSON-stringified object of static tool call arguments (e.g.
 * '{"limit":20}'); invalid/absent JSON safely defaults to {} (see ingest.server.ts).
 *
 * Ships DARK by design: every env var below is unset until the founder activates a
 * slot, exactly like the Phase 2 customer-voice connector fleet.
 */

import type { McpServerSpec } from "./types";

export const MCP_SERVER_REGISTRY: McpServerSpec[] = [
  {
    id: "linear-mcp",
    label: "Linear (MCP)",
    urlEnv: "MCP_LINEAR_URL",
    tokenEnv: "MCP_LINEAR_TOKEN",
    toolEnv: "MCP_LINEAR_TOOL",
    argsEnv: "MCP_LINEAR_ARGS",
  },
  {
    id: "gong",
    label: "Gong (MCP)",
    urlEnv: "MCP_GONG_URL",
    tokenEnv: "MCP_GONG_TOKEN",
    toolEnv: "MCP_GONG_TOOL",
    argsEnv: "MCP_GONG_ARGS",
  },
  {
    id: "granola",
    label: "Granola (MCP)",
    urlEnv: "MCP_GRANOLA_URL",
    tokenEnv: "MCP_GRANOLA_TOKEN",
    toolEnv: "MCP_GRANOLA_TOOL",
    argsEnv: "MCP_GRANOLA_ARGS",
  },
  {
    id: "enterpret",
    label: "Enterpret (MCP)",
    urlEnv: "MCP_ENTERPRET_URL",
    tokenEnv: "MCP_ENTERPRET_TOKEN",
    toolEnv: "MCP_ENTERPRET_TOOL",
    argsEnv: "MCP_ENTERPRET_ARGS",
  },
];
