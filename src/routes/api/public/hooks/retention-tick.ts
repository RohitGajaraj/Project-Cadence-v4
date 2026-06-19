import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * retention-tick hook (DATA-RETENTION).
 *
 * Purges high-volume AI telemetry (ai_events / prompt_runs / tool_calls) older
 * than the retention window via the `purge_old_telemetry` SQL function. Strict
 * no-op while `data_retention_enabled()` is false (the function self-gates, so
 * this returns `{ skipped: "dormant" }` until the founder flips the flag) and
 * pre-migration tolerant (a missing function returns a tolerant note instead of
 * a 500). Idempotent - safe to poke on any cadence; wire it via pg_cron / an
 * external scheduler (founder, on publish). Hook auth is the shared secret in
 * `requireHookCaller`.
 */
const RETENTION_DAYS = 180;

export const Route = createFileRoute("/api/public/hooks/retention-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireHookCaller(request);
        if (unauth) return unauth;
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        try {
          const { data, error } = await (supabaseAdmin as unknown as SupabaseClient).rpc(
            "purge_old_telemetry",
            { _older_than_days: RETENTION_DAYS },
          );
          if (error) {
            // pre-migration (function absent) or a dormant DB - tolerate, don't 500.
            return json({ ok: true, skipped: "pending-migration", note: error.message });
          }
          return json({ ok: true, result: data });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
        }
      },
    },
  },
});
