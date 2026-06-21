// Redeem-a-code card (Settings > Credits). The user-facing entry point for the
// voucher engine — without it, redeemVoucher had zero callers and the whole
// voucher feature was admin-create-only. Account scope per the settings-IA
// rubric (vouchers grant account credits / a plan override). Calls the existing
// auth-gated redeemVoucher server fn; on success it invalidates the credits
// query so the new balance shows immediately.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { redeemVoucher } from "@/lib/admin-vouchers.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import { toast } from "@/lib/notify";

export function RedeemCodeCard() {
  const fRedeem = useServerFn(redeemVoucher);
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const redeem = useMutation({
    mutationFn: (c: string) => fRedeem({ data: { code: c.trim() } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.error ?? "Could not redeem this code.");
        return;
      }
      if (r.kind === "plan_upgrade" || (r.plan_tier && !r.credits)) {
        toast.success(`Plan unlocked${r.plan_tier ? `: ${r.plan_tier}` : ""}.`);
      } else if (r.credits && r.credits > 0) {
        toast.success(`Redeemed — ${r.credits.toLocaleString()} credits added.`);
      } else {
        toast.success("Code redeemed.");
      }
      setCode("");
      // Refresh balance + attribution so the granted credits show immediately.
      qc.invalidateQueries({ queryKey: ["my-credits"] });
      qc.invalidateQueries({ queryKey: ["credit-attribution"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
      <MonoLabel icon={Gift}>Redeem a code</MonoLabel>
      <p style={{ margin: "6px 0 10px", fontSize: 12.5, color: "var(--ink-muted, #6b6457)" }}>
        Have a promo or credit code? Enter it to add credits or unlock a plan.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Enter code"
          value={code}
          maxLength={64}
          style={{ flex: 1, minWidth: 160, textTransform: "uppercase" }}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim() && !redeem.isPending) redeem.mutate(code);
          }}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!code.trim() || redeem.isPending}
          onClick={() => redeem.mutate(code)}
        >
          {redeem.isPending ? "Redeeming…" : "Redeem"}
        </button>
      </div>
    </div>
  );
}
