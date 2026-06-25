/**
 * BLD-04: server function to poll a single delegate run's external job and
 * fold the terminal result back into the mission. Called from a "check status"
 * UI action or a future cron job — never fires automatically.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pollDelegateJob, foldDelegateResult } from "@/lib/delegate/poll.server";

const PollSchema = z.object({ run_id: z.string().uuid() });

export const pollDelegateRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: run, error: runErr } = await supabase
      .from("agent_runs")
      .select("id,mission_id,delegate_meta")
      .eq("id", data.run_id)
      .single();
    if (runErr || !run) throw new Error("run not found or not accessible");

    const meta = (run.delegate_meta ?? null) as {
      provider?: string;
      external_job_id?: string;
    } | null;

    if (!meta?.external_job_id || !meta.provider) {
      return { polled: false, reason: "no external delegate job recorded on this run" };
    }
    if (!run.mission_id) {
      return { polled: false, reason: "run has no mission_id; cannot fold result" };
    }

    const pollResult = await pollDelegateJob(meta.external_job_id);
    const terminal = pollResult.status === "done" || pollResult.status === "failed";
    if (terminal) {
      await foldDelegateResult({
        runId: run.id,
        missionId: run.mission_id,
        provider: meta.provider,
        externalJobId: meta.external_job_id,
        pollResult,
        supabase,
      });
    }

    return {
      polled: true,
      run_id: run.id,
      external_job_id: meta.external_job_id,
      poll_status: pollResult.status,
      folded: terminal,
    };
  });
