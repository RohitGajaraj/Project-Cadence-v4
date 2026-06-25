// D4b — the rich side-by-side mission checkpoint-diff surface.
//
// Rendered on a REPLAY mission (one that carries `replayed_from_mission_id`). It
// fetches the original via the existing `getMission` (RLS-scoped, same caller),
// runs the pure `diffMissions`, and shows what the replay changed: the metric
// columns (hops / cost / tokens / tool calls / duration) with signed deltas, the
// per-hop output drift, and the headline "the answer changed". Calm by default
// (engine-room doctrine): neutral ink + directional glyphs carry the signal, no
// celebration colour; `--rose` only when the replay regressed on failures. Fully
// degrade-silent — a load error renders nothing rather than a broken panel.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MonoLabel } from "@/components/cadence/Primitives";
import { getMission, type MissionDetail } from "@/lib/missions.functions";
import { diffMissions } from "@/lib/mission-diff";

function fmtCost(n: number): string {
  return n > 0 && n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}
function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}
function fmtDur(ms: number | null): string {
  if (ms === null) return "-";
  const s = Math.round(ms / 1000);
  return s < 90 ? `${s}s` : `${(s / 60).toFixed(1)}m`;
}

/** A signed delta chip; `down` = the desirable direction for this metric (for the rose-on-regression cue only). */
function Delta({
  value,
  render,
  desirable,
}: {
  value: number;
  render: (n: number) => string;
  desirable?: "lower" | "higher" | "neutral";
}) {
  if (value === 0) {
    return (
      <span style={{ fontSize: 10, color: "var(--ink-faint)" }} title="No change">
        ·
      </span>
    );
  }
  const up = value > 0;
  const glyph = up ? "▲" : "▼";
  // Only colour a genuine regression (more cost / more failures than the original);
  // everything else stays calm neutral and lets the number speak.
  const regressed = (desirable === "lower" && up) || (desirable === "higher" && !up) ? true : false;
  return (
    <span
      style={{
        fontSize: 10,
        color: regressed ? "var(--rose)" : "var(--ink-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {glyph} {render(Math.abs(value))}
    </span>
  );
}

function MetricRow({
  label,
  original,
  replay,
  delta,
}: {
  label: string;
  original: string;
  replay: string;
  delta: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr 0.9fr 0.7fr",
        gap: 8,
        alignItems: "baseline",
        padding: "5px 0",
        borderTop: "1px solid color-mix(in oklab, var(--ink-faint) 30%, transparent)",
        fontSize: 12.5,
      }}
    >
      <span style={{ color: "var(--ink-subtle)" }}>{label}</span>
      <span style={{ color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
        {original}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{replay}</span>
      <span style={{ textAlign: "right" }}>{delta}</span>
    </div>
  );
}

export function MissionDiff({
  current,
  counterpartId,
}: {
  /** The REPLAY mission currently on screen. */
  current: MissionDetail;
  /** The ORIGINAL mission id (`replayed_from_mission_id`). */
  counterpartId: string;
}) {
  const fGet = useServerFn(getMission);
  const q = useQuery({
    queryKey: ["mission", counterpartId],
    queryFn: () => fGet({ data: { missionId: counterpartId } }),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel>comparing with the original…</MonoLabel>
      </div>
    );
  }
  // Degrade silent: a missing/forbidden original renders nothing, never a broken panel.
  if (q.isError || !q.data) return null;

  const diff = diffMissions(q.data, current);
  const driftHops = diff.hops.filter(
    (h) => h.presence !== "both" || h.outputChanged || !h.sameAgent,
  );

  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <MonoLabel style={{ marginBottom: 4 }}>replay vs original · what changed</MonoLabel>

      {diff.finalOutputChanged ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "0 0 10px" }}>
          The final answer changed between the two runs.
        </p>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", margin: "0 0 10px" }}>
          The final answer is unchanged; the run shape may still differ below.
        </p>
      )}

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr 0.9fr 0.7fr",
          gap: 8,
          fontSize: 9,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          paddingBottom: 2,
        }}
      >
        <span />
        <span>Original</span>
        <span>Replay</span>
        <span style={{ textAlign: "right" }}>Δ</span>
      </div>

      <MetricRow
        label="Hops"
        original={fmtNum(diff.original.hopCount)}
        replay={fmtNum(diff.replay.hopCount)}
        delta={<Delta value={diff.deltas.hopCount} render={fmtNum} desirable="neutral" />}
      />
      <MetricRow
        label="Cost"
        original={fmtCost(diff.original.costUsd)}
        replay={fmtCost(diff.replay.costUsd)}
        delta={<Delta value={diff.deltas.costUsd} render={fmtCost} desirable="lower" />}
      />
      <MetricRow
        label="Tokens in"
        original={fmtNum(diff.original.tokensIn)}
        replay={fmtNum(diff.replay.tokensIn)}
        delta={<Delta value={diff.deltas.tokensIn} render={fmtNum} desirable="neutral" />}
      />
      <MetricRow
        label="Tokens out"
        original={fmtNum(diff.original.tokensOut)}
        replay={fmtNum(diff.replay.tokensOut)}
        delta={<Delta value={diff.deltas.tokensOut} render={fmtNum} desirable="neutral" />}
      />
      <MetricRow
        label="Tool calls"
        original={fmtNum(diff.original.toolCalls)}
        replay={fmtNum(diff.replay.toolCalls)}
        delta={<Delta value={diff.deltas.toolCalls} render={fmtNum} desirable="neutral" />}
      />
      <MetricRow
        label="Failed tool calls"
        original={fmtNum(diff.original.toolCallsFailed)}
        replay={fmtNum(diff.replay.toolCallsFailed)}
        delta={<Delta value={diff.deltas.toolCallsFailed} render={fmtNum} desirable="lower" />}
      />
      <MetricRow
        label="Duration"
        original={fmtDur(diff.original.durationMs)}
        replay={fmtDur(diff.replay.durationMs)}
        delta={
          diff.deltas.durationMs === null ? (
            <span style={{ fontSize: 10, color: "var(--ink-faint)" }}>—</span>
          ) : (
            <Delta value={diff.deltas.durationMs} render={fmtDur} desirable="lower" />
          )
        }
      />

      {/* Per-hop drift */}
      {driftHops.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <MonoLabel style={{ marginBottom: 4 }}>hops that differ</MonoLabel>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {driftHops.map((h) => (
              <li
                key={h.index}
                style={{
                  fontSize: 12,
                  color: "var(--ink-subtle)",
                  padding: "3px 0",
                }}
              >
                <span style={{ color: "var(--ink-muted)" }}>
                  Hop {h.index + 1}
                  {h.agentSlug ? ` · ${h.agentSlug}` : ""}
                </span>{" "}
                {h.presence === "original-only"
                  ? "ran only in the original"
                  : h.presence === "replay-only"
                    ? "ran only in the replay"
                    : !h.sameAgent
                      ? "ran a different agent"
                      : h.outputChanged
                        ? "produced a different output"
                        : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10 }}>
          Every hop matched the original step for step.
        </p>
      )}
    </div>
  );
}
