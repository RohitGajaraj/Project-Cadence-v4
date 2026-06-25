import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDriftForUser } from "@/lib/ai/drift.server";
import { withJobRun } from "@/lib/observability";

/**
 * Scheduled drift tick — for each user with an enabled baseline (or no
 * baseline yet → defaults), roll up snapshots and detect incidents.
 * Invoked by pg_cron POST.
 */
export const Route = createFileRoute("/api/public/hooks/drift-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        return withJobRun("cron.drift-tick", async () => {
          const { data: users, error } = await supabaseAdmin
            .from("ai_events")
            .select("user_id")
            .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
          if (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          const uniqueUsers = Array.from(new Set((users ?? []).map((u: any) => u.user_id)));
          const results: Array<{
            user_id: string;
            snapshots?: number;
            opened?: number;
            resolved?: number;
            error?: string;
          }> = [];
          for (const userId of uniqueUsers) {
            try {
              const r = await runDriftForUser(supabaseAdmin, userId);
              results.push({ user_id: userId, ...r });
            } catch (e: any) {
              results.push({ user_id: userId, error: e?.message ?? String(e) });
            }
          }
          return new Response(JSON.stringify({ ok: true, users: uniqueUsers.length, results }), {
            headers: { "Content-Type": "application/json" },
          });
        });
      },
    },
  },
});
