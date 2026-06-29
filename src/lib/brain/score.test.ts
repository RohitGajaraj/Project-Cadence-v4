import { describe, it, expect } from "bun:test";
import { scoreTheme, clamp01 } from "./score";

const NOW = Date.parse("2026-06-30T00:00:00.000Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const HOUR = 3_600_000;

describe("clamp01", () => {
  it("clamps to [0,1]", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
});

describe("scoreTheme", () => {
  it("maxes at 1 for a severe, certain, fresh, fully-novel theme", () => {
    const s = scoreTheme(
      { severity: 5, confidence: 1, createdAt: iso(0), lastSignalAt: iso(0), novelty: 1 },
      NOW,
    );
    expect(s).toBeCloseTo(1, 6);
  });

  it("is strictly positive for any valid row", () => {
    const s = scoreTheme(
      { severity: 1, confidence: 0, createdAt: iso(1000 * HOUR), novelty: 0 },
      NOW,
    );
    expect(s).toBeGreaterThan(0);
  });

  it("decays with age (recency halves roughly every 50h)", () => {
    const fresh = scoreTheme({ severity: 3, confidence: 0.5, createdAt: iso(0), novelty: 1 }, NOW);
    const old = scoreTheme(
      { severity: 3, confidence: 0.5, createdAt: iso(72 * HOUR), novelty: 1 },
      NOW,
    );
    expect(old).toBeLessThan(fresh);
    expect(old / fresh).toBeCloseTo(Math.exp(-1), 5); // recency factor at age 72h
  });

  it("null novelty is treated as fully novel (max novelty multiplier)", () => {
    const a = scoreTheme({ severity: 3, confidence: 0.5, createdAt: iso(0), novelty: null }, NOW);
    const b = scoreTheme({ severity: 3, confidence: 0.5, createdAt: iso(0), novelty: 1 }, NOW);
    expect(a).toBe(b);
  });

  it("a known (low-novelty) theme scores below an identical novel one", () => {
    const known = scoreTheme({ severity: 4, confidence: 0.8, createdAt: iso(0), novelty: 0 }, NOW);
    const novel = scoreTheme({ severity: 4, confidence: 0.8, createdAt: iso(0), novelty: 1 }, NOW);
    expect(known).toBeLessThan(novel);
  });

  it("clamps a future last_signal_at to age 0 (no super-recency boost)", () => {
    const future = scoreTheme(
      {
        severity: 3,
        confidence: 0.5,
        createdAt: iso(0),
        lastSignalAt: iso(-100 * HOUR),
        novelty: 1,
      },
      NOW,
    );
    const atNow = scoreTheme({ severity: 3, confidence: 0.5, createdAt: iso(0), novelty: 1 }, NOW);
    expect(future).toBeCloseTo(atNow, 6);
  });
});
