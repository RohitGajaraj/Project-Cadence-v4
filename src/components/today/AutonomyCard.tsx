// M-A — the observing -> proving -> trusted progression made visible on Today.
//
// Reuses the Gauntlet's real Metric C (getAutonomyRatio): the share of
// side-effecting actions the loop ran unattended vs the share it gated for your
// call. We reflect that real ratio onto the trust ladder so the operator can SEE
// the loop earning trust over time. Read-only and honest: a sparse window reads
// "not enough data yet" (never an invented step), and the copy describes where
// the loop sits without claiming an advance button or auto-advance that does not
// exist yet. Styling follows GauntletMetricsPanel (bento, MonoLabel, serif
// tabular headline, faint sub-line).
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Gauge, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { getAutonomyRatio } from "@/lib/gauntlet.functions";
import type { Trend } from "@/lib/gauntlet-metrics";
import { MonoLabel } from "@/components/cadence/Primitives";
import {
  AUTONOMY_STAGES,
  autonomyStage,
  stageIndex,
  stageMeaning,
} from "@/lib/autonomy-progression";

export function AutonomyCard() {
  const fAutonomy = useServerFn(getAutonomyRatio);
  const q = useQuery({
    queryKey: ["today-autonomy"],
    queryFn: () => fAutonomy({ data: { days: 14 } }),
  });

  const c = q.data;
  const hasData = c != null && c.ratio != null;
  const stage = autonomyStage(c?.ratio ?? null);
  const idx = stageIndex(stage);
  const pctText = c?.ratio == null ? "—" : `${Math.round(c.ratio * 100)}%`;
  // Trend only when both windows carry data — mirror the Gauntlet's honesty.
  const showTrend = hasData && c!.priorRatio != null;

  return (
    <section className="bento" style={{ padding: "12px var(--card-pad)", marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <MonoLabel icon={Gauge}>Autonomy · the loop earning trust</MonoLabel>
        {!q.isLoading && showTrend && <TrendHint trend={c!.trend} />}
      </div>

      {q.isLoading ? (
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint)" }}>
          loading…
        </div>
      ) : hasData ? (
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: 92 }}>
            <div
              className="font-display tabular-nums"
              style={{ fontSize: 30, color: "var(--ink)" }}
            >
              {pctText}
            </div>
            <div
              className="mono-label"
              style={{ fontSize: 8.5, color: "var(--ink-faint)", marginTop: 2 }}
            >
              ran unattended
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <StageStrip currentIndex={idx} />
            <p
              style={{
                fontSize: 11.5,
                color: "var(--ink-subtle)",
                lineHeight: 1.45,
                marginTop: 10,
              }}
            >
              {c!.unattended} ran unattended · {c!.gated} came to you · last 14d.{" "}
              {stageMeaning(stage)}
            </p>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.45 }}>
          Not enough data yet. No side-effecting work ran in the last 14 days. As the loop takes on
          reversible work, the share it carries unattended shows here, rising from observing to
          proving to trusted.
        </p>
      )}
    </section>
  );
}

/** The observing -> proving -> trusted ladder with the loop's current rung lit.
 *  A reflection of the real ratio, not a stored tier — purely a visual of where
 *  the unattended share places the loop today. */
function StageStrip({ currentIndex }: { currentIndex: number }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {AUTONOMY_STAGES.map((s, i) => {
        const reached = i <= currentIndex;
        const current = i === currentIndex;
        const isLast = i === AUTONOMY_STAGES.length - 1;
        return (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: isLast ? "0 0 auto" : 1,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: current ? 9 : 7,
                  height: current ? 9 : 7,
                  borderRadius: 99,
                  background: reached ? "var(--ember)" : "var(--surface-2)",
                  border: current
                    ? "2px solid color-mix(in oklab, var(--ember) 45%, transparent)"
                    : "none",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                className="mono-label"
                style={{
                  fontSize: 8.5,
                  color: current
                    ? "var(--ink)"
                    : reached
                      ? "var(--ink-subtle)"
                      : "var(--ink-faint)",
                }}
              >
                {s}
              </span>
            </span>
            {!isLast && (
              <span
                style={{
                  flex: 1,
                  height: 2,
                  borderRadius: 99,
                  background: i < currentIndex ? "var(--ember)" : "var(--surface-2)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrendHint({ trend }: { trend: Trend }) {
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
