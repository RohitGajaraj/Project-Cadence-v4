import { describe, it, expect } from "bun:test";
import {
  classifyMissionGate,
  needsEscalationResolve,
  ACTIVE_RUN_STATUSES,
  type MissionGateInput,
  type ApprovalEscalationInput,
} from "./gate-state";

const mission = (over: Partial<MissionGateInput>): MissionGateInput => ({
  status: "running",
  runStatuses: ["waiting_approval"],
  pendingGateCount: 1,
  ...over,
});

const appr = (over: Partial<ApprovalEscalationInput>): ApprovalEscalationInput => ({
  status: "pending",
  escalationState: "pending",
  decidedAt: null,
  ...over,
});

describe("classifyMissionGate — block", () => {
  it("blocks a running mission whose only run waits on a genuinely-pending gate", () => {
    expect(classifyMissionGate(mission({}))).toBe("block");
  });

  it("blocks an in_progress mission too (status synonym)", () => {
    expect(classifyMissionGate(mission({ status: "in_progress" }))).toBe("block");
  });

  it("normalizes status casing/whitespace", () => {
    expect(classifyMissionGate(mission({ status: "  Running " }))).toBe("block");
  });

  it("does NOT block when another run is still actively progressing (fan-out)", () => {
    // one run waits on a gate, a sibling is still running -> mission is still working
    expect(
      classifyMissionGate(mission({ runStatuses: ["waiting_approval", "running"] })),
    ).toBe("none");
  });

  it("does NOT block when the gate is not genuinely pending (count 0)", () => {
    expect(classifyMissionGate(mission({ pendingGateCount: 0 }))).toBe("none");
  });

  it("does NOT block when there is no waiting_approval run", () => {
    expect(classifyMissionGate(mission({ runStatuses: ["running"] }))).toBe("none");
  });

  it("does NOT block a mission with zero runs (KI-17 unplanned case is not a gate block)", () => {
    expect(classifyMissionGate(mission({ runStatuses: [], pendingGateCount: 0 }))).toBe("none");
  });

  it("treats every active synonym as 'progressing' (no false block)", () => {
    for (const s of ACTIVE_RUN_STATUSES) {
      expect(
        classifyMissionGate(mission({ runStatuses: ["waiting_approval", s] })),
      ).toBe("none");
    }
  });
});

describe("classifyMissionGate — unblock", () => {
  it("unblocks a blocked mission once no gate is pending (operator decided)", () => {
    expect(
      classifyMissionGate(mission({ status: "blocked", pendingGateCount: 0 })),
    ).toBe("unblock");
  });

  it("unblocks a blocked mission whose runs are now all terminal", () => {
    expect(
      classifyMissionGate(
        mission({ status: "blocked", runStatuses: ["completed"], pendingGateCount: 0 }),
      ),
    ).toBe("unblock");
  });

  it("unblocks a blocked mission whose gate was decided but run not yet resumed", () => {
    // run still waiting_approval but no pending gate left -> resume path needs running
    expect(
      classifyMissionGate(
        mission({ status: "blocked", runStatuses: ["waiting_approval"], pendingGateCount: 0 }),
      ),
    ).toBe("unblock");
  });

  it("keeps a blocked mission blocked while a gate is still pending (none)", () => {
    expect(
      classifyMissionGate(mission({ status: "blocked", pendingGateCount: 1 })),
    ).toBe("none");
  });
});

describe("classifyMissionGate — terminal/none", () => {
  it("never touches a terminal mission", () => {
    for (const status of ["completed", "halted", "cancelled", "failed", "proposed"]) {
      expect(classifyMissionGate(mission({ status }))).toBe("none");
    }
  });

  it("is total — tolerates empty/garbage status without throwing", () => {
    expect(classifyMissionGate(mission({ status: "" }))).toBe("none");
    expect(classifyMissionGate(mission({ status: "wat", runStatuses: [] }))).toBe("none");
  });
});

describe("needsEscalationResolve", () => {
  it("resolves a failed+decided approval still flagged pending (the live studio.stage bug)", () => {
    expect(
      needsEscalationResolve(appr({ status: "failed", decidedAt: "2026-06-27T13:17:50Z" })),
    ).toBe(true);
  });

  it("resolves a decided approval regardless of which terminal status", () => {
    for (const status of ["executed", "denied", "cancelled", "approved", "resolved"]) {
      expect(needsEscalationResolve(appr({ status }))).toBe(true);
    }
  });

  it("resolves when decided_at is set even if status string is unusual", () => {
    expect(needsEscalationResolve(appr({ status: "weird", decidedAt: "2026-06-27T00:00:00Z" }))).toBe(
      true,
    );
  });

  it("does NOT resolve a genuinely pending approval", () => {
    expect(needsEscalationResolve(appr({ status: "pending", decidedAt: null }))).toBe(false);
  });

  it("does NOT touch a consistently auto-expired approval (status+state both expired, undecided)", () => {
    expect(
      needsEscalationResolve(appr({ status: "expired", escalationState: "expired", decidedAt: null })),
    ).toBe(false);
  });

  it("does NOT re-resolve an already-resolved escalation_state", () => {
    expect(
      needsEscalationResolve(appr({ status: "executed", escalationState: "resolved" })),
    ).toBe(false);
  });

  it("is total — tolerates empty strings", () => {
    expect(needsEscalationResolve(appr({ status: "", escalationState: "" }))).toBe(false);
  });
});
