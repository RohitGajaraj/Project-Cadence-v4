import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resumeAgentLoop } from "@/lib/ai/loop.server";
import { advanceMissionCore, type MissionLite } from "@/lib/ai/mission-advance.server";

// agent_approvals.run_id is new in the f_studio_engine migration — not in the
// generated types until they regenerate post-apply (F-V5 untyped-cast pattern).
const admin = supabaseAdmin as unknown as SupabaseClient;

/**
 * Resume-runs sweeper — picks up missions that need to advance:
 *   - status='queued' (backpressure-enqueued + Studio async dispatch)
 *   - status='running' with a stale last_checkpoint_at (worker eviction)
 *   - status='running' with NO last_checkpoint_at and a stale created_at
 *     (KI-02: evicted before the first checkpoint stamp — `lt` on a NULL
 *     column never matches, so these were invisible to the sweeper)
 *   - status='waiting_approval' whose gates are all decided AND executed
 *     (F-STUDIO: the loop pauses on shipping gates; this re-enters it)
 * Called by pg_cron every minute. Idempotent: resumeAgentLoop is safe to
 * call multiple times — checkpoint + tool idempotency keys dedup, and it
 * skips waiting_approval runs that still have undecided gates.
 */
const STALE_MS = 2 * 60 * 1000; // 2 minutes since last checkpoint = likely evicted
const BATCH = 5;
const MISSION_BATCH = 20; // running missions advanced per tick (cheap no-op when idle)

export const Route = createFileRoute("/api/public/hooks/resume-runs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireHookCaller(request);
        if (unauth) return unauth;
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
            .or(
              `last_checkpoint_at.lt.${cutoff},and(last_checkpoint_at.is.null,created_at.lt.${cutoff})`,
            )
            .order("created_at", { ascending: true })
            .limit(BATCH);

          // F-STUDIO: paused-on-gate runs whose approvals are all resolved.
          // (pending = undecided; approved = decided but tool not yet executed
          //  — both still block. resumeAgentLoop re-checks before resuming.)
          const { data: waiting } = await supabaseAdmin
            .from("agent_runs")
            .select("id")
            .eq("status", "waiting_approval")
            .order("created_at", { ascending: true })
            .limit(BATCH * 4);
          const resumable: { id: string }[] = [];
          for (const w of waiting ?? []) {
            if (resumable.length >= BATCH) break;
            const { count } = await admin
              .from("agent_approvals")
              .select("id", { count: "exact", head: true })
              .eq("run_id", w.id)
              .in("status", ["pending", "approved"]);
            if ((count ?? 0) === 0) resumable.push(w);
          }

          const ids = [...(queued ?? []), ...(stale ?? []), ...resumable].map((r) => r.id);
          const resumed: string[] = [];
          const failed: { id: string; error: string }[] = [];
          for (const id of ids) {
            try {
              await resumeAgentLoop(supabaseAdmin, id);
              resumed.push(id);
            } catch (e) {
              failed.push({ id, error: e instanceof Error ? e.message : String(e) });
            }
          }

          // v6 Phase 1 — "the loop runs itself": auto-advance every running
          // mission. The deterministic, model-free reflector dispatches
          // newly-ready steps + finalizes terminal DAGs, so a multi-hop mission
          // progresses without the operator re-invoking the orchestrator
          // (Appendix B: the mid-loop-handoff gap). Cheap no-op when nothing is
          // ready; claim-first dispatch makes it safe under overlapping ticks.
          const { data: runningMissions } = await admin
            .from("missions")
            .select("id,user_id,workspace_id,goal,status")
            .in("status", ["running", "in_progress"])
            .order("updated_at", { ascending: true })
            .limit(MISSION_BATCH);
          const advanced: {
            id: string;
            dispatched: number;
            failed: number;
            finalized: boolean;
          }[] = [];
          for (const m of (runningMissions ?? []) as MissionLite[]) {
            try {
              const res = await advanceMissionCore(admin, m);
              if (res.dispatched || res.failed || res.finalized)
                advanced.push({ id: m.id, ...res });
            } catch (e) {
              failed.push({ id: m.id, error: e instanceof Error ? e.message : String(e) });
            }
          }

          return new Response(JSON.stringify({ ok: true, resumed, failed, advanced }), {
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
