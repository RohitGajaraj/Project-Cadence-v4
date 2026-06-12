// MissionGraph — the agent mesh as a live DAG, ported 1:1 from
// design-reference/cadence/missions.jsx MissionGraphView (Ember Editorial,
// screen 4b). The orchestrator hub dispatches to specialist nodes (dashed
// curves); sequential edges show the handoff chain. This replaces the old
// depth-bucketed DAG; the export name stays stable for its single call site
// (_authenticated.missions.$missionId.tsx), but the contract is now the
// reference's: a flat list of plan steps in the reference status vocabulary.
import { useState } from "react";
import { StatusBadge } from "@/components/cadence/Primitives";

export type MissionGraphStep = {
  agent: string;
  goal: string;
  /** Reference vocabulary: completed | running | gate | failed | planned. */
  status: string;
  note?: string | null;
};

export function MissionGraph({ steps }: { steps: MissionGraphStep[] }) {
  const [selStep, setSelStep] = useState<number | null>(null);
  const onSelect = (i: number | null) => setSelStep(i);
  const NW = 138,
    NH = 54,
    GAP = 26;
  const width = Math.max(560, steps.length * (NW + GAP) + 20);
  const hubX = width / 2,
    hubY = 34;
  const nodeY = 118;
  const color = (st: string) =>
    st === "completed"
      ? "var(--emerald)"
      : st === "running"
        ? "var(--action-blue)"
        : st === "gate"
          ? "var(--ember)"
          : st === "failed"
            ? "var(--rose)"
            : "var(--ink-faint)";
  const sel = selStep == null ? null : steps[selStep];
  return (
    <div>
      <div className="scrollbar-thin" style={{ overflowX: "auto" }}>
        <svg
          width={width}
          height={200}
          style={{ display: "block", minWidth: "100%" }}
          role="group"
          aria-label="Mission execution graph"
        >
          {/* dispatch edges (hub → node), dashed */}
          {steps.map((s, i) => {
            const nx = 10 + i * (NW + GAP) + NW / 2;
            return (
              <path
                key={"d" + i}
                d={`M ${hubX} ${hubY + 16} C ${hubX} ${hubY + 50}, ${nx} ${nodeY - 40}, ${nx} ${nodeY - 6}`}
                fill="none"
                stroke="var(--hairline-strong)"
                strokeWidth="1"
                strokeDasharray="3 4"
                opacity="0.7"
              ></path>
            );
          })}
          {/* sequential edges */}
          {steps.slice(0, -1).map((s, i) => {
            const x1 = 10 + i * (NW + GAP) + NW,
              x2 = x1 + GAP;
            const done = s.status === "completed";
            return (
              <g key={"e" + i}>
                <line
                  x1={x1}
                  y1={nodeY + NH / 2}
                  x2={x2}
                  y2={nodeY + NH / 2}
                  stroke={done ? "var(--emerald)" : "var(--hairline-strong)"}
                  strokeWidth="1.4"
                ></line>
                <path
                  d={`M ${x2 - 5} ${nodeY + NH / 2 - 3.5} L ${x2} ${nodeY + NH / 2} L ${x2 - 5} ${nodeY + NH / 2 + 3.5}`}
                  fill="none"
                  stroke={done ? "var(--emerald)" : "var(--hairline-strong)"}
                  strokeWidth="1.4"
                ></path>
              </g>
            );
          })}
          {/* orchestrator hub */}
          <g>
            <circle cx={hubX} cy={hubY} r="15" fill="var(--hero-bg)"></circle>
            <circle cx={hubX} cy={hubY} r="4" fill="var(--ember)" className="gnode-live"></circle>
            <text
              x={hubX}
              y={hubY - 22}
              textAnchor="middle"
              style={{
                fill: "var(--ink-subtle)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8.5,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              orchestrator
            </text>
          </g>
          {/* specialist nodes */}
          {steps.map((s, i) => {
            const x = 10 + i * (NW + GAP);
            const active = selStep === i;
            const c = color(s.status);
            const liveNode = s.status === "running" || s.status === "gate";
            return (
              <g
                key={"n" + i}
                role="button"
                tabIndex={0}
                aria-label={`${s.agent} · ${s.status}`}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(active ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(active ? null : i);
                  }
                }}
              >
                <rect
                  x={x}
                  y={nodeY}
                  width={NW}
                  height={NH}
                  rx="10"
                  fill={active ? "var(--surface-2)" : "var(--canvas)"}
                  stroke={active ? "var(--hairline-strong)" : "var(--hairline)"}
                  strokeWidth="1"
                ></rect>
                <rect x={x} y={nodeY} width="3" height={NH} rx="1.5" fill={c} opacity="0.9"></rect>
                <circle
                  cx={x + 16}
                  cy={nodeY + 17}
                  r="3.5"
                  fill={c}
                  className={liveNode ? "gnode-live" : undefined}
                ></circle>
                <text
                  x={x + 26}
                  y={nodeY + 21}
                  style={{
                    fill: "var(--agent)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {s.agent.length > 15 ? s.agent.slice(0, 14) + "…" : s.agent}
                </text>
                <text
                  x={x + 13}
                  y={nodeY + 40}
                  style={{
                    fill: "var(--ink-subtle)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                  }}
                >
                  {s.status}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {sel ? (
        <div
          className="fade-up"
          style={{
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--surface-1)",
            border: "1px solid var(--hairline)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mono-label" style={{ color: "var(--agent)" }}>
              {sel.agent}
            </span>
            <StatusBadge status={sel.status} />
            <span style={{ flex: 1 }}></span>
            <button
              className="mono-label"
              style={{ fontSize: 8.5, color: "var(--ink-faint)" }}
              onClick={() => onSelect(null)}
            >
              close
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 5 }}>{sel.goal}</div>
          {sel.note ? (
            <div style={{ fontSize: 11.5, color: "var(--rose)", marginTop: 3 }}>{sel.note}</div>
          ) : null}
        </div>
      ) : (
        <div className="mono-label" style={{ fontSize: 8.5, marginTop: 8 }}>
          click a node for details · dashed = dispatch · solid = handoff
        </div>
      )}
    </div>
  );
}
