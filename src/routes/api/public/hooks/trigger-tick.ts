import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateTriggers, isAutoMissionTitle, type ThemeState, type OutcomeState } from "@/lib/sensing/trigger";
import { withJobRun } from "@/lib/observability";

/**
 * AMBIENT-TRIGGER (v11 #4) trigger-tick: the self-driving policy layer. For every workspace
 * that has opted in (auto_trigger_enabled = true), with NO human start, it evaluates whether
 * accumulated state has crossed a threshold (a signal cluster grew, a recorded outcome missed)
 * and self-originates a mission for each, recording the trigger + rationale as a Trust-Ledger
 * decision receipt.
 *
 * Reversibility governance (v11): every originated mission is created with status 'proposed' —
 * a status the resume-runs executor IGNORES — so this commits ZERO AI spend and nothing
 * executes until a human/founder promotes it to running. HITL is the promotion step. The
 * pure policy (src/lib/sensing/trigger.ts) is rule-based; no AI call here either.
 *
 * Off by default and bounded (mirrors cluster-tick / sense-tick): ≤5 workspaces per tick,
 * ≤5 proposals per workspace, idempotent (a proposal whose mission title is already open is
 * skipped). The pg_cron schedule that drives this is a founder activation step.
 */

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
              results.push({ workspace_id: ws.id, error: e instanceof Error ? e.message : String(e) });
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
  // State in: clusters (themes) + recorded outcomes (learnings).
  const [{ data: themes }, { data: learnings }, { data: openMissions }] = await Promise.all([
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
  ]);

  const openTitles = new Set(
    (openMissions ?? [])
      .map((m) => m.title as string | null)
      .filter((t): t is string => isAutoMissionTitle(t)),
  );

  const proposals = evaluateTriggers(
    {
      themes: (themes ?? []) as ThemeState[],
      outcomes: (learnings ?? []) as OutcomeState[],
    },
    openTitles,
  );
  if (proposals.length === 0) return 0;

  let written = 0;
  for (const p of proposals) {
    // 1. Self-originate the mission in 'proposed' (resume-runs ignores it; no spend, reversible).
    const { data: mission, error: mErr } = await supabaseAdmin
      .from("missions")
      .insert({
        user_id: ownerId,
        workspace_id: workspaceId,
        title: p.title,
        goal: p.goal,
        status: "proposed",
      } as never)
      .select("id")
      .single();
    if (mErr || !mission) continue;

    // 2. Record the trigger + rationale as a Trust-Ledger decision receipt.
    await supabaseAdmin.from("decisions").insert({
      user_id: ownerId,
      workspace_id: workspaceId,
      title: p.title,
      rationale: p.rationale,
      status: "pending",
      source_kind: "mission",
      mission_id: (mission as { id: string }).id,
      decided_by_agent_slug: "strategist",
    } as never);
    written++;
  }
  return written;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
