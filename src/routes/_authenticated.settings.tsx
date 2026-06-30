// Settings — screen 5 wave B of the Ember Editorial migration, ported from
// design-reference/cadence/loop.jsx (SettingsScreen, lines 966–1071): mono
// kicker "Workspace", serif h1, hairline TabRow. Production functionality
// rides the reference layout: the ?section= search-param contract (legacy
// brief→workspace, calendar→connections deep links keep landing), the
// OAuth-only AccountConnectionsSection (founder law 2026-06-12 — Connect-
// button OAuth only, no key paste for connectors), profile/brief/voice-anchor
// saves, and BYO AI keys (not connectors — they stay under Models).
// Reference Digest tab omitted: no digest-routing backend (no-filler law).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/notify";
import { Compass, SlidersHorizontal, Trash2 } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import {
  MonoLabel,
  StepDot,
  SubTabs,
  SurfaceHeader,
  TabRow,
} from "@/components/cadence/Primitives";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { listProjects } from "@/lib/projects.functions";
import { listAgents, setAgentToolCap } from "@/lib/agents.functions";
import { MODELS, AUTO_MODEL } from "@/lib/ai/models";
import {
  listIntegrations,
  upsertIntegration,
  disconnectIntegration,
  PROVIDERS,
} from "@/lib/integrations.functions";
import {
  listApiKeys,
  saveApiKey,
  deleteApiKey,
  testApiKey,
  BYO_PROVIDERS,
} from "@/lib/byokeys.functions";
import { getActiveBrief, upsertBrief, type WorkspaceBrief } from "@/lib/briefs.functions";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  AccountConnectionsSection,
  ConnectorDetail,
} from "@/components/connections/AccountConnectionsSection";
import { CONNECTOR_REGISTRY, type ProviderId, type ProviderSpec } from "@/lib/connectors/registry";
import { getBillingState, type BillingState } from "@/lib/billing.functions";
import {
  getMySubscription,
  cancelMySubscription,
  resumeMySubscription,
  createPortalSession,
  getMyCreditsView,
  getCreditAttribution,
} from "@/lib/payments.functions";
import { planPresentation, type PlanTier } from "@/lib/entitlements";
import { StripeEmbeddedCheckout } from "@/components/billing/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/billing/PaymentTestModeBanner";
import { getStripeEnvironment } from "@/lib/stripe";
import { useConfirm } from "@/hooks/use-confirm";
import { PlanTable, TIER_ICON } from "@/components/billing/PlanPicker";
import { CreditCapsCard } from "@/components/billing/CreditCapsCard";
import { getPricingCatalog } from "@/lib/pricing.functions";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { DataExportCard } from "@/components/settings/DataExportCard";
import { SubprocessorsCard } from "@/components/settings/SubprocessorsCard";
import { HealthCard } from "@/components/settings/HealthCard";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { RedeemCodeCard } from "@/components/settings/RedeemCodeCard";
import { MembersCard } from "@/components/settings/MembersCard";
import { TeamCard } from "@/components/settings/TeamCard";
import {
  PRIMARY_GROUPS,
  RECESSED_GROUPS,
  normalizeSection,
  groupForSection,
  findGroup,
  primarySection,
  sectionLabel,
  type SectionId,
  type GroupId,
} from "@/lib/settings-sections";

// The section ids, grouping, legacy deep-link map, and normalizeSection now live
// in the pure, unit-tested @/lib/settings-sections module (SETTINGS-SEGREGATE,
// v11 #13): the 11 flat tabs are presented as 5 calm groups + a recessed
// Advanced group, while every ?section= id is preserved unchanged so existing
// deep links keep landing. "ai" stays the id behind the Models label; Workspace
// is production-only; "connections" is the account-level OAuth surface
// (deliberately not "Connectors", to not collide with the /sync surface).

// ?connector= drill param (screen 6) — only registry keys for user-facing
// providers open the detail; anything else falls back to the normal list.
function normalizeConnector(raw: string | undefined): ProviderId | undefined {
  if (!raw) return undefined;
  const spec = (CONNECTOR_REGISTRY as Record<string, ProviderSpec | undefined>)[raw];
  return spec && spec.userFacing !== false ? spec.id : undefined;
}

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { section?: string; connector?: string; checkout?: string } => ({
    section: typeof search.section === "string" ? search.section : undefined,
    connector: typeof search.connector === "string" ? search.connector : undefined,
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div className="bento" style={{ padding: 24 }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load Settings
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, maxWidth: 480 }}>
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={reset}>
            Retry · reloads the surface
          </button>
        </div>
      </div>
    </AppShell>
  ),
});

function SettingsPage() {
  const { section, connector, checkout } = Route.useSearch();
  const active = normalizeSection(section);
  const activeConnector = active === "connections" ? normalizeConnector(connector) : undefined;
  const navigate = useNavigate({ from: "/settings" });
  const { activeWorkspace, activeProduct } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const setTab = (id: string) => navigate({ search: { section: id } });

  // Tier-1 grouping (SETTINGS-SEGREGATE): which group owns the active section,
  // its member sections (for the tier-2 sub-row), and a group-click handler that
  // lands on the group's primary section. The ?section= id stays the routing key.
  const activeGroup = groupForSection(active);
  const groupMembers = findGroup(activeGroup)?.sections ?? [];
  const setGroup = (gid: string) =>
    navigate({ search: { section: primarySection(gid as GroupId) } });

  const workspaceName = activeWorkspace?.name;
  const sub = workspaceName
    ? `${workspaceName}${activeProduct?.name ? ` · ${activeProduct.name}` : ""}. Connectors, models, and staff config.`
    : "Connectors, models, and staff config.";

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[workspaceName ?? "Workspace", "Settings"]} />
      <div
        data-screen-label="Settings"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader kicker="Workspace" icon={SlidersHorizontal} title="Settings" sub={sub} />

        {/* Tier 1: 5 calm groups + one recessed Advanced door (SETTINGS-SEGREGATE
            #13). The group tabs carry a one-line description; Advanced sits off to
            the right, quiet, since it is diagnostics rather than daily settings. */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <TabRow
              tabs={PRIMARY_GROUPS.map((g) => ({ id: g.id, label: g.label }))}
              active={activeGroup}
              onSet={setGroup}
              desc={Object.fromEntries(PRIMARY_GROUPS.map((g) => [g.id, g.desc]))}
            />
          </div>
          {RECESSED_GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGroup(g.id)}
              className="mono-label"
              title={g.desc}
              style={{
                padding: "6px 12px",
                marginTop: 4,
                borderRadius: 99,
                fontSize: 9.5,
                whiteSpace: "nowrap",
                color: activeGroup === g.id ? "var(--canvas)" : "var(--ink-faint)",
                background: activeGroup === g.id ? "var(--primary-ink)" : "transparent",
                border: `1px solid ${activeGroup === g.id ? "transparent" : "var(--hairline)"}`,
                transition: "background var(--dur-fast), color var(--dur-fast)",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Tier 2: the active group's member sections — only shown when the group
            holds more than one section (single-section groups need no sub-row). */}
        {groupMembers.length > 1 ? (
          <div style={{ marginTop: 4, marginBottom: 6 }}>
            <SubTabs
              tabs={groupMembers.map((s) => s.label)}
              active={sectionLabel(active)}
              onSet={(label) => {
                const match = groupMembers.find((s) => s.label === label);
                if (match) setTab(match.id);
              }}
            />
          </div>
        ) : null}

        {active === "connections" && (
          <ConnectionsTab
            connector={activeConnector}
            onOpenDetail={(p) => navigate({ search: { section: "connections", connector: p } })}
            onCloseDetail={() => navigate({ search: { section: "connections" } })}
          />
        )}
        {active === "ai" && <ModelsTab />}
        {active === "staff" && <StaffTab />}
        {active === "workspace" && <WorkspaceTab scrollToBrief={section === "brief"} />}
        {active === "billing" && <BillingTab checkout={checkout} />}
        {active === "credits" && <CreditsTab />}
        {active === "interop" && <IntegrationsTab />}
        {active === "profile" && <ProfileTab />}
        {active === "notifications" && <NotificationsTab />}
        {active === "health" && <HealthCard />}
        {active === "data" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <DataExportCard workspaceId={activeWorkspace?.id} />
            <SubprocessorsCard />
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ---- Plan — M-C billing: the current plan, the three tiers, and an upgrade CTA.
   getBillingState reads workspaces.plan_tier (set only by the Stripe webhook);
   "Upgrade" starts a Stripe Checkout via createCheckoutSession. Degrades to an
   honest "billing not connected yet" until the founder wires Stripe keys, so the
   surface ships now and charges nothing. ---- */

function BillingTab({ checkout }: { checkout?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/settings" });
  const fGetBilling = useServerFn(getBillingState);
  const fGetSub = useServerFn(getMySubscription);
  const fCancelSub = useServerFn(cancelMySubscription);
  const fResumeSub = useServerFn(resumeMySubscription);
  const fPortal = useServerFn(createPortalSession);
  const confirm = useConfirm();

  const billing = useQuery({
    queryKey: ["billing"],
    queryFn: () => fGetBilling({ data: {} }),
  });

  // Resolve env lazily so a missing payments token doesn't crash render.
  let envSafe: ReturnType<typeof getStripeEnvironment> | null = null;
  try {
    envSafe = getStripeEnvironment();
  } catch {
    envSafe = null;
  }

  // getMySubscription is a pure Supabase read — no Stripe key needed.
  // Fall back to 'sandbox' so local dev without VITE_PAYMENTS_CLIENT_TOKEN still loads sub data.
  const subEnv: "sandbox" | "live" = envSafe ?? "sandbox";
  const mySub = useQuery({
    queryKey: ["my-subscription", subEnv],
    queryFn: () => fGetSub({ data: { environment: subEnv } }),
  });

  useEffect(() => {
    if (checkout === "success") {
      toast.success("Payment received. Your plan will reflect within a minute.");
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
    } else if (checkout === "cancel") {
      toast("Checkout canceled. You are still on your current plan.");
    } else if (checkout === "pending") {
      toast("Still confirming with the payment provider. This usually clears in a minute.");
    }
  }, [checkout, qc]);

  const cancelSub = useMutation({
    mutationFn: () => fCancelSub({ data: { environment: subEnv } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Subscription set to cancel at the end of the current period.");
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not cancel."),
  });

  const resumeSub = useMutation({
    mutationFn: () => fResumeSub({ data: { environment: subEnv } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Subscription resumed. Renews on the next billing date.");
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not resume."),
  });

  const openPortal = useMutation({
    mutationFn: () =>
      fPortal({
        data: {
          environment: subEnv,
          returnUrl: window.location.href,
        },
      }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if ("url" in res && res.url) {
        window.location.href = res.url;
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open billing portal."),
  });

  async function onCancelClick() {
    const renews = mySub.data?.currentPeriodEnd
      ? new Date(mySub.data.currentPeriodEnd).toLocaleDateString()
      : "the end of the current period";
    const ok = await confirm({
      title: "Cancel subscription?",
      body: `You'll keep full access until ${renews}. After that, the plan drops to Free. You can resume anytime before then.`,
      confirmLabel: "Cancel plan",
      cancelLabel: "Keep plan",
      destructive: true,
    });
    if (ok) cancelSub.mutate();
  }

  const state: BillingState | undefined = billing.data;
  const currentTier: PlanTier = state?.planTier ?? "free";
  const current = planPresentation(currentTier);
  const TierGlyph = TIER_ICON[currentTier];
  const sub = mySub.data;
  const hasSub = !!sub?.hasSubscription;
  const renews = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const renewsLabel = renews
    ? renews.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PaymentTestModeBanner />
      {/* ── Current plan card ────────────────────────────────────────── */}
      <div className="bento" style={{ padding: "var(--card-pad, 18px)", display: "grid", gap: 0 }}>
        {/* Top row: plan identity + status pill */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              className="mono-label"
              style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)", marginBottom: 4 }}
            >
              Current plan
            </div>
            <div
              className="font-display"
              style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 8 }}
            >
              <span style={{ color: "var(--ember, #c2602e)", display: "inline-flex" }}>
                <TierGlyph size={20} strokeWidth={1.5} />
              </span>
              {current.name}
            </div>
          </div>
          {/* Status pill — only when subscription data is loaded */}
          {hasSub && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 10px",
                borderRadius: 99,
                marginTop: 4,
                flexShrink: 0,
                background: sub?.cancelAtPeriodEnd
                  ? "color-mix(in oklab, #b45309 12%, transparent)"
                  : sub?.status === "past_due"
                    ? "color-mix(in oklab, #dc2626 12%, transparent)"
                    : "color-mix(in oklab, var(--moss-success, #4f8a59) 14%, transparent)",
                color: sub?.cancelAtPeriodEnd
                  ? "#92400e"
                  : sub?.status === "past_due"
                    ? "#991b1b"
                    : "var(--moss-success, #4f8a59)",
              }}
            >
              {sub?.cancelAtPeriodEnd
                ? "Cancels at period end"
                : sub?.status === "past_due"
                  ? "Payment issue"
                  : "Active"}
            </span>
          )}
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-muted, #4a4438)",
            margin: "8px 0 0",
            lineHeight: 1.45,
          }}
        >
          {current.tagline}
        </p>

        {/* Renewal date — only when available */}
        {hasSub && renewsLabel && (
          <p style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", margin: "5px 0 0" }}>
            {sub?.cancelAtPeriodEnd ? "Access until" : "Renews on"}{" "}
            <strong style={{ color: "var(--ink, #1d1a14)", fontWeight: 500 }}>{renewsLabel}</strong>
          </p>
        )}

        {/* Non-owner notice */}
        {state && !state.isOwner && (
          <p style={{ fontSize: 11.5, color: "var(--ink-subtle, #6b6457)", margin: "12px 0 0" }}>
            Only the workspace owner can change or cancel the plan.
          </p>
        )}

        {/* ── Action row — always visible for workspace owner ── */}
        {(!state || state.isOwner) && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Manage billing → Stripe portal for payment/invoice management */}
            {hasSub && (
              <button
                className="btn btn-primary btn-sm"
                disabled={openPortal.isPending}
                onClick={() => openPortal.mutate()}
              >
                {openPortal.isPending ? "Opening…" : "Manage billing"}
              </button>
            )}

            {/* Cancel / Resume — only when subscription exists */}
            {hasSub &&
              (sub?.cancelAtPeriodEnd ? (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={resumeSub.isPending}
                  onClick={() => resumeSub.mutate()}
                >
                  {resumeSub.isPending ? "Resuming…" : "Resume plan"}
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={cancelSub.isPending}
                  onClick={onCancelClick}
                >
                  {cancelSub.isPending ? "Canceling…" : "Cancel plan"}
                </button>
              ))}

            {/* Top-up always available (navigates in-app, no Stripe needed) */}
            {currentTier !== "free" && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate({ search: { section: "credits" } })}
              >
                Buy a credit top-up
              </button>
            )}

            {/* Free tier: nudge toward upgrading */}
            {currentTier === "free" && (
              <span style={{ fontSize: 11.5, color: "var(--ink-subtle, #6b6457)" }}>
                Pick a plan below to upgrade.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Lovable-style plan table: free · 3 paid · enterprise.
          Per-card credits dropdown drives the live price. */}
      <PlanTable currentTier={currentTier} canSelect={state?.isOwner ?? false} />
    </div>
  );
}

/* ---- Credits — Phase 7 surface (G12). Isolated from Plan so subscription
   changes and credit top-ups never get visually entangled (the Anthropic
   pattern). Reads balance + cycle + last 20 ledger rows + last 10 top-ups via
   RLS; top-ups route through the cap-guarded `createTopUpCheckout`. When the
   metering engine is still dormant (`credits_enabled() = false`), the balance
   block honestly says so instead of pretending a 0 is meaningful. ---- */

function CreditsTab() {
  return <CreditsTabInner />;
}

function BundleGrid({
  bundles,
  selectedKey,
  onSelect,
  remainingTopupRoom,
  bestPerCredit,
  fmtPrice,
  fmtCreditsShort,
}: {
  bundles: { key: string; credits: number; priceCents: number }[];
  selectedKey: string;
  onSelect: (key: string) => void;
  remainingTopupRoom: number | null;
  bestPerCredit: number;
  fmtPrice: (c: number) => string;
  fmtCreditsShort: (n: number) => string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      }}
    >
      {bundles.map((b) => {
        const wouldExceed = remainingTopupRoom !== null && b.credits > remainingTopupRoom;
        const perCredit = b.priceCents / b.credits;
        const isBest = Math.abs(perCredit - bestPerCredit) < 1e-9;
        const selected = b.key === selectedKey;
        const vsStarter = bundles[0] ? bundles[0].priceCents / bundles[0].credits : perCredit;
        const savedVsStarter = Math.max(0, Math.round((1 - perCredit / vsStarter) * 100));
        return (
          <button
            key={b.key}
            type="button"
            disabled={wouldExceed}
            onClick={() => onSelect(b.key)}
            title={wouldExceed ? "Exceeds your per-cycle top-up limit." : undefined}
            style={{
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 10,
              cursor: wouldExceed ? "not-allowed" : "pointer",
              opacity: wouldExceed ? 0.5 : 1,
              border: selected
                ? "1px solid var(--ember, #c2602e)"
                : "1px solid var(--hairline, rgba(0,0,0,0.12))",
              background: selected
                ? "color-mix(in oklab, var(--ember, #c2602e) 8%, var(--canvas, #fbf7ef))"
                : "var(--canvas, #fbf7ef)",
              boxShadow: selected
                ? "0 0 0 3px color-mix(in oklab, var(--ember, #c2602e) 18%, transparent)"
                : "none",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              position: "relative",
            }}
          >
            {isBest && (
              <span
                className="mono-label"
                style={{
                  position: "absolute",
                  top: -8,
                  right: 10,
                  fontSize: 8.5,
                  background: "var(--ink, #1d1a14)",
                  color: "var(--canvas, #fbf7ef)",
                  padding: "2px 6px",
                  borderRadius: 99,
                }}
              >
                Best value
              </span>
            )}
            <span className="font-display" style={{ fontSize: 18, lineHeight: 1.1 }}>
              {fmtCreditsShort(b.credits)} credits
            </span>
            <span style={{ fontSize: 13, color: "var(--ink, #1d1a14)" }}>
              {fmtPrice(b.priceCents)}
            </span>
            <span style={{ fontSize: 10, color: "var(--ink-subtle, #6b6457)" }}>
              {(perCredit / 100).toFixed(3)} $/credit
              {savedVsStarter > 0 ? ` · save ${savedVsStarter}%` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CreditsTabInner() {
  const fGetCredits = useServerFn(getMyCreditsView);
  const fGetCatalog = useServerFn(getPricingCatalog);
  const fGetAttribution = useServerFn(getCreditAttribution);

  let envSafe: ReturnType<typeof getStripeEnvironment> | null = null;
  try {
    envSafe = getStripeEnvironment();
  } catch {
    envSafe = null;
  }

  const credits = useQuery({
    queryKey: ["my-credits", envSafe],
    queryFn: () => fGetCredits({ data: { environment: envSafe! } }),
    enabled: !!envSafe,
  });
  const catalog = useQuery({
    queryKey: ["pricing-catalog"],
    queryFn: () => fGetCatalog(),
  });
  const attribution = useQuery({
    queryKey: ["credit-attribution"],
    queryFn: () => fGetAttribution({ data: {} }),
  });

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState("Buy credits");

  function openTopUp(key: string, label: string) {
    try {
      getStripeEnvironment();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payments are not configured.");
      return;
    }
    setCheckoutKey(key);
    setCheckoutTitle(label);
    setCheckoutOpen(true);
  }

  const data = credits.data;
  const cycleLabel = data?.cycleAnchor
    ? new Date(data.cycleAnchor).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const remainingTopupRoom = data
    ? Math.max(0, data.cycleTopupCapCredits - data.cycleTopupCredits)
    : null;

  // Drive bundles from the admin-managed catalog when available; fall back to
  // a market-benchmarked ladder (Notion AI / Cursor / Linear pricing per equivalent
  // unit, ~$1.50–$2 per 100 credits at entry, scaling down with volume to ~$1).
  // Convention: lookup_key = "topup_<credits>" or "topup_<k>k".
  const catalogBundles = (catalog.data?.topups ?? []).filter((b) => b.active);
  type Bundle = { key: string; credits: number; priceCents: number };
  const BUNDLES: Bundle[] = catalogBundles.length
    ? [...catalogBundles]
        .sort((a, b) => a.credits - b.credits)
        .map((b) => ({
          key:
            b.credits >= 1000 && b.credits % 1000 === 0
              ? `topup_${b.credits / 1000}k`
              : `topup_${b.credits}`,
          credits: b.credits,
          priceCents: b.price_cents,
        }))
    : [
        { key: "topup_250", credits: 250, priceCents: 500 },
        { key: "topup_1k", credits: 1000, priceCents: 1800 },
        { key: "topup_2_5k", credits: 2500, priceCents: 4000 },
        { key: "topup_5k", credits: 5000, priceCents: 7500 },
        { key: "topup_10k", credits: 10000, priceCents: 14000 },
        { key: "topup_25k", credits: 25000, priceCents: 32500 },
        { key: "topup_50k", credits: 50000, priceCents: 60000 },
        { key: "topup_100k", credits: 100000, priceCents: 110000 },
        { key: "topup_250k", credits: 250000, priceCents: 250000 },
      ];
  const fmtPrice = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;
  const fmtCreditsShort = (n: number) =>
    n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : n.toLocaleString();

  const STARTER_MAX = 5000;
  const starterBundles = BUNDLES.filter((b) => b.credits <= STARTER_MAX);
  const scaleBundles = BUNDLES.filter((b) => b.credits > STARTER_MAX);
  const [selectedKey, setSelectedKey] = useState<string>(
    () => BUNDLES.find((b) => b.credits === 2500)?.key ?? BUNDLES[0]?.key ?? "",
  );
  const selectedBundle = BUNDLES.find((b) => b.key === selectedKey) ?? BUNDLES[0];
  const bestPerCredit = BUNDLES.reduce(
    (min, b) => Math.min(min, b.priceCents / b.credits),
    Infinity,
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PaymentTestModeBanner />
      {/* Voucher redeem entry point (the user-facing caller for redeemVoucher). */}
      <RedeemCodeCard />

      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Balance
        </div>
        <div className="font-display" style={{ fontSize: 28, marginTop: 4 }}>
          {data ? (data.balanceCredits + data.topupCredits).toLocaleString() : "-"}
          <span style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", marginLeft: 8 }}>
            credits
          </span>
        </div>
        {data && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 12, fontSize: 12 }}>
            <div>
              <div
                className="mono-label"
                style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}
              >
                Monthly grant
              </div>
              <div style={{ marginTop: 2 }}>{data.monthlyGrantCredits.toLocaleString()}</div>
            </div>
            <div>
              <div
                className="mono-label"
                style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}
              >
                Purchased top-ups
              </div>
              <div style={{ marginTop: 2 }}>{data.topupCredits.toLocaleString()}</div>
            </div>
            {cycleLabel && (
              <div>
                <div
                  className="mono-label"
                  style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}
                >
                  Cycle started
                </div>
                <div style={{ marginTop: 2 }}>{cycleLabel}</div>
              </div>
            )}
          </div>
        )}
        {data && !data.enabled && (
          <p style={{ fontSize: 11.5, color: "var(--ink-subtle, #6b6457)", marginTop: 10 }}>
            Metering is off while we finish the credits rollout. Top-ups are recorded and will count
            once metering turns on.
          </p>
        )}
      </div>

      {/* ===== Where your credits go (WM-M16 usage attribution) ===== */}
      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Where your credits go
        </div>
        {(() => {
          const a = attribution.data;
          if (attribution.isLoading) {
            return (
              <p style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", margin: "10px 0 0" }}>
                Loading…
              </p>
            );
          }
          if (!a || a.totalDebited <= 0) {
            return (
              <p style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", margin: "10px 0 0" }}>
                {data && !data.enabled
                  ? "Usage breakdown appears once metering is on. You'll see which products and teammates spent credits this cycle."
                  : "No credits spent this cycle yet. Usage by product and teammate will appear here."}
              </p>
            );
          }
          const max = Math.max(...a.byProduct.map((p) => p.credits), 1);
          return (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)" }}>
                {a.totalDebited.toLocaleString()} credits spent this cycle
              </div>
              {a.byProduct.slice(0, 8).map((p) => (
                <div key={p.id ?? "unattributed"} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ color: "var(--ink, #1d1a14)" }}>{p.name}</span>
                    <span style={{ color: "var(--ink-subtle, #6b6457)" }}>
                      {p.credits.toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 99,
                      background: "var(--hairline, rgba(0,0,0,0.08))",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round((p.credits / max) * 100)}%`,
                        height: "100%",
                        background: "var(--ember, #c2602e)",
                      }}
                    />
                  </div>
                </div>
              ))}
              {a.byMember.length > 1 && (
                <div style={{ fontSize: 11, color: "var(--ink-faint, #8a8377)", marginTop: 4 }}>
                  Across {a.byMember.length} teammates this cycle.
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <CreditCapsCard />

      {/* ===== Pick a bundle ===== */}
      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className="mono-label"
              style={{ fontSize: 9, color: "var(--ember, #c2602e)", letterSpacing: "0.18em" }}
            >
              One-time top-ups
            </div>
            <div
              className="font-display"
              style={{ fontSize: 22, marginTop: 4, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              Buy credits without changing your plan
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)", margin: "4px 0 0" }}>
              Credits land in your balance and stay until used. Higher bundles unlock a better
              per-credit rate.
            </p>
          </div>
          {selectedBundle && (
            <div style={{ textAlign: "right" }}>
              <div
                className="mono-label"
                style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}
              >
                Your selection
              </div>
              <div className="font-display" style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}>
                {fmtPrice(selectedBundle.priceCents)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", marginTop: 2 }}>
                {selectedBundle.credits.toLocaleString()} credits &middot;{" "}
                {(selectedBundle.priceCents / selectedBundle.credits / 100).toFixed(3)} $/credit
              </div>
            </div>
          )}
        </div>

        {/* Starter tiers */}
        <div style={{ marginTop: 18 }}>
          <div
            className="mono-label"
            style={{
              fontSize: 9,
              color: "var(--ink-faint, #8a8377)",
              letterSpacing: "0.14em",
              marginBottom: 8,
            }}
          >
            Starter packs
          </div>
          <BundleGrid
            bundles={starterBundles}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            remainingTopupRoom={remainingTopupRoom}
            bestPerCredit={bestPerCredit}
            fmtPrice={fmtPrice}
            fmtCreditsShort={fmtCreditsShort}
          />
        </div>

        {/* Scale tiers */}
        {scaleBundles.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              className="mono-label"
              style={{
                fontSize: 9,
                color: "var(--ink-faint, #8a8377)",
                letterSpacing: "0.14em",
                marginBottom: 8,
              }}
            >
              At scale &middot; better per-credit rate
            </div>
            <BundleGrid
              bundles={scaleBundles}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              remainingTopupRoom={remainingTopupRoom}
              bestPerCredit={bestPerCredit}
              fmtPrice={fmtPrice}
              fmtCreditsShort={fmtCreditsShort}
            />
          </div>
        )}

        {selectedBundle && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={remainingTopupRoom !== null && selectedBundle.credits > remainingTopupRoom}
              onClick={() =>
                openTopUp(
                  selectedBundle.key,
                  `Top-up: ${selectedBundle.credits.toLocaleString()} credits`,
                )
              }
            >
              Buy {selectedBundle.credits.toLocaleString()} credits &middot;{" "}
              {fmtPrice(selectedBundle.priceCents)}
            </button>
          </div>
        )}

        {data && (
          <p style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", margin: "12px 0 0" }}>
            This cycle: {data.cycleTopupCredits.toLocaleString()} of{" "}
            {data.cycleTopupCapCredits.toLocaleString()} top-up credits used. Need more? &nbsp;
            <a
              href="mailto:sales@cadence.app?subject=Enterprise%20credits"
              style={{ color: "var(--ember, #c2602e)" }}
            >
              Talk to sales for volume pricing
            </a>
            .
          </p>
        )}
      </div>

      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Recent activity
        </div>
        {credits.isLoading ? (
          <p style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", margin: "10px 0 0" }}>
            Loading…
          </p>
        ) : data && data.ledger.length === 0 && data.topups.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ink-subtle, #6b6457)", margin: "10px 0 0" }}>
            No activity yet. Your grants, debits, and top-ups will appear here.
          </p>
        ) : (
          <ul
            style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6 }}
          >
            {data?.topups.map((t) => (
              <li
                key={`top-${t.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 12,
                  padding: "6px 0",
                  borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.06))",
                }}
              >
                <span>
                  Top-up &middot;{" "}
                  <span style={{ color: "var(--ink-subtle, #6b6457)" }}>{t.price_lookup_key}</span>
                </span>
                <span style={{ color: "var(--emerald, #2f8f6b)" }}>
                  +{Number(t.credits_added).toLocaleString()} credits
                </span>
                <span
                  style={{ color: "var(--ink-faint, #8a8377)", minWidth: 90, textAlign: "right" }}
                >
                  {new Date(t.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
            {data?.ledger.map((row) => (
              <li
                key={`led-${row.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 12,
                  padding: "6px 0",
                  borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.06))",
                }}
              >
                <span>
                  {row.reason}
                  {row.surface ? ` · ${row.surface}` : ""}
                </span>
                <span
                  style={{
                    color:
                      row.delta_credits >= 0 ? "var(--emerald, #2f8f6b)" : "var(--ink, #1d1a14)",
                  }}
                >
                  {row.delta_credits >= 0 ? "+" : ""}
                  {Number(row.delta_credits).toLocaleString()} credits
                </span>
                <span
                  style={{ color: "var(--ink-faint, #8a8377)", minWidth: 90, textAlign: "right" }}
                >
                  {new Date(row.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {checkoutKey ? (
        <StripeEmbeddedCheckout
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          priceLookupKey={checkoutKey}
          title={checkoutTitle}
          mode="topup"
        />
      ) : null}
    </div>
  );
}

/* ---- Connections — Connected accounts (OAuth-only) + workspace tool sync,
   the reference's 3-col connector card grid (serif 16 name · StepDot ·
   12 ink-subtle desc · Connect/Disconnect). Screen 6 ships the ConnectorDetail
   drill-down: ?connector= (optional search param) replaces this whole tab body
   with the per-provider detail; "details →" on every account row opens it,
   DrillHeader's back link and any tab switch clear it (fresh search object). ---- */

function ConnectionsTab({
  connector,
  onOpenDetail,
  onCloseDetail,
}: {
  connector?: ProviderId;
  onOpenDetail: (provider: ProviderId) => void;
  onCloseDetail: () => void;
}) {
  const qc = useQueryClient();
  const fIntegrations = useServerFn(listIntegrations);
  const fUpsertInt = useServerFn(upsertIntegration);
  const fDisconnect = useServerFn(disconnectIntegration);
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: () => fIntegrations() });

  const intMap = new Map(
    (integrations.data?.integrations ?? []).map(
      (i: { provider: string; status: string; account_label: string | null }) => [i.provider, i],
    ),
  );

  const mConnect = useMutation({
    mutationFn: (provider: string) =>
      fUpsertInt({
        data: { provider, status: "connected", account_label: "Connected via Lovable" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Connected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDisconnect = useMutation({
    mutationFn: (provider: string) => fDisconnect({ data: { provider } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Disconnected");
    },
  });

  // Drill-down: the detail replaces the entire tab body (SurfaceHeader +
  // TabRow stay above us in SettingsPage).
  if (connector) {
    return <ConnectorDetail provider={connector} onBack={onCloseDetail} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <AccountConnectionsSection onOpenDetail={onOpenDetail} />

      <div>
        <MonoLabel style={{ marginBottom: 4 }}>Workspace tool sync</MonoLabel>
        <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginBottom: 12 }}>
          Bring your other PM tools into Cadence. Two-way sync ships in 5.2b.
        </p>
        {integrations.isLoading ? (
          <div
            className="mono-label"
            style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-faint)" }}
          >
            loading…
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {PROVIDERS.map((p) => {
              const conn = intMap.get(p.id) as
                | { status: string; account_label: string | null }
                | undefined;
              const connected = conn?.status === "connected";
              const comingSoon = p.desc.startsWith("Coming");
              return (
                <div
                  key={p.id}
                  className="bento"
                  style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span className="font-display" style={{ fontSize: 16 }}>
                      {p.label}
                    </span>
                    <StepDot status={connected ? "completed" : "planned"} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-subtle)", flex: 1 }}>
                    {p.desc}
                    {connected && conn?.account_label ? ` · ${conn.account_label}` : ""}
                  </span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {connected ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={mDisconnect.isPending}
                        onClick={() => mDisconnect.mutate(p.id)}
                      >
                        Disconnect · unlinks the tool
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={comingSoon || mConnect.isPending}
                        onClick={() => mConnect.mutate(p.id)}
                      >
                        {comingSoon ? "Coming soon" : "Connect"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Models — the reference table anatomy (role · model mono · via mono ·
   Change ghost) rendered from REAL data: the profile's default model.
   "Change" is real here — it reveals the model select. BYO AI keys stay
   (they are not connectors), restyled quiet-Ember. ---- */

function ModelsTab() {
  const qc = useQueryClient();
  const fProfile = useServerFn(getProfile);
  const mUpdate = useServerFn(updateProfile);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fProfile() });

  const [defaultModel, setDefaultModel] = useState("google/gemini-3-flash-preview");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const p = profile.data?.profile as { default_model?: string } | null;
    if (p) setDefaultModel(p.default_model ?? "google/gemini-3-flash-preview");
  }, [profile.data]);

  const saveModel = useMutation({
    mutationFn: () => mUpdate({ data: { default_model: defaultModel } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
      toast.success("Default model saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = MODELS.find((m) => m.id === defaultModel);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
        {profile.isLoading ? (
          <div
            className="mono-label"
            style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-faint)" }}
          >
            loading…
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 18px",
              borderBottom: editing ? "1px solid var(--hairline)" : "none",
              fontSize: 13,
            }}
          >
            <span style={{ flex: 1, color: "var(--ink-muted)" }}>
              Default · chat and agent runs
            </span>
            <span className="mono-label" style={{ color: "var(--ink)" }}>
              {defaultModel === AUTO_MODEL ? "Auto" : (current?.label ?? defaultModel)}
            </span>
            <span className="mono-label" style={{ fontSize: 9 }}>
              {defaultModel === AUTO_MODEL
                ? "routed"
                : current
                  ? current.live
                    ? "gateway"
                    : "byo"
                  : "unknown"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing((v) => !v)}>
              Change
            </button>
          </div>
        )}
        {editing ? (
          <div className="fade-up" style={{ display: "flex", gap: 8, padding: "13px 18px" }}>
            <select
              className="input"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              aria-label="Default AI model"
            >
              <optgroup label="Recommended">
                <option value={AUTO_MODEL}>
                  Auto — best model per task, optimized automatically
                </option>
              </optgroup>
              <optgroup label="Live (Lovable AI Gateway)">
                {MODELS.filter((m) => m.live).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.desc}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Adapter-ready (platform / enterprise key)">
                {MODELS.filter((m) => !m.live).map((m) => (
                  <option key={m.id} value={m.id} disabled>
                    {m.label} — {m.desc}
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0 }}
              disabled={saveModel.isPending}
              onClick={() => saveModel.mutate()}
            >
              {saveModel.isPending ? "Saving…" : "Save · chat and agent runs use it"}
            </button>
          </div>
        ) : null}
      </div>

      <ByoKeysSection />
    </div>
  );
}

function ByoKeysSection() {
  const qc = useQueryClient();
  const fKeys = useServerFn(listApiKeys);
  const fSaveKey = useServerFn(saveApiKey);
  const fDelKey = useServerFn(deleteApiKey);
  const fTestKey = useServerFn(testApiKey);
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => fKeys() });

  const [keyProv, setKeyProv] = useState<string>(BYO_PROVIDERS[0].id);
  const [keyLabel, setKeyLabel] = useState<string>("");
  const [keyValue, setKeyValue] = useState<string>("");
  const [keyBase, setKeyBase] = useState<string>("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latency_ms: number;
    error?: string;
    sample?: string;
  } | null>(null);

  const mTestKey = useMutation({
    mutationFn: () =>
      fTestKey({ data: { provider: keyProv, api_key: keyValue, base_url: keyBase || null } }),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.ok) toast.success(`Key works (${r.latency_ms}ms)`);
      else toast.error(r.error ?? "Test failed");
    },
    onError: (e: Error) => {
      setTestResult({ ok: false, latency_ms: 0, error: e.message });
      toast.error(e.message);
    },
  });
  const mSaveKey = useMutation({
    mutationFn: () =>
      fSaveKey({
        data: {
          provider: keyProv,
          label: keyLabel || null,
          api_key: keyValue,
          base_url: keyBase || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setKeyValue("");
      setKeyLabel("");
      setKeyBase("");
      setTestResult(null);
      toast.success("Key saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelKey = useMutation({
    mutationFn: (id: string) => fDelKey({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Removed");
    },
  });

  const keyList = keys.data?.keys ?? [];

  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <MonoLabel style={{ marginBottom: 4 }}>Bring your own AI keys</MonoLabel>
      <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginBottom: 12 }}>
        Connect any AI provider — Claude, OpenAI, Qwen, DeepSeek, Groq, Mistral, Moonshot, OpenRouter, and more.
        Stored encrypted per user. Add a Base URL for providers with custom endpoints (Qwen, Ollama, custom).
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (keyValue.trim()) mSaveKey.mutate();
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "3fr 3fr 4fr 2fr", gap: 8 }}>
          <select
            className="input"
            value={keyProv}
            onChange={(e) => setKeyProv(e.target.value)}
            aria-label="Key provider"
          >
            {BYO_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            placeholder="Label (optional)"
          />
          <input
            className="input"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            type="password"
            placeholder={BYO_PROVIDERS.find((p) => p.id === keyProv)?.placeholder}
          />
          <input
            className="input"
            value={keyBase}
            onChange={(e) => setKeyBase(e.target.value)}
            placeholder="Base URL (Qwen, Ollama, custom…)"
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 8,
          }}
        >
          {testResult ? (
            <span
              className="mono-label"
              style={{
                fontSize: 8.5,
                color: testResult.ok ? "var(--emerald)" : "var(--rose)",
              }}
            >
              {testResult.ok ? `ok · ${testResult.latency_ms}ms` : testResult.error?.slice(0, 80)}
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={mTestKey.isPending || !keyValue.trim()}
            onClick={() => mTestKey.mutate()}
          >
            {mTestKey.isPending ? (
              <>
                <span className="spinner" style={{ width: 11, height: 11 }} />
                Testing…
              </>
            ) : (
              "Test · calls the provider"
            )}
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={mSaveKey.isPending || !keyValue.trim()}
          >
            {mSaveKey.isPending ? "Saving…" : "Add key · stored encrypted"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 12 }}>
        {keys.isLoading ? (
          <div className="mono-label" style={{ color: "var(--ink-faint)" }}>
            loading…
          </div>
        ) : keyList.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>No BYO keys saved yet.</div>
        ) : (
          keyList.map((k, i) => (
            <div
              key={k.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderTop: i === 0 ? "1px solid var(--hairline)" : undefined,
                borderBottom: "1px solid var(--hairline)",
                fontSize: 13,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>
                  {BYO_PROVIDERS.find((p) => p.id === k.provider)?.label ?? k.provider}
                  {k.label ? (
                    <span style={{ color: "var(--ink-subtle)" }}> · {k.label}</span>
                  ) : null}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--ink-subtle)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {k.preview}
                  {k.base_url ? ` · ${k.base_url}` : ""}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Remove key"
                style={{ color: "var(--rose)" }}
                disabled={mDelKey.isPending && mDelKey.variables === k.id}
                onClick={() => mDelKey.mutate(k.id)}
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---- Staff — the real agent registry (agents table via listAgents):
   4-col bento cards, serif 15 name + mono 8.5 role, 30×17 switch.
   Production has no disable-agent capability — the toggle states the truth
   (gated in Govern), exactly the reference's honest toast. ---- */

type AgentRow = {
  id: string;
  slug: string;
  name: string;
  role: string;
  enabled: boolean;
  max_tool_risk?: string | null;
};

// FND-0.5 per-agent blast-radius cap control. Sets agents.max_tool_risk; the agent loop then drops
// any tool whose blast-radius tier exceeds the cap. "Unrestricted" (null) is the default.
const TOOL_CAP_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Unrestricted" },
  { value: "low", label: "Low reach" },
  { value: "medium", label: "Medium reach" },
  { value: "high", label: "High reach" },
];

function AgentToolCap({ agent }: { agent: AgentRow }) {
  const qc = useQueryClient();
  const fSet = useServerFn(setAgentToolCap);
  const m = useMutation({
    mutationFn: (v: string) =>
      fSet({
        data: {
          agentId: agent.id,
          maxToolRisk: v === "" ? null : (v as "low" | "medium" | "high"),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast(`${agent.name}: tool reach updated`);
    },
    onError: (e) => toast((e as Error).message),
  });
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        className="mono-label"
        style={{ fontSize: 8.5, color: "var(--ink-faint)", flexShrink: 0 }}
      >
        Tool reach
      </span>
      <select
        value={agent.max_tool_risk ?? ""}
        disabled={m.isPending}
        onChange={(e) => m.mutate(e.target.value)}
        title="Cap the blast radius of the tools this agent can call"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 11,
          padding: "3px 6px",
          borderRadius: 6,
          border: "1px solid var(--hairline)",
          background: "var(--canvas)",
          color: "var(--ink)",
        }}
      >
        {TOOL_CAP_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StaffTab() {
  const fAgents = useServerFn(listAgents);
  const agentsQ = useQuery({ queryKey: ["agents"], queryFn: () => fAgents() });

  if (agentsQ.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load agents
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(agentsQ.error as Error)?.message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => agentsQ.refetch()}
        >
          Retry · reloads agents
        </button>
      </div>
    );
  }

  if (agentsQ.isLoading) {
    return (
      <div
        className="mono-label"
        style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-faint)" }}
      >
        loading…
      </div>
    );
  }

  const agents = (agentsQ.data?.agents ?? []) as AgentRow[];
  if (agents.length === 0) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "24px 0" }}>
        No agents in this workspace yet.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {agents.map((a) => (
        <div
          key={a.slug}
          className="bento"
          style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-display" style={{ fontSize: 15 }}>
                {a.name}
              </div>
              <div className="mono-label" style={{ fontSize: 8.5 }}>
                {a.role}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={a.enabled}
              title={`${a.name} ${a.enabled ? "enabled" : "disabled"}`}
              onClick={() =>
                toast(
                  a.enabled
                    ? `${a.name} stays on. Disabling agents is gated in Govern.`
                    : `${a.name} stays off. Enabling agents is gated in Govern.`,
                )
              }
              style={{
                width: 30,
                height: 17,
                borderRadius: 99,
                background: a.enabled ? "var(--deep-green)" : "var(--surface-2)",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  ...(a.enabled ? { right: 2 } : { left: 2 }),
                  top: 2,
                  width: 13,
                  height: 13,
                  borderRadius: 99,
                  background: "var(--canvas)",
                }}
              ></span>
            </button>
          </div>
          <AgentToolCap agent={a} />
        </div>
      ))}
    </div>
  );
}

/* ---- Workspace (production-only tab) — strategic brief + voice anchor,
   restyled quiet-Ember. ---- */

function WorkspaceTab({ scrollToBrief }: { scrollToBrief: boolean }) {
  const qc = useQueryClient();
  const briefRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollToBrief && briefRef.current) {
      briefRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollToBrief]);

  const fProfile = useServerFn(getProfile);
  const mUpdate = useServerFn(updateProfile);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fProfile() });

  const [voiceAnchor, setVoiceAnchor] = useState("");
  useEffect(() => {
    const p = profile.data?.profile as { voice_anchor_text?: string | null } | null;
    if (p) setVoiceAnchor(p.voice_anchor_text ?? "");
  }, [profile.data]);

  const saveVoice = useMutation({
    mutationFn: () => mUpdate({ data: { voice_anchor_text: voiceAnchor } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Voice anchor saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <WorkspaceBriefSection scrollRef={briefRef} highlight={scrollToBrief} />

      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <MonoLabel style={{ marginBottom: 4 }}>Voice anchor</MonoLabel>
            <p style={{ fontSize: 12, color: "var(--ink-subtle)", maxWidth: 520 }}>
              Operator-set tone and stance, injected into every agent mission's system prompt. Leave
              empty to skip.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flexShrink: 0 }}
            disabled={saveVoice.isPending || profile.isLoading}
            onClick={() => saveVoice.mutate()}
          >
            {saveVoice.isPending ? "Saving…" : "Save · every mission hears it"}
          </button>
        </div>
        <textarea
          className="input"
          value={voiceAnchor}
          onChange={(e) => setVoiceAnchor(e.target.value)}
          rows={4}
          maxLength={2000}
          aria-label="Voice anchor"
          placeholder="Direct, evidence-first, no hype. Challenge weak assumptions. Prefer short declarative sentences."
          style={{ resize: "vertical" }}
        />
        <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6 }}>
          How your agents should sound and what stance they should take.
        </p>
      </div>

      <MembersCard />
      <TeamCard />
    </div>
  );
}

type BriefFieldKey = "mission" | "target_user" | "current_focus" | "anti_goals" | "notes";

const BRIEF_FIELDS: {
  key: BriefFieldKey;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
}[] = [
  {
    key: "mission",
    label: "Mission",
    hint: "One paragraph. What this workspace exists to do.",
    placeholder: "We help solo PMs run the work of a 10-person product org.",
    rows: 3,
  },
  {
    key: "target_user",
    label: "Target user (ICP)",
    hint: "Who you're building for. Agents anchor on this.",
    placeholder: "Lead/solo PM at a 10 to 100 person B2B SaaS team. Ships weekly.",
    rows: 3,
  },
  {
    key: "current_focus",
    label: "Current focus",
    hint: "What the swarm should prioritize this quarter. Cut, don't expand.",
    placeholder: "Q3 2026: close the Discover, Define, Plan, Build loop on real signals.",
    rows: 4,
  },
  {
    key: "anti_goals",
    label: "Anti-goals",
    hint: "Things agents should refuse, even when they look reasonable.",
    placeholder: "No new dashboards. No mocked data. No features whose value can't be measured.",
    rows: 3,
  },
  {
    key: "notes",
    label: "Notes for the swarm",
    hint: "Tone, constraints, decisions, references.",
    placeholder: "Speak in product terms. Lean concise over verbose. Always cite evidence.",
    rows: 4,
  },
];

const EMPTY_BRIEF: Record<BriefFieldKey, string> = {
  mission: "",
  target_user: "",
  current_focus: "",
  anti_goals: "",
  notes: "",
};

function WorkspaceBriefSection({
  scrollRef,
  highlight,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  highlight: boolean;
}) {
  const { activeWorkspaceId, activeWorkspace, refreshWorkspaces } = useWorkspace();
  const qc = useQueryClient();
  const getFn = useServerFn(getActiveBrief);
  const upsertFn = useServerFn(upsertBrief);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-brief", activeWorkspaceId],
    queryFn: () => getFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
  });

  const effectiveWorkspaceId = activeWorkspaceId ?? data?.workspace_id ?? null;

  const [form, setForm] = useState<Record<BriefFieldKey, string>>(EMPTY_BRIEF);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        mission: data.mission ?? "",
        target_user: data.target_user ?? "",
        current_focus: data.current_focus ?? "",
        anti_goals: data.anti_goals ?? "",
        notes: data.notes ?? "",
      });
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { workspaceId: effectiveWorkspaceId, ...form } }),
    onSuccess: (row: WorkspaceBrief) => {
      qc.setQueryData(["workspace-brief", activeWorkspaceId], row);
      qc.setQueryData(["workspace-brief", null], row);
      void refreshWorkspaces();
      setDirty(false);
      toast.success("Brief saved, next mission uses the new context");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function update(key: BriefFieldKey, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setDirty(true);
  }

  return (
    <div
      ref={scrollRef}
      className="bento"
      style={{
        padding: "var(--card-pad)",
        boxShadow: highlight
          ? "0 0 0 1px color-mix(in oklab, var(--ember) 35%, transparent)"
          : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <MonoLabel icon={Compass} style={{ marginBottom: 4 }}>
            Strategic brief
            {activeWorkspace?.name ? ` · ${activeWorkspace.name}` : ""}
          </MonoLabel>
          <p style={{ fontSize: 12, color: "var(--ink-subtle)", maxWidth: 520 }}>
            This brief is injected into every agent mission's system prompt. Changing it visibly
            changes what Discovery surfaces and what the Strategist writes. Keep it tight.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0 }}
          disabled={!dirty || save.isPending || isLoading}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : dirty ? "Save brief · next mission uses it" : "Saved"}
        </button>
      </div>

      {isLoading ? (
        <div className="mono-label" style={{ color: "var(--ink-faint)", padding: "16px 0" }}>
          loading…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {BRIEF_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`brief-${f.key}`} style={{ display: "block" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{f.label}</span>
                  <span
                    className="mono-label tabular-nums"
                    style={{ fontSize: 8.5, color: "var(--ink-faint)" }}
                  >
                    {form[f.key].length} chars
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>{f.hint}</p>
              </label>
              <textarea
                id={`brief-${f.key}`}
                className="input"
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                rows={f.rows}
                placeholder={f.placeholder}
                style={{ marginTop: 8, resize: "vertical" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Profile — the reference avatar header (initials chip + name +
   role · workspace) from real profile data, then the production identity
   form + working hours. The reference's notification-pref rows (gate
   alerts / daily brief / quiet hours / weekends) have no backend — omitted
   per the no-filler law. ---- */

function ProfileTab() {
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const fProfile = useServerFn(getProfile);
  const mUpdate = useServerFn(updateProfile);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fProfile() });

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [timezone, setTimezone] = useState("");
  const [whStart, setWhStart] = useState(9);
  const [whEnd, setWhEnd] = useState(18);

  useEffect(() => {
    const p = profile.data?.profile as {
      full_name?: string;
      display_name?: string;
      role?: string;
      timezone?: string;
      working_hours_start?: number;
      working_hours_end?: number;
    } | null;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setDisplayName(p.display_name ?? "");
    setRole(p.role ?? "AI Product Manager");
    setTimezone(p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setWhStart(p.working_hours_start ?? 9);
    setWhEnd(p.working_hours_end ?? 18);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      mUpdate({
        data: {
          full_name: fullName || undefined,
          display_name: displayName || undefined,
          role: role || undefined,
          timezone: timezone || undefined,
          working_hours_start: whStart,
          working_hours_end: whEnd,
          onboarded: true,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const name = displayName || fullName;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  if (profile.isLoading) {
    return (
      <div
        className="mono-label"
        style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-faint)" }}
      >
        loading…
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}
    >
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        {name ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 99,
                background: "var(--soft-stone)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {initials}
            </span>
            <div>
              <div style={{ fontWeight: 550 }}>{name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
                {role || "Member"}
                {activeWorkspace?.name ? ` · ${activeWorkspace.name}` : ""}
              </div>
            </div>
          </div>
        ) : null}

        <MonoLabel style={{ marginBottom: 12 }}>Identity</MonoLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Full name" hint="Used on documents, briefs, and stakeholder updates.">
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Q. Doe"
            />
          </Field>
          <Field label="Preferred display name" hint="How Cadence and your agents will greet you.">
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane"
            />
          </Field>
          <Field label="Role">
            <input
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="AI Product Manager"
            />
          </Field>
          <Field label="Timezone">
            <input
              className="input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
          </Field>
        </div>
      </div>

      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 12 }}>Working hours</MonoLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Start (24h)">
            <input
              className="input"
              type="number"
              min={0}
              max={23}
              value={whStart}
              onChange={(e) => setWhStart(Number(e.target.value))}
            />
          </Field>
          <Field label="End (24h)">
            <input
              className="input"
              type="number"
              min={1}
              max={24}
              value={whEnd}
              onChange={(e) => setWhEnd(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save · agents greet you by it"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      {children}
      {hint ? (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-faint)" }}>{hint}</div>
      ) : null}
    </label>
  );
}
