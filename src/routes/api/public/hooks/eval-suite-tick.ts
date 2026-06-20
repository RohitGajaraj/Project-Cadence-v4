import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runEvalSuite } from "@/lib/ai/eval-runner.server";

/**
 * Scheduled eval-suite runner. Picks up enabled suites whose `schedule_cron`
 * is set and whose `last_run_at` is older than the cadence floor (1h grace),
 * then runs them with the user's stored configuration.
 *
 * NOTE: This uses supabaseAdmin and intentionally iterates per-user; RLS does
 * not apply, so we pass suite.user_id explicitly to runEvalSuite.
 */
export const Route = createFileRoute("/api/public/hooks/eval-suite-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: suites, error } = await supabaseAdmin
          .from("eval_suites")
          .select("id,user_id,last_run_at,schedule_cron")
          .eq("enabled", true)
          .not("schedule_cron", "is", null)
          .or(`last_run_at.is.null,last_run_at.lt.${cutoff}`)
          .limit(20);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: Array<{ suite_id: string; ok: boolean; error?: string }> = [];
        for (const s of suites ?? []) {
          try {
            await runEvalSuite(supabaseAdmin, s.user_id, s.id, "scheduled");
            results.push({ suite_id: s.id, ok: true });
          } catch (e: unknown) {
            results.push({
              suite_id: s.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        return new Response(JSON.stringify({ ok: true, runs: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
