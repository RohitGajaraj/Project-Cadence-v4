// DELEGATE-DESK (v11 #25) — the pure "delegate and walk away" desk model.
//
// The engine already runs missions asynchronously (the cron sweeper advances
// them), but the felt pattern — set up a task, hand it to the agents, walk away,
// and come back to finished work — is not surfaced as a hero flow. This module
// re-frames the existing mission list through that lifecycle lens: it partitions
// missions into the lanes a delegator actually thinks in (Needs you · Working ·
// Queued · Done · Attention), computes each mission's progress, and writes one
// honest headline. It is the action-system thesis ("the work is done") made
// legible, distinct from a generic background-agent UX by being governed (HITL at
// gates surfaces in "Needs you") and trail-backed (each mission links its steps).
//
// PURE: no db / network / React / time-of-day. The server adapter passes mission
// rows in; the route renders the lanes. The invariants (every mission in exactly
// one lane, the status→lane mapping, progress math, the summary) are unit-verified.

/** The fields the desk needs from a mission row (a subset of MissionListRow). */
export type DeskMissionInput = {
  id: string;
  title: string;
  goal: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  /** Ordered step statuses (mission_steps when orchestrated, else run statuses). */
  steps: { status: string }[];
  cost_usd?: number | null;
  current_agent_id?: string | null;
};

export type DeskLaneId = "needsYou" | "working" | "awaiting" | "done" | "attention";

export type MissionProgress = {
  done: number;
  total: number;
  /** done/total as a 0–100 int, or null when there are no steps yet. */
  pct: number | null;
};

export type DeskMission = DeskMissionInput & {
  lane: DeskLaneId;
  progress: MissionProgress;
};

export type DeskLane = {
  id: DeskLaneId;
  label: string;
  blurb: string;
  missions: DeskMission[];
};

export type DelegateDesk = {
  /** All lanes in display order (urgent first); empty lanes included for a stable UI. */
  lanes: DeskLane[];
  counts: Record<DeskLaneId, number>;
  total: number;
  /** Plain-language headline, honest when empty. */
  summary: string;
};

// Lane display order — most-urgent first. "Needs you" leads because a paused gate
// is the one thing that stops the walk-away promise.
const LANE_ORDER: DeskLaneId[] = ["needsYou", "working", "awaiting", "done", "attention"];

const LANE_META: Record<DeskLaneId, { label: string; blurb: string }> = {
  needsYou: { label: "Needs you", blurb: "Paused at a gate — a decision unblocks the work." },
  working: { label: "Working", blurb: "Agents are on it. Walk away; come back to it done." },
  awaiting: { label: "Queued", blurb: "Handed off, waiting to start." },
  done: { label: "Done", blurb: "Finished. The full trail is kept." },
  attention: { label: "Needs a look", blurb: "Stopped early — failed or cancelled." },
};

// Status → lane. Normalized (lowercase, trimmed). Tolerant of the variants the
// codebase uses across the mission/run/reactor paths; an unknown status is
// treated as queued (handed off, state unclear) so it is never silently dropped.
const STATUS_TO_LANE: Readonly<Record<string, DeskLaneId>> = {
  // needs you — paused at a human gate
  paused: "needsYou",
  blocked: "needsYou",
  held: "needsYou",
  awaiting: "needsYou",
  awaiting_approval: "needsYou",
  awaiting_input: "needsYou",
  needs_input: "needsYou",
  needs_review: "needsYou",
  needs_you: "needsYou",
  // working — agents actively running
  running: "working",
  in_progress: "working",
  dispatched: "working",
  processing: "working",
  executing: "working",
  active: "working",
  // queued — handed off, not started
  queued: "awaiting",
  pending: "awaiting",
  proposed: "awaiting",
  draft: "awaiting",
  scheduled: "awaiting",
  // done — finished successfully
  completed: "done",
  done: "done",
  succeeded: "done",
  success: "done",
  shipped: "done",
  // attention — stopped early
  error: "attention",
  failed: "attention",
  cancelled: "attention",
  canceled: "attention",
  denied: "attention",
  aborted: "attention",
  timed_out: "attention",
};

const DEFAULT_LANE: DeskLaneId = "awaiting";

/** PURE — the lane a mission status belongs to. Unknown → queued (never dropped). */
export function laneForStatus(status: string): DeskLaneId {
  const key = (status ?? "").trim().toLowerCase();
  return STATUS_TO_LANE[key] ?? DEFAULT_LANE;
}

const STEP_DONE = new Set(["executed", "completed", "done", "ok", "success", "succeeded", "skipped"]);

/** PURE — progress from the step strip: how many steps have reached a terminal-done state. */
export function missionProgress(steps: { status: string }[]): MissionProgress {
  const list = Array.isArray(steps) ? steps : [];
  const total = list.length;
  const done = list.filter((s) => STEP_DONE.has((s?.status ?? "").trim().toLowerCase())).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : null };
}

function emptyCounts(): Record<DeskLaneId, number> {
  return { needsYou: 0, working: 0, awaiting: 0, done: 0, attention: 0 };
}

/**
 * PURE — compose the delegate desk from mission rows. Missions are partitioned
 * into lanes and, within a lane, ordered most-recently-updated first. Empty/no
 * data is honest, never fabricated.
 */
export function computeDelegateDesk(missionsInput: readonly DeskMissionInput[]): DelegateDesk {
  const missions = (Array.isArray(missionsInput) ? missionsInput : []).filter(
    (m): m is DeskMissionInput => !!m && typeof m.id === "string",
  );
  const byLane = new Map<DeskLaneId, DeskMission[]>();
  const counts = emptyCounts();
  for (const m of missions) {
    const lane = laneForStatus(m.status);
    const entry: DeskMission = { ...m, lane, progress: missionProgress(m.steps) };
    const arr = byLane.get(lane) ?? [];
    arr.push(entry);
    byLane.set(lane, arr);
    counts[lane] += 1;
  }
  const lanes: DeskLane[] = LANE_ORDER.map((id) => {
    const arr = (byLane.get(id) ?? []).sort((a, b) =>
      (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
    );
    return { id, label: LANE_META[id].label, blurb: LANE_META[id].blurb, missions: arr };
  });
  return { lanes, counts, total: missions.length, summary: summarizeDesk(counts, missions.length) };
}

/** PURE — one honest headline. Mentions only non-empty lanes, urgent first. */
export function summarizeDesk(counts: Record<DeskLaneId, number>, total: number): string {
  if (total === 0) {
    return "Nothing delegated yet. Hand a task to your agents and it shows up here.";
  }
  const parts: string[] = [];
  if (counts.needsYou > 0) parts.push(`${counts.needsYou} needs you`);
  if (counts.working > 0) parts.push(`${counts.working} working`);
  if (counts.awaiting > 0) parts.push(`${counts.awaiting} queued`);
  if (counts.done > 0) parts.push(`${counts.done} done`);
  if (counts.attention > 0) parts.push(`${counts.attention} need${counts.attention === 1 ? "s" : ""} a look`);
  return parts.join(" · ") + ".";
}
