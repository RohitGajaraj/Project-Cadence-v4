import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callModelStream } from "@/lib/ai/runtime.server";

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

        const system = `You are Cadence — the operating system for AI-native Product Managers.
Voice: calm, confident, Apple-precise, Linear-clear. Use Markdown, tight bullets, no fluff.
You know the user by name and ground every answer in their workspace.

WORKSPACE CONTEXT (JSON):
${grounding}`;

        const history: ChatMsg[] = (historyRes.data ?? []).map((m: { role: string; content: string }) => ({
          role: m.role as ChatMsg["role"],
          content: m.content,
        }));

        // Persist user message first
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