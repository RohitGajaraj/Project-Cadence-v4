import { createFileRoute } from "@tanstack/react-router";
import { SKILL_TO_TOOL } from "@/lib/a2a-protocol";

/**
 * Q2 · A2A tasks endpoint.
 *
 * GET /api/public/a2a/tasks
 * Returns the list of available A2A skills (task templates).
 * Tasks are synchronous in this implementation — task state is not persisted.
 * A GET with no task ID returns the skill catalog; a GET with ?task_id=<id>
 * returns 404 (task state is not stored across calls).
 */

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60",
} as const;

export const Route = createFileRoute("/api/public/a2a/tasks")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),

      GET: ({ request }) => {
        const url = new URL(request.url);
        const taskId = url.searchParams.get("task_id");

        if (taskId) {
          return new Response(
            JSON.stringify({
              error:
                "Task not found. Tasks in this implementation are synchronous and not persisted. Use /api/public/a2a/message/send.",
              available_skills: Object.keys(SKILL_TO_TOOL),
            }),
            { status: 404, headers: JSON_HEADERS },
          );
        }

        return new Response(
          JSON.stringify({
            skills: Object.keys(SKILL_TO_TOOL),
            message_send: "/api/public/a2a/message/send",
            message_stream: "/api/public/a2a/message/stream",
            note: "Tasks are synchronous. Post to message/send to execute a skill and receive a completed task in one response.",
          }),
          { status: 200, headers: JSON_HEADERS },
        );
      },
    },
  },
});
