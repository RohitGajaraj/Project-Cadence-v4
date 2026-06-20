import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getPricingCatalog,
  adminUpsertTopupBundle,
  adminSetBundleActive,
  type TopupBundle,
} from "@/lib/pricing.functions";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  component: AdminPricing,
});

function AdminPricing() {
  const fetchCatalog = useServerFn(getPricingCatalog);
  const upsertTopup = useServerFn(adminUpsertTopupBundle);
  const setActive = useServerFn(adminSetBundleActive);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["pricing-catalog"], queryFn: () => fetchCatalog() });

  const upsertM = useMutation({
    mutationFn: (b: { id?: string; credits: number; price_cents: number; sort_order: number; active: boolean }) =>
      upsertTopup({ data: b }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-catalog"] });
      toast.success("Top-up saved.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not save top-up."),
  });

  const toggleBundleM = useMutation({
    mutationFn: (b: { id: string; active: boolean }) => setActive({ data: b }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-catalog"] });
      toast.success("Bundle updated.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not update bundle."),
  });

  if (q.isLoading) return <div style={{ fontSize: 13 }}>Loading catalog…</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <TopupSection
        rows={q.data?.topups ?? []}
        onSave={(b) => upsertM.mutate(b)}
        saving={upsertM.isPending}
      />
      <BundlesSection
        rows={q.data?.bundles ?? []}
        onToggle={(id, active) => toggleBundleM.mutate({ id, active })}
      />
    </div>
  );
}

function TopupSection({
  rows,
  onSave,
  saving,
}: {
  rows: TopupBundle[];
  onSave: (b: {
    id?: string;
    credits: number;
    price_cents: number;
    sort_order: number;
    active: boolean;
  }) => void;
  saving: boolean;
}) {
  return (
    <div className="bento" style={{ padding: 18 }}>
      <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
        One-time top-up bundles
      </div>
      <div className="font-display" style={{ fontSize: 16, marginTop: 4, marginBottom: 12 }}>
        These appear in Settings · Credits
      </div>
      <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--ink-subtle, #6b6457)" }}>
            <th style={{ padding: "6px 8px" }}>Credits</th>
            <th style={{ padding: "6px 8px" }}>Price (USD)</th>
            <th style={{ padding: "6px 8px" }}>Sort</th>
            <th style={{ padding: "6px 8px" }}>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} row={r} onSave={onSave} saving={saving} />
          ))}
          <Row onSave={onSave} saving={saving} />
        </tbody>
      </table>
    </div>
  );
}

function Row({
  row,
  onSave,
  saving,
}: {
  row?: TopupBundle;
  onSave: (b: {
    id?: string;
    credits: number;
    price_cents: number;
    sort_order: number;
    active: boolean;
  }) => void;
  saving: boolean;
}) {
  const [credits, setCredits] = useState(row?.credits?.toString() ?? "");
  const [price, setPrice] = useState(row ? (row.price_cents / 100).toString() : "");
  const [sort, setSort] = useState(row?.sort_order?.toString() ?? "0");
  const [active, setActive] = useState(row?.active ?? true);

  const cellPad = "6px 8px";
  return (
    <tr style={{ borderTop: "1px solid var(--hairline, rgba(0,0,0,0.06))" }}>
      <td style={{ padding: cellPad }}>
        <input
          className="input"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          style={{ width: 90 }}
          placeholder="e.g. 1000"
        />
      </td>
      <td style={{ padding: cellPad }}>
        <input
          className="input"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={{ width: 80 }}
          placeholder="e.g. 18"
        />
      </td>
      <td style={{ padding: cellPad }}>
        <input
          className="input"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ width: 60 }}
        />
      </td>
      <td style={{ padding: cellPad }}>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </td>
      <td style={{ padding: cellPad, textAlign: "right" }}>
        <button
          className="btn btn-sm"
          disabled={saving}
          onClick={() => {
            const c = Number(credits);
            const p = Math.round(Number(price) * 100);
            if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(p) || p <= 0) {
              toast.error("Enter valid credits and price.");
              return;
            }
            onSave({
              id: row?.id,
              credits: c,
              price_cents: p,
              sort_order: Number(sort) || 0,
              active,
            });
          }}
        >
          {row ? "Save" : "Add"}
        </button>
      </td>
    </tr>
  );
}

function BundlesSection({
  rows,
  onToggle,
}: {
  rows: {
    id: string;
    tier: string;
    credits: number;
    monthly_cents: number;
    yearly_cents: number;
    active: boolean;
    recommended: boolean;
  }[];
  onToggle: (id: string, active: boolean) => void;
}) {
  return (
    <div className="bento" style={{ padding: 18 }}>
      <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
        Subscription bundles
      </div>
      <div className="font-display" style={{ fontSize: 16, marginTop: 4, marginBottom: 12 }}>
        Toggle bundle availability
      </div>
      <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--ink-subtle, #6b6457)" }}>
            <th style={{ padding: "6px 8px" }}>Tier</th>
            <th style={{ padding: "6px 8px" }}>Credits</th>
            <th style={{ padding: "6px 8px" }}>Monthly</th>
            <th style={{ padding: "6px 8px" }}>Yearly</th>
            <th style={{ padding: "6px 8px" }}>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} style={{ borderTop: "1px solid var(--hairline, rgba(0,0,0,0.06))" }}>
              <td style={{ padding: "6px 8px" }}>
                {b.tier} {b.recommended && <span style={{ fontSize: 10 }}>★</span>}
              </td>
              <td style={{ padding: "6px 8px" }}>{b.credits.toLocaleString()}</td>
              <td style={{ padding: "6px 8px" }}>${(b.monthly_cents / 100).toFixed(2)}</td>
              <td style={{ padding: "6px 8px" }}>${(b.yearly_cents / 100).toFixed(2)}</td>
              <td style={{ padding: "6px 8px" }}>{b.active ? "Yes" : "No"}</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onToggle(b.id, !b.active)}>
                  {b.active ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}