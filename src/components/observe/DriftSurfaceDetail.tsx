// Drift surface drill-down — screen 7 of the Ember Editorial migration, ported
// from design-reference/cadence/govern-detail.jsx (DriftDetail). Rides
// ?surface= on /govern?tab=drift (tab body only) and shares the panel's
// ["drift_overview"] query cache so resolve/reopen/re-sample invalidations
// propagate to the table and the govern tab badge. Honesty deltas vs the
// reference: the kicker is built from the user's real drift_baselines windows
// (never the reference's fictional "14d rolling vs 90d"); the headline pair +
// Δ come from the worst OPEN incident's stored baseline_value/current_value/
// delta_pct (a stable surface has no stored pair — it reads "within baseline
// band"); the chart plots the surface's real per-day metric series with the
// incident's stored baseline as the dashed gate line (never a client-side
// Δ-vs-recomputed-baseline series — snapshots are capped to 30d while
// baseline_days can be 180, so browser baseline math can silently lie);
// "Probable cause"/"Action" prose bentos are omitted (drift_incidents.detail
// is always {}) — the honest action surface is the absorbed incident list
// with resolve/reopen (the panel's former inline expansion, kept per-model
// since incidents are keyed (surface, model, prompt_version, metric)); and
// "Recent samples" rows are column facts only (bucket_date, calls, errors).
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getDriftOverview,
  runDriftNow,
  resolveDriftIncident,
  reopenDriftIncident,
} from "@/lib/drift.functions";
import { DrillHeader, MonoLabel, VerdictChip } from "@/components/cadence/Primitives";
import { SketchLine } from "@/components/cadence/Sketch";
import { relTime } from "@/components/product/format";
import type { Incident, Snapshot } from "./DriftPanel";

/* Metric vocabulary + formatters — verbatim from DriftPanel (module-private
   there; react-refresh lint keeps value exports out of component files).
   Change them in lockstep or the list and the drill disagree on a number. */
const DEFAULT_WINDOWS = { window_days: 7, baseline_days: 14 };

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
  if (metric === "avg_eval_score") return v.toFixed(2);
  return v.toFixed(1);
}

function fmtDelta(pct: number) {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

type DayRow = {
  date: string;
  reqs: number;
  errs: number;
  latency: number;
  tokens: number;
  cost: number;
  errorRate: number;
  score: number | null;
};

/* Request-weighted daily series for one metric (the panel's trendByDay rule,
   scoped to a surface). Eval score is nullable — days without scores are
   dropped (the detector skips them too), never zero-filled. */
function seriesFor(days: DayRow[], metric: string): number[] {
  if (metric === "avg_eval_score")
    return days.filter((d) => d.score != null).map((d) => d.score as number);
  const sampled = days.filter((d) => d.reqs > 0);
  if (metric === "avg_latency_ms") return sampled.map((d) => d.latency);
  if (metric === "avg_total_tokens") return sampled.map((d) => d.tokens);
  if (metric === "avg_cost_usd") return sampled.map((d) => d.cost);
  if (metric === "error_rate") return sampled.map((d) => d.errorRate);
  return [];
}

function fmtDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function DriftSurfaceDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getDriftOverview);
  const runNow = useServerFn(runDriftNow);
  const resolveFn = useServerFn(resolveDriftIncident);
  const reopenFn = useServerFn(reopenDriftIncident);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["drift_overview"],
    queryFn: () => fetchOverview(),
  });

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

  const decideMut = useMutation({
    mutationFn: async ({
      incidentId,
      action,
    }: {
      incidentId: string;
      action: "resolve" | "reopen";
    }) => {
      if (action === "resolve") return resolveFn({ data: { id: incidentId } });
      return reopenFn({ data: { id: incidentId } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drift_overview"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const snaps = useMemo(
    () => ((data?.snapshots ?? []) as Snapshot[]).filter((s) => s.surface === id),
    [data?.snapshots, id],
  );
  const openIncidents = useMemo(
    () => ((data?.openIncidents ?? []) as Incident[]).filter((i) => i.surface === id),
    [data?.openIncidents, id],
  );
  const recentIncidents = useMemo(
    () => ((data?.recentIncidents ?? []) as Incident[]).filter((i) => i.surface === id),
    [data?.recentIncidents, id],
  );

  // Same headline rule as the panel row: worst open incident by |Δ|.
  const worst = useMemo(
    () =>
      [...openIncidents].sort(
        (a, b) => Math.abs(Number(b.delta_pct)) - Math.abs(Number(a.delta_pct)),
      )[0] ?? null,
    [openIncidents],
  );

  // Per-day rollup across this surface's models — request-weighted, exactly
  // like the panel's trendByDay, plus a nullable eval-score channel.
  const days = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        reqs: number;
        errs: number;
        lat: number;
        tok: number;
        cost: number;
        scoreSum: number;
        scoreReqs: number;
      }
    >();
    for (const s of snaps) {
      const reqs = Number(s.request_count) || 0;
      let row = map.get(s.bucket_date);
      if (!row) {
        row = {
          date: s.bucket_date,
          reqs: 0,
          errs: 0,
          lat: 0,
          tok: 0,
          cost: 0,
          scoreSum: 0,
          scoreReqs: 0,
        };
        map.set(s.bucket_date, row);
      }
      row.lat += Number(s.avg_latency_ms) * reqs;
      row.tok += Number(s.avg_total_tokens) * reqs;
      row.cost += Number(s.avg_cost_usd) * reqs;
      row.reqs += reqs;
      row.errs += Number(s.error_count) || 0;
      if (s.avg_eval_score != null) {
        row.scoreSum += Number(s.avg_eval_score) * reqs;
        row.scoreReqs += reqs;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(
        (r): DayRow => ({
          date: r.date,
          reqs: r.reqs,
          errs: r.errs,
          latency: r.reqs ? r.lat / r.reqs : 0,
          tokens: r.reqs ? r.tok / r.reqs : 0,
          cost: r.reqs ? r.cost / r.reqs : 0,
          errorRate: r.reqs ? (r.errs / r.reqs) * 100 : 0,
          score: r.scoreReqs ? r.scoreSum / r.scoreReqs : null,
        }),
      );
  }, [snaps]);

  // Reference sparkline slot, honest rendering: on watch, the incident
  // metric's daily series with the STORED baseline as the dashed gate; on
  // stable, calls/day (the one metric-neutral real series). Labels carry the
  // real sampled-day count, never the reference's hardcoded "last 7 samples".
  const chart: { series: number[]; baseline?: number; color: string; label: string } =
    useMemo(() => {
      if (worst) {
        const series = seriesFor(days, worst.metric);
        return {
          series,
          baseline: Number(worst.baseline_value),
          color: "var(--ember)",
          label: `${METRIC_LABELS[worst.metric] ?? worst.metric} vs baseline · last ${series.length} days`,
        };
      }
      const series = days.map((d) => d.reqs);
      return {
        series,
        color: "var(--emerald)",
        label: `Calls / day · last ${series.length} days`,
      };
    }, [worst, days]);

  const recentDays = useMemo(() => days.slice(-7).reverse(), [days]);

  const watch = openIncidents.length > 0;
  const incidents = [...openIncidents, ...recentIncidents];

  const cfgSrc = (data?.baseline ?? {}) as Partial<typeof DEFAULT_WINDOWS>;
  const windowDays = Number(cfgSrc.window_days ?? DEFAULT_WINDOWS.window_days);
  const baselineDays = Number(cfgSrc.baseline_days ?? DEFAULT_WINDOWS.baseline_days);

  const back = () => navigate({ to: "/govern", search: { tab: "drift" } });

  if (error) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
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
        className="mono-label"
        style={{ color: "var(--ink-faint)", padding: "32px 0", textAlign: "center" }}
      >
        Loading drift surface…
      </div>
    );
  }

  if (snaps.length === 0 && incidents.length === 0) {
    return (
      <div className="fade-up">
        <DrillHeader onBack={back} backLabel="All surfaces" kicker="Drift surface" title={id} />
        <div
          className="bento"
          style={{
            padding: "var(--card-pad)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span className="mono-label" style={{ flex: 1 }}>
            No drift data for this surface — nothing sampled in the last 30 days.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={back}>
            Back · all surfaces
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <DrillHeader
        onBack={back}
        backLabel="All surfaces"
        kicker={`${windowDays}d window vs ${baselineDays}d baseline`}
        title={id}
        right={
          watch ? (
            <button
              className="btn btn-primary btn-sm"
              disabled={runMut.isPending}
              onClick={() => runMut.mutate()}
            >
              {runMut.isPending ? "Re-sampling…" : "Re-sample now · rolls up all surfaces"}
            </button>
          ) : undefined
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 6 }}>Baseline → current</MonoLabel>
          {worst ? (
            <>
              <div className="font-display tabular-nums" style={{ fontSize: 24 }}>
                {fmtMetric(worst.metric, Number(worst.baseline_value))} →{" "}
                <span style={{ color: "var(--ember)" }}>
                  {fmtMetric(worst.metric, Number(worst.current_value))}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
                {METRIC_LABELS[worst.metric] ?? worst.metric} ·{" "}
                <span className="tabular-nums" style={{ color: "var(--ember)" }}>
                  {fmtDelta(Number(worst.delta_pct))}
                </span>
                {openIncidents.length > 1 ? ` · +${openIncidents.length - 1} more open` : null}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 2 }}>
                <VerdictChip tone="moss">stable</VerdictChip>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6 }}>
                within baseline band — no open incidents
              </div>
            </>
          )}
        </div>
        <div className="bento" style={{ gridColumn: "span 2", padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>{chart.label}</MonoLabel>
          {chart.series.length >= 2 ? (
            <SketchLine
              data={chart.series}
              baseline={chart.baseline}
              w={300}
              h={42}
              color={chart.color}
            />
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
              First sampled day — the trend draws from day two.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Incidents · open and recent</MonoLabel>
          {incidents.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", margin: 0 }}>
              No incidents on this surface. The detector compares the last {windowDays}d against a{" "}
              {baselineDays}d baseline.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {incidents.map((inc) => {
                const isOpen = inc.status === "open";
                return (
                  <div
                    key={inc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 12.5,
                      flexWrap: "wrap",
                    }}
                  >
                    <VerdictChip
                      tone={isOpen ? (inc.severity === "critical" ? "madder" : "ember") : "moss"}
                    >
                      {isOpen ? (inc.severity === "critical" ? "critical" : "watch") : "resolved"}
                    </VerdictChip>
                    <span style={{ color: "var(--ink-muted)" }}>
                      {METRIC_LABELS[inc.metric] ?? inc.metric}{" "}
                      {fmtMetric(inc.metric, Number(inc.baseline_value))} →{" "}
                      {fmtMetric(inc.metric, Number(inc.current_value))}
                    </span>
                    <span className="mono-label tabular-nums">
                      {fmtDelta(Number(inc.delta_pct))}
                    </span>
                    <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                      {inc.model} · {relTime(inc.detected_at)}
                    </span>
                    <span style={{ flex: 1 }}></span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                      disabled={decideMut.isPending && decideMut.variables?.incidentId === inc.id}
                      onClick={() =>
                        decideMut.mutate({
                          incidentId: inc.id,
                          action: isOpen ? "resolve" : "reopen",
                        })
                      }
                    >
                      {isOpen ? "Resolve · clears the watch" : "Reopen · back on watch"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>Recent samples</MonoLabel>
          {recentDays.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: 0 }}>
              No snapshot days yet — run a drift check to roll up today.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentDays.map((d, i) => (
                <div
                  key={d.date}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: i < recentDays.length - 1 ? "1px solid var(--hairline)" : "none",
                    fontSize: 12.5,
                  }}
                >
                  <span className="mono-label" style={{ flexShrink: 0 }}>
                    {fmtDay(d.date)}
                  </span>
                  <span style={{ color: "var(--ink-muted)" }}>
                    {d.reqs} {d.reqs === 1 ? "call" : "calls"} · {d.errs}{" "}
                    {d.errs === 1 ? "error" : "errors"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
