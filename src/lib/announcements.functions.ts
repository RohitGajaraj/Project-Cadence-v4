/**
 * L2: Announcement server functions (TanStack server functions).
 *
 * The authenticated CRUD + governed-publish surface over `announcements`:
 *   - listAnnouncements / createAnnouncement / updateAnnouncement
 *   - submitForApproval (draft -> pending; any contributing member)
 *   - approveAndPublish (pending -> published; owner/admin only, via the
 *     SECURITY DEFINER `publish_announcement` RPC)
 *
 * Every status transition is validated by the pure `applyTransition` (the shared
 * governance rule), then enforced AGAIN at the DB layer (RLS + the publish RPC), so
 * the app and the database cannot drift on who may do what. The public (anon) read
 * surface `getPublic` is deferred to L2b (it needs the anon-client wire + the public
 * route); the DB already enforces published-only public reads via RLS.
 *
 * The `announcements` table is not in the generated Supabase types until the
 * founder's next publish, so the client is cast (`as never as AnySupabase`) before
 * `.from()` / `.rpc()` to keep tsc green: the same un-generated-table cast escape
 * hatch used elsewhere (e.g. `byokeys.functions.ts`). The cast is purely a
 * compile-time shim; the real client passes through unchanged at runtime.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyTransition, generateSlug, type WorkspaceRole } from "./announcements";

export type AnnouncementRow = {
  id: string;
  workspace_id: string;
  slug: string;
  title: string;
  body: string;
  status: "draft" | "pending" | "published";
  created_by: string | null;
  submitted_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** A short, URL-safe entropy fragment for slug uniqueness (pure module owns the shape). */
function slugEntropy(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

/** The caller's role in a workspace (owners are members, so this resolves for all). */
async function workspaceRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as WorkspaceRole | undefined) ?? null;
}

export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<{ announcements: AnnouncementRow[] }> => {
    const { data: rows, error } = await (context.supabase as never as AnySupabase)
      .from("announcements")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { announcements: (rows ?? []) as AnnouncementRow[] };
  });

export const createAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        title: z.string().min(1).max(200),
        body: z.string().max(20000).default(""),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<{ id: string; slug: string }> => {
    const sb = context.supabase as never as AnySupabase;
    // The slug is globally unique; on the (vanishingly rare) collision, retry with
    // fresh entropy a couple of times rather than surfacing a raw constraint error.
    let lastErr: { message?: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug(data.title, slugEntropy());
      const { data: row, error } = await sb
        .from("announcements")
        .insert({
          workspace_id: data.workspaceId,
          slug,
          title: data.title,
          body: data.body,
          status: "draft",
          created_by: context.userId,
        })
        .select("id, slug")
        .single();
      if (!error) {
        return { id: (row as { id: string }).id, slug: (row as { slug: string }).slug };
      }
      lastErr = error as { message?: string; code?: string };
      if (lastErr?.code !== "23505") break; // not a slug collision: surface it
    }
    throw new Error(lastErr?.message ?? "Could not create announcement.");
  });

export const updateAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        body: z.string().max(20000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.body !== undefined) patch.body = data.body;
    if (Object.keys(patch).length === 0) return { ok: true };
    // RLS ("members update", draft/pending only) scopes the write; .select() makes a
    // blocked / published-row update fail loudly rather than returning a phantom ok.
    const { data: rows, error } = await (context.supabase as never as AnySupabase)
      .from("announcements")
      .update(patch)
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || (rows as unknown[]).length === 0) {
      throw new Error("Announcement not found, not editable, or already published.");
    }
    return { ok: true };
  });

export const submitForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), workspaceId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sb = context.supabase as never as AnySupabase;
    const { data: cur, error: curErr } = await sb
      .from("announcements")
      .select("status, workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (curErr) throw new Error(curErr.message);
    const row = cur as { status: AnnouncementRow["status"]; workspace_id: string } | null;
    if (!row) throw new Error("Announcement not found.");
    // Governance: validate the transition for the caller's role (the pure rule), then
    // write. A viewer (read-only) is rejected here even though RLS membership would
    // otherwise permit the row update.
    const role = await workspaceRole(sb, row.workspace_id, context.userId);
    if (!role) throw new Error("You are not a member of this workspace.");
    const verdict = applyTransition(row.status, "pending", role);
    if (!verdict.ok) throw new Error(verdict.reason);
    const { data: upd, error } = await sb
      .from("announcements")
      .update({ status: "pending", submitted_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!upd || (upd as unknown[]).length === 0) throw new Error("Submit failed.");
    return { ok: true };
  });

export const approveAndPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), workspaceId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    // The SECURITY DEFINER RPC re-checks owner/admin (can_manage_workspace) and
    // requires the row to be pending, so publishing is owner/admin-gated at the DB.
    const { error } = await (context.supabase as never as AnySupabase).rpc("publish_announcement", {
      _announcement_id: data.id,
      _workspace_id: data.workspaceId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Minimal structural type for the un-generated `announcements` table + RPC, so the
// casts above stay localized and tsc-checked at the call sites rather than `any`.
type AnySupabase = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => any;
};
