import { describe, it, expect } from "bun:test";
import { assessMemoryExpiry, type MemoryExpiryRow } from "./plg-memory-expiry";

const DAY = 86_400_000;
const NOW = Date.parse("2026-06-22T00:00:00.000Z");

/** A memory created `ageDays` ago, optionally with an explicit `expires_at`. */
function mem(ageDays: number, expiresInDays?: number): MemoryExpiryRow {
  return {
    created_at: new Date(NOW - ageDays * DAY).toISOString(),
    expires_at:
      expiresInDays === undefined ? null : new Date(NOW + expiresInDays * DAY).toISOString(),
  };
}

describe("assessMemoryExpiry — paid plan", () => {
  it("never shows when retentionDays is null (memory never fades)", () => {
    const s = assessMemoryExpiry({
      memories: [mem(40), mem(100)],
      retentionDays: null,
      nowMs: NOW,
    });
    expect(s.show).toBe(false);
    expect(s.total).toBe(2);
    expect(s.retentionDays).toBeNull();
    expect(s.expiringCount).toBe(0);
  });
});

describe("assessMemoryExpiry — free plan, policy-implied fade (no expires_at)", () => {
  it("does NOT show when all memory is well within the window", () => {
    // 30-day retention, 7-day warning: memories aged 5/10 days fade in 25/20 days.
    const s = assessMemoryExpiry({
      memories: [mem(5), mem(10)],
      retentionDays: 30,
      nowMs: NOW,
    });
    expect(s.show).toBe(false);
    expect(s.expiringCount).toBe(0);
    expect(s.soonestDays).toBeNull();
  });

  it("shows when a memory is within the 7-day warning window", () => {
    // aged 25 days -> fades in 5 days (within 7).
    const s = assessMemoryExpiry({
      memories: [mem(25), mem(2)],
      retentionDays: 30,
      nowMs: NOW,
    });
    expect(s.show).toBe(true);
    expect(s.expiringCount).toBe(1);
    expect(s.soonestDays).toBe(5);
  });

  it("counts already-past-the-limit memory and reports soonestDays 0", () => {
    // aged 35 days -> faded 5 days ago (effective fade in the past).
    const s = assessMemoryExpiry({
      memories: [mem(35), mem(31)],
      retentionDays: 30,
      nowMs: NOW,
    });
    expect(s.show).toBe(true);
    expect(s.expiringCount).toBe(2); // both past the 30-day mark
    expect(s.soonestDays).toBe(0);
  });
});

describe("assessMemoryExpiry — free plan, explicit expires_at wins", () => {
  it("uses expires_at when set (founder expiry-flip / retention writer)", () => {
    // created recently but explicitly expires in 3 days -> at risk.
    const s = assessMemoryExpiry({
      memories: [mem(1, 3)],
      retentionDays: 30,
      nowMs: NOW,
    });
    expect(s.show).toBe(true);
    expect(s.expiringCount).toBe(1);
    expect(s.soonestDays).toBe(3);
  });

  it("an explicit far-future expires_at overrides the policy-implied fade", () => {
    // aged 40 days (policy says faded) BUT expires_at is 60 days out -> not at risk.
    const s = assessMemoryExpiry({
      memories: [mem(40, 60)],
      retentionDays: 30,
      nowMs: NOW,
    });
    expect(s.show).toBe(false);
    expect(s.expiringCount).toBe(0);
  });
});

describe("assessMemoryExpiry — edge cases", () => {
  it("is totally defined on empty / null / malformed input", () => {
    expect(assessMemoryExpiry({ memories: [], retentionDays: 30, nowMs: NOW }).show).toBe(false);
    expect(assessMemoryExpiry({ memories: null, retentionDays: 30, nowMs: NOW }).total).toBe(0);
    const malformed = assessMemoryExpiry({
      memories: [
        { created_at: null, expires_at: null },
        { created_at: "nonsense", expires_at: null },
      ],
      retentionDays: 30,
      nowMs: NOW,
    });
    expect(malformed.show).toBe(false); // undated rows are never counted on a guess
    expect(malformed.total).toBe(2);
  });

  it("respects a custom warnWithinDays window", () => {
    // aged 20 days -> fades in 10 days; not within 7 but within a 14-day window.
    expect(assessMemoryExpiry({ memories: [mem(20)], retentionDays: 30, nowMs: NOW }).show).toBe(
      false,
    );
    expect(
      assessMemoryExpiry({ memories: [mem(20)], retentionDays: 30, nowMs: NOW, warnWithinDays: 14 })
        .show,
    ).toBe(true);
  });
});
