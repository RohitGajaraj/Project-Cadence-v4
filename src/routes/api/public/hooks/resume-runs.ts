import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resumeAgentLoop } from "@/lib/ai/loop.server";

/**
 * Resume-runs sweeper — picks up missions that need to advance:
 *   - status='queued' (backpressure-enqueued)
 *   - status='running' with a stale last_checkpoint_at (worker eviction)
 * Called by pg_cron every minute. Idempotent: resumeAgentLoop is safe to
 * call multiple times — checkpoint + tool idempotency keys dedup.
 */
const STALE_MS = 2 * 60 * 1000; // 2 minutes since last checkpoint = likely evicted
const BATCH = 5;

export const Route = createFileRoute("/api/public/hooks/resume-runs")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const cutoff = new Date(Date.now() - STALE_MS).toISOString();
          const { data: queued } = await supabaseAdmin
            .from("agent_runs")
            .select("id")
            .eq("status", "queued")
            .order("created_at", { ascending: true })
            .limit(BATCH);
          const { data: stale } = await supabaseAdmin
            .from("agent_runs")
            .select("id")
            .eq("status", "running")
            .lt("last_checkpoint_at", cutoff)
            .order("last_checkpoint_at", { ascending: true })
            .limit(BATCH);

          const ids = [...(queued ?? []), ...(stale ?? [])].map((r) => r.id);
          const resumed: string[] = [];
          const failed: { id: string; error: string }[] = [];
          for (const id of ids) {
            try { await resumeAgentLoop(supabaseAdmin, id); resumed.push(id); }
            catch (e) { failed.push({ id, error: e instanceof Error ? e.message : String(e) }); }
          }
          return new Response(JSON.stringify({ ok: true, resumed, failed }), {
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