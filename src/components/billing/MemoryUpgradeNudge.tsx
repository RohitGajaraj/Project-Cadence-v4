import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getBillingState } from "@/lib/billing.functions";
import { FREE_MEMORY_RETENTION_DAYS } from "@/lib/entitlements";

const DISMISS_KEY = "cadence:memory-nudge-until";
const SNOOZE_MS = 14 * 86_400_000; // re-surface after two weeks, never nag

/**
 * WM-M7: a value-framed upgrade nudge shown to FREE-tier users where decision memory
 * matters most (the Brain). Free memory fades after FREE_MEMORY_RETENTION_DAYS; this makes
 * the "free to start, pay to keep your memory" moat felt at the relevant moment instead of
 * as a generic upsell. Calm and dismissible (snoozes two weeks), and it renders NOTHING for
 * paid tiers (the moat is already theirs) or while the tier is unknown - so it never nags or
 * flickers. Engine-Room compliant: states the outcome ("keep your memory"), not a hard sell.
 */
export function MemoryUpgradeNudge() {
  const fGetBilling = useServerFn(getBillingState);
  const billing = useQuery({
    queryKey: ["billing-state"],
    queryFn: () => fGetBilling(),
    staleTime: 5 * 60 * 1000,
  });

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() < until;
  });

  const tier = billing.data?.planTier ?? null;
  if (dismissed || tier !== "free") return null;

  function snooze() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* private mode: just hide for this session */
    }
    setDismissed(true);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px 14px",
        marginBottom: 18,
        borderRadius: 10,
        border: "1px solid color-mix(in oklab, var(--ember, #c2602e) 35%, transparent)",
        background: "color-mix(in oklab, var(--ember, #c2602e) 6%, var(--canvas, #fbf7ef))",
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1.45, color: "var(--ink, #1d1a14)", flex: 1 }}>
        On Star, your decision memory fades after {FREE_MEMORY_RETENTION_DAYS} days. Upgrade to keep
        every decision compounding instead of expiring.
      </span>
      <a
        href="/pricing"
        className="btn btn-primary btn-sm"
        style={{ textDecoration: "none", whiteSpace: "nowrap" }}
      >
        Keep my memory →
      </a>
      <button
        type="button"
        onClick={snooze}
        aria-label="Dismiss"
        title="Dismiss"
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--ink-subtle, #6b6457)",
          fontSize: 16,
          lineHeight: 1,
          padding: 2,
        }}
      >
        ×
      </button>
    </div>
  );
}
