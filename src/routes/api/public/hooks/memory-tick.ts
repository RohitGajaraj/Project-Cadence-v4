import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withJobRun } from "@/lib/observability";

/**
 * memory-tick — F-AGENT-2.
 *
 * Decay low-importance, stale agent memories so recallMemory() doesn't
 * eventually drown in noise. Rule:
 *   importance <= 2  AND  COALESCE(last_used_at, created_at) < now() - 30d
 * is deleted. We never touch high-importance reflections (>=3) or recently
 * used memories regardless of importance.
 *
 * Poked by pg_cron (daily). Idempotent — repeating it is a no-op.
 */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/public/hooks/memory-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        return withJobRun("cron.memory-tick", async () => {
          try {
            const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

            // Two passes — delete by last_used_at when present, else by created_at.
            // Splitting the predicate avoids a COALESCE that can't use the index.
            const usedRes = await supabaseAdmin
              .from("agent_memory")
              .delete({ count: "exact" })
              .lte("importance", 2)
              .not("last_used_at", "is", null)
              .lt("last_used_at", cutoff);

            const unusedRes = await supabaseAdmin
              .from("agent_memory")
              .delete({ count: "exact" })
              .lte("importance", 2)
              .is("last_used_at", null)
              .lt("created_at", cutoff);

            // M-C: hard-delete memory whose plan-based retention window has passed.
            // Free-tier rows carry expires_at (stamped on insert); pro/team rows
            // carry NULL and are never swept. Pre-migration tolerant: if the column
            // does not exist yet, the missing-column error is ignored (counts as 0).
            const expiredRes = await supabaseAdmin
              .from("agent_memory")
              .delete({ count: "exact" })
              .not("expires_at", "is", null)
              .lt("expires_at", new Date().toISOString());

            const isMissingColumn = (e: { code?: string; message?: string } | null) =>
              !!e &&
              (e.code === "42703" ||
                e.code === "PGRST204" ||
                /column .* does not exist|could not find the .* column/i.test(e.message ?? ""));

            const decayed = (usedRes.count ?? 0) + (unusedRes.count ?? 0);
            const expired = expiredRes.error ? 0 : (expiredRes.count ?? 0);
            const errs = [usedRes.error, unusedRes.error, expiredRes.error]
              .filter((e) => e && !isMissingColumn(e))
              .map((e) => e!.message);

            return new Response(
              JSON.stringify({ ok: errs.length === 0, decayed, expired, errors: errs }),
              {
                headers: { "Content-Type": "application/json" },
                status: errs.length === 0 ? 200 : 500,
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
