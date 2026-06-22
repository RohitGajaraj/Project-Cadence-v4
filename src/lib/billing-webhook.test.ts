import { describe, it, expect } from "bun:test";
import {
  resolvePriceLookup,
  resolveTopupCredits,
  unixSecondsToIso,
  isTopupCheckout,
  isRenewalInvoice,
  resolvePeriod,
  buildSubscriptionUpsert,
  buildSubscriptionUpdate,
  TOPUP_CREDITS,
} from "./billing-webhook";

const NOW_ISO = "2026-06-22T00:00:00.000Z";
function subEvent() {
  return {
    id: "sub_123",
    customer: "cus_9",
    status: "active",
    cancel_at_period_end: false,
    metadata: { userId: "user_1" },
    items: {
      data: [
        {
          price: { lookup_key: "pro_monthly", product: "prod_7", id: "price_1" },
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_000_000,
        },
      ],
    },
  };
}

describe("resolvePriceLookup", () => {
  it("prefers lookup_key, then external id, then price id", () => {
    expect(resolvePriceLookup({ price: { lookup_key: "pro_monthly", id: "price_1" } })).toBe(
      "pro_monthly",
    );
    expect(
      resolvePriceLookup({ price: { metadata: { lovable_external_id: "ext_9" }, id: "price_1" } }),
    ).toBe("ext_9");
    expect(resolvePriceLookup({ price: { id: "price_1" } })).toBe("price_1");
  });

  it("returns undefined (never throws) on a missing/empty price", () => {
    expect(resolvePriceLookup(null)).toBeUndefined();
    expect(resolvePriceLookup(undefined)).toBeUndefined();
    expect(resolvePriceLookup({ price: null })).toBeUndefined();
    expect(resolvePriceLookup({ price: { lookup_key: "" } })).toBeUndefined();
  });
});

describe("resolveTopupCredits", () => {
  it("resolves legacy keys from the static map", () => {
    expect(resolveTopupCredits("topup_250")).toBe(250);
    expect(resolveTopupCredits("topup_1k")).toBe(1000);
    expect(resolveTopupCredits("topup_2_5k")).toBe(2500);
  });

  it("returns null for an unknown / empty key (so the handler skips crediting, never guesses)", () => {
    expect(resolveTopupCredits("nonsense_key")).toBeNull();
    expect(resolveTopupCredits(null)).toBeNull();
    expect(resolveTopupCredits(undefined)).toBeNull();
    expect(resolveTopupCredits("")).toBeNull();
  });

  it("the static map carries exactly the three legacy bundles", () => {
    expect(Object.keys(TOPUP_CREDITS).sort()).toEqual(["topup_1k", "topup_250", "topup_2_5k"]);
  });
});

describe("unixSecondsToIso", () => {
  it("converts unix seconds to an ISO string", () => {
    // 1_700_000_000s = 2023-11-14T22:13:20.000Z
    expect(unixSecondsToIso(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
  });

  it("returns null for absent / non-positive / non-finite input (no fake epoch-0)", () => {
    expect(unixSecondsToIso(null)).toBeNull();
    expect(unixSecondsToIso(undefined)).toBeNull();
    expect(unixSecondsToIso(0)).toBeNull();
    expect(unixSecondsToIso(-5)).toBeNull();
    expect(unixSecondsToIso(Number.NaN)).toBeNull();
  });
});

describe("isTopupCheckout", () => {
  it("is true only for a payment-mode topup session with a userId", () => {
    expect(isTopupCheckout({ mode: "payment", metadata: { kind: "topup", userId: "u1" } })).toBe(
      true,
    );
  });

  it("is false for a subscription checkout, an untagged session, or a missing userId", () => {
    expect(
      isTopupCheckout({ mode: "subscription", metadata: { kind: "topup", userId: "u1" } }),
    ).toBe(false);
    expect(isTopupCheckout({ mode: "payment", metadata: { kind: "topup" } })).toBe(false);
    expect(isTopupCheckout({ mode: "payment", metadata: { userId: "u1" } })).toBe(false);
    expect(isTopupCheckout(null)).toBe(false);
  });
});

describe("isRenewalInvoice", () => {
  it("is true ONLY for subscription_cycle (never subscription_create, so no double-grant)", () => {
    expect(isRenewalInvoice({ billing_reason: "subscription_cycle" })).toBe(true);
    expect(isRenewalInvoice({ billing_reason: "subscription_create" })).toBe(false);
    expect(isRenewalInvoice({ billing_reason: "manual" })).toBe(false);
    expect(isRenewalInvoice(null)).toBe(false);
  });
});

describe("resolvePeriod", () => {
  it("prefers the line-item period over the subscription-level period", () => {
    const p = resolvePeriod(
      { current_period_start: 1_700_000_000, current_period_end: 1_702_000_000 },
      { current_period_start: 1_600_000_000, current_period_end: 1_602_000_000 },
    );
    expect(p.start).toBe("2023-11-14T22:13:20.000Z");
    expect(p.end).toBe("2023-12-08T01:46:40.000Z");
  });

  it("falls back to the subscription-level period when the line item lacks one", () => {
    const p = resolvePeriod({}, { current_period_start: 1_700_000_000, current_period_end: null });
    expect(p.start).toBe("2023-11-14T22:13:20.000Z");
    expect(p.end).toBeNull();
  });

  it("is null/null when neither carries a period (never a fake epoch)", () => {
    expect(resolvePeriod(null, null)).toEqual({ start: null, end: null });
  });
});

describe("buildSubscriptionUpsert", () => {
  it("maps every field from the Stripe event (created upsert)", () => {
    const row = buildSubscriptionUpsert(subEvent(), "sandbox", NOW_ISO);
    expect(row).toEqual({
      user_id: "user_1",
      stripe_subscription_id: "sub_123",
      stripe_customer_id: "cus_9",
      product_id: "prod_7",
      price_id: "pro_monthly",
      status: "active",
      current_period_start: "2023-11-14T22:13:20.000Z",
      current_period_end: "2023-12-08T01:46:40.000Z",
      cancel_at_period_end: false,
      environment: "sandbox",
      updated_at: NOW_ISO,
    });
  });

  it("carries cancel_at_period_end through and defaults it to false", () => {
    const s = subEvent();
    s.cancel_at_period_end = true;
    expect(buildSubscriptionUpsert(s, "live", NOW_ISO).cancel_at_period_end).toBe(true);
    const s2 = subEvent();
    delete (s2 as { cancel_at_period_end?: boolean }).cancel_at_period_end;
    expect(buildSubscriptionUpsert(s2, "live", NOW_ISO).cancel_at_period_end).toBe(false);
  });

  it("falls back to the sub-level period when the line item lacks one", () => {
    const s = subEvent();
    delete s.items.data[0].current_period_start;
    delete s.items.data[0].current_period_end;
    (s as { current_period_start?: number }).current_period_start = 1_700_000_000;
    const row = buildSubscriptionUpsert(s, "live", NOW_ISO);
    expect(row.current_period_start).toBe("2023-11-14T22:13:20.000Z");
    expect(row.current_period_end).toBeNull();
  });
});

describe("buildSubscriptionUpdate", () => {
  it("maps the mutable subset (no user_id / customer / environment)", () => {
    const row = buildSubscriptionUpdate(subEvent(), NOW_ISO);
    expect(row).toEqual({
      status: "active",
      product_id: "prod_7",
      price_id: "pro_monthly",
      current_period_start: "2023-11-14T22:13:20.000Z",
      current_period_end: "2023-12-08T01:46:40.000Z",
      cancel_at_period_end: false,
      updated_at: NOW_ISO,
    });
    expect("user_id" in row).toBe(false);
    expect("environment" in row).toBe(false);
  });
});
