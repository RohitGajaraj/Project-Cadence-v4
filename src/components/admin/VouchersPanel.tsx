/**
 * People · Vouchers panel: create / list / deactivate vouchers, view
 * redemptions per voucher.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/hooks/use-confirm";
import {
  adminListVouchers,
  adminCreateVoucher,
  adminDeactivateVoucher,
  adminListVoucherRedemptions,
  type AdminVoucher,
} from "@/lib/admin-vouchers.functions";

export function VouchersPanel() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fList = useServerFn(adminListVouchers);
  const fDeact = useServerFn(adminDeactivateVoucher);
  const list = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: () => fList({ data: { active: null } }),
  });
  const rows: AdminVoucher[] = Array.isArray(list.data) ? (list.data as AdminVoucher[]) : [];
  const [openId, setOpenId] = useState<string | null>(null);

  const deactivate = useMutation({
    mutationFn: (id: string) => fDeact({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vouchers"] }),
  });

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <VoucherCreator />
      <div className="bento" style={{ padding: 16 }}>
        <div className="mono-label" style={{ marginBottom: 8 }}>
          Vouchers · {rows.length}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr className="mono-label" style={{ color: "var(--ink-subtle)" }}>
              <th style={th()}>Code</th>
              <th style={th()}>Kind</th>
              <th style={th()}>Plan</th>
              <th style={th()}>Credits</th>
              <th style={th()}>Used / Max</th>
              <th style={th()}>Expires</th>
              <th style={th()}>Active</th>
              <th style={th()}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                <td style={td()}>
                  <code>{v.code}</code>
                </td>
                <td style={td()}>{v.kind}</td>
                <td style={td()}>{v.plan_tier ?? "-"}</td>
                <td style={td()}>{v.credits ?? "-"}</td>
                <td style={td()}>
                  {v.redemptions_count} / {v.max_redemptions ?? "∞"}
                </td>
                <td style={td()}>{v.expires_at?.slice(0, 10) ?? "-"}</td>
                <td style={td()}>{v.active ? "yes" : "no"}</td>
                <td style={td()}>
                  <button className="btn btn-sm" onClick={() => setOpenId(v.id)}>
                    Redemptions
                  </button>
                  {v.active ? (
                    <button
                      className="btn btn-sm"
                      style={{ marginLeft: 6 }}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Deactivate voucher?",
                          body: `${v.code} can no longer be redeemed. Existing redemptions are kept.`,
                          confirmLabel: "Deactivate",
                          destructive: true,
                        });
                        if (ok) deactivate.mutate(v.id);
                      }}
                    >
                      Deactivate
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: 12, textAlign: "center", color: "var(--ink-subtle)" }}
                >
                  No vouchers yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <RedemptionsDrawer voucherId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function VoucherCreator() {
  const qc = useQueryClient();
  const fCreate = useServerFn(adminCreateVoucher);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"signup" | "credit_grant" | "plan_upgrade">("credit_grant");
  const [planTier, setPlanTier] = useState("");
  const [credits, setCredits] = useState<number | "">("");
  const [autoLogin, setAutoLogin] = useState(false);
  const [maxRedemptions, setMaxRedemptions] = useState<number | "">("");
  const [days, setDays] = useState<number | "">(30);
  const [tag, setTag] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const expiresAt =
        days && Number(days) > 0
          ? new Date(Date.now() + Number(days) * 86400_000).toISOString()
          : null;
      return fCreate({
        data: {
          code,
          kind,
          planTier: planTier || null,
          credits: credits === "" ? null : Number(credits),
          autoLogin,
          maxRedemptions: maxRedemptions === "" ? null : Number(maxRedemptions),
          expiresAt,
          campaignTag: tag || null,
        },
      });
    },
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success(`Voucher ${r.code} created`);
      setCode("");
      setCredits("");
      setMaxRedemptions("");
      setTag("");
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
  });

  return (
    <div className="bento" style={{ padding: 16, display: "grid", gap: 8 }}>
      <div className="mono-label">New voucher</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="LAUNCH50"
          style={input(140)}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          style={input(140)}
        >
          <option value="credit_grant">credit_grant</option>
          <option value="plan_upgrade">plan_upgrade</option>
          <option value="signup">signup</option>
        </select>
        <input
          value={planTier}
          onChange={(e) => setPlanTier(e.target.value)}
          placeholder="plan tier"
          style={input(120)}
        />
        <input
          type="number"
          value={credits}
          onChange={(e) => setCredits(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="credits"
          style={input(100)}
        />
        <input
          type="number"
          value={maxRedemptions}
          onChange={(e) => setMaxRedemptions(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="max uses"
          style={input(100)}
        />
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="days"
          style={input(80)}
        />
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="campaign tag"
          style={input(140)}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={autoLogin}
            onChange={(e) => setAutoLogin(e.target.checked)}
          />{" "}
          auto-login (signup)
        </label>
        <button
          className="btn btn-primary btn-sm"
          disabled={!code || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Creating…" : "Create voucher"}
        </button>
      </div>
    </div>
  );
}

function RedemptionsDrawer({
  voucherId,
  onClose,
}: {
  voucherId: string | null;
  onClose: () => void;
}) {
  const fList = useServerFn(adminListVoucherRedemptions);
  const list = useQuery({
    queryKey: ["admin-voucher-redemptions", voucherId],
    enabled: !!voucherId,
    queryFn: () => fList({ data: { voucherId: voucherId! } }),
  });
  const rows = Array.isArray(list.data) ? list.data : [];

  return (
    <Sheet open={!!voucherId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" style={{ width: "min(480px, 100vw)", overflow: "auto" }}>
        <SheetHeader>
          <SheetTitle>Redemptions</SheetTitle>
        </SheetHeader>
        <ul
          style={{
            marginTop: 12,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 6,
            fontSize: 12.5,
          }}
        >
          {rows.length === 0 ? (
            <li style={{ color: "var(--ink-subtle)" }}>No redemptions yet.</li>
          ) : null}
          {rows.map((r) => (
            <li key={r.id}>
              {r.user_email ?? r.user_id} · {new Date(r.redeemed_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function input(width?: number): React.CSSProperties {
  return {
    padding: "6px 8px",
    border: "1px solid var(--hairline)",
    borderRadius: 6,
    background: "var(--canvas)",
    fontSize: 12.5,
    width,
  };
}
function th(): React.CSSProperties {
  return { padding: "8px 10px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" };
}
function td(): React.CSSProperties {
  return { padding: "10px", verticalAlign: "middle" };
}
