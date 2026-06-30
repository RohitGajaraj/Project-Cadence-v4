import { createFileRoute } from "@tanstack/react-router";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callModel } from "@/lib/ai/runtime.server";
import { webSearch } from "@/lib/ai/tools/firecrawl.server";
import { withJobRun } from "@/lib/observability";
import { writeSignals } from "@/lib/sources/sink.server";
import { hashContent } from "@/lib/scout/diff";

/**
 * SEN-04: Researcher Watchtower — researcher-tick hook.
 *
 * Runs daily at 07:00 UTC (migration 20260626210000_researcher_watchtower.sql).
 *
 * ACTIVATION GATE: exits early if FIRECRAWL_API_KEY is not set. The pg_cron
 * schedule is installed by the migration; the key is the only remaining step
 * for the founder to activate this feature.
 *
 * Per workspace (up to MAX_WORKSPACES, oldest-tick-first):
 *   1. Derives search queries from researcher_targets (user-configured) or falls
 *      back to current_focus + top opportunity titles.
 *   2. Runs web searches via Firecrawl.
 *   3. Calls the AI to synthesize a short competitive brief (3-5 bullets).
 *   4. Inserts a source='competitive_research' signal as the brief artifact.
 *
 * Rate-limited: skips if last_researcher_tick_at is within the past 20 hours.
 */

const MAX_WORKSPACES = 5;
const MAX_SEARCH_QUERIES = 3;
const TICK_COOLDOWN_HOURS = 20;

// Type for the workspace_briefs columns added by 20260626210000_researcher_watchtower.sql.
// The generated Supabase types lag behind until the migration is applied — cast via this.
type ResearcherBrief = {
  workspace_id: string;
  current_focus: string | null;
  researcher_targets: string;
  last_researcher_tick_at: string | null;
};

export const Route = createFileRoute("/api/public/hooks/researcher-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;

        // ACTIVATION GATE: key absent = dormant by design
        if (!process.env.FIRECRAWL_API_KEY) {
          return json({ ok: true, skipped: true, reason: "FIRECRAWL_API_KEY not set" });
        }

        return withJobRun("ambient.researcher-tick", async () => {
          const cooldownCutoff = new Date(
            Date.now() - TICK_COOLDOWN_HOURS * 3600_000,
          ).toISOString();

          // Workspaces with auto_sense_enabled, oldest researcher tick first
          const { data: rawBriefs, error: briefErr } = await supabaseAdmin
            .from("workspace_briefs")
            .select("workspace_id, current_focus, researcher_targets, last_researcher_tick_at")
            .or(`last_researcher_tick_at.is.null,last_researcher_tick_at.lt.${cooldownCutoff}`)
            .order("last_researcher_tick_at", { ascending: true, nullsFirst: true })
            .limit(MAX_WORKSPACES);
          // Cast: new columns not in generated types until migration is applied
          const briefs = rawBriefs as unknown as ResearcherBrief[] | null;

          if (briefErr) {
            const code = (briefErr as { code?: string }).code;
            if (code === "42703" || code === "PGRST204") {
              return json({ ok: true, processed: 0, note: "researcher columns not migrated yet" });
            }
            return json({ ok: false, error: briefErr.message }, 500);
          }

          const results: Array<{
            workspace_id: string;
            queries?: string[];
            inserted?: number;
            skipped?: number;
            error?: string;
          }> = [];

          for (const brief of briefs ?? []) {
            try {
              // Derive search queries
              const targets = (brief.researcher_targets ?? "").trim();
              let queries: string[];
              if (targets) {
                // User-configured: each line/comma is a target
                queries = targets
                  .split(/[,\n]+/)
                  .map((t: string) => t.trim())
                  .filter(Boolean)
                  .slice(0, MAX_SEARCH_QUERIES)
                  .map((t: string) => `${t} latest news product updates`);
              } else {
                // Fall back to focus + opportunities
                const focus = (brief.current_focus ?? "").trim();
                const { data: opps } = await supabaseAdmin
                  .from("opportunities")
                  .select("title")
                  .eq("workspace_id", brief.workspace_id)
                  .eq("status", "backlog")
                  .order("impact", { ascending: false })
                  .limit(2);

                queries = [
                  focus ? `${focus} competitor landscape 2025` : null,
                  ...(opps ?? []).map((o) => `${o.title} market alternatives`),
                ]
                  .filter(Boolean)
                  .slice(0, MAX_SEARCH_QUERIES) as string[];
              }

              if (queries.length === 0) {
                results.push({
                  workspace_id: brief.workspace_id,
                  error: "no search terms derived",
                });
                continue;
              }

              // Run web searches in parallel (bounded)
              const searchResults = await Promise.all(
                queries.map((q) =>
                  webSearch({ query: q, limit: 3 }).catch(() => ({
                    results: [] as Array<{ title: string; url: string; description: string }>,
                  })),
                ),
              );

              const snippets = searchResults
                .flatMap((r) => r.results ?? [])
                .slice(0, 9)
                .map((h, i) => `[${i + 1}] ${h.title}\n${h.description ?? ""}\n${h.url}`)
                .join("\n\n");

              if (!snippets.trim()) {
                results.push({ workspace_id: brief.workspace_id, error: "no search results" });
                continue;
              }

              // Get workspace owner for AI call
              const { data: ws } = await supabaseAdmin
                .from("workspaces")
                .select("owner_id")
                .eq("id", brief.workspace_id)
                .single();
              if (!ws?.owner_id) {
                results.push({ workspace_id: brief.workspace_id, error: "no owner" });
                continue;
              }

              // Synthesize competitive brief via AI
              const system = `You are a competitive intelligence analyst. Given web search results, write a concise 3-5 bullet competitive brief (plain text, no markdown headers, no em-dashes).
Each bullet: one signal — a product update, market move, or pricing change worth knowing.
Return only the bullets, nothing else.`;

              const userMsg = `Search queries: ${queries.join(", ")}\n\nResults:\n${snippets}`;

              const res = await callModel(supabaseAdmin as never, ws.owner_id, {
                surface: "sense",
                surface_ref: `researcher:watchtower:${brief.workspace_id}`,
                model: "google/gemini-2.5-flash",
                fallbackModel: "anthropic/claude-haiku-4-5-20251001",
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: userMsg },
                ],
              });

              const briefContent = (res.output ?? "").trim();
              if (!briefContent) {
                results.push({
                  workspace_id: brief.workspace_id,
                  error: "AI returned empty brief",
                });
                continue;
              }

              const titleClean = queries[0]
                .replace(" latest news product updates", "")
                .replace(" competitor landscape 2025", "")
                .replace(" market alternatives", "");
              const title = `Competitive brief: ${titleClean}`;

              // Route through writeSignals so the brief inherits source_kind stamping,
              // dedup (external_id), and the injection screen — same as every other source.
              // external_id is stable per-workspace per-query so daily re-runs dedup.
              const externalId = `researcher:${brief.workspace_id}:${hashContent(queries[0])}`;
              const writeRes = await writeSignals(ws.owner_id, brief.workspace_id, [
                {
                  externalId,
                  source: "competitive_research",
                  sourceKind: "web_scout",
                  title: title.slice(0, 200),
                  content: briefContent,
                  tags: ["scout", "competitor", "brief"],
                  untrusted: true,
                },
              ]);

              // Update last_researcher_tick_at
              await supabaseAdmin
                .from("workspace_briefs")
                .update({ last_researcher_tick_at: new Date().toISOString() })
                .eq("workspace_id", brief.workspace_id);

              results.push({
                workspace_id: brief.workspace_id,
                queries,
                inserted: writeRes.inserted,
                skipped: writeRes.skipped,
              });
            } catch (e) {
              results.push({
                workspace_id: brief.workspace_id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          return json({ ok: true, processed: briefs?.length ?? 0, results });
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
