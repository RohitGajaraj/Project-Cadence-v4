import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireHookCaller } from "./-_auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Outcome tick (F-V5-LOOP-CLOSE Phase D) — hourly pg_cron sweep that finds
 * approved PRDs with a linked GitHub issue and no shipped_at, checks the
 * issue state on GitHub, and stamps status='shipped' + shipped_at when the
 * issue has closed. Service-level (no user session) — uses supabaseAdmin,
 * same as the other /api/public/hooks/* ticks. prds.shipped_at is not yet in
 * the generated Database types, hence the untyped-client cast.
 */
export const Route = createFileRoute("/api/public/hooks/outcome-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireHookCaller(request);
        if (unauth) return unauth;
        try {
          const token = process.env.GITHUB_TOKEN;
          const rawRepo = process.env.GITHUB_REPO;
          const repo = (rawRepo ?? "")
            .trim()
            .replace(/^https?:\/\/github\.com\//i, "")
            .replace(/^git@github\.com:/i, "")
            .replace(/\.git$/i, "")
            .replace(/\/+$/, "");
          if (!token || !rawRepo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
            // GitHub not configured — nothing to check; never throw for config absence.
            return new Response(JSON.stringify({ ok: true, checked: 0, shipped: 0 }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          const admin = supabaseAdmin as unknown as SupabaseClient;
          const { data: prds } = await admin
            .from("prds")
            .select("id,github_issue_url")
            .eq("status", "approved")
            .not("github_issue_url", "is", null)
            .is("shipped_at", null)
            .limit(20);

          let checked = 0;
          let shipped = 0;
          for (const prd of prds ?? []) {
            const match = String(prd.github_issue_url).match(/\/issues\/(\d+)/);
            if (!match) continue;
            checked++;
            const res = await fetch(`https://api.github.com/repos/${repo}/issues/${match[1]}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "cadence-agent",
              },
            });
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

          return new Response(JSON.stringify({ ok: true, checked, shipped }), {
            headers: { "Content-Type": "application/json" },
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
