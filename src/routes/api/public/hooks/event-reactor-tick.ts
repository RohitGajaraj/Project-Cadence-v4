import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchEvent, type EventRow } from "@/lib/reactor.functions";

/**
 * event-reactor-tick — F-AGENT-3.
 *
 * Drains `event_queue` rows whose `approval_mode='auto'` and `status='pending'`,
 * starting an orchestrated mission per event. `confirm` rows stay pending until
 * the operator decides via `decideEventDispatch`. Fired by pg_cron every minute.
 *
 * Idempotent: the trigger fan-out uses a UNIQUE (subscription_id, source_id)
 * dedup so re-firing the underlying triggers cannot duplicate events; this
 * handler then flips status, so a re-tick just sees fewer pending rows.
 */
const BATCH = 10;

export const Route = createFileRoute("/api/public/hooks/event-reactor-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { data: rows, error } = await supabaseAdmin
            .from("event_queue")
            .select("id,user_id,workspace_id,event_type,target_agent_slug,payload,status,source_id")
            .eq("status", "pending")
            .eq("approval_mode", "auto")
            .order("created_at", { ascending: true })
            .limit(BATCH);
          if (error) throw new Error(error.message);

          const dispatched: string[] = [];
          const failed: { id: string; error: string }[] = [];
          for (const row of rows ?? []) {
            try {
              await dispatchEvent(supabaseAdmin, row as EventRow, null);
              dispatched.push(row.id);
            } catch (e) {
              failed.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
            }
          }

          return new Response(
            JSON.stringify({ ok: true, considered: (rows ?? []).length, dispatched, failed }),
            { headers: { "Content-Type": "application/json" } },
          );
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