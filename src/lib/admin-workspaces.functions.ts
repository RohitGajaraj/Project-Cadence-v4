/**
 * Admin Console v2 — Workspaces tab server fns.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminWorkspaceRow = {
  id: string; name: string; slug: string; owner_id: string; owner_email: string | null;
  plan_tier: string; member_count: number; balance_credits: number;
  deleted_at: string | null; created_at: string;
};

export const adminSearchWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string }) => d)
  .handler(async ({ context, data }): Promise<AdminWorkspaceRow[] | { error: string }> => {
    const { data: rows, error } = await context.supabase.rpc("admin_search_workspaces", {
      _q: data.q ?? "", _lim: 100, _off: 0,
    });
    if (error) return { error: error.message };
    return ((rows ?? []) as AdminWorkspaceRow[]).map((r) => ({
      ...r, member_count: Number(r.member_count ?? 0), balance_credits: Number(r.balance_credits ?? 0),
    }));
  });

export const adminGetWorkspaceDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) => d)
  .handler(async ({ context, data }): Promise<{ json: string } | { error: string }> => {
    const { data: detail, error } = await context.supabase.rpc("admin_get_workspace_detail", { _wid: data.workspaceId });
    if (error) return { error: error.message };
    return { json: JSON.stringify(detail ?? {}) };
  });

export const adminAddWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string; userId: string; role: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_add_workspace_member", {
      _wid: data.workspaceId, _uid: data.userId, _role: data.role,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminRemoveWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string; userId: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_remove_workspace_member", {
      _wid: data.workspaceId, _uid: data.userId,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminChangeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string; userId: string; role: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_change_member_role", {
      _wid: data.workspaceId, _uid: data.userId, _role: data.role,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminTransferWorkspaceOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string; newOwnerId: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_transfer_workspace_ownership", {
      _wid: data.workspaceId, _new_owner: data.newOwnerId,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminSoftDeleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_soft_delete_workspace", { _wid: data.workspaceId });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminRestoreWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_restore_workspace", { _wid: data.workspaceId });
    if (error) return { error: error.message };
    return { ok: true };
  });