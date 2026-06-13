import { describe, expect, test } from "bun:test";
import { backoffMs, DEFAULT_MAX_ATTEMPTS, nextRetryAtIso, shouldRetryStep } from "./retry";

describe("shouldRetryStep", () => {
  test("retries while attempts are below the ceiling", () => {
    expect(shouldRetryStep({ attempts: 1, maxAttempts: 2 })).toBe(true);
  });

  test("gives up once attempts reach the ceiling", () => {
    expect(shouldRetryStep({ attempts: 2, maxAttempts: 2 })).toBe(false);
    expect(shouldRetryStep({ attempts: 3, maxAttempts: 2 })).toBe(false);
  });

  test("a missing/zero ceiling falls back to the default", () => {
    expect(shouldRetryStep({ attempts: 1, maxAttempts: 0 })).toBe(true); // 1 < default 2
    expect(shouldRetryStep({ attempts: 2, maxAttempts: 0 })).toBe(false);
  });
});

describe("backoffMs", () => {
  test("is exponential in the attempt count", () => {
    expect(backoffMs(1, 30_000)).toBe(30_000); // first retry: base
    expect(backoffMs(2, 30_000)).toBe(60_000); // second: 2x
    expect(backoffMs(3, 30_000)).toBe(120_000);
  });

  test("floors the attempt count at 1 (never negative/zero backoff)", () => {
    expect(backoffMs(0, 30_000)).toBe(30_000);
  });
});

describe("nextRetryAtIso", () => {
  test("adds the backoff to now and returns an ISO timestamp", () => {
    const now = 1_700_000_000_000;
    expect(nextRetryAtIso(now, 1, 30_000)).toBe(new Date(now + 30_000).toISOString());
    expect(nextRetryAtIso(now, 2, 30_000)).toBe(new Date(now + 60_000).toISOString());
  });
});

test("DEFAULT_MAX_ATTEMPTS is the conservative 2 (one automatic retry)", () => {
  expect(DEFAULT_MAX_ATTEMPTS).toBe(2);
});
