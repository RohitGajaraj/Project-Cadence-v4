import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getInstallationAccount, readConnectState } from "@/lib/connectors/providers/github.server";

/**
 * F-CONN Phase 1 — GitHub App installation callback (public, unauthenticated).
 * GitHub redirects here after install/configure with
 * ?installation_id=&setup_action=&state=. The user is identified by the
 * HMAC-signed state minted by startGithubAppConnect (connections.functions.ts);
 * an invalid/expired state means we never touch the database. Always redirects
 * back into Settings — no JSON dead-ends.
 */
export const Route = createFileRoute("/api/public/connect/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirect = (qs: string) =>
          new Response(null, {
            status: 302,
            headers: { Location: `${url.origin}/settings?section=connections&${qs}` },
          });
        try {
          const installationId = url.searchParams.get("installation_id");
          const setupAction = url.searchParams.get("setup_action");
          const state = url.searchParams.get("state");
          if (!installationId || !state) return redirect("error=github_connect");

          const userId = await readConnectState(state);
          if (!userId) return redirect("error=github_connect");

          // Probe the installation for its account login; cosmetic, so a
          // failed probe still records the connection.
          let accountLabel: string | null = null;
          try {
            accountLabel = (await getInstallationAccount(installationId)).login;
          } catch (e) {
            console.warn("[connect/github/callback] installation probe failed:", e);
          }

          const admin = supabaseAdmin as unknown as SupabaseClient;
          const { data: existing, error: listErr } = await admin
            .from("connections")
            .select("id,external_handle,account_label")
            .eq("user_id", userId)
            .eq("provider", "github")
            .eq("auth_kind", "github_app");
          if (listErr) throw new Error(listErr.message);

          const rows = (existing ?? []) as {
            id: string;
            external_handle: string | null;
            account_label: string | null;
          }[];
          const match =
            rows.find((r) => r.external_handle === installationId) ??
            (accountLabel ? rows.find((r) => r.account_label === accountLabel) : undefined);

          const fields: Record<string, unknown> = {
            external_handle: installationId,
            status: "connected",
            status_detail: null,
            last_verified_at: new Date().toISOString(),
            metadata: { setup_action: setupAction },
          };
          if (accountLabel) fields.account_label = accountLabel;

          if (match) {
            const { error } = await admin.from("connections").update(fields).eq("id", match.id);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await admin.from("connections").insert({
              user_id: userId,
              provider: "github",
              auth_kind: "github_app",
              ...fields,
            });
            if (error) throw new Error(error.message);
          }

          return redirect("connected=github");
        } catch (e) {
          console.error("[connect/github/callback]", e);
          return redirect("error=github_connect");
        }
      },
    },
  },
});
