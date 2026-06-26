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
 * WM-M14 + WM-M19: owner-only spend-cap surface.
 *
 * Two scopes:
 *   Product — cap how many credits a product draws per window (original WM-M14).
 *   Member  — cap how many credits a team member can use per window (WM-M19 enterprise surface).
 *
 * Renders nothing for non-owners (RLS also rejects their writes). Inert while dormant.
 */
export function CreditCapsCard() {
  const qc = useQueryClient();
  const fGet = useServerFn(getCreditCaps);
  const fSet = useServerFn(setCreditCap);
  const fRemove = useServerFn(removeCreditCap);
  const caps = useQuery({ queryKey: ["credit-caps"], queryFn: () => fGet() });

  // Product cap form state.
  const [productId, setProductId] = useState("");
  const [productAmount, setProductAmount] = useState("");
  const [productWindow, setProductWindow] = useState<WindowKind>("cycle");

  // Member cap form state (WM-M19).
  const [memberId, setMemberId] = useState("");
  const [memberAmount, setMemberAmount] = useState("");
  const [memberWindow, setMemberWindow] = useState<WindowKind>("cycle");

  const setMut = useMutation({
    mutationFn: (v: {
      scope: "product" | "member";
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
      setProductAmount("");
      setMemberId("");
      setMemberAmount("");
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
  if (!data || !data.isOwner) return null;

  const productCaps = data.caps.filter((c) => c.scope === "product");
  const memberCaps = data.caps.filter((c) => c.scope === "member");
  const winLabel = (w: string) => WINDOWS.find((x) => x.id === w)?.label ?? w;

  function addProductCap() {
    const n = parseInt(productAmount, 10);
    if (!productId) {
      toast.error("Pick a product to cap.");
      return;
    }
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a credit amount (0 or more).");
      return;
    }
    setMut.mutate({
      scope: "product",
      targetId: productId,
      capCredits: n,
      windowKind: productWindow,
    });
  }

  function addMemberCap() {
    const n = parseInt(memberAmount, 10);
    if (!memberId) {
      toast.error("Pick a team member to cap.");
      return;
    }
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a credit amount (0 or more).");
      return;
    }
    setMut.mutate({ scope: "member", targetId: memberId, capCredits: n, windowKind: memberWindow });
  }

  return (
    <div className="bento" style={{ padding: "var(--card-pad, 18px)", display: "grid", gap: 20 }}>
      {/* ---- Per-product caps ---- */}
      <div>
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Per-product spending caps
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", margin: "6px 0 0" }}>
          Cap how many credits a product can spend per window. Takes effect once metering is on.
        </p>

        {productCaps.length > 0 && (
          <ul
            style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}
          >
            {productCaps.map((c) => (
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
            value={productAmount}
            onChange={(e) => setProductAmount(e.target.value)}
            style={{ ...fieldStyle, width: 110 }}
            aria-label="Cap amount in credits"
          />
          <select
            value={productWindow}
            onChange={(e) => setProductWindow(e.target.value as WindowKind)}
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
            onClick={addProductCap}
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

      {/* ---- Per-member caps (WM-M19: enterprise admin allocation) ---- */}
      <div
        style={{
          paddingTop: 16,
          borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))",
        }}
      >
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Per-member credit allocation
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", margin: "6px 0 0" }}>
          Set how many credits each team member can use per window. Business and Enterprise.
        </p>

        {memberCaps.length > 0 && (
          <ul
            style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}
          >
            {memberCaps.map((c) => (
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
                <span style={{ flex: 1, color: "var(--ink, #1d1a14)" }}>
                  {/* Attempt to resolve userId to a label from the members list */}
                  {data.members.find((m) => m.userId === c.targetId)?.label ??
                    c.targetId?.slice(0, 8) ??
                    "Unknown member"}
                </span>
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
          {data.members.length > 0 ? (
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              style={{ ...fieldStyle, minWidth: 200 }}
              aria-label="Member to cap"
            >
              <option value="">Select a member…</option>
              {data.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Member user ID"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              style={{ ...fieldStyle, minWidth: 200 }}
              aria-label="Member user ID"
            />
          )}
          <input
            type="number"
            min={0}
            placeholder="credits"
            value={memberAmount}
            onChange={(e) => setMemberAmount(e.target.value)}
            style={{ ...fieldStyle, width: 110 }}
            aria-label="Member cap amount in credits"
          />
          <select
            value={memberWindow}
            onChange={(e) => setMemberWindow(e.target.value as WindowKind)}
            style={fieldStyle}
            aria-label="Member cap window"
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
            onClick={addMemberCap}
            disabled={setMut.isPending}
          >
            Set limit
          </button>
        </div>

        {data.members.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--ink-faint, #8a8377)", margin: "8px 0 0" }}>
            Invite team members to set per-member credit limits.
          </p>
        )}
      </div>
    </div>
  );
}
