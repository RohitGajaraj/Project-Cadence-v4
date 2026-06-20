import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendInviteEmail } from "@/lib/email.server";

// Workspace management server functions.
// RLS already gates: only the owner can update workspaces and manage members.

export const renameWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("workspaces")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("workspaces").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Owners cannot leave their own workspace, they must delete or transfer it.
    const { data: ws } = await context.supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", data.id)
      .single();
    if (ws?.owner_id === context.userId) {
      throw new Error("Owners can't leave. Delete the workspace or transfer it first.");
    }
    const { error } = await context.supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// WM-F4: hand a workspace to another member. The transactional, audited reassignment
// (owner_id + member roles + audit row) lives in the `transfer_workspace_ownership`
// SECURITY DEFINER RPC, which enforces that only the current owner can transfer and that
// the new owner is already a member. This server fn is the thin, validated entry point.
export const transferWorkspaceOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), newOwnerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("transfer_workspace_ownership", {
      _workspace_id: data.workspaceId,
      _new_owner_id: data.newOwnerId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Members + identity for the Members surface. display_name lives in profiles (own-row-only
// RLS) and email in auth.users, so a plain select cannot show co-members; the membership-gated
// SECURITY DEFINER `workspace_members_with_identity` RPC supplies identity. Pre-migration
// tolerant: if the RPC is not published yet it falls back to the plain rows (identity null),
// so the surface renders today and fills in on publish. `selfRole` lets the UI gate the
// manage affordances (only owner/admin see remove; only owner sees transfer) without a
// second round-trip; `isSelf` marks the caller's own row.
type MemberIdentityRow = {
  user_id: string;
  role: string;
  created_at: string;
  display_name: string | null;
  email: string | null;
};

export const listWorkspaceMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const viaRpc = await context.supabase.rpc("workspace_members_with_identity", {
      _workspace_id: data.id,
    });

    let rows: MemberIdentityRow[];
    if (!viaRpc.error && Array.isArray(viaRpc.data)) {
      rows = viaRpc.data as MemberIdentityRow[];
    } else {
      const plain = await context.supabase
        .from("workspace_members")
        .select("user_id, role, created_at")
        .eq("workspace_id", data.id)
        .order("created_at", { ascending: true });
      if (plain.error) throw new Error(plain.error.message);
      rows = (plain.data ?? []).map((r) => ({
        user_id: r.user_id as string,
        role: r.role as string,
        created_at: r.created_at as string,
        display_name: null,
        email: null,
      }));
    }

    const members = rows.map((r) => ({
      userId: r.user_id,
      role: r.role,
      createdAt: r.created_at,
      displayName: r.display_name,
      email: r.email,
      isSelf: r.user_id === context.userId,
    }));
    const selfRole = members.find((m) => m.isSelf)?.role ?? null;
    return { members, selfRole };
  });

export const removeWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    // RLS ("owner manages members", WM-F3) restricts member writes to the workspace
    // owner. The .select() turns an RLS-blocked delete (0 rows, no error from PostgREST)
    // into a loud failure instead of a phantom "ok" the UI would report as success.
    const { data: removed, error } = await context.supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId)
      .select("user_id");
    if (error) throw new Error(error.message);
    if (!removed || removed.length === 0) {
      throw new Error("Only the workspace owner can remove members.");
    }
    return { ok: true };
  });

// Change a member's role. Owner-only via the same "owner manages members" RLS; the
// prevent_workspace_owner_demotion trigger blocks demoting the owner. The role enum
// excludes "owner" because promotion to owner is the ownership-transfer flow, not a
// role edit. The .select() makes an RLS-blocked update fail loudly, not silently ok.
export const changeWorkspaceMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["admin", "member", "viewer"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: updated, error } = await context.supabase
      .from("workspace_members")
      .update({ role: data.role })
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId)
      .select("user_id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) {
      throw new Error("Only the workspace owner can change member roles.");
    }
    return { ok: true };
  });

// WM-F5: invitations. The RLS policy on workspace_invitations gates create/list/revoke to
// workspace managers (owner/admin); the accept path goes through the SECURITY DEFINER
// accept_workspace_invitation RPC (the invitee is not a member yet). The DB generates the
// token (a unique default); outbound email is a founder-gated no-op that returns the link.
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["admin", "member", "viewer"]).default("member"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: inv, error } = await context.supabase.rpc("create_workspace_invitation", {
      _workspace_id: data.workspaceId,
      _email: data.email,
      _role: data.role,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(inv) ? inv[0] : inv;
    const token = (row as { token: string } | null)?.token;
    if (!token) throw new Error("Failed to create invitation.");
    const link = `/join/${token}`;
    const { sent } = await sendInviteEmail({ to: data.email, inviteLink: link });
    // Always return the link so the inviter can share it even when email is not wired.
    return { ok: true, link, emailed: sent };
  });

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("workspace_invitations")
      .select("id, email, role, status, created_at, expires_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { invitations: rows ?? [] };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Only a still-pending invitation can be revoked (accepted/expired are terminal).
    const { error } = await context.supabase
      .from("workspace_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Backend entry point for the (deferred) join route: redeems a token via the definer RPC.
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: workspaceId, error } = await context.supabase.rpc("accept_workspace_invitation", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    return { ok: true, workspaceId: workspaceId as string };
  });
