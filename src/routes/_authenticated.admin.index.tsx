/**
 * Admin overview: credits engine toggle + admin user management.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/hooks/use-confirm";
import {
  getPricingCatalog,
  adminSetCreditsEnabled,
  adminListAdmins,
  adminAddAdminByEmail,
  adminRemoveAdmin,
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
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Credits engine updated.");
      qc.invalidateQueries({ queryKey: ["pricing-catalog"] });
    },
  });

  const [email, setEmail] = useState("");
  const addAdmin = useMutation({
    mutationFn: () => fAddAdmin({ data: { email } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Admin added.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-list"] });
    },
  });

  const removeAdmin = useMutation({
    mutationFn: (user_id: string) => fRemoveAdmin({ data: { user_id } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Admin removed.");
      qc.invalidateQueries({ queryKey: ["admin-list"] });
    },
  });

  const enabled = catalog.data?.creditsEnabled ?? false;
  const adminList = Array.isArray(admins.data) ? admins.data : [];

  async function onRemoveClick(user_id: string, email: string) {
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
      <div className="bento" style={{ padding: 22, display: "grid", gap: 12 }}>
        <div className="mono-label" style={{ fontSize: 9 }}>Credits engine</div>
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

      <div className="bento" style={{ padding: 22, display: "grid", gap: 14 }}>
        <div className="mono-label" style={{ fontSize: 9 }}>Admins</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) addAdmin.mutate();
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input
            type="email"
            placeholder="email@cadence.app"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              flex: "1 1 280px",
              padding: "7px 10px",
              border: "1px solid var(--hairline, rgba(0,0,0,0.12))",
              borderRadius: 8,
              fontSize: 13,
              background: "var(--canvas, #fbf7ef)",
            }}
          />
          <button className="btn btn-primary btn-sm" disabled={addAdmin.isPending || !email.trim()}>
            {addAdmin.isPending ? "Adding…" : "Add admin"}
          </button>
        </form>

        <div style={{ display: "grid", gap: 6 }}>
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
                  onClick={() => onRemoveClick(a.user_id, a.email)}
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
    </div>
  );
}