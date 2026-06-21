// D4b — the pure core of the side-by-side mission checkpoint-diff.
//
// D4 shipped cancel + replay-and-branch: a finished mission can be re-run as a new
// mission (optionally with a different model) that carries a `replayed_from_mission_id`
// link back to the original. This module closes the loop: given the two missions'
// `MissionDetail` snapshots, it computes a structured, deterministic diff so the
// operator can SEE what the replay changed — hop count, cost, tokens, tool-call
// outcomes, duration, and per-hop output drift.
//
// SERVER-FREE on purpose (bun:test unit-testable in isolation). No DB / AI / dates
// beyond arithmetic on the timestamps the snapshots already carry. Totally defined:
// any field may be missing and the diff still computes (never throws).

import type { MissionDetail } from "./missions.functions";

/** One mission's comparable rollup (computed from its `MissionDetail`). */
export type MissionDiffSide = {
  missionId: string;
  title: string;
  status: string;
  /** Number of hops (agent runs) executed. */
  hopCount: number;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  /** Total tool calls across all hops. */
  toolCalls: number;
  /** Tool calls that errored (`ok === false`). */
  toolCallsFailed: number;
  /** Side-effecting tool calls that ran with no human gate (the unattended-delegation count). */
  toolCallsUnattended: number;
  /** completed_at - created_at in ms; null while not yet completed. */
  durationMs: number | null;
  /** Distinct agent slugs in hop order (the specialist chain). */
  agents: string[];
  /** The last hop's output (the mission's effective answer); null if none. */
  finalOutput: string | null;
};

/** How a hop index lines up between the two missions. */
export type HopPresence = "both" | "original-only" | "replay-only";

/** A single aligned hop row (by position) across the two missions. */
export type MissionDiffHop = {
  index: number;
  presence: HopPresence;
  /** The agent slug at this position (original's, else the replay's). */
  agentSlug: string | null;
  /** True when both sides ran the same agent slug at this position. */
  sameAgent: boolean;
  originalStatus: string | null;
  replayStatus: string | null;
  originalOutput: string | null;
  replayOutput: string | null;
  /** True when both outputs are present and differ (after trim); a real content drift. */
  outputChanged: boolean;
};

/** Numeric deltas, always replay minus original. `durationMs` is null if either side is unfinished. */
export type MissionDiffDeltas = {
  hopCount: number;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  toolCalls: number;
  toolCallsFailed: number;
  durationMs: number | null;
};

export type MissionDiff = {
  original: MissionDiffSide;
  replay: MissionDiffSide;
  deltas: MissionDiffDeltas;
  hops: MissionDiffHop[];
  /** True when the two final outputs both exist and differ (the headline "the answer changed"). */
  finalOutputChanged: boolean;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Trim + collapse a possibly-null output for an honest equality test; "" reads as null. */
function normOutput(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length ? t : null;
}

/** Distinct values preserving first-seen order. */
function distinctInOrder(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v === "string" && v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** PURE. Roll one `MissionDetail` into its comparable side. Tolerant of partial input. */
export function deriveMissionSide(d: MissionDetail): MissionDiffSide {
  const mission = d?.mission ?? ({} as MissionDetail["mission"]);
  const usage = d?.usage ?? ({} as MissionDetail["usage"]);
  const hops = Array.isArray(d?.hops) ? d.hops : [];

  let toolCalls = 0;
  let toolCallsFailed = 0;
  let toolCallsUnattended = 0;
  for (const h of hops) {
    const tcs = Array.isArray(h?.tool_calls) ? h.tool_calls : [];
    for (const tc of tcs) {
      toolCalls++;
      if (tc?.ok === false) toolCallsFailed++;
      if (tc?.is_unattended === true) toolCallsUnattended++;
    }
  }

  const created = mission.created_at ? Date.parse(mission.created_at) : NaN;
  const completed = mission.completed_at ? Date.parse(mission.completed_at) : NaN;
  const durationMs =
    Number.isFinite(created) && Number.isFinite(completed) && completed >= created
      ? completed - created
      : null;

  const lastWithOutput = [...hops].reverse().find((h) => normOutput(h?.output) !== null);

  return {
    missionId: mission.id ?? "",
    title: mission.title ?? "",
    status: mission.status ?? "",
    hopCount: hops.length,
    costUsd: num(usage.cost_usd),
    tokensIn: num(usage.tokens_in),
    tokensOut: num(usage.tokens_out),
    toolCalls,
    toolCallsFailed,
    toolCallsUnattended,
    durationMs,
    agents: distinctInOrder(hops.map((h) => h?.agent_slug)),
    finalOutput: lastWithOutput ? normOutput(lastWithOutput.output) : null,
  };
}

/** PURE. Align hops by position across the two missions. */
export function alignHops(original: MissionDetail, replay: MissionDetail): MissionDiffHop[] {
  const oh = Array.isArray(original?.hops) ? original.hops : [];
  const rh = Array.isArray(replay?.hops) ? replay.hops : [];
  const n = Math.max(oh.length, rh.length);
  const rows: MissionDiffHop[] = [];
  for (let i = 0; i < n; i++) {
    const o = oh[i];
    const r = rh[i];
    const presence: HopPresence = o && r ? "both" : o ? "original-only" : "replay-only";
    const oOut = o ? normOutput(o.output) : null;
    const rOut = r ? normOutput(r.output) : null;
    rows.push({
      index: i,
      presence,
      agentSlug: o?.agent_slug ?? r?.agent_slug ?? null,
      sameAgent: !!o && !!r && o.agent_slug === r.agent_slug,
      originalStatus: o?.status ?? null,
      replayStatus: r?.status ?? null,
      originalOutput: oOut,
      replayOutput: rOut,
      outputChanged: oOut !== null && rOut !== null && oOut !== rOut,
    });
  }
  return rows;
}

/**
 * PURE. The full side-by-side diff. Deltas are always `replay - original`, so a
 * negative cost delta means the replay was cheaper. `durationMs` delta is null
 * unless BOTH sides have completed (so a still-running replay never reports a
 * misleading time saving).
 */
export function diffMissions(original: MissionDetail, replay: MissionDetail): MissionDiff {
  const o = deriveMissionSide(original);
  const r = deriveMissionSide(replay);
  const durationDelta =
    o.durationMs !== null && r.durationMs !== null ? r.durationMs - o.durationMs : null;
  return {
    original: o,
    replay: r,
    deltas: {
      hopCount: r.hopCount - o.hopCount,
      costUsd: r.costUsd - o.costUsd,
      tokensIn: r.tokensIn - o.tokensIn,
      tokensOut: r.tokensOut - o.tokensOut,
      toolCalls: r.toolCalls - o.toolCalls,
      toolCallsFailed: r.toolCallsFailed - o.toolCallsFailed,
      durationMs: durationDelta,
    },
    hops: alignHops(original, replay),
    finalOutputChanged:
      o.finalOutput !== null && r.finalOutput !== null && o.finalOutput !== r.finalOutput,
  };
}
