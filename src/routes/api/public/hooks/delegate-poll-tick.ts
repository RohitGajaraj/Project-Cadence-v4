import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withJobRun } from "@/lib/observability";
import { pollDelegateJob, foldDelegateResult } from "@/lib/delegate/poll.server";

/**
 * BLD-04: delegate poll tick — finds agent_runs that have an outstanding
 * external delegate job (external_job_id set, status not yet terminal) and
 * polls OpenHands for each. Folds terminal results (done/failed) back into
 * the mission_steps row so the Build surface reflects the outcome.
 *
 * Idempotent: already-terminal runs are skipped at the status check so
 * repeated ticks are safe. Designed to run every 2–5 minutes via Lovable
 * scheduled hook.
 */
export const Route = createFileRoute("/api/public/hooks/delegate-poll-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        return withJobRun("cron.delegate-poll-tick", async () => {
          try {
            // Fetch runs that have an external delegate job but are not yet
            // in a terminal state. delegate_meta->>'external_job_id' IS NOT NULL
            // is the signal that submit succeeded and we need to poll.
            const { data: runs, error: fetchErr } = await supabaseAdmin
              .from("agent_runs")
              .select("id, mission_id, delegate_meta")
              .not("delegate_meta->external_job_id", "is", null)
              .not("status", "in", '("done","failed","error","cancelled")');

            if (fetchErr) throw fetchErr;

            let polled = 0;
            let folded = 0;
            for (const run of runs ?? []) {
              const meta = run.delegate_meta as {
                provider?: string;
                external_job_id?: string;
              } | null;
              if (!meta?.external_job_id || !run.mission_id) continue;

              const pollResult = await pollDelegateJob(meta.external_job_id);
              polled++;

              if (pollResult.status === "done" || pollResult.status === "failed") {
                await foldDelegateResult({
                  runId: run.id,
                  missionId: run.mission_id,
                  provider: meta.provider ?? "openhands",
                  externalJobId: meta.external_job_id,
                  pollResult,
                  supabase: supabaseAdmin as never,
                });
                folded++;
              }
            }

            return new Response(JSON.stringify({ ok: true, polled, folded }), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (e) {
            return new Response(
              JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
        });
      },
    },
  },
});
