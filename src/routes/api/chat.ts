import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callModelStream, callModel } from "@/lib/ai/runtime.server";
import { createMission } from "@/lib/ai/handoff.server";
import { runAgentLoop } from "@/lib/ai/loop.server";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type, authorization",
          },
        }),
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json({ error: "Backend not configured" }, 500);
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
        const token = authHeader.slice(7);
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
        const userId = claimsData.claims.sub as string;

        let body: {
          conversationId: string;
          content: string;
          model?: string;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        if (!body.conversationId || !body.content || body.content.length > 8000)
          return json({ error: "Invalid input" }, 400);

        // Load conversation (RLS scopes by user)
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .select("*")
          .eq("id", body.conversationId)
          .single();
        if (convErr || !conv) return json({ error: "Conversation not found" }, 404);

        const model = body.model || conv.model || "google/gemini-3-flash-preview";

        // Ground in workspace
        const [tasksRes, projectsRes, historyRes, profileRes] = await Promise.all([
          supabase.from("tasks").select("title,status,priority,is_deep_work").limit(30),
          supabase.from("projects").select("name,north_star,status").limit(10),
          supabase
             .from("messages")
             .select("role,content")
             .eq("conversation_id", body.conversationId)
             .order("created_at")
             .limit(40),
          supabase.from("profiles").select("display_name,full_name,role").eq("id", userId).maybeSingle(),
        ]);

        const grounding = JSON.stringify({
          projects: projectsRes.data,
          tasks: tasksRes.data,
          user: profileRes.data,
        }).slice(0, 6000);

        // 1. Classification of User Intent
        const classificationSystem = `You are the intent classifier for Cadence, an agent-native product operating system.
Your job is to analyze the user's latest input and decide if it is a request to perform a multi-agent execution mission (e.g. drafting a PRD, building code, doing research, running analyses, creating tasks, generating syncs) or a general chat query (e.g. explaining a concept, asking for info, chatting, greeting).

A request is a mission if it asks Cadence to DO something active that involves planning, spec writing, coding, or scanning multiple resources, rather than just answering a question.

You must output a JSON object EXACTLY in this format:
{
  "is_mission": true | false,
  "suggested_title": "A short, 3-6 word title for the mission (null if not a mission)",
  "goal": "The clear goal statement for the orchestrator (null if not a mission)"
}`;

        let isMission = false;
        let missionTitle = "";
        let missionGoal = "";

        try {
          const classResult = await callModel(supabase, userId, {
            surface: "chat",
            surface_ref: body.conversationId,
            model: "google/gemini-3-flash-preview",
            responseFormat: "json_object",
            guardrails: false,
            messages: [
              { role: "system", content: classificationSystem },
              { role: "user", content: body.content }
            ]
          });

          if (classResult.status === "ok" && classResult.output) {
            const parsed = JSON.parse(classResult.output);
            if (parsed && typeof parsed === "object") {
              isMission = !!parsed.is_mission;
              missionTitle = parsed.suggested_title || "";
              missionGoal = parsed.goal || "";
            }
          }
        } catch (e) {
          console.error("[chat] intent classification failed (falling back to chat):", e);
        }

        // 2. Resolve default workspace & check pre-flight constraints
        const { data: ws } = await supabase.rpc("current_user_default_workspace");
        const workspaceId = (ws as string | null) ?? null;

        let preflightError = "";
        let startingAgent: { id: string } | null = null;

        if (isMission) {
          try {
            // Seed orchestrator (idempotent)
            const { error: seedErr } = await supabase.rpc("seed_orchestrator_agent", { p_user_id: userId });
            if (seedErr) {
              preflightError = `seed orchestrator failed: ${seedErr.message}`;
            } else if (!workspaceId) {
              preflightError = "No default workspace found for user";
            } else {
              const { data: agent } = await supabase.from("agents")
                .select("id").eq("user_id", userId).eq("slug", "orchestrator").maybeSingle();
              if (!agent) {
                preflightError = "Orchestrator agent not found after seeding";
              } else {
                startingAgent = agent;
                // Pre-flight specialists check
                const { count: specialists } = await supabase
                  .from("agents")
                  .select("id", { count: "exact", head: true })
                  .eq("user_id", userId)
                  .eq("enabled", true)
                  .neq("slug", "orchestrator");
                if ((specialists ?? 0) === 0) {
                  preflightError = "No specialist agents enabled. Please enable at least one specialist agent (Discovery, Strategist, Builder) in the Agents roster before starting a mission.";
                }
              }
            }
          } catch (err: any) {
            preflightError = err.message || String(err);
          }

          if (preflightError) {
            console.warn("[chat] mission pre-flight failed (falling back to regular chat):", preflightError);
            isMission = false;
          }
        }

        // 3. Dispatch orchestrated mission and exit if classified as mission
        if (isMission && startingAgent && workspaceId) {
          try {
            // Create the mission row
            const mission = await createMission(supabase, userId, workspaceId, {
              title: missionTitle.trim() || body.content.slice(0, 80),
              goal: missionGoal || body.content,
              starting_agent_id: startingAgent.id,
            });

            // Persist user message first
            const { error: userInsErr } = await supabase.from("messages").insert({
              conversation_id: body.conversationId,
              user_id: userId,
              role: "user",
              content: body.content,
            });
            if (userInsErr) return json({ error: userInsErr.message }, 500);

            // Fire-and-forget the orchestrator loop asynchronously
            runAgentLoop(supabase, userId, {
              agentSlug: "orchestrator",
              goal: missionGoal || body.content,
              model: model,
              missionId: mission.id,
              workspaceId,
            }).catch((err) => {
              console.error("[chat] runAgentLoop async dispatch failed:", err);
            });

            // Return custom SSE stream yielding content + mission_id instantly
            const text = `I've planned and dispatched a new orchestrated mission: **${mission.title}**.\n\nYou can track the progress of the specialist agents and approve their decisions inline below.`;
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              async start(controller) {
                const payload = JSON.stringify({
                  choices: [{
                    delta: {
                      content: text,
                      mission_id: mission.id
                    }
                  }]
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();

                // Persist the assistant message in DB with mission_id link
                await (supabase.from("messages") as any).insert({
                  conversation_id: body.conversationId,
                  user_id: userId,
                  role: "assistant",
                  content: text,
                  mission_id: mission.id,
                  model,
                });

                // Auto-title conversation if default
                if (conv.title === "New conversation") {
                  const title = mission.title.slice(0, 60).trim();
                  const builder = supabase.from("conversations") as unknown as {
                    update: (p: Record<string, unknown>) => {
                      eq: (c: string, v: string) => Promise<{ error: unknown }>;
                    };
                  };
                  await builder.update({ title, updated_at: new Date().toISOString() }).eq("id", body.conversationId);
                } else {
                  const builder = supabase.from("conversations") as unknown as {
                    update: (p: Record<string, unknown>) => {
                      eq: (c: string, v: string) => Promise<{ error: unknown }>;
                    };
                  };
                  await builder.update({ updated_at: new Date().toISOString() }).eq("id", body.conversationId);
                }
              }
            });

            return new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*",
              },
            });

          } catch (e: any) {
            console.error("[chat] failed to start orchestrated mission:", e);
            preflightError = `Failed to initialize mission: ${e.message || String(e)}`;
            isMission = false;
          }
        }

        const system = `You are Cadence, the agent-native product operating system.
Voice: calm, confident, Apple-precise, Linear-clear. Use Markdown, tight bullets, no fluff.
You know the user by name and ground every answer in their workspace.

WORKSPACE CONTEXT (JSON):
${grounding}`;

        const history: ChatMsg[] = (historyRes.data ?? []).map((m: { role: string; content: string }) => ({
          role: m.role as ChatMsg["role"],
          content: m.content,
        }));

        const preflightWarning = preflightError
          ? [{ role: "system" as const, content: `CRITICAL: The user tried to dispatch a mission but checks failed: "${preflightError}". Explain this problem to the user (e.g. if they need to enable agents in the Agents page) and proceed with a regular conversation.` }]
          : [];

        // Persist user message first for regular chat path
        const { error: insErr } = await supabase.from("messages").insert({
          conversation_id: body.conversationId,
          user_id: userId,
          role: "user",
          content: body.content,
        });
        if (insErr) return json({ error: insErr.message }, 500);

        let result: Awaited<ReturnType<typeof callModelStream>>;
        try {
          result = await callModelStream(supabase, userId, {
            surface: "chat",
            surface_ref: body.conversationId,
            model,
            messages: [
              { role: "system", content: system },
              ...history,
              ...preflightWarning,
              { role: "user", content: body.content },
            ],
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error("[chat] callModelStream error:", e);
          if (errMsg.includes("budget reached") || errMsg.includes("credits exhausted")) {
            return json({ error: errMsg }, 402);
          }
          if (errMsg.includes("Blocked by guardrail")) {
            return json({ error: errMsg }, 400);
          }
          return json({ error: errMsg }, 500);
        }

        const reader = result.stream.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let assistantText = "";
        let buffer = "";

        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
                buffer += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = buffer.indexOf("\n")) !== -1) {
                  let line = buffer.slice(0, nl);
                  buffer = buffer.slice(nl + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (!line.startsWith("data: ")) continue;
                  const payload = line.slice(6).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(payload);
                    const piece: string | undefined = parsed.choices?.[0]?.delta?.content;
                    if (piece) assistantText += piece;
                  } catch {
                    buffer = line + "\n" + buffer;
                    break;
                  }
                }
              }
            } catch (e) {
              console.error("[chat] stream error", e);
              controller.enqueue(encoder.encode(`data: {"error":"stream interrupted"}\n\n`));
            } finally {
              controller.close();
              // Persist assistant message (best-effort)
              if (assistantText.trim()) {
                await supabase.from("messages").insert({
                  conversation_id: body.conversationId,
                  user_id: userId,
                  role: "assistant",
                  content: assistantText,
                  model,
                });
                // Auto-title from first user prompt if still "New conversation"
                if (conv.title === "New conversation") {
                  const title = body.content.slice(0, 60).trim();
                  const builder = supabase.from("conversations") as unknown as {
                    update: (p: Record<string, unknown>) => {
                      eq: (c: string, v: string) => Promise<{ error: unknown }>;
                    };
                  };
                  await builder.update({ title, updated_at: new Date().toISOString() }).eq("id", body.conversationId);
                } else {
                  const builder = supabase.from("conversations") as unknown as {
                    update: (p: Record<string, unknown>) => {
                      eq: (c: string, v: string) => Promise<{ error: unknown }>;
                    };
                  };
                  await builder.update({ updated_at: new Date().toISOString() }).eq("id", body.conversationId);
                }
              }
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}