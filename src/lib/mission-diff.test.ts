import { describe, it, expect } from "bun:test";
import { deriveMissionSide, alignHops, diffMissions } from "./mission-diff";
import type { MissionDetail } from "./missions.functions";

type Hop = MissionDetail["hops"][number];
type ToolCall = Hop["tool_calls"][number];

function tc(opts: Partial<ToolCall> = {}): ToolCall {
  return {
    id: opts.id ?? "tc",
    tool_name: opts.tool_name ?? "web.search",
    ok: opts.ok ?? true,
    error: opts.error ?? null,
    latency_ms: opts.latency_ms ?? 10,
    created_at: opts.created_at ?? "2026-06-01T00:00:00.000Z",
    is_unattended: opts.is_unattended ?? false,
  };
}

function hop(opts: Partial<Hop> = {}): Hop {
  return {
    run_id: opts.run_id ?? "r",
    agent_slug: opts.agent_slug ?? "scout",
    agent_name: opts.agent_name ?? "Scout",
    status: opts.status ?? "completed",
    input: opts.input ?? "in",
    // Preserve an explicit `output: null` (?? would coerce it to "out").
    output: "output" in opts ? (opts.output ?? null) : "out",
    created_at: opts.created_at ?? "2026-06-01T00:00:00.000Z",
    last_checkpoint_at: opts.last_checkpoint_at ?? null,
    trace_id: opts.trace_id ?? "t",
    step_index: opts.step_index ?? 0,
    steps: opts.steps ?? [],
    tool_calls: opts.tool_calls ?? [],
    recalled_memories: opts.recalled_memories ?? [],
  };
}

function mission(opts: {
  id?: string;
  title?: string;
  status?: string;
  created_at?: string;
  completed_at?: string | null;
  cost?: number;
  tin?: number;
  tout?: number;
  hops?: Hop[];
}): MissionDetail {
  return {
    mission: {
      id: opts.id ?? "m1",
      title: opts.title ?? "Mission",
      goal: "goal",
      status: opts.status ?? "completed",
      current_agent_id: null,
      hop_count: (opts.hops ?? []).length,
      created_at: opts.created_at ?? "2026-06-01T00:00:00.000Z",
      updated_at: opts.created_at ?? "2026-06-01T00:00:00.000Z",
      completed_at: opts.completed_at ?? null,
      replayed_from_mission_id: null,
    },
    usage: {
      cost_usd: opts.cost ?? 0,
      tokens_in: opts.tin ?? 0,
      tokens_out: opts.tout ?? 0,
      trace_id: "t",
    },
    hops: opts.hops ?? [],
    messages: [],
  };
}

describe("deriveMissionSide", () => {
  it("rolls up hops, tool calls, duration, agents, and final output", () => {
    const d = mission({
      id: "orig",
      created_at: "2026-06-01T00:00:00.000Z",
      completed_at: "2026-06-01T00:02:00.000Z", // 2 min = 120000ms
      cost: 0.05,
      tin: 1000,
      tout: 500,
      hops: [
        hop({ agent_slug: "scout", output: "first", tool_calls: [tc(), tc({ ok: false })] }),
        hop({
          agent_slug: "builder",
          output: "final answer",
          tool_calls: [tc({ is_unattended: true })],
        }),
      ],
    });
    const s = deriveMissionSide(d);
    expect(s.missionId).toBe("orig");
    expect(s.hopCount).toBe(2);
    expect(s.toolCalls).toBe(3);
    expect(s.toolCallsFailed).toBe(1);
    expect(s.toolCallsUnattended).toBe(1);
    expect(s.durationMs).toBe(120000);
    expect(s.agents).toEqual(["scout", "builder"]);
    expect(s.finalOutput).toBe("final answer");
    expect(s.costUsd).toBe(0.05);
  });

  it("durationMs is null when not completed", () => {
    const s = deriveMissionSide(mission({ status: "running", completed_at: null }));
    expect(s.durationMs).toBeNull();
  });

  it("finalOutput picks the last hop that HAS output (skips trailing empty)", () => {
    const s = deriveMissionSide(
      mission({
        hops: [hop({ output: "real" }), hop({ output: "   " }), hop({ output: null })],
      }),
    );
    expect(s.finalOutput).toBe("real");
  });

  it("is totally defined on empty / malformed input", () => {
    // @ts-expect-error deliberately malformed
    expect(() => deriveMissionSide({})).not.toThrow();
    // @ts-expect-error deliberately malformed
    const s = deriveMissionSide({});
    expect(s.hopCount).toBe(0);
    expect(s.toolCalls).toBe(0);
    expect(s.durationMs).toBeNull();
    expect(s.agents).toEqual([]);
  });

  it("coerces non-finite usage to 0", () => {
    const d = mission({ cost: NaN as unknown as number });
    expect(deriveMissionSide(d).costUsd).toBe(0);
  });
});

describe("alignHops", () => {
  it("aligns by position, flags same-agent and output drift", () => {
    const orig = mission({
      hops: [
        hop({ agent_slug: "scout", output: "A" }),
        hop({ agent_slug: "builder", output: "B" }),
      ],
    });
    const rep = mission({
      hops: [
        hop({ agent_slug: "scout", output: "A2" }), // same agent, output changed
        hop({ agent_slug: "builder", output: "B" }), // same agent, output identical
      ],
    });
    const rows = alignHops(orig, rep);
    expect(rows).toHaveLength(2);
    expect(rows[0].presence).toBe("both");
    expect(rows[0].sameAgent).toBe(true);
    expect(rows[0].outputChanged).toBe(true);
    expect(rows[1].outputChanged).toBe(false);
  });

  it("marks original-only and replay-only when hop counts differ", () => {
    const orig = mission({ hops: [hop({ agent_slug: "scout" }), hop({ agent_slug: "builder" })] });
    const rep = mission({ hops: [hop({ agent_slug: "scout" })] });
    const rows = alignHops(orig, rep);
    expect(rows.map((r) => r.presence)).toEqual(["both", "original-only"]);
    expect(rows[1].replayStatus).toBeNull();
  });

  it("does not flag outputChanged when one side is missing output", () => {
    const orig = mission({ hops: [hop({ output: "A" })] });
    const rep = mission({ hops: [hop({ output: null })] });
    expect(alignHops(orig, rep)[0].outputChanged).toBe(false);
  });
});

describe("diffMissions", () => {
  it("computes deltas as replay - original (negative = cheaper/faster replay)", () => {
    const orig = mission({
      id: "orig",
      created_at: "2026-06-01T00:00:00.000Z",
      completed_at: "2026-06-01T00:04:00.000Z", // 240000ms
      cost: 0.1,
      tin: 2000,
      tout: 800,
      hops: [hop({ tool_calls: [tc(), tc({ ok: false })] })],
    });
    const rep = mission({
      id: "rep",
      created_at: "2026-06-02T00:00:00.000Z",
      completed_at: "2026-06-02T00:01:00.000Z", // 60000ms
      cost: 0.03,
      tin: 1500,
      tout: 600,
      hops: [hop({ tool_calls: [tc()] })],
    });
    const diff = diffMissions(orig, rep);
    expect(diff.deltas.costUsd).toBeCloseTo(-0.07, 5);
    expect(diff.deltas.tokensIn).toBe(-500);
    expect(diff.deltas.tokensOut).toBe(-200);
    expect(diff.deltas.toolCalls).toBe(-1);
    expect(diff.deltas.toolCallsFailed).toBe(-1);
    expect(diff.deltas.durationMs).toBe(-180000);
  });

  it("durationMs delta is null when either side is unfinished", () => {
    const orig = mission({ completed_at: "2026-06-01T00:02:00.000Z" });
    const rep = mission({ status: "running", completed_at: null });
    expect(diffMissions(orig, rep).deltas.durationMs).toBeNull();
  });

  it("flags finalOutputChanged only when both finals exist and differ", () => {
    const a = mission({ hops: [hop({ output: "answer one" })] });
    const b = mission({ hops: [hop({ output: "answer two" })] });
    expect(diffMissions(a, b).finalOutputChanged).toBe(true);

    const c = mission({ hops: [hop({ output: "same" })] });
    const d = mission({ hops: [hop({ output: "same" })] });
    expect(diffMissions(c, d).finalOutputChanged).toBe(false);

    const e = mission({ hops: [hop({ output: null })] });
    expect(diffMissions(a, e).finalOutputChanged).toBe(false);
  });
});
