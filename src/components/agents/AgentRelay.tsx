// AGENT-EXP: the live relay. Shows agents IN MOTION, grouped by station, each as
// one calm ephemeral row (mark + name + latest line + status), with the handoff
// arrow. The gate step reads in ember ("needs your sign-off").
//
// Engine-Room: agent_messages handoff chain + agent_runs hop statuses
//   -> the raw tool-calls/thoughts stay in the mission's "Full execution trace"
//   -> surfaced here as a named-face relay grouped by loop station.
//
//   full = bound to one mission (mission / build detail).
//   mini = one live "what is running now" line for Today.

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { getMission } from "@/lib/missions.functions";
import { getSwarmHud } from "@/lib/swarm.functions";
import { MonoLabel, StepDot } from "@/components/cadence/Primitives";
import { AgentMark } from "@/components/agents/AgentMark";
import { miniRelay, relayByStation, toRelaySteps, type RelayStatus } from "@/lib/relay";

function dotFor(s: RelayStatus): "running" | "completed" | "planned" | "failed" | "gate" {
  if (s === "running") return "running";
  if (s === "done") return "completed";
  if (s === "failed") return "failed";
  if (s === "gate") return "gate";
  return "planned";
}

export function AgentRelay(props: {
  variant: "full" | "mini";
  missionId?: string;
  workspaceId?: string | null;
}) {
  if (props.variant === "mini") return <MiniRelayLine workspaceId={props.workspaceId ?? null} />;
  return props.missionId ? <FullRelay missionId={props.missionId} /> : null;
}

function FullRelay({ missionId }: { missionId: string }) {
  const fGet = useServerFn(getMission);
  const m = useQuery({
    // Same key as the mission-detail route, so this shares its cache (no extra fetch).
    queryKey: ["mission", missionId],
    queryFn: () => fGet({ data: { missionId } }),
    refetchInterval: (q) => {
      const st = q.state.data?.mission.status;
      return st === "running" || st === "queued" ? 2000 : false;
    },
  });
  const steps = toRelaySteps(m.data);
  if (steps.length === 0) return null;
  const groups = relayByStation(steps);

  return (
    <section
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: 12,
        background: "var(--surface-1)",
        padding: "16px 18px",
        marginBottom: 20,
      }}
    >
      <MonoLabel>The relay</MonoLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
        {groups.map((g) => (
          <div key={g.station}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
                marginBottom: 8,
              }}
            >
              {g.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {g.steps.map((s) => (
                <div key={s.runId} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AgentMark slug={s.slug} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 540, color: "var(--ink)" }}>
                        {s.name}
                      </span>
                      <StepDot status={dotFor(s.status)} />
                      {s.handoffToName ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            color: "var(--ink-faint)",
                          }}
                        >
                          <ArrowRight size={11} strokeWidth={1.75} />
                          {s.handoffToName}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: s.isGate ? "var(--ember)" : "var(--ink-subtle)",
                        marginTop: 2,
                        lineHeight: 1.45,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {s.latestLine}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniRelayLine({ workspaceId }: { workspaceId: string | null }) {
  const hudFn = useServerFn(getSwarmHud);
  const q = useQuery({
    queryKey: ["swarm", "hud", workspaceId],
    queryFn: () => hudFn({ data: { workspaceId } }),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });
  const r = miniRelay(q.data);

  if (!r.active) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--ink-subtle)",
        }}
      >
        <span className="dot dot-planned" />
        All quiet. The loop runs itself.
      </div>
    );
  }

  const body = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        {r.agentSlugs.slice(0, 4).map((slug) => (
          <AgentMark key={slug} slug={slug} size={22} />
        ))}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {r.note || r.title || "Working"}
      </span>
    </div>
  );

  if (r.missionId) {
    return (
      <Link
        to="/missions/$missionId"
        params={{ missionId: r.missionId }}
        style={{ textDecoration: "none", display: "block" }}
      >
        {body}
      </Link>
    );
  }
  return body;
}
