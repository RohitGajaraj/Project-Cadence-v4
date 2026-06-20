/**
 * Admin pricing editor:
 *   - Plans (tiers) CRUD — add a new tier (e.g. "Nebula") without a deploy
 *   - Subscription bundles per tier
 *   - Top-up bundles
 *
 * Stripe price IDs are optional. If blank, the checkout uses the
 * convention-based lookup_key (billing-tier.lookupKeyFor) for known tiers
 * (pro / max / team). Custom tiers must set explicit Stripe price IDs.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/hooks/use-confirm";
import {
  getPricingCatalog,
  adminUpsertBundle,
  adminDeleteBundle,
  adminUpsertTopup,
  adminDeleteTopup,
  adminUpsertPlan,
  adminDeletePlan,
  type PricingPlan,
  type PricingBundle,
  type TopupBundle,
} from "@/lib/pricing.functions";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  component: AdminPricing,
});

type Confirm = ReturnType<typeof useConfirm>;

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid var(--hairline, rgba(0,0,0,0.12))",
    borderRadius: 6,
    fontSize: 12.5,
    background: "var(--canvas, #fbf7ef)",
    color: "var(--ink, #1d1a14)",
    ...extra,
  };
}

function AdminPricing() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fGetCatalog = useServerFn(getPricingCatalog);
  const catalog = useQuery({ queryKey: ["pricing-catalog"], queryFn: () => fGetCatalog() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pricing-catalog"] });

  const plans = (catalog.data?.plans ?? []).slice().sort((a, b) => {
    const rank = (p: PricingPlan) =>
      p.tier === "free" ? -1 : p.tier === "enterprise" ? 9999 : p.sort_order;
    return rank(a) - rank(b);
  });
  const paidPlans = plans.filter((p) => p.tier !== "free" && p.tier !== "enterprise");

  const bundlesByTier = useMemo(() => {
    const map: Record<string, PricingBundle[]> = {};
    for (const b of catalog.data?.bundles ?? []) {
      (map[b.tier] ||= []).push(b);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.credits - b.credits);
    return map;
  }, [catalog.data]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <p style={{ fontSize: 12, color: "var(--ink-muted, #4a4438)", margin: 0 }}>
        Changes go live immediately and show up in Settings → Plan on the user's next view.
        Stripe price IDs are optional for known tiers (pro / max / team) and required for any custom tier.
      </p>

      <PlansSection plans={plans} onSaved={invalidate} confirm={confirm} bundlesByTier={bundlesByTier} />

      {paidPlans.map((plan) => (
        <TierSection
          key={plan.tier}
          plan={plan}
          rows={bundlesByTier[plan.tier] ?? []}
          onSaved={invalidate}
          confirm={confirm}
        />
      ))}

      <TopupSection
        rows={catalog.data?.topups ?? []}
        onSaved={invalidate}
        confirm={confirm}
      />
    </div>
  );
}

// ─── Plans (tiers) ──────────────────────────────────────────────────────────

function PlansSection({
  plans,
  bundlesByTier,
  onSaved,
  confirm,
}: {
  plans: PricingPlan[];
  bundlesByTier: Record<string, PricingBundle[]>;
  onSaved: () => void;
  confirm: Confirm;
}) {
  const fUpsert = useServerFn(adminUpsertPlan);
  const fDelete = useServerFn(adminDeletePlan);

  const upsert = useMutation({
    mutationFn: (input: {
      tier: string;
      display_name: string;
      tagline?: string | null;
      audience?: string;
      sort_order?: number;
      recommended?: boolean;
      active?: boolean;
    }) => fUpsert({ data: input }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Saved.");
      onSaved();
    },
  });

  const del = useMutation({
    mutationFn: (tier: string) => fDelete({ data: { tier } }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Removed.");
      onSaved();
    },
  });

  return (
    <div className="bento" style={{ padding: 22, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="font-display" style={{ fontSize: 18 }}>Plan tiers</div>
        <span className="mono-label" style={{ fontSize: 9, color: "var(--ink-subtle)" }}>
          {plans.length} {plans.length === 1 ? "tier" : "tiers"} · one "Most popular"
        </span>
      </div>

      <div
        className="mono-label"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr 2fr 60px 70px 70px 100px",
          gap: 8,
          fontSize: 9,
          color: "var(--ink-faint)",
          padding: "0 4px",
        }}
      >
        <span>Slug</span>
        <span>Display name</span>
        <span>Tagline</span>
        <span>Sort</span>
        <span>Popular</span>
        <span>Active</span>
        <span></span>
      </div>

      {plans.map((p) => (
        <PlanRow
          key={p.tier}
          row={p}
          hasBundles={(bundlesByTier[p.tier]?.length ?? 0) > 0}
          onSave={(input) => upsert.mutate(input)}
          onDelete={(tier) => {
            void (async () => {
              const ok = await confirm({
                title: `Delete tier "${p.display_name}"?`,
                body: "This removes the plan from the picker. Bundles must be deleted first.",
                confirmLabel: "Delete",
                destructive: true,
              });
              if (ok) del.mutate(tier);
            })();
          }}
        />
      ))}

      <PlanRow row={null} hasBundles={false} onSave={(input) => upsert.mutate(input)} onDelete={() => {}} />
    </div>
  );
}

function PlanRow({
  row,
  hasBundles,
  onSave,
  onDelete,
}: {
  row: PricingPlan | null;
  hasBundles: boolean;
  onSave: (input: {
    tier: string;
    display_name: string;
    tagline?: string | null;
    audience?: string;
    sort_order?: number;
    recommended?: boolean;
    active?: boolean;
  }) => void;
  onDelete: (tier: string) => void;
}) {
  const [tier, setTier] = useState(row?.tier ?? "");
  const [name, setName] = useState(row?.display_name ?? "");
  const [tagline, setTagline] = useState(row?.tagline ?? "");
  const [sort, setSort] = useState(row?.sort_order ?? 50);
  const [recommended, setRecommended] = useState(row?.recommended ?? false);
  const [active, setActive] = useState(row?.active ?? true);

  function save() {
    const slug = tier.trim().toLowerCase();
    if (!slug || !name.trim()) {
      toast.error("Slug and display name are required.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(slug)) {
      toast.error("Slug must be lowercase letters, numbers, or underscores.");
      return;
    }
    onSave({
      tier: slug,
      display_name: name.trim(),
      tagline: tagline.trim() || null,
      audience: row?.audience ?? "general",
      sort_order: sort,
      recommended,
      active,
    });
    if (!row) {
      setTier(""); setName(""); setTagline(""); setSort(50);
      setRecommended(false); setActive(true);
    }
  }

  const slugLocked = !!row;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.2fr 2fr 60px 70px 70px 100px",
        gap: 8,
        padding: "6px 4px",
        borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.06))",
        alignItems: "center",
      }}
    >
      <input
        style={inputStyle({ opacity: slugLocked ? 0.7 : 1 })}
        value={tier}
        readOnly={slugLocked}
        onChange={(e) => setTier(e.target.value)}
        placeholder="nebula"
      />
      <input style={inputStyle()} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nebula" />
      <input style={inputStyle()} value={tagline ?? ""} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline shown under the name" />
      <input style={inputStyle()} type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} />
      <input type="checkbox" checked={recommended} onChange={(e) => setRecommended(e.target.checked)} title="Most popular (only one)" />
      <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn btn-primary btn-sm" onClick={save} style={{ fontSize: 11, padding: "4px 8px" }}>
          {row ? "Save" : "Add"}
        </button>
        {row ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(row.tier)}
            disabled={hasBundles}
            title={hasBundles ? "Delete bundles first" : undefined}
            style={{ fontSize: 11, padding: "4px 8px" }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Bundles per tier ───────────────────────────────────────────────────────

function TierSection({
  plan,
  rows,
  onSaved,
  confirm,
}: {
  plan: PricingPlan;
  rows: PricingBundle[];
  onSaved: () => void;
  confirm: Confirm;
}) {
  const fUpsert = useServerFn(adminUpsertBundle);
  const fDelete = useServerFn(adminDeleteBundle);

  const upsert = useMutation({
    mutationFn: (input: {
      id?: string | null;
      tier: string;
      credits: number;
      monthly_cents: number;
      yearly_cents: number;
      stripe_price_id_monthly?: string | null;
      stripe_price_id_yearly?: string | null;
      recommended?: boolean;
      active?: boolean;
      sort_order?: number;
    }) => fUpsert({ data: input }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Saved.");
      onSaved();
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Removed.");
      onSaved();
    },
  });

  return (
    <div className="bento" style={{ padding: 22, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="font-display" style={{ fontSize: 18 }}>{plan.display_name}</div>
        <span className="mono-label" style={{ fontSize: 9, color: "var(--ink-subtle)" }}>
          tier:{plan.tier} · {rows.length} bundle{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        className="mono-label"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 70px 90px",
          gap: 8,
          fontSize: 9,
          color: "var(--ink-faint)",
          padding: "0 4px",
        }}
      >
        <span>Credits</span>
        <span>Monthly $</span>
        <span>Yearly $</span>
        <span>Stripe price (monthly)</span>
        <span>Stripe price (yearly)</span>
        <span>Active</span>
        <span></span>
      </div>

      {rows.map((r) => (
        <BundleRow
          key={r.id}
          tier={plan.tier}
          row={r}
          onSave={(input) => upsert.mutate(input)}
          onDelete={(id) => {
            void (async () => {
              const ok = await confirm({
                title: `Delete ${r.credits.toLocaleString()} credit bundle?`,
                body: "This bundle stops appearing in the plan picker.",
                confirmLabel: "Delete",
                destructive: true,
              });
              if (ok) del.mutate(id);
            })();
          }}
        />
      ))}

      <BundleRow tier={plan.tier} row={null} onSave={(input) => upsert.mutate(input)} onDelete={() => {}} />
    </div>
  );
}

function BundleRow({
  tier,
  row,
  onSave,
  onDelete,
}: {
  tier: string;
  row: PricingBundle | null;
  onSave: (input: {
    id?: string | null;
    tier: string;
    credits: number;
    monthly_cents: number;
    yearly_cents: number;
    stripe_price_id_monthly?: string | null;
    stripe_price_id_yearly?: string | null;
    recommended?: boolean;
    active?: boolean;
    sort_order?: number;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [credits, setCredits] = useState(row?.credits ?? 0);
  const [monthly, setMonthly] = useState(row ? row.monthly_cents / 100 : 0);
  const [yearly, setYearly] = useState(row ? row.yearly_cents / 100 : 0);
  const [priceM, setPriceM] = useState(row?.stripe_price_id_monthly ?? "");
  const [priceY, setPriceY] = useState(row?.stripe_price_id_yearly ?? "");
  const [active, setActive] = useState(row?.active ?? true);

  function save() {
    if (!credits || credits < 1) {
      toast.error("Credits must be at least 1.");
      return;
    }
    onSave({
      id: row?.id ?? null,
      tier,
      credits,
      monthly_cents: Math.round(monthly * 100),
      yearly_cents: Math.round(yearly * 100),
      stripe_price_id_monthly: priceM.trim() || null,
      stripe_price_id_yearly: priceY.trim() || null,
      recommended: row?.recommended ?? false,
      active,
      sort_order: row?.sort_order ?? 99,
    });
    if (!row) {
      setCredits(0); setMonthly(0); setYearly(0); setPriceM(""); setPriceY("");
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 70px 90px",
        gap: 8,
        padding: "6px 4px",
        borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.06))",
        alignItems: "center",
      }}
    >
      <input style={inputStyle()} type="number" value={credits} onChange={(e) => setCredits(Number(e.target.value))} />
      <input style={inputStyle()} type="number" step="0.01" value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} />
      <input style={inputStyle()} type="number" step="0.01" value={yearly} onChange={(e) => setYearly(Number(e.target.value))} />
      <input style={inputStyle()} value={priceM} onChange={(e) => setPriceM(e.target.value)} placeholder="price_..." />
      <input style={inputStyle()} value={priceY} onChange={(e) => setPriceY(e.target.value)} placeholder="price_..." />
      <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn btn-primary btn-sm" onClick={save} style={{ fontSize: 11, padding: "4px 8px" }}>
          {row ? "Save" : "Add"}
        </button>
        {row ? (
          <button className="btn btn-ghost btn-sm" onClick={() => onDelete(row.id)} style={{ fontSize: 11, padding: "4px 8px" }}>×</button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Top-ups ────────────────────────────────────────────────────────────────

function TopupSection({
  rows,
  onSaved,
  confirm,
}: {
  rows: TopupBundle[];
  onSaved: () => void;
  confirm: Confirm;
}) {
  const fUpsert = useServerFn(adminUpsertTopup);
  const fDelete = useServerFn(adminDeleteTopup);

  const upsert = useMutation({
    mutationFn: (input: { id?: string | null; credits: number; price_cents: number; stripe_price_id?: string | null; active?: boolean; sort_order?: number; }) =>
      fUpsert({ data: input }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Saved.");
      onSaved();
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: (res) => {
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Removed.");
      onSaved();
    },
  });

  return (
    <div className="bento" style={{ padding: 22, display: "grid", gap: 12 }}>
      <div className="font-display" style={{ fontSize: 18 }}>Top-up bundles</div>
      <div
        className="mono-label"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 2fr 70px 90px",
          gap: 8,
          fontSize: 9,
          color: "var(--ink-faint)",
          padding: "0 4px",
        }}
      >
        <span>Credits</span>
        <span>Price $</span>
        <span>Stripe price id</span>
        <span>Active</span>
        <span></span>
      </div>
      {rows.map((r) => (
        <TopupRow
          key={r.id}
          row={r}
          onSave={(input) => upsert.mutate(input)}
          onDelete={(id) => {
            void (async () => {
              const ok = await confirm({
                title: `Delete ${r.credits.toLocaleString()} top-up?`,
                confirmLabel: "Delete",
                destructive: true,
              });
              if (ok) del.mutate(id);
            })();
          }}
        />
      ))}
      <TopupRow row={null} onSave={(input) => upsert.mutate(input)} onDelete={() => {}} />
    </div>
  );
}

function TopupRow({
  row,
  onSave,
  onDelete,
}: {
  row: TopupBundle | null;
  onSave: (input: { id?: string | null; credits: number; price_cents: number; stripe_price_id?: string | null; active?: boolean; sort_order?: number; }) => void;
  onDelete: (id: string) => void;
}) {
  const [credits, setCredits] = useState(row?.credits ?? 0);
  const [price, setPrice] = useState(row ? row.price_cents / 100 : 0);
  const [stripeId, setStripeId] = useState(row?.stripe_price_id ?? "");
  const [active, setActive] = useState(row?.active ?? true);

  function save() {
    if (!credits || credits < 1) {
      toast.error("Credits must be at least 1.");
      return;
    }
    onSave({
      id: row?.id ?? null,
      credits,
      price_cents: Math.round(price * 100),
      stripe_price_id: stripeId.trim() || null,
      active,
      sort_order: row?.sort_order ?? 99,
    });
    if (!row) { setCredits(0); setPrice(0); setStripeId(""); }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 2fr 70px 90px",
        gap: 8,
        padding: "6px 4px",
        borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.06))",
        alignItems: "center",
      }}
    >
      <input style={inputStyle()} type="number" value={credits} onChange={(e) => setCredits(Number(e.target.value))} />
      <input style={inputStyle()} type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
      <input style={inputStyle()} value={stripeId} onChange={(e) => setStripeId(e.target.value)} placeholder="price_..." />
      <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn btn-primary btn-sm" onClick={save} style={{ fontSize: 11, padding: "4px 8px" }}>
          {row ? "Save" : "Add"}
        </button>
        {row ? (
          <button className="btn btn-ghost btn-sm" onClick={() => onDelete(row.id)} style={{ fontSize: 11, padding: "4px 8px" }}>×</button>
        ) : null}
      </div>
    </div>
  );
}
