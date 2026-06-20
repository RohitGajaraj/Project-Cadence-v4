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
import { MonoLabel, StepDot, SurfaceHeader, TabRow } from "@/components/cadence/Primitives";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { listProjects } from "@/lib/projects.functions";
import { listAgents } from "@/lib/agents.functions";
import { MODELS } from "@/lib/ai/models";
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
  getMyCreditsView,
} from "@/lib/payments.functions";
import { planPresentation, PLAN_TIERS, type PlanTier } from "@/lib/entitlements";
import { defaultMonthlyLookupKey } from "@/lib/billing-tier";
import { StripeEmbeddedCheckout } from "@/components/billing/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/billing/PaymentTestModeBanner";
import { getStripeEnvironment } from "@/lib/stripe";
import { useConfirm } from "@/hooks/use-confirm";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { DataExportCard } from "@/components/settings/DataExportCard";
import { SubprocessorsCard } from "@/components/settings/SubprocessorsCard";
import { MembersCard } from "@/components/settings/MembersCard";
import { TeamCard } from "@/components/settings/TeamCard";

type SectionId =
  | "connections"
  | "ai"
  | "staff"
  | "workspace"
  | "billing"
  | "credits"
  | "interop"
  | "profile"
  | "data";

// Tab order from the reference (Connectors · Models · Staff · … · Profile).
// "Accounts" is the account-level OAuth surface (which provider logins you have
// connected); it is deliberately NOT called "Connectors"/"Connections" so it no
// longer near-collides with the /sync "Connectors" surface, which owns the
// distinct workspace-level resource bindings + sync conflicts (Phase-2 IA
// de-collision, 2026-06-16; CLAUDE.md calls this "Connected accounts"). The id
// stays "connections" so existing deep links (?section=connections) keep
// working; likewise "ai" stays the id behind the Models label, and Workspace is
// production-only.
const TABS: { id: SectionId; label: string }[] = [
  { id: "connections", label: "Accounts" },
  { id: "ai", label: "Models" },
  { id: "staff", label: "Staff" },
  { id: "workspace", label: "Workspace" },
  { id: "billing", label: "Plan" },
  { id: "credits", label: "Credits" },
  { id: "interop", label: "Integrations" },
  { id: "profile", label: "Profile" },
  { id: "data", label: "Data" },
];

// Legacy deep links still arrive with the old section values. Map them so
// /settings?section=brief and /settings?section=calendar keep landing on the
// right content (calendar accounts live inside AccountConnectionsSection).
const LEGACY_SECTION_MAP: Record<string, SectionId> = {
  brief: "workspace",
  calendar: "connections",
};

function normalizeSection(raw: string | undefined): SectionId {
  if (!raw) return "connections";
  const mapped = LEGACY_SECTION_MAP[raw];
  if (mapped) return mapped;
  return TABS.some((s) => s.id === raw) ? (raw as SectionId) : "connections";
}

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
        <TabRow tabs={TABS} active={active} onSet={setTab} />

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
  const confirm = useConfirm();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState<string>("Checkout");

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

  const mySub = useQuery({
    queryKey: ["my-subscription", envSafe],
    queryFn: () => fGetSub({ data: { environment: envSafe! } }),
    enabled: !!envSafe,
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

  function openCheckout(lookupKey: string, title: string) {
    try {
      getStripeEnvironment(); // throws if token missing
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payments are not configured.");
      return;
    }
    setCheckoutKey(lookupKey);
    setCheckoutTitle(title);
    setCheckoutOpen(true);
  }

  const cancelSub = useMutation({
    mutationFn: () => fCancelSub({ data: { environment: envSafe! } }),
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
    mutationFn: () => fResumeSub({ data: { environment: envSafe! } }),
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
  const sub = mySub.data;
  const hasSub = !!sub?.hasSubscription;
  const renews = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const renewsLabel = renews
    ? renews.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PaymentTestModeBanner />
      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Current plan
        </div>
        <div className="font-display" style={{ fontSize: 20, marginTop: 4 }}>
          {current.name}
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted, #4a4438)", margin: "6px 0 0" }}>
          {current.tagline}
        </p>
        {state && !state.stripeConfigured && (
          <p style={{ fontSize: 11.5, color: "var(--ink-subtle, #6b6457)", marginTop: 10 }}>
            Paid plans turn on once billing is connected. Nothing is charged yet.
          </p>
        )}
        {state && !state.isOwner && (
          <p style={{ fontSize: 11.5, color: "var(--ink-subtle, #6b6457)", marginTop: 10 }}>
            Only the workspace owner can change the plan.
          </p>
        )}
        {state && state.isOwner && hasSub && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12 }}>
              <div>
                <div
                  className="mono-label"
                  style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}
                >
                  Status
                </div>
                <div style={{ marginTop: 2, color: "var(--ink, #1d1a14)" }}>
                  {sub?.cancelAtPeriodEnd
                    ? "Cancels at period end"
                    : sub?.status === "past_due"
                      ? "Payment issue, retrying"
                      : "Active"}
                </div>
              </div>
              {renewsLabel && (
                <div>
                  <div
                    className="mono-label"
                    style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}
                  >
                    {sub?.cancelAtPeriodEnd ? "Access until" : "Renews on"}
                  </div>
                  <div style={{ marginTop: 2, color: "var(--ink, #1d1a14)" }}>{renewsLabel}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {sub?.cancelAtPeriodEnd ? (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={resumeSub.isPending}
                  onClick={() => resumeSub.mutate()}
                >
                  {resumeSub.isPending ? "Resuming" : "Resume subscription"}
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={cancelSub.isPending}
                  onClick={onCancelClick}
                >
                  {cancelSub.isPending ? "Canceling" : "Cancel subscription"}
                </button>
              )}
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", margin: 0 }}>
              To switch tiers, pick a different plan below. Changes take effect at the start of your
              next billing period.
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {PLAN_TIERS.map((tier) => {
          const p = planPresentation(tier);
          const isCurrent = tier === currentTier;
          const isPaidTier = tier === "pro" || tier === "max" || tier === "team";
          const canSelect = isPaidTier && !isCurrent && (state?.isOwner ?? false);
          const lookupKey = isPaidTier ? defaultMonthlyLookupKey(tier) : null;
          return (
            <div
              key={tier}
              className="bento"
              style={{
                padding: "var(--card-pad, 18px)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}
              >
                <span className="font-display" style={{ fontSize: 16 }}>
                  {p.name}
                </span>
                <span
                  className="mono-label"
                  style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)" }}
                >
                  {p.price}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)", margin: 0 }}>
                {p.tagline}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                {p.highlights.map((h) => (
                  <li
                    key={h}
                    style={{
                      fontSize: 12,
                      color: "var(--ink-muted, #4a4438)",
                      display: "flex",
                      gap: 7,
                    }}
                  >
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 99,
                        background: "var(--ink-faint, #8a8377)",
                        display: "inline-block",
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: "auto", paddingTop: 6 }}>
                {isCurrent ? (
                  <span
                    className="mono-label"
                    style={{ fontSize: 10, color: "var(--emerald, #2f8f6b)" }}
                  >
                    Your plan
                  </span>
                ) : canSelect && lookupKey ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openCheckout(lookupKey, `Subscribe to ${p.name}`)}
                  >
                    {currentTier === "free" ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                  </button>
                ) : tier === "enterprise" ? (
                  <a
                    className="btn btn-ghost btn-sm"
                    href="mailto:sales@cadence.app?subject=Cosmos%20enquiry"
                  >
                    Contact sales
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {state?.isOwner && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate({ search: { section: "credits" } })}
          >
            Need more credits? Buy a top-up &rarr;
          </button>
        </div>
      )}

      {checkoutKey ? (
        <StripeEmbeddedCheckout
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          priceLookupKey={checkoutKey}
          title={checkoutTitle}
        />
      ) : null}
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
  const fGetCredits = useServerFn(getMyCreditsView);

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

  const BUNDLES = [
    { key: "topup_250", credits: 250, price: "$5" },
    { key: "topup_1k", credits: 1000, price: "$18" },
    { key: "topup_2_5k", credits: 2500, price: "$40" },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PaymentTestModeBanner />

      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Balance
        </div>
        <div className="font-display" style={{ fontSize: 28, marginTop: 4 }}>
          {data ? (data.balanceCredits + data.topupCredits).toLocaleString() : "—"}
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

      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          One-time top-ups
        </div>
        <div className="font-display" style={{ fontSize: 16, marginTop: 4 }}>
          Buy credits without changing your plan
        </div>
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            marginTop: 12,
          }}
        >
          {BUNDLES.map((b) => {
            const wouldExceed = remainingTopupRoom !== null && b.credits > remainingTopupRoom;
            return (
              <button
                key={b.key}
                className="btn btn-ghost btn-sm"
                disabled={wouldExceed}
                onClick={() => openTopUp(b.key, `Top-up: ${b.credits.toLocaleString()} credits`)}
                title={
                  wouldExceed ? "This bundle would exceed your per-cycle top-up limit." : undefined
                }
              >
                {b.credits.toLocaleString()} credits &middot; {b.price}
              </button>
            );
          })}
        </div>
        {data && (
          <p style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)", margin: "10px 0 0" }}>
            This cycle: {data.cycleTopupCredits.toLocaleString()} of{" "}
            {data.cycleTopupCapCredits.toLocaleString()} top-up credits used.
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
              {current?.label ?? defaultModel}
            </span>
            <span className="mono-label" style={{ fontSize: 9 }}>
              {current ? (current.live ? "gateway" : "byo") : "unknown"}
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
              <optgroup label="Live (Lovable AI Gateway)">
                {MODELS.filter((m) => m.live).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.desc}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Bring your own key (coming soon)">
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
        Connect Claude, DeepSeek, Grok, Ollama, OpenAI direct, or a GitHub PAT. Stored encrypted per
        user.
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
            placeholder="Base URL (Ollama only)"
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

type AgentRow = { id: string; slug: string; name: string; role: string; enabled: boolean };

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
          style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}
        >
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
