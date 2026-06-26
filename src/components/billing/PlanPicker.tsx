/**
 * PlanTable: in-product Settings > Billing plan picker.
 * Personal | Teams tab toggle. 2-column grid per tab.
 * Personal: Free + Pro. Teams: Business + Enterprise.
 * Driven by entitlements + billing-tier; no DB catalog dependency.
 */
import { useState } from "react";
import { Zap, User, Users, Building2, Star } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/billing/StripeEmbeddedCheckout";
import { toast } from "@/lib/notify";
import { getStripeEnvironment } from "@/lib/stripe";
import { priceForCredits, lookupKeyFor } from "@/lib/billing-tier";
import {
  planPresentation,
  CREDIT_DROPDOWN_TIERS,
  type PlanTier,
  type CreditTier,
} from "@/lib/entitlements";
import { useConfirm } from "@/hooks/use-confirm";

// Connector logo chips — inline SVG paths from SimpleIcons (MIT-licensed).
// No network dependency: paths embedded directly so logos always render.
const CONNECTOR_CHIPS = [
  { id: "github", label: "GitHub", bg: "#1b1f23", path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
  { id: "linear", label: "Linear", bg: "#5e6ad2", path: "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" },
  { id: "notion", label: "Notion", bg: "#191919", path: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" },
  { id: "jira", label: "Jira", bg: "#0052cc", path: "M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z" },
  { id: "google_docs", label: "Google Docs", bg: "#4285f4", path: "M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-3.273H7.091v-1.364h9.818v1.364zm0-3.273H7.091V9.273h9.818v1.363zM14.727 6h6l-6-6v6z" },
] as const;

function ConnectorChipsMini({ showWrite = false }: { showWrite?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        marginTop: 5,
        marginBottom: 3,
        marginLeft: 12,
        flexWrap: "wrap",
      }}
    >
      {CONNECTOR_CHIPS.map((c) => (
        <span
          key={c.id}
          title={c.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: 4,
            background: c.bg,
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 24 24" width={12} height={12} fill="white" aria-hidden>
            <path d={c.path} />
          </svg>
        </span>
      ))}
      <span style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>+ more</span>
      <span
        style={{
          fontSize: 8,
          fontWeight: 600,
          color: "var(--ember, #c2602e)",
          background: "color-mix(in oklab, var(--ember, #c2602e) 10%, transparent)",
          border: "1px solid color-mix(in oklab, var(--ember, #c2602e) 20%, transparent)",
          borderRadius: 3,
          padding: "1px 4px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        {showWrite ? "read + write" : "read"}
      </span>
    </div>
  );
}

export const TIER_ICON: Record<
  PlanTier,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  free: Zap,
  pro: User,
  max: Star,
  team: Users,
  enterprise: Building2,
};

/** Backwards-compat alias so existing imports keep working. */
export const PlanPicker = PlanTable;

type AudienceTab = "personal" | "teams";

/** The single next tier up — the one that gets the "Recommended" badge. */
function nextTierFor(tier: PlanTier): PlanTier | null {
  switch (tier) {
    case "free":
      return "pro";
    case "pro":
      return "team";
    case "max":
      return "team";
    case "team":
      return "enterprise";
    case "enterprise":
      return null;
  }
}

export function PlanTable({
  currentTier,
  canSelect,
}: {
  currentTier: PlanTier;
  canSelect: boolean;
}) {
  const defaultTab: AudienceTab =
    currentTier === "team" || currentTier === "enterprise" ? "teams" : "personal";
  const [tab, setTab] = useState<AudienceTab>(defaultTab);
  // Global billing toggle — one switch updates all plan prices at once.
  const [annual, setAnnual] = useState(false);

  // The tier that earns the "Recommended" badge — always the single next step up.
  const recommended = nextTierFor(currentTier);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Row: Personal | Teams tab on left, Monthly | Annual toggle on right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {/* Audience tab */}
        <div
          style={{
            display: "inline-flex",
            borderRadius: 99,
            padding: 3,
            background: "var(--soft-stone, rgba(0,0,0,0.06))",
          }}
        >
          {(["personal", "teams"] as const).map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: "6px 18px",
                  borderRadius: 99,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  background: active ? "var(--canvas, #fbf7ef)" : "transparent",
                  color: active ? "var(--ink, #1d1a14)" : "var(--ink-subtle, #6b6457)",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {t === "personal" ? "Personal" : "Teams"}
              </button>
            );
          })}
        </div>

        {/* Global billing toggle */}
        <div
          style={{
            display: "inline-flex",
            borderRadius: 99,
            padding: 3,
            background: "var(--soft-stone, rgba(0,0,0,0.06))",
          }}
        >
          {(["monthly", "annual"] as const).map((mode) => {
            const active = mode === (annual ? "annual" : "monthly");
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setAnnual(mode === "annual")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 99,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  background: active ? "var(--canvas, #fbf7ef)" : "transparent",
                  color: active ? "var(--ink, #1d1a14)" : "var(--ink-subtle, #6b6457)",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {mode === "monthly" ? "Monthly" : "Annual"}
                {mode === "annual" && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: "var(--moss-success, #4f8a59)",
                      background:
                        "color-mix(in oklab, var(--moss-success, #4f8a59) 14%, transparent)",
                      borderRadius: 99,
                      padding: "1px 5px",
                    }}
                  >
                    -17%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-column grid per tab — popular badge tracks the user's actual next step */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {tab === "personal" ? (
          <>
            <FreeCard isCurrent={currentTier === "free"} />
            <PaidTierCard
              tier="pro"
              isCurrent={currentTier === "pro" || currentTier === "max"}
              currentTier={currentTier}
              canSelect={canSelect}
              popular={recommended === "pro"}
              annual={annual}
            />
          </>
        ) : (
          <>
            <PaidTierCard
              tier="team"
              isCurrent={currentTier === "team"}
              currentTier={currentTier}
              canSelect={canSelect}
              popular={recommended === "team"}
              annual={annual}
            />
            <EnterpriseCard
              isCurrent={currentTier === "enterprise"}
              currentTier={currentTier}
              popular={recommended === "enterprise"}
            />
          </>
        )}
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
      className="bento"
      style={{
        padding: "22px 18px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        // Recommended card gets the ember glow — it's the conversion target.
        // Current card gets a softer warm tint — just enough to say "you're here".
        borderColor: popular
          ? "var(--ember, #c2602e)"
          : isCurrent
            ? "color-mix(in oklab, var(--ember, #c2602e) 30%, transparent)"
            : undefined,
        background: isCurrent
          ? "color-mix(in oklab, var(--ember, #c2602e) 5%, var(--canvas, #fbf7ef))"
          : undefined,
        boxShadow: popular
          ? "0 0 0 1.5px var(--ember, #c2602e), 0 0 0 6px color-mix(in oklab, var(--ember, #c2602e) 18%, transparent), 0 0 24px -2px color-mix(in oklab, var(--ember, #c2602e) 35%, transparent), 0 18px 44px -18px color-mix(in oklab, var(--ember, #c2602e) 55%, transparent)"
          : undefined,
        position: "relative",
        overflow: "visible",
      }}
    >
      {popular ? (
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
      {children}
    </div>
  );
}

function CardHeader({
  tier,
  name,
  tagline,
  forWhom,
  isCurrent,
  popular,
}: {
  tier: PlanTier;
  name: string;
  tagline: string;
  forWhom: string;
  isCurrent: boolean;
  popular?: boolean;
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
        ) : popular ? (
          <span
            className="mono-label"
            style={{
              fontSize: 8.5,
              color: "var(--ember, #c2602e)",
              border: "1px solid color-mix(in oklab, var(--ember, #c2602e) 40%, transparent)",
              borderRadius: 99,
              padding: "2px 8px",
            }}
          >
            Popular
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
          fontSize: 11,
          color: "var(--ink-subtle, #6b6457)",
          margin: "3px 0 0",
          lineHeight: 1.4,
        }}
      >
        {forWhom}
      </p>
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-muted, #4a4438)",
          margin: "6px 0 0",
        }}
      >
        {tagline}
      </p>
    </div>
  );
}

function ExpandableBullets({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 5;
  const visible = expanded ? items : items.slice(0, PREVIEW);
  const hiddenCount = items.length - PREVIEW;
  return (
    <div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        {visible.map((h) => {
          const isReadConnector = h.startsWith("Read connectors");
          const isWriteConnector = h.startsWith("Write-back connectors");
          return (
            <li
              key={h}
              style={{
                fontSize: 11.5,
                color: "var(--ink, #1d1a14)",
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
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
              </div>
              {(isReadConnector || isWriteConnector) && (
                <ConnectorChipsMini showWrite={isWriteConnector} />
              )}
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
            padding: "8px 0 0",
            fontSize: 11,
            color: "var(--ink-subtle, #6b6457)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

function FreeCard({ isCurrent }: { isCurrent: boolean }) {
  const p = planPresentation("free");
  return (
    <CardShell isCurrent={isCurrent} popular={false}>
      <CardHeader
        tier="free"
        name={p.name}
        tagline={p.tagline}
        forWhom={p.forWhom}
        isCurrent={isCurrent}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span className="font-display" style={{ fontSize: 32, lineHeight: 1 }}>
          $0
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>/month</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", margin: "0 0 12px" }}>
        No credit card needed
      </p>
      <button
        className="btn btn-ghost btn-sm"
        disabled
        style={{ width: "100%", textAlign: "center", marginBottom: 4 }}
      >
        {isCurrent ? "You are on Free" : "Start on Free"}
      </button>
      <div
        style={{ height: 1, background: "var(--hairline, rgba(0,0,0,0.07))", marginBottom: 14 }}
      />
      <ExpandableBullets items={p.highlights} />
    </CardShell>
  );
}

function EnterpriseCard({
  isCurrent,
  currentTier,
  popular,
}: {
  isCurrent: boolean;
  currentTier: PlanTier;
  popular?: boolean;
}) {
  const p = planPresentation("enterprise");
  const isComingFromBusiness = currentTier === "team" && !isCurrent;
  return (
    <CardShell isCurrent={isCurrent} popular={popular}>
      <CardHeader
        tier="enterprise"
        name={p.name}
        tagline={p.tagline}
        forWhom={p.forWhom}
        isCurrent={isCurrent}
        popular={popular}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="font-display" style={{ fontSize: 22, lineHeight: 1.2 }}>
          Custom
        </span>
        {isComingFromBusiness ? (
          <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
            Custom platform fee + $20/seat + usage at API rates
          </span>
        ) : (
          <>
            <span style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)" }}>
              Platform fee + $20/seat
            </span>
            <span style={{ fontSize: 11.5, color: "var(--ink-subtle, #6b6457)" }}>
              Usage at API rates · scales with model and task
            </span>
          </>
        )}
      </div>
      {isCurrent ? (
        <>
          <p
            style={{
              fontSize: 11,
              color: "var(--ink-subtle, #6b6457)",
              margin: 0,
              textAlign: "center",
            }}
          >
            Reach your account manager to adjust seats or API rates.
          </p>
          <a
            className="btn btn-ghost btn-sm"
            href="mailto:sales@cadence.app?subject=Enterprise plan management"
            style={{ marginTop: 4, textAlign: "center", width: "100%" }}
          >
            Contact account manager
          </a>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}>
            <a
              href="mailto:sales@cadence.app?subject=Enterprise plan management"
              style={{
                fontSize: 11,
                color: "var(--ink-subtle, #6b6457)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Manage subscription
            </a>
          </div>
        </>
      ) : (
        <a
          className="btn btn-primary btn-sm"
          href="mailto:sales@cadence.app?subject=Enterprise enquiry"
          style={{ marginTop: 4, textAlign: "center", width: "100%" }}
        >
          Talk to our team
        </a>
      )}
      <div
        style={{
          height: 1,
          background: "var(--hairline, rgba(0,0,0,0.07))",
          margin: "16px 0 14px",
        }}
      />
      <ExpandableBullets items={p.highlights} />
    </CardShell>
  );
}

function PaidTierCard({
  tier,
  isCurrent,
  currentTier,
  canSelect,
  popular,
  annual,
}: {
  tier: "pro" | "team";
  isCurrent: boolean;
  currentTier: PlanTier;
  canSelect: boolean;
  popular?: boolean;
  annual?: boolean;
}) {
  const p = planPresentation(tier);
  const [credits, setCredits] = useState<CreditTier>(100);
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();

  const billing: "monthly" | "yearly" = annual ? "yearly" : "monthly";
  const price = priceForCredits(tier, credits, billing);
  const monthlyPrice = priceForCredits(tier, credits, "monthly");
  // Exact savings: annual = 10 months → 2 months free per year.
  const yearlySavings = annual && monthlyPrice ? monthlyPrice * 2 : null;
  const lookupKey = lookupKeyFor(tier, credits, billing);

  const TIER_ORDER: PlanTier[] = ["free", "pro", "max", "team", "enterprise"];
  const cmp = TIER_ORDER.indexOf(tier) - TIER_ORDER.indexOf(currentTier);
  const direction: "upgrade" | "downgrade" | "same" =
    cmp > 0 ? "upgrade" : cmp < 0 ? "downgrade" : "same";

  async function onSubscribe() {
    if (!lookupKey) return;
    try {
      getStripeEnvironment();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payments not configured yet.");
      return;
    }
    if (direction === "upgrade" && currentTier !== "free") {
      const ok = await confirm({
        title: `Upgrade to ${p.name}?`,
        body: `Stripe prorates the switch automatically. You get credit for unused days on your current plan and are charged for remaining ${p.name} days in the cycle. Your new credit pool starts immediately.`,
        confirmLabel: `Upgrade to ${p.name}`,
        cancelLabel: "Stay on current plan",
      });
      if (!ok) return;
    }
    if (direction === "downgrade") {
      const ok = await confirm({
        title: `Move to ${p.name}?`,
        body: `${p.name} includes fewer monthly credits and capabilities. The change takes effect next billing cycle, and you can move back up anytime.`,
        confirmLabel: `Move to ${p.name}`,
        cancelLabel: "Keep my current plan",
      });
      if (!ok) return;
    }
    setOpen(true);
  }

  const displayName = tier === "team" ? "Business" : "Pro";

  const ctaLabel = (() => {
    if (isCurrent) return "Current plan";
    if (direction === "upgrade") return `Upgrade to ${displayName}`;
    if (direction === "downgrade") return `Move to ${displayName}`;
    return `Get ${displayName}`;
  })();

  const statusMessage = (() => {
    if (isCurrent) {
      if (tier === "pro") return "You are on Pro. Credits refresh monthly.";
      if (tier === "team") return "Your team shares this pool. Credits refresh monthly.";
    }
    if (direction === "upgrade") {
      if (currentTier === "free") return `Start using ${displayName} immediately. No wait.`;
      return "Stripe prorates the switch. Your new credit pool starts right away.";
    }
    return null;
  })();

  return (
    <CardShell isCurrent={isCurrent} popular={popular && !isCurrent}>
      <CardHeader
        tier={tier}
        name={p.name}
        tagline={p.tagline}
        forWhom={p.forWhom}
        isCurrent={isCurrent}
        popular={popular && !isCurrent}
      />

      {/* Price — billing label — dollar savings (when annual) */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span className="font-display" style={{ fontSize: 28, lineHeight: 1 }}>
            ${price ?? "--"}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>/mo</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginTop: 5,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)" }}>
            {billing === "yearly" ? "billed annually" : "billed monthly"}
          </span>
          {yearlySavings && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "var(--moss-success, #4f8a59)",
                background: "color-mix(in oklab, var(--moss-success, #4f8a59) 14%, transparent)",
                borderRadius: 99,
                padding: "2px 7px",
              }}
            >
              Save ${yearlySavings}/yr
            </span>
          )}
        </div>
      </div>

      {/* Credit dropdown — per card so users can compare different tiers across plans */}
      <label style={{ display: "grid", gap: 4 }}>
        <span className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Credits / month
        </span>
        <select
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value) as CreditTier)}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid var(--hairline, rgba(0,0,0,0.14))",
            background: "var(--canvas, #fbf7ef)",
            fontSize: 13,
            color: "var(--ink, #1d1a14)",
            cursor: "pointer",
          }}
        >
          {CREDIT_DROPDOWN_TIERS.map((c) => (
            <option key={c} value={c}>
              {c.toLocaleString()} credits / month
            </option>
          ))}
        </select>
      </label>

      {/* CTA — immediately after price + credit selection, before features */}
      <button
        className={
          isCurrent || direction === "downgrade" ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"
        }
        disabled={!canSelect || !lookupKey || isCurrent}
        onClick={onSubscribe}
        style={{ width: "100%", textAlign: "center" }}
      >
        {ctaLabel}
      </button>

      {statusMessage && (
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-subtle, #6b6457)",
            margin: "0",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {statusMessage}
        </p>
      )}

      {/* Feature list below CTA */}
      <div
        style={{ height: 1, background: "var(--hairline, rgba(0,0,0,0.07))", margin: "4px 0 2px" }}
      />
      <ExpandableBullets items={p.highlights} />

      {lookupKey ? (
        <StripeEmbeddedCheckout
          open={open}
          onOpenChange={setOpen}
          priceLookupKey={lookupKey}
          title={`${p.name} · ${credits.toLocaleString()} credits · ${billing}`}
        />
      ) : null}
    </CardShell>
  );
}
