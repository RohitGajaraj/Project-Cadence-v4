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
import { Sparkle, Star, Stars, Orbit, Atom } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/billing/StripeEmbeddedCheckout";
import { toast } from "@/lib/notify";
import { getStripeEnvironment } from "@/lib/stripe";
import { getPricingCatalog, type PricingBundle } from "@/lib/pricing.functions";
import { lookupKeyFor } from "@/lib/billing-tier";
import { planPresentation, type PlanTier } from "@/lib/entitlements";

type PaidTier = "pro" | "max" | "team";

type Audience = "personal" | "teams" | "enterprise";

const AUDIENCE_LABEL: Record<Audience, string> = {
  personal: "Personal",
  teams: "Teams",
  enterprise: "Enterprise",
};

const TIER_ICON: Record<PlanTier, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  free: Sparkle,
  pro: Star,
  max: Stars,
  team: Orbit,
  enterprise: Atom,
};

/** N+1 nudge: the next paid step above the user's current tier. */
function recommendedFor(current: PlanTier): PaidTier {
  switch (current) {
    case "free": return "pro";
    case "pro": return "max";
    case "max": return "team";
    case "team": return "max"; // sideways nudge; enterprise has its own card
    case "enterprise": return "max";
    default: return "max";
  }
}

function audienceFor(tier: PlanTier): Audience {
  if (tier === "team") return "teams";
  if (tier === "enterprise") return "enterprise";
  return "personal";
}

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
  const [audience, setAudience] = useState<Audience>(audienceFor(currentTier));

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
  const recommended = recommendedFor(currentTier);

  // Best-yearly-savings across all paid tiers, for the toggle pill.
  let bestSave = 0;
  for (const b of allBundles) {
    const pct = Math.max(0, Math.round((1 - b.yearly_cents / (b.monthly_cents * 12)) * 100));
    if (pct > bestSave) bestSave = pct;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Personal · Teams · Enterprise (Anthropic-style audience switcher) */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "inline-flex",
            padding: 3,
            borderRadius: 99,
            background: "var(--soft-stone, rgba(0,0,0,0.06))",
          }}
        >
          {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => {
            const active = a === audience;
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                style={{
                  background: active ? "var(--canvas, #fbf7ef)" : "transparent",
                  color: "var(--ink, #1d1a14)",
                  border: "none",
                  padding: "6px 18px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : undefined,
                }}
              >
                {AUDIENCE_LABEL[a]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly / Yearly toggle */}
      {audience !== "enterprise" && (
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
      )}

      {/* Horizontal plan grid, scoped to the active audience */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          alignItems: "stretch",
        }}
      >
        {audience === "personal" && (
          <>
            <FreeCard isCurrent={currentTier === "free"} />
            {(["pro", "max"] as PaidTier[]).map((tier) => (
              <PaidTierCard
                key={tier}
                tier={tier}
                interval={interval}
                bundles={allBundles.filter((b) => b.tier === tier)}
                isCurrent={currentTier === tier}
                isRecommended={recommended === tier}
                currentTier={currentTier}
                canSelect={canSelect}
              />
            ))}
          </>
        )}
        {audience === "teams" && (
          <PaidTierCard
            tier="team"
            interval={interval}
            bundles={allBundles.filter((b) => b.tier === "team")}
            isCurrent={currentTier === "team"}
            isRecommended={recommended === "team"}
            currentTier={currentTier}
            canSelect={canSelect}
          />
        )}
        {audience === "enterprise" && (
          <EnterpriseCard isCurrent={currentTier === "enterprise"} />
        )}
      </div>

      <p
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "var(--ink-subtle, #6b6457)",
          margin: 0,
        }}
      >
        {audience === "personal"
          ? "For individuals and small product teams."
          : audience === "teams"
            ? "Per-seat pricing for the whole product org."
            : "Custom contracts, SSO, residency, and a dedicated SLA."}
      </p>
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
        boxShadow: isCurrent
          ? "0 0 0 1px var(--ember, #c2602e), 0 8px 24px -12px color-mix(in oklab, var(--ember, #c2602e) 35%, transparent)"
          : recommended
            ? "0 4px 18px -10px rgba(0,0,0,0.18)"
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
          Recommended
        </span>
      ) : null}
      {children}
    </div>
  );
}

function CardHeader({
  tier,
  name,
  tagline,
  isCurrent,
}: {
  tier: PlanTier;
  name: string;
  tagline: string;
  isCurrent: boolean;
}) {
  const Icon = TIER_ICON[tier];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span
          className="font-display"
          style={{ fontSize: 18, display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Icon size={16} strokeWidth={1.7} />
          {name}
        </span>
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
      <CardHeader tier="free" name={p.name} tagline={p.tagline} isCurrent={isCurrent} />
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
      <CardHeader tier="enterprise" name={p.name} tagline={p.tagline} isCurrent={isCurrent} />
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
  isRecommended,
  currentTier,
  canSelect,
}: {
  tier: PaidTier;
  interval: "monthly" | "yearly";
  bundles: PricingBundle[];
  isCurrent: boolean;
  isRecommended: boolean;
  currentTier: PlanTier;
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
  const recommended = isRecommended;

  // Tier order index for upgrade / downgrade language.
  const TIER_ORDER: PlanTier[] = ["free", "pro", "max", "team", "enterprise"];
  const cmp = TIER_ORDER.indexOf(tier) - TIER_ORDER.indexOf(currentTier);
  const direction: "upgrade" | "downgrade" | "same" =
    cmp > 0 ? "upgrade" : cmp < 0 ? "downgrade" : "same";

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

  const ctaLabel = (() => {
    if (isCurrent) return "Your current plan";
    if (direction === "upgrade") return `Upgrade to ${p.name}`;
    if (direction === "downgrade") return `Switch to ${p.name}`;
    return `Get ${p.name}`;
  })();

  return (
    <CardShell isCurrent={isCurrent} recommended={recommended}>
      <CardHeader tier={tier} name={p.name} tagline={p.tagline} isCurrent={isCurrent} />

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
                </option>
              ))}
            </select>
          </label>

          {isCurrent && (
            <p
              style={{
                fontSize: 11,
                color: "var(--ink-subtle, #6b6457)",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Need extra room this month? Buy a top-up instead of upgrading — credits land in your
              balance and stay until used.
            </p>
          )}
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
        {ctaLabel}
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