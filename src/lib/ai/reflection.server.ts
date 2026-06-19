/**
 * F-AGENT-2 — agent self-reflection.
 *
 * After a run terminates cleanly (status='completed', not halted by
 * governance), distil a one-paragraph reflection from the trace and persist
 * it to `agent_memory` with `kind='reflection'`. Reflections are later
 * pulled in by `recallMemory()` so the same agent benefits from its own
 * lessons on the next mission.
 *
 * The auto path is invoked from `loop.server.ts` (no LLM tool call
 * required). The `memory.reflect` tool is a thin wrapper around the same
 * helper so an agent can also reflect explicitly mid-run if it wants to.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { callModel } from "./runtime.server";
import { embedOne } from "@/lib/rag/embed.server";

export type ReflectionInput = {
  userId: string;
  agentId: string | null;
  agentSlug: string;
  workspaceId: string | null;
  runId: string | null;
  traceId: string | null;
  goal: string;
  finalMsg: string;
  /** Optional pre-rendered step summary (cheaper than re-querying). */
  stepSummary?: string;
};

export type ReflectionRow = {
  id: string;
  content: string;
  importance: number;
};

function safeJson<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

/**
 * Render a compact summary of tool calls + final answer for the sub-model.
 * We pull tool_calls by trace_id (the only join available on that table) and
 * cap the payload so this stays cheap.
 */
async function renderTrace(
  supabase: SupabaseClient,
  userId: string,
  traceId: string | null,
  goal: string,
  finalMsg: string,
  preRendered?: string,
): Promise<string> {
  if (preRendered && preRendered.length > 0) {
    return `Goal: ${goal}\n\nTrace:\n${preRendered}\n\nFinal: ${finalMsg.slice(0, 1200)}`;
  }
  let toolBlock = "";
  if (traceId) {
    try {
      const { data } = await supabase
        .from("tool_calls")
        .select("tool_name,ok,error,latency_ms")
        .eq("user_id", userId)
        .eq("trace_id", traceId)
        .order("created_at", { ascending: true })
        .limit(20);
      if (data?.length) {
        toolBlock = data
          .map((t) => {
            const tag = t.ok ? "ok" : `err: ${(t.error ?? "").slice(0, 120)}`;
            return `- ${t.tool_name} (${t.latency_ms ?? 0}ms · ${tag})`;
          })
          .join("\n");
      }
    } catch {
      /* non-fatal */
    }
  }
  return [
    `Goal: ${goal}`,
    toolBlock ? `Tool calls:\n${toolBlock}` : "Tool calls: (none recorded)",
    `Final: ${finalMsg.slice(0, 1200)}`,
  ].join("\n\n");
}

/**
 * Persist one reflection. Returns the inserted row, or null if the sub-model
 * returned nothing usable. Never throws — reflection failures must not break
 * the underlying agent run.
 */
export async function autoReflect(
  supabase: SupabaseClient,
  input: ReflectionInput,
): Promise<ReflectionRow | null> {
  try {
    const trace = await renderTrace(
      supabase,
      input.userId,
      input.traceId,
      input.goal,
      input.finalMsg,
      input.stepSummary,
    );

    const res = await callModel(supabase, input.userId, {
      surface: "agent",
      surface_ref: `reflect:${input.agentSlug}`,
      model: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      runId: input.runId,
      workspaceId: input.workspaceId,
      messages: [
        {
          role: "system",
          content:
            "You distil a one-paragraph LESSON the agent should remember for next time. " +
            'Return strict JSON: {"lesson":string, "what_worked":string, "what_to_change":string, "importance":1|2|3|4|5}. ' +
            'lesson <= 240 chars, written in second person ("You"). importance: 1 = trivial, 5 = pivotal. ' +
            "Skip vague platitudes — if there is nothing specific, set importance=1.",
        },
        { role: "user", content: trace },
      ],
    });

    const parsed = safeJson<{
      lesson?: string;
      what_worked?: string;
      what_to_change?: string;
      importance?: number;
    }>(res.output);
    const lesson = parsed?.lesson?.trim();
    if (!lesson) return null;

    const importance = Math.max(1, Math.min(5, Math.round(parsed?.importance ?? 3)));

    let emb: number[] | null = null;
    try {
      emb = await embedOne(lesson);
    } catch {
      /* embedding is optional */
    }

    const { data, error } = await supabase
      .from("agent_memory")
      .insert({
        user_id: input.userId,
        agent_id: input.agentId,
        agent_slug: input.agentSlug,
        scope: "agent",
        kind: "reflection",
        content: lesson,
        importance,
        embedding: emb as unknown as string | null,
        metadata: {
          run_id: input.runId,
          trace_id: input.traceId,
          what_worked: parsed?.what_worked ?? null,
          what_to_change: parsed?.what_to_change ?? null,
          goal: input.goal.slice(0, 400),
        },
      })
      .select("id,content,importance")
      .single();

    if (error) {
      console.error("autoReflect insert failed:", error);
      return null;
    }
    // WM-F1: tag the reflection with its workspace so recall scopes to the active
    // workspace (reflections are the highest-volume recalled memory kind). Done as
    // a separate, error-tolerant update so it stays pre-migration safe: before the
    // column exists the update no-ops, and an untagged row recalls as global.
    if (input.workspaceId && (data as { id?: string } | null)?.id) {
      try {
        await supabase
          .from("agent_memory")
          .update({ workspace_id: input.workspaceId })
          .eq("id", (data as { id: string }).id);
      } catch {
        /* column not present yet (pre-migration) — non-fatal */
      }
    }
    return data as ReflectionRow;
  } catch (e) {
    console.error("autoReflect failed:", e);
    return null;
  }
}

/**
 * Trigger the autonomy auto-advance RPC. Wrapped here so call sites don't
 * have to know the RPC name + error shape. Idempotent and safe to call on
 * every completion.
 */
export async function maybeAutoAdvanceArc(
  supabase: SupabaseClient,
  userId: string,
  agentId: string | null,
): Promise<void> {
  if (!agentId) return;
  try {
    await supabase.rpc("auto_advance_agent_arc", {
      p_user_id: userId,
      p_agent_id: agentId,
    });
  } catch (e) {
    console.error("auto_advance_agent_arc failed:", e);
  }
}
