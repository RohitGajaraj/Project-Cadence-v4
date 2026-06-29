import { describe, it, expect } from "bun:test";
import {
  normalizeForHash,
  hashContent,
  diffSnapshots,
  backoffNext,
  MAX_BACKOFF_FACTOR,
} from "./diff";
import { cadenceToMs } from "./kinds";

describe("normalizeForHash", () => {
  it("lowercases, collapses whitespace, and trims", () => {
    expect(normalizeForHash("  Hello   WORLD\n\tfoo ")).toBe("hello world foo");
  });
});

describe("hashContent", () => {
  it("is stable for the same content", () => {
    expect(hashContent("Pricing is now $49/mo")).toBe(hashContent("Pricing is now $49/mo"));
  });

  it("is stable under whitespace / case churn (normalization)", () => {
    expect(hashContent("Pricing now $49")).toBe(hashContent("  pricing   NOW\n$49  "));
  });

  it("changes when the meaningful content changes", () => {
    expect(hashContent("Pricing is now $49/mo")).not.toBe(hashContent("Pricing is now $59/mo"));
  });

  it("returns a fixed-width hex string", () => {
    expect(hashContent("anything")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("diffSnapshots", () => {
  it("firstSeen when there is no previous snapshot, and emits NOTHING", () => {
    const r = diffSnapshots(null, { content_hash: "abc", excerpt: "first content" });
    expect(r.firstSeen).toBe(true);
    expect(r.changed).toBe(false); // day-1 must not emit a phantom change
    expect(r.addedExcerpt).toBe("");
  });

  it("unchanged when hashes match", () => {
    const r = diffSnapshots(
      { content_hash: "abc", excerpt: "x" },
      { content_hash: "abc", excerpt: "x" },
    );
    expect(r.changed).toBe(false);
    expect(r.firstSeen).toBe(false);
  });

  it("changed when hashes differ", () => {
    const r = diffSnapshots(
      { content_hash: "abc", excerpt: "old line" },
      { content_hash: "def", excerpt: "old line\nbrand new line" },
    );
    expect(r.changed).toBe(true);
    expect(r.firstSeen).toBe(false);
    expect(r.addedExcerpt).toContain("brand new line");
    expect(r.addedExcerpt).not.toContain("old line");
  });

  it("falls back to the next excerpt when no distinct lines exist", () => {
    const r = diffSnapshots(
      { content_hash: "abc", excerpt: "" },
      { content_hash: "def", excerpt: "wholly new body" },
    );
    expect(r.changed).toBe(true);
    expect(r.addedExcerpt).toBe("wholly new body");
  });
});

describe("backoffNext", () => {
  const now = new Date("2026-06-30T00:00:00.000Z");

  it("returns base cadence at consecutiveUnchanged = 0 (factor 1)", () => {
    const next = backoffNext(now, "daily", 0);
    expect(next.getTime() - now.getTime()).toBe(cadenceToMs("daily"));
  });

  it("grows geometrically with consecutiveUnchanged", () => {
    const one = backoffNext(now, "hourly", 1).getTime() - now.getTime();
    const two = backoffNext(now, "hourly", 2).getTime() - now.getTime();
    const three = backoffNext(now, "hourly", 3).getTime() - now.getTime();
    expect(one).toBe(cadenceToMs("hourly") * 2);
    expect(two).toBe(cadenceToMs("hourly") * 4);
    expect(three).toBe(cadenceToMs("hourly") * 8);
  });

  it("caps the factor at MAX_BACKOFF_FACTOR", () => {
    const capped = backoffNext(now, "hourly", 99).getTime() - now.getTime();
    expect(capped).toBe(cadenceToMs("hourly") * MAX_BACKOFF_FACTOR);
  });
});
