import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withJobRun } from "@/lib/observability";

/**
 * WM-S4: Workspace Steward agent — steward-tick hook.
 *
 * Runs daily at 09:00 UTC (see migration 20260626200000_workspace_steward.sql).
 * Scans every workspace for two staleness signals:
 *
 *   1. Decisions older than 30 days with no supersession recorded (still 'active').
 *      These are candidates for revisit: the Steward asks "is this still the call?"
 *
 *   2. Workspace briefs (current_focus) that haven't been updated in 14+ days.
 *      A stale brief means the staff is running on outdated direction.
 *
 * For each stale workspace, inserts a single source='steward' signal as the nudge
 * artifact. The ambient cluster-tick picks it up and it surfaces in Today/signals.
 * Rate-limited: skips any workspace that already received a steward nudge today
 * (checked via a recent steward signal in the past 23 hours).
 *
 * At most MAX_WORKSPACES workspaces per invocation; oldest-first ordering so
 * low-activity workspaces don't starve.
 */

const MAX_WORKSPACES = 20;
const STALE_DECISION_DAYS = 30;
const STALE_BRIEF_DAYS = 14;
const NUDGE_COOLDOWN_HOURS = 23;

export const Route = createFileRoute("/api/public/hooks/steward-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;

        return withJobRun("ambient.steward-tick", async () => {
          // Collect workspace IDs that have auto_sense_enabled (the steward piggybacks
          // on the same opt-in flag so we don't need a separate DB column).
          const { data: workspaces, error: wsErr } = await supabaseAdmin
            .from("workspaces")
            .select("id, owner_id")
            .eq("auto_sense_enabled", true)
            .not("owner_id", "is", null)
            .order("created_at", { ascending: true })
            .limit(MAX_WORKSPACES);

          if (wsErr) {
            const code = (wsErr as { code?: string }).code;
            // Tolerate pre-migration state
            if (code === "42703" || code === "PGRST204") {
              return json({ ok: true, processed: 0, note: "auto_sense not migrated yet" });
            }
            return json({ ok: false, error: wsErr.message }, 500);
          }

          const now = new Date();
          const cooldownCutoff = new Date(now.getTime() - NUDGE_COOLDOWN_HOURS * 3600_000).toISOString();
          const staleDecisionCutoff = new Date(now.getTime() - STALE_DECISION_DAYS * 86400_000).toISOString();
          const staleBriefCutoff = new Date(now.getTime() - STALE_BRIEF_DAYS * 86400_000).toISOString();

          const results: Array<{ workspace_id: string; nudged?: boolean; reason?: string; error?: string }> = [];

          for (const ws of workspaces ?? []) {
            try {
              const ownerId = ws.owner_id as string;

              // Rate limit: skip if a steward nudge was already inserted in the past 23h
              const { data: recentNudge } = await supabaseAdmin
                .from("signals")
                .select("id")
                .eq("workspace_id", ws.id)
                .eq("source", "steward")
                .gte("created_at", cooldownCutoff)
                .limit(1);

              if (recentNudge && recentNudge.length > 0) {
                results.push({ workspace_id: ws.id, nudged: false, reason: "cooldown" });
                continue;
              }

              // Check 1: stale active decisions (no supersession, older than 30 days)
              const { data: staleDecisions } = await supabaseAdmin
                .from("decisions")
                .select("id, title, created_at")
                .eq("workspace_id", ws.id)
                .eq("status", "active")
                .lte("created_at", staleDecisionCutoff)
                .order("created_at", { ascending: true })
                .limit(3);

              // Check 2: stale brief (current_focus not updated in 14 days)
              const { data: brief } = await supabaseAdmin
                .from("workspace_briefs")
                .select("current_focus, updated_at")
                .eq("workspace_id", ws.id)
                .single();

              const hasStaleDecisions = staleDecisions && staleDecisions.length > 0;
              const hasStaleBrief =
                brief?.current_focus &&
                brief.current_focus.trim().length > 0 &&
                brief.updated_at &&
                brief.updated_at < staleBriefCutoff;

              if (!hasStaleDecisions && !hasStaleBrief) {
                results.push({ workspace_id: ws.id, nudged: false, reason: "nothing stale" });
                continue;
              }

              // Build nudge signal
              const nudgeParts: string[] = [];
              if (hasStaleDecisions) {
                const titles = staleDecisions!
                  .map((d) => `"${d.title}"`)
                  .join(", ");
                const days = Math.floor(
                  (now.getTime() - new Date(staleDecisions![0].created_at).getTime()) / 86400_000,
                );
                nudgeParts.push(
                  `${staleDecisions!.length} decision${staleDecisions!.length > 1 ? "s" : ""} ` +
                  `(${titles}) ${staleDecisions!.length > 1 ? "have" : "has"} been active for ${days}+ days ` +
                  `with no recorded outcome or supersession. Are these still the right calls?`,
                );
              }
              if (hasStaleBrief) {
                const briefDays = Math.floor(
                  (now.getTime() - new Date(brief!.updated_at).getTime()) / 86400_000,
                );
                nudgeParts.push(
                  `The workspace brief ("${brief!.current_focus.slice(0, 80)}${brief!.current_focus.length > 80 ? "..." : ""}") ` +
                  `has not been updated in ${briefDays} days. Does this still reflect the team's direction?`,
                );
              }

              const nudgeTitle = hasStaleDecisions
                ? `Steward check: ${staleDecisions!.length} decision${staleDecisions!.length > 1 ? "s need" : " needs"} revisiting`
                : "Steward check: workspace brief may be outdated";

              const nudgeContent = nudgeParts.join("\n\n") +
                "\n\nThe Workspace Steward surfaces this as a prompt to revisit, not a problem. " +
                "Confirm a decision is still active, supersede it with a new one, or update the brief in Settings.";

              const { error: insertErr } = await supabaseAdmin.from("signals").insert({
                user_id: ownerId,
                workspace_id: ws.id,
                source: "steward",
                title: nudgeTitle,
                content: nudgeContent,
              });

              if (insertErr) throw insertErr;
              results.push({ workspace_id: ws.id, nudged: true, reason: nudgeParts.length > 1 ? "decisions+brief" : hasStaleDecisions ? "decisions" : "brief" });
            } catch (e) {
              results.push({
                workspace_id: ws.id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          const nudged = results.filter((r) => r.nudged).length;
          return json({ ok: true, processed: workspaces?.length ?? 0, nudged, results });
        });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
