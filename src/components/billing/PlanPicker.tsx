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
import { useConfirm } from "@/hooks/use-confirm";

type PaidTier = "pro" | "max" | "team";

type Audience = "personal" | "teams";

const AUDIENCE_LABEL: Record<Audience, string> = {
  personal: "Personal",
  teams: "Teams & Enterprise",
};
const AUDIENCE_SUB: Record<Audience, string> = {
  personal: "For individuals and small product teams.",
  teams: "Shared memory, roles, and SSO, for the whole product org.",
};

export const TIER_ICON: Record<
  PlanTier,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  free: Sparkle,
  pro: Star,
  max: Stars,
  team: Orbit,
  enterprise: Atom,
};

/**
 * N+1 nudge: the next paid step above the user's current tier.
 * Scoped to Personal tiers only so the "Recommended" badge appears on exactly
 * ONE card across the entire pricing view (never on the Teams or Enterprise
 * tab as well). Teams and Enterprise each have a single card, so they don't
 * need an in-tab recommendation.
 */
function recommendedFor(current: PlanTier): "pro" | "max" {
  switch (current) {
    case "free":
      return "pro";
    case "pro":
      return "max";
    case "max":
      return "max";
    case "team":
      return "max";
    case "enterprise":
      return "max";
    default:
      return "max";
  }
}

function audienceFor(tier: PlanTier): Audience {
  if (tier === "team" || tier === "enterprise") return "teams";
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

  const [audience, setAudience] = useState<Audience>(audienceFor(currentTier));

  if (catalog.isLoading) {
    return (
      <div className="bento" style={{ padding: 18 }}>
        Loading plans…
      </div>
    );
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

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Elevated section header for the active audience */}
      <div style={{ textAlign: "center" }}>
        <span
          className="mono-label"
          style={{ fontSize: 9, color: "var(--ember, #c2602e)", letterSpacing: "0.18em" }}
        >
          Pricing
        </span>
        <h2
          className="font-display"
          style={{
            fontSize: 30,
            lineHeight: 1.15,
            margin: "6px 0 4px",
            letterSpacing: "-0.01em",
            fontWeight: 500,
          }}
        >
          {AUDIENCE_LABEL[audience]}
        </h2>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted, #4a4438)", margin: 0 }}>
          {AUDIENCE_SUB[audience]}
        </p>
      </div>

      {/* Audience switcher: Personal | Teams & Enterprise */}
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

      {/* Horizontal plan grid, scoped to the active audience */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns:
            audience === "personal" ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
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
                /* Cluster (pro) = monthly + yearly; Constellation (max) = monthly only */
                allowYearly={tier === "pro"}
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
          <>
            <PaidTierCard
              tier="team"
              /* Galaxy (Team) — no billing toggle per spec */
              allowYearly={false}
              hideInterval
              bundles={allBundles.filter((b) => b.tier === "team")}
              isCurrent={currentTier === "team"}
              isRecommended={false}
              currentTier={currentTier}
              canSelect={canSelect}
            />
            <EnterpriseCard isCurrent={currentTier === "enterprise"} />
          </>
        )}
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
        padding: "22px 18px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderColor: isCurrent
          ? "var(--ember, #c2602e)"
          : recommended
            ? "var(--ink-faint, #8a8377)"
            : undefined,
        background: isCurrent
          ? "color-mix(in oklab, var(--ember, #c2602e) 7%, var(--canvas, #fbf7ef))"
          : undefined,
        boxShadow: isCurrent
          ? "0 0 0 1.5px var(--ember, #c2602e), 0 0 0 6px color-mix(in oklab, var(--ember, #c2602e) 18%, transparent), 0 0 24px -2px color-mix(in oklab, var(--ember, #c2602e) 35%, transparent), 0 18px 44px -18px color-mix(in oklab, var(--ember, #c2602e) 55%, transparent)"
          : recommended
            ? "0 4px 18px -10px rgba(0,0,0,0.18)"
            : undefined,
        position: "relative",
        overflow: "visible",
      }}
    >
      {isCurrent ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background:
              "linear-gradient(90deg, var(--ember, #c2602e), color-mix(in oklab, var(--ember, #c2602e) 60%, transparent))",
            borderTopLeftRadius: "inherit",
            borderTopRightRadius: "inherit",
          }}
        />
      ) : null}
      {recommended && !isCurrent ? (
        <span
          className="mono-label"
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--ink, #1d1a14)",
            color: "var(--canvas, #fbf7ef)",
            padding: "3px 10px",
            borderRadius: 99,
            fontSize: 9.5,
            letterSpacing: "0.14em",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px -4px rgba(0,0,0,0.25)",
            zIndex: 2,
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
}: {
  tier: PlanTier;
  name: string;
  tagline: string;
  isCurrent: boolean;
}) {
  const Icon = TIER_ICON[tier];
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(145deg, color-mix(in oklab, var(--ember, #c2602e) 18%, transparent), color-mix(in oklab, var(--ember, #c2602e) 6%, transparent))",
            border: "1px solid color-mix(in oklab, var(--ember, #c2602e) 22%, transparent)",
            color: "var(--ember, #c2602e)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px -6px color-mix(in oklab, var(--ember, #c2602e) 40%, transparent)",
          }}
        >
          <Icon size={20} strokeWidth={1.6} />
        </span>
        {isCurrent ? (
          <span
            className="mono-label"
            style={{
              fontSize: 9,
              color: "var(--canvas, #fbf7ef)",
              background: "var(--ember, #c2602e)",
              padding: "3px 9px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              letterSpacing: "0.12em",
            }}
          >
            Current plan
          </span>
        ) : null}
      </div>
      <div
        className="font-display"
        style={{ fontSize: 19, marginTop: 10, letterSpacing: "-0.01em" }}
      >
        {name}
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-muted, #4a4438)",
          margin: "4px 0 0",
          minHeight: 32,
        }}
      >
        {tagline}
      </p>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
      {items.map((h) => (
        <li
          key={h}
          style={{ fontSize: 11.5, color: "var(--ink, #1d1a14)", display: "flex", gap: 8 }}
        >
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
        <span className="font-display" style={{ fontSize: 32, lineHeight: 1 }}>
          $0
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
          /month · no card needed
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <Bullets items={p.highlights} />
      </div>
      <button
        className="btn btn-ghost btn-sm"
        disabled
        style={{ marginTop: 4, width: "100%", textAlign: "center" }}
      >
        {isCurrent ? "You're on Star" : "Start on Star"}
      </button>
      {!isCurrent ? (
        <p
          style={{
            fontSize: 10.5,
            color: "var(--ink-subtle, #6b6457)",
            margin: 0,
            textAlign: "center",
          }}
        >
          Memory fades after 30 days. Upgrade to keep it.
        </p>
      ) : null}
    </CardShell>
  );
}

function EnterpriseCard({ isCurrent }: { isCurrent: boolean }) {
  const p = planPresentation("enterprise");
  return (
    <CardShell isCurrent={isCurrent}>
      <CardHeader tier="enterprise" name={p.name} tagline={p.tagline} isCurrent={isCurrent} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="font-display" style={{ fontSize: 24, lineHeight: 1.1 }}>
          Custom
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>shaped to your org</span>
      </div>
      <div style={{ flex: 1 }}>
        <Bullets items={p.highlights} />
      </div>
      <a
        className="btn btn-primary btn-sm"
        href="mailto:sales@cadence.app?subject=Cosmos%20enquiry"
        style={{ marginTop: 4, textAlign: "center", width: "100%" }}
      >
        Talk to our team
      </a>
    </CardShell>
  );
}

function PaidTierCard({
  tier,
  allowYearly,
  hideInterval = false,
  bundles,
  isCurrent,
  isRecommended,
  currentTier,
  canSelect,
}: {
  tier: PaidTier;
  allowYearly: boolean;
  hideInterval?: boolean;
  bundles: PricingBundle[];
  isCurrent: boolean;
  isRecommended: boolean;
  currentTier: PlanTier;
  canSelect: boolean;
}) {
  const p = planPresentation(tier);
  const sorted = useMemo(() => [...bundles].sort((a, b) => a.credits - b.credits), [bundles]);
  const defaultId = sorted.find((b) => b.recommended)?.id ?? sorted[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState<string>(defaultId);
  const selected = sorted.find((b) => b.id === selectedId) ?? sorted[0];
  const [open, setOpen] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const confirm = useConfirm();
  const effectiveInterval: "monthly" | "yearly" = allowYearly ? billing : "monthly";

  const monthlyEquivCents = selected
    ? effectiveInterval === "monthly"
      ? selected.monthly_cents
      : selected.yearly_cents / 12
    : 0;
  const billedCents = selected
    ? effectiveInterval === "monthly"
      ? selected.monthly_cents
      : selected.yearly_cents
    : 0;

  const lookupKey = selected ? lookupKeyFor(tier, selected.credits, effectiveInterval) : null;
  const recommended = isRecommended;
  const yearlySavePct =
    selected && allowYearly
      ? Math.max(0, Math.round((1 - selected.yearly_cents / (selected.monthly_cents * 12)) * 100))
      : 0;

  // Tier order index for upgrade / downgrade language.
  const TIER_ORDER: PlanTier[] = ["free", "pro", "max", "team", "enterprise"];
  const cmp = TIER_ORDER.indexOf(tier) - TIER_ORDER.indexOf(currentTier);
  const direction: "upgrade" | "downgrade" | "same" =
    cmp > 0 ? "upgrade" : cmp < 0 ? "downgrade" : "same";

  async function onSubscribe() {
    if (!lookupKey) return;
    try {
      getStripeEnvironment();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payments are not configured yet.");
      return;
    }
    // Guard a downgrade behind an explicit confirm: moving to a lower tier reduces the
    // included monthly credits and capabilities, so it should never be one stray click.
    if (direction === "downgrade") {
      const ok = await confirm({
        title: `Move down to ${p.name}?`,
        body: `${p.name} includes fewer monthly credits and capabilities than your current plan. The change takes effect from your next billing cycle, and you can move back up at any time.`,
        confirmLabel: `Move to ${p.name}`,
        cancelLabel: "Keep my current plan",
      });
      if (!ok) return;
    }
    setOpen(true);
  }

  const ctaLabel = (() => {
    if (isCurrent) return "Your current plan";
    if (tier === "team") {
      if (direction === "upgrade") return `Bring the team into ${p.name}`;
      return `Switch to ${p.name}`;
    }
    if (direction === "upgrade") return `Step up to ${p.name}`;
    if (direction === "downgrade") return `Move to ${p.name}`;
    return `Start with ${p.name}`;
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
            {effectiveInterval === "yearly"
              ? `Billed ${roundDollars(billedCents)} yearly`
              : "Billed monthly"}
          </div>

          {/* Per-card billing frequency (only when the tier allows yearly) */}
          {allowYearly && !hideInterval && (
            <div
              style={{
                display: "inline-flex",
                padding: 2,
                borderRadius: 99,
                background: "var(--soft-stone, rgba(0,0,0,0.06))",
                alignSelf: "flex-start",
              }}
            >
              {(["monthly", "yearly"] as const).map((i) => {
                const active = i === billing;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBilling(i)}
                    style={{
                      background: active ? "var(--canvas, #fbf7ef)" : "transparent",
                      color: "var(--ink, #1d1a14)",
                      border: "none",
                      padding: "4px 12px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: active ? 600 : 500,
                      cursor: "pointer",
                      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : undefined,
                    }}
                  >
                    {i === "monthly" ? "Monthly" : "Yearly"}
                    {i === "yearly" && yearlySavePct > 0 ? (
                      <span
                        className="mono-label"
                        style={{ fontSize: 9, marginLeft: 6, color: "var(--emerald, #2f8f6b)" }}
                      >
                        -{yearlySavePct}%
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <label style={{ display: "grid", gap: 4 }}>
            <span className="mono-label" style={{ fontSize: 9 }}>
              Credits / month
            </span>
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
        <div style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>Coming soon.</div>
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
        style={{ marginTop: 4, width: "100%", textAlign: "center" }}
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
