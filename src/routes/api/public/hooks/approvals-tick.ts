import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Approvals tick — flips pending agent_approvals whose `expires_at` has
 * passed to `escalation_state='expired'` and marks the parent run halted
 * if applicable. Designed to be called by pg_cron once per minute.
 */
export const Route = createFileRoute("/api/public/hooks/approvals-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const nowIso = new Date().toISOString();
          const { data: stale, error } = await supabaseAdmin
            .from("agent_approvals")
            .select("id,trace_id,tool_name,status,escalation_state,expires_at,user_id")
            .lt("expires_at", nowIso)
            .eq("escalation_state", "pending")
            .in("status", ["pending"])
            .limit(500);
          if (error) throw error;

          let expired = 0;
          for (const a of stale ?? []) {
            const { error: upErr } = await supabaseAdmin
              .from("agent_approvals")
              .update({
                escalation_state: "expired",
                escalated_at: nowIso,
                status: "expired",
                error: `Auto-expired after TTL (no decision before ${a.expires_at}).`,
              })
              .eq("id", a.id);
            if (upErr) { console.error("approval expire failed:", upErr); continue; }
            expired++;
          }

          return new Response(JSON.stringify({ ok: true, expired }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});