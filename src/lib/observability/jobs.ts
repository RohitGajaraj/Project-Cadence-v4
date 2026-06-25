/**
 * AFD-07: withJobRun() — wrap any cron/background-job handler so every invocation
 * appears in the `job_runs` ledger. Also pings the matching Better Stack heartbeat.
 *
 * Usage in a cron route handler:
 *
 *   return withJobRun("ambient.sense-tick", async () => { ... real work ... });
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { heartbeat } from "./uptime";
import { captureError } from "./errors";

export async function withJobRun<T>(
  jobName: string,
  fn: () => Promise<T>,
  opts: { workspace_id?: string | null } = {},
): Promise<T> {
  const startedAt = Date.now();
  let runId: number | null = null;

  try {
    const { data } = await supabaseAdmin
      .from("job_runs")
      .insert({
        job_name: jobName,
        workspace_id: opts.workspace_id ?? null,
        status: "running",
      })
      .select("id")
      .single();
    runId = (data as { id: number } | null)?.id ?? null;
  } catch {
    // Ledger failure must not block the job itself.
  }

  // Fire start heartbeat (no-op if disabled).
  void heartbeat(jobName, "start");

  try {
    const result = await fn();
    const duration = Date.now() - startedAt;
    if (runId !== null) {
      await supabaseAdmin
        .from("job_runs")
        .update({ status: "ok", finished_at: new Date().toISOString(), duration_ms: duration })
        .eq("id", runId);
    }
    void heartbeat(jobName, "ok");
    return result;
  } catch (err) {
    const duration = Date.now() - startedAt;
    const errObj = err instanceof Error ? err : new Error(String(err));
    if (runId !== null) {
      await supabaseAdmin
        .from("job_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: duration,
          error_kind: errObj.name,
          error_message: errObj.message.slice(0, 2000),
        })
        .eq("id", runId);
    }
    void heartbeat(jobName, "fail");
    void captureError(errObj, { surface: `cron:${jobName}`, failure_kind: "tool_error" });
    throw err;
  }
}