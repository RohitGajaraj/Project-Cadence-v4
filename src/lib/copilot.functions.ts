import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";

const MODEL = "google/gemini-2.5-flash";

/**
 * F-TODAY-AUTOSEED — internal helper so the dashboard loader can auto-generate
 * today's brief on first sign-in instead of asking the operator to seed it.
 * Routed through the AI runtime chokepoint; RLS-scoped by the supabase client.
 */
export async function ensureTodayBrief(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = today.toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("brief_date", todayStr)
    .maybeSingle();
  if (existing) return existing;

  const [{ data: tasks }, { data: meetings }, { data: profile }] = await Promise.all([
    supabase.from("tasks").select("title,priority,is_deep_work,status,due_date").neq("status", "done").limit(30),
    supabase
      .from("meetings")
      .select("title,start_at,end_at,stakeholder")
      .gte("start_at", today.toISOString())
      .lt("start_at", tomorrow.toISOString()),
    supabase.from("profiles").select("display_name").maybeSingle(),
  ]);

  const prompt = `Write a calm, 2-3 sentence daily brief for ${profile?.display_name ?? "the user"}.
Reference what kind of day this is (maker / collaboration / mixed) based on the meetings and deep-work tasks.
Mention one concrete focus. Avoid emojis. Address the user by first name.

TODAY'S MEETINGS: ${JSON.stringify(meetings ?? [])}
OPEN TASKS: ${JSON.stringify(tasks ?? [])}`;

  const briefRes = await callModel(supabase as never, userId, {
    surface: "brief",
    model: MODEL,
    messages: [
      { role: "system", content: "You are Cadence, an agent-native chief of staff. Tone: Apple-calm, Notion-clear." },
      { role: "user", content: prompt },
    ],
  });
  const summary = briefRes.output;

  const meetingMinutes = (meetings ?? []).reduce(
    (a, m) => a + (new Date(m.end_at).getTime() - new Date(m.start_at).getTime()) / 60000,
    0,
  );
  const deepCount = (tasks ?? []).filter((t) => t.is_deep_work).length;
  const focus = Math.max(5, Math.min(100, 60 + deepCount * 8 - Math.floor(meetingMinutes / 30) * 4));

  const { data, error } = await supabase
    .from("daily_briefs")
    .upsert(
      { user_id: userId, brief_date: todayStr, summary, focus_score: focus },
      { onConflict: "user_id,brief_date" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export const listCopilotMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("copilot_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });

export const sendCopilotMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ prompt: z.string().min(1).max(2000) }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Fetch lightweight context
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [{ data: tasks }, { data: meetings }, { data: projects }, { data: history }] = await Promise.all([
      supabase.from("tasks").select("title,status,priority,is_deep_work,due_date").limit(40),
      supabase
        .from("meetings")
        .select("title,start_at,end_at,stakeholder")
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString()),
      supabase.from("projects").select("name,north_star,status").limit(10),
      supabase
        .from("copilot_messages")
        .select("role,content")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const ctxBlob = JSON.stringify({ projects, todayMeetings: meetings, tasks }).slice(0, 6000);

    const system = `You are Cadence, an AI chief-of-staff for an AI Product Manager.
Be calm, concise, opinionated. Use plain text with short paragraphs and tight bullet lists when helpful.
You have access to the user's current state below. Use it to ground every answer.

USER STATE (JSON, may be partial):
${ctxBlob}`;

    const historyMsgs = (history ?? []).reverse().map((m) => ({ role: m.role, content: m.content }));
    const messages = [
      { role: "system", content: system },
      ...historyMsgs,
      { role: "user", content: data.prompt },
    ];

    // Save user message first
    await supabase.from("copilot_messages").insert({ user_id: userId, role: "user", content: data.prompt });

    const r = await callModel(supabase as never, userId, {
      surface: "copilot",
      model: MODEL,
      messages,
      retrieval: { k: 5 },
    });
    const reply = r.output;

    await supabase.from("copilot_messages").insert({ user_id: userId, role: "assistant", content: reply });

    return { reply };
  });

export const generateDailyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().slice(0, 10);

    const [{ data: tasks }, { data: meetings }, { data: profile }] = await Promise.all([
      supabase.from("tasks").select("title,priority,is_deep_work,status,due_date").neq("status", "done").limit(30),
      supabase
        .from("meetings")
        .select("title,start_at,end_at,stakeholder")
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString()),
      supabase.from("profiles").select("display_name").maybeSingle(),
    ]);

    const prompt = `Write a calm, 2–3 sentence daily brief for ${profile?.display_name ?? "the user"}.
Reference what kind of day this is (maker / collaboration / mixed) based on the meetings and deep-work tasks.
Mention one concrete focus. Avoid emojis. Address the user by first name.

TODAY'S MEETINGS: ${JSON.stringify(meetings ?? [])}
OPEN TASKS: ${JSON.stringify(tasks ?? [])}`;

    const briefRes = await callModel(supabase as never, userId, {
      surface: "brief",
      model: MODEL,
      messages: [
        { role: "system", content: "You are Cadence, an AI chief-of-staff. Tone: Apple-calm, Notion-clear." },
        { role: "user", content: prompt },
      ],
    });
    const summary = briefRes.output;

    // Compute simple focus score from inputs
    const meetingMinutes = (meetings ?? []).reduce(
      (a, m) => a + (new Date(m.end_at).getTime() - new Date(m.start_at).getTime()) / 60000,
      0,
    );
    const deepCount = (tasks ?? []).filter((t) => t.is_deep_work).length;
    const focus = Math.max(5, Math.min(100, 60 + deepCount * 8 - Math.floor(meetingMinutes / 30) * 4));

    const { data, error } = await supabase
      .from("daily_briefs")
      .upsert(
        { user_id: userId, brief_date: todayStr, summary, focus_score: focus },
        { onConflict: "user_id,brief_date" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { brief: data };
  });