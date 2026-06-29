import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resumeAgentLoop, runAgentLoop } from "@/lib/ai/loop.server";
import { advanceMissionCore, type MissionLite } from "@/lib/ai/mission-advance.server";
import { classifyMissionGate } from "@/lib/reliability/gate-state";
import { withJobRun } from "@/lib/observability";

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
 *   - status='running' with 0 mission_steps and 0 active agent_runs
 *     (KI-17: chat.ts fires runAgentLoop fire-and-forget; Worker may
 *     terminate before orchestrator planning completes — re-plan here)
 * Plus BLD-GATE-SYNC mission-status reconciliation (deterministic, no AI):
 *   - un-block missions whose human gate is now decided (status 'blocked'
 *     → 'running'), BEFORE the resume pass so a resuming/completing run sees
 *     a 'running' mission (maybeCompleteMission only finalizes running ones)
 *   - block missions fully parked on a pending human gate ('running' →
 *     'blocked'), AFTER advancing, so the operator sees them in Needs-You
 *     instead of a perpetual 'running' (the "why is the loop idle?" bug)
 * Called by pg_cron every minute. Idempotent: resumeAgentLoop is safe to
 * call multiple times — checkpoint + tool idempotency keys dedup, and it
 * skips waiting_approval runs that still have undecided gates.
 */
const STALE_MS = 2 * 60 * 1000; // 2 minutes since last checkpoint = likely evicted
const BATCH = 5;
// KI-16: per-tick fairness cap on running missions advanced (oldest-updated
// first, so no mission starves). Env-tunable for high scale; sane default 50.
// Each advance is a cheap no-op when the mission has no ready work.
const MISSION_BATCH = Math.max(1, Number(process.env.MISSION_ADVANCE_BATCH) || 50);
// Cap on unplanned mission re-planning per tick. Each call triggers an
// orchestrator AI loop (expensive); 2 is intentionally conservative.
const REPLAN_BATCH = 2;

export const Route = createFileRoute("/api/public/hooks/resume-runs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        return withJobRun("cron.resume-runs", async () => {
          try {
            const cutoff = new Date(Date.now() - STALE_MS).toISOString();

            // BLD-GATE-SYNC helpers: a mission's run statuses + its count of genuinely-pending
            // human gates (status='pending' only; an 'approved'-but-unexecuted gate is the
            // system's turn, not the operator's, so it does not count as needs-you).
            const runStatusesOf = async (missionId: string): Promise<string[]> => {
              const { data } = await admin
                .from("agent_runs")
                .select("status")
                .eq("mission_id", missionId);
              return ((data ?? []) as { status: string }[]).map((r) => r.status);
            };
            const pendingGatesOf = async (missionId: string): Promise<number> => {
              const { count } = await admin
                .from("agent_approvals")
                .select("id", { count: "exact", head: true })
                .eq("mission_id", missionId)
                .eq("status", "pending");
              return count ?? 0;
            };

            // BLD-GATE-SYNC un-block pass — run FIRST so a mission whose gate was just decided is
            // back to 'running' before its run resumes/completes below (maybeCompleteMission only
            // finalizes running/in_progress). Idempotent; the guarded update no-ops on a race.
            const unblocked: string[] = [];
            const { data: blockedMissions } = await admin
              .from("missions")
              .select("id")
              .eq("status", "blocked")
              .order("updated_at", { ascending: true })
              .limit(MISSION_BATCH);
            for (const bm of (blockedMissions ?? []) as { id: string }[]) {
              const runStatuses = await runStatusesOf(bm.id);
              const pendingGateCount = await pendingGatesOf(bm.id);
              if (
                classifyMissionGate({ status: "blocked", runStatuses, pendingGateCount }) ===
                "unblock"
              ) {
                const { data: upd } = await admin
                  .from("missions")
                  .update({ status: "running", updated_at: new Date().toISOString() })
                  .eq("id", bm.id)
                  .eq("status", "blocked")
                  .select("id");
                if (upd && upd.length) unblocked.push(bm.id);
              }
            }

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

            // KI-17: recover missions that have no mission_steps and no active
            // orchestrator run. This happens when chat.ts fires runAgentLoop
            // as fire-and-forget and the Cloudflare Worker terminates before
            // the orchestrator completes its planning call.
            const { data: unplannedCandidates } = await admin
              .from("missions")
              .select("id,user_id,workspace_id,goal,status")
              .in("status", ["running", "in_progress"])
              .lt("created_at", cutoff)
              .order("created_at", { ascending: true })
              .limit(REPLAN_BATCH * 4);
            const toReplan: MissionLite[] = [];
            for (const m of (unplannedCandidates ?? []) as MissionLite[]) {
              if (toReplan.length >= REPLAN_BATCH) break;
              const { count: stepCount } = await admin
                .from("mission_steps")
                .select("id", { count: "exact", head: true })
                .eq("mission_id", m.id);
              if ((stepCount ?? 0) > 0) continue;
              const { count: activeRuns } = await admin
                .from("agent_runs")
                .select("id", { count: "exact", head: true })
                .eq("mission_id", m.id)
                .in("status", ["queued", "running", "waiting_approval"]);
              if ((activeRuns ?? 0) > 0) continue;
              toReplan.push(m);
            }
            const planned: { id: string; run_id?: string; error?: string }[] = [];
            for (const m of toReplan) {
              try {
                const res = await runAgentLoop(admin, m.user_id, {
                  agentSlug: "orchestrator",
                  goal: m.goal,
                  missionId: m.id,
                  workspaceId: m.workspace_id,
                });
                planned.push({ id: m.id, run_id: (res as { run_id?: string })?.run_id });
              } catch (e) {
                planned.push({ id: m.id, error: e instanceof Error ? e.message : String(e) });
                failed.push({ id: m.id, error: e instanceof Error ? e.message : String(e) });
              }
            }

            // BLD-GATE-SYNC block pass — run LAST (after resume + advance) so we never block a
            // mission that progressed this tick. Surfaces missions fully parked on a pending human
            // gate as 'blocked' (Needs-You lane). The guarded update no-ops if the advance loop
            // already finalized the mission.
            const blocked: string[] = [];
            const { data: blockCandidates } = await admin
              .from("missions")
              .select("id,status")
              .in("status", ["running", "in_progress"])
              .order("updated_at", { ascending: true })
              .limit(MISSION_BATCH);
            for (const cm of (blockCandidates ?? []) as { id: string; status: string }[]) {
              const runStatuses = await runStatusesOf(cm.id);
              if (!runStatuses.includes("waiting_approval")) continue; // cheap short-circuit
              const pendingGateCount = await pendingGatesOf(cm.id);
              if (
                classifyMissionGate({ status: cm.status, runStatuses, pendingGateCount }) ===
                "block"
              ) {
                const { data: upd } = await admin
                  .from("missions")
                  .update({ status: "blocked", updated_at: new Date().toISOString() })
                  .eq("id", cm.id)
                  .in("status", ["running", "in_progress"])
                  .select("id");
                if (upd && upd.length) blocked.push(cm.id);
              }
            }

            return new Response(
              JSON.stringify({ ok: true, resumed, failed, advanced, planned, unblocked, blocked }),
              {
                headers: { "Content-Type": "application/json" },
              },
            );
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
