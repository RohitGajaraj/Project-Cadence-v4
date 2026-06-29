import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProviderAuth } from "@/lib/connectors/resolve.server";
import { repoProviderFor, type RepoRef } from "@/lib/connectors/repo-provider";
import { deploymentRowsFor } from "@/lib/deployments";

// Resolve the workspace to scope a read to (the active one, else the caller's
// default). Mirrors the local helper in billing/briefs/audio.functions.ts.
async function resolveWorkspaceId(
  supabase: SupabaseClient,
  explicit: string | null | undefined,
): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabase.rpc("current_user_default_workspace");
  return (data as string | null) ?? null;
}

// BYO-P3 WI1 — Deploy capture server functions.
// captureDeployments reads the provider's deployment state (provider-agnostic,
// via RepoProvider.readDeployments) and persists it; listDeployments reads it
// back for the outcome surface. Deploys are OPTIONAL signal — a missing
// connection or a provider hiccup yields zero captures, never a thrown error,
// so the outcome view degrades gracefully. New tables aren't in the generated
// Supabase types yet (same untyped-client cast as F-V5-LOOP-CLOSE).

/** Parse a stored "owner/repo" into a RepoRef; null when malformed. */
function parseRepo(repo: string | null | undefined): RepoRef | null {
  const m = (repo ?? "").trim().match(/^([^/\s]+)\/([^/\s]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export const captureDeployments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ changesetId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;

    const { data: cs, error } = await db
      .from("studio_changesets")
      .select("id,workspace_id,product_id,repo,base_sha")
      .eq("id", data.changesetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cs) throw new Error("Changeset not found");

    const repoRef = parseRepo(cs.repo as string | null);
    if (!repoRef) return { captured: 0, deployments: [] };

    // Today studio changesets are GitHub-backed; the read path is still
    // provider-agnostic so a GitLab-bound product captures identically once
    // its changesets land here.
    const resolved = await resolveProviderAuth({
      userClient: db,
      userId,
      workspaceId: (cs.workspace_id as string | null) ?? null,
      productId: (cs.product_id as string | null) ?? null,
      provider: "github",
      resourceKind: "repo",
    });
    if (!resolved.auth || resolved.source === "none" || !("token" in resolved.auth)) {
      return { captured: 0, deployments: [] };
    }

    const provider = repoProviderFor("github", resolved.auth.token, repoRef);
    const sha = (cs.base_sha as string | null) ?? undefined;
    let entries;
    try {
      entries = await provider.readDeployments(repoRef, sha);
    } catch (e) {
      console.error("readDeployments failed (non-fatal):", e);
      return { captured: 0, deployments: [] };
    }
    if (!entries.length) return { captured: 0, deployments: [] };

    const rows = deploymentRowsFor({
      entries,
      userId,
      workspaceId: cs.workspace_id as string,
      productId: (cs.product_id as string | null) ?? null,
      changesetId: cs.id as string,
      provider: "github",
    });
    const { error: upErr } = await db
      .from("deployments")
      .upsert(rows, { onConflict: "changeset_id,environment,commit_sha" });
    if (upErr) throw new Error(upErr.message);

    return { captured: rows.length, deployments: rows };
  });

export const listDeployments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
        changesetId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;

    // Scope to one workspace (active or default) so a multi-workspace user does
    // not see deployments merged across workspaces. RLS still enforces access.
    const workspaceId = await resolveWorkspaceId(db, data.workspaceId);
    if (!workspaceId) return { deployments: [] };

    let q = db
      .from("deployments")
      .select(
        "id,product_id,changeset_id,provider,environment,status,commit_sha,deploy_url,deployed_at,created_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.productId) q = q.eq("product_id", data.productId);
    if (data.changesetId) q = q.eq("changeset_id", data.changesetId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { deployments: rows ?? [] };
  });
