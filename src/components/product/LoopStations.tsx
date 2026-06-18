// AGENT-EXP: the six-station loop spine. The standing map the user navigates,
// Sense -> Decide -> Define -> Build -> Ship -> Learn. Each station shows one
// outcome line and, when work is live, one state line + a status dot. This is
// phases, not personnel: the named agents appear in motion in the relay, not here.
//
// Engine-Room: agent_runs + agent_messages + agent_approvals rolled up per station
//   -> the per-agent runs/handoffs live in the relay (mission detail) + Engine Room
//   -> surfaced as a calm six-station spine, one outcome + one live state per phase.

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSwarmHud } from "@/lib/swarm.functions";
import { MonoLabel, StepDot } from "@/components/cadence/Primitives";
import { rollUpStations, type RelayStatus } from "@/lib/relay";
import type { AgentStation } from "@/lib/agent-vocabulary";

// Where each station's work lives, so a click lands on the right surface.
const STATION_TO: Record<AgentStation, string> = {
  sense: "/product",
  decide: "/product",
  define: "/product",
  build: "/build",
  ship: "/product",
  learn: "/memory",
};

function dotFor(s: RelayStatus): "running" | "gate" | "planned" {
  if (s === "running") return "running";
  if (s === "gate") return "gate";
  return "planned";
}

export function LoopStations({ workspaceId }: { workspaceId: string | null }) {
  const hudFn = useServerFn(getSwarmHud);
  const q = useQuery({
    queryKey: ["swarm", "hud", workspaceId],
    queryFn: () => hudFn({ data: { workspaceId } }),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });
  const stations = rollUpStations(q.data);

  return (
    <section style={{ marginBottom: 26 }}>
      <MonoLabel>The loop</MonoLabel>
      <div
        style={{
          marginTop: 10,
          border: "1px solid var(--hairline)",
          borderRadius: 12,
          background: "var(--surface-1)",
          overflow: "hidden",
        }}
      >
        {stations.map((st, i) => {
          const live = st.status !== "idle";
          return (
            <Link
              key={st.station}
              to={STATION_TO[st.station]}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 16px",
                textDecoration: "none",
                color: "inherit",
                borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
              }}
            >
              <StepDot status={dotFor(st.status)} />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                  width: 64,
                  flexShrink: 0,
                }}
              >
                {st.name}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  color: live ? "var(--ink)" : "var(--ink-subtle)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {live ? st.note : st.outcome}
              </span>
              {st.runningCount > 0 ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--action-blue)",
                    fontFamily: "var(--font-mono)",
                    flexShrink: 0,
                  }}
                >
                  {st.runningCount} running
                </span>
              ) : st.status === "gate" ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ember)",
                    fontFamily: "var(--font-mono)",
                    flexShrink: 0,
                  }}
                >
                  needs you
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
