import { describe, it, expect } from "bun:test";
import {
  CREDIT_COGS_USD,
  creditRateFor,
  creditsForCost,
  estimateCreditsForCall,
  actionCreditRange,
  estimateCostUsd,
} from "./pricing";

describe("CREDIT_COGS_USD", () => {
  it("is a positive, margin-bearing constant", () => {
    expect(CREDIT_COGS_USD).toBeGreaterThan(0);
    expect(Number.isFinite(CREDIT_COGS_USD)).toBe(true);
  });
});

describe("creditRateFor", () => {
  it("defaults to 1 for any model without an explicit rate", () => {
    expect(creditRateFor("openai/gpt-5")).toBe(1);
    expect(creditRateFor("totally-unknown-model")).toBe(1);
  });
});

describe("creditsForCost", () => {
  it("charges nothing for a zero, negative, or non-finite cost", () => {
    expect(creditsForCost(0, "openai/gpt-5")).toBe(0);
    expect(creditsForCost(-1, "openai/gpt-5")).toBe(0);
    expect(creditsForCost(Number.NaN, "openai/gpt-5")).toBe(0);
    expect(creditsForCost(Number.POSITIVE_INFINITY, "openai/gpt-5")).toBe(0);
  });

  it("never returns 0 for a billable (positive-cost) call", () => {
    // a cost far below one credit's COGS still rounds up to a whole credit
    expect(creditsForCost(CREDIT_COGS_USD / 1000, "openai/gpt-5")).toBe(1);
    expect(creditsForCost(CREDIT_COGS_USD, "openai/gpt-5")).toBe(1);
  });

  it("rounds up (margin-positive) and is deterministic", () => {
    const cost = CREDIT_COGS_USD * 2.4; // 2.4 credits' worth of COGS
    expect(creditsForCost(cost, "openai/gpt-5")).toBe(3);
    expect(creditsForCost(cost, "openai/gpt-5")).toBe(3);
  });

  it("returns whole credits and is monotonic in cost", () => {
    const cheap = creditsForCost(CREDIT_COGS_USD * 10, "openai/gpt-5");
    const dear = creditsForCost(CREDIT_COGS_USD * 100, "openai/gpt-5");
    expect(Number.isInteger(cheap)).toBe(true);
    expect(Number.isInteger(dear)).toBe(true);
    expect(dear).toBeGreaterThan(cheap);
  });
});

describe("estimateCreditsForCall", () => {
  it("composes the USD estimator (one source of truth)", () => {
    const model = "google/gemini-2.5-pro";
    const expected = creditsForCost(estimateCostUsd(model, 3000, 2000), model);
    expect(estimateCreditsForCall(model, 3000, 2000)).toBe(expected);
  });

  it("charges 0 for a no-token call", () => {
    expect(estimateCreditsForCall("openai/gpt-5", 0, 0)).toBe(0);
  });

  it("a premium model costs more credits than a cheap one for the same shape", () => {
    const premium = estimateCreditsForCall("anthropic/claude-opus-4", 3000, 2000);
    const cheap = estimateCreditsForCall("google/gemini-2.5-flash-lite", 3000, 2000);
    expect(premium).toBeGreaterThan(cheap);
    expect(cheap).toBeGreaterThanOrEqual(1); // still billable
  });

  it("a longer completion costs at least as many credits as a shorter one", () => {
    const model = "openai/gpt-5";
    const short = estimateCreditsForCall(model, 1000, 200);
    const long = estimateCreditsForCall(model, 1000, 2000);
    expect(long).toBeGreaterThanOrEqual(short);
  });

  it("an unknown model still produces a billable credit count (neutral fallback)", () => {
    expect(estimateCreditsForCall("some/unknown-model", 2000, 1000)).toBeGreaterThanOrEqual(1);
  });
});

describe("actionCreditRange (legibility layer)", () => {
  it("returns an ordered, billable, whole-credit range for a known action", () => {
    const r = actionCreditRange("prd_draft");
    expect(Number.isInteger(r.min)).toBe(true);
    expect(Number.isInteger(r.max)).toBe(true);
    expect(r.min).toBeGreaterThanOrEqual(1);
    expect(r.max).toBeGreaterThanOrEqual(r.min);
  });

  it("a research action is heavier than a single chat reply", () => {
    const chat = actionCreditRange("chat_reply");
    const research = actionCreditRange("research");
    expect(research.max).toBeGreaterThan(chat.max);
  });

  it("falls back to a safe, non-alarming default for an unknown kind", () => {
    const r = actionCreditRange("not-a-real-action");
    expect(r.min).toBeGreaterThanOrEqual(1);
    expect(r.max).toBeGreaterThanOrEqual(r.min);
  });

  it("the low end derives from the SAME conversion as the real meter", () => {
    // prd_draft's low shape (3000 prompt / 2000 completion on gemini-2.5-pro) must
    // equal the direct estimate, proving the range is not an independent number.
    const direct = estimateCreditsForCall("google/gemini-2.5-pro", 3000, 2000);
    expect(actionCreditRange("prd_draft").min).toBe(direct);
  });
});
