import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Nightly admin-expiry tick. Clears expired plan overrides on subscriptions
 * and marks expired invitations. Calls a single SECURITY DEFINER RPC so the
 * work is atomic and audit-coherent.
 */
export const Route = createFileRoute("/api/public/hooks/admin-expiry-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        try {
          const { data, error } = await supabaseAdmin.rpc("cron_tick_admin_expiries");
          if (error) throw error;
          return new Response(JSON.stringify({ ok: true, result: data }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "tick failed";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});