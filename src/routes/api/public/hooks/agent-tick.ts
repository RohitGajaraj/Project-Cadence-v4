import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Agent tick — finds agents whose `cron_schedule` is due and enqueues
 * a run for each. Full planner/executor loop lands in Phase 6.C; for
 * now this just stamps `last_scheduled_run_at` on due agents so the
 * Agents page can show "next run" timing.
 */
export const Route = createFileRoute("/api/public/hooks/agent-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        try {
          const { data: agents } = await supabaseAdmin
            .from("agents")
            .select("id,cron_schedule,last_scheduled_run_at,enabled")
            .eq("enabled", true)
            .not("cron_schedule", "is", null);
          // Lightweight: stamp last_scheduled_run_at when over 1h since last
          let touched = 0;
          const cutoff = Date.now() - 60 * 60 * 1000;
          for (const a of agents ?? []) {
            const last = a.last_scheduled_run_at ? new Date(a.last_scheduled_run_at).getTime() : 0;
            if (last < cutoff) {
              await supabaseAdmin
                .from("agents")
                .update({ last_scheduled_run_at: new Date().toISOString() })
                .eq("id", a.id);
              touched++;
            }
          }
          return new Response(JSON.stringify({ ok: true, touched }), {
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
