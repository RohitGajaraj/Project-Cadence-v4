import { describe, test, expect } from "bun:test";
import {
  SEAL_ALGO,
  canonicalizeReceipt,
  sha256Hex,
  sealReceipts,
  verifyReceipts,
  shortHead,
} from "@/lib/trust-verify";
import type { TrustReceipt } from "@/lib/trust-ledger.functions";

function receipt(over: Partial<TrustReceipt> & { id: string }): TrustReceipt {
  return {
    id: over.id,
    kind: "decision",
    title: "Ship the escalation policy",
    rationale: "Cuts approval latency",
    status: "approved",
    actor: "strategist",
    humanDecided: true,
    occurredAt: "2026-06-20T10:00:00.000Z",
    source: { kind: "prd", id: "prd-1", label: null },
    toolName: null,
    evidenceCount: 3,
    outcome: "standing",
    supersededBy: null,
    ...over,
  };
}

const A = receipt({ id: "a1" });
const B = receipt({
  id: "b2",
  title: "Adopt usage pricing",
  outcome: "superseded",
  supersededBy: "z9",
});
const C = receipt({
  id: "c3",
  kind: "action",
  toolName: "github.commit.append",
  humanDecided: false,
});

describe("sealReceipts — the tamper-evident chain", () => {
  test("is deterministic and order-independent (sealed by id, not read order)", async () => {
    const s1 = await sealReceipts([A, B, C]);
    const s2 = await sealReceipts([C, A, B]);
    expect(s1.head).toBe(s2.head);
    expect(s1.algo).toBe(SEAL_ALGO);
    expect(s1.count).toBe(3);
    expect(s1.links.map((l) => l.id)).toEqual(["a1", "b2", "c3"]);
  });

  test("empty ledger seals to the genesis head with count 0", async () => {
    const s = await sealReceipts([]);
    expect(s.count).toBe(0);
    expect(s.links).toEqual([]);
    expect(s.head).toBe(await sha256Hex("cadence-trust-ledger/v1"));
  });

  test("a different record set yields a different head", async () => {
    const s1 = await sealReceipts([A, B]);
    const s2 = await sealReceipts([A, B, C]);
    expect(s1.head).not.toBe(s2.head);
  });

  test("total order: the same set in any read order seals equal, even with a shared id", async () => {
    // ids are DB primary keys so a collision never happens, but the canonical
    // tie-break must keep the seal read-order-independent regardless.
    const x = receipt({ id: "dup", title: "alpha" });
    const y = receipt({ id: "dup", title: "beta" });
    expect((await sealReceipts([x, y])).head).toBe((await sealReceipts([y, x])).head);
  });
});

describe("canonicalizeReceipt — only integrity-relevant fields", () => {
  test("ignores derived presentation fields (evidenceCount, source.label)", async () => {
    const noisy = receipt({
      id: "a1",
      evidenceCount: 999,
      source: { kind: "prd", id: "prd-1", label: "Renamed PRD" },
    });
    expect(canonicalizeReceipt(noisy)).toBe(canonicalizeReceipt(A));
    // and therefore the seal does not flap when only derived fields change
    expect((await sealReceipts([noisy])).head).toBe((await sealReceipts([A])).head);
  });

  test("a real content change (title) changes the canonical form", () => {
    expect(canonicalizeReceipt(receipt({ id: "a1", title: "Different" }))).not.toBe(
      canonicalizeReceipt(A),
    );
  });

  test("an outcome flip (standing -> superseded) is sealed", () => {
    expect(
      canonicalizeReceipt(receipt({ id: "a1", outcome: "superseded", supersededBy: "x" })),
    ).not.toBe(canonicalizeReceipt(A));
  });
});

describe("verifyReceipts — detect and pinpoint tampering", () => {
  test("unchanged ledger verifies ok", async () => {
    const seal = await sealReceipts([A, B, C]);
    const v = await verifyReceipts([A, B, C], seal);
    expect(v.ok).toBe(true);
    expect(v.brokenAt).toBeNull();
    expect(v.reason).toBeNull();
    expect(v.recomputedHead).toBe(seal.head);
  });

  test("an altered record is flagged and pinpointed", async () => {
    const seal = await sealReceipts([A, B, C]);
    const tampered = [
      A,
      receipt({ id: "b2", title: "SILENTLY CHANGED", outcome: "superseded", supersededBy: "z9" }),
      C,
    ];
    const v = await verifyReceipts(tampered, seal);
    expect(v.ok).toBe(false);
    expect(v.brokenAt).toBe("b2");
    expect(v.reason).toMatch(/altered/);
  });

  test("a removed record is detected", async () => {
    const seal = await sealReceipts([A, B, C]);
    const v = await verifyReceipts([A, B], seal);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/removed/);
    expect(v.expectedCount).toBe(3);
    expect(v.count).toBe(2);
  });

  test("an added record is detected", async () => {
    const seal = await sealReceipts([A, B]);
    const v = await verifyReceipts([A, B, C], seal);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/added/);
    expect(v.brokenAt).toBe("c3");
  });

  test("head-only seal (no links) still detects a count change", async () => {
    const seal = await sealReceipts([A, B, C]);
    const v = await verifyReceipts([A, B], { head: seal.head, count: seal.count });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/number of records/);
  });
});

describe("shortHead — human fingerprint", () => {
  test("groups the first 12 hex chars", () => {
    expect(shortHead("0123456789abcdef0000")).toBe("0123 4567 89ab");
  });
});
