import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";

export const listMeetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await context.supabase
      .from("meetings")
      .select(
        "id,title,start_at,end_at,stakeholder,summary,processed_at,action_items,decisions_made",
      )
      .gte("start_at", since)
      .order("start_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { meetings: data ?? [] };
  });

export const getMeeting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("meetings")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { meeting: row };
  });

export const saveTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), transcript: z.string().max(200_000) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("meetings")
      .update({ transcript: data.transcript })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const createSchema = z.object({
  title: z.string().min(1).max(200),
  start_at: z.string(),
  end_at: z.string(),
  stakeholder: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("meetings")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { meeting: row };
  });

export const deleteMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("meetings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- AI: extract intelligence from a transcript -----

type ExtractResult = {
  summary: string;
  action_items: {
    title: string;
    owner?: string;
    estimate_hours?: number;
    is_deep_work?: boolean;
  }[];
  decisions: { title: string; rationale?: string }[];
  open_questions: string[];
};

export const extractMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), commit: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: m, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !m) throw new Error("Meeting not found");
    if (!m.transcript || m.transcript.trim().length < 20)
      throw new Error("Add a transcript first.");

    const system = `You are a meticulous chief of staff. Read the meeting transcript and return STRICT JSON only.
Schema:
{
  "summary": "3-5 sentence TL;DR",
  "action_items": [{ "title": "verb-led, <80 chars", "owner": "name or null", "estimate_hours": 1, "is_deep_work": false }],
  "decisions": [{ "title": "<120 chars", "rationale": "<300 chars" }],
  "open_questions": ["short question"]
}
Rules: be terse, no markdown fences, no prose outside JSON.`;

    const result = await callModel(supabase, userId, {
      surface: "brief",
      surface_ref: `meeting:${m.id}`,
      model: "google/gemini-2.5-pro",
      fallbackModel: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Meeting: ${m.title}\nStakeholder: ${m.stakeholder ?? "n/a"}\n\nTranscript:\n${m.transcript.slice(0, 60_000)}`,
        },
      ],
    });
    const parsed = (result.json ?? null) as ExtractResult | null;
    if (!parsed) throw new Error("AI returned invalid JSON");

    // Persist preview on meeting row
    await supabase
      .from("meetings")
      .update({
        summary: parsed.summary ?? "",
        action_items: parsed.action_items ?? [],
        decisions_made: parsed.decisions ?? [],
      })
      .eq("id", m.id);

    if (!data.commit) return { preview: parsed };

    // Commit: create tasks, decisions, signals
    const taskRows = (parsed.action_items ?? []).slice(0, 25).map((a) => ({
      user_id: userId,
      title: a.title.slice(0, 280),
      is_deep_work: !!a.is_deep_work,
      estimate_hours: typeof a.estimate_hours === "number" ? a.estimate_hours : null,
      project_id: null,
    }));
    if (taskRows.length) await supabase.from("tasks").insert(taskRows);

    const decRows = (parsed.decisions ?? []).slice(0, 15).map((d) => ({
      user_id: userId,
      title: d.title.slice(0, 280),
      rationale: d.rationale?.slice(0, 2000) ?? null,
      meeting_id: m.id,
      status: "pending",
    }));
    if (decRows.length) await supabase.from("decisions").insert(decRows);

    const sigRows = (parsed.open_questions ?? []).slice(0, 15).map((q) => ({
      user_id: userId,
      content: q.slice(0, 2000),
      source: "meeting",
    }));
    if (sigRows.length) await supabase.from("signals").insert(sigRows);

    await supabase
      .from("meetings")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", m.id);

    return {
      committed: {
        tasks: taskRows.length,
        decisions: decRows.length,
        signals: sigRows.length,
      },
    };
  });
