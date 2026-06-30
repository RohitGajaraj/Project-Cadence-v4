import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  evaluateTriggers,
  isAutoMissionTitle,
  shouldAutoPromote,
  AUTO_TRIGGER_DAILY_CAP,
  type ThemeState,
  type OutcomeState,
  type SignalSenseState,
} from "@/lib/sensing/trigger";
import { withJobRun } from "@/lib/observability";

/**
 * AMBIENT-TRIGGER (v11 #4) + SF-AUTOTRIGGER (Phase 3) trigger-tick.
 *
 * Two-tier self-driving policy layer:
 *
 * TIER 1 — HITL proposals (always on when auto_trigger_enabled=true):
 *   For every opted-in workspace, evaluates accumulated state (clusters, missed
 *   outcomes, signal volumes) and self-originates missions with status='proposed'.
 *   A proposed mission costs ZERO AI spend; the resume-runs executor ignores it
 *   until a human promotes it to 'queued'/'running'.
 *
 * TIER 2 — Auto-promotion (SF-AUTOTRIGGER, activated by BRAIN_AUTO_TRIGGER=1):
 *   After creating a proposed mission, if all four conditions hold, it is
 *   immediately promoted to 'queued' so the resume-runs sweeper picks it up:
 *     1. BRAIN_AUTO_TRIGGER=1  — founder's circuit breaker (default OFF)
 *     2. proposal.reversible   — only analysis missions (Watch/Listen), not write ops
 *     3. ambient arc           — no missions currently running/in_progress in workspace
 *     4. daily cap             — fewer than AUTO_TRIGGER_DAILY_CAP auto-runs today
 *   The promotion is recorded via auto_trigger_source='auto' on the mission row
 *   and annotated on the Trust-Ledger decision receipt for full auditability.
 *   loop.server.ts is NOT touched — promotion is a DB status write here.
 *
 * Bounded: ≤5 workspaces per tick, ≤5 proposals per workspace, idempotent on title.
 */

/** Set BRAIN_AUTO_TRIGGER=1 in Lovable project settings to activate auto-promotion. */
const BRAIN_AUTO_TRIGGER = process.env.BRAIN_AUTO_TRIGGER === "1";

const MAX_WORKSPACES = 5;
const OPEN_MISSION_STATUSES = ["proposed", "queued", "running", "in_progress", "waiting_approval"];

export const Route = createFileRoute("/api/public/hooks/trigger-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;

        return withJobRun("cron.trigger-tick", async () => {
          const { data: workspaces, error } = await supabaseAdmin
            .from("workspaces")
            .select("id, owner_id, last_auto_trigger_at")
            .eq("auto_trigger_enabled", true)
            .order("last_auto_trigger_at", { ascending: true, nullsFirst: true })
            .limit(MAX_WORKSPACES);

          if (error) {
            const code = (error as { code?: string }).code;
            if (code === "42703" || code === "PGRST204") {
              return json({ ok: true, processed: 0, note: "auto_trigger not migrated yet" });
            }
            return json({ ok: false, error: error.message }, 500);
          }

          const results: Array<{ workspace_id: string; proposed?: number; error?: string }> = [];
          for (const ws of workspaces ?? []) {
            try {
              if (!ws.owner_id) {
                results.push({ workspace_id: ws.id, error: "no owner" });
                continue;
              }
              const proposed = await runTriggers(ws.owner_id, ws.id);
              await supabaseAdmin
                .from("workspaces")
                .update({ last_auto_trigger_at: new Date().toISOString() })
                .eq("id", ws.id);
              results.push({ workspace_id: ws.id, proposed });
            } catch (e) {
              results.push({
                workspace_id: ws.id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          return json({ ok: true, processed: workspaces?.length ?? 0, results });
        });
      },
    },
  },
});

/** Evaluate triggers for one workspace and originate the proposed missions + receipts.
 *  Returns the number of new proposals written. Spend-free (proposed missions never execute). */
async function runTriggers(ownerId: string, workspaceId: string): Promise<number> {
  const cutoff24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  // State in: clusters (themes) + recorded outcomes (learnings) + signal-volume counts.
  const [
    { data: themes },
    { data: learnings },
    { data: openMissions },
    { count: newSigCount },
    { count: customerSigCount },
  ] = await Promise.all([
    supabaseAdmin
      .from("themes")
      .select("id, title, frequency, severity, status")
      .eq("user_id", ownerId)
      .limit(100),
    supabaseAdmin
      .from("learnings")
      .select("id, verdict, summary, opportunity_id")
      .eq("user_id", ownerId)
      .eq("verdict", "missed")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("missions")
      .select("title, status")
      .eq("workspace_id", workspaceId)
      .in("status", OPEN_MISSION_STATUSES)
      .limit(200),
    // New signals in the last 24h (Watch threshold)
    supabaseAdmin
      .from("signals")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", cutoff24h),
    // Customer feedback signals from pull connectors in the last 24h (Listen threshold).
    // Bounded to the same 24h window as newSigCount so a workspace with a large
    // historical backlog doesn't trigger perpetual re-proposals.
    supabaseAdmin
      .from("signals")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("source_kind", "pull_connector")
      .gte("created_at", cutoff24h),
  ]);

  const openTitles = new Set(
    (openMissions ?? [])
      .map((m) => m.title as string | null)
      .filter((t): t is string => isAutoMissionTitle(t)),
  );

  const senseState: SignalSenseState = {
    newSignalCount: newSigCount ?? 0,
    customerSignalCount: customerSigCount ?? 0,
  };

  const proposals = evaluateTriggers(
    {
      themes: (themes ?? []) as ThemeState[],
      outcomes: (learnings ?? []) as OutcomeState[],
      signals: senseState,
    },
    openTitles,
  );
  if (proposals.length === 0) return 0;

  // SF-AUTOTRIGGER: pre-fetch ambient + daily-cap counts once per workspace tick
  // (only when the flag is on, to avoid two extra DB round-trips otherwise).
  let ambientCount = 0;
  let autoTodayCount = 0;
  if (BRAIN_AUTO_TRIGGER) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [{ count: ac }, { count: atc }] = await Promise.all([
      // Ambient arc: workspace is not mid-sprint when no mission is actively running.
      // waiting_approval = paused mid-run for HITL input, so the workspace is still active.
      supabaseAdmin
        .from("missions")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        // queued = scheduled (starts imminently); blocked = stalled mid-sprint on a gate.
        // Both are active mid-sprint states, same as running/in_progress/waiting_approval.
        .in("status", ["running", "in_progress", "waiting_approval", "queued", "blocked"]),
      // Daily cap: count auto-promoted missions created today (created_at is immutable;
      // updated_at can drift as a mission runs/completes, which would falsely inflate the cap).
      supabaseAdmin
        .from("missions")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .filter("auto_trigger_source", "eq", "auto")
        .gte("created_at", todayStart.toISOString()),
    ]);
    ambientCount = ac ?? 0;
    autoTodayCount = atc ?? 0;
  }

  let written = 0;
  for (const p of proposals) {
    // Resolve the pre-assigned sense agent UUID when the proposal targets one.
    let currentAgentId: string | null = null;
    if (p.agentSlug) {
      const { data: agentRow } = await supabaseAdmin
        .from("agents")
        .select("id")
        .eq("user_id", ownerId)
        .eq("slug", p.agentSlug)
        .maybeSingle();
      currentAgentId = (agentRow as { id?: string } | null)?.id ?? null;
    }

    // 1. Self-originate the mission in 'proposed' (resume-runs ignores it; no spend, reversible).
    const { data: mission, error: mErr } = await supabaseAdmin
      .from("missions")
      .insert({
        user_id: ownerId,
        workspace_id: workspaceId,
        title: p.title,
        goal: p.goal,
        status: "proposed",
        ...(currentAgentId ? { current_agent_id: currentAgentId } : {}),
      } as never)
      .select("id")
      .single();
    if (mErr || !mission) continue;

    const missionId = (mission as { id: string }).id;

    // 2. Record the trigger + rationale as a Trust-Ledger decision receipt.
    await supabaseAdmin.from("decisions").insert({
      user_id: ownerId,
      workspace_id: workspaceId,
      title: p.title,
      rationale: p.rationale,
      status: "pending",
      source_kind: "mission",
      mission_id: missionId,
      decided_by_agent_slug: p.agentSlug ?? "strategist",
    } as never);
    written++;

    // 3. SF-AUTOTRIGGER: auto-promote proposed→queued when all four conditions hold.
    //    Increment autoTodayCount immediately so the cap is enforced within this tick
    //    (prevents two proposals in the same tick both seeing count < cap).
    if (
      shouldAutoPromote({
        flagEnabled: BRAIN_AUTO_TRIGGER,
        reversible: p.reversible,
        ambientCount,
        autoTodayCount,
      })
    ) {
      const capNote = `[auto-promoted: ambient + reversible + cap ${autoTodayCount + 1}/${AUTO_TRIGGER_DAILY_CAP}]`;
      // NOTE(MEDIUM-1): ambient + cap counts are read once per tick with no DB-level lock.
      // Two concurrent ticks could both pass the cap check (worst-case: 2x cap promotions).
      // Acceptable for v1 (feature behind BRAIN_AUTO_TRIGGER flag, default OFF).
      // TODO: use pg_advisory_lock or a DB function for atomic check-and-promote.
      const [mRes, dRes] = await Promise.all([
        supabaseAdmin
          .from("missions")
          .update({ status: "queued", auto_trigger_source: "auto" } as never)
          .eq("id", missionId),
        supabaseAdmin
          .from("decisions")
          .update({ status: "approved", rationale: p.rationale + " " + capNote } as never)
          .eq("mission_id", missionId),
      ]);
      if (mRes.error) {
        console.error("[SF-AUTOTRIGGER] mission status flip failed", { missionId, err: mRes.error.message });
      } else {
        autoTodayCount++; // mission IS queued; count even if decision receipt update failed
        if (dRes.error) {
          console.error("[SF-AUTOTRIGGER] decision receipt update failed — audit gap", { missionId, err: dRes.error.message });
        }
      }
    }
  }
  return written;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
