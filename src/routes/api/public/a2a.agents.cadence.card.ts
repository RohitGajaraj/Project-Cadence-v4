import { createFileRoute } from "@tanstack/react-router";

/**
 * Phase 7.3.a — A2A Agent Card.
 * Public, unauthenticated discovery endpoint. Describes Cadence as an
 * Agent-to-Agent peer. The same payload should be served from
 * /.well-known/agent.json once that route is wired through the edge.
 *
 * Spec: https://agent2agent.dev/spec/#agent-card
 */
export const Route = createFileRoute("/api/public/a2a/agents/cadence/card")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        const card = {
          schema_version: "0.1",
          name: "Cadence",
          slug: "cadence",
          version: "0.7.0",
          description:
            "Agent-driven product operating system covering discovery, planning, execution, deployment, GTM, and analytics. Every signal, decision, and artifact lives in one place where AI agents cite, prove, and act on your behalf with approval gates.",
          provider: { organization: "Cadence", url: origin },
          documentation_url: `${origin}/integrations`,
          endpoints: {
            message_send: `${origin}/api/public/a2a/message/send`,
            message_stream: `${origin}/api/public/a2a/message/stream`,
            tasks: `${origin}/api/public/a2a/tasks`,
          },
          authentication: {
            schemes: ["bearer"],
            token_url: `${origin}/integrations`,
          },
          capabilities: {
            streaming: true,
            push_notifications: false,
            multi_turn: true,
            file_attachments: false,
          },
          default_input_modes: ["text/plain", "application/json"],
          default_output_modes: ["text/plain", "application/json"],
          skills: [
            {
              id: "discovery.search_signals",
              name: "Search discovery signals",
              description:
                "Search across user feedback, sales notes, support tickets, and meeting transcripts with retrieval-grounded citations.",
              input_modes: ["text/plain"],
              output_modes: ["application/json"],
              tags: ["discovery", "rag"],
            },
            {
              id: "prd.draft",
              name: "Draft a PRD",
              description:
                "Generate a PRD from one or more opportunities, citing the underlying signals and prior decisions. Returns a draft awaiting human approval.",
              tags: ["build", "writing", "approval-gated"],
            },
            {
              id: "roadmap.propose_sprint",
              name: "Propose next sprint",
              description:
                "ICE-score open opportunities and tasks, then propose a balanced sprint plan. Dispatch to Linear requires Decision Queue approval.",
              tags: ["planning", "approval-gated"],
            },
            {
              id: "analytics.summarize_traces",
              name: "Summarize AI traces",
              description:
                "Summarize recent agent traces with cost, latency, judge scores, and guardrail outcomes.",
              tags: ["aiops", "telemetry"],
            },
          ],
          policies: {
            destructive_actions_require_approval: true,
            pii_egress_filtered: true,
            rate_limit_per_minute: 60,
          },
        };
        return new Response(JSON.stringify(card, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
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
