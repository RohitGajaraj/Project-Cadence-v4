import { describe, it, expect } from "bun:test";
import {
  assessMission,
  assessMissions,
  isTerminalStatus,
  summarizeRunaway,
  buildMissionStats,
  DEFAULT_RUNAWAY_CONFIG,
  type MissionRunStats,
} from "./runaway";

const base: MissionRunStats = {
  missionId: "m1",
  status: "running",
  hopCount: 1,
  stepCount: 3,
  totalAttempts: 3,
  maxStepAttempts: 1,
  spendUsd: 0.2,
  ageMinutes: 10,
};
const m = (over: Partial<MissionRunStats>): MissionRunStats => ({ ...base, ...over });

describe("isTerminalStatus", () => {
  it("recognizes terminal vs active statuses", () => {
    expect(isTerminalStatus("done")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("running")).toBe(false);
    expect(isTerminalStatus("pending")).toBe(false);
    // unknown -> not terminal -> treated as active (fail-loud toward visibility)
    expect(isTerminalStatus("weird_new_status")).toBe(false);
  });
});

describe("assessMission", () => {
  it("passes a healthy mission (severity none, no reasons)", () => {
    const v = assessMission(base);
    expect(v.isRunaway).toBe(false);
    expect(v.severity).toBe("none");
    expect(v.reasons).toEqual([]);
  });

  it("flags excessive hops", () => {
    const v = assessMission(m({ hopCount: 21 }));
    expect(v.isRunaway).toBe(true);
    expect(v.severity).toBe("runaway");
    expect(v.reasons.join()).toContain("21 hops");
  });

  it("flags excessive steps at the MISSION_BATCH ceiling", () => {
    expect(assessMission(m({ stepCount: 50 })).isRunaway).toBe(false); // exactly at cap is ok
    const v = assessMission(m({ stepCount: 51 }));
    expect(v.isRunaway).toBe(true);
    expect(v.reasons.join()).toContain("51 steps");
  });

  it("flags retry thrashing (excess retries over the step count)", () => {
    // 4 steps, 9 attempts -> 5 excess / 4 = 1.25 > 1 -> thrash
    const v = assessMission(m({ stepCount: 4, totalAttempts: 9, maxStepAttempts: 2 }));
    expect(v.isRunaway).toBe(true);
    expect(v.reasons.join()).toContain("5 retries across 4 steps");
  });

  it("does NOT divide-by-zero on a zero-step mission", () => {
    const v = assessMission(m({ stepCount: 0, totalAttempts: 0, maxStepAttempts: 0 }));
    expect(v.severity).toBe("none");
    expect(v.reasons).toEqual([]);
  });

  it("flags a single step pinned at its retry ceiling", () => {
    const v = assessMission(m({ maxStepAttempts: 3 }));
    expect(v.isRunaway).toBe(true);
    expect(v.reasons.join()).toContain("retried 3 times");
  });

  it("flags a spend blowout with rounded dollars", () => {
    const v = assessMission(m({ spendUsd: 7.129 }));
    expect(v.isRunaway).toBe(true);
    expect(v.reasons.join()).toContain("$7.13 spent (over $5)");
  });

  it("downgrades a breached-but-terminal mission to watch (post-hoc, not live)", () => {
    const v = assessMission(m({ status: "done", hopCount: 99 }));
    expect(v.isRunaway).toBe(true);
    expect(v.severity).toBe("watch");
  });

  it("keeps an unknown status active (runaway, not watch)", () => {
    const v = assessMission(m({ status: "brand_new", hopCount: 99 }));
    expect(v.severity).toBe("runaway");
  });

  it("accumulates multiple reasons", () => {
    const v = assessMission(m({ hopCount: 25, stepCount: 60, spendUsd: 6 }));
    expect(v.reasons.length).toBe(3);
  });

  it("respects a custom config", () => {
    const v = assessMission(m({ hopCount: 5 }), { ...DEFAULT_RUNAWAY_CONFIG, maxHops: 4 });
    expect(v.isRunaway).toBe(true);
  });
});

describe("assessMissions (batch, sorted, filtered)", () => {
  it("returns only tripped missions, runaway before watch", () => {
    const out = assessMissions([
      m({ missionId: "healthy" }),
      m({ missionId: "terminal-blown", status: "done", hopCount: 99 }),
      m({ missionId: "live-blown", status: "running", stepCount: 99 }),
    ]);
    expect(out.map((v) => v.missionId)).toEqual(["live-blown", "terminal-blown"]);
    expect(out[0].severity).toBe("runaway");
    expect(out[1].severity).toBe("watch");
  });

  it("returns an empty array when everything is healthy", () => {
    expect(assessMissions([m({}), m({ missionId: "m2" })])).toEqual([]);
  });
});

describe("buildMissionStats (shared pure fold)", () => {
  const NOW = Date.parse("2026-06-21T01:00:00.000Z");
  const tenMinAgo = "2026-06-21T00:50:00.000Z";

  it("folds steps (count/total/max attempts) and spend per mission", () => {
    const stats = buildMissionStats(
      [{ id: "m1", status: "running", hop_count: 3, created_at: tenMinAgo }],
      [
        { mission_id: "m1", attempts: 1 },
        { mission_id: "m1", attempts: 4 },
      ],
      [
        { mission_id: "m1", spend_used_usd: 0.5 },
        { mission_id: "m1", spend_used_usd: 1.25 },
      ],
      NOW,
    );
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      missionId: "m1",
      status: "running",
      hopCount: 3,
      stepCount: 2,
      totalAttempts: 5,
      maxStepAttempts: 4,
      spendUsd: 1.75,
    });
    expect(stats[0].ageMinutes).toBeCloseTo(10, 5);
  });

  it("gives a mission with no children zeroed aggregates", () => {
    const stats = buildMissionStats(
      [{ id: "m2", status: "pending", hop_count: null, created_at: tenMinAgo }],
      [],
      [],
      NOW,
    );
    expect(stats[0]).toMatchObject({
      hopCount: 0,
      stepCount: 0,
      totalAttempts: 0,
      maxStepAttempts: 0,
      spendUsd: 0,
    });
  });

  it("ignores run rows with a null mission_id and never mixes missions", () => {
    const stats = buildMissionStats(
      [
        { id: "a", status: "running", hop_count: 0, created_at: tenMinAgo },
        { id: "b", status: "running", hop_count: 0, created_at: tenMinAgo },
      ],
      [{ mission_id: "a", attempts: 0 }],
      [
        { mission_id: null, spend_used_usd: 99 },
        { mission_id: "b", spend_used_usd: 2 },
      ],
      NOW,
    );
    const a = stats.find((s) => s.missionId === "a")!;
    const b = stats.find((s) => s.missionId === "b")!;
    expect(a.spendUsd).toBe(0);
    expect(a.stepCount).toBe(1);
    expect(b.spendUsd).toBe(2);
    expect(b.stepCount).toBe(0);
  });

  it("degrades a bad created_at to ageMinutes 0 (no NaN)", () => {
    const stats = buildMissionStats(
      [{ id: "m", status: "running", hop_count: 0, created_at: "not-a-date" }],
      [],
      [],
      NOW,
    );
    expect(stats[0].ageMinutes).toBe(0);
  });
});

describe("summarizeRunaway", () => {
  it("returns an empty string when nothing tripped", () => {
    expect(summarizeRunaway([])).toBe("");
  });

  it("counts spinning and review-worthy missions with correct grammar", () => {
    const out = assessMissions([
      m({ missionId: "a", status: "running", hopCount: 99 }),
      m({ missionId: "b", status: "running", stepCount: 99 }),
      m({ missionId: "c", status: "done", spendUsd: 50 }),
    ]);
    const line = summarizeRunaway(out);
    expect(line).toContain("2 missions are spinning");
    expect(line).toContain("1 to review");
  });

  it("uses singular grammar for a lone spinning mission", () => {
    const out = assessMissions([m({ status: "running", hopCount: 99 })]);
    expect(summarizeRunaway(out)).toBe("1 mission is spinning");
  });

  it("carries no em or en dashes (humanized-output Tier 2)", () => {
    const out = assessMissions([m({ status: "running", hopCount: 99 })]);
    expect(summarizeRunaway(out)).not.toMatch(/[—–]/);
    const v = assessMission(m({ hopCount: 99, spendUsd: 9 }));
    expect(v.reasons.join()).not.toMatch(/[—–]/);
  });
});
