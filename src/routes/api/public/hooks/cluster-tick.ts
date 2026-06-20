import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clusterSignalsCore } from "@/lib/ai/cluster.server";

/**
 * F3 cluster-tick: re-cluster the owner's unclustered signals for every
 * workspace that has opted in (auto_cluster_enabled = true), so SENSE stays
 * fresh without a human poke. This is the "the loop keeps working while you are
 * away" half of F3.
 *
 * Off by default and bounded: no workspace is enrolled until its owner toggles
 * it on, the pg_cron schedule that drives this is a founder activation step (it
 * commits recurring AI spend), and each tick processes at most 5 workspaces,
 * oldest-run-first, to cap per-invocation cost. Spend is also governed by the
 * existing kill-switch and budget caps (clusterSignalsCore passes workspaceId).
 */
export const Route = createFileRoute("/api/public/hooks/cluster-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;

        const { data: workspaces, error } = await supabaseAdmin
          .from("workspaces")
          .select("id, owner_id, last_auto_cluster_at")
          .eq("auto_cluster_enabled", true)
          .order("last_auto_cluster_at", { ascending: true, nullsFirst: true })
          .limit(5);

        if (error) {
          // Pre-migration tolerance: auto_cluster_enabled may not exist yet.
          const code = (error as { code?: string }).code;
          if (code === "42703" || code === "PGRST204") {
            return json({ ok: true, processed: 0, note: "auto_cluster not migrated yet" });
          }
          return json({ ok: false, error: error.message }, 500);
        }

        const results: Array<{ workspace_id: string; themes?: number; error?: string }> = [];
        for (const ws of workspaces ?? []) {
          try {
            if (!ws.owner_id) {
              results.push({ workspace_id: ws.id, error: "no owner" });
              continue;
            }
            const r = await clusterSignalsCore(supabaseAdmin, ws.owner_id, ws.id, null);
            await supabaseAdmin
              .from("workspaces")
              .update({ last_auto_cluster_at: new Date().toISOString() })
              .eq("id", ws.id);
            results.push({ workspace_id: ws.id, themes: r.themes });
          } catch (e) {
            results.push({
              workspace_id: ws.id,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        return json({ ok: true, processed: workspaces?.length ?? 0, results });
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
