/**
 * Admin pricing editor: edit subscription bundles per tier and top-up bundles.
 * Stripe price IDs are optional fields; if blank, the checkout falls back to
 * the convention-based `lookup_key` (see billing-tier.lookupKeyFor).
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
  type PricingBundle,
  type TopupBundle,
} from "@/lib/pricing.functions";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  component: AdminPricing,
});

const TIER_LABELS: Record<string, string> = {
  pro: "Cluster (Pro)",
  max: "Constellation (Max)",
  team: "Galaxy (Team)",
};

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid var(--hairline, rgba(0,0,0,0.12))",
    borderRadius: 6,
    fontSize: 12.5,
    background: "var(--canvas, #fbf7ef)",
  };
}

function AdminPricing() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fGetCatalog = useServerFn(getPricingCatalog);
  const catalog = useQuery({ queryKey: ["pricing-catalog"], queryFn: () => fGetCatalog() });

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
        Edits go live immediately and reflect in Settings -&gt; Plan on the user's next view.
        Leaving Stripe price IDs blank uses the convention-based lookup_key
        (e.g. <code>cluster_1k_monthly</code>).
      </p>

      {(["pro", "max", "team"] as const).map((tier) => (
        <TierSection
          key={tier}
          tier={tier}
          rows={bundlesByTier[tier] ?? []}
          onSaved={() => qc.invalidateQueries({ queryKey: ["pricing-catalog"] })}
          confirm={confirm}
        />
      ))}

      <TopupSection
        rows={catalog.data?.topups ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["pricing-catalog"] })}
        confirm={confirm}
      />
    </div>
  );
}

type Confirm = ReturnType<typeof useConfirm>;

function TierSection({
  tier,
  rows,
  onSaved,
  confirm,
}: {
  tier: "pro" | "max" | "team";
  rows: PricingBundle[];
  onSaved: () => void;
  confirm: Confirm;
}) {
  const fUpsert = useServerFn(adminUpsertBundle);
  const fDelete = useServerFn(adminDeleteBundle);

  const upsert = useMutation({
    mutationFn: (input: Parameters<typeof fUpsert>[0]["data"]) => fUpsert({ data: input }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved.");
      onSaved();
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Removed.");
      onSaved();
    },
  });

  return (
    <div className="bento" style={{ padding: 22, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="font-display" style={{ fontSize: 18 }}>{TIER_LABELS[tier]}</div>
        <span className="mono-label" style={{ fontSize: 9, color: "var(--ink-subtle)" }}>
          {rows.length} bundle{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
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
          <BundleRow key={r.id} tier={tier} row={r} onSave={upsert.mutate} onDelete={(id) => {
            void (async () => {
              const ok = await confirm({
                title: `Delete ${r.credits.toLocaleString()} credit bundle?`,
                body: "This bundle stops appearing in the plan picker.",
                confirmLabel: "Delete",
                destructive: true,
              });
              if (ok) del.mutate(id);
            })();
          }} />
        ))}

        <BundleRow tier={tier} row={null} onSave={upsert.mutate} onDelete={() => {}} />
      </div>
    </div>
  );
}

function BundleRow({
  tier,
  row,
  onSave,
  onDelete,
}: {
  tier: "pro" | "max" | "team";
  row: PricingBundle | null;
  onSave: (input: Parameters<typeof adminUpsertBundle>[0]["data"]) => void;
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
      setCredits(0);
      setMonthly(0);
      setYearly(0);
      setPriceM("");
      setPriceY("");
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
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(row.id)}
            style={{ fontSize: 11, padding: "4px 8px" }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

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
    mutationFn: (input: Parameters<typeof fUpsert>[0]["data"]) => fUpsert({ data: input }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved.");
      onSaved();
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
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
        <TopupRow key={r.id} row={r} onSave={upsert.mutate} onDelete={(id) => {
          void (async () => {
            const ok = await confirm({
              title: `Delete ${r.credits.toLocaleString()} top-up?`,
              confirmLabel: "Delete",
              destructive: true,
            });
            if (ok) del.mutate(id);
          })();
        }} />
      ))}
      <TopupRow row={null} onSave={upsert.mutate} onDelete={() => {}} />
    </div>
  );
}

function TopupRow({
  row,
  onSave,
  onDelete,
}: {
  row: TopupBundle | null;
  onSave: (input: Parameters<typeof adminUpsertTopup>[0]["data"]) => void;
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
    if (!row) {
      setCredits(0);
      setPrice(0);
      setStripeId("");
    }
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
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(row.id)}
            style={{ fontSize: 11, padding: "4px 8px" }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}