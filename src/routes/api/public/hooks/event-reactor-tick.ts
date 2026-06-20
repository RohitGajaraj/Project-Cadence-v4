import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchEvent, nextReactorAttempt, type EventRow } from "@/lib/reactor.functions";

// attempt_count / next_attempt_at are new (KI-27) and absent from the generated
// Database types until they regenerate post-apply — untyped-cast precedent
// (cf. connectors/resolve.server.ts, outcome.functions.ts).
const admin = supabaseAdmin as unknown as SupabaseClient;

/**
 * event-reactor-tick — F-AGENT-3.
 *
 * Drains `event_queue` rows whose `approval_mode='auto'` and `status='pending'`,
 * starting an orchestrated mission per event. `confirm` rows stay pending until
 * the operator decides via `decideEventDispatch`. Fired by pg_cron every minute.
 *
 * Idempotent: the trigger fan-out uses a UNIQUE (subscription_id, source_id)
 * dedup so re-firing the underlying triggers cannot duplicate events; this
 * handler then flips status, so a re-tick just sees fewer pending rows.
 */
const BATCH = 10;

export const Route = createFileRoute("/api/public/hooks/event-reactor-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        try {
          // KI-27: reap events stuck 'processing' past the TTL (a worker evicted
          // between the claim and the terminal flip would otherwise hang forever).
          // Bounded retry: re-queue with backoff while under the cap, else fail.
          const REAP_TTL_MS = 10 * 60 * 1000;
          const reapCutoff = new Date(Date.now() - REAP_TTL_MS).toISOString();
          const { data: stuck } = await admin
            .from("event_queue")
            .select("id,attempt_count")
            .eq("status", "processing")
            .lt("dispatched_at", reapCutoff)
            .limit(BATCH);
          for (const s of stuck ?? []) {
            const decision = nextReactorAttempt((s.attempt_count as number) ?? 0, Date.now());
            const patch =
              decision.action === "retry"
                ? {
                    status: "pending",
                    attempt_count: decision.attemptCount,
                    next_attempt_at: decision.nextAttemptAt,
                  }
                : {
                    status: "failed",
                    attempt_count: decision.attemptCount,
                    error: "reclaimed after stall (worker eviction); exceeded retry cap",
                  };
            await admin.from("event_queue").update(patch).eq("id", s.id).eq("status", "processing");
          }

          // KI-27: only pick pending rows whose retry backoff (if any) has elapsed.
          const nowIso = new Date().toISOString();
          const { data: rows, error } = await admin
            .from("event_queue")
            .select(
              "id,user_id,workspace_id,event_type,target_agent_slug,payload,status,source_id,attempt_count",
            )
            .eq("status", "pending")
            .eq("approval_mode", "auto")
            .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
            .order("created_at", { ascending: true })
            .limit(BATCH);
          if (error) throw new Error(error.message);

          const dispatched: string[] = [];
          const failed: { id: string; error: string }[] = [];
          for (const row of rows ?? []) {
            // KI-28 + KI-27: claim-first CAS. dispatchEvent runs the full agent
            // loop and only flips status at the end, so without a claim two
            // overlapping ticks would re-dispatch the same event (duplicate
            // missions + billed runs). Claim by flipping pending->processing; only
            // the winner proceeds (the loser matches zero rows and skips).
            // dispatchEvent then flips processing->dispatched on success, or
            // retries/fails on error; the reaper above recovers any 'processing'
            // row stranded by a worker eviction.
            const { data: claimed } = await admin
              .from("event_queue")
              .update({ status: "processing", dispatched_at: new Date().toISOString() })
              .eq("id", row.id)
              .eq("status", "pending")
              .select("id");
            if (!claimed?.length) continue; // another tick already claimed this event
            try {
              await dispatchEvent(admin, row as EventRow, null);
              dispatched.push(row.id);
            } catch (e) {
              failed.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
            }
          }

          return new Response(
            JSON.stringify({ ok: true, considered: (rows ?? []).length, dispatched, failed }),
            { headers: { "Content-Type": "application/json" } },
          );
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
