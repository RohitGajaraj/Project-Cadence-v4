/**
 * PlanTable: horizontal pricing table (Lovable / Anthropic style).
 *
 *   Free · Cluster · Constellation · Galaxy · Cosmos
 *
 * One global Monthly/Yearly toggle at the top. Each paid card carries its own
 * "Credits / month" dropdown (driven by `pricing_bundles`); the displayed
 * price recalculates as the user picks a credit volume. Prices are rounded.
 * The user's current tier shows a "Current plan" pill and a neutral button.
 * Enterprise is a "Contact sales" card.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { StripeEmbeddedCheckout } from "@/components/billing/StripeEmbeddedCheckout";
import { toast } from "@/lib/notify";
import { getStripeEnvironment } from "@/lib/stripe";
import { getPricingCatalog, type PricingBundle } from "@/lib/pricing.functions";
import { lookupKeyFor } from "@/lib/billing-tier";
import { planPresentation, type PlanTier } from "@/lib/entitlements";

type PaidTier = "pro" | "max" | "team";
const PAID_TIERS: PaidTier[] = ["pro", "max", "team"];

function roundDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function formatCredits(n: number): string {
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}k`;
  return n.toLocaleString();
}

/** Backwards-compat alias so existing imports keep working. */
export const PlanPicker = PlanTable;

export function PlanTable({
  currentTier,
  canSelect,
}: {
  currentTier: PlanTier;
  canSelect: boolean;
}) {
  const fGetCatalog = useServerFn(getPricingCatalog);
  const catalog = useQuery({ queryKey: ["pricing-catalog"], queryFn: () => fGetCatalog() });

  const [interval, setIntervalState] = useState<"monthly" | "yearly">("monthly");

  if (catalog.isLoading) {
    return <div className="bento" style={{ padding: 18 }}>Loading plans…</div>;
  }
  if (catalog.error || !catalog.data) {
    return (
      <div className="bento" style={{ padding: 18, color: "var(--rose, #b14233)" }}>
        Couldn't load pricing. {(catalog.error as Error)?.message ?? ""}
      </div>
    );
  }

  const allBundles = catalog.data.bundles.filter((b) => b.active);

  // Best-yearly-savings across all paid tiers, for the toggle pill.
  let bestSave = 0;
  for (const b of allBundles) {
    const pct = Math.max(0, Math.round((1 - b.yearly_cents / (b.monthly_cents * 12)) * 100));
    if (pct > bestSave) bestSave = pct;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Monthly / Yearly toggle */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "inline-flex",
            padding: 3,
            borderRadius: 99,
            background: "var(--soft-stone, rgba(0,0,0,0.06))",
          }}
        >
          {(["monthly", "yearly"] as const).map((i) => {
            const active = i === interval;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setIntervalState(i)}
                style={{
                  background: active ? "var(--canvas, #fbf7ef)" : "transparent",
                  color: "var(--ink, #1d1a14)",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : undefined,
                }}
              >
                {i === "monthly" ? "Monthly" : "Yearly"}
                {i === "yearly" && bestSave > 0 ? (
                  <span
                    className="mono-label"
                    style={{ fontSize: 9, marginLeft: 8, color: "var(--emerald, #2f8f6b)" }}
                  >
                    save up to {bestSave}%
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Horizontal plan grid: Free · Cluster · Constellation · Galaxy · Cosmos */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          alignItems: "stretch",
        }}
      >
        <FreeCard isCurrent={currentTier === "free"} />
        {PAID_TIERS.map((tier) => (
          <PaidTierCard
            key={tier}
            tier={tier}
            interval={interval}
            bundles={allBundles.filter((b) => b.tier === tier)}
            isCurrent={currentTier === tier}
            canSelect={canSelect}
          />
        ))}
        <EnterpriseCard isCurrent={currentTier === "enterprise"} />
      </div>
    </div>
  );
}

function CardShell({
  isCurrent,
  recommended,
  children,
}: {
  isCurrent: boolean;
  recommended?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bento"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderColor: isCurrent
          ? "var(--ember, #c2602e)"
          : recommended
            ? "var(--ink-faint, #8a8377)"
            : undefined,
        position: "relative",
      }}
    >
      {recommended && !isCurrent ? (
        <span
          className="mono-label"
          style={{
            position: "absolute",
            top: -8,
            right: 14,
            background: "var(--ink, #1d1a14)",
            color: "var(--canvas, #fbf7ef)",
            padding: "2px 8px",
            borderRadius: 99,
            fontSize: 9,
          }}
        >
          Popular
        </span>
      ) : null}
      {children}
    </div>
  );
}

function CardHeader({ name, tagline, isCurrent }: { name: string; tagline: string; isCurrent: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span className="font-display" style={{ fontSize: 18 }}>{name}</span>
        {isCurrent ? (
          <span
            className="mono-label"
            style={{
              fontSize: 9,
              color: "var(--canvas, #fbf7ef)",
              background: "var(--ember, #c2602e)",
              padding: "2px 8px",
              borderRadius: 99,
              whiteSpace: "nowrap",
            }}
          >
            Current plan
          </span>
        ) : null}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)", margin: "4px 0 0", minHeight: 32 }}>
        {tagline}
      </p>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
      {items.map((h) => (
        <li key={h} style={{ fontSize: 11.5, color: "var(--ink, #1d1a14)", display: "flex", gap: 8 }}>
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: 99,
              background: "var(--ember, #c2602e)",
              marginTop: 7,
              flexShrink: 0,
            }}
          />
          <span>{h}</span>
        </li>
      ))}
    </ul>
  );
}

function FreeCard({ isCurrent }: { isCurrent: boolean }) {
  const p = planPresentation("free");
  return (
    <CardShell isCurrent={isCurrent}>
      <CardHeader name={p.name} tagline={p.tagline} isCurrent={isCurrent} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="font-display" style={{ fontSize: 32, lineHeight: 1 }}>$0</span>
        <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>/month</span>
      </div>
      <div style={{ flex: 1 }}>
        <Bullets items={p.highlights} />
      </div>
      <button className="btn btn-ghost btn-sm" disabled style={{ marginTop: 4 }}>
        {isCurrent ? "Your current plan" : "Free forever"}
      </button>
    </CardShell>
  );
}

function EnterpriseCard({ isCurrent }: { isCurrent: boolean }) {
  const p = planPresentation("enterprise");
  return (
    <CardShell isCurrent={isCurrent}>
      <CardHeader name={p.name} tagline={p.tagline} isCurrent={isCurrent} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="font-display" style={{ fontSize: 24, lineHeight: 1.1 }}>Custom</span>
      </div>
      <div style={{ flex: 1 }}>
        <Bullets items={p.highlights} />
      </div>
      <a
        className="btn btn-primary btn-sm"
        href="mailto:sales@cadence.app?subject=Cosmos%20enquiry"
        style={{ marginTop: 4, textAlign: "center" }}
      >
        Contact sales
      </a>
    </CardShell>
  );
}

function PaidTierCard({
  tier,
  interval,
  bundles,
  isCurrent,
  canSelect,
}: {
  tier: PaidTier;
  interval: "monthly" | "yearly";
  bundles: PricingBundle[];
  isCurrent: boolean;
  canSelect: boolean;
}) {
  const p = planPresentation(tier);
  const sorted = useMemo(() => [...bundles].sort((a, b) => a.credits - b.credits), [bundles]);
  const defaultId =
    sorted.find((b) => b.recommended)?.id ?? sorted[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState<string>(defaultId);
  const selected = sorted.find((b) => b.id === selectedId) ?? sorted[0];
  const [open, setOpen] = useState(false);

  const monthlyEquivCents = selected
    ? interval === "monthly"
      ? selected.monthly_cents
      : selected.yearly_cents / 12
    : 0;
  const billedCents = selected
    ? interval === "monthly"
      ? selected.monthly_cents
      : selected.yearly_cents
    : 0;

  const lookupKey = selected ? lookupKeyFor(tier, selected.credits, interval) : null;
  const recommended = !!selected?.recommended;

  function onSubscribe() {
    if (!lookupKey) return;
    try {
      getStripeEnvironment();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payments are not configured yet.");
      return;
    }
    setOpen(true);
  }

  return (
    <CardShell isCurrent={isCurrent} recommended={recommended}>
      <CardHeader name={p.name} tagline={p.tagline} isCurrent={isCurrent} />

      {selected ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span className="font-display" style={{ fontSize: 32, lineHeight: 1 }}>
              {roundDollars(monthlyEquivCents)}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
              /{tier === "team" ? "seat/" : ""}month
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-subtle, #6b6457)", marginTop: -8 }}>
            {interval === "yearly"
              ? `Billed ${roundDollars(billedCents)} yearly`
              : "Billed monthly"}
          </div>

          <label style={{ display: "grid", gap: 4 }}>
            <span className="mono-label" style={{ fontSize: 9 }}>Credits / month</span>
            <select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--hairline, rgba(0,0,0,0.14))",
                background: "var(--canvas, #fbf7ef)",
                color: "var(--ink, #1d1a14)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {sorted.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatCredits(b.credits)} credits{tier === "team" ? " / seat" : ""}
                  {b.recommended ? "  · popular" : ""}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <div style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
          Coming soon.
        </div>
      )}

      <div style={{ flex: 1 }}>
        <Bullets items={p.highlights} />
      </div>

      <button
        className={isCurrent ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
        disabled={!canSelect || !lookupKey || isCurrent}
        onClick={onSubscribe}
        title={
          isCurrent
            ? "This is your current plan."
            : !canSelect
              ? "Only the workspace owner can change the plan."
              : !lookupKey
                ? "Not available for checkout yet."
                : undefined
        }
        style={{ marginTop: 4 }}
      >
        {isCurrent
          ? "Your current plan"
          : `Get ${p.name}`}
      </button>

      {lookupKey ? (
        <StripeEmbeddedCheckout
          open={open}
          onOpenChange={setOpen}
          priceLookupKey={lookupKey}
          title={`Subscribe · ${p.name} · ${formatCredits(selected!.credits)} credits`}
        />
      ) : null}
    </CardShell>
  );
}