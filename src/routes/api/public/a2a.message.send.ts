import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { parseBearerToken, validateToken, checkRateLimit, resolveWriteEnabled } from "@/lib/mcp-auth.server";
import {
  SKILL_TO_TOOL,
  isWriteSkill,
  skillExists,
  buildToolParams,
  a2aResult,
  a2aError,
  a2aTaskCompleted,
  a2aTaskFailed,
  type A2AMessage,
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
 * Q2 · A2A message/send endpoint.
 *
 * POST /api/public/a2a/message/send
 * Authorization: Bearer slug:secret
 * Content-Type: application/json
 *
 * Body (JSON-RPC 2.0):
 *   { "jsonrpc": "2.0", "method": "message/send",
 *     "params": { "message": { "role": "user", "parts": [{"kind":"text","text":"..."}] },
 *                 "skill_id": "discovery.search_signals" },
 *     "id": "req-1" }
 *
 * Available skill IDs: discovery.search_signals, knowledge.export_skillpack,
 * discovery.ingest_signal (write-gated: requires write:signal scope + gate on).
 *
 * All calls are token-validated, rate-limited, and audited to api_calls.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json",
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
        const query = (params.query as string) || "";
        const limit = Math.min((params.limit as number) || 20, 100);
        const offset = (params.offset as number) || 0;
        const data = await searchSignals(supabase, workspace_id, query, limit, offset);
        return { success: true, data };
      }
      case "export_skillpack": {
        const limit = typeof params.limit === "number" ? params.limit : undefined;
        const data = await exportSkillpack(supabase, workspace_id, limit);
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
        return { success: false, error: `Skill dispatch not implemented: ${skillId}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export const Route = createFileRoute("/api/public/a2a/message/send")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),

      POST: async ({ request }) => {
        const startTime = Date.now();
        const taskId = crypto.randomUUID();
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        let token_id: string | undefined;
        let workspace_id: string | undefined;
        let reqId: string | number | null = null;

        try {
          // 1. Parse request
          const body = await request.json().catch(() => ({})) as Record<string, unknown>;
          reqId = (body.id as string | number | null) ?? null;
          const params = (body.params as Record<string, unknown>) ?? {};
          const message = params.message as A2AMessage | undefined;
          const skillId = params.skill_id as string | undefined;

          if (!skillId || !skillExists(skillId)) {
            return new Response(
              JSON.stringify(
                a2aError(
                  reqId,
                  -32602,
                  `Missing or unknown skill_id. Available: ${Object.keys(SKILL_TO_TOOL).join(", ")}`,
                ),
              ),
              { status: 400, headers: JSON_HEADERS },
            );
          }

          // 2. Token validation
          const parsed = parseBearerToken(request.headers.get("authorization"));
          if (!parsed) {
            return new Response(
              JSON.stringify(a2aError(reqId, -32003, "Missing or malformed Authorization header")),
              { status: 401, headers: JSON_HEADERS },
            );
          }

          const tokenResult = await validateToken(supabase, parsed.slug, parsed.secretHash);
          if (!tokenResult.valid) {
            return new Response(
              JSON.stringify(a2aError(reqId, -32003, tokenResult.error ?? "Invalid token")),
              { status: 401, headers: JSON_HEADERS },
            );
          }

          token_id = tokenResult.token_id!;
          workspace_id = tokenResult.workspace_id!;
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
            return new Response(
              JSON.stringify(a2aError(reqId, -32002, "Rate limit exceeded")),
              { status: 429, headers: JSON_HEADERS },
            );
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
              return new Response(
                JSON.stringify(a2aError(reqId, -32003, authz.reason ?? "Permission denied")),
                { status: 403, headers: JSON_HEADERS },
              );
            }
          }

          // 5. Dispatch skill
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
                metadata: { elapsed_ms: elapsed, source: "a2a" },
              },
              supabase,
            );
            const task = a2aTaskFailed(taskId, result.error ?? "Skill execution failed");
            return new Response(JSON.stringify(a2aResult(reqId, task)), {
              status: 200,
              headers: JSON_HEADERS,
            });
          }

          await logMCPCall(
            {
              token_id,
              workspace_id,
              tool_name: skillId,
              result: "success",
              metadata: { elapsed_ms: elapsed, source: "a2a" },
            },
            supabase,
          );
          const task = a2aTaskCompleted(taskId, result.data);
          return new Response(JSON.stringify(a2aResult(reqId, task)), {
            status: 200,
            headers: JSON_HEADERS,
          });
        } catch (err) {
          const error = err instanceof Error ? err.message : "Unknown error";
          if (token_id && workspace_id) {
            await logMCPCall(
              { token_id, workspace_id, tool_name: "a2a.message.send", result: "error", error_message: error },
              supabase,
            ).catch(() => undefined);
          }
          return new Response(JSON.stringify(a2aError(reqId, -32603, error)), {
            status: 500,
            headers: JSON_HEADERS,
          });
        }
      },
    },
  },
});
