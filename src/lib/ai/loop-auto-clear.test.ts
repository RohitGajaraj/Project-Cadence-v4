import { describe, it, expect } from "bun:test";
import { toolRisk } from "@/lib/tool-consequences";

// Verify the auto-clear logic's predicate: toolRisk('x') === 'low' for reversible + internal tools.
// These are the exact tools the loop will now auto-approve without queuing an approval.

describe("auto-clear reversible gate predicate", () => {
  it("tasks.create is low risk (reversible + internal)", () => {
    expect(toolRisk("tasks.create")).toBe("low");
  });

  it("prd.draft is low risk (reversible + internal)", () => {
    expect(toolRisk("prd.draft")).toBe("low");
  });

  it("notes.create is low risk (reversible + internal)", () => {
    expect(toolRisk("notes.create")).toBe("low");
  });

  it("memory.remember is low risk (reversible + internal)", () => {
    expect(toolRisk("memory.remember")).toBe("low");
  });

  it("signals.log is low risk (reversible + internal)", () => {
    expect(toolRisk("signals.log")).toBe("low");
  });

  it("backlog.prioritize is low risk (reversible + internal)", () => {
    expect(toolRisk("backlog.prioritize")).toBe("low");
  });

  it("mission.plan is low risk (reversible + internal)", () => {
    expect(toolRisk("mission.plan")).toBe("low");
  });

  it("tasks.update_status is low risk (reversible + internal)", () => {
    expect(toolRisk("tasks.update_status")).toBe("low");
  });

  // These must NEVER be auto-cleared — they're high risk
  it("studio.pr.merge is NOT low risk (irreversible)", () => {
    expect(toolRisk("studio.pr.merge")).not.toBe("low");
  });

  it("github.commit.append is NOT low risk (external + partial)", () => {
    expect(toolRisk("github.commit.append")).not.toBe("low");
  });

  it("delegate.openhands is NOT low risk (irreversible + external)", () => {
    expect(toolRisk("delegate.openhands")).not.toBe("low");
  });

  it("calendar.create is NOT low risk (external + reversible = medium)", () => {
    expect(toolRisk("calendar.create")).not.toBe("low");
  });

  it("unknown tool defaults to high (unknown blast radius = fail-closed)", () => {
    expect(toolRisk("unknown.tool.xyz")).toBe("high");
  });
});
