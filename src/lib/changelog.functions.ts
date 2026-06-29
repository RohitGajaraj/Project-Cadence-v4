import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { changelogRowFor, type ChangesetForChangelog } from "@/lib/changelog";

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

// BYO-P3 WI4 — In-app changelog server functions.
// Entries are auto-materialized from merged changesets by the
// studio_changeset_to_changelog DB trigger; publishChangelogEntry is the
// durable TS equivalent (the source of truth if a sync ever reverts the
// trigger, and the explicit hook recordOutcome calls). listChangelog is a pure,
// workspace-scoped read. New tables aren't in the generated Supabase types yet.

export type ChangelogEntry = {
  id: string;
  product_id: string | null;
  changeset_id: string | null;
  prd_id: string | null;
  title: string;
  body: string;
  pr_number: number | null;
  pr_url: string | null;
  published_at: string;
  product_name?: string | null;
};

export const listChangelog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ entries: ChangelogEntry[] }> => {
    const db = context.supabase as unknown as SupabaseClient;

    // Scope to ONE workspace (the active one, or the caller's first membership)
    // so a multi-workspace user never sees a merged cross-workspace list under a
    // single-workspace breadcrumb. RLS still enforces access; this restores
    // active-workspace scoping, matching listProjects.
    const workspaceId = await resolveWorkspaceId(db, data.workspaceId);
    if (!workspaceId) return { entries: [] };

    let q = db
      .from("changelog_entries")
      .select("id,product_id,changeset_id,prd_id,title,body,pr_number,pr_url,published_at")
      .eq("workspace_id", workspaceId)
      .order("published_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.productId) q = q.eq("product_id", data.productId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const entries = (rows ?? []) as ChangelogEntry[];

    // Resolve product labels in one round trip (RLS-scoped read).
    const productIds = Array.from(
      new Set(entries.map((e) => e.product_id).filter((id): id is string => !!id)),
    );
    if (productIds.length) {
      const { data: products } = await db.from("projects").select("id,name").in("id", productIds);
      const nameById = new Map((products ?? []).map((p) => [p.id as string, p.name as string]));
      for (const e of entries) {
        e.product_name = e.product_id ? (nameById.get(e.product_id) ?? null) : null;
      }
    }
    return { entries };
  });

/**
 * Durable publish: materialize (or refresh) the changelog entry for one merged
 * changeset. Idempotent via the (changeset_id) unique index. The row is written
 * under the CURRENT user so RLS WITH CHECK (user_id = auth.uid()) passes for any
 * workspace member, not only the changeset's original author. Best-effort
 * callers (recordOutcome) should swallow its errors.
 */
export const publishChangelogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ changesetId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<{ published: boolean }> => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;
    const { data: cs, error } = await db
      .from("studio_changesets")
      .select(
        "id,workspace_id,user_id,product_id,prd_id,status,title,summary,release_notes,release_notes_at,pr_number,pr_url,updated_at",
      )
      .eq("id", data.changesetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cs) return { published: false };

    const row = changelogRowFor(cs as unknown as ChangesetForChangelog, new Date().toISOString());
    if (!row) return { published: false };

    const { error: upErr } = await db
      .from("changelog_entries")
      .upsert({ ...row, user_id: userId }, { onConflict: "changeset_id" });
    if (upErr) throw new Error(upErr.message);
    return { published: true };
  });
