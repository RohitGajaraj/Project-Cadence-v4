import { describe, it, expect, beforeAll } from "bun:test";
import { verifyWebhook } from "./stripe.server";

// The webhook signature gate is what makes a credit-granting / tier-flipping Stripe event
// trustworthy. These tests pin its security invariants: a valid HMAC passes, anything
// tampered / wrong-secret / stale / malformed is rejected.

const SECRET = "whsec_test_dummy_secret";

async function sign(body: string, ts: number, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`));
  return Buffer.from(new Uint8Array(sig)).toString("hex");
}

function req(body: string, header: string | null): Request {
  const headers: Record<string, string> = {};
  if (header !== null) headers["stripe-signature"] = header;
  return new Request("https://x/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    headers,
    body,
  });
}

const BODY = JSON.stringify({
  type: "customer.subscription.created",
  data: { object: { id: "sub_1" } },
});

beforeAll(() => {
  process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET = SECRET;
});

describe("verifyWebhook", () => {
  it("accepts a valid signature and returns the parsed event", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(BODY, ts);
    const event = await verifyWebhook(req(BODY, `t=${ts},v1=${sig}`), "sandbox");
    expect(event.type).toBe("customer.subscription.created");
    expect(event.data.object.id).toBe("sub_1");
  });

  it("accepts when any one of multiple v1 sigs matches (secret rotation)", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const good = await sign(BODY, ts);
    const event = await verifyWebhook(req(BODY, `t=${ts},v1=deadbeef,v1=${good}`), "sandbox");
    expect(event.type).toBe("customer.subscription.created");
  });

  it("rejects a tampered body", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(BODY, ts);
    await expect(verifyWebhook(req(BODY + "x", `t=${ts},v1=${sig}`), "sandbox")).rejects.toThrow(
      /Invalid webhook signature/,
    );
  });

  it("rejects a signature made with the wrong secret", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(BODY, ts, "whsec_wrong");
    await expect(verifyWebhook(req(BODY, `t=${ts},v1=${sig}`), "sandbox")).rejects.toThrow(
      /Invalid webhook signature/,
    );
  });

  it("rejects an expired timestamp (older than 300s)", async () => {
    const ts = Math.floor(Date.now() / 1000) - 400;
    const sig = await sign(BODY, ts);
    await expect(verifyWebhook(req(BODY, `t=${ts},v1=${sig}`), "sandbox")).rejects.toThrow(
      /too old/,
    );
  });

  it("rejects a malformed signature header", async () => {
    await expect(verifyWebhook(req(BODY, "garbage"), "sandbox")).rejects.toThrow(
      /Invalid signature format/,
    );
  });

  it("rejects a missing signature header", async () => {
    await expect(verifyWebhook(req(BODY, null), "sandbox")).rejects.toThrow(/Missing signature/);
  });
});
