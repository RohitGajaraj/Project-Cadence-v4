// Drift tab — ported 1:1 from design-reference/cadence/loop.jsx (GovernScreen,
// tab "Drift"): a bento table (AI surface 1fr / Δ baseline 80px / Status 90px /
// Note 1fr / chevron 20px), surface at 500 weight, the delta mono tabular
// (ember on watch), the status as a VerdictChip (watch → ember, stable → moss —
// a drift status is a rendered judgment, never a StatusBadge), the note at
// 12px ink-subtle. Screen 7: rows navigate to the ?surface= drill
// (DriftSurfaceDetail) — the former inline expansion, with the per-incident
// resolve/reopen actions, lives there now; both share the ["drift_overview"]
// cache. Production functionality kept, restyled quiet-Ember: getDriftOverview
// / runDriftNow / updateDriftBaseline, the metric trend sparklines, and the
// baseline config. The Incident/Snapshot row types are exported for the
// detail; the metric formatters are re-declared there verbatim (react-refresh
// lint keeps value exports out of component files) — change them in lockstep
// so list and drill render every number identically.
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { ChevronRight, Waves } from "lucide-react";
import { toast } from "@/lib/notify";
import { getDriftOverview, runDriftNow, updateDriftBaseline } from "@/lib/drift.functions";
import { EmptyState, MonoLabel, VerdictChip } from "@/components/cadence/Primitives";
import { SketchLine } from "@/components/cadence/Sketch";

const GRID = "1fr 80px 90px 1fr 20px";

const DEFAULT_CFG = {
  window_days: 7,
  baseline_days: 14,
  latency_pct_threshold: 25,
  tokens_pct_threshold: 30,
  cost_pct_threshold: 30,
  score_pct_threshold: 10,
  error_rate_pct_threshold: 5,
  enabled: true,
};

const METRIC_LABELS: Record<string, string> = {
  avg_latency_ms: "Latency",
  avg_total_tokens: "Tokens",
  avg_cost_usd: "Cost",
  avg_eval_score: "Eval score",
  error_rate: "Error rate",
};

function fmtMetric(metric: string, v: number) {
  if (metric === "avg_cost_usd") return `$${v.toFixed(4)}`;
  if (metric === "avg_latency_ms") return `${Math.round(v)}ms`;
  if (metric === "error_rate") return `${v.toFixed(1)}%`;
  if (metric === "avg_eval_score") return Math.round(v).toString(); // 0–100 scale (KI-14)
  return v.toFixed(1);
}

function fmtDelta(pct: number) {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export type Incident = {
  id: string;
  status: string;
  surface: string;
  model: string;
  metric: string;
  baseline_value: number | string;
  current_value: number | string;
  delta_pct: number | string;
  severity: string;
  detected_at: string;
};

export type Snapshot = {
  bucket_date: string;
  surface: string;
  avg_latency_ms: number | string;
  avg_total_tokens: number | string;
  avg_cost_usd: number | string;
  avg_eval_score: number | string | null;
  error_count: number | string;
  request_count: number | string;
};

export function DriftPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getDriftOverview);
  const runNow = useServerFn(runDriftNow);
  const saveCfg = useServerFn(updateDriftBaseline);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["drift_overview"],
    queryFn: () => fetchOverview(),
  });

  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [cfgOpen, setCfgOpen] = useState(false);
  useEffect(() => {
    if (data?.baseline) setCfg({ ...DEFAULT_CFG, ...data.baseline });
  }, [data?.baseline]);

  const runMut = useMutation({
    mutationFn: () => runNow(),
    onSuccess: (r) => {
      toast.success(
        `Rolled up ${r.snapshots} snapshots. Opened ${r.opened}, resolved ${r.resolved}.`,
      );
      qc.invalidateQueries({ queryKey: ["drift_overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () => saveCfg({ data: cfg }),
    onSuccess: () => {
      toast.success("Baseline updated. The next check uses it.");
      setCfgOpen(false);
      qc.invalidateQueries({ queryKey: ["drift_overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const snapshots = useMemo(() => (data?.snapshots ?? []) as Snapshot[], [data?.snapshots]);
  const openIncidents = useMemo(
    () => (data?.openIncidents ?? []) as Incident[],
    [data?.openIncidents],
  );
  const recentIncidents = useMemo(
    () => (data?.recentIncidents ?? []) as Incident[],
    [data?.recentIncidents],
  );

  // One row per AI surface — watch when an open incident exists, else stable.
  // Δ baseline comes from the worst open incident; stable surfaces carry no
  // delta number (the detector found none — never invent one).
  const rows = useMemo(() => {
    const surfaces = new Set<string>();
    for (const s of snapshots) surfaces.add(s.surface);
    for (const i of openIncidents) surfaces.add(i.surface);
    for (const i of recentIncidents) surfaces.add(i.surface);
    return Array.from(surfaces)
      .map((surface) => {
        const open = openIncidents
          .filter((i) => i.surface === surface)
          .sort((a, b) => Math.abs(Number(b.delta_pct)) - Math.abs(Number(a.delta_pct)));
        const worst = open[0];
        return {
          surface,
          watch: open.length > 0,
          delta: worst ? fmtDelta(Number(worst.delta_pct)) : "-",
          note: worst
            ? `${METRIC_LABELS[worst.metric] ?? worst.metric} ${fmtMetric(worst.metric, Number(worst.baseline_value))} → ${fmtMetric(worst.metric, Number(worst.current_value))}${open.length > 1 ? ` · +${open.length - 1} more` : ""}`
            : "within baseline band",
          openCount: open.length,
        };
      })
      .sort((a, b) => Number(b.watch) - Number(a.watch) || a.surface.localeCompare(b.surface));
  }, [snapshots, openIncidents, recentIncidents]);

  const trendByDay = useMemo(() => {
    const map = new Map<
      string,
      { date: string; latency: number; tokens: number; cost: number; reqs: number; errs: number }
    >();
    for (const s of snapshots) {
      const k = s.bucket_date;
      const reqs = Number(s.request_count) || 0;
      let row = map.get(k);
      if (!row) {
        row = { date: k, latency: 0, tokens: 0, cost: 0, reqs: 0, errs: 0 };
        map.set(k, row);
      }
      row.latency += Number(s.avg_latency_ms) * reqs;
      row.tokens += Number(s.avg_total_tokens) * reqs;
      row.cost += Number(s.avg_cost_usd) * reqs;
      row.reqs += reqs;
      row.errs += Number(s.error_count) || 0;
    }
    return Array.from(map.values())
      .map((r) => ({
        date: r.date,
        latency: r.reqs ? r.latency / r.reqs : 0,
        tokens: r.reqs ? r.tokens / r.reqs : 0,
        cost: r.reqs ? r.cost / r.reqs : 0,
        errorRate: r.reqs ? (r.errs / r.reqs) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots]);

  if (error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load drift
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => refetch()}
        >
          Retry · reloads drift
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading drift…
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCfgOpen((v) => !v)}>
          Baseline · thresholds and windows
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={runMut.isPending}
          onClick={() => runMut.mutate()}
        >
          {runMut.isPending ? (
            <>
              <span className="spinner" style={{ width: 11, height: 11 }} />
              Checking…
            </>
          ) : (
            "Run drift check · rolls up today"
          )}
        </button>
      </div>

      {cfgOpen ? (
        <div className="bento fade-up" style={{ padding: "14px 16px", marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <MonoLabel>Drift baseline</MonoLabel>
            <button
              role="switch"
              aria-checked={cfg.enabled}
              className="mono-label"
              style={{ fontSize: 8.5, color: cfg.enabled ? "var(--emerald)" : "var(--ink-faint)" }}
              onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
            >
              detection {cfg.enabled ? "on" : "off"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(
              [
                ["Recent window (days)", "window_days"],
                ["Baseline window (days)", "baseline_days"],
                ["Latency % threshold", "latency_pct_threshold"],
                ["Tokens % threshold", "tokens_pct_threshold"],
                ["Cost % threshold", "cost_pct_threshold"],
                ["Eval score % drop", "score_pct_threshold"],
                ["Error rate % threshold", "error_rate_pct_threshold"],
              ] as [string, keyof typeof DEFAULT_CFG][]
            ).map(([label, key]) => (
              <label key={key} style={{ fontSize: 12 }}>
                <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
                  {label}
                </div>
                <input
                  className="input"
                  type="number"
                  value={Number(cfg[key])}
                  onChange={(e) => setCfg({ ...cfg, [key]: Number(e.target.value) })}
                  style={{ fontSize: 12, padding: "4px 8px" }}
                />
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setCfgOpen(false)}>
              Dismiss
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? "Saving…" : "Save baseline · applies on the next check"}
            </button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={Waves}
          title="No drift data yet"
          body="Once AI calls accumulate, Cadence rolls daily snapshots and flags any surface that moves against its baseline."
          cta="Run drift check · rolls up today"
          onCta={() => runMut.mutate()}
        />
      ) : (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            className="mono-label"
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span>AI surface</span>
            <span>Δ baseline</span>
            <span>Status</span>
            <span>Note</span>
            <span></span>
          </div>
          {rows.map((d, i) => (
            <button
              key={d.surface}
              onClick={() =>
                navigate({ to: "/govern", search: { tab: "drift", surface: d.surface } })
              }
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 12,
                padding: "12px 18px",
                alignItems: "baseline",
                borderBottom: i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
                fontSize: 13,
                width: "100%",
                textAlign: "left",
              }}
            >
              <span style={{ fontWeight: 500 }}>{d.surface}</span>
              <span
                className="mono-label tabular-nums"
                style={{ color: d.watch ? "var(--ember)" : "var(--ink)" }}
              >
                {d.delta}
              </span>
              <span>
                <VerdictChip tone={d.watch ? "ember" : "moss"}>
                  {d.watch ? "watch" : "stable"}
                </VerdictChip>
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>{d.note}</span>
              <span style={{ color: "var(--ink-faint)", alignSelf: "center", display: "flex" }}>
                <ChevronRight size={11} />
              </span>
            </button>
          ))}
        </div>
      )}

      {trendByDay.length > 1 ? (
        <div style={{ marginTop: 14 }}>
          <MonoLabel style={{ marginBottom: 10 }}>Metric trend · last 30 days</MonoLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <TrendBento
              label="Avg latency"
              series={trendByDay.map((d) => d.latency)}
              last={`${Math.round(trendByDay[trendByDay.length - 1].latency)}ms`}
            />
            <TrendBento
              label="Avg tokens / call"
              series={trendByDay.map((d) => d.tokens)}
              last={trendByDay[trendByDay.length - 1].tokens.toFixed(0)}
            />
            <TrendBento
              label="Avg cost"
              series={trendByDay.map((d) => d.cost)}
              last={`$${trendByDay[trendByDay.length - 1].cost.toFixed(4)}`}
            />
            <TrendBento
              label="Error rate"
              series={trendByDay.map((d) => d.errorRate)}
              last={`${trendByDay[trendByDay.length - 1].errorRate.toFixed(1)}%`}
              color="var(--rose)"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* Trend card — the line renders hand-sketched (SketchLine, founder directive
   2026-06-12): pencil wobble over the exact data points, never a smooth
   system-generated vector. Layout from govern-detail.jsx (Sparkline card). */
function TrendBento({
  label,
  series,
  last,
  color,
}: {
  label: string;
  series: number[];
  last: string;
  color?: string;
}) {
  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <MonoLabel>{label}</MonoLabel>
        <span className="font-display tabular-nums" style={{ fontSize: 16 }}>
          {last}
        </span>
      </div>
      <SketchLine data={series} color={color} />
    </div>
  );
}

export function useDriftCounts() {
  const fetchOverview = useServerFn(getDriftOverview);
  const { data } = useQuery({
    queryKey: ["drift_overview"],
    queryFn: () => fetchOverview(),
  });
  return { open: data?.openIncidents?.length ?? 0 };
}
