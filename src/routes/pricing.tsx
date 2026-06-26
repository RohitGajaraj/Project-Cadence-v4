// PLG · public /pricing page (4-tier Lovable-style model, 2026-06-26)
// Free / Pro / Business / Enterprise with credit dropdown on Pro + Business.
// Annual/monthly toggle per card (not global) with ~17% savings nudge.
// Source: docs/strategy/pricing-strategy.md
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, User, Users, Building2, Star } from "lucide-react";
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
  free: Zap,
  pro: User,
  max: Star,
  team: Users,
  enterprise: Building2,
};

function PricingCard({ tier }: { tier: PlanTier }) {
  const p = planPresentation(tier);
  const [credits, setCredits] = useState<CreditTier>(100);
  const [annual, setAnnual] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isBusiness = tier === "team";
  const isEnterprise = tier === "enterprise";
  const isFree = tier === "free";
  const TierIcon = TIER_ICONS[tier];

  const numericPrice = (() => {
    if (isFree || isEnterprise) return null;
    return priceForCredits(tier, credits, annual ? "yearly" : "monthly");
  })();

  const PREVIEW = 5;
  const visibleHighlights = expanded ? p.highlights : p.highlights.slice(0, PREVIEW);
  const hiddenCount = p.highlights.length - PREVIEW;

  const sep = (
    <div
      style={{
        height: 1,
        background: "var(--hairline, rgba(0,0,0,0.07))",
        margin: "4px 0",
      }}
    />
  );

  return (
    <div
      style={{
        padding: "28px 28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        border: isBusiness
          ? "1.5px solid color-mix(in oklab, var(--ember, #c2622e) 55%, transparent)"
          : "1px solid var(--hairline, rgba(0,0,0,0.09))",
        background: isBusiness
          ? "color-mix(in oklab, var(--ember, #c2622e) 4%, var(--canvas, #faf7ef))"
          : "var(--canvas, #faf7ef)",
        borderRadius: 12,
      }}
    >
      {/* Icon + plan name row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
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
        {isBusiness && (
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
        )}
      </div>

      {/* Plan name */}
      <span
        className="font-display"
        style={{ fontSize: 20, fontWeight: 460, marginBottom: 8, display: "block" }}
      >
        {p.name}
      </span>

      {/* Who it's for — specific, outcome-oriented */}
      <p
        style={{
          fontSize: 13,
          color: "var(--ink, #1d1a14)",
          fontWeight: 500,
          margin: "0 0 6px",
          lineHeight: 1.45,
        }}
      >
        {p.forWhom}
      </p>

      {/* Tagline — supporting context */}
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-subtle, #6b6457)",
          margin: "0 0 20px",
          lineHeight: 1.5,
        }}
      >
        {p.tagline}
      </p>

      {sep}

      {/* Price zone */}
      <div style={{ margin: "16px 0 14px" }}>
        {isEnterprise ? (
          <>
            <span
              className="font-display"
              style={{ fontSize: 26, fontWeight: 460, lineHeight: 1.2, display: "block" }}
            >
              Custom
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--ink-muted, #4a4438)",
                display: "block",
                marginTop: 4,
              }}
            >
              Platform fee + $20/seat
            </span>
            <span
              style={{
                fontSize: 11.5,
                color: "var(--ink-subtle, #6b6457)",
                display: "block",
                marginTop: 2,
              }}
            >
              Usage at API rates
            </span>
          </>
        ) : isFree ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="font-display" style={{ fontSize: 32, fontWeight: 480, lineHeight: 1 }}>
              $0
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>/month</span>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                className="font-display"
                style={{ fontSize: 32, fontWeight: 480, lineHeight: 1 }}
              >
                ${numericPrice}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-subtle, #6b6457)" }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", marginTop: 4 }}>
              {annual ? "billed annually" : "billed monthly"}
            </div>
          </>
        )}
      </div>

      {/* Interactive zone — uniform height across all cards */}
      <div style={{ minHeight: 108 }}>
        {p.hasCreditDropdown && (
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                color: "var(--ink-faint, #8a8377)",
                letterSpacing: "0.08em",
                marginBottom: 5,
              }}
            >
              CREDITS / MONTH
            </label>
            <select
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value) as CreditTier)}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 13,
                border: "1px solid var(--hairline, rgba(0,0,0,0.12))",
                borderRadius: 7,
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

        {p.hasBillingToggle && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setAnnual((a) => !a)}
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
            <span style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>
              Annual billing
            </span>
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
                Save 17%
              </span>
            )}
          </div>
        )}
      </div>

      {/* CTA — immediately after price/toggles, before the feature list */}
      {isEnterprise ? (
        <a
          href="mailto:sales@cadence.app?subject=Enterprise enquiry"
          style={{
            display: "block",
            textAlign: "center",
            padding: "11px 0",
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 500,
            border: "1px solid var(--hairline, rgba(0,0,0,0.15))",
            background: "transparent",
            color: "var(--ink, #1f1b16)",
            textDecoration: "none",
            marginBottom: 20,
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
            padding: "11px 0",
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            background: isBusiness ? "var(--ember, #c2622e)" : "transparent",
            border: isBusiness
              ? "1.5px solid var(--ember, #c2622e)"
              : "1px solid var(--hairline, rgba(0,0,0,0.15))",
            color: isBusiness ? "#fff" : "var(--ink, #1f1b16)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          {isFree ? "Start free" : isBusiness ? "Get Business" : "Get Pro"}
        </a>
      )}

      {sep}

      {/* Feature list — expandable */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "16px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        {visibleHighlights.map((h, i) => {
          const isHeader = h.startsWith("Everything in");
          return (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 8,
                fontSize: 12,
                lineHeight: 1.45,
                color: isHeader ? "var(--ink-subtle, #6b6457)" : "var(--ink, #1f1b16)",
                fontWeight: isHeader ? 500 : 400,
                borderTop:
                  isHeader && i > 0 ? "1px solid var(--hairline, rgba(0,0,0,0.06))" : undefined,
                paddingTop: isHeader && i > 0 ? 8 : 0,
              }}
            >
              {!isHeader && (
                <span
                  style={{ color: "var(--moss-success, #4f8a59)", flexShrink: 0, marginTop: 1 }}
                >
                  +
                </span>
              )}
              <span>{h}</span>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: "none",
            border: "none",
            padding: "10px 0 0",
            fontSize: 11.5,
            color: "var(--ink-subtle, #6b6457)",
            cursor: "pointer",
            textDecoration: "underline",
            textAlign: "left",
          }}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more features`}
        </button>
      )}
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

      <main style={{ flex: 1, padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 1160, margin: "0 auto" }}>
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

          {/* 4-column tier grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(252px, 1fr))",
              gap: 20,
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
