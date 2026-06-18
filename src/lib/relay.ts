// AGENT-EXP: pure, side-effect-free mappers that turn the live swarm/mission
// data into the calm "relay" the user reads. No React, no server imports (the
// data shapes are type-only), so this stays unit-testable and client-safe.
//
// The relay shows agents IN MOTION grouped by station: each agent is one row
// showing only its latest line (ephemeral), parallel agents read as calm rows,
// and the work collapses to the artifact when done. Crew agents and the
// conductor are never shown in the relay.

import type { SwarmHud } from "@/lib/swarm.functions";
import type { MissionDetail } from "@/lib/missions.functions";
import {
  AGENT_STATION_ORDER,
  AGENT_STATIONS,
  agentDisplayName,
  agentRelayVerb,
  agentTier,
  isConductor,
  resolveStationTotal,
  type AgentStation,
} from "@/lib/agent-vocabulary";

export type RelayStatus = "running" | "gate" | "done" | "planned" | "failed" | "idle";

/** Map a raw run/mission/step status string to the relay's calm vocabulary. */
export function mapRelayStatus(s: string | null | undefined): RelayStatus {
  switch ((s ?? "").toLowerCase()) {
    case "running":
    case "queued":
    case "dispatched":
      return "running";
    case "awaiting_review":
    case "waiting_approval":
    case "gate":
      return "gate";
    case "completed":
    case "done":
      return "done";
    case "failed":
    case "halted":
    case "error":
    case "cancelled":
      return "failed";
    case "planned":
    case "ready":
      return "planned";
    default:
      return "idle";
  }
}

export type StationState = {
  station: AgentStation;
  /** The station label shown on the spine. */
  name: string;
  /** The static outcome line: what this station is for. */
  outcome: string;
  /** The live status of work at this station right now. */
  status: RelayStatus;
  /** A live one-liner: a running agent's task, the latest handoff into the station, or a rest line. */
  note: string;
  /** How many cast agents are running here right now. */
  runningCount: number;
  /** The cast agent slugs active (running or at a gate) at this station. */
  agentSlugs: string[];
};

/** Roll the live swarm HUD up into the six-station spine state. */
export function rollUpStations(hud: SwarmHud | null | undefined): StationState[] {
  const agents = hud?.agents ?? [];
  const handoffs = hud?.handoffs ?? [];
  const approvals = hud?.approvals ?? [];

  return AGENT_STATION_ORDER.map((station) => {
    const here = agents.filter(
      (a) =>
        agentTier(a.slug) === "cast" &&
        !isConductor(a.slug) &&
        resolveStationTotal(a.slug) === station,
    );
    const active = here.filter((a) => {
      const st = mapRelayStatus(a.latest_run?.status);
      return st === "running" || st === "gate";
    });
    const running = active.filter((a) => mapRelayStatus(a.latest_run?.status) === "running");
    const gateHere =
      active.some((a) => mapRelayStatus(a.latest_run?.status) === "gate") ||
      approvals.some((ap) => !!ap.agent_slug && resolveStationTotal(ap.agent_slug) === station);

    const inboundHere = handoffs
      .filter((h) => resolveStationTotal(h.to_agent_slug) === station)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];

    let note = "Clear";
    if (running[0]?.latest_run?.input) note = running[0].latest_run.input;
    else if (inboundHere?.task) note = inboundHere.task;

    const status: RelayStatus = gateHere ? "gate" : running.length > 0 ? "running" : "idle";

    return {
      station,
      name: AGENT_STATIONS[station].name,
      outcome: AGENT_STATIONS[station].blurb,
      status,
      note: note.slice(0, 140),
      runningCount: running.length,
      agentSlugs: active.map((a) => a.slug),
    };
  });
}

export type RelayStep = {
  runId: string;
  slug: string;
  name: string;
  station: AgentStation;
  status: RelayStatus;
  /** The agent's latest line (ephemeral): outcome when done, the relay verb while running. */
  latestLine: string;
  handoffToSlug: string | null;
  handoffToName: string | null;
  isGate: boolean;
};

/** Turn a mission's hops + handoff messages into ordered relay steps. */
export function toRelaySteps(detail: MissionDetail | null | undefined): RelayStep[] {
  const hops = detail?.hops ?? [];
  const messages = detail?.messages ?? [];

  return hops.map((h) => {
    const status = mapRelayStatus(h.status);
    const steps = h.steps ?? [];
    const last = steps[steps.length - 1];
    const name = agentDisplayName(h.agent_slug, h.agent_name);

    let latestLine = agentRelayVerb(h.agent_slug) ?? "working";
    if (status === "done") {
      if (last && last.kind === "final" && last.message) latestLine = last.message.slice(0, 160);
      else latestLine = `${name} finished`;
    } else if (status === "running") {
      if (last && last.kind === "thought" && last.text) latestLine = last.text.slice(0, 160);
      else latestLine = agentRelayVerb(h.agent_slug) ?? "working";
    } else if (status === "gate") {
      latestLine = "needs your sign-off";
    } else if (status === "failed") {
      latestLine = "hit a problem";
    }

    const outbound = messages.find((m) => m.source_run_id === h.run_id) ?? null;

    return {
      runId: h.run_id,
      slug: h.agent_slug,
      name,
      station: resolveStationTotal(h.agent_slug),
      status,
      latestLine,
      handoffToSlug: outbound?.to_agent_slug ?? null,
      handoffToName: outbound ? agentDisplayName(outbound.to_agent_slug) : null,
      isGate: status === "gate",
    };
  });
}

export type RelayStationGroup = { station: AgentStation; name: string; steps: RelayStep[] };

/** Group relay steps by station, in loop order, dropping empty stations. */
export function relayByStation(steps: RelayStep[]): RelayStationGroup[] {
  const map = new Map<AgentStation, RelayStep[]>();
  for (const s of steps) {
    const list = map.get(s.station) ?? [];
    list.push(s);
    map.set(s.station, list);
  }
  return AGENT_STATION_ORDER.filter((st) => map.has(st)).map((st) => ({
    station: st,
    name: AGENT_STATIONS[st].name,
    steps: map.get(st) ?? [],
  }));
}

export type MiniRelay = {
  missionId: string | null;
  title: string | null;
  /** Running cast agent slugs, for the dots. */
  agentSlugs: string[];
  /** One live line. */
  note: string;
  /** Whether anything is running at all. */
  active: boolean;
};

/** Build the one-line "what is running now" summary for Today from the swarm HUD. */
export function miniRelay(hud: SwarmHud | null | undefined): MiniRelay {
  const missions = (hud?.missions ?? []).filter((m) => mapRelayStatus(m.status) === "running");
  const newest =
    missions.slice().sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))[0] ?? null;
  const runningAgents = (hud?.agents ?? []).filter(
    (a) =>
      agentTier(a.slug) === "cast" &&
      !isConductor(a.slug) &&
      mapRelayStatus(a.latest_run?.status) === "running",
  );
  const latestHandoff = (hud?.handoffs ?? [])
    .slice()
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];

  let note = "";
  if (runningAgents[0]?.latest_run?.input) note = runningAgents[0].latest_run.input;
  else if (latestHandoff?.task) note = latestHandoff.task;

  return {
    missionId: newest?.id ?? null,
    title: newest?.title ?? null,
    agentSlugs: runningAgents.map((a) => a.slug),
    note: note.slice(0, 120),
    active: !!newest || runningAgents.length > 0,
  };
}
