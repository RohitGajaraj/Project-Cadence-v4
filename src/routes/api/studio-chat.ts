import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callModelStream } from "@/lib/ai/runtime.server";

type Ref = { kind: "prd" | "opportunity" | "decision" | "meeting" | "task"; id: string };

export const Route = createFileRoute("/api/studio-chat")({
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
          prototype_id: string;
          content: string;
          context_refs?: Ref[];
          attachment_ids?: string[];
          cowork_turn?: number; // 0..5
        };
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        if (!body.prototype_id || !body.content || body.content.length > 8000)
          return json({ error: "Invalid input" }, 400);

        // Verify prototype ownership + load files
        const { data: proto } = await supabase
          .from("prototypes").select("id,name").eq("id", body.prototype_id).maybeSingle();
        if (!proto) return json({ error: "Prototype not found" }, 404);

        const [filesRes, historyRes] = await Promise.all([
          supabase.from("prototype_files").select("path,content,language").eq("prototype_id", body.prototype_id),
          supabase.from("prototype_messages").select("role,content")
            .eq("prototype_id", body.prototype_id).order("created_at").limit(30),
        ]);
        const files = filesRes.data ?? [];

        // Resolve context refs
        const ctxSnippets: { kind: string; title: string; body: string }[] = [];
        for (const r of (body.context_refs ?? []).slice(0, 12)) {
          if (r.kind === "prd") {
            const { data: p } = await supabase.from("prds").select("title,body_md").eq("id", r.id).maybeSingle();
            if (p) ctxSnippets.push({ kind: "PRD", title: p.title, body: (p.body_md ?? "").slice(0, 4000) });
          } else if (r.kind === "opportunity") {
            const { data: p } = await supabase.from("opportunities").select("title,problem,hypothesis,target_user").eq("id", r.id).maybeSingle();
            if (p) ctxSnippets.push({ kind: "Opportunity", title: p.title,
              body: `Problem: ${p.problem}\nHypothesis: ${p.hypothesis ?? ""}\nTarget: ${p.target_user ?? ""}`.slice(0, 3000) });
          } else if (r.kind === "decision") {
            const { data: p } = await supabase.from("decisions").select("title,rationale").eq("id", r.id).maybeSingle();
            if (p) ctxSnippets.push({ kind: "Decision", title: p.title, body: (p.rationale ?? "").slice(0, 3000) });
          } else if (r.kind === "meeting") {
            const { data: p } = await supabase.from("meetings").select("title,summary,notes").eq("id", r.id).maybeSingle();
            if (p) ctxSnippets.push({ kind: "Meeting", title: p.title, body: `${p.summary ?? ""}\n${p.notes ?? ""}`.slice(0, 3000) });
          } else if (r.kind === "task") {
            const { data: p } = await supabase.from("tasks").select("title,status,priority").eq("id", r.id).maybeSingle();
            if (p) ctxSnippets.push({ kind: "Task", title: p.title, body: `Status: ${p.status} • Priority: ${p.priority}` });
          }
        }

        // Resolve attachments
        let attSnippets: { name: string; text: string }[] = [];
        if (body.attachment_ids?.length) {
          const { data: atts } = await supabase
            .from("prototype_attachments")
            .select("id,name,extracted_text")
            .in("id", body.attachment_ids.slice(0, 10));
          attSnippets = (atts ?? []).map((a) => ({
            name: a.name, text: (a.extracted_text ?? "").slice(0, 8000),
          }));
        }

        const system = `You are a senior front-end engineer pair-programming inside Cadence Code Studio.
You build small multi-file HTML/CSS/JS prototypes. No frameworks unless asked.

RESPONSE FORMAT — CRITICAL:
1. Write a short conversational explanation in Markdown of your plan (2-6 bullets).
2. Then, on a new line, emit EXACTLY this marker block when you propose file changes:
<<<CHANGES_JSON>>>
{"changes":[{"path":"index.html","action":"update|create|delete","content":"FULL FILE CONTENT"}],"summary":"one sentence"}
<<<END>>>
Rules:
- Return COMPLETE file contents for each changed file (never diffs).
- Only touch files needed. Max 12 changes per turn.
- Use semantic HTML, modern CSS, accessibility.
- If no code change is needed, omit the marker block entirely.`;

        const context = JSON.stringify({
          prototype: proto.name,
          files: files.map((f) => ({ path: f.path, language: f.language, content: f.content.slice(0, 12_000) })),
          context: ctxSnippets,
          attachments: attSnippets,
          cowork_turn: body.cowork_turn ?? 0,
        }).slice(0, 60_000);

        const history = (historyRes.data ?? []).map((m) => ({ role: m.role, content: m.content }));

        // Persist user message
        await supabase.from("prototype_messages").insert({
          prototype_id: body.prototype_id, user_id: userId,
          role: "user", content: body.content,
        });

        let result: Awaited<ReturnType<typeof callModelStream>>;
        try {
          result = await callModelStream(supabase, userId, {
            surface: "studio",
            surface_ref: body.prototype_id,
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: system },
              { role: "system", content: `Workspace context:\n${context}` },
              ...history,
              { role: "user", content: body.content },
            ],
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error("[studio-chat] callModelStream error:", e);
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
              console.error("[studio-chat] stream error", e);
              controller.enqueue(encoder.encode(`data: {"error":"stream interrupted"}\n\n`));
            } finally {
              controller.close();
              // Parse changes block
              let narrative = assistantText;
              let changes: { path: string; action?: string; content: string }[] = [];
              let summary = "";
              const m = assistantText.match(/<<<CHANGES_JSON>>>([\s\S]*?)<<<END>>>/);
              if (m) {
                narrative = assistantText.replace(m[0], "").trim();
                try {
                  const parsed = JSON.parse(m[1].trim());
                  changes = (parsed.changes ?? []).slice(0, 12)
                    .filter((c: { path?: string; content?: unknown }) => c.path && typeof c.content === "string");
                  summary = String(parsed.summary ?? "");
                } catch (e) {
                  console.error("[studio-chat] bad JSON block", e);
                }
              }
              await supabase.from("prototype_messages").insert({
                prototype_id: body.prototype_id, user_id: userId,
                role: "assistant", content: narrative || assistantText,
                changes_json: changes, applied: false,
              });
              if (summary || changes.length) {
                controller.enqueue?.(encoder.encode(""));
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