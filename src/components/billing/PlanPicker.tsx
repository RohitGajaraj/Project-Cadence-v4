/**
 * Plan picker: tier toggle (Pro / Cluster · Max / Constellation · Team /
 * Galaxy) + Monthly/Yearly switch + a credit-bundle slider that snaps to the
 * credit points the founder publishes (driven by `pricing_bundles`). Picking
 * a point and clicking Subscribe opens the existing embedded Stripe checkout
 * with the bundle's Stripe lookup_key.
 *
 * Enterprise is intentionally a "Talk to us" card next to the picker, not a
 * slider entry.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Slider } from "@/components/ui/slider";
import { StripeEmbeddedCheckout } from "@/components/billing/StripeEmbeddedCheckout";
import { toast } from "@/lib/notify";
import { getStripeEnvironment } from "@/lib/stripe";
import { getPricingCatalog, type PricingBundle } from "@/lib/pricing.functions";
import { lookupKeyFor } from "@/lib/billing-tier";
import type { PlanTier } from "@/lib/entitlements";

type PickerTier = "pro" | "max" | "team";
const TIER_NAMES: Record<PickerTier, string> = {
  pro: "Cluster",
  max: "Constellation",
  team: "Galaxy",
};
const TIER_TAGLINES: Record<PickerTier, string> = {
  pro: "Persistent memory, Critic everywhere",
  max: "Higher volume, priority routing",
  team: "Shared memory, per-seat pricing",
};

function formatPrice(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function PlanPicker({
  currentTier,
  canSelect,
}: {
  currentTier: PlanTier;
  canSelect: boolean;
}) {
  const fGetCatalog = useServerFn(getPricingCatalog);
  const catalog = useQuery({ queryKey: ["pricing-catalog"], queryFn: () => fGetCatalog() });

  const [tier, setTier] = useState<PickerTier>(
    currentTier === "max" || currentTier === "team" ? (currentTier as PickerTier) : "pro",
  );
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [stepIndex, setStepIndex] = useState(0);

  const bundles: PricingBundle[] = useMemo(() => {
    const all = (catalog.data?.bundles ?? []).filter((b) => b.tier === tier && b.active);
    return [...all].sort((a, b) => a.credits - b.credits);
  }, [catalog.data, tier]);

  // Default to the recommended bundle when the tier changes.
  const recommendedIdx = Math.max(0, bundles.findIndex((b) => b.recommended));
  const safeIdx = Math.min(stepIndex, Math.max(0, bundles.length - 1));
  const idx = bundles.length === 0 ? 0 : safeIdx;

  const selected = bundles[idx];
  const priceCents = selected ? (interval === "monthly" ? selected.monthly_cents : selected.yearly_cents) : 0;
  const yearlyMonthly = selected ? (selected.yearly_cents / 12) : 0;
  const yearlySavingsPct = selected
    ? Math.max(0, Math.round((1 - selected.yearly_cents / (selected.monthly_cents * 12)) * 100))
    : 0;

  const lookupKey = selected ? lookupKeyFor(tier as PlanTier, selected.credits, interval) : null;

  const [checkoutOpen, setCheckoutOpen] = useState(false);

  function onSubscribe() {
    if (!lookupKey) return;
    try {
      getStripeEnvironment();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payments are not configured.");
      return;
    }
    setCheckoutOpen(true);
  }

  if (catalog.isLoading) {
    return <div className="bento" style={{ padding: 18 }}>Loading plans…</div>;
  }
  if (catalog.error || !catalog.data) {
    return (
      <div className="bento" style={{ padding: 18, color: "var(--rose)" }}>
        Couldn't load pricing. {(catalog.error as Error)?.message ?? ""}
      </div>
    );
  }

  return (
    <div className="bento" style={{ padding: 22, display: "grid", gap: 18 }}>
      {/* Tier toggle */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["pro", "max", "team"] as PickerTier[]).map((t) => {
          const active = t === tier;
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTier(t);
                setStepIndex(recommendedIdx);
              }}
              className="btn btn-sm"
              style={{
                background: active ? "var(--ember, #c2602e)" : "transparent",
                color: active ? "white" : "var(--ink, #1d1a14)",
                border: active ? "none" : "1px solid var(--hairline, rgba(0,0,0,0.12))",
                padding: "6px 14px",
                borderRadius: 99,
              }}
            >
              {TIER_NAMES[t]}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)", margin: 0 }}>
        {TIER_TAGLINES[tier]}
      </p>

      {/* Monthly / Yearly */}
      <div
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          padding: 3,
          borderRadius: 99,
          background: "var(--soft-stone, rgba(0,0,0,0.04))",
        }}
      >
        {(["monthly", "yearly"] as const).map((i) => {
          const active = i === interval;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              style={{
                background: active ? "var(--canvas, #fbf7ef)" : "transparent",
                color: "var(--ink, #1d1a14)",
                border: "none",
                padding: "5px 14px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {i === "monthly" ? "Monthly" : "Yearly"}
              {i === "yearly" && yearlySavingsPct > 0 ? (
                <span
                  className="mono-label"
                  style={{ fontSize: 9, marginLeft: 6, color: "var(--emerald, #2f8f6b)" }}
                >
                  save {yearlySavingsPct}%
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Price + credits */}
      {selected ? (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            paddingTop: 4,
            flexWrap: "wrap",
          }}
        >
          <span className="font-display" style={{ fontSize: 40, lineHeight: 1 }}>
            {formatPrice(interval === "monthly" ? priceCents : yearlyMonthly)}
          </span>
          <span style={{ fontSize: 13, color: "var(--ink-muted, #4a4438)" }}>
            /{tier === "team" ? "seat/" : ""}month
            {interval === "yearly" ? `, billed yearly (${formatPrice(priceCents)}/yr)` : ""}
          </span>
        </div>
      ) : null}

      {/* Slider */}
      {bundles.length > 1 ? (
        <div style={{ display: "grid", gap: 10, paddingTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="mono-label" style={{ fontSize: 9 }}>Monthly credits</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {selected?.credits.toLocaleString()}
              {tier === "team" ? " /seat" : ""}
            </span>
          </div>
          <Slider
            min={0}
            max={bundles.length - 1}
            step={1}
            value={[idx]}
            onValueChange={(v) => setStepIndex(v[0] ?? 0)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-faint, #8a8377)" }}>
            <span>{bundles[0]?.credits.toLocaleString()}</span>
            <span>{bundles[bundles.length - 1]?.credits.toLocaleString()}</span>
          </div>
        </div>
      ) : selected ? (
        <div style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
          Includes {selected.credits.toLocaleString()} credits / month
          {tier === "team" ? " per seat" : ""}.
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
          No bundles configured for {TIER_NAMES[tier]} yet.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {currentTier === tier ? (
          <span className="mono-label" style={{ fontSize: 10, color: "var(--emerald, #2f8f6b)" }}>
            Your current tier
          </span>
        ) : null}
        <button
          className="btn btn-primary btn-sm"
          disabled={!canSelect || !lookupKey}
          onClick={onSubscribe}
          title={
            !canSelect
              ? "Only the workspace owner can change the plan."
              : !lookupKey
                ? "This bundle is not configured for checkout yet."
                : undefined
          }
        >
          {currentTier === "free"
            ? `Subscribe to ${TIER_NAMES[tier]}`
            : `Switch to ${TIER_NAMES[tier]} · ${selected?.credits.toLocaleString()} credits`}
        </button>
        <a className="btn btn-ghost btn-sm" href="mailto:sales@cadence.app?subject=Cosmos%20enquiry">
          Enterprise · contact sales
        </a>
      </div>

      {lookupKey ? (
        <StripeEmbeddedCheckout
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          priceLookupKey={lookupKey}
          title={`Subscribe · ${TIER_NAMES[tier]} ${selected?.credits.toLocaleString()} credits`}
        />
      ) : null}
    </div>
  );
}