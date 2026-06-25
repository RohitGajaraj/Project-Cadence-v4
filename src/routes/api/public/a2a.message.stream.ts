import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  parseBearerToken,
  validateToken,
  checkRateLimit,
  resolveWriteEnabled,
} from "@/lib/mcp-auth.server";
import {
  SKILL_TO_TOOL,
  isWriteSkill,
  skillExists,
  buildToolParams,
  a2aError,
  a2aTaskFailed,
  sseEvent,
  type A2AMessage,
  type A2ATask,
} from "@/lib/a2a-protocol";
import { canCallWriteTool } from "@/lib/mcp-protocol";
import {
  searchSignals,
  exportSkillpack,
  ingestSignal,
  logMCPCall,
  type IngestSignalArgs,
} from "@/lib/mcp.functions";

/**
 * Q2 · A2A message/stream endpoint — SSE variant of message/send.
 *
 * POST /api/public/a2a/message/stream
 * Authorization: Bearer slug:secret
 * Content-Type: application/json
 * Accept: text/event-stream
 *
 * Same request body as message/send. Returns a server-sent event stream:
 *   event: task_created  data: { id, status: { state: "working" } }
 *   event: message_delta data: { delta: { role:"agent", parts:[...] } }
 *   event: task_completed data: { id, status: { state: "completed" } }
 *
 * The underlying tools are synchronous (no incremental streaming), so the
 * stream is: created → full result in one delta → completed.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
} as const;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "Access-Control-Allow-Origin": "*",
} as const;

async function dispatchSkill(
  supabase: any,
  skillId: string,
  workspace_id: string,
  user_id: string,
  message: A2AMessage | undefined,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const toolName = SKILL_TO_TOOL[skillId];
  const params = buildToolParams(toolName, message);
  try {
    switch (toolName) {
      case "search_signals": {
        const data = await searchSignals(
          supabase,
          workspace_id,
          (params.query as string) || "",
          Math.min((params.limit as number) || 20, 100),
          (params.offset as number) || 0,
        );
        return { success: true, data };
      }
      case "export_skillpack": {
        const data = await exportSkillpack(
          supabase,
          workspace_id,
          typeof params.limit === "number" ? params.limit : undefined,
        );
        return { success: true, data };
      }
      case "ingest_signal": {
        const data = await ingestSignal(
          supabase,
          workspace_id,
          user_id,
          params as IngestSignalArgs,
        );
        return { success: true, data };
      }
      default:
        return { success: false, error: `Skill not implemented: ${skillId}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export const Route = createFileRoute("/api/public/a2a/message/stream")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
          },
        }),

      POST: async ({ request }) => {
        const taskId = crypto.randomUUID();
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        // Helper: write a full SSE error frame then close
        const sseErrorResponse = (code: number, message: string) => {
          const errTask: A2ATask = {
            id: taskId,
            status: { state: "failed", timestamp: new Date().toISOString(), message },
          };
          const body = sseEvent("task_failed", errTask) + sseEvent("close", { reason: message });
          return new Response(body, { status: 200, headers: SSE_HEADERS });
        };

        try {
          // 1. Parse
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const params = (body.params as Record<string, unknown>) ?? {};
          const message = params.message as A2AMessage | undefined;
          const skillId = params.skill_id as string | undefined;

          if (!skillId || !skillExists(skillId)) {
            // Non-SSE error before streaming starts
            return new Response(
              JSON.stringify(
                a2aError(
                  (body.id as string | number | null) ?? null,
                  -32602,
                  `Missing or unknown skill_id. Available: ${Object.keys(SKILL_TO_TOOL).join(", ")}`,
                ),
              ),
              { status: 400, headers: JSON_HEADERS },
            );
          }

          // 2. Token validation
          const parsed = parseBearerToken(request.headers.get("authorization"));
          if (!parsed) return sseErrorResponse(-32003, "Missing or malformed Authorization header");

          const tokenResult = await validateToken(supabase, parsed.slug, parsed.secretHash);
          if (!tokenResult.valid)
            return sseErrorResponse(-32003, tokenResult.error ?? "Invalid token");

          const token_id = tokenResult.token_id!;
          const workspace_id = tokenResult.workspace_id!;
          const user_id = tokenResult.user_id!;
          const scopes = tokenResult.scopes ?? [];

          // 3. Rate limit
          const { allowed } = await checkRateLimit(
            supabase,
            token_id,
            tokenResult.rate_limit_per_min!,
          );
          if (!allowed) {
            await logMCPCall(
              { token_id, workspace_id, tool_name: skillId, result: "rate_limit" },
              supabase,
            );
            return sseErrorResponse(-32002, "Rate limit exceeded");
          }

          // 4. Write authorization
          if (isWriteSkill(skillId)) {
            const writeEnabled = await resolveWriteEnabled(supabase);
            const authz = canCallWriteTool(SKILL_TO_TOOL[skillId], scopes, writeEnabled);
            if (!authz.allowed) {
              await logMCPCall(
                {
                  token_id,
                  workspace_id,
                  tool_name: skillId,
                  result: "permission_denied",
                  error_message: authz.reason,
                },
                supabase,
              );
              return sseErrorResponse(-32003, authz.reason ?? "Permission denied");
            }
          }

          // 5. Build SSE stream
          const startTime = Date.now();
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();
          const write = (s: string) => writer.write(encoder.encode(s));

          // Execute skill in background then stream events
          (async () => {
            try {
              // created
              const created: A2ATask = {
                id: taskId,
                status: { state: "working", timestamp: new Date().toISOString() },
              };
              await write(sseEvent("task_created", created));

              const result = await dispatchSkill(supabase, skillId, workspace_id, user_id, message);
              const elapsed = Date.now() - startTime;

              if (!result.success) {
                await logMCPCall(
                  {
                    token_id,
                    workspace_id,
                    tool_name: skillId,
                    result: "error",
                    error_message: result.error,
                    metadata: { elapsed_ms: elapsed, source: "a2a_stream" },
                  },
                  supabase,
                );
                const failed: A2ATask = {
                  id: taskId,
                  status: {
                    state: "failed",
                    timestamp: new Date().toISOString(),
                    message: result.error,
                  },
                };
                await write(sseEvent("task_failed", failed));
              } else {
                await logMCPCall(
                  {
                    token_id,
                    workspace_id,
                    tool_name: skillId,
                    result: "success",
                    metadata: { elapsed_ms: elapsed, source: "a2a_stream" },
                  },
                  supabase,
                );
                // delta
                await write(
                  sseEvent("message_delta", {
                    delta: {
                      role: "agent",
                      parts: [{ kind: "data", data: { result: result.data } }],
                    },
                  }),
                );
                // completed
                const done: A2ATask = {
                  id: taskId,
                  status: { state: "completed", timestamp: new Date().toISOString() },
                };
                await write(sseEvent("task_completed", done));
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Internal error";
              await write(
                sseEvent("task_failed", { id: taskId, status: { state: "failed", message: msg } }),
              );
            } finally {
              await writer.close().catch(() => undefined);
            }
          })();

          return new Response(readable, { status: 200, headers: SSE_HEADERS });
        } catch (err) {
          const error = err instanceof Error ? err.message : "Unknown error";
          return new Response(JSON.stringify(a2aError(null, -32603, error)), {
            status: 500,
            headers: JSON_HEADERS,
          });
        }
      },
    },
  },
});
