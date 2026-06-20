import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// P7 · Incidents, a read-only "what went wrong" record: failed tool executions,
// errored auto-pipeline events, guardrail blocks, and cost cap incidents, newest
// first, each linked to its trace where available.
// Engine-Room: names the outcome ("what went wrong"), not the mechanism.

export type IncidentKind = "execution" | "pipeline" | "guardrail" | "cost" | "manual";

export type Incident = {
  id: string;
  kind: IncidentKind;
  title: string;
  detail: string;
  at: string | null;
  traceId: string | null;
  amountUsd?: number;
  windowKind?: "day" | "month";
};

const LogCostIncidentSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  traceId: z.string().optional(),
  amountUsd: z.number().optional(),
  windowKind: z.enum(["day", "month"]).optional(),
});

export async function logCostIncidentInternal(
  supabase: SupabaseClient,
  userId: string,
  data: {
    title: string;
    detail: string;
    traceId?: string;
    amountUsd?: number;
    windowKind?: "day" | "month";
  },
): Promise<{ success: boolean; id?: string }> {
  const { data: ws } = await supabase.rpc("current_user_default_workspace");
  const workspaceId = (ws as string | null) ?? null;
  if (!workspaceId) {
    throw new Error("No default workspace found");
  }

  const { data: inserted, error } = await supabase
    .from("cost_incidents")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      title: data.title,
      detail: data.detail,
      trace_id: data.traceId ?? null,
      amount_usd: data.amountUsd ?? null,
      window_kind: data.windowKind ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return { success: true, id: inserted?.id };
}

export async function getIncidentsInternal(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ incidents: Incident[]; count: number }> {
  const out: Incident[] = [];

  // Failed tool executions: a human-or-auto approval whose call errored out.
  const { data: failed } = await supabase
    .from("agent_approvals")
    .select("id,agent_slug,tool_name,error,status,created_at,trace_id")
    .eq("user_id", userId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(20);
  for (const a of failed ?? []) {
    const tool = (a.tool_name as string | null) ?? "a tool call";
    const who = (a.agent_slug as string | null) ?? "an agent";
    out.push({
      id: `exec:${a.id}`,
      kind: "execution",
      title: `${tool} failed`,
      detail: (a.error as string | null) ?? `${who}'s call did not complete.`,
      at: (a.created_at as string | null) ?? null,
      traceId: (a.trace_id as string | null) ?? null,
    });
  }

  // Errored auto-pipeline events: the reactor could not dispatch or complete.
  // event_queue is workspace-scoped, so resolve the default workspace and
  // filter on it (defense-in-depth on top of RLS, and it uses the index),
  // matching how the reactor reads this table.
  const { data: ws } = await supabase.rpc("current_user_default_workspace");
  const workspaceId = (ws as string | null) ?? null;
  if (workspaceId) {
    const { data: events } = await supabase
      .from("event_queue")
      .select("id,event_type,error,created_at")
      .eq("workspace_id", workspaceId)
      .not("error", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    for (const e of events ?? []) {
      const type = (e.event_type as string | null) ?? "an event";
      out.push({
        id: `pipe:${e.id}`,
        kind: "pipeline",
        title: `Pipeline error on ${type}`,
        detail: (e.error as string | null) ?? "The reactor reported an error.",
        at: (e.created_at as string | null) ?? null,
        traceId: null,
      });
    }

    // Cost incidents: persistent manually logged or auto-detected cost breaches
    const { data: costIncidents } = await supabase
      .from("cost_incidents")
      .select("id,title,detail,created_at,trace_id,amount_usd,window_kind")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(20);
    for (const c of costIncidents ?? []) {
      out.push({
        id: `cost:${c.id}`,
        kind: "cost",
        title: c.title,
        detail: c.amount_usd
          ? `${c.detail} (Amount: $${c.amount_usd}${c.window_kind ? ` for the ${c.window_kind}` : ""})`
          : c.detail,
        at: (c.created_at as string | null) ?? null,
        traceId: (c.trace_id as string | null) ?? null,
        amountUsd: c.amount_usd ? Number(c.amount_usd) : undefined,
        windowKind: (c.window_kind as "day" | "month" | null) ?? undefined,
      });
    }
  }

  // Guardrail blocks: a rule that stopped an AI call. Only action = "block"
  // is an incident; "warn" and "redact" are routine governance (the call still
  // runs), so they are intentionally excluded. We surface the rule and side,
  // never the raw matched payload, so nothing sensitive lands in the list.
  const { data: blocks } = await supabase
    .from("guardrail_hits")
    .select("id,rule_name,side,created_at")
    .eq("user_id", userId)
    .eq("action", "block")
    .order("created_at", { ascending: false })
    .limit(20);
  for (const h of blocks ?? []) {
    const rule = (h.rule_name as string | null) ?? "a guardrail rule";
    const side = (h.side as string | null) === "output" ? "output" : "input";
    out.push({
      id: `guard:${h.id}`,
      kind: "guardrail",
      title: `Blocked by guardrail: ${rule}`,
      detail:
        side === "output"
          ? "A guardrail rule blocked a model response from being returned."
          : "A guardrail rule blocked a prompt before the call ran.",
      at: (h.created_at as string | null) ?? null,
      traceId: null,
    });
  }

  // Cost-incident detector: surface real budget alerts from ai_budget_alerts.
  // Contract (producer: runtime.server.ts incrementBudget / incrementSurfaceBudget):
  // exactly one row is written per window when spend CROSSES the configured alert
  // threshold (default 80% of cap), always kind="warn", with pct in [threshold, 100]
  // (pct is capped at 100; a genuine cap hit halts the next call by throwing).
  // No path writes kind="block" today, so the prior `.eq("kind","block")` filter
  // matched nothing and this detector was silently dead. Surface the warn rows that
  // actually exist, report the true pct, and escalate the copy to "cap reached" only
  // when the cap itself was hit (pct >= 100, or a future block).
  const { data: budgetAlerts } = await supabase
    .from("ai_budget_alerts")
    .select("id,kind,pct,surface,usd_cap,usd_used,window_kind,created_at")
    .eq("user_id", userId)
    .in("kind", ["warn", "block"])
    .order("created_at", { ascending: false })
    .limit(20);
  for (const b of budgetAlerts ?? []) {
    const surface = b.surface ? ` for "${b.surface}"` : "";
    const window = b.window_kind === "month" ? "monthly" : "daily";
    const pct = b.pct != null ? Math.round(Number(b.pct)) : null;
    const capReached = (pct ?? 0) >= 100 || b.kind === "block";
    const cap = `$${Number(b.usd_cap ?? 0).toFixed(2)}`;
    const used = `$${Number(b.usd_used ?? 0).toFixed(2)}`;
    const pctText = pct != null ? `${pct}%` : "the alert threshold";
    out.push({
      id: `budget_alert:${b.id}`,
      kind: "cost",
      title: capReached
        ? `Budget cap reached${surface}`
        : `Budget alert${surface}: ${pctText} of ${window} cap`,
      detail: capReached
        ? `Your ${window} AI spend reached the ${cap} cap (used: ${used}). Further AI calls are blocked until the cap is raised.`
        : `Your ${window} AI spend reached ${pctText} of the ${cap} cap (used: ${used}).`,
      at: (b.created_at as string | null) ?? null,
      traceId: null,
      amountUsd: b.usd_cap != null ? Number(b.usd_cap) : undefined,
      windowKind: b.window_kind === "month" ? "month" : b.window_kind === "day" ? "day" : undefined,
    });
  }

  out.sort((x, y) => (y.at ?? "").localeCompare(x.at ?? ""));
  const incidents = out.slice(0, 40);
  return { incidents, count: incidents.length };
}

export const logCostIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogCostIncidentSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ success: boolean; id?: string }> => {
    return logCostIncidentInternal(context.supabase, context.userId, data);
  });

export const getIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ incidents: Incident[]; count: number }> => {
    return getIncidentsInternal(context.supabase, context.userId);
  });
