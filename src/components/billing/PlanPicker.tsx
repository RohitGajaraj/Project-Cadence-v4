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

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ textAlign: "center" }}>
        <span
          className="mono-label"
          style={{ fontSize: 9, color: "var(--ember, #c2602e)", letterSpacing: "0.18em" }}
        >
          Plans
        </span>
        <h2
          className="font-display"
          style={{ fontSize: 26, lineHeight: 1.15, margin: "6px 0 4px", fontWeight: 480 }}
        >
          Pick the plan that fits
        </h2>
      </div>

      {/* Personal | Teams tab toggle */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "inline-flex",
            borderRadius: 99,
            padding: 3,
            background: "var(--soft-stone, rgba(0,0,0,0.06))",
            alignSelf: "flex-start",
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
                  padding: "7px 22px",
                  borderRadius: 99,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
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
      </div>

      {/* 2-column grid per tab */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {tab === "personal" ? (
          <>
            <FreeCard isCurrent={currentTier === "free"} />
            <PaidTierCard
              tier="pro"
              isCurrent={currentTier === "pro" || currentTier === "max"}
              currentTier={currentTier}
              canSelect={canSelect}
              popular
            />
          </>
        ) : (
          <>
            <PaidTierCard
              tier="team"
              isCurrent={currentTier === "team"}
              currentTier={currentTier}
              canSelect={canSelect}
              popular
            />
            <EnterpriseCard isCurrent={currentTier === "enterprise"} currentTier={currentTier} />
          </>
        )}
      </div>
    </div>
  );
}

function CardShell({
  isCurrent,
  children,
}: {
  isCurrent: boolean;
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
        borderColor: isCurrent ? "var(--ember, #c2602e)" : undefined,
        background: isCurrent
          ? "color-mix(in oklab, var(--ember, #c2602e) 7%, var(--canvas, #fbf7ef))"
          : undefined,
        boxShadow: isCurrent
          ? "0 0 0 1.5px var(--ember, #c2602e), 0 0 0 6px color-mix(in oklab, var(--ember, #c2602e) 18%, transparent), 0 0 24px -2px color-mix(in oklab, var(--ember, #c2602e) 35%, transparent), 0 18px 44px -18px color-mix(in oklab, var(--ember, #c2602e) 55%, transparent)"
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
      <CardHeader
        tier="free"
        name={p.name}
        tagline={p.tagline}
        forWhom={p.forWhom}
        isCurrent={isCurrent}
      />
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
        {isCurrent ? "You're on Free" : "Start on Free"}
      </button>
    </CardShell>
  );
}

function EnterpriseCard({
  isCurrent,
  currentTier,
}: {
  isCurrent: boolean;
  currentTier: PlanTier;
}) {
  const p = planPresentation("enterprise");
  const isComingFromBusiness = currentTier === "team" && !isCurrent;
  return (
    <CardShell isCurrent={isCurrent}>
      <CardHeader
        tier="enterprise"
        name={p.name}
        tagline={p.tagline}
        forWhom={p.forWhom}
        isCurrent={isCurrent}
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
      <div style={{ flex: 1 }}>
        <Bullets items={p.highlights} />
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
          <div
            style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}
          >
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
    </CardShell>
  );
}

function PaidTierCard({
  tier,
  isCurrent,
  currentTier,
  canSelect,
  popular,
}: {
  tier: "pro" | "team";
  isCurrent: boolean;
  currentTier: PlanTier;
  canSelect: boolean;
  popular?: boolean;
}) {
  const p = planPresentation(tier);
  const [credits, setCredits] = useState<CreditTier>(100);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();

  const price = priceForCredits(tier, credits, billing);
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
    <CardShell isCurrent={isCurrent}>
      <CardHeader
        tier={tier}
        name={p.name}
        tagline={p.tagline}
        forWhom={p.forWhom}
        isCurrent={isCurrent}
        popular={popular && !isCurrent}
      />

      {/* Price display */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="font-display" style={{ fontSize: 28, lineHeight: 1 }}>
            ${price ?? "--"}/mo
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", marginTop: 2 }}>
          {billing === "yearly" ? "billed annually · ~17% off" : "billed monthly"}
        </div>
      </div>

      {/* Credit dropdown */}
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

      {/* Billing toggle */}
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
              {i === "yearly" ? (
                <span
                  className="mono-label"
                  style={{ fontSize: 9, marginLeft: 6, color: "var(--emerald, #2f8f6b)" }}
                >
                  -17%
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }}>
        <Bullets items={p.highlights} />
      </div>

      <button
        className={
          isCurrent
            ? "btn btn-ghost btn-sm"
            : direction === "downgrade"
              ? "btn btn-ghost btn-sm"
              : "btn btn-primary btn-sm"
        }
        disabled={!canSelect || !lookupKey || isCurrent}
        onClick={onSubscribe}
        style={{ marginTop: 4, width: "100%", textAlign: "center" }}
      >
        {ctaLabel}
      </button>

      {statusMessage ? (
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
      ) : null}

      {isCurrent && (
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}>
          <a
            href="/settings/billing?action=manage"
            style={{
              fontSize: 11,
              color: "var(--ink-subtle, #6b6457)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Manage subscription
          </a>
          <span style={{ color: "var(--hairline, rgba(0,0,0,0.2))" }}>·</span>
          <a
            href="/settings/billing?action=cancel"
            style={{
              fontSize: 11,
              color: "var(--ink-subtle, #6b6457)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Cancel plan
          </a>
        </div>
      )}

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
