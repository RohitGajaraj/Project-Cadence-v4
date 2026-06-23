import { describe, expect, it } from "bun:test";
import {
  evaluateTriggers,
  isAutoMissionTitle,
  AUTO_TITLE_PREFIX,
  CLUSTER_FREQUENCY_THRESHOLD,
  type ThemeState,
  type OutcomeState,
} from "./trigger";

const theme = (over: Partial<ThemeState>): ThemeState => ({
  id: "t1",
  title: "Off-hours latency",
  frequency: 9,
  severity: 4,
  status: "new",
  ...over,
});

const outcome = (over: Partial<OutcomeState>): OutcomeState => ({
  id: "o1",
  verdict: "missed",
  summary: "Formal tone default lowered SMB reply rate",
  ...over,
});

describe("evaluateTriggers — clusters", () => {
  it("originates a mission for an unaddressed cluster over the threshold", () => {
    const out = evaluateTriggers({ themes: [theme({ frequency: CLUSTER_FREQUENCY_THRESHOLD })] });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("cluster");
    expect(out[0].title.startsWith(AUTO_TITLE_PREFIX)).toBe(true);
    expect(out[0].reversible).toBe(true);
  });

  it("ignores a cluster below both thresholds", () => {
    expect(evaluateTriggers({ themes: [theme({ frequency: 1, severity: 1 })] })).toHaveLength(0);
  });

  it("fires on high severity even when frequency is low", () => {
    expect(evaluateTriggers({ themes: [theme({ frequency: 0, severity: 5 })] })).toHaveLength(1);
  });

  it("ignores an already-addressed cluster", () => {
    expect(evaluateTriggers({ themes: [theme({ status: "addressed" })] })).toHaveLength(0);
    expect(evaluateTriggers({ themes: [theme({ status: "closed" })] })).toHaveLength(0);
  });
});

describe("evaluateTriggers — missed outcomes", () => {
  it("originates a re-evaluation mission for a missed outcome", () => {
    const out = evaluateTriggers({ outcomes: [outcome({})] });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("missed-outcome");
  });

  it("ignores validated/mixed outcomes", () => {
    expect(evaluateTriggers({ outcomes: [outcome({ verdict: "validated" })] })).toHaveLength(0);
    expect(evaluateTriggers({ outcomes: [outcome({ verdict: "mixed" })] })).toHaveLength(0);
  });
});

describe("evaluateTriggers — dedup + bounds", () => {
  it("drops a proposal whose mission title is already open (idempotent)", () => {
    const first = evaluateTriggers({ themes: [theme({})] })[0];
    const again = evaluateTriggers({ themes: [theme({})] }, new Set([first.title]));
    expect(again).toHaveLength(0);
  });

  it("a missed outcome outranks a cluster, and the count is capped", () => {
    const themes = Array.from({ length: 10 }, (_, i) => theme({ id: `t${i}`, title: `Cluster ${i}` }));
    const out = evaluateTriggers({ themes, outcomes: [outcome({})] }, new Set(), { max: 3 });
    expect(out).toHaveLength(3);
    expect(out[0].kind).toBe("missed-outcome"); // priority 50 beats cluster freq+sev
  });

  it("never throws on malformed input", () => {
    expect(evaluateTriggers({ themes: [null as unknown as ThemeState], outcomes: undefined })).toEqual([]);
  });
});

describe("isAutoMissionTitle", () => {
  it("recognizes only auto-originated titles", () => {
    expect(isAutoMissionTitle(`${AUTO_TITLE_PREFIX} Investigate the "X" cluster`)).toBe(true);
    expect(isAutoMissionTitle("Ship the escalation engine")).toBe(false);
    expect(isAutoMissionTitle(null)).toBe(false);
  });
});
