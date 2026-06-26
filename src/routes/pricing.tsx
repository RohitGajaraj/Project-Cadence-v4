// PLG · public /pricing page (4-tier Lovable-style model, 2026-06-26)
// Free / Pro / Business / Enterprise with credit dropdown on Pro + Business.
// Annual/monthly toggle per card (not global) with ~17% savings nudge.
// Source: docs/strategy/pricing-strategy.md
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout, Leaf, TreePine, Building2 } from "lucide-react";
import { CadenceMark } from "@/components/cadence/Primitives";
import {
  planPresentation,
  CREDIT_DROPDOWN_TIERS,
  type PlanTier,
  type CreditTier,
} from "@/lib/entitlements";
import { priceForCredits } from "@/lib/billing-tier";

const TITLE = "Pricing · Cadence";
const DESC =
  "Cadence runs your product loop for free. You pay only to keep your decision memory compounding instead of expiring.";

export const Route = createFileRoute("/pricing")({
  ssr: true,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Cadence · Pricing" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PricingPage,
});

// Public tiers in display order; max is internal-only (not shown).
const PUBLIC_TIERS: PlanTier[] = ["free", "pro", "team", "enterprise"];

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;

const TIER_ICONS: Record<PlanTier, LucideIcon> = {
  free: Sprout,
  pro: Leaf,
  max: Leaf,
  team: TreePine,
  enterprise: Building2,
};

function TierProgressionBar() {
  const steps: { tier: PlanTier; label: string }[] = [
    { tier: "free", label: "Free" },
    { tier: "pro", label: "Pro" },
    { tier: "team", label: "Business" },
    { tier: "enterprise", label: "Enterprise" },
  ];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        marginBottom: 32,
      }}
    >
      {steps.map((step, i) => {
        const Icon = TIER_ICONS[step.tier];
        return (
          <div key={step.tier} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    "color-mix(in oklab, var(--ember, #c2622e) 12%, var(--canvas, #faf7ef))",
                  border:
                    "1px solid color-mix(in oklab, var(--ember, #c2622e) 20%, transparent)",
                  color: "var(--ember, #c2622e)",
                }}
              >
                <Icon size={16} strokeWidth={1.6} />
              </span>
              <span
                className="mono-label"
                style={{ fontSize: 8.5, color: "var(--ink-subtle, #6b6457)" }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 40,
                  height: 1,
                  background:
                    "color-mix(in oklab, var(--ember, #c2622e) 25%, var(--hairline, rgba(0,0,0,0.08)))",
                  margin: "0 6px",
                  marginBottom: 16,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PricingCard({ tier }: { tier: PlanTier }) {
  const p = planPresentation(tier);
  const [credits, setCredits] = useState<CreditTier>(100);
  const [annual, setAnnual] = useState(false);

  const isBusiness = tier === "team";
  const isEnterprise = tier === "enterprise";
  const isFree = tier === "free";

  const TierIcon = TIER_ICONS[tier];

  const computedPrice = (() => {
    if (isFree) return "$0";
    if (isEnterprise) return "Custom";
    const price = priceForCredits(tier, credits, annual ? "yearly" : "monthly");
    return price !== null ? `$${price}/mo` : p.price;
  })();

  const annualSavingsPercent = 17;

  return (
    <div
      style={{
        padding: "22px 22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        border: isBusiness
          ? "1px solid color-mix(in oklab, var(--ember, #c2622e) 55%, transparent)"
          : "1px solid var(--hairline, rgba(0,0,0,0.08))",
        background: isBusiness
          ? "color-mix(in oklab, var(--ember, #c2622e) 5%, var(--canvas, #faf7ef))"
          : "var(--canvas, #faf7ef)",
        borderRadius: 10,
      }}
    >
      {/* Icon box */}
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "color-mix(in oklab, var(--ember, #c2622e) 14%, var(--canvas, #faf7ef))",
          border: "1px solid color-mix(in oklab, var(--ember, #c2622e) 22%, transparent)",
          color: "var(--ember, #c2622e)",
        }}
      >
        <TierIcon size={18} strokeWidth={1.6} />
      </span>

      {/* Header row: plan name + popular badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="font-display" style={{ fontSize: 19, fontWeight: 460 }}>
          {p.name}
        </span>
        {isBusiness ? (
          <span
            className="mono-label"
            style={{
              fontSize: 8.5,
              color: "var(--ember, #c2622e)",
              border: "1px solid color-mix(in oklab, var(--ember, #c2622e) 40%, transparent)",
              borderRadius: 99,
              padding: "2px 8px",
            }}
          >
            Popular
          </span>
        ) : null}
      </div>

      {/* For whom chip */}
      <span
        style={{
          fontSize: 11,
          color: "var(--ink-subtle, #6b6457)",
          display: "block",
          marginTop: -8,
          lineHeight: 1.4,
        }}
      >
        {p.forWhom}
      </span>

      {/* Price */}
      {isEnterprise ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="font-display" style={{ fontSize: 22, fontWeight: 460, lineHeight: 1.2 }}>
            Custom
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>
            Platform fee + $20/seat
          </span>
          <span style={{ fontSize: 11.5, color: "var(--ink-subtle, #6b6457)" }}>
            Usage at API rates · scales with model and task
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="font-display" style={{ fontSize: 28, fontWeight: 480 }}>
            {computedPrice}
          </span>
          {!isFree && (
            <span style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>
              {annual ? "billed annually" : "billed monthly"}
            </span>
          )}
        </div>
      )}

      {/* Credit dropdown */}
      {p.hasCreditDropdown && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11.5, color: "var(--ink-subtle, #6b6457)", fontWeight: 500 }}>
            Credits per month
          </label>
          <select
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value) as CreditTier)}
            style={{
              width: "100%",
              padding: "7px 10px",
              fontSize: 13,
              border: "1px solid var(--hairline, rgba(0,0,0,0.12))",
              borderRadius: 6,
              background: "var(--paper, #f6f2ea)",
              color: "var(--ink, #1f1b16)",
              cursor: "pointer",
            }}
          >
            {CREDIT_DROPDOWN_TIERS.map((c) => (
              <option key={c} value={c}>
                {c.toLocaleString()} credits / month
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Annual/monthly toggle */}
      {p.hasBillingToggle && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setAnnual((prev) => !prev)}
            aria-pressed={annual}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              border: "none",
              background: annual ? "var(--ember, #c2622e)" : "var(--hairline, rgba(0,0,0,0.18))",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: annual ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s",
              }}
            />
          </button>
          <span style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>Annual</span>
          {annual && (
            <span
              style={{
                fontSize: 11,
                color: "var(--moss-success, #4f8a59)",
                background: "color-mix(in oklab, var(--moss-success, #4f8a59) 12%, transparent)",
                borderRadius: 99,
                padding: "2px 7px",
              }}
            >
              Save {annualSavingsPercent}%
            </span>
          )}
        </div>
      )}

      {/* Tagline */}
      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-subtle, #6b6457)", margin: 0 }}>
        {p.tagline}
      </p>

      {/* CTA button */}
      {isEnterprise ? (
        <a
          href="mailto:sales@cadence.app?subject=Enterprise%20enquiry"
          style={{
            display: "block",
            textAlign: "center",
            padding: "9px 0",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid var(--hairline, rgba(0,0,0,0.15))",
            background: "transparent",
            color: "var(--ink, #1f1b16)",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Talk to our team
        </a>
      ) : (
        <a
          href={
            isFree
              ? "/signup?from=pricing"
              : `/signup?from=pricing&plan=${tier}&credits=${credits}&billing=${annual ? "annual" : "monthly"}`
          }
          style={{
            display: "block",
            textAlign: "center",
            padding: "9px 0",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 500,
            background: isBusiness ? "var(--ember, #c2622e)" : "transparent",
            border: isBusiness
              ? "1px solid var(--ember, #c2622e)"
              : "1px solid var(--hairline, rgba(0,0,0,0.15))",
            color: isBusiness ? "#fff" : "var(--ink, #1f1b16)",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          {isFree ? "Start free" : "Get started"}
        </a>
      )}

      {/* Feature list */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "2px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {p.highlights.map((h, i) => {
          const isHeader = h.startsWith("Everything in");
          return (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 8,
                fontSize: 12.5,
                lineHeight: 1.45,
                color: isHeader ? "var(--ink-subtle, #6b6457)" : "var(--ink, #1f1b16)",
                fontWeight: isHeader ? 500 : 400,
                borderTop:
                  isHeader && i > 0 ? "1px solid var(--hairline, rgba(0,0,0,0.06))" : undefined,
                paddingTop: isHeader && i > 0 ? 6 : 0,
              }}
            >
              {!isHeader && (
                <span style={{ color: "var(--moss-success, #4f8a59)", flexShrink: 0 }}>+</span>
              )}
              <span style={{ marginLeft: isHeader ? 0 : undefined }}>{h}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PricingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper, #f6f2ea)",
        color: "var(--ink, #1f1b16)",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.08))",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <CadenceMark />
          <span className="font-display" style={{ fontSize: 14 }}>
            Cadence
          </span>
        </Link>
        <a
          href="/login"
          className="mono-label"
          style={{ fontSize: 9, color: "var(--ink-subtle, #6b6457)", textDecoration: "none" }}
        >
          Sign in
        </a>
      </header>

      <main style={{ flex: 1, padding: "44px 18px" }}>
        <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto" }}>
          {/* Headline */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h1
              className="font-display"
              style={{ fontSize: 34, lineHeight: 1.12, margin: "0 0 12px", fontWeight: 440 }}
            >
              Start free. Get to the exact capacity that fits your team.
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--ink-subtle, #6b6457)",
                margin: "0 auto",
                maxWidth: 540,
              }}
            >
              Cadence runs your product loop for free. You pay to keep your decision memory
              compounding and to give your team shared accountability for what the agents decide.
            </p>
          </div>

          {/* Tier progression indicator */}
          <TierProgressionBar />

          {/* 4-column tier grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            {PUBLIC_TIERS.map((tier) => (
              <PricingCard key={tier} tier={tier} />
            ))}
          </div>

          {/* Footer note */}
          <p
            style={{
              fontSize: 11.5,
              color: "var(--ink-faint, #8a8377)",
              textAlign: "center",
              marginTop: 28,
              lineHeight: 1.5,
            }}
          >
            Every plan starts free. No credit card needed until you upgrade. Change or cancel
            anytime from Settings.
          </p>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--ink-subtle, #6b6457)",
        }}
      >
        <span className="mono-label" style={{ fontSize: 9 }}>
          Made with Cadence
        </span>
        <a
          href="/signup?from=pricing"
          style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", textDecoration: "none" }}
        >
          Start free -&gt;
        </a>
      </footer>
    </div>
  );
}
