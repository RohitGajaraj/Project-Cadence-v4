import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Outcome surface: read-only roll-ups over existing tables.
// No new agent logic; surfaces the right-half of the loop (Ship · Launch · Support · Learn)
// so operators can see the lifecycle they were sold. See docs/feature-backlog.md F-OUTCOME-SURFACE.

const SUPPORT_SOURCES = ["support", "ticket", "helpdesk", "email", "zendesk", "intercom", "freshdesk"];
const LAUNCH_TOOLS = ["send_slack", "send_email", "publish_changelog", "post_announcement", "notify_channel"];

export const getOutcomeData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Releases: completed missions + completed builder/ship runs.
    const [missionsRes, runsRes, approvalsRes, supportRes, oppsRes] = await Promise.all([
      supabase
        .from("missions")
        .select("id, title, goal, status, hop_count, completed_at, updated_at, created_at")
        .eq("status", "completed")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(25),
      supabase
        .from("agent_runs")
        .select("id, agent_name, agent_slug, input, status, duration_ms, tokens_used, spend_used_usd, created_at, mission_id")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("agent_approvals")
        .select("id, tool_name, agent_slug, args, rationale, status, decided_at, created_at")
        .in("tool_name", LAUNCH_TOOLS)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("signals")
        .select("id, title, content, source, sentiment, created_at, theme_id")
        .in("source", SUPPORT_SOURCES)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("opportunities")
        .select("id, title, problem, status, impact, confidence, ease, ice_score, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(25),
    ]);

    if (missionsRes.error) throw new Error(missionsRes.error.message);
    if (runsRes.error) throw new Error(runsRes.error.message);
    if (approvalsRes.error) throw new Error(approvalsRes.error.message);
    if (supportRes.error) throw new Error(supportRes.error.message);
    if (oppsRes.error) throw new Error(oppsRes.error.message);

    // Learnings = opportunities that were re-scored after creation (proxy for closed-loop learning).
    const learnings = (oppsRes.data ?? []).filter((o) => {
      const c = new Date(o.created_at).getTime();
      const u = new Date(o.updated_at).getTime();
      return u - c > 60_000;
    });

    return {
      releases: {
        missions: missionsRes.data ?? [],
        runs: runsRes.data ?? [],
      },
      launches: approvalsRes.data ?? [],
      support: supportRes.data ?? [],
      learnings,
    };
  });