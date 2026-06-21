import { describe, it, expect } from "bun:test";
import {
  githubActionsProvider,
  resolveExecProvider,
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
