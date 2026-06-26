import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveGitHub } from "@/lib/connectors/providers/github.server";
import { withJobRun } from "@/lib/observability";

/**
 * Outcome tick (F-V5-LOOP-CLOSE Phase D) — hourly pg_cron sweep that finds
 * approved PRDs with a linked GitHub issue and no shipped_at, checks the
 * issue state on GitHub, and stamps status='shipped' + shipped_at when the
 * issue has closed. Service-level (no user session) — uses supabaseAdmin,
 * same as the other /api/public/hooks/* ticks. prds.shipped_at is not yet in
 * the generated Database types, hence the untyped-client cast.
 *
 * F-CONN Phase 1: GitHub auth resolves per workspace via resolveGitHub
 * (workspace binding → env fallback; admin path, no user session). Workspaces
 * with no resolvable GitHub connection are skipped silently — this tick never
 * throws for config absence.
 */
export const Route = createFileRoute("/api/public/hooks/outcome-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireHookCaller(request);
        if (unauth) return unauth;
        return withJobRun("cron.outcome-tick", async () => {
          try {
            const admin = supabaseAdmin as unknown as SupabaseClient;
            const { data: prds } = await admin
              .from("prds")
              .select("id,github_issue_url,workspace_id")
              .eq("status", "approved")
              .not("github_issue_url", "is", null)
              .is("shipped_at", null)
              .limit(20);

            // Group due PRDs by workspace so each group resolves its own binding.
            type DuePrd = { id: string; github_issue_url: string; workspace_id: string | null };
            const groups = new Map<string | null, DuePrd[]>();
            for (const prd of (prds ?? []) as DuePrd[]) {
              const key = prd.workspace_id ?? null;
              const list = groups.get(key);
              if (list) list.push(prd);
              else groups.set(key, [prd]);
            }

            let checked = 0;
            let shipped = 0;
            for (const [workspaceId, group] of groups) {
              let gh: Awaited<ReturnType<typeof resolveGitHub>>;
              try {
                gh = await resolveGitHub({ workspaceId, userId: null });
              } catch {
                // No binding and no env fallback for this workspace — skip silently.
                continue;
              }
              for (const prd of group) {
                const match = String(prd.github_issue_url).match(/\/issues\/(\d+)/);
                if (!match) continue;
                checked++;
                const res = await fetch(
                  `https://api.github.com/repos/${gh.repo}/issues/${match[1]}`,
                  {
                    headers: {
                      Authorization: `Bearer ${gh.token}`,
                      Accept: "application/vnd.github+json",
                      "X-GitHub-Api-Version": "2022-11-28",
                      "User-Agent": "cadence-agent",
                    },
                  },
                );
                if (!res.ok) continue;
                const issue = (await res.json()) as { state?: string; closed_at?: string | null };
                if (issue.state !== "closed") continue;
                const { error: upErr } = await admin
                  .from("prds")
                  .update({
                    status: "shipped",
                    shipped_at: issue.closed_at ?? new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", prd.id)
                  .is("shipped_at", null);
                if (!upErr) shipped++;
              }
            }

            return new Response(JSON.stringify({ ok: true, checked, shipped }), {
              headers: { "Content-Type": "application/json" },
            });
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
