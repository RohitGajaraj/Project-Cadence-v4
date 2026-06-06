import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureTodayBrief } from "@/lib/copilot.functions";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = startOfDay();
    const tomorrow = addDays(today, 1);
    const sevenAgo = addDays(today, -6);
    const fourteenAgo = addDays(today, -14);

    const { supabase } = context;

    const [
      { data: profile },
      { data: todayTasks },
      { data: todayMeetings },
      { data: weekTasks },
      { data: recentMeetings },
      { data: projects },
      { data: allTasks },
      { data: existingBrief },
    ] = await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase
        .from("tasks")
        .select("*")
        .or(`due_date.eq.${today.toISOString().slice(0, 10)},and(due_date.is.null,status.neq.done)`),
      supabase
        .from("meetings")
        .select("*")
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .order("start_at"),
      supabase
        .from("tasks")
        .select("id,is_deep_work,status,completed_at,created_at")
        .gte("created_at", sevenAgo.toISOString()),
      supabase
        .from("meetings")
        .select("id,stakeholder,start_at")
        .gte("start_at", fourteenAgo.toISOString())
        .order("start_at", { ascending: false }),
      supabase.from("projects").select("*"),
      supabase.from("tasks").select("id,status,project_id"),
      supabase
        .from("daily_briefs")
        .select("*")
        .eq("brief_date", today.toISOString().slice(0, 10))
        .maybeSingle(),
    ]);

    // F-TODAY-AUTOSEED — auto-generate the brief on first sign-in instead of
    // asking the operator to seed it. If generation fails (no AI key, rate
    // limit, etc.), fall back to a null brief so the dashboard still renders.
    let brief = existingBrief;
    if (!brief) {
      try {
        brief = await ensureTodayBrief(context.supabase, context.userId);
      } catch {
        brief = null;
      }
    }

    // Focus score: blend deep-work tasks vs meeting load today
    const deepCount = (todayTasks ?? []).filter((t) => t.is_deep_work).length;
    const meetingMinutes = (todayMeetings ?? []).reduce((acc, m) => {
      return acc + (new Date(m.end_at).getTime() - new Date(m.start_at).getTime()) / 60000;
    }, 0);
    const focusScore = Math.max(
      5,
      Math.min(100, 60 + deepCount * 8 - Math.floor(meetingMinutes / 30) * 4),
    );

    // Deep work 7-day series (completed deep-work hours per day)
    const series = Array.from({ length: 7 }).map((_, i) => {
      const day = addDays(sevenAgo, i);
      const dayStr = day.toISOString().slice(0, 10);
      const completed = (weekTasks ?? []).filter(
        (t) =>
          t.is_deep_work &&
          t.status === "done" &&
          t.completed_at &&
          t.completed_at.slice(0, 10) === dayStr,
      ).length;
      return { day: day.toLocaleDateString("en-US", { weekday: "narrow" }), count: completed };
    });

    // Stakeholders from recent meetings
    const stakeholderMap = new Map<string, { last: string; count: number }>();
    for (const m of recentMeetings ?? []) {
      if (!m.stakeholder) continue;
      const cur = stakeholderMap.get(m.stakeholder);
      if (!cur) stakeholderMap.set(m.stakeholder, { last: m.start_at, count: 1 });
      else cur.count += 1;
    }
    const stakeholders = Array.from(stakeholderMap.entries())
      .map(([name, v]) => ({ name, last: v.last, count: v.count }))
      .sort((a, b) => +new Date(b.last) - +new Date(a.last))
      .slice(0, 6);

    // Project alignment
    const projectStats = (projects ?? []).map((p) => {
      const ptasks = (allTasks ?? []).filter((t) => t.project_id === p.id);
      const done = ptasks.filter((t) => t.status === "done").length;
      const pct = ptasks.length ? Math.round((done / ptasks.length) * 100) : 0;
      return { id: p.id, name: p.name, pct, total: ptasks.length, done };
    });

    return {
      profile: profile ?? null,
      todayTasks: todayTasks ?? [],
      todayMeetings: todayMeetings ?? [],
      focusScore,
      deepWorkSeries: series,
      stakeholders,
      projects: projectStats,
      meetingMinutes: Math.round(meetingMinutes),
      brief: brief ?? null,
    };
  });