/**
 * Admin Console v2 — Workspaces tab. Search, drawer with members + audit,
 * grant credits, change member role, transfer ownership, soft-delete + restore.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/hooks/use-confirm";
import {
  adminSearchWorkspaces,
  adminGetWorkspaceDetail,
  adminChangeMemberRole,
  adminRemoveWorkspaceMember,
  adminTransferWorkspaceOwnership,
  adminSoftDeleteWorkspace,
  adminRestoreWorkspace,
  type AdminWorkspaceRow,
} from "@/lib/admin-workspaces.functions";

export const Route = createFileRoute("/_authenticated/admin/workspaces")({
  component: AdminWorkspaces,
});

type WSDetail = {
  workspace?: { id: string; name: string; slug: string; owner_id: string; plan_tier: string; deleted_at: string | null; created_at: string };
  members?: Array<{ user_id: string; email: string; role: string }>;
  audit?: Array<{ id: string; action: string; created_at: string }>;
};

function AdminWorkspaces() {
  const fSearch = useServerFn(adminSearchWorkspaces);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const search = useQuery({ queryKey: ["admin-workspaces", q], queryFn: () => fSearch({ data: { q } }) });
  const rows: AdminWorkspaceRow[] = Array.isArray(search.data) ? (search.data as AdminWorkspaceRow[]) : [];

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
      <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>
        Inspect tenants · adjust plans · move ownership
      </p>
      <div className="bento" style={{ padding: 16, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, slug, or owner email"
            style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13 }} />
          <span className="mono-label" style={{ color: "var(--ink-subtle)" }}>
            {search.isLoading ? "Loading…" : `${rows.length} workspaces`}
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr className="mono-label" style={{ color: "var(--ink-subtle)" }}>
            <th style={th()}>Name</th><th style={th()}>Owner</th><th style={th()}>Plan</th>
            <th style={th()}>Members</th><th style={th()}>Deleted</th><th style={th()}></th>
          </tr></thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                <td style={td()}>{w.name}</td>
                <td style={td()}>{w.owner_email ?? "-"}</td>
                <td style={td()}>{w.plan_tier}</td>
                <td style={td()}>{w.member_count}</td>
                <td style={td()}>{w.deleted_at ? "yes" : "no"}</td>
                <td style={td()}><button className="btn btn-sm" onClick={() => setSelected(w.id)}>Open</button></td>
              </tr>
            ))}
            {rows.length === 0 && !search.isLoading ? <tr><td colSpan={6} style={{ padding: 12, textAlign: "center", color: "var(--ink-subtle)" }}>No workspaces.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <WorkspaceDrawer workspaceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function WorkspaceDrawer({ workspaceId, onClose }: { workspaceId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fDetail = useServerFn(adminGetWorkspaceDetail);
  const fRole = useServerFn(adminChangeMemberRole);
  const fRemove = useServerFn(adminRemoveWorkspaceMember);
  const fTransfer = useServerFn(adminTransferWorkspaceOwnership);
  const fSoftDel = useServerFn(adminSoftDeleteWorkspace);
  const fRestore = useServerFn(adminRestoreWorkspace);

  const detail = useQuery({
    queryKey: ["admin-workspace-detail", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const r = await fDetail({ data: { workspaceId: workspaceId! } });
      if ("error" in r) throw new Error(r.error);
      return JSON.parse(r.json) as WSDetail;
    },
  });
  const d = detail.data;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-workspace-detail", workspaceId] });
    qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
  };

  const setRole = useMutation({
    mutationFn: (vars: { userId: string; role: string }) => fRole({ data: { workspaceId: workspaceId!, ...vars } }),
    onSuccess: () => invalidate(),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => fRemove({ data: { workspaceId: workspaceId!, userId } }),
    onSuccess: () => invalidate(),
  });
  const transfer = useMutation({
    mutationFn: (newOwnerId: string) => fTransfer({ data: { workspaceId: workspaceId!, newOwnerId } }),
    onSuccess: (r) => { if ("error" in r) toast.error(r.error); else { toast.success("Ownership transferred."); invalidate(); } },
  });
  const softDel = useMutation({
    mutationFn: () => fSoftDel({ data: { workspaceId: workspaceId! } }),
    onSuccess: () => { toast.success("Workspace soft-deleted (30-day restore window)."); invalidate(); },
  });
  const restore = useMutation({
    mutationFn: () => fRestore({ data: { workspaceId: workspaceId! } }),
    onSuccess: () => { toast.success("Workspace restored."); invalidate(); },
  });

  return (
    <Sheet open={!!workspaceId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" style={{ width: "min(560px, 100vw)", overflow: "auto" }}>
        <SheetHeader><SheetTitle>{d?.workspace?.name ?? "Workspace"}</SheetTitle></SheetHeader>
        {!d ? <p style={{ marginTop: 16, fontSize: 13 }}>Loading…</p> : (
          <div style={{ marginTop: 16, display: "grid", gap: 18 }}>
            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Identity</div>
              <div style={{ fontSize: 12.5 }}>
                Slug · {d.workspace?.slug}<br />
                Plan · {d.workspace?.plan_tier}<br />
                Created · {d.workspace?.created_at?.slice(0, 10)}<br />
                Deleted · {d.workspace?.deleted_at ? d.workspace.deleted_at.slice(0, 10) : "no"}
              </div>
            </section>
            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Members</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: 12.5 }}>
                {(d.members ?? []).map((m) => (
                  <li key={m.user_id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {m.email ?? m.user_id.slice(0, 8)} ·
                    <select value={m.role} onChange={(e) => setRole.mutate({ userId: m.user_id, role: e.target.value })}
                      style={{ padding: "4px 6px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }}>
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={async () => {
                      const ok = await confirm({ title: "Remove member?", body: `${m.email} loses access immediately.`, confirmLabel: "Remove", destructive: true });
                      if (ok) remove.mutate(m.user_id);
                    }}>Remove</button>
                    {d.workspace?.owner_id !== m.user_id ? (
                      <button className="btn btn-sm" onClick={async () => {
                        const ok = await confirm({ title: "Transfer ownership?", body: `${m.email} becomes the new owner.`, confirmLabel: "Transfer" });
                        if (ok) transfer.mutate(m.user_id);
                      }}>Make owner</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Lifecycle</div>
              {d.workspace?.deleted_at ? (
                <button className="btn btn-primary btn-sm" onClick={() => restore.mutate()}>Restore · re-enables workspace</button>
              ) : (
                <button className="btn btn-sm" onClick={async () => {
                  const ok = await confirm({ title: "Soft-delete workspace?", body: "Hidden from users immediately. 30-day restore window.", confirmLabel: "Soft-delete · 30-day restore window", destructive: true });
                  if (ok) softDel.mutate();
                }}>Soft-delete · 30-day restore</button>
              )}
            </section>
            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Recent audit</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {(d.audit ?? []).slice(0, 10).map((row) => (
                  <li key={row.id}><code>{row.action}</code> · {row.created_at.slice(0, 16).replace("T", " ")}</li>
                ))}
                {(d.audit ?? []).length === 0 ? <li style={{ listStyle: "none", color: "var(--ink-subtle)" }}>No admin actions yet.</li> : null}
              </ul>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function th(): React.CSSProperties { return { padding: "8px 10px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "left" }; }
function td(): React.CSSProperties { return { padding: "10px", verticalAlign: "middle" }; }