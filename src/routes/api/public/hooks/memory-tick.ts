import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
        const unauth = requireHookCaller(request);
        if (unauth) return unauth;
        try {
          const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

          // Two passes — delete by last_used_at when present, else by created_at.
          // Splitting the predicate avoids a COALESCE that can't use the index.
          const usedRes = await supabaseAdmin.from("agent_memory")
            .delete({ count: "exact" })
            .lte("importance", 2)
            .not("last_used_at", "is", null)
            .lt("last_used_at", cutoff);

          const unusedRes = await supabaseAdmin.from("agent_memory")
            .delete({ count: "exact" })
            .lte("importance", 2)
            .is("last_used_at", null)
            .lt("created_at", cutoff);

          const decayed = (usedRes.count ?? 0) + (unusedRes.count ?? 0);
          const errs = [usedRes.error, unusedRes.error].filter(Boolean).map((e) => e!.message);

          return new Response(JSON.stringify({ ok: errs.length === 0, decayed, errors: errs }), {
            headers: { "Content-Type": "application/json" },
            status: errs.length === 0 ? 200 : 500,
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});