// Agent Card data for Cadence's A2A presence.
// Pure functions — no DB. Shared between the card route AND the server.ts
// well-known handler so the two representations never drift.

export const AGENT_CARD_VERSION = "0.8.0";
export const AGENT_CARD_SCHEMA_VERSION = "0.1";

export function buildAgentCard(origin: string): Record<string, unknown> {
  return {
    schema_version: AGENT_CARD_SCHEMA_VERSION,
    name: "Cadence",
    slug: "cadence",
    version: AGENT_CARD_VERSION,
    description:
      "Agent-driven product operating system covering discovery, planning, execution, deployment, GTM, and analytics. Every signal, decision, and artifact lives in one place where AI agents cite, prove, and act on your behalf with approval gates.",
    provider: { organization: "Cadence", url: origin },
    documentation_url: `${origin}/integrations`,
    discovery_url: `${origin}/.well-known/agent.json`,
    endpoints: {
      message_send: `${origin}/api/public/a2a/message/send`,
      message_stream: `${origin}/api/public/a2a/message/stream`,
      tasks: `${origin}/api/public/a2a/tasks`,
      mcp: `${origin}/api/mcp`,
    },
    mcp: {
      endpoint: `${origin}/api/mcp`,
      protocol_versions: ["2025-06-18", "2025-03-26", "2024-11-05"],
      transport: "http+json-rpc-2.0",
      authentication: "bearer",
      token_issuance: `${origin}/settings?section=interop`,
      read_tools: [
        "search_signals",
        "search_opportunities",
        "search_decisions",
        "search_prds",
        "get_prd",
        "get_roadmap",
        "export_skillpack",
        "get_governing_decision",
        "get_contradiction_history",
      ],
      write_tools: [{ name: "ingest_signal", required_scope: "write:signal" }],
      rate_limit_per_minute: 60,
    },
    authentication: {
      schemes: ["bearer"],
      token_url: `${origin}/integrations`,
      protected_resource_metadata: `${origin}/.well-known/oauth-protected-resource`,
    },
    capabilities: {
      streaming: true,
      push_notifications: false,
      multi_turn: false,
      file_attachments: false,
    },
    default_input_modes: ["text/plain", "application/json"],
    default_output_modes: ["application/json"],
    skills: [
      {
        id: "discovery.search_signals",
        name: "Search discovery signals",
        description:
          "Search across user feedback, sales notes, support tickets, and meeting transcripts. Pass the topic or keyword as message text; returns up to 20 ranked signals.",
        input_modes: ["text/plain"],
        output_modes: ["application/json"],
        tags: ["discovery", "read"],
      },
      {
        id: "knowledge.export_skillpack",
        name: "Export decision skill-pack",
        description:
          "Export the workspace's distilled, citable lessons as a versioned, content-hashed bundle. A peer agent can load this as context before making decisions.",
        input_modes: ["text/plain"],
        output_modes: ["application/json"],
        tags: ["knowledge", "memory", "read"],
      },
      {
        id: "discovery.ingest_signal",
        name: "Contribute a discovery signal",
        description:
          "Submit a product signal into the workspace. Requires a token carrying the write:signal scope AND the workspace's outward-write gate enabled. Text is injection-screened before storage.",
        input_modes: ["application/json"],
        output_modes: ["application/json"],
        tags: ["discovery", "write", "scoped"],
      },
    ],
    policies: {
      destructive_actions_require_approval: true,
      pii_egress_filtered: true,
      rate_limit_per_minute: 60,
      writes_require_scope_and_gate: true,
    },
  };
}

export function buildOAuthProtectedResourceMetadata(origin: string): Record<string, unknown> {
  return {
    resource: origin,
    authorization_servers: [],
    bearer_methods_supported: ["header"],
    scopes_supported: ["read", "write:signal"],
    token_endpoint_auth_methods_supported: ["none"],
    documentation_url: `${origin}/integrations`,
  };
}

export const AGENT_CARD_CORS_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300",
  "Access-Control-Allow-Origin": "*",
} as const;
