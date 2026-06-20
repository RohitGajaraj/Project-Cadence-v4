import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, UserMinus } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listWorkspaceMembers,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
} from "@/lib/workspaces.functions";
import { toast } from "@/lib/notify";

// Members: the calm-front view of who is in the workspace (WM-F4 + RBAC). Identity (name/email)
// comes from the membership-gated workspace_members_with_identity RPC, because profiles RLS is
// own-row-only. Owners/admins can remove a member; the owner can hand over ownership via an
// inline two-step confirm (it demotes them to admin, so it is not a one-click action).
// Engine-Room: workspace_members + the RBAC roles + the transfer/remove RPCs -> shown in
// Settings > Workspace as "Members" -> see who is in the workspace and, as owner/admin, manage them.

type Member = {
  userId: string;
  role: string;
  createdAt: string;
  displayName: string | null;
  email: string | null;
  isSelf: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

function memberName(m: Member): string {
  return m.displayName?.trim() || m.email?.trim() || "Member";
}

function monogram(m: Member): string {
  const name = memberName(m);
  return name === "Member" ? "?" : name[0]!.toUpperCase();
}

function joinedOn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function RoleChip({ role }: { role: string }) {
  const isOwner = role === "owner";
  return (
    <span
      className="mono-label"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        padding: "1px 7px",
        borderRadius: 999,
        color: isOwner ? "var(--ink)" : "var(--ink-muted)",
        background: isOwner ? "var(--surface-1)" : "transparent",
        border: "1px solid var(--hairline)",
      }}
    >
      {isOwner && <Crown size={10} aria-hidden />}
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

export function MembersCard() {
  const { activeWorkspaceId, activeWorkspace, refreshWorkspaces } = useWorkspace();
  const qc = useQueryClient();
  const fList = useServerFn(listWorkspaceMembers);
  const fRemove = useServerFn(removeWorkspaceMember);
  const fTransfer = useServerFn(transferWorkspaceOwnership);

  const membersQ = useQuery({
    queryKey: ["workspace-members", activeWorkspaceId],
    queryFn: () => fList({ data: { id: activeWorkspaceId as string } }),
    enabled: !!activeWorkspaceId,
  });

  const members: Member[] = membersQ.data?.members ?? [];
  const selfRole = membersQ.data?.selfRole ?? null;
  const canManage = selfRole === "owner" || selfRole === "admin";
  const isOwner = selfRole === "owner";
  const ownerId = activeWorkspace?.owner_id ?? null;

  const [confirmTransfer, setConfirmTransfer] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (userId: string) =>
      fRemove({ data: { workspaceId: activeWorkspaceId as string, userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", activeWorkspaceId] });
      toast.success("Member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const transfer = useMutation({
    mutationFn: (newOwnerId: string) =>
      fTransfer({ data: { workspaceId: activeWorkspaceId as string, newOwnerId } }),
    onSuccess: () => {
      setConfirmTransfer(null);
      qc.invalidateQueries({ queryKey: ["workspace-members", activeWorkspaceId] });
      refreshWorkspaces();
      toast.success("Ownership transferred");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div className="mono-label">Members</div>
        {!membersQ.isLoading && members.length > 0 && (
          <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            {members.length} {members.length === 1 ? "person" : "people"}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 6, maxWidth: 520 }}>
        Who can work in this workspace.{" "}
        {canManage
          ? isOwner
            ? "You can remove people or hand over ownership."
            : "You can remove people."
          : "Ask an owner or admin to change who is here."}
      </p>

      <div style={{ marginTop: 16 }}>
        {membersQ.isLoading ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }} aria-hidden>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    background: "var(--surface-1)",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      width: "42%",
                      height: 11,
                      borderRadius: 4,
                      background: "var(--surface-1)",
                    }}
                  />
                  <div
                    style={{
                      width: "26%",
                      height: 9,
                      borderRadius: 4,
                      background: "var(--surface-1)",
                      marginTop: 7,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : membersQ.isError ? (
          <div style={{ fontSize: 13, color: "var(--rose)", marginTop: 4 }}>
            Could not load members. Try again.
          </div>
        ) : members.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>No members yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {members.map((m, i) => {
              const name = memberName(m);
              const isRowOwner = m.userId === ownerId || m.role === "owner";
              const showRemove = canManage && !isRowOwner && !m.isSelf;
              const showTransfer = isOwner && !isRowOwner && !m.isSelf;
              const subtitle =
                m.displayName && m.email
                  ? `${m.email} · joined ${joinedOn(m.createdAt)}`
                  : `joined ${joinedOn(m.createdAt)}`;
              const confirming = confirmTransfer === m.userId;

              return (
                <li
                  key={m.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      borderRadius: 999,
                      background: "var(--surface-1)",
                      border: "1px solid var(--hairline)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink-muted)",
                    }}
                  >
                    {monogram(m)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 220,
                        }}
                      >
                        {name}
                      </span>
                      {m.isSelf && (
                        <span
                          className="mono-label"
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 999,
                            color: "var(--ink-subtle)",
                            border: "1px solid var(--hairline)",
                          }}
                        >
                          You
                        </span>
                      )}
                      <RoleChip role={m.role} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
                      {subtitle}
                    </div>
                  </div>

                  {confirming ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: "var(--ink-subtle)", maxWidth: 180 }}>
                        Make {name} the owner? You become an admin.
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={transfer.isPending}
                        onClick={() => transfer.mutate(m.userId)}
                      >
                        {transfer.isPending ? "Transferring" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={transfer.isPending}
                        onClick={() => setConfirmTransfer(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    (showTransfer || showRemove) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {showTransfer && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setConfirmTransfer(m.userId)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                            aria-label={`Make ${name} the owner`}
                          >
                            <Crown size={13} />
                            Make owner
                          </button>
                        )}
                        {showRemove && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(m.userId)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              color: "var(--rose)",
                            }}
                            aria-label={`Remove ${name}`}
                          >
                            <UserMinus size={13} />
                            Remove
                          </button>
                        )}
                      </div>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
