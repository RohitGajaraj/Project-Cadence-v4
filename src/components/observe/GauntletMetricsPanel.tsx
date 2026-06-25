// v6 Phase 3 / Track 2 — the Gauntlet: the three north-star proof metrics on a
// real surface. Styling follows AnalyticsPanel (bento cards, MonoLabel, serif
// tabular headline, faint sub-line). Every number is read from real tables;
// when the data is sparse each card says "not enough data yet" rather than
// inventing a figure (honesty rule — the claim never outruns the wiring).
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Gauge,
  Flame,
  Sparkles,
  Target,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  getAcceptanceRate,
  getAutonomyRatio,
  getRitualRetention,
  getMemoryCompounding,
  getOutcomeAccuracy,
  getMemoryLift,
  type Trend,
  type MemoryCompounding,
  type OutcomeAccuracy,
  type MemoryLiftResult,
} from "@/lib/gauntlet.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import { AutonomyCard } from "@/components/today/AutonomyCard";

function pct(n: number | null): string {
  if (n == null) return "-";
  return `${Math.round(n * 100)}%`;
}

function TrendChip({
  trend,
  hidden,
  windowLabel = "7d vs prior 7d",
}: {
  trend: Trend;
  hidden?: boolean;
  windowLabel?: string;
}) {
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
      {label} · {windowLabel}
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
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
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
        style={{ fontSize: 26, color: value === "-" ? "var(--ink-faint)" : "var(--ink)" }}
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

/** The moat metric - full width below the operational three. The honest,
 *  scale-independent proof the decision memory compounds: how much of what the
 *  loop stored it has recalled back, plus growth and the priorities outcomes
 *  moved. NDR is explicitly deferred to billing (M-C), never invented. */
function MemoryCompoundsCard({
  data,
  loading,
}: {
  data: MemoryCompounding | undefined;
  loading: boolean;
}) {
  const ready = data?.tableReady ?? false;
  const stored = data?.stored ?? 0;
  const hasData = ready && stored > 0;
  return (
    <div className="bento" style={{ padding: "var(--card-pad)", marginTop: 12 }}>
      <MonoLabel icon={Sparkles} style={{ marginBottom: 8 }}>
        Memory compounds · the moat
      </MonoLabel>
      {loading ? (
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint)" }}>
          loading…
        </div>
      ) : hasData ? (
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 110 }}>
            <div
              className="font-display tabular-nums"
              style={{ fontSize: 30, color: "var(--ink)" }}
            >
              {pct(data!.reuseRate)}
            </div>
            <div
              className="mono-label"
              style={{ fontSize: 8.5, color: "var(--ink-faint)", marginTop: 2 }}
            >
              recalled back
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.45 }}>
              Of the memories the loop stored, the share it has recalled at least once. A store the
              loop reads back is a moat; one it never reopens is a log.
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
              {(
                [
                  ["stored", String(data!.stored)],
                  ["new this week", `+${data!.newThisWeek}`],
                  ["moved a priority", String(data!.prioritiesMoved)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <span key={label} className="mono-label" style={{ fontSize: 9 }}>
                  <strong className="tabular-nums" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {value}
                  </strong>{" "}
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.45 }}>
          {ready
            ? "Not enough data yet, no memories stored. The loop writes one each time it records an outcome or an agent reflects on a run, then recalls them on its next pass."
            : "Not enough data yet, memory tracking lights up on the next sync."}
        </p>
      )}
      <div className="mono-label" style={{ fontSize: 8, color: "var(--ink-faint)", marginTop: 10 }}>
        NDR and expansion land here once billing ships (pricing, M-C).
      </div>
    </div>
  );
}

/** MOAT-METRIC — outcome accuracy, the second half of the moat proof, full
 *  width above Memory compounds. Of the bets you shipped and reviewed, the share
 *  that validated, and whether it is climbing. Honest when sparse; it never
 *  claims causal "memory lift" (no on/off control), only the trend the data
 *  supports. Pairs with Memory compounds: judgment validating + memory reused. */
function OutcomeAccuracyCard({
  data,
  loading,
}: {
  data: OutcomeAccuracy | undefined;
  loading: boolean;
}) {
  const ready = data?.tableReady ?? false;
  const decided = data?.decided ?? 0;
  const hasData = ready && decided > 0;
  return (
    <div className="bento" style={{ padding: "var(--card-pad)", marginTop: 12 }}>
      <MonoLabel icon={Target} style={{ marginBottom: 8 }}>
        Outcome accuracy · the moat
      </MonoLabel>
      {loading ? (
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint)" }}>
          loading…
        </div>
      ) : hasData ? (
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 110 }}>
            <div
              className="font-display tabular-nums"
              style={{ fontSize: 30, color: "var(--ink)" }}
            >
              {pct(data!.rate)}
            </div>
            <div style={{ minHeight: 14, marginTop: 2 }}>
              {data!.priorRate != null && data!.rate != null ? (
                <TrendChip trend={data!.trend} windowLabel="vs prior period" />
              ) : (
                <div className="mono-label" style={{ fontSize: 8.5, color: "var(--ink-faint)" }}>
                  validated share
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.45 }}>
              Of the bets you shipped and then reviewed, the share that validated. Climbing as the
              loop's memory compounds is the moat working, not just storing.
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
              {(
                [
                  ["validated", String(data!.validated)],
                  ["missed", String(data!.missed)],
                  ["mixed", String(data!.mixed)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <span key={label} className="mono-label" style={{ fontSize: 9 }}>
                  <strong className="tabular-nums" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {value}
                  </strong>{" "}
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.45 }}>
          {ready
            ? "Not enough data yet, no reviewed outcomes. Record an outcome on a shipped spec and its verdict lands here."
            : "Not enough data yet, outcome tracking lights up on the next sync."}
        </p>
      )}
      <div className="mono-label" style={{ fontSize: 8, color: "var(--ink-faint)", marginTop: 10 }}>
        Accuracy is the validated share; causal memory-lift needs an on/off control we don't claim.
      </div>
    </div>
  );
}

/** MOAT-METRIC — the memory-depth split (the lift half of the moat proof). An
 *  honest, observational cut: of your reviewed bets, did the half decided LATER in
 *  the store's growth (more precedent accumulated) validate more often than the
 *  half decided earlier. Correlational, never causal — the colour stays neutral
 *  for either sign and the confound is named inline and in the footnote. Below the
 *  size / depth-contrast / noise gates it reads "not enough data yet" with a
 *  reason, never an invented number. Pairs with Outcome accuracy and Memory
 *  compounds as the three honest faces of the moat. */
function MemoryDepthSplitCard({
  data,
  loading,
}: {
  data: MemoryLiftResult | undefined;
  loading: boolean;
}) {
  const ready = data?.tableReady ?? false;
  const bounded = data?.memoryBounded ?? true;
  const lift = data?.liftPoints ?? null;
  const hasNumber = !!data && ready && bounded && lift != null;

  // Not-computable copy — keyed on the reason so the user learns what would unlock it.
  let notMsg = "Not enough data yet.";
  if (data && ready && !bounded) {
    // The store grew past what we score in one pass — an honest refusal to
    // under-report depth, NOT a sparse-data state. Say so rather than imply "empty".
    notMsg = "Your memory store is larger than we can score in one pass right now.";
  } else if (data && ready && bounded && lift == null) {
    if (data.reason === "not-enough-outcomes") {
      notMsg =
        "Not enough reviewed bets yet. Two halves of 8 or more reviewed outcomes unlock this.";
    } else if (data.reason === "depth-contrast-too-small") {
      notMsg = "Not enough variation in precedent across your reviewed bets to compare them yet.";
    } else if (data.reason === "lift-within-noise") {
      notMsg = `Measured, but within the margin of error at this sample. Earlier half ${pct(
        data.sparseRate,
      )} (n=${data.sparseN}), later half ${pct(data.richRate)} (n=${data.richN}). Too close to call.`;
    } else if (data.reason === "data-quality") {
      notMsg = "Not enough clean data yet.";
    }
  }

  const absLift = lift == null ? 0 : Math.abs(lift);
  const headline = lift == null ? "-" : `${lift > 0 ? "+" : ""}${lift} pts`;
  const meaning =
    lift == null
      ? ""
      : lift === 0
        ? "The two halves of your reviewed bets validated about equally, whether decided with little or lots of memory accumulated. Read this as association, not a memory on/off test."
        : `The half of your reviewed bets made later in your memory's growth validated ${absLift} pts ${
            lift > 0 ? "more" : "less"
          } often than the earlier half. Later also means more practice, so read this as association, not a memory on/off test.`;

  return (
    <div className="bento" style={{ padding: "var(--card-pad)", marginTop: 12 }}>
      <MonoLabel icon={Layers} style={{ marginBottom: 8 }}>
        Memory-depth split · the moat
      </MonoLabel>
      {loading ? (
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint)" }}>
          loading…
        </div>
      ) : hasNumber ? (
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 110 }}>
            {/* Neutral ink for either sign — this is an association, not a win. */}
            <div
              className="font-display tabular-nums"
              style={{ fontSize: 30, color: "var(--ink)" }}
            >
              {headline}
            </div>
            <div
              className="mono-label"
              style={{ fontSize: 8.5, color: "var(--ink-faint)", marginTop: 2 }}
            >
              later half vs earlier half
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.45 }}>
              {meaning}
            </p>
            <div
              className="mono-label"
              style={{ fontSize: 9, marginTop: 10, color: "var(--ink-subtle)" }}
            >
              Earlier half: {pct(data!.sparseRate)} validated (n={data!.sparseN}) / Later half:{" "}
              {pct(data!.richRate)} validated (n={data!.richN}). One outcome moves this about{" "}
              {data!.swingPoints} pts.
            </div>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.45 }}>{notMsg}</p>
      )}
      <div
        className="mono-label"
        style={{ fontSize: 8, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.5 }}
      >
        Correlational, within your account. We compare bets by how much memory had accumulated when
        each was decided, not a memory on/off test. Bets with deeper memory are usually also later
        bets, so getting better over time, easier later bets, or survivorship could explain this
        rather than memory itself.
      </div>
    </div>
  );
}

export function GauntletMetricsPanel() {
  const fAccept = useServerFn(getAcceptanceRate);
  const fAutonomy = useServerFn(getAutonomyRatio);
  const fRitual = useServerFn(getRitualRetention);
  const fMem = useServerFn(getMemoryCompounding);
  const fAccuracy = useServerFn(getOutcomeAccuracy);
  const fLift = useServerFn(getMemoryLift);

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
  const memQ = useQuery({
    queryKey: ["gauntlet-memory"],
    queryFn: () => fMem(),
  });
  const accuracyQ = useQuery({
    queryKey: ["gauntlet-accuracy"],
    queryFn: () => fAccuracy({ data: { days: 90 } }),
  });
  const liftQ = useQuery({
    queryKey: ["gauntlet-memory-lift"],
    queryFn: () => fLift({ data: { days: 90 } }),
  });

  const a = acceptQ.data;
  const c = autonomyQ.data;
  const b = ritualQ.data;

  // Metric A copy.
  const acceptValue = a == null || a.rate == null ? "-" : pct(a.rate);
  const acceptSub =
    a == null
      ? ""
      : a.decided === 0
        ? "not enough data yet. No calls decided in 14d."
        : `${a.approved} approved · ${a.rejected} rejected · last 14d`;

  // Metric C copy.
  const autonomyValue = c == null || c.ratio == null ? "-" : pct(c.ratio);
  const autonomySub =
    c == null
      ? ""
      : c.unattended + c.gated === 0
        ? "not enough data yet. No side-effecting actions in 14d."
        : `${c.unattended} ran unattended · ${c.gated} came to you · last 14d`;

  // Metric B copy — retention shown as days-active (7d) + streak.
  const ritualReady = b?.tableReady ?? false;
  const ritualValue = b == null || !ritualReady ? "-" : `${b.daysActive7}/7`;
  const ritualSub =
    b == null
      ? ""
      : !ritualReady
        ? "not enough data yet. Ritual tracking lights up on next sync."
        : b.daysActive7 === 0
          ? "not enough data yet. Open Today to start the streak."
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
          meaning="Of the calls you actually decided, the share you approved: how often the agents' proposals match your judgment."
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
          meaning="Days in the last week you opened Today to clear the queue, the daily ritual that keeps the loop honest and you in the loop."
          substat={ritualSub}
          loading={ritualQ.isLoading}
        />
      </div>

      {/* The autonomy progression as its full stage visual (observing -> proving ->
          trusted), relocated here from Today. The metric card above is the
          at-a-glance number; this is the progression it sits on. */}
      <div style={{ marginTop: 12 }}>
        <AutonomyCard />
      </div>

      {/* MOAT-METRIC — outcome accuracy, the memory-depth split, and memory
          compounds as the three honest faces of the moat proof (judgment
          validating + accuracy-by-memory-depth + memory reused). */}
      <OutcomeAccuracyCard data={accuracyQ.data} loading={accuracyQ.isLoading} />

      <MemoryDepthSplitCard data={liftQ.data} loading={liftQ.isLoading} />

      <MemoryCompoundsCard data={memQ.data} loading={memQ.isLoading} />

      {(acceptQ.error ||
        autonomyQ.error ||
        ritualQ.error ||
        memQ.error ||
        accuracyQ.error ||
        liftQ.error) && (
        <div className="bento" style={{ padding: 16, marginTop: 12 }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load some metrics
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 6 }}>
            {
              (
                (acceptQ.error ||
                  autonomyQ.error ||
                  ritualQ.error ||
                  memQ.error ||
                  accuracyQ.error ||
                  liftQ.error) as Error
              ).message
            }
          </p>
        </div>
      )}
    </div>
  );
}
