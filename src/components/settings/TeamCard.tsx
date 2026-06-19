import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, X } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { inviteMember, listInvitations, revokeInvitation } from "@/lib/workspaces.functions";
import { toast } from "@/lib/notify";

// Invite teammates: the calm-front view of WM-F5 (workspace invitations). Manager-only RLS
// gates the backend; this surfaces the invite form, the join link (outbound email is a
// founder-gated no-op, so the inviter copies the link), and the pending invitations.
// Engine-Room: the workspace_invitations table + accept RPC -> shown in Settings > Workspace
// as "Invite teammates" -> the user invites by email, shares a link, and sees who is pending.

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
};

const ROLES = [
  { id: "member", label: "Member" },
  { id: "admin", label: "Admin" },
  { id: "viewer", label: "Viewer" },
] as const;

export function TeamCard() {
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const fInvite = useServerFn(inviteMember);
  const fList = useServerFn(listInvitations);
  const fRevoke = useServerFn(revokeInvitation);

  const invitations = useQuery({
    queryKey: ["workspace-invitations", activeWorkspaceId],
    queryFn: () => fList({ data: { workspaceId: activeWorkspaceId as string } }),
    enabled: !!activeWorkspaceId,
  });
  const pending: Invitation[] = invitations.data?.invitations ?? [];

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [lastLink, setLastLink] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () =>
      fInvite({ data: { workspaceId: activeWorkspaceId as string, email: email.trim(), role } }),
    onSuccess: (res) => {
      setLastLink(res.link);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["workspace-invitations", activeWorkspaceId] });
      toast.success(res.emailed ? "Invite sent" : "Invite created. Copy the link to share it.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => fRevoke({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-invitations", activeWorkspaceId] });
      toast.success("Invitation revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyLink() {
    if (!lastLink) return;
    const url = `${window.location.origin}${lastLink}`;
    void navigator.clipboard?.writeText(url);
    toast.success("Link copied");
  }

  const canInvite = !!activeWorkspaceId && email.trim().length > 0 && !invite.isPending;

  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <div className="mono-label">Invite teammates</div>
      <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 6, maxWidth: 520 }}>
        Invite people to this workspace by email. They join with the role you pick. Outbound email
        is off for now, so share the join link the invite gives you.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          aria-label="Invitee email"
          style={{ flex: "1 1 220px", minWidth: 0 }}
        />
        <select
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "member" | "viewer")}
          aria-label="Role"
          style={{ flex: "0 0 auto" }}
        >
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!canInvite}
          onClick={() => invite.mutate()}
        >
          {invite.isPending ? "Inviting" : "Send invite"}
        </button>
      </div>

      {lastLink && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            padding: "8px 10px",
            background: "var(--surface-sunken, var(--paper))",
            border: "1px solid var(--hairline)",
            borderRadius: 8,
          }}
        >
          <code
            style={{
              fontSize: 12,
              color: "var(--ink-muted)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {lastLink}
          </code>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={copyLink}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <Copy size={13} />
            Copy link
          </button>
        </div>
      )}

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--hairline)" }}>
        <div className="mono-label" style={{ fontSize: 11 }}>
          Invitations
        </div>
        {invitations.isLoading ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 12 }}>Loading</p>
        ) : pending.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 12 }}>
            No invitations yet.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {pending.map((inv, i) => (
              <li
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {inv.email}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
                    {inv.role} · {inv.status}
                  </div>
                </div>
                {inv.status === "pending" && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(inv.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                    aria-label={`Revoke invitation for ${inv.email}`}
                  >
                    <X size={13} />
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
