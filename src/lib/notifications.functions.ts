import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// R3 · Notifications, one "what needs you" feed derived live from the loop's
// own state: tool calls waiting on a human, spend nearing or over a cap, and a
// stalled loop. Read-only, RLS-scoped (every table keyed on user_id); each probe
// degrades to a safe default (a null or errored query yields no items) so the
// feed can never break the surface it sits on. No new table: it reads
// agent_approvals, agent_runs, and ai_budgets directly.
// Engine-Room: names the outcome ("what needs you"), not the mechanism.

const STALL_MINUTES = 30;

export type NotificationSeverity = "action" | "warning" | "info";

export type AppNotification = {
  id: string;
  kind: "approval" | "health" | "budget";
  severity: NotificationSeverity;
  title: string;
  detail: string;
  href: string;
  created_at: string | null;
};

const SEVERITY_RANK: Record<NotificationSeverity, number> = { action: 0, warning: 1, info: 2 };

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ notifications: AppNotification[]; count: number }> => {
    const { supabase, userId } = context;
    const cutoff = new Date(Date.now() - STALL_MINUTES * 60 * 1000).toISOString();
    const out: AppNotification[] = [];

    // 1. Tool calls waiting on a human decision.
    const { data: approvals } = await supabase
      .from("agent_approvals")
      .select("id,agent_slug,tool_name,rationale,created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);
    for (const a of approvals ?? []) {
      const tool = (a.tool_name as string | null) ?? "a tool call";
      const who = (a.agent_slug as string | null) ?? "An agent";
      out.push({
        id: `approval:${a.id}`,
        kind: "approval",
        severity: "action",
        title: `Approval needed: ${tool}`,
        detail: (a.rationale as string | null) ?? `${who} is waiting on your decision.`,
        href: "/govern?tab=approvals",
        created_at: (a.created_at as string | null) ?? null,
      });
    }

    // 2. A stalled loop: runs in flight past the stall window.
    const { count: stalledCount } = await supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["running", "queued"])
      .lt("created_at", cutoff);
    const stalled = stalledCount ?? 0;
    if (stalled > 0) {
      out.push({
        id: "health:stalled",
        kind: "health",
        severity: "warning",
        title: `${stalled} run${stalled === 1 ? "" : "s"} stalled`,
        detail: `In flight past the ${STALL_MINUTES}-minute window. The loop may need a nudge.`,
        href: "/govern?tab=gauntlet",
        created_at: null,
      });
    }

    // 3. Spend nearing or over a cap.
    const { data: budget } = await supabase
      .from("ai_budgets")
      .select("daily_usd_cap,monthly_usd_cap,daily_usd_used,monthly_usd_used,alert_at_pct")
      .eq("user_id", userId)
      .maybeSingle();
    if (budget) {
      const pct = typeof budget.alert_at_pct === "number" ? budget.alert_at_pct : 80;
      const pushBudget = (used: unknown, cap: unknown, label: string) => {
        const u = typeof used === "number" ? used : 0;
        const c = typeof cap === "number" ? cap : 0;
        if (c <= 0) return;
        if (u >= c) {
          out.push({
            id: `budget:${label}-over`,
            kind: "budget",
            severity: "warning",
            title: `${label} spend cap reached`,
            detail: `$${u.toFixed(2)} of $${c.toFixed(2)}. Over-cap AI calls are blocked.`,
            href: "/govern?tab=budgets",
            created_at: null,
          });
        } else if (u >= (c * pct) / 100) {
          out.push({
            id: `budget:${label}-near`,
            kind: "budget",
            severity: "info",
            title: `Approaching ${label.toLowerCase()} spend cap`,
            detail: `$${u.toFixed(2)} of $${c.toFixed(2)} (alert at ${pct}%).`,
            href: "/govern?tab=budgets",
            created_at: null,
          });
        }
      };
      pushBudget(budget.daily_usd_used, budget.daily_usd_cap, "Daily");
      pushBudget(budget.monthly_usd_used, budget.monthly_usd_cap, "Monthly");
    }

    out.sort((x, y) => {
      const s = SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity];
      if (s !== 0) return s;
      return (y.created_at ?? "").localeCompare(x.created_at ?? "");
    });

    return { notifications: out, count: out.length };
  });
