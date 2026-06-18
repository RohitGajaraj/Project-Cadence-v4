import { describe, it, expect } from "vitest";
import { isTestPath, summarizeInspection } from "./studio-inspection";

describe("isTestPath", () => {
  it("matches .test / .spec files of any js/ts flavor", () => {
    expect(isTestPath("src/lib/foo.test.ts")).toBe(true);
    expect(isTestPath("src/lib/foo.spec.tsx")).toBe(true);
    expect(isTestPath("src/lib/foo.test.js")).toBe(true);
    expect(isTestPath("src/lib/foo.spec.mjs")).toBe(true);
  });

  it("matches files under __tests__ / test / tests dirs", () => {
    expect(isTestPath("src/__tests__/foo.ts")).toBe(true);
    expect(isTestPath("test/foo.ts")).toBe(true);
    expect(isTestPath("packages/x/tests/foo.ts")).toBe(true);
  });

  it("does not match ordinary source files", () => {
    expect(isTestPath("src/lib/foo.ts")).toBe(false);
    expect(isTestPath("src/components/Latest.tsx")).toBe(false); // 'test' inside a word
    expect(isTestPath("docs/testing.md")).toBe(false);
  });
});

describe("summarizeInspection", () => {
  it("counts files and flags a change that ships tests", () => {
    const result = summarizeInspection({
      paths: ["src/lib/a.ts", "src/lib/a.test.ts", "src/lib/b.ts"],
      ciOverall: "success",
      ciCheckCount: 3,
    });
    expect(result).toEqual({
      total_files: 3,
      test_files: 1,
      has_tests: true,
      ci_ran: true,
      ci_passed: true,
    });
  });

  it("flags has_tests=false when no test files are present", () => {
    const result = summarizeInspection({
      paths: ["README.md", "src/config.ts"],
      ciOverall: null,
      ciCheckCount: 0,
    });
    expect(result.has_tests).toBe(false);
    expect(result.test_files).toBe(0);
    expect(result.ci_ran).toBe(false);
    expect(result.ci_passed).toBe(false);
  });

  it("treats neutral CI as passed and failure/pending as not passed", () => {
    expect(
      summarizeInspection({ paths: [], ciOverall: "neutral", ciCheckCount: 1 }).ci_passed,
    ).toBe(true);
    expect(
      summarizeInspection({ paths: [], ciOverall: "failure", ciCheckCount: 1 }).ci_passed,
    ).toBe(false);
    expect(
      summarizeInspection({ paths: [], ciOverall: "pending", ciCheckCount: 1 }).ci_passed,
    ).toBe(false);
  });

  it("handles an empty changeset", () => {
    expect(summarizeInspection({ paths: [], ciOverall: null, ciCheckCount: 0 })).toEqual({
      total_files: 0,
      test_files: 0,
      has_tests: false,
      ci_ran: false,
      ci_passed: false,
    });
  });
});
