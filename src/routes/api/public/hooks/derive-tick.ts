import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withJobRun } from "@/lib/observability";
import { deriveAllInsights } from "@/lib/brain/derive-insights.server";

export const Route = createFileRoute("/api/public/hooks/derive-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;

        return withJobRun("brain.derive-tick", async () => {
          const { data: workspaces, error } = await supabaseAdmin
            .from("workspaces")
            .select("id, owner_id, last_auto_sense_at")
            .eq("auto_sense_enabled", true)
            .order("last_auto_sense_at", { ascending: true, nullsFirst: true })
            .limit(3);

          if (error) {
            const code = (error as { code?: string }).code;
            if (code === "42703" || code === "PGRST204") {
              return json({ ok: true, processed: 0, note: "auto_derive not migrated yet" });
            }
            return json({ ok: false, error: error.message }, 500);
          }

          let totalDerived = 0;
          const results: Array<{
            workspace_id: string;
            insights?: number;
            error?: string;
            note?: string;
          }> = [];

          const today = new Date().toISOString().slice(0, 10);
          const DAILY_DERIVE_CAP = 20;

          for (const ws of workspaces ?? []) {
            try {
              if (!ws.owner_id) {
                results.push({ workspace_id: ws.id, error: "no owner" });
                continue;
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: todayRows } = await (supabaseAdmin as any)
                .from("insights")
                .select("id")
                .eq("workspace_id", ws.id)
                .neq("kind", "next_best_action")
                .gte("created_at", `${today}T00:00:00Z`);
              const todayCount: number = (todayRows as unknown[])?.length ?? 0;
              if (todayCount >= DAILY_DERIVE_CAP) {
                results.push({ workspace_id: ws.id, insights: 0, note: "daily cap reached" });
                continue;
              }
              const r = await deriveAllInsights(supabaseAdmin, ws.owner_id, ws.id);
              await supabaseAdmin
                .from("workspaces")
                .update({ last_auto_sense_at: new Date().toISOString() })
                .eq("id", ws.id);
              const count = r?.length ?? 0;
              totalDerived += count;
              results.push({ workspace_id: ws.id, insights: count });
            } catch (e) {
              results.push({
                workspace_id: ws.id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          return json({ ok: true, processed: workspaces?.length ?? 0, insights: totalDerived });
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
