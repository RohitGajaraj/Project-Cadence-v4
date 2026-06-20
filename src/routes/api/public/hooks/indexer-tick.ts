import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { indexUserCorpus } from "@/lib/rag/indexer.server";

/**
 * RAG indexer tick — chunks + embeds recently changed workspace content
 * (docs, PRDs, meetings, notes, signals) into `rag_chunks`. Runs hourly
 * across all users with content. Idempotent via per-chunk content hashes.
 */
export const Route = createFileRoute("/api/public/hooks/indexer-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        const started = Date.now();
        const { data: users } = await supabaseAdmin.from("profiles").select("id").limit(200);
        let indexed = 0,
          skipped = 0,
          processed = 0;
        for (const u of (users ?? []) as { id: string }[]) {
          try {
            const r = await indexUserCorpus(supabaseAdmin, u.id, 50);
            indexed += r.indexed;
            skipped += r.skipped;
            processed++;
          } catch (e) {
            console.error("indexer-tick user failed", u.id, e);
          }
        }
        return new Response(
          JSON.stringify({ ok: true, processed, indexed, skipped, ms: Date.now() - started }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
