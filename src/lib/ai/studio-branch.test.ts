import { describe, expect, test } from "bun:test";
import { studioBranchName } from "./studio-branch";

describe("studioBranchName", () => {
  const A = "abc12345-1111-4aaa-8aaa-000000000001";
  const CS_A = "11112222-3333-4444-5555-666677778888";

  test("is deterministic for the same inputs", () => {
    expect(studioBranchName(A, CS_A)).toBe(studioBranchName(A, CS_A));
  });

  test("produces a valid single git ref segment under studio/", () => {
    const name = studioBranchName(A, CS_A);
    expect(name).toMatch(/^studio\/[a-z0-9]+-[a-z0-9]+$/);
    // No characters git rejects in a ref, no double slash, no trailing dot/slash.
    expect(name).not.toMatch(/[\s~^:?*\[\\]/);
    expect(name).not.toMatch(/\/\/|\.\.|\.lock$|[/.]$/);
  });

  test("REGRESSION (the I3 bug): two missions sharing an 8-hex prefix get DIFFERENT branches", () => {
    // Same first 8 chars ("abc12345"): the old `studio/<missionId8>` collided here.
    const m1 = "abc12345-1111-4aaa-8aaa-000000000001";
    const m2 = "abc12345-9999-4bbb-8bbb-000000000002";
    const cs1 = "aaaaaaaa-0000-0000-0000-000000000001";
    const cs2 = "bbbbbbbb-0000-0000-0000-000000000002";
    expect(studioBranchName(m1, cs1)).not.toBe(studioBranchName(m2, cs2));
  });

  test("same mission, different changesets get different branches", () => {
    const cs1 = "aaaaaaaa-0000-0000-0000-000000000001";
    const cs2 = "bbbbbbbb-0000-0000-0000-000000000002";
    expect(studioBranchName(A, cs1)).not.toBe(studioBranchName(A, cs2));
  });

  test("strips UUID hyphens and lowercases", () => {
    const name = studioBranchName("AB-CD-EF-12", "98-76-54-32-abcd");
    expect(name).toBe("studio/abcdef12-98765432abcd");
  });

  test("degenerate/empty ids fall back to placeholders, never an invalid ref", () => {
    expect(studioBranchName("", "")).toBe("studio/m-c");
    expect(studioBranchName("----", "----")).toBe("studio/m-c");
  });
});
