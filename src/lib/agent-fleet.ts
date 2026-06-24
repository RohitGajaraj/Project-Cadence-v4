// AGENT-FLEET-VIEW (v11 #30) — the pure by-AGENT fleet model (air-traffic-control).
//
// DELEGATE-DESK (#25) frames the work BY MISSION — the lifecycle of each task you
// handed off. This is the orthogonal lens: BY AGENT — the fleet itself. It pivots
// the same agent_runs rows on agent_slug so a PM orchestrating a fleet can see, at
// a glance, who is working, how loaded each agent is, who is idle, and — the
// founder's "supervise by exception" — who is hitting failures. Same data, a
// different question: not "where is my work" but "how is my fleet".
//
// PURE: no db / network / React / time-of-day. The adapter passes run rows (and
// optionally the roster, so idle agents still show); the route renders. The
// invariants (per-agent tallies, the attention-first ordering, the summary) are
// unit-verified.

/** A run row the fleet needs (a subset of agent_runs). */
export type FleetRunInput = {
  agent_slug: string | null;
  agent_name: string | null;
  status: string | null;
  created_at: string | null;
};

/** A roster entry (so agents with zero runs still appear, as idle). */
export type FleetRosterInput = { slug: string; name: string | null };

export type FleetAgentState = "working" | "queued" | "attention" | "idle";

export type FleetAgent = {
  slug: string;
  name: string;
  running: number;
  queued: number;
  done: number;
  failed: number;
  total: number;
  /** Live work in flight (running + queued). */
  liveLoad: number;
  /** Most recent run timestamp, or null when the agent has never run. */
  lastActiveAt: string | null;
  state: FleetAgentState;
};

export type FleetSummary = {
  totalAgents: number;
  working: number;
  idle: number;
  totalRunning: number;
  totalQueued: number;
  withExceptions: number;
};

export type AgentFleet = {
  agents: FleetAgent[];
  summary: FleetSummary;
  /** Plain-language headline, honest when the fleet is quiet/empty. */
  headline: string;
};

type RunBucket = "running" | "queued" | "done" | "failed" | "other";

const RUN_STATE: Readonly<Record<string, RunBucket>> = {
  running: "running",
  in_progress: "running",
  dispatched: "running",
  processing: "running",
  executing: "running",
  active: "running",
  queued: "queued",
  pending: "queued",
  scheduled: "queued",
  proposed: "queued",
  completed: "done",
  done: "done",
  succeeded: "done",
  success: "done",
  error: "failed",
  failed: "failed",
  cancelled: "failed",
  canceled: "failed",
  denied: "failed",
  aborted: "failed",
  timed_out: "failed",
};

/** PURE — bucket a run status (normalized). Unknown → "other". */
export function runBucket(status: string | null | undefined): RunBucket {
  return RUN_STATE[(status ?? "").trim().toLowerCase()] ?? "other";
}

function stateFor(running: number, queued: number, failed: number): FleetAgentState {
  if (running > 0) return "working";
  if (queued > 0) return "queued";
  if (failed > 0) return "attention";
  return "idle";
}

/**
 * PURE — compose the fleet from run rows (+ optional roster). Agents are ordered
 * attention-first: by live load, then recent failures, then most-recently-active,
 * then slug — so the agents a supervisor should look at float to the top and idle
 * agents sink. Never throws on malformed rows; honest when empty.
 */
export function computeAgentFleet(
  runsInput: readonly FleetRunInput[],
  roster: readonly FleetRosterInput[] = [],
): AgentFleet {
  const runs = (Array.isArray(runsInput) ? runsInput : []).filter(
    (r): r is FleetRunInput => !!r && typeof r.agent_slug === "string" && r.agent_slug.length > 0,
  );

  type Acc = Omit<FleetAgent, "liveLoad" | "state">;
  const bySlug = new Map<string, Acc>();
  const ensure = (slug: string, name: string | null): Acc => {
    let a = bySlug.get(slug);
    if (!a) {
      a = { slug, name: name || slug, running: 0, queued: 0, done: 0, failed: 0, total: 0, lastActiveAt: null };
      bySlug.set(slug, a);
    } else if ((!a.name || a.name === a.slug) && name) {
      a.name = name;
    }
    return a;
  };

  // Seed the roster first so zero-run agents still appear as idle.
  for (const r of roster) {
    if (r && typeof r.slug === "string" && r.slug.length > 0) ensure(r.slug, r.name);
  }

  for (const r of runs) {
    const a = ensure(r.agent_slug as string, r.agent_name);
    a.total += 1;
    const bucket = runBucket(r.status);
    if (bucket === "running") a.running += 1;
    else if (bucket === "queued") a.queued += 1;
    else if (bucket === "done") a.done += 1;
    else if (bucket === "failed") a.failed += 1;
    if (r.created_at && (!a.lastActiveAt || r.created_at > a.lastActiveAt)) {
      a.lastActiveAt = r.created_at;
    }
  }

  const agents: FleetAgent[] = [...bySlug.values()].map((a) => ({
    ...a,
    liveLoad: a.running + a.queued,
    state: stateFor(a.running, a.queued, a.failed),
  }));

  agents.sort((a, b) => {
    if (b.liveLoad !== a.liveLoad) return b.liveLoad - a.liveLoad;
    if (b.failed !== a.failed) return b.failed - a.failed;
    const at = a.lastActiveAt ?? "";
    const bt = b.lastActiveAt ?? "";
    if (at !== bt) return bt.localeCompare(at);
    return a.slug.localeCompare(b.slug);
  });

  const summary: FleetSummary = {
    totalAgents: agents.length,
    working: agents.filter((a) => a.state === "working").length,
    idle: agents.filter((a) => a.state === "idle").length,
    totalRunning: agents.reduce((n, a) => n + a.running, 0),
    totalQueued: agents.reduce((n, a) => n + a.queued, 0),
    withExceptions: agents.filter((a) => a.failed > 0).length,
  };

  return { agents, summary, headline: summarizeFleet(summary) };
}

/** PURE — one honest headline for the fleet. */
export function summarizeFleet(s: FleetSummary): string {
  if (s.totalAgents === 0) {
    return "No agents have run yet. Dispatch a mission and your fleet shows up here.";
  }
  const parts: string[] = [];
  if (s.totalRunning > 0) parts.push(`${s.totalRunning} run${s.totalRunning === 1 ? "" : "s"} in flight`);
  if (s.totalQueued > 0) parts.push(`${s.totalQueued} queued`);
  parts.push(`${s.working} of ${s.totalAgents} agent${s.totalAgents === 1 ? "" : "s"} active`);
  if (s.withExceptions > 0) {
    parts.push(`${s.withExceptions} with exceptions`);
  }
  return parts.join(" · ") + ".";
}
