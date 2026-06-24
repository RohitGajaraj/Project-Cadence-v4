import { describe, test, expect } from "bun:test";
import { isGatewayColdError, classifyWedgeFailure } from "@/lib/wedge-cold";

describe("isGatewayColdError", () => {
  test("true for AI-gateway cold / unconfigured / capped signals", () => {
    for (const m of [
      "The AI gateway is unreachable",
      "LOVABLE_API_KEY is not set",
      "Missing GEMINI_API_KEY",
      "No api key configured",
      "Insufficient credits",
      "402 Payment Required",
      "model not configured",
    ]) {
      expect(isGatewayColdError(m)).toBe(true);
    }
  });

  test("a 429 rate-limit is NOT cold (it's transient — the gateway is connected)", () => {
    expect(isGatewayColdError("429 rate limit exceeded")).toBe(false);
  });

  test("false for unrelated errors and empty input", () => {
    expect(isGatewayColdError("Could not record the idea")).toBe(false);
    expect(isGatewayColdError("permission denied")).toBe(false);
    expect(isGatewayColdError("")).toBe(false);
    expect(isGatewayColdError(null)).toBe(false);
  });
});

describe("classifyWedgeFailure", () => {
  test("cold-gateway errors get a reassuring, idea-is-safe note", () => {
    const f = classifyWedgeFailure("AI gateway unreachable");
    expect(f.kind).toBe("cold");
    expect(f.note).toMatch(/Critic needs the AI gateway/);
    expect(f.note).toMatch(/safe/);
  });

  test("transient transport errors suggest a retry", () => {
    for (const m of [
      "network error",
      "request timed out",
      "fetch failed",
      "503 Service Unavailable",
      "429 rate limit exceeded",
    ]) {
      const f = classifyWedgeFailure(m);
      expect(f.kind).toBe("transient");
      expect(f.note).toMatch(/try again/i);
    }
  });

  test("other errors keep the real message, framed calmly", () => {
    const f = classifyWedgeFailure("Could not record the idea");
    expect(f.kind).toBe("other");
    expect(f.note).toContain("Could not record the idea");
    expect(f.note).toMatch(/Try again/);
  });

  test("an empty message still yields a calm generic note", () => {
    const f = classifyWedgeFailure("");
    expect(f.kind).toBe("other");
    expect(f.note).toBe("Something went wrong. Try again.");
  });

  test("cold takes precedence over transient when both could match", () => {
    // a 402 (cold/credit) that also mentions network — cold wins (the actionable cause)
    expect(classifyWedgeFailure("402 gateway network error").kind).toBe("cold");
  });
});
