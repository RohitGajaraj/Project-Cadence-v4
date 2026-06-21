import { describe, it, expect } from "bun:test";
import { invoiceSubscriptionId } from "./stripe-invoice";

describe("invoiceSubscriptionId", () => {
  it("reads the pre-Basil top-level string field", () => {
    expect(invoiceSubscriptionId({ subscription: "sub_legacy" })).toBe("sub_legacy");
  });

  it("reads an expanded top-level object", () => {
    expect(invoiceSubscriptionId({ subscription: { id: "sub_expanded" } })).toBe("sub_expanded");
  });

  it("reads the Basil+ parent.subscription_details location (the live shape)", () => {
    // The exact payload our pinned 2026-03-25.dahlia client receives.
    const invoice = {
      subscription: undefined,
      parent: { subscription_details: { subscription: "sub_basil" } },
    };
    expect(invoiceSubscriptionId(invoice)).toBe("sub_basil");
  });

  it("reads an expanded Basil+ subscription object", () => {
    const invoice = { parent: { subscription_details: { subscription: { id: "sub_basil_obj" } } } };
    expect(invoiceSubscriptionId(invoice)).toBe("sub_basil_obj");
  });

  it("falls back to the line-level subscription_item_details", () => {
    const invoice = {
      lines: { data: [{ parent: { subscription_item_details: { subscription: "sub_line" } } }] },
    };
    expect(invoiceSubscriptionId(invoice)).toBe("sub_line");
  });

  it("prefers the top-level field when both are present", () => {
    const invoice = {
      subscription: "sub_top",
      parent: { subscription_details: { subscription: "sub_parent" } },
    };
    expect(invoiceSubscriptionId(invoice)).toBe("sub_top");
  });

  it("returns null for a non-subscription (one-off top-up) invoice", () => {
    expect(invoiceSubscriptionId({ id: "in_topup", lines: { data: [] } })).toBeNull();
  });

  it("is total: null/garbage/empty yield null, never throw", () => {
    expect(invoiceSubscriptionId(null)).toBeNull();
    expect(invoiceSubscriptionId(undefined)).toBeNull();
    expect(invoiceSubscriptionId("not-an-object")).toBeNull();
    expect(invoiceSubscriptionId({ subscription: "" })).toBeNull();
    expect(invoiceSubscriptionId({ parent: {} })).toBeNull();
    expect(invoiceSubscriptionId({ lines: { data: [{}] } })).toBeNull();
  });
});
