import { describe, expect, it } from "bun:test";
import {
  evaluateTriggers,
  isAutoMissionTitle,
  shouldAutoPromote,
  AUTO_TITLE_PREFIX,
  AUTO_TRIGGER_DAILY_CAP,
  CLUSTER_FREQUENCY_THRESHOLD,
  WATCH_SIGNAL_THRESHOLD,
  LISTEN_SIGNAL_THRESHOLD,
  type ThemeState,
  type OutcomeState,
  type SignalSenseState,
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
    const themes = Array.from({ length: 10 }, (_, i) =>
      theme({ id: `t${i}`, title: `Cluster ${i}` }),
    );
    const out = evaluateTriggers({ themes, outcomes: [outcome({})] }, new Set(), { max: 3 });
    expect(out).toHaveLength(3);
    expect(out[0].kind).toBe("missed-outcome"); // priority 50 beats cluster freq+sev
  });

  it("never throws on malformed input", () => {
    expect(
      evaluateTriggers({ themes: [null as unknown as ThemeState], outcomes: undefined }),
    ).toEqual([]);
  });
});

describe("isAutoMissionTitle", () => {
  it("recognizes only auto-originated titles", () => {
    expect(isAutoMissionTitle(`${AUTO_TITLE_PREFIX} Investigate the "X" cluster`)).toBe(true);
    expect(isAutoMissionTitle("Ship the escalation engine")).toBe(false);
    expect(isAutoMissionTitle(null)).toBe(false);
  });
});

describe("evaluateTriggers — Watch (discovery-scout) proposals", () => {
  const senseOver = (over: Partial<SignalSenseState> = {}): SignalSenseState => ({
    newSignalCount: WATCH_SIGNAL_THRESHOLD,
    customerSignalCount: 0,
    ...over,
  });

  it("proposes a Watch mission when new signals cross the threshold", () => {
    const out = evaluateTriggers({ signals: senseOver() });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("watch-scan");
    expect(out[0].agentSlug).toBe("discovery-scout");
    expect(out[0].title.startsWith(AUTO_TITLE_PREFIX)).toBe(true);
    expect(out[0].reversible).toBe(true);
  });

  it("does not propose Watch when signal count is below threshold", () => {
    const out = evaluateTriggers({
      signals: senseOver({ newSignalCount: WATCH_SIGNAL_THRESHOLD - 1 }),
    });
    expect(out).toHaveLength(0);
  });

  it("deduplicates Watch: no second proposal when one is already open", () => {
    const first = evaluateTriggers({ signals: senseOver() })[0];
    const again = evaluateTriggers({ signals: senseOver() }, new Set([first.title]));
    expect(again).toHaveLength(0);
  });
});

describe("evaluateTriggers — Listen (customer-insights) proposals", () => {
  const listenState = (over: Partial<SignalSenseState> = {}): SignalSenseState => ({
    newSignalCount: 0,
    customerSignalCount: LISTEN_SIGNAL_THRESHOLD,
    ...over,
  });

  it("proposes a Listen mission when customer signals cross the threshold", () => {
    const out = evaluateTriggers({ signals: listenState() });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("customer-listen");
    expect(out[0].agentSlug).toBe("customer-insights");
    expect(out[0].reversible).toBe(true);
  });

  it("does not propose Listen below the threshold", () => {
    const out = evaluateTriggers({
      signals: listenState({ customerSignalCount: LISTEN_SIGNAL_THRESHOLD - 1 }),
    });
    expect(out).toHaveLength(0);
  });

  it("both Watch and Listen can be proposed in the same tick", () => {
    const out = evaluateTriggers({
      signals: {
        newSignalCount: WATCH_SIGNAL_THRESHOLD,
        customerSignalCount: LISTEN_SIGNAL_THRESHOLD,
      },
    });
    const kinds = out.map((p) => p.kind);
    expect(kinds).toContain("watch-scan");
    expect(kinds).toContain("customer-listen");
  });

  it("missed outcome outranks Watch and Listen proposals", () => {
    const outcome: OutcomeState = { id: "o1", verdict: "missed", summary: "Feature flopped" };
    const out = evaluateTriggers({
      outcomes: [outcome],
      signals: {
        newSignalCount: WATCH_SIGNAL_THRESHOLD,
        customerSignalCount: LISTEN_SIGNAL_THRESHOLD,
      },
    });
    expect(out[0].kind).toBe("missed-outcome");
  });
});

describe("shouldAutoPromote — SF-AUTOTRIGGER eligibility", () => {
  const base = {
    flagEnabled: true,
    reversible: true,
    ambientCount: 0,
    autoTodayCount: 0,
  };

  it("promotes when all four conditions are met", () => {
    expect(shouldAutoPromote(base)).toBe(true);
  });

  it("blocks when BRAIN_AUTO_TRIGGER flag is off", () => {
    expect(shouldAutoPromote({ ...base, flagEnabled: false })).toBe(false);
  });

  it("blocks when the proposal is not reversible", () => {
    expect(shouldAutoPromote({ ...base, reversible: false })).toBe(false);
  });

  it("blocks when there are active (running) missions — not ambient arc", () => {
    expect(shouldAutoPromote({ ...base, ambientCount: 1 })).toBe(false);
    expect(shouldAutoPromote({ ...base, ambientCount: 3 })).toBe(false);
  });

  it("blocks when the daily cap is already reached", () => {
    expect(shouldAutoPromote({ ...base, autoTodayCount: AUTO_TRIGGER_DAILY_CAP })).toBe(false);
    expect(shouldAutoPromote({ ...base, autoTodayCount: AUTO_TRIGGER_DAILY_CAP + 1 })).toBe(false);
  });

  it("allows the last slot (cap - 1) but not beyond", () => {
    expect(shouldAutoPromote({ ...base, autoTodayCount: AUTO_TRIGGER_DAILY_CAP - 1 })).toBe(true);
    expect(shouldAutoPromote({ ...base, autoTodayCount: AUTO_TRIGGER_DAILY_CAP })).toBe(false);
  });

  it("requires ALL four conditions — any single failure blocks", () => {
    // flag off alone blocks
    expect(shouldAutoPromote({ ...base, flagEnabled: false })).toBe(false);
    // not reversible alone blocks
    expect(shouldAutoPromote({ ...base, reversible: false })).toBe(false);
    // active mission alone blocks
    expect(shouldAutoPromote({ ...base, ambientCount: 1 })).toBe(false);
    // cap hit alone blocks
    expect(shouldAutoPromote({ ...base, autoTodayCount: AUTO_TRIGGER_DAILY_CAP })).toBe(false);
  });
});
