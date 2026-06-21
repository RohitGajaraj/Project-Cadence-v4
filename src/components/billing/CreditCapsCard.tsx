import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getCreditCaps, setCreditCap, removeCreditCap } from "@/lib/payments.functions";

const WINDOWS = [
  { id: "cycle", label: "per cycle" },
  { id: "month", label: "per month" },
  { id: "day", label: "per day" },
] as const;
type WindowKind = (typeof WINDOWS)[number]["id"];

const fieldStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--hairline, rgba(0,0,0,0.14))",
  background: "var(--canvas, #fbf7ef)",
  fontSize: 13,
  color: "var(--ink, #1d1a14)",
};

/**
 * WM-M14: owner-only per-product spend caps. Lets the account owner cap how many credits a
 * product can draw per window; assertCreditCaps enforces it on the hot path once metering is
 * on. Renders nothing for non-owners (RLS also rejects their writes). Inert while dormant.
 */
export function CreditCapsCard() {
  const qc = useQueryClient();
  const fGet = useServerFn(getCreditCaps);
  const fSet = useServerFn(setCreditCap);
  const fRemove = useServerFn(removeCreditCap);
  const caps = useQuery({ queryKey: ["credit-caps"], queryFn: () => fGet() });

  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [windowKind, setWindowKind] = useState<WindowKind>("cycle");

  const setMut = useMutation({
    mutationFn: (v: {
      scope: "product";
      targetId: string;
      capCredits: number;
      windowKind: WindowKind;
    }) => fSet({ data: v }),
    onSuccess: (r) => {
      if (r && "error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Cap saved");
      setProductId("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["credit-caps"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save cap"),
  });
  const rmMut = useMutation({
    mutationFn: (id: string) => fRemove({ data: { id } }),
    onSuccess: () => {
      toast.success("Cap removed");
      qc.invalidateQueries({ queryKey: ["credit-caps"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove cap"),
  });

  const data = caps.data;
  if (!data || !data.isOwner) return null; // owner-only surface

  function add() {
    const n = parseInt(amount, 10);
    if (!productId) {
      toast.error("Pick a product to cap.");
      return;
    }
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a credit amount (0 or more).");
      return;
    }
    setMut.mutate({ scope: "product", targetId: productId, capCredits: n, windowKind });
  }

  const winLabel = (w: string) => WINDOWS.find((x) => x.id === w)?.label ?? w;

  return (
    <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
      <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
        Spending caps
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", margin: "6px 0 0" }}>
        Cap how many credits a product can spend per window. Takes effect once metering is on.
      </p>

      {data.caps.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
          {data.caps.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--canvas, #fbf7ef)",
                border: "1px solid var(--hairline, rgba(0,0,0,0.08))",
                fontSize: 12.5,
              }}
            >
              <span style={{ flex: 1, color: "var(--ink, #1d1a14)" }}>{c.targetName}</span>
              <span style={{ color: "var(--ink-subtle, #6b6457)" }}>
                {c.capCredits.toLocaleString()} credits {winLabel(c.windowKind)}
                {c.enabled ? "" : " · off"}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => rmMut.mutate(c.id)}
                disabled={rmMut.isPending}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}
      >
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{ ...fieldStyle, minWidth: 160 }}
          aria-label="Product to cap"
        >
          <option value="">Select a product…</option>
          {data.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          placeholder="credits"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...fieldStyle, width: 110 }}
          aria-label="Cap amount in credits"
        />
        <select
          value={windowKind}
          onChange={(e) => setWindowKind(e.target.value as WindowKind)}
          style={fieldStyle}
          aria-label="Cap window"
        >
          {WINDOWS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={add}
          disabled={setMut.isPending}
        >
          Add cap
        </button>
      </div>

      {data.products.length === 0 && (
        <p style={{ fontSize: 11, color: "var(--ink-faint, #8a8377)", margin: "8px 0 0" }}>
          Add a product first to set a per-product cap.
        </p>
      )}
    </div>
  );
}
