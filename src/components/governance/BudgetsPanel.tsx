// Budgets tab — ported 1:1 from design-reference/cadence/loop.jsx
// (GovernScreen tab "Budgets"): 2-col bentos for Today + the current month —
// mono label, "edit cap" blue mono toggle that becomes the inline 76px-input
// form, serif 30 "$burn of $cap", the 5px progress bar (rose >80% else
// ember) and the note row. The reference's projections are omitted —
// production computes none. The span-2 explainer copy is corrected to what
// production actually enforces (no $5 spend-ceiling guardrail exists; the
// real second limiter is per-mission caps). Production functionality kept:
// token caps + alert threshold, per-surface caps (add / toggle / remove),
// and budget alerts with acknowledge — restyled quiet-Ember.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Gauge, Shield } from "lucide-react";
import { toast } from "@/lib/notify";
import {
  getBudgetOverview,
  updateGlobalBudget,
  upsertSurfaceBudget,
  deleteSurfaceBudget,
  acknowledgeAlert,
} from "@/lib/budgets.functions";
import { MonoLabel, VerdictChip } from "@/components/cadence/Primitives";
import { relTime, fmtUsd } from "@/components/product/format";

const SURFACES = [
  "agent",
  "chat",
  "copilot",
  "prd",
  "discovery",
  "studio",
  "brief",
  "eval",
  "judge",
  "embed",
  "scheduler",
];

const SURFACE_GRID = "1fr 160px 160px 120px";

type GlobalBudget = {
  daily_usd_cap: number | string | null;
  monthly_usd_cap: number | string | null;
  daily_token_cap: number | string | null;
  monthly_token_cap: number | string | null;
  alert_at_pct: number | null;
  daily_usd_used?: number | string | null;
  monthly_usd_used?: number | string | null;
};

type SurfaceRow = {
  surface: string;
  daily_usd_cap: number | string | null;
  monthly_usd_cap: number | string | null;
  enabled: boolean;
  daily_usd_used: number | string;
  monthly_usd_used: number | string;
};

type AlertRow = {
  id: string;
  kind: string;
  scope: string;
  surface: string | null;
  window_kind: string;
  pct: number | string;
  usd_used: number | string;
  usd_cap: number | string;
  created_at: string;
  acknowledged: boolean;
};

/** Full payload for updateGlobalBudget with one field replaced — the server
    schema wants every cap on each write. */
function globalPayload(g: GlobalBudget | null, patch: Partial<Record<string, number | null>>) {
  return {
    daily_usd_cap: g?.daily_usd_cap != null ? Number(g.daily_usd_cap) : null,
    monthly_usd_cap: g?.monthly_usd_cap != null ? Number(g.monthly_usd_cap) : null,
    daily_token_cap: g?.daily_token_cap != null ? Number(g.daily_token_cap) : null,
    monthly_token_cap: g?.monthly_token_cap != null ? Number(g.monthly_token_cap) : null,
    alert_at_pct: g?.alert_at_pct ?? 80,
    ...patch,
  };
}

export function BudgetsPanel() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getBudgetOverview);
  const saveGlobal = useServerFn(updateGlobalBudget);
  const upsertSurface = useServerFn(upsertSurfaceBudget);
  const delSurface = useServerFn(deleteSurfaceBudget);
  const ackFn = useServerFn(acknowledgeAlert);

  const overview = useQuery({ queryKey: ["budget_overview"], queryFn: () => fetchFn() });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["budget_overview"] });
    qc.invalidateQueries({ queryKey: ["budget_summary"] });
  };

  const [editCap, setEditCap] = useState<"daily" | "monthly" | null>(null);
  const [capDraft, setCapDraft] = useState("");

  const setCapMut = useMutation({
    mutationFn: (v: { key: "daily" | "monthly"; label: string; value: number }) =>
      saveGlobal({
        data: globalPayload(
          (overview.data?.global as GlobalBudget | null) ?? null,
          v.key === "daily" ? { daily_usd_cap: v.value } : { monthly_usd_cap: v.value },
        ),
      }),
    onSuccess: (_d, v) => {
      toast.success(`${v.label} cap set to $${v.value}. Over-cap calls are blocked.`);
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [adv, setAdv] = useState<{
    daily_token_cap: string;
    monthly_token_cap: string;
    alert_at_pct: string;
  } | null>(null);
  const saveAdvMut = useMutation({
    mutationFn: (v: { daily_token_cap: string; monthly_token_cap: string; alert_at_pct: string }) =>
      saveGlobal({
        data: globalPayload((overview.data?.global as GlobalBudget | null) ?? null, {
          daily_token_cap: v.daily_token_cap.trim() ? Number(v.daily_token_cap) : null,
          monthly_token_cap: v.monthly_token_cap.trim() ? Number(v.monthly_token_cap) : null,
          alert_at_pct: v.alert_at_pct.trim() ? Number(v.alert_at_pct) : 80,
        }),
      }),
    onSuccess: () => {
      toast.success("Caps saved. Enforced on the next AI call.");
      setAdv(null);
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newSurface, setNewSurface] = useState({ surface: "chat", daily: "", monthly: "" });
  const addSurfaceMut = useMutation({
    mutationFn: () =>
      upsertSurface({
        data: {
          surface: newSurface.surface,
          daily_usd_cap: newSurface.daily.trim() ? Number(newSurface.daily) : null,
          monthly_usd_cap: newSurface.monthly.trim() ? Number(newSurface.monthly) : null,
          enabled: true,
        },
      }),
    onSuccess: () => {
      toast.success(`${newSurface.surface} cap set. Over-cap calls are blocked.`);
      setNewSurface({ surface: "chat", daily: "", monthly: "" });
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleSurfaceMut = useMutation({
    mutationFn: (row: SurfaceRow) =>
      upsertSurface({
        data: {
          surface: row.surface,
          daily_usd_cap: row.daily_usd_cap == null ? null : Number(row.daily_usd_cap),
          monthly_usd_cap: row.monthly_usd_cap == null ? null : Number(row.monthly_usd_cap),
          enabled: !row.enabled,
        },
      }),
    onSuccess: (_d, row) => {
      toast.success(`${row.surface} cap ${row.enabled ? "off" : "on"}.`);
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeSurfaceMut = useMutation({
    mutationFn: (surface: string) => delSurface({ data: { surface } }),
    onSuccess: (_d, surface) => {
      toast.success(`${surface} cap removed. It stops applying.`);
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ackMut = useMutation({
    mutationFn: (id: string) => ackFn({ data: { id } }),
    onSuccess: () => inv(),
    onError: (e: Error) => toast.error(e.message),
  });

  if (overview.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load budgets
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(overview.error as Error)?.message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => overview.refetch()}
        >
          Retry · reloads budgets
        </button>
      </div>
    );
  }

  if (overview.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading budgets…
      </div>
    );
  }

  const g = (overview.data?.global as GlobalBudget | null) ?? null;
  const surfaces = (overview.data?.surfaces ?? []) as SurfaceRow[];
  const alerts = (overview.data?.alerts ?? []) as AlertRow[];
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long" });

  const cards: {
    key: "daily" | "monthly";
    label: string;
    burn: number;
    cap: number | null;
    note: string;
  }[] = [
    {
      key: "daily",
      label: "Today",
      burn: Number(g?.daily_usd_used ?? 0),
      cap: g?.daily_usd_cap != null ? Number(g.daily_usd_cap) : null,
      note: "Resets at midnight",
    },
    {
      key: "monthly",
      label: monthLabel,
      burn: Number(g?.monthly_usd_used ?? 0),
      cap: g?.monthly_usd_cap != null ? Number(g.monthly_usd_cap) : null,
      note: "BYO keys in Settings",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {cards.map(({ key, label, burn, cap, note }) => {
        const pct = cap ? Math.min(100, (burn / cap) * 100) : 0;
        const editing = editCap === key;
        return (
          <div key={key} className="bento" style={{ padding: "var(--card-pad)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <MonoLabel icon={Gauge}>{label}</MonoLabel>
              {editing ? (
                <form
                  style={{ display: "flex", gap: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = parseFloat(capDraft);
                    if (v > 0) setCapMut.mutate({ key, label, value: v });
                    setEditCap(null);
                  }}
                >
                  <input
                    className="input"
                    autoFocus
                    value={capDraft}
                    onChange={(e) => setCapDraft(e.target.value)}
                    style={{ width: 76, fontSize: 12, padding: "3px 8px" }}
                    inputMode="decimal"
                    aria-label={`${label} cap`}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    style={{ fontSize: 10.5 }}
                  >
                    Set cap
                  </button>
                </form>
              ) : (
                <button
                  className="mono-label"
                  style={{ fontSize: 8.5, color: "var(--action-blue)" }}
                  onClick={() => {
                    setEditCap(key);
                    setCapDraft(cap != null ? String(cap) : "");
                  }}
                >
                  {cap != null ? "edit cap" : "set cap"}
                </button>
              )}
            </div>
            <div className="font-display tabular-nums" style={{ fontSize: 30 }}>
              ${burn.toFixed(2)}{" "}
              <span style={{ fontSize: 15, color: "var(--ink-faint)" }}>
                {cap != null ? `of $${cap}` : "no cap"}
              </span>
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 99,
                background: "var(--surface-2)",
                overflow: "hidden",
                margin: "12px 0 8px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: pct > 80 ? "var(--rose)" : "var(--ember)",
                  transition: "width var(--dur-slow)",
                }}
              ></div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "var(--ink-subtle)",
                flexWrap: "wrap",
                gap: 4,
              }}
            >
              <span>{note}</span>
            </div>
          </div>
        );
      })}

      <div
        className="bento"
        style={{
          gridColumn: "span 2",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Shield size={13} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
          Caps are hard limits: an over-cap AI call is blocked mid-mission and the run halts with
          the reason on record. Per-mission token and spend caps separately halt any one mission
          that passes its own limit.
        </span>
      </div>

      {/* Token caps + alert threshold — production-only controls, quiet. */}
      <div className="bento" style={{ gridColumn: "span 2", padding: "var(--card-pad)" }}>
        <MonoLabel icon={Gauge} style={{ marginBottom: 10 }}>
          Token caps · alert threshold
        </MonoLabel>
        {adv ? (
          <form
            style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
            onSubmit={(e) => {
              e.preventDefault();
              saveAdvMut.mutate(adv);
            }}
          >
            <label className="mono-label" style={{ display: "block", fontSize: 8.5 }}>
              Daily tokens
              <input
                className="input"
                value={adv.daily_token_cap}
                onChange={(e) => setAdv({ ...adv, daily_token_cap: e.target.value })}
                inputMode="numeric"
                placeholder="no cap"
                style={{ display: "block", width: 110, fontSize: 12, marginTop: 4 }}
              />
            </label>
            <label className="mono-label" style={{ display: "block", fontSize: 8.5 }}>
              Monthly tokens
              <input
                className="input"
                value={adv.monthly_token_cap}
                onChange={(e) => setAdv({ ...adv, monthly_token_cap: e.target.value })}
                inputMode="numeric"
                placeholder="no cap"
                style={{ display: "block", width: 110, fontSize: 12, marginTop: 4 }}
              />
            </label>
            <label className="mono-label" style={{ display: "block", fontSize: 8.5 }}>
              Alert at % of cap
              <input
                className="input"
                value={adv.alert_at_pct}
                onChange={(e) => setAdv({ ...adv, alert_at_pct: e.target.value })}
                inputMode="numeric"
                style={{ display: "block", width: 76, fontSize: 12, marginTop: 4 }}
              />
            </label>
            <button
              className="btn btn-primary btn-sm"
              type="submit"
              disabled={saveAdvMut.isPending}
              style={{ fontSize: 10.5 }}
            >
              Save caps · enforced on the next call
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAdv(null)}>
              Dismiss
            </button>
          </form>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span className="mono-label tabular-nums">
              daily {g?.daily_token_cap != null ? Number(g.daily_token_cap) : "—"} · monthly{" "}
              {g?.monthly_token_cap != null ? Number(g.monthly_token_cap) : "—"} · alert at{" "}
              {g?.alert_at_pct ?? 80}%
            </span>
            <button
              className="mono-label"
              style={{ fontSize: 8.5, color: "var(--action-blue)" }}
              onClick={() =>
                setAdv({
                  daily_token_cap: g?.daily_token_cap != null ? String(g.daily_token_cap) : "",
                  monthly_token_cap:
                    g?.monthly_token_cap != null ? String(g.monthly_token_cap) : "",
                  alert_at_pct: String(g?.alert_at_pct ?? 80),
                })
              }
            >
              edit caps
            </button>
          </div>
        )}
      </div>

      {/* Per-surface caps — production-only granularity, quiet table. */}
      <div className="bento" style={{ gridColumn: "span 2", padding: 0, overflow: "hidden" }}>
        <div
          className="mono-label"
          style={{
            display: "grid",
            gridTemplateColumns: SURFACE_GRID,
            gap: 12,
            padding: "10px 18px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <span>Surface caps</span>
          <span>Today</span>
          <span>{monthLabel}</span>
          <span></span>
        </div>
        {surfaces.length === 0 ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-faint)",
              padding: "16px 18px",
              textAlign: "center",
            }}
          >
            No per-surface caps yet.
          </div>
        ) : (
          surfaces.map((row, i) => {
            const dCap = row.daily_usd_cap == null ? null : Number(row.daily_usd_cap);
            const mCap = row.monthly_usd_cap == null ? null : Number(row.monthly_usd_cap);
            const dHot = dCap ? Number(row.daily_usd_used) / dCap >= 0.8 : false;
            const mHot = mCap ? Number(row.monthly_usd_used) / mCap >= 0.8 : false;
            return (
              <div
                key={row.surface}
                style={{
                  display: "grid",
                  gridTemplateColumns: SURFACE_GRID,
                  gap: 12,
                  padding: "12px 18px",
                  alignItems: "center",
                  borderBottom: i < surfaces.length - 1 ? "1px solid var(--hairline)" : "none",
                  fontSize: 13,
                  opacity: row.enabled ? 1 : 0.45,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 500 }}>{row.surface}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-subtle)" }}>
                    {row.enabled ? "enforced" : "off · not enforced"}
                  </span>
                </span>
                <span
                  className="mono-label tabular-nums"
                  style={{ color: dHot ? "var(--ember)" : undefined }}
                >
                  {fmtUsd(row.daily_usd_used)}
                  {dCap != null ? ` of ${fmtUsd(dCap)}` : " · no cap"}
                </span>
                <span
                  className="mono-label tabular-nums"
                  style={{ color: mHot ? "var(--ember)" : undefined }}
                >
                  {fmtUsd(row.monthly_usd_used)}
                  {mCap != null ? ` of ${fmtUsd(mCap)}` : " · no cap"}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    className="mono-label"
                    style={{ fontSize: 8.5, color: "var(--ink-faint)" }}
                    disabled={removeSurfaceMut.isPending}
                    onClick={() => removeSurfaceMut.mutate(row.surface)}
                  >
                    remove
                  </button>
                  <button
                    role="switch"
                    aria-checked={row.enabled}
                    aria-label={`${row.surface} cap`}
                    disabled={toggleSurfaceMut.isPending}
                    onClick={() => toggleSurfaceMut.mutate(row)}
                    style={{
                      width: 34,
                      height: 19,
                      borderRadius: 99,
                      background: row.enabled ? "var(--deep-green)" : "var(--surface-2)",
                      border: "1px solid var(--hairline)",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background var(--dur-base)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: row.enabled ? 16 : 2,
                        width: 13,
                        height: 13,
                        borderRadius: 99,
                        background: "var(--canvas)",
                        transition: "left var(--dur-base)",
                      }}
                    />
                  </button>
                </span>
              </div>
            );
          })
        )}
        <form
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "12px 18px",
            borderTop: "1px solid var(--hairline)",
          }}
          onSubmit={(e) => {
            e.preventDefault();
            addSurfaceMut.mutate();
          }}
        >
          <select
            className="input"
            value={newSurface.surface}
            onChange={(e) => setNewSurface({ ...newSurface, surface: e.target.value })}
            aria-label="Surface"
            style={{ width: 120, fontSize: 12 }}
          >
            {SURFACES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className="input"
            value={newSurface.daily}
            onChange={(e) => setNewSurface({ ...newSurface, daily: e.target.value })}
            placeholder="daily $"
            aria-label="Daily USD cap"
            inputMode="decimal"
            style={{ width: 76, fontSize: 12 }}
          />
          <input
            className="input"
            value={newSurface.monthly}
            onChange={(e) => setNewSurface({ ...newSurface, monthly: e.target.value })}
            placeholder="monthly $"
            aria-label="Monthly USD cap"
            inputMode="decimal"
            style={{ width: 76, fontSize: 12 }}
          />
          <button
            className="btn btn-primary btn-sm"
            type="submit"
            disabled={addSurfaceMut.isPending}
            style={{ fontSize: 10.5 }}
          >
            Set cap · blocks over-cap calls
          </button>
        </form>
      </div>

      {/* Alerts — production cap warnings/blocks; verdict chips lead each row. */}
      <div className="bento" style={{ gridColumn: "span 2", padding: "var(--card-pad)" }}>
        <MonoLabel icon={Shield} style={{ marginBottom: 10 }}>
          Alerts · cap warnings and blocks
        </MonoLabel>
        {alerts.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "8px 0" }}>
            No alerts yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {alerts.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 0",
                  borderBottom: i < alerts.length - 1 ? "1px solid var(--hairline)" : "none",
                }}
              >
                <VerdictChip tone={a.kind === "block" ? "madder" : "ember"}>
                  {a.kind === "block" ? "blocked" : "warn"}
                </VerdictChip>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {a.scope === "global" ? "Global" : a.surface} · {a.window_kind} at{" "}
                    {Number(a.pct).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>
                    {fmtUsd(a.usd_used)} of {fmtUsd(a.usd_cap)} · {relTime(a.created_at)}
                  </div>
                </div>
                {a.acknowledged ? (
                  <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                    acknowledged
                  </span>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={ackMut.isPending && ackMut.variables === a.id}
                    onClick={() => ackMut.mutate(a.id)}
                  >
                    Acknowledge · clears it
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
