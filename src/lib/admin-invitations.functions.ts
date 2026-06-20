/**
 * Admin Console v2 — People · Invitations panel server fns.
 * All gated server-side by has_role('admin') inside SECURITY DEFINER RPCs.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminInvitation = {
  id: string;
  email: string;
  workspace_id: string | null;
  role: string;
  token: string;
  state: "pending" | "accepted" | "revoked" | "expired";
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export const adminListInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { state?: string | null; limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<AdminInvitation[] | { error: string }> => {
    const { data: rows, error } = await context.supabase.rpc("admin_list_invitations", {
      _state: data.state ?? null, _lim: data.limit ?? 100, _off: data.offset ?? 0,
    });
    if (error) return { error: error.message };
    return (rows ?? []) as AdminInvitation[];
  });

export const adminCreateInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; workspaceId: string | null; role: string; expiresDays?: number }) => d)
  .handler(async ({ context, data }): Promise<AdminInvitation | { error: string }> => {
    const { data: row, error } = await context.supabase.rpc("admin_create_invitation", {
      _email: data.email, _workspace_id: data.workspaceId, _role: data.role,
      _expires_days: data.expiresDays ?? 14,
    });
    if (error) return { error: error.message };
    return row as AdminInvitation;
  });

export const adminBulkCreateInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rows: Array<{ email: string; workspace_id?: string | null; role?: string }> }) => d)
  .handler(async ({ context, data }): Promise<{ created: number } | { error: string }> => {
    const { data: count, error } = await context.supabase.rpc("admin_bulk_create_invitations", {
      _rows: data.rows,
    });
    if (error) return { error: error.message };
    return { created: Number(count) };
  });

export const adminRevokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_revoke_invitation", { _id: data.id });
    if (error) return { error: error.message };
    return { ok: true };
  });

export type AutoApproveDomain = {
  id: string;
  domain: string;
  workspace_id: string | null;
  default_role: string;
  created_by: string | null;
  created_at: string;
};

export const adminListAutoApproveDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutoApproveDomain[] | { error: string }> => {
    const { data, error } = await context.supabase.rpc("admin_list_auto_approve_domains");
    if (error) return { error: error.message };
    return (data ?? []) as AutoApproveDomain[];
  });

export const adminUpsertAutoApproveDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domain: string; workspaceId: string | null; role: string }) => d)
  .handler(async ({ context, data }): Promise<AutoApproveDomain | { error: string }> => {
    const { data: row, error } = await context.supabase.rpc("admin_upsert_auto_approve_domain", {
      _domain: data.domain, _workspace_id: data.workspaceId, _role: data.role,
    });
    if (error) return { error: error.message };
    return row as AutoApproveDomain;
  });

export const adminDeleteAutoApproveDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_delete_auto_approve_domain", { _id: data.id });
    if (error) return { error: error.message };
    return { ok: true };
  });

export type SignupApproval = {
  id: string; email: string; requested_workspace_id: string | null;
  state: "pending" | "approved" | "rejected";
  reviewed_by: string | null; reviewed_at: string | null; note: string | null; created_at: string;
};

export const adminListSignupApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { state?: string | null }) => d)
  .handler(async ({ context, data }): Promise<SignupApproval[] | { error: string }> => {
    const { data: rows, error } = await context.supabase.rpc("admin_list_signup_approvals", {
      _state: data.state ?? "pending", _lim: 100, _off: 0,
    });
    if (error) return { error: error.message };
    return (rows ?? []) as SignupApproval[];
  });

export const adminReviewSignupApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean; note: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_review_signup_approval", {
      _id: data.id, _approve: data.approve, _note: data.note,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });