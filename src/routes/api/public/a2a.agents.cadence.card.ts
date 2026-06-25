import { createFileRoute } from "@tanstack/react-router";
import { buildAgentCard, AGENT_CARD_CORS_HEADERS } from "@/lib/a2a-card";

/**
 * Q2 · A2A Agent Card.
 *
 * GET /api/public/a2a/agents/cadence/card
 * Public, unauthenticated discovery endpoint. The same payload is also served
 * at /.well-known/agent.json (see src/server.ts) for standard A2A auto-discovery.
 *
 * Spec: https://agent2agent.dev/spec/#agent-card
 */
export const Route = createFileRoute("/api/public/a2a/agents/cadence/card")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        return new Response(JSON.stringify(buildAgentCard(origin), null, 2), {
          status: 200,
          headers: AGENT_CARD_CORS_HEADERS,
        });
      },
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
    },
  },
});
