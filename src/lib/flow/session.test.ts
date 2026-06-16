import { describe, expect, test } from "bun:test";
import {
  endsAtFor,
  formatRemaining,
  isExpired,
  isResumable,
  remainingMs,
  type FlowSession,
} from "./session";

const NOW = 1_000_000;
function session(endsAt: number | null): FlowSession {
  return { endsAt, preset: "rain", soundOn: true };
}

describe("endsAtFor", () => {
  test("a positive timer yields a deadline that many minutes out", () => {
    expect(endsAtFor(25, NOW)).toBe(NOW + 25 * 60_000);
  });
  test("zero minutes means open-ended (no deadline)", () => {
    expect(endsAtFor(0, NOW)).toBeNull();
  });
});

describe("remainingMs", () => {
  test("counts down toward the deadline", () => {
    expect(remainingMs(NOW + 5_000, NOW)).toBe(5_000);
  });
  test("never goes negative", () => {
    expect(remainingMs(NOW - 5_000, NOW)).toBe(0);
  });
  test("open-ended has no remaining value", () => {
    expect(remainingMs(null, NOW)).toBeNull();
  });
});

describe("isExpired / isResumable", () => {
  test("no session is neither expired nor resumable", () => {
    expect(isExpired(null, NOW)).toBe(false);
    expect(isResumable(null, NOW)).toBe(false);
  });
  test("an open-ended session never expires and stays resumable", () => {
    expect(isExpired(session(null), NOW)).toBe(false);
    expect(isResumable(session(null), NOW)).toBe(true);
  });
  test("a future deadline is resumable; a past one is expired", () => {
    expect(isResumable(session(NOW + 60_000), NOW)).toBe(true);
    expect(isExpired(session(NOW - 1), NOW)).toBe(true);
    expect(isResumable(session(NOW - 1), NOW)).toBe(false);
  });
});

describe("formatRemaining", () => {
  test("formats minutes and zero-padded seconds", () => {
    expect(formatRemaining(65_000)).toBe("1:05");
    expect(formatRemaining(119_000)).toBe("1:59");
    expect(formatRemaining(0)).toBe("0:00");
  });
  test("rounds partial seconds up so the timer never shows 0:00 early", () => {
    expect(formatRemaining(1_500)).toBe("0:02");
  });
  test("open-ended renders as empty", () => {
    expect(formatRemaining(null)).toBe("");
  });
});
