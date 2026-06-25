import { describe, it, expect } from "bun:test";
import {
  githubActionsProvider,
  resolveExecProvider,
  execGateFromChecks,
  resolveBuildPreview,
  RESERVED_PROVIDER_IDS,
  type CiCheckLite,
} from "./provider";

describe("githubActionsProvider.verdictFromChecks ($0 floor verdict)", () => {
  it("treats no CI as neutral and clears it (cannot gate on absent CI)", () => {
    const v = githubActionsProvider.verdictFromChecks([]);
    expect(v.provider).toBe("github-actions");
    expect(v.overall).toBe("neutral");
    expect(v.mayProceed).toBe(true);
  });

  it("clears a build whose checks are all green", () => {
    const checks: CiCheckLite[] = [{ status: "completed", conclusion: "success" }];
    const v = githubActionsProvider.verdictFromChecks(checks);
    expect(v.overall).toBe("success");
    expect(v.mayProceed).toBe(true);
  });

  it("blocks on any failing check", () => {
    const checks: CiCheckLite[] = [
      { status: "completed", conclusion: "success" },
      { status: "completed", conclusion: "failure" },
    ];
    const v = githubActionsProvider.verdictFromChecks(checks);
    expect(v.overall).toBe("failure");
    expect(v.mayProceed).toBe(false);
  });

  it("blocks while a check is still running", () => {
    const checks: CiCheckLite[] = [{ status: "in_progress", conclusion: null }];
    const v = githubActionsProvider.verdictFromChecks(checks);
    expect(v.overall).toBe("pending");
    expect(v.mayProceed).toBe(false);
  });
});

describe("resolveExecProvider (floor-default, never strands a build)", () => {
  it("defaults to the GitHub Actions floor with no preference", () => {
    expect(resolveExecProvider().id).toBe("github-actions");
    expect(resolveExecProvider(null).id).toBe("github-actions");
    expect(resolveExecProvider(undefined).id).toBe("github-actions");
  });

  it("honours an explicit, wired preference", () => {
    expect(resolveExecProvider("github-actions").id).toBe("github-actions");
  });

  it("falls back to the floor for a reserved-but-unwired paid backend", () => {
    for (const id of RESERVED_PROVIDER_IDS) {
      expect(resolveExecProvider(id).id).toBe("github-actions");
    }
  });

  it("falls back to the floor for an unknown id", () => {
    expect(resolveExecProvider("bogus").id).toBe("github-actions");
  });

  it("does not list the floor as a reserved (paid, unwired) backend", () => {
    expect(RESERVED_PROVIDER_IDS).not.toContain("github-actions");
  });
});

describe("provider.label (engine-room: name the place, not the mechanism id)", () => {
  it("gives the floor a human label distinct from its raw id", () => {
    expect(githubActionsProvider.label).toBe("GitHub Actions");
    expect(githubActionsProvider.label).not.toBe(githubActionsProvider.id);
  });
});

describe("execGateFromChecks (the point-of-decision merge gate, through the seam)", () => {
  it("clears a green build and names where it ran", () => {
    const checks: CiCheckLite[] = [{ status: "completed", conclusion: "success" }];
    const gate = execGateFromChecks(checks);
    expect(gate.provider).toBe("github-actions");
    expect(gate.providerLabel).toBe("GitHub Actions");
    expect(gate.mayProceed).toBe(true);
    expect(gate.reason).toMatch(/green/i);
  });

  it("blocks a red build with an actionable reason", () => {
    const checks: CiCheckLite[] = [{ status: "completed", conclusion: "failure" }];
    const gate = execGateFromChecks(checks);
    expect(gate.mayProceed).toBe(false);
    expect(gate.reason).toMatch(/red|fail/i);
  });

  it("blocks while a check is still running", () => {
    const gate = execGateFromChecks([{ status: "in_progress", conclusion: null }]);
    expect(gate.mayProceed).toBe(false);
    expect(gate.reason).toMatch(/running/i);
  });

  it("cannot gate on absent CI (no checks → cleared, nothing to gate on)", () => {
    const gate = execGateFromChecks([]);
    expect(gate.mayProceed).toBe(true);
    expect(gate.reason).toMatch(/no ci/i);
  });

  it("stays on the floor's label for a reserved-but-unwired preference (never strands)", () => {
    for (const id of RESERVED_PROVIDER_IDS) {
      const gate = execGateFromChecks([{ status: "completed", conclusion: "success" }], id);
      expect(gate.provider).toBe("github-actions");
      expect(gate.providerLabel).toBe("GitHub Actions");
    }
  });
});

describe("resolveBuildPreview (live full-build preview capability)", () => {
  it("the floor runs checks, not a live build preview", () => {
    expect(githubActionsProvider.previewsBuilds).toBe(false);
  });

  it("reports no live preview backend wired today (the $0 self-contained path is used)", () => {
    const cap = resolveBuildPreview();
    expect(cap.live).toBe(false);
    expect(cap.providerLabel).toBeNull();
  });
});
