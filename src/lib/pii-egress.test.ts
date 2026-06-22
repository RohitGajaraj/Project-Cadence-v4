import { describe, expect, it } from "bun:test";
import { describeEgressPii, isValidSsn, luhnValid, scanEgressForPii } from "./pii-egress";

describe("luhnValid", () => {
  it("accepts real card check digits (Stripe/Visa test PANs are Luhn-valid)", () => {
    expect(luhnValid("4242424242424242")).toBe(true); // Stripe test Visa
    expect(luhnValid("4111111111111111")).toBe(true); // Visa test
    expect(luhnValid("5555555555554444")).toBe(true); // Mastercard test
    expect(luhnValid("378282246310005")).toBe(true); // Amex test (15 digits)
  });
  it("rejects a number whose check digit is wrong (a random 16-digit id)", () => {
    expect(luhnValid("4242424242424241")).toBe(false);
    expect(luhnValid("1234567890123456")).toBe(false);
    expect(luhnValid("0000000000000001")).toBe(false);
  });
  it("rejects non-digit / wrong-length input without throwing", () => {
    expect(luhnValid("")).toBe(false);
    expect(luhnValid("4242-4242")).toBe(false);
    expect(luhnValid("424242424242")).toBe(false); // 12 digits, below range
    expect(luhnValid("42424242424242424242")).toBe(false); // 20 digits, above range
    expect(luhnValid("abcd")).toBe(false);
  });
});

describe("isValidSsn — SSA allocation rules", () => {
  it("accepts a structurally valid SSN", () => {
    expect(isValidSsn("123", "45", "6789")).toBe(true);
    expect(isValidSsn("001", "01", "0001")).toBe(true);
    expect(isValidSsn("899", "99", "9999")).toBe(true);
  });
  it("rejects the invalid area / group / serial ranges", () => {
    expect(isValidSsn("000", "45", "6789")).toBe(false); // area 000
    expect(isValidSsn("666", "45", "6789")).toBe(false); // area 666
    expect(isValidSsn("900", "45", "6789")).toBe(false); // area 9xx
    expect(isValidSsn("123", "00", "6789")).toBe(false); // group 00
    expect(isValidSsn("123", "45", "0000")).toBe(false); // serial 0000
  });
});

describe("scanEgressForPii — credit cards (Luhn-gated)", () => {
  it("blocks a Luhn-valid card, with or without separators", () => {
    expect(scanEgressForPii("card 4242424242424242").blocked).toBe(true);
    expect(scanEgressForPii("4242 4242 4242 4242").types).toEqual(["credit card"]);
    expect(scanEgressForPii("4242-4242-4242-4242").blocked).toBe(true);
  });
  it("does NOT block a 16-digit number that fails Luhn (order id, hash chunk)", () => {
    expect(scanEgressForPii("order 1234567890123456").blocked).toBe(false);
    expect(scanEgressForPii("ref 4242424242424241").blocked).toBe(false);
  });
});

describe("scanEgressForPii — US SSN (validity-gated)", () => {
  it("blocks a structurally valid dashed SSN", () => {
    expect(scanEgressForPii("SSN 123-45-6789").blocked).toBe(true);
    expect(scanEgressForPii("123-45-6789").types).toEqual(["US SSN"]);
  });
  it("does NOT block an invalid SSN range or a non-SSN NNN-NN-NNNN token", () => {
    expect(scanEgressForPii("666-45-6789").blocked).toBe(false); // area 666
    expect(scanEgressForPii("000-12-3456").blocked).toBe(false); // area 000
    expect(scanEgressForPii("900-12-3456").blocked).toBe(false); // area 9xx
    expect(scanEgressForPii("123-00-4567").blocked).toBe(false); // group 00
    expect(scanEgressForPii("123-45-0000").blocked).toBe(false); // serial 0000
  });
});

describe("scanEgressForPii — discipline + safety", () => {
  it("leaves benign prose, emails, phones, versions, and dates untouched (no over-redaction)", () => {
    for (const s of [
      "We shipped the refund policy engine to 5 customers.",
      "Contact support@acme.com or call 555-123-4567 for help.",
      "Released v1.2.3 on 2026-06-22; build 12345678.",
      "Invoice total was 1,250 credits.",
    ]) {
      expect(scanEgressForPii(s).blocked).toBe(false);
    }
  });
  it("reports BOTH types when both are present, distinct (no dupes)", () => {
    const r = scanEgressForPii("ssn 123-45-6789 and card 4242 4242 4242 4242 and 4111111111111111");
    expect(r.blocked).toBe(true);
    expect(r.types.sort()).toEqual(["US SSN", "credit card"]);
  });
  it("is totally defined: null / undefined / empty never throw", () => {
    expect(scanEgressForPii(null).blocked).toBe(false);
    expect(scanEgressForPii(undefined).blocked).toBe(false);
    expect(scanEgressForPii("").blocked).toBe(false);
  });
  it("is idempotent (global-regex lastIndex is reset each call)", () => {
    const t = "card 4242424242424242";
    expect(scanEgressForPii(t).blocked).toBe(true);
    expect(scanEgressForPii(t).blocked).toBe(true);
  });
  it("the describe message names the TYPE but never echoes the value", () => {
    const msg = describeEgressPii(["credit card", "US SSN"]);
    expect(msg).toContain("credit card");
    expect(msg).toContain("US SSN");
    expect(msg).not.toContain("4242");
    expect(msg).not.toContain("6789");
    expect(describeEgressPii([])).toBe("");
  });
});
