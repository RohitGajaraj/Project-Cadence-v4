import { describe, it, expect } from "bun:test";
import {
  decidePublicReadRateLimit,
  LIMIT_PER_WINDOW,
  WINDOW_DURATION_MS,
} from "./decisions-ratelimit.server";

/**
 * Unit tests for the pure rate-limit policy (no DB). The DB wrapper
 * (checkPublicDecisionRateLimit) is verified by `bun run build` + live e2e.
 */
const NOW = 1_700_000_000_000; // fixed clock so the window math is deterministic
const iso = (ms: number) => new Date(ms).toISOString();

describe("decidePublicReadRateLimit", () => {
  it("resets (allows) when there is no prior row", () => {
    expect(decidePublicReadRateLimit(null, NOW)).toEqual({ kind: "reset" });
  });

  it("resets when the prior window has fully expired", () => {
    const row = {
      id: "a",
      request_count: LIMIT_PER_WINDOW,
      window_start: iso(NOW - WINDOW_DURATION_MS - 1),
    };
    expect(decidePublicReadRateLimit(row, NOW)).toEqual({ kind: "reset" });
  });

  it("treats a window exactly windowMs old as expired (boundary → reset)", () => {
    const row = {
      id: "a",
      request_count: LIMIT_PER_WINDOW,
      window_start: iso(NOW - WINDOW_DURATION_MS),
    };
    expect(decidePublicReadRateLimit(row, NOW)).toEqual({ kind: "reset" });
  });

  it("increments within the window when under the limit", () => {
    const row = { id: "a", request_count: 5, window_start: iso(NOW - 1000) };
    expect(decidePublicReadRateLimit(row, NOW)).toEqual({
      kind: "increment",
      id: "a",
      nextCount: 6,
    });
  });

  it("blocks at the limit with a positive retry-after bounded by the window", () => {
    const row = {
      id: "a",
      request_count: LIMIT_PER_WINDOW,
      window_start: iso(NOW - WINDOW_DURATION_MS / 2), // 30 min into a 60-min window
    };
    const d = decidePublicReadRateLimit(row, NOW);
    expect(d.kind).toBe("block");
    if (d.kind === "block") {
      expect(d.retryAfterSeconds).toBeGreaterThan(0);
      expect(d.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_DURATION_MS / 1000);
    }
  });

  it("blocks when the count has overshot the limit (concurrent-write race)", () => {
    const row = {
      id: "a",
      request_count: LIMIT_PER_WINDOW + 10,
      window_start: iso(NOW - 1000),
    };
    expect(decidePublicReadRateLimit(row, NOW).kind).toBe("block");
  });

  it("respects a custom limit and window", () => {
    const row = { id: "a", request_count: 2, window_start: iso(NOW - 500) };
    expect(decidePublicReadRateLimit(row, NOW, 2, 1000).kind).toBe("block");
    expect(decidePublicReadRateLimit(row, NOW, 5, 1000)).toEqual({
      kind: "increment",
      id: "a",
      nextCount: 3,
    });
  });
});
