// AGENT-EXP: the Engine Room "Team" tab. The full agent roster grouped by
// station (cast + the conductor + the hidden engine crew), plus the relocated
// per-agent autonomy dial and the agent inspector. This is where WE (and the
// power user) manage agents; the end user never sees this roster, only the relay.
//
// Engine-Room: full agent mesh roster + per-agent autonomy arcs + run/memory history
//   -> THIS is the one door; nothing here sits on the calm front
//   -> surfaced on demand as "your team: who they are, what they are trusted to do".

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSwarmHud } from "@/lib/swarm.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import { AgentMark } from "@/components/agents/AgentMark";
import { TrustDial } from "@/components/cockpit/TrustDial";
import { AgentInspector } from "@/components/cockpit/AgentInspector";
import {
  AGENT_STATION_ORDER,
  AGENT_STATIONS,
  agentDisplayName,
  agentMark,
  castByStation,
  conductorEntry,
  crewEntries,
  type CatalogEntry,
} from "@/lib/agent-vocabulary";

function RosterRow({ entry, muted }: { entry: CatalogEntry; muted?: boolean }) {
  const { hue } = agentMark(entry.slug);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 2px" }}>
      <AgentMark slug={entry.slug} size={26} />
      <div style={{ minWidth: 0, opacity: muted ? 0.7 : 1 }}>
        <div style={{ fontSize: 13, fontWeight: 540, color: hue }}>{entry.name}</div>
        <div style={{ fontSize: 12, color: "var(--ink-subtle)", lineHeight: 1.45 }}>
          {entry.blurb}
        </div>
      </div>
    </div>
  );
}

function StationGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function AgentRosterPanel({ workspaceId }: { workspaceId: string | null }) {
  const hudFn = useServerFn(getSwarmHud);
  const q = useQuery({
    queryKey: ["swarm", "hud", workspaceId],
    queryFn: () => hudFn({ data: { workspaceId } }),
    refetchInterval: 6000,
    refetchIntervalInBackground: false,
  });
  const agents = q.data?.agents ?? [];
  const nameById = new Map(
    agents.map((a) => [a.agent_id, { name: agentDisplayName(a.slug, a.name), role: a.role }]),
  );
  const conductor = conductorEntry();
  const crew = crewEntries();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: 12,
          background: "var(--surface-1)",
          padding: "16px 18px",
        }}
      >
        <MonoLabel>The team, by station</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 6, maxWidth: 560 }}>
          The full mesh lives here. The user never sees this roster; they meet these agents in
          motion, as the relay, named for what they do.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {AGENT_STATION_ORDER.map((st) => {
            const members = castByStation(st);
            if (members.length === 0) return null;
            return (
              <StationGroup key={st} label={AGENT_STATIONS[st].name}>
                {members.map((e) => (
                  <RosterRow key={e.slug} entry={e} />
                ))}
              </StationGroup>
            );
          })}
          {conductor ? (
            <StationGroup label="Conductor">
              <RosterRow entry={conductor} />
            </StationGroup>
          ) : null}
          {crew.length > 0 ? (
            <StationGroup label="Engine crew · never shown to users">
              {crew.map((e) => (
                <RosterRow key={e.slug} entry={e} muted />
              ))}
            </StationGroup>
          ) : null}
        </div>
      </section>

      {/* Relocated from the retired Missions roster grid. */}
      <TrustDial nameById={nameById} />
      <AgentInspector agents={agents} />
    </div>
  );
}
