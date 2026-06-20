/**
 * PlanTable: horizontal pricing table driven by the live pricing_plans +
 * pricing_bundles catalog. New tiers added by an admin show up here in real
 * time — no code change needed. Each paid card carries a Credits/month
 * dropdown; a global Monthly/Yearly toggle moves all prices at once.
 *
 * Design intent:
 *   - One "Most popular" pill across the whole table (single anchor).
 *   - The user's current plan is the loudest card on the page (ember halo).
 *   - Each tier has a botanical / celestial growth icon. The popular tier's
 *     icon breathes gently to draw the eye without shouting.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sprout, TreeDeciduous, Stars, Orbit, Telescope, Sparkles, Check } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/billing/StripeEmbeddedCheckout";
import { toast } from "@/lib/notify";
import { getStripeEnvironment } from "@/lib/stripe";
import { getPricingCatalog, type PricingBundle, type PricingPlan } from "@/lib/pricing.functions";
import { lookupKeyFor } from "@/lib/billing-tier";
import { planPresentation, isPlanTier, type PlanTier } from "@/lib/entitlements";

function roundDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function formatCredits(n: number): string {
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}k`;
  return n.toLocaleString();
}

/** Backwards-compat alias. */
export const PlanPicker = PlanTable;

function TierIcon({ tier, pulse = false }: { tier: string; pulse?: boolean }) {
  const map: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
    free: Sprout,
    pro: TreeDeciduous,
    max: Stars,
    team: Orbit,
    enterprise: Telescope,
  };
  const Icon = map[tier] ?? Sparkles;
  return (
    <span
      className={pulse ? "tier-icon-pulse" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 9,
        background: "color-mix(in oklab, var(--ember, #c2602e) 12%, transparent)",
        color: "var(--ember, #c2602e)",
      }}
    >
      <Icon size={17} strokeWidth={1.75} />
    </span>
  );
}

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
  const activePlans = (catalog.data.plans ?? []).filter((p) => p.active);

  // Exactly one popular tier. If admins forgot to flag one, pick the middle
  // paid tier so the table never reads flat.
  const popularTier =
    activePlans.find((p) => p.recommended)?.tier ??
    (() => {
      const paid = activePlans
        .filter((p) => p.tier !== "free" && p.tier !== "enterprise")
        .sort((a, b) => a.sort_order - b.sort_order);
      return paid[Math.floor(paid.length / 2)]?.tier ?? null;
    })();

  const ordered = [...activePlans].sort((a, b) => {
    const rank = (p: PricingPlan) =>
      p.tier === "free" ? -1 : p.tier === "enterprise" ? 9999 : p.sort_order;
    return rank(a) - rank(b);
  });

  let bestSave = 0;
  for (const b of allBundles) {
    const pct = Math.max(0, Math.round((1 - b.yearly_cents / (b.monthly_cents * 12)) * 100));
    if (pct > bestSave) bestSave = pct;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <style>{`
        @keyframes tier-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 color-mix(in oklab, var(--ember, #c2602e) 35%, transparent); }
          50% { transform: scale(1.06); box-shadow: 0 0 0 6px color-mix(in oklab, var(--ember, #c2602e) 0%, transparent); }
        }
        .tier-icon-pulse { animation: tier-pulse 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .tier-icon-pulse { animation: none; } }
        .plan-card-current {
          background: linear-gradient(180deg, color-mix(in oklab, var(--ember, #c2602e) 6%, var(--canvas, #fbf7ef)) 0%, var(--canvas, #fbf7ef) 60%) !important;
          box-shadow: 0 0 0 1.5px var(--ember, #c2602e), 0 12px 30px -18px color-mix(in oklab, var(--ember, #c2602e) 55%, transparent) !important;
        }
      `}</style>

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

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          alignItems: "stretch",
        }}
      >
        {ordered.map((plan) => {
          const isCurrent = currentTier === plan.tier;
          const isPopular = popularTier === plan.tier;
          if (plan.tier === "free") {
            return <FreeCard key="free" plan={plan} isCurrent={isCurrent} />;
          }
          if (plan.tier === "enterprise") {
            return <EnterpriseCard key="enterprise" plan={plan} isCurrent={isCurrent} />;
          }
          return (
            <PaidTierCard
              key={plan.tier}
              plan={plan}
              interval={interval}
              bundles={allBundles.filter((b) => b.tier === plan.tier)}
              isCurrent={isCurrent}
              canSelect={canSelect}
              isPopular={isPopular}
            />
          );
        })}
      </div>
    </div>
  );
}

function CardShell({
  isCurrent,
  popular,
  children,
}: {
  isCurrent: boolean;
  popular?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={isCurrent ? "bento plan-card-current" : "bento"}
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderColor: popular && !isCurrent ? "var(--ink, #1d1a14)" : undefined,
        borderWidth: popular && !isCurrent ? 1.5 : undefined,
        position: "relative",
      }}
    >
      {popular ? (
        <span
          className="mono-label"
          style={{
            position: "absolute",
            top: -10,
            right: 14,
            background: isCurrent ? "var(--ink, #1d1a14)" : "var(--ember, #c2602e)",
            color: "var(--canvas, #fbf7ef)",
            padding: "3px 10px",
            borderRadius: 99,
            fontSize: 9,
            letterSpacing: "0.08em",
            boxShadow: "0 2px 8px -2px rgba(0,0,0,0.18)",
          }}
        >
          Most popular
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
  pulseIcon,
}: {
  tier: string;
  name: string;
  tagline: string;
  isCurrent: boolean;
  pulseIcon?: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TierIcon tier={tier} pulse={!!pulseIcon} />
          <span className="font-display" style={{ fontSize: 19 }}>{name}</span>
        </div>
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
              letterSpacing: "0.08em",
            }}
          >
            Your plan
          </span>
        ) : null}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)", margin: "8px 0 0", minHeight: 32, lineHeight: 1.45 }}>
        {tagline}
      </p>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 7 }}>
      {items.map((h) => (
        <li key={h} style={{ fontSize: 12, color: "var(--ink, #1d1a14)", display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.45 }}>
          <Check size={13} strokeWidth={2.25} style={{ color: "var(--ember, #c2602e)", marginTop: 2, flexShrink: 0 }} />
          <span>{h}</span>
        </li>
      ))}
    </ul>
  );
}

function planView(plan: PricingPlan) {
  if (isPlanTier(plan.tier)) {
    const pres = planPresentation(plan.tier);
    return {
      name: plan.display_name || pres.name,
      tagline: plan.tagline || pres.tagline,
      highlights: pres.highlights,
    };
  }
  return {
    name: plan.display_name,
    tagline: plan.tagline || "",
    highlights: [],
  };
}

function FreeCard({ plan, isCurrent }: { plan: PricingPlan; isCurrent: boolean }) {
  const v = planView(plan);
  return (
    <CardShell isCurrent={isCurrent}>
      <CardHeader tier={plan.tier} name={v.name} tagline={v.tagline} isCurrent={isCurrent} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span className="font-display" style={{ fontSize: 32, lineHeight: 1 }}>$0</span>
        <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>forever</span>
      </div>
      <div style={{ flex: 1 }}>
        <Bullets items={v.highlights} />
      </div>
      <button className="btn btn-ghost btn-sm" disabled style={{ marginTop: 4 }}>
        {isCurrent ? "Your current plan" : "Free forever"}
      </button>
    </CardShell>
  );
}

function EnterpriseCard({ plan, isCurrent }: { plan: PricingPlan; isCurrent: boolean }) {
  const v = planView(plan);
  return (
    <CardShell isCurrent={isCurrent}>
      <CardHeader tier={plan.tier} name={v.name} tagline={v.tagline} isCurrent={isCurrent} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span className="font-display" style={{ fontSize: 24, lineHeight: 1.1 }}>Custom</span>
      </div>
      <div style={{ flex: 1 }}>
        <Bullets items={v.highlights} />
      </div>
      <a
        className="btn btn-primary btn-sm"
        href={`mailto:sales@cadence.app?subject=${encodeURIComponent(v.name + " enquiry")}`}
        style={{ marginTop: 4, textAlign: "center" }}
      >
        Contact sales
      </a>
    </CardShell>
  );
}

function PaidTierCard({
  plan,
  interval,
  bundles,
  isCurrent,
  canSelect,
  isPopular,
}: {
  plan: PricingPlan;
  interval: "monthly" | "yearly";
  bundles: PricingBundle[];
  isCurrent: boolean;
  canSelect: boolean;
  isPopular: boolean;
}) {
  const tier = plan.tier;
  const v = planView(plan);
  const sorted = useMemo(() => [...bundles].sort((a, b) => a.credits - b.credits), [bundles]);
  const defaultId = sorted.find((b) => b.recommended)?.id ?? sorted[0]?.id ?? "";
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
  const savePct =
    selected && interval === "yearly"
      ? Math.max(0, Math.round((1 - selected.yearly_cents / (selected.monthly_cents * 12)) * 100))
      : 0;

  const lookupKey = selected
    ? (interval === "monthly"
        ? selected.stripe_price_id_monthly
        : selected.stripe_price_id_yearly) ||
      (isPlanTier(tier) ? lookupKeyFor(tier, selected.credits, interval) : null)
    : null;

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
    <CardShell isCurrent={isCurrent} popular={isPopular}>
      <CardHeader
        tier={tier}
        name={v.name}
        tagline={v.tagline}
        isCurrent={isCurrent}
        pulseIcon={isPopular}
      />

      {selected ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            <span className="font-display" style={{ fontSize: 32, lineHeight: 1 }}>
              {roundDollars(monthlyEquivCents)}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
              /{tier === "team" ? "seat/" : ""}month
            </span>
            {savePct > 0 ? (
              <span
                className="mono-label"
                style={{ fontSize: 9, marginLeft: 6, color: "var(--emerald, #2f8f6b)" }}
              >
                save {savePct}%
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-subtle, #6b6457)", marginTop: -6 }}>
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
        </>
      ) : (
        <div style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
          No bundles configured yet. An admin can add them in Admin · Pricing.
        </div>
      )}

      <div style={{ flex: 1 }}>
        <Bullets items={v.highlights} />
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
        {isCurrent ? "Your current plan" : `Get ${v.name}`}
      </button>

      {lookupKey ? (
        <StripeEmbeddedCheckout
          open={open}
          onOpenChange={setOpen}
          priceLookupKey={lookupKey}
          title={`Subscribe · ${v.name} · ${formatCredits(selected!.credits)} credits`}
        />
      ) : null}
    </CardShell>
  );
}
