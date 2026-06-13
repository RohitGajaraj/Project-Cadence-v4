// v6 Phase 3 / Track 2 — the Gauntlet: the three north-star proof metrics on a
// real surface. Styling follows AnalyticsPanel (bento cards, MonoLabel, serif
// tabular headline, faint sub-line). Every number is read from real tables;
// when the data is sparse each card says "not enough data yet" rather than
// inventing a figure (honesty rule — the claim never outruns the wiring).
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Gauge, Flame, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import {
  getAcceptanceRate,
  getAutonomyRatio,
  getRitualRetention,
  type Trend,
} from "@/lib/gauntlet.functions";
import { MonoLabel } from "@/components/cadence/Primitives";

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

function TrendChip({ trend, hidden }: { trend: Trend; hidden?: boolean }) {
  if (hidden) return null;
  const map = {
    up: { Icon: ArrowUpRight, color: "var(--emerald, var(--ember))", label: "rising" },
    down: { Icon: ArrowDownRight, color: "var(--rose)", label: "falling" },
    flat: { Icon: Minus, color: "var(--ink-faint)", label: "flat" },
  } as const;
  const { Icon, color, label } = map[trend];
  return (
    <span
      className="mono-label"
      style={{ display: "inline-flex", alignItems: "center", gap: 3, color, fontSize: 9 }}
    >
      <Icon size={11} strokeWidth={2} />
      {label} · 7d vs prior 7d
    </span>
  );
}

/** One metric card — serif headline, optional trend chip, one plain-language
 *  line of what it means, and an honest sub-stat. */
function MetricCard({
  icon,
  label,
  value,
  trend,
  trendHidden,
  meaning,
  substat,
  loading,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  trend?: Trend;
  trendHidden?: boolean;
  meaning: string;
  substat: string;
  loading: boolean;
}) {
  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <MonoLabel icon={icon} style={{ marginBottom: 6 }}>
        {label}
      </MonoLabel>
      <div
        className="font-display tabular-nums"
        style={{ fontSize: 26, color: value === "—" ? "var(--ink-faint)" : "var(--ink)" }}
      >
        {loading ? "…" : value}
      </div>
      <div style={{ minHeight: 14, marginTop: 2 }}>
        {!loading && trend && <TrendChip trend={trend} hidden={trendHidden} />}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 8, lineHeight: 1.45 }}>
        {meaning}
      </p>
      <div
        className="mono-label"
        style={{ fontSize: 8.5, color: "var(--ink-faint)", marginTop: 8 }}
      >
        {loading ? "loading…" : substat}
      </div>
    </div>
  );
}

export function GauntletMetricsPanel() {
  const fAccept = useServerFn(getAcceptanceRate);
  const fAutonomy = useServerFn(getAutonomyRatio);
  const fRitual = useServerFn(getRitualRetention);

  const acceptQ = useQuery({
    queryKey: ["gauntlet-acceptance"],
    queryFn: () => fAccept({ data: { days: 14 } }),
  });
  const autonomyQ = useQuery({
    queryKey: ["gauntlet-autonomy"],
    queryFn: () => fAutonomy({ data: { days: 14 } }),
  });
  const ritualQ = useQuery({
    queryKey: ["gauntlet-ritual"],
    queryFn: () => fRitual(),
  });

  const a = acceptQ.data;
  const c = autonomyQ.data;
  const b = ritualQ.data;

  // Metric A copy.
  const acceptValue = a == null || a.rate == null ? "—" : pct(a.rate);
  const acceptSub =
    a == null
      ? ""
      : a.decided === 0
        ? "not enough data yet — no calls decided in 14d"
        : `${a.approved} approved · ${a.rejected} rejected · last 14d`;

  // Metric C copy.
  const autonomyValue = c == null || c.ratio == null ? "—" : pct(c.ratio);
  const autonomySub =
    c == null
      ? ""
      : c.unattended + c.gated === 0
        ? "not enough data yet — no side-effecting actions in 14d"
        : `${c.unattended} ran unattended · ${c.gated} came to you · last 14d`;

  // Metric B copy — retention shown as days-active (7d) + streak.
  const ritualReady = b?.tableReady ?? false;
  const ritualValue = b == null || !ritualReady ? "—" : `${b.daysActive7}/7`;
  const ritualSub =
    b == null
      ? ""
      : !ritualReady
        ? "not enough data yet — ritual tracking lights up on next sync"
        : b.daysActive7 === 0
          ? "not enough data yet — open Today to start the streak"
          : `streak ${b.currentStreak}d · ${b.daysActive30} of last 30 days${
              b.realData == null ? "" : b.realData ? " · real inputs" : " · demo seed"
            }`;

  return (
    <div>
      <div
        className="mono-label"
        style={{ fontSize: 9, color: "var(--ink-faint)", marginBottom: 12, lineHeight: 1.5 }}
      >
        The Gauntlet · the three proof metrics, read from real activity. The loop runs the
        reversible work; you make the calls. Sparse windows read "not enough data yet" — never an
        invented number.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <MetricCard
          icon={CheckCircle2}
          label="Acceptance rate"
          value={acceptValue}
          trend={a?.trend}
          trendHidden={a == null || a.priorRate == null || a.rate == null}
          meaning="Of the calls you actually decided, the share you approved — how often the agents' proposals match your judgment."
          substat={acceptSub}
          loading={acceptQ.isLoading}
        />
        <MetricCard
          icon={Gauge}
          label="Autonomy ratio"
          value={autonomyValue}
          trend={c?.trend}
          trendHidden={c == null || c.priorRatio == null || c.ratio == null}
          meaning="Of side-effecting actions, the share the loop ran unattended vs the share it gated for your call. Rising means it carries more reversible work itself."
          substat={autonomySub}
          loading={autonomyQ.isLoading}
        />
        <MetricCard
          icon={Flame}
          label="Ritual retention"
          value={ritualValue}
          meaning="Days in the last week you opened Today to clear the queue — the daily ritual that keeps the loop honest and you in the loop."
          substat={ritualSub}
          loading={ritualQ.isLoading}
        />
      </div>

      {(acceptQ.error || autonomyQ.error || ritualQ.error) && (
        <div className="bento" style={{ padding: 16, marginTop: 12 }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load some metrics
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 6 }}>
            {((acceptQ.error || autonomyQ.error || ritualQ.error) as Error).message}
          </p>
        </div>
      )}
    </div>
  );
}
