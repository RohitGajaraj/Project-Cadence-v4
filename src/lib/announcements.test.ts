import { expect, test, describe } from "bun:test";
import {
  applyTransition,
  isPubliclyVisible,
  generateSlug,
  isValidSlug,
  type WorkspaceRole,
} from "./announcements";

describe("applyTransition: approval-to-publish state machine", () => {
  test("any member can submit a draft for approval (draft -> pending)", () => {
    for (const role of ["owner", "admin", "member"] as WorkspaceRole[]) {
      const r = applyTransition("draft", "pending", role);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("pending");
    }
  });

  test("a viewer cannot submit a draft (no write role)", () => {
    const r = applyTransition("draft", "pending", "viewer");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("viewer");
  });

  test("only owner/admin can publish (pending -> published)", () => {
    expect(applyTransition("pending", "published", "owner").ok).toBe(true);
    expect(applyTransition("pending", "published", "admin").ok).toBe(true);
    expect(applyTransition("pending", "published", "member").ok).toBe(false);
    expect(applyTransition("pending", "published", "viewer").ok).toBe(false);
  });

  test("publishing a draft directly is not a valid transition (must go via pending)", () => {
    expect(applyTransition("draft", "published", "owner").ok).toBe(false);
  });

  test("reverse + no-op transitions are rejected", () => {
    expect(applyTransition("published", "draft", "owner").ok).toBe(false);
    expect(applyTransition("pending", "draft", "owner").ok).toBe(false);
    expect(applyTransition("draft", "draft", "owner").ok).toBe(false);
    expect(applyTransition("published", "published", "owner").ok).toBe(false);
  });

  test("is total: every result is typed, never throws", () => {
    const r = applyTransition("published", "pending", "viewer");
    expect(r.ok).toBe(false);
  });
});

describe("isPubliclyVisible", () => {
  test("only a published announcement is publicly visible", () => {
    expect(isPubliclyVisible("published")).toBe(true);
    expect(isPubliclyVisible("draft")).toBe(false);
    expect(isPubliclyVisible("pending")).toBe(false);
  });
});

describe("generateSlug + isValidSlug", () => {
  test("builds a URL-safe slug from a title + entropy", () => {
    const slug = generateSlug("Our Big Q3 Launch!", "abc123def");
    expect(slug.startsWith("our-big-q3-launch-")).toBe(true);
    expect(isValidSlug(slug)).toBe(true);
  });

  test("a title with no URL-safe chars falls back to the entropy (never empty)", () => {
    const slug = generateSlug("！！！", "z9y8x7");
    expect(slug.length).toBeGreaterThanOrEqual(4);
    expect(isValidSlug(slug)).toBe(true);
  });

  test("stays within the length bound for a very long title", () => {
    const slug = generateSlug("word ".repeat(100), "qqqqqq");
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(isValidSlug(slug)).toBe(true);
  });

  test("a missing/short entropy still yields a valid slug", () => {
    expect(isValidSlug(generateSlug("Hi", ""))).toBe(true);
    expect(isValidSlug(generateSlug("", "ab"))).toBe(true);
  });

  test("isValidSlug rejects unsafe / out-of-bounds slugs", () => {
    expect(isValidSlug("Has Space")).toBe(false);
    expect(isValidSlug("UPPER")).toBe(false);
    expect(isValidSlug("a")).toBe(false); // too short
    expect(isValidSlug("x".repeat(81))).toBe(false); // too long
    expect(isValidSlug("ok-slug-9")).toBe(true);
  });
});
