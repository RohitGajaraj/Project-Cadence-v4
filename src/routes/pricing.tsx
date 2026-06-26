// PLG · public /pricing page (4-tier model, 2026-06-27)
// Global monthly/annual toggle; Free / Pro / Business / Enterprise in a 4-column grid.
// Credit dropdown stays per-card (users configure different tiers across plans).
// Annual toggle lifts to page level so all prices update together.
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

// Connector logo chips — inline SVG paths from SimpleIcons (MIT-licensed).
// No network dependency: paths are embedded directly so logos always render.
type ConnectorMeta = { id: string; label: string; bg: string; path: string };

const READ_CONNECTORS: ConnectorMeta[] = [
  {
    id: "github", label: "GitHub", bg: "#1b1f23",
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
  {
    id: "linear", label: "Linear", bg: "#5e6ad2",
    path: "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z",
  },
  {
    id: "notion", label: "Notion", bg: "#191919",
    path: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z",
  },
  {
    id: "jira", label: "Jira", bg: "#0052cc",
    path: "M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z",
  },
  {
    id: "google_docs", label: "Google Docs", bg: "#4285f4",
    path: "M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-3.273H7.091v-1.364h9.818v1.364zm0-3.273H7.091V9.273h9.818v1.363zM14.727 6h6l-6-6v6z",
  },
];

function ConnectorChips({ showWrite = false }: { showWrite?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        marginTop: 6,
        marginBottom: 2,
        flexWrap: "wrap",
      }}
      aria-label={showWrite ? "Write-back connectors" : "Read connectors"}
    >
      {READ_CONNECTORS.map((c) => (
        <span
          key={c.id}
          title={c.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 5,
            background: c.bg,
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 24 24" width={13} height={13} fill="white" aria-hidden>
            <path d={c.path} />
          </svg>
        </span>
      ))}
      <span style={{ fontSize: 10, color: "var(--ink-subtle, #6b6457)", fontWeight: 500 }}>
        + more
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "var(--ember, #c2602e)",
          background: "color-mix(in oklab, var(--ember, #c2602e) 10%, transparent)",
          border: "1px solid color-mix(in oklab, var(--ember, #c2602e) 25%, transparent)",
          borderRadius: 4,
          padding: "1px 5px",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {showWrite ? "read + write" : "read"}
      </span>
    </div>
  );
}

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

// Global billing toggle shown above the card grid.
function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 99,
        padding: 4,
        background: "var(--soft-stone, rgba(0,0,0,0.06))",
        gap: 2,
      }}
    >
      {(["monthly", "annual"] as const).map((mode) => {
        const active = mode === (annual ? "annual" : "monthly");
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode === "annual")}
            style={{
              padding: "7px 20px",
              borderRadius: 99,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              background: active ? "var(--canvas, #faf7ef)" : "transparent",
              color: active ? "var(--ink, #1f1b16)" : "var(--ink-subtle, #6b6457)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.09)" : "none",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            {mode === "monthly" ? "Monthly" : "Annual"}
            {mode === "annual" && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "var(--moss-success, #4f8a59)",
                  background: "color-mix(in oklab, var(--moss-success, #4f8a59) 14%, transparent)",
                  borderRadius: 99,
                  padding: "1px 6px",
                  lineHeight: 1.5,
                }}
              >
                Save 17%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PricingCard({ tier, annual }: { tier: PlanTier; annual: boolean }) {
  const p = planPresentation(tier);
  const [credits, setCredits] = useState<CreditTier>(100);
  const [expanded, setExpanded] = useState(false);

  const isBusiness = tier === "team";
  const isEnterprise = tier === "enterprise";
  const isFree = tier === "free";
  const TierIcon = TIER_ICONS[tier];

  const monthlyPrice = (() => {
    if (isFree || isEnterprise) return null;
    return priceForCredits(tier, credits, "monthly");
  })();

  const displayPrice = (() => {
    if (monthlyPrice === null) return null;
    return annual ? priceForCredits(tier, credits, "yearly") : monthlyPrice;
  })();

  // Exact savings: annual = 10 months, so 2 months free.
  const yearlySavings = annual && monthlyPrice ? monthlyPrice * 2 : null;

  const PREVIEW = 5;
  const visibleHighlights = expanded ? p.highlights : p.highlights.slice(0, PREVIEW);
  const hiddenCount = p.highlights.length - PREVIEW;

  const sep = (
    <div
      style={{
        height: 1,
        background: "var(--hairline, rgba(0,0,0,0.07))",
        margin: "16px 0",
      }}
    />
  );

  return (
    <div
      style={{
        padding: "28px 24px 24px",
        display: "flex",
        flexDirection: "column",
        border: isBusiness
          ? "1.5px solid color-mix(in oklab, var(--ember, #c2622e) 55%, transparent)"
          : "1px solid var(--hairline, rgba(0,0,0,0.09))",
        background: isBusiness
          ? "color-mix(in oklab, var(--ember, #c2622e) 4%, var(--canvas, #faf7ef))"
          : "var(--canvas, #faf7ef)",
        borderRadius: 12,
      }}
    >
      {/* Icon + Popular badge row */}
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
        style={{ fontSize: 20, fontWeight: 460, marginBottom: 6, display: "block" }}
      >
        {p.name}
      </span>

      {/* Who it's for */}
      <p
        style={{
          fontSize: 12.5,
          color: "var(--ink, #1d1a14)",
          fontWeight: 500,
          margin: "0 0 5px",
          lineHeight: 1.45,
        }}
      >
        {p.forWhom}
      </p>

      {/* Tagline */}
      <p
        style={{
          fontSize: 11.5,
          color: "var(--ink-subtle, #6b6457)",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {p.tagline}
      </p>

      {sep}

      {/* Price zone */}
      {isEnterprise ? (
        <div style={{ marginBottom: 16 }}>
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
        </div>
      ) : isFree ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="font-display" style={{ fontSize: 32, fontWeight: 480, lineHeight: 1 }}>
              $0
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>/month</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", margin: "5px 0 0" }}>
            No credit card needed
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {/* Price + billing label row */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="font-display" style={{ fontSize: 32, fontWeight: 480, lineHeight: 1 }}>
              ${displayPrice}
            </span>
            <span style={{ fontSize: 13, color: "var(--ink-subtle, #6b6457)" }}>/mo</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)" }}>
              {annual ? "billed annually" : "billed monthly"}
            </span>
            {yearlySavings && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--moss-success, #4f8a59)",
                  background: "color-mix(in oklab, var(--moss-success, #4f8a59) 14%, transparent)",
                  borderRadius: 99,
                  padding: "2px 8px",
                }}
              >
                Save ${yearlySavings}/yr
              </span>
            )}
          </div>
        </div>
      )}

      {/* Credit dropdown — per card, since users pick different tiers to compare */}
      {p.hasCreditDropdown && (
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 9.5,
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

      {/* CTA — right after price + credit selector, before features */}
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
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 9,
          flex: 1,
        }}
      >
        {visibleHighlights.map((h, i) => {
          const isHeader = h.startsWith("Everything in");
          const isReadConnector = h.startsWith("Read connectors");
          const isWriteConnector = h.startsWith("Write-back connectors");
          return (
            <li
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                fontSize: 12,
                lineHeight: 1.45,
                color: isHeader ? "var(--ink-subtle, #6b6457)" : "var(--ink, #1f1b16)",
                fontWeight: isHeader ? 500 : 400,
                borderTop:
                  isHeader && i > 0 ? "1px solid var(--hairline, rgba(0,0,0,0.06))" : undefined,
                paddingTop: isHeader && i > 0 ? 8 : 0,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                {!isHeader && (
                  <span
                    style={{ color: "var(--moss-success, #4f8a59)", flexShrink: 0, marginTop: 1 }}
                  >
                    +
                  </span>
                )}
                <span>{h}</span>
              </div>
              {isReadConnector && <ConnectorChips />}
              {isWriteConnector && <ConnectorChips showWrite />}
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
  // Global billing interval — one toggle changes all 4 cards simultaneously.
  const [annual, setAnnual] = useState(false);

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
        <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto" }}>
          {/* Headline */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
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
                margin: "0 auto 24px",
                maxWidth: 520,
              }}
            >
              Cadence runs your product loop for free. You pay to keep your decision memory
              compounding and to give your team shared accountability for what the agents decide.
            </p>

            {/* Global billing toggle */}
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>

          {/* 4-column tier grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 20,
            }}
          >
            {PUBLIC_TIERS.map((tier) => (
              <PricingCard key={tier} tier={tier} annual={annual} />
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
