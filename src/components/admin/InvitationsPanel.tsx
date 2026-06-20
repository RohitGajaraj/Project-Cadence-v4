/**
 * People · Invitations panel: single + bulk invitations, revoke,
 * auto-approve domain rules, and the pending signup-approvals queue.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/hooks/use-confirm";
import {
  adminListInvitations,
  adminCreateInvitation,
  adminBulkCreateInvitations,
  adminRevokeInvitation,
  adminListAutoApproveDomains,
  adminUpsertAutoApproveDomain,
  adminDeleteAutoApproveDomain,
  adminListSignupApprovals,
  adminReviewSignupApproval,
  type AdminInvitation,
  type AutoApproveDomain,
  type SignupApproval,
} from "@/lib/admin-invitations.functions";

export function InvitationsPanel() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <InviteCreator />
      <InviteList />
      <DomainList />
      <SignupApprovalsList />
    </div>
  );
}

function InviteCreator() {
  const qc = useQueryClient();
  const fCreate = useServerFn(adminCreateInvitation);
  const fBulk = useServerFn(adminBulkCreateInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [csv, setCsv] = useState("");

  const single = useMutation({
    mutationFn: () => fCreate({ data: { email, workspaceId: null, role, expiresDays: 14 } }),
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success(`Invitation sent · ${r.email}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
  });
  const bulk = useMutation({
    mutationFn: () => {
      const rows = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((email) => ({ email, role }));
      return fBulk({ data: { rows } });
    },
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success(`${r.created} invitations created`);
      setCsv("");
      qc.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
  });

  return (
    <div className="bento" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div className="mono-label">New invitation</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com"
          style={input(220)} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={input(120)}>
          <option value="member">member</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
        <button className="btn btn-primary btn-sm" disabled={!email || single.isPending}
          onClick={() => single.mutate()}>
          {single.isPending ? "Sending…" : "Create invitation · emails link"}
        </button>
      </div>
      <div className="mono-label" style={{ marginTop: 6 }}>Bulk CSV (one email per line)</div>
      <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4}
        placeholder={"alice@co.com\nbob@co.com"}
        style={{ ...input(), width: "100%", fontFamily: "var(--font-mono, monospace)" }} />
      <button className="btn btn-sm" disabled={!csv.trim() || bulk.isPending}
        style={{ alignSelf: "start" }} onClick={() => bulk.mutate()}>
        {bulk.isPending ? "Creating…" : "Create from CSV"}
      </button>
    </div>
  );
}

function InviteList() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fList = useServerFn(adminListInvitations);
  const fRevoke = useServerFn(adminRevokeInvitation);
  const list = useQuery({
    queryKey: ["admin-invitations"],
    queryFn: () => fList({ data: { state: null, limit: 100, offset: 0 } }),
  });
  const rows: AdminInvitation[] = Array.isArray(list.data) ? (list.data as AdminInvitation[]) : [];
  const revoke = useMutation({
    mutationFn: (id: string) => fRevoke({ data: { id } }),
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success("Invitation revoked");
      qc.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
  });

  return (
    <div className="bento" style={{ padding: 16 }}>
      <div className="mono-label" style={{ marginBottom: 8 }}>Invitations · {rows.length}</div>
      <table style={tableStyle}>
        <thead><tr className="mono-label" style={{ color: "var(--ink-subtle)" }}>
          <th style={th()}>Email</th><th style={th()}>Role</th><th style={th()}>State</th>
          <th style={th()}>Expires</th><th style={th()}></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid var(--hairline)" }}>
              <td style={td()}>{r.email}</td>
              <td style={td()}>{r.role}</td>
              <td style={td()}>{r.state}</td>
              <td style={td()}>{r.expires_at?.slice(0, 10)}</td>
              <td style={td()}>
                {r.state === "pending" ? (
                  <button className="btn btn-sm" disabled={revoke.isPending}
                    onClick={async () => {
                      const ok = await confirm({ title: "Revoke invitation?", body: `${r.email} will no longer be able to accept.`,
                        confirmLabel: "Revoke · invalidates link", destructive: true });
                      if (ok) revoke.mutate(r.id);
                    }}>Revoke</button>
                ) : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} style={{ padding: 12, textAlign: "center", color: "var(--ink-subtle)" }}>No invitations yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function DomainList() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fList = useServerFn(adminListAutoApproveDomains);
  const fUpsert = useServerFn(adminUpsertAutoApproveDomain);
  const fDelete = useServerFn(adminDeleteAutoApproveDomain);
  const list = useQuery({ queryKey: ["admin-domains"], queryFn: () => fList() });
  const rows: AutoApproveDomain[] = Array.isArray(list.data) ? (list.data as AutoApproveDomain[]) : [];

  const [domain, setDomain] = useState("");
  const [role, setRole] = useState("member");
  const upsert = useMutation({
    mutationFn: () => fUpsert({ data: { domain, workspaceId: null, role } }),
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success(`Auto-approve added · ${r.domain}`);
      setDomain("");
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-domains"] }),
  });

  return (
    <div className="bento" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div className="mono-label">Auto-approve email domains</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" style={input(200)} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={input(120)}>
          <option value="member">member</option><option value="admin">admin</option>
        </select>
        <button className="btn btn-sm" disabled={!domain || upsert.isPending} onClick={() => upsert.mutate()}>
          {upsert.isPending ? "Saving…" : "Add domain · auto-accepts signups"}
        </button>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--ink-subtle)", margin: 0 }}>No domains configured. All signups go to manual review.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {rows.map((d) => (
            <li key={d.id} style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "center" }}>
              <code>{d.domain}</code> · {d.default_role}
              <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={async () => {
                const ok = await confirm({ title: "Remove domain?", body: `Future signups from @${d.domain} go back to manual review.`, confirmLabel: "Remove", destructive: true });
                if (ok) del.mutate(d.id);
              }}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignupApprovalsList() {
  const qc = useQueryClient();
  const fList = useServerFn(adminListSignupApprovals);
  const fReview = useServerFn(adminReviewSignupApproval);
  const list = useQuery({ queryKey: ["admin-signup-approvals"], queryFn: () => fList({ data: { state: "pending" } }) });
  const rows: SignupApproval[] = Array.isArray(list.data) ? (list.data as SignupApproval[]) : [];

  const review = useMutation({
    mutationFn: (vars: { id: string; approve: boolean }) =>
      fReview({ data: { id: vars.id, approve: vars.approve, note: "" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-signup-approvals"] }),
  });

  return (
    <div className="bento" style={{ padding: 16 }}>
      <div className="mono-label" style={{ marginBottom: 8 }}>Pending signup approvals · {rows.length}</div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--ink-subtle)", margin: 0 }}>Nothing waiting.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {rows.map((s) => (
            <li key={s.id} style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "center" }}>
              {s.email} · {new Date(s.created_at).toLocaleDateString()}
              <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}
                onClick={() => review.mutate({ id: s.id, approve: true })}>Approve · grants access</button>
              <button className="btn btn-sm" onClick={() => review.mutate({ id: s.id, approve: false })}>Reject</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function input(width?: number): React.CSSProperties {
  return { padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: 6, background: "var(--canvas)", fontSize: 12.5, width };
}
function th(): React.CSSProperties { return { padding: "8px 10px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }; }
function td(): React.CSSProperties { return { padding: "10px", verticalAlign: "middle" }; }
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12.5 };