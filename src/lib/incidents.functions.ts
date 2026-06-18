import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// P7 · Incidents, a read-only "what went wrong" record: failed tool executions,
// errored auto-pipeline events, and guardrail blocks, newest first, each linked
// to its trace where available. Derived live from confirmed logs (no new table):
// agent_approvals (status = failed), event_queue (rows carrying an error), and
// guardrail_hits (action = block, a rule that stopped an AI call). RLS-scoped; a
// null or errored query yields no rows, so the log can never break its surface.
// Engine-Room: names the outcome ("what went wrong"), not the mechanism.

export type IncidentKind = "execution" | "pipeline" | "guardrail";

export type Incident = {
  id: string;
  kind: IncidentKind;
  title: string;
  detail: string;
  at: string | null;
  traceId: string | null;
};

export const getIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ incidents: Incident[]; count: number }> => {
    const { supabase, userId } = context;
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

    out.sort((x, y) => (y.at ?? "").localeCompare(x.at ?? ""));
    const incidents = out.slice(0, 40);
    return { incidents, count: incidents.length };
  });
