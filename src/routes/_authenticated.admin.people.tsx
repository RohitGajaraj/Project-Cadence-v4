/**
 * Admin Console v2 — People tab.
 * Step 2 ships the Users panel: search, drawer with identity + plan + credits
 * + workspaces + audit, and the core mutations (grant credits, reset cycle,
 * override plan, suspend/unsuspend). Invitations & Vouchers panels land in
 * subsequent steps of `docs/planning/admin-console-v2-plan.md`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/hooks/use-confirm";
import {
  adminSearchUsers,
  adminGetUserDetail,
  adminGrantCredits,
  adminResetCreditCycle,
  adminOverrideUserPlan,
  adminClearUserPlanOverride,
  adminSuspendUser,
  type AdminUserRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/people")({
  component: AdminPeople,
});

const SUB_TABS = [
  { id: "users", label: "Users" },
  { id: "invitations", label: "Invitations" },
  { id: "vouchers", label: "Vouchers" },
] as const;
type SubTab = (typeof SUB_TABS)[number]["id"];

function AdminPeople() {
  const [sub, setSub] = useState<SubTab>("users");
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
      <p className="mono-label" style={{ color: "var(--ink-subtle, #6b6457)", margin: 0 }}>
        Manage who can use Cadence · grant credits · run promo campaigns
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className="btn btn-sm"
            style={{
              background: sub === t.id ? "var(--surface-3, rgba(0,0,0,0.06))" : "transparent",
              fontWeight: sub === t.id ? 600 : 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === "users" ? <UsersPanel /> : sub === "invitations" ? <InvitationsPanel /> : <VouchersPanel />}
    </div>
  );
}

import { InvitationsPanel } from "@/components/admin/InvitationsPanel";
import { VouchersPanel } from "@/components/admin/VouchersPanel";

function UsersPanel() {
  const fSearch = useServerFn(adminSearchUsers);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const search = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => fSearch({ data: { q, limit: 50, offset: 0 } }),
  });

  const rows = useMemo<AdminUserRow[]>(() => {
    const d = search.data;
    if (!d || "error" in (d as object)) return [];
    return d as AdminUserRow[];
  }, [search.data]);

  return (
    <div className="bento" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email or display name…"
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "1px solid var(--hairline, rgba(0,0,0,0.12))",
            borderRadius: 6,
            background: "var(--canvas, #fbf7ef)",
            fontSize: 13,
          }}
        />
        <span className="mono-label" style={{ color: "var(--ink-subtle, #6b6457)" }}>
          {search.isLoading ? "Loading…" : `${rows.length} users`}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr className="mono-label" style={{ textAlign: "left", color: "var(--ink-subtle)" }}>
              <th style={th()}>Email</th>
              <th style={th()}>Name</th>
              <th style={th()}>Plan</th>
              <th style={th()}>Credits</th>
              <th style={th()}>Suspended</th>
              <th style={th()}>Joined</th>
              <th style={th()}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} style={{ borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))" }}>
                <td style={td()}>{r.email}</td>
                <td style={td()}>{r.display_name ?? "-"}</td>
                <td style={td()}>{r.plan_tier}</td>
                <td style={td()}>{r.balance_credits.toLocaleString()}</td>
                <td style={td()}>{r.suspended ? "yes" : "no"}</td>
                <td style={td()}>{new Date(r.created_at).toLocaleDateString()}</td>
                <td style={td()}>
                  <button className="btn btn-sm" onClick={() => setSelected(r.user_id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!search.isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "var(--ink-subtle)" }}>
                  No users match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <UserDrawer userId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function th(): React.CSSProperties {
  return { padding: "8px 10px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" };
}
function td(): React.CSSProperties {
  return { padding: "10px", verticalAlign: "middle" };
}

type UserDetail = {
  user?: { id: string; email: string; created_at: string; last_sign_in_at: string | null };
  profile?: { suspended?: boolean; display_name?: string };
  accounts?: Array<{ id: string; plan_tier: string; balance_credits: number; monthly_grant_credits: number; topup_credits: number }>;
  workspaces?: Array<{ id: string; name: string; role: string }>;
  subscription?: {
    plan_tier?: string;
    plan_override_tier?: string | null;
    plan_override_expires_at?: string | null;
    plan_override_reason?: string | null;
  };
  audit?: Array<{ id: string; action: string; payload: Record<string, unknown>; created_at: string }>;
};

function UserDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fDetail = useServerFn(adminGetUserDetail);
  const fGrant = useServerFn(adminGrantCredits);
  const fReset = useServerFn(adminResetCreditCycle);
  const fOverride = useServerFn(adminOverrideUserPlan);
  const fClear = useServerFn(adminClearUserPlanOverride);
  const fSuspend = useServerFn(adminSuspendUser);

  const detail = useQuery({
    queryKey: ["admin-user-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const r = await fDetail({ data: { userId: userId! } });
      if ("error" in r) throw new Error(r.error);
      return JSON.parse(r.json) as UserDetail;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const grant = useMutation({
    mutationFn: (vars: { delta: number; reason: string }) =>
      fGrant({ data: { userId: userId!, delta: vars.delta, reason: vars.reason } }),
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success(`Balance now ${r.balance.toLocaleString()}`);
      invalidate();
    },
  });
  const reset = useMutation({
    mutationFn: () => fReset({ data: { userId: userId! } }),
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success("Monthly cycle reset.");
      invalidate();
    },
  });
  const override = useMutation({
    mutationFn: (vars: { planTier: string; expiresAt: string | null; reason: string }) =>
      fOverride({ data: { userId: userId!, ...vars } }),
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success("Plan override saved.");
      invalidate();
    },
  });
  const clearOverride = useMutation({
    mutationFn: () => fClear({ data: { userId: userId! } }),
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success("Override cleared.");
      invalidate();
    },
  });
  const suspend = useMutation({
    mutationFn: (vars: { suspend: boolean; reason: string }) =>
      fSuspend({ data: { userId: userId!, ...vars } }),
    onSuccess: (r, vars) => {
      if ("error" in r) return toast.error(r.error);
      toast.success(vars.suspend ? "Account suspended." : "Account restored.");
      invalidate();
    },
  });

  const d = detail.data;

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" style={{ width: "min(560px, 100vw)", overflow: "auto" }}>
        <SheetHeader>
          <SheetTitle>{d?.user?.email ?? "User"}</SheetTitle>
        </SheetHeader>
        {detail.isLoading ? (
          <p style={{ marginTop: 16, fontSize: 13 }}>Loading…</p>
        ) : !d ? null : (
          <div style={{ marginTop: 16, display: "grid", gap: 18 }}>
            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Identity</div>
              <div style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                <div>Name · {d.profile?.display_name ?? "-"}</div>
                <div>Joined · {d.user?.created_at?.slice(0, 10)}</div>
                <div>Last sign-in · {d.user?.last_sign_in_at?.slice(0, 10) ?? "never"}</div>
                <div>Suspended · {d.profile?.suspended ? "yes" : "no"}</div>
              </div>
            </section>

            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Plan & override</div>
              {d.subscription ? (
                <div style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <div>Base plan · {d.subscription.plan_tier ?? "-"}</div>
                  <div>Override tier · {d.subscription.plan_override_tier ?? "-"}</div>
                  <div>Override expires · {d.subscription.plan_override_expires_at?.slice(0, 10) ?? "-"}</div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--ink-subtle)" }}>No subscription row.</p>
              )}
              <PlanOverrideForm
                pending={override.isPending}
                onSubmit={(planTier, days, reason) => {
                  const expiresAt = days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null;
                  override.mutate({ planTier, expiresAt, reason });
                }}
                onClear={() => clearOverride.mutate()}
                clearPending={clearOverride.isPending}
              />
            </section>

            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Credits</div>
              {(d.accounts ?? []).map((a) => (
                <div key={a.id} style={{ fontSize: 12.5 }}>
                  Account {a.id.slice(0, 8)} · balance {a.balance_credits.toLocaleString()} · cycle {a.monthly_grant_credits.toLocaleString()} · topup {a.topup_credits.toLocaleString()}
                </div>
              ))}
              <GrantCreditsForm
                pending={grant.isPending}
                onSubmit={(delta, reason) => grant.mutate({ delta, reason })}
              />
              <button
                className="btn btn-sm"
                style={{ marginTop: 8 }}
                disabled={reset.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Reset monthly cycle?",
                    body: "Clears this month's grant counter. One-time top-ups are preserved.",
                    confirmLabel: "Reset cycle",
                  });
                  if (ok) reset.mutate();
                }}
              >
                Reset monthly cycle
              </button>
            </section>

            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Workspaces</div>
              {(d.workspaces ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--ink-subtle)" }}>Not in any workspaces.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5 }}>
                  {(d.workspaces ?? []).map((w) => (
                    <li key={w.id}>
                      {w.name} · <span style={{ color: "var(--ink-subtle)" }}>{w.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Access</div>
              <button
                className="btn btn-sm"
                disabled={suspend.isPending}
                onClick={async () => {
                  const isSuspended = d.profile?.suspended;
                  const ok = await confirm({
                    title: isSuspended ? "Restore sign-in?" : "Suspend sign-in?",
                    body: isSuspended
                      ? "User regains the ability to sign in."
                      : "User is blocked from new sign-ins. Existing sessions stay until they expire.",
                    confirmLabel: isSuspended ? "Restore · allows sign-in" : "Suspend · blocks sign-in",
                    destructive: !isSuspended,
                  });
                  if (ok) suspend.mutate({ suspend: !isSuspended, reason: "" });
                }}
              >
                {d.profile?.suspended ? "Restore · allows sign-in" : "Suspend · blocks sign-in"}
              </button>
            </section>

            <section>
              <div className="mono-label" style={{ marginBottom: 6 }}>Recent audit</div>
              {(d.audit ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--ink-subtle)" }}>No prior admin actions.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                  {(d.audit ?? []).slice(0, 10).map((row) => (
                    <li key={row.id}>
                      <code>{row.action}</code> · {row.created_at.slice(0, 16).replace("T", " ")}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function GrantCreditsForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (delta: number, reason: string) => void;
}) {
  const [delta, setDelta] = useState(100);
  const [reason, setReason] = useState("Admin grant");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!Number.isFinite(delta) || delta === 0) return;
        onSubmit(Math.trunc(delta), reason || "Admin grant");
      }}
      style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}
    >
      <input
        type="number"
        value={delta}
        onChange={(e) => setDelta(Number(e.target.value))}
        style={{ width: 100, padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12.5 }}
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        style={{ flex: 1, minWidth: 160, padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12.5 }}
      />
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "Granting…" : `Grant ${delta} · adds to balance`}
      </button>
    </form>
  );
}

function PlanOverrideForm({
  pending,
  onSubmit,
  onClear,
  clearPending,
}: {
  pending: boolean;
  onSubmit: (planTier: string, days: number, reason: string) => void;
  onClear: () => void;
  clearPending: boolean;
}) {
  const [tier, setTier] = useState("max");
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(tier, days, reason);
      }}
      style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}
    >
      <select
        value={tier}
        onChange={(e) => setTier(e.target.value)}
        style={{ padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12.5 }}
      >
        <option value="free">free</option>
        <option value="pro">pro</option>
        <option value="max">max</option>
        <option value="team">team</option>
        <option value="enterprise">enterprise</option>
      </select>
      <input
        type="number"
        value={days}
        min={0}
        onChange={(e) => setDays(Number(e.target.value))}
        style={{ width: 80, padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12.5 }}
      />
      <span style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>days (0 = no expiry)</span>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        style={{ flex: 1, minWidth: 160, padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12.5 }}
      />
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "Saving…" : "Override · temporary plan"}
      </button>
      <button type="button" className="btn btn-sm" onClick={onClear} disabled={clearPending}>
        Clear override
      </button>
    </form>
  );
}