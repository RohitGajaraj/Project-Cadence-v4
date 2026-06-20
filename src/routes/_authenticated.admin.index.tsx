/**
 * Admin overview:
 *   - Credits engine toggle
 *   - Admin role manager
 *   - Users table (search by email, grant extra credits inline)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Coins, ShieldCheck, Search } from "lucide-react";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/hooks/use-confirm";
import {
  getPricingCatalog,
  adminSetCreditsEnabled,
  adminListAdmins,
  adminAddAdminByEmail,
  adminRemoveAdmin,
  adminListUsers,
  adminGrantCredits,
} from "@/lib/pricing.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fGetCatalog = useServerFn(getPricingCatalog);
  const fSetFlag = useServerFn(adminSetCreditsEnabled);
  const fListAdmins = useServerFn(adminListAdmins);
  const fAddAdmin = useServerFn(adminAddAdminByEmail);
  const fRemoveAdmin = useServerFn(adminRemoveAdmin);

  const catalog = useQuery({ queryKey: ["pricing-catalog"], queryFn: () => fGetCatalog() });
  const admins = useQuery({ queryKey: ["admin-list"], queryFn: () => fListAdmins() });

  const setFlag = useMutation({
    mutationFn: (enabled: boolean) => fSetFlag({ data: { enabled } }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Credits engine updated.");
      qc.invalidateQueries({ queryKey: ["pricing-catalog"] });
    },
  });

  const [adminEmail, setAdminEmail] = useState("");
  const addAdmin = useMutation({
    mutationFn: () => fAddAdmin({ data: { email: adminEmail } }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Admin added.");
      setAdminEmail("");
      qc.invalidateQueries({ queryKey: ["admin-list"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const removeAdmin = useMutation({
    mutationFn: (user_id: string) => fRemoveAdmin({ data: { user_id } }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Admin removed.");
      qc.invalidateQueries({ queryKey: ["admin-list"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const enabled = catalog.data?.creditsEnabled ?? false;
  const adminList = Array.isArray(admins.data) ? admins.data : [];

  async function onRemoveAdminClick(user_id: string, email: string) {
    const ok = await confirm({
      title: `Remove ${email} as admin?`,
      body: "They will lose access to the admin console immediately.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (ok) removeAdmin.mutate(user_id);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Credits engine */}
      <div className="bento" style={{ padding: 22, display: "grid", gap: 12 }}>
        <SectionHeader icon={<Coins size={14} />} label="Credits engine" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div>
            <div className="font-display" style={{ fontSize: 18 }}>
              Metering is {enabled ? "ON" : "OFF"}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-muted, #4a4438)", margin: "4px 0 0", maxWidth: 540 }}>
              When ON, AI calls debit credits from the user's monthly grant and top-up balance.
              Top-ups are always recorded; metering only applies once this toggle is on.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={setFlag.isPending || catalog.isLoading}
            onClick={() => setFlag.mutate(!enabled)}
          >
            {setFlag.isPending ? "Updating…" : enabled ? "Turn OFF" : "Turn ON"}
          </button>
        </div>
      </div>

      {/* Admins */}
      <div className="bento" style={{ padding: 22, display: "grid", gap: 14 }}>
        <SectionHeader icon={<ShieldCheck size={14} />} label="Admins" />
        <form
          onSubmit={(e) => { e.preventDefault(); if (adminEmail.trim()) addAdmin.mutate(); }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input
            type="email"
            placeholder="email@cadence.app"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            style={inputStyle({ flex: "1 1 280px" })}
          />
          <button className="btn btn-primary btn-sm" disabled={addAdmin.isPending || !adminEmail.trim()}>
            {addAdmin.isPending ? "Adding…" : "Add admin"}
          </button>
        </form>
        <div style={{ display: "grid", gap: 0 }}>
          {admins.isLoading ? (
            <div style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>Loading…</div>
          ) : adminList.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>No admins yet.</div>
          ) : (
            adminList.map((a) => (
              <div
                key={a.user_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.06))",
                }}
              >
                <div style={{ fontSize: 13 }}>{a.email}</div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onRemoveAdminClick(a.user_id, a.email)}
                  disabled={removeAdmin.isPending || adminList.length <= 1}
                  title={adminList.length <= 1 ? "Cannot remove the last admin" : undefined}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Users + grant credits */}
      <UsersPanel />
    </div>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const fListUsers = useServerFn(adminListUsers);
  const fGrant = useServerFn(adminGrantCredits);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => fListUsers({ data: { search } }),
  });

  const grant = useMutation({
    mutationFn: (vars: { user_id: string; credits: number; reason: string }) =>
      fGrant({ data: vars }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(`Granted. New balance: ${res.new_balance.toLocaleString()} credits.`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setExpanded(null);
    },
  });

  const rows = Array.isArray(users.data) ? users.data : [];

  return (
    <div className="bento" style={{ padding: 22, display: "grid", gap: 14 }}>
      <SectionHeader
        icon={<Users size={14} />}
        label="Users"
        right={
          <span className="mono-label" style={{ fontSize: 9, color: "var(--ink-subtle)" }}>
            {rows.length} {rows.length === 1 ? "user" : "users"}
          </span>
        }
      />

      <form
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
        style={{ display: "flex", gap: 8, alignItems: "center" }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: 9, color: "var(--ink-subtle)" }} />
          <input
            type="search"
            placeholder="Search by email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={inputStyle({ width: "100%", paddingLeft: 28 })}
          />
        </div>
        <button className="btn btn-ghost btn-sm" type="submit">Search</button>
      </form>

      <div
        className="mono-label"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 90px 110px",
          gap: 8,
          fontSize: 9,
          color: "var(--ink-faint)",
          padding: "0 8px",
        }}
      >
        <span>Email</span>
        <span>Plan</span>
        <span>Credits</span>
        <span>Role</span>
        <span></span>
      </div>

      <div style={{ display: "grid", gap: 0 }}>
        {users.isLoading ? (
          <div style={{ fontSize: 12, padding: "8px 10px", color: "var(--ink-subtle)" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, padding: "8px 10px", color: "var(--ink-subtle)" }}>No users found.</div>
        ) : (
          rows.map((u) => {
            const isOpen = expanded === u.user_id;
            return (
              <div key={u.user_id} style={{ borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.06))" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 90px 110px",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 10px",
                    fontSize: 13,
                  }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.email || "(no email)"}
                  </div>
                  <div className="mono-label" style={{ fontSize: 10 }}>{u.plan_tier}</div>
                  <div style={{ fontSize: 12 }}>
                    {u.balance_credits.toLocaleString()}
                    {u.topup_credits > 0 ? (
                      <span style={{ color: "var(--ink-subtle)", marginLeft: 6, fontSize: 10 }}>
                        (+{u.topup_credits.toLocaleString()} top-up)
                      </span>
                    ) : null}
                  </div>
                  <div>
                    {u.is_admin ? (
                      <span
                        className="mono-label"
                        style={{
                          fontSize: 9,
                          color: "var(--canvas, #fbf7ef)",
                          background: "var(--ember, #c2602e)",
                          padding: "2px 8px",
                          borderRadius: 99,
                        }}
                      >
                        Admin
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--ink-subtle)" }}>Member</span>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setExpanded(isOpen ? null : u.user_id)}
                    disabled={!u.primary_account_id}
                    title={!u.primary_account_id ? "User has no workspace yet" : undefined}
                    style={{ fontSize: 11, padding: "4px 8px" }}
                  >
                    {isOpen ? "Cancel" : "Grant credits"}
                  </button>
                </div>
                {isOpen && u.primary_account_id ? (
                  <GrantForm
                    pending={grant.isPending}
                    onSubmit={(credits, reason) =>
                      grant.mutate({ user_id: u.user_id, credits, reason })
                    }
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function GrantForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (credits: number, reason: string) => void;
}) {
  const [credits, setCredits] = useState<number>(2000);
  const [reason, setReason] = useState<string>("enterprise_grant");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!credits) return;
        onSubmit(credits, reason.trim() || "admin_grant");
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr 110px",
        gap: 8,
        padding: "10px 14px 14px",
        background: "color-mix(in oklab, var(--ember, #c2602e) 4%, transparent)",
        alignItems: "end",
      }}
    >
      <label style={{ display: "grid", gap: 4 }}>
        <span className="mono-label" style={{ fontSize: 9 }}>Credits</span>
        <input
          type="number"
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value))}
          style={inputStyle()}
        />
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span className="mono-label" style={{ fontSize: 9 }}>Reason / memo</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={inputStyle()}
          placeholder="enterprise_grant, demo_topup, refund…"
        />
      </label>
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !credits}>
        {pending ? "Granting…" : "Grant"}
      </button>
    </form>
  );
}

function SectionHeader({
  icon,
  label,
  right,
}: {
  icon?: React.ReactNode;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
      <div className="mono-label" style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <span>{label}</span>
      </div>
      {right}
    </div>
  );
}

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: "7px 10px",
    border: "1px solid var(--hairline, rgba(0,0,0,0.12))",
    borderRadius: 8,
    fontSize: 13,
    background: "var(--canvas, #fbf7ef)",
    color: "var(--ink, #1d1a14)",
    ...extra,
  };
}
