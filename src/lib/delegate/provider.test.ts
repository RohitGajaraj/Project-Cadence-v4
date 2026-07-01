import { expect, test, describe, afterEach } from "bun:test";
import {
  buildOpenHandsRequest,
  mapOpenHandsResponse,
  nullDelegateProvider,
  RESERVED_DELEGATE_PROVIDER_IDS,
  DELEGATE_TASK_MAX_CHARS,
  type DelegateRequest,
} from "./provider";
import {
  delegateEnabled,
  openHandsProvider,
  resolveDelegateProvider,
  submitDelegation,
} from "./openhands.server";

const REQ: DelegateRequest = {
  task: "Add a rate limiter to the login endpoint",
  repoUrl: "https://github.com/acme/app",
  baseBranch: "main",
  context: { prdId: "p1" },
  cadenceRunId: "run_123",
};

// Restore env + global fetch after each test so dormancy/transport tests never leak.
const savedEnv = { ...process.env };
const savedFetch = globalThis.fetch;
afterEach(() => {
  for (const k of ["DELEGATE_OUTBOUND_ENABLED", "OPENHANDS_ENDPOINT", "OPENHANDS_API_KEY"]) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = savedFetch;
});

describe("buildOpenHandsRequest (pure mapping)", () => {
  test("embeds repo URL + branch in the message (no body fields)", () => {
    const body = buildOpenHandsRequest(REQ);
    // Repo context is embedded in the message so OpenHands doesn't try to
    // init a Docker sandbox at conversation-create time (causes 500 on Railway).
    expect(body.initial_user_msg).toContain(REQ.task);
    expect(body.initial_user_msg).toContain("https://github.com/acme/app");
    expect(body.initial_user_msg).toContain("main");
    expect((body as Record<string, unknown>).repository).toBeUndefined();
    expect((body as Record<string, unknown>).selected_branch).toBeUndefined();
  });

  test("bounds the combined message length and omits repo context when absent", () => {
    const body = buildOpenHandsRequest({
      task: "x".repeat(DELEGATE_TASK_MAX_CHARS + 500),
      repoUrl: "",
      baseBranch: "",
    });
    expect(body.initial_user_msg.length).toBe(DELEGATE_TASK_MAX_CHARS);
    expect((body as Record<string, unknown>).repository).toBeUndefined();
    expect((body as Record<string, unknown>).selected_branch).toBeUndefined();
  });
});

describe("mapOpenHandsResponse (pure mapping)", () => {
  test("accepts when conversation_id is present", () => {
    const v = mapOpenHandsResponse({ conversation_id: "conv_1" });
    expect(v.accepted).toBe(true);
    expect(v.externalJobId).toBe("conv_1");
  });

  test("null / empty / malformed responses are refused, never throw", () => {
    expect(mapOpenHandsResponse(null).accepted).toBe(false);
    expect(mapOpenHandsResponse(undefined).accepted).toBe(false);
    expect(mapOpenHandsResponse({}).accepted).toBe(false);
  });
});

describe("nullDelegateProvider (the dormant floor)", () => {
  test("is never available and accepts nothing", async () => {
    expect(nullDelegateProvider.available).toBe(false);
    const v = await nullDelegateProvider.submit(REQ);
    expect(v.accepted).toBe(false);
    expect(v.externalJobId).toBe(null);
  });
});

describe("reserved provider ids", () => {
  test("names the not-yet-wired backends without hard-coding ids elsewhere", () => {
    expect(RESERVED_DELEGATE_PROVIDER_IDS).toContain("devin");
    expect(RESERVED_DELEGATE_PROVIDER_IDS).not.toContain("openhands"); // openhands IS wired
  });
});

describe("delegateEnabled (dormancy flag)", () => {
  test("is off by default and on only for 1/true", () => {
    delete process.env.DELEGATE_OUTBOUND_ENABLED;
    expect(delegateEnabled()).toBe(false);
    process.env.DELEGATE_OUTBOUND_ENABLED = "0";
    expect(delegateEnabled()).toBe(false);
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    expect(delegateEnabled()).toBe(true);
    process.env.DELEGATE_OUTBOUND_ENABLED = "true";
    expect(delegateEnabled()).toBe(true);
  });
});

describe("openHandsProvider.available (needs BOTH flag + endpoint)", () => {
  test("false unless the flag AND the endpoint are set", () => {
    delete process.env.DELEGATE_OUTBOUND_ENABLED;
    delete process.env.OPENHANDS_ENDPOINT;
    expect(openHandsProvider.available).toBe(false);
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    expect(openHandsProvider.available).toBe(false); // no endpoint
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
    expect(openHandsProvider.available).toBe(true);
  });
});

describe("resolveDelegateProvider + submitDelegation (dormant by default)", () => {
  test("resolves to the dormant floor when delegation is disabled", () => {
    delete process.env.DELEGATE_OUTBOUND_ENABLED;
    delete process.env.OPENHANDS_ENDPOINT;
    expect(resolveDelegateProvider("openhands")).toBe(nullDelegateProvider);
    expect(resolveDelegateProvider()).toBe(nullDelegateProvider);
  });

  test("submitDelegation makes NO network call when disabled (fetch is never touched)", async () => {
    delete process.env.DELEGATE_OUTBOUND_ENABLED;
    delete process.env.OPENHANDS_ENDPOINT;
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("network must not be reached when dormant");
    }) as typeof fetch;
    const v = await submitDelegation(REQ);
    expect(fetchCalled).toBe(false);
    expect(v.accepted).toBe(false);
    expect(v.reason).toContain("disabled");
  });

  test("resolves to the OpenHands adapter once enabled + endpoint set", () => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
    expect(resolveDelegateProvider("openhands")).toBe(openHandsProvider);
  });
});

describe("openHandsProvider.submit (fail-safe transport)", () => {
  test("a transport error returns a refusal verdict, never throws", async () => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const v = await openHandsProvider.submit(REQ);
    expect(v.accepted).toBe(false);
    expect(v.reason).toContain("openhands unreachable");
  });

  test("a non-2xx response is refused", async () => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    const v = await openHandsProvider.submit(REQ);
    expect(v.accepted).toBe(false);
    expect(v.reason).toContain("503");
  });

  test("a well-formed accepted response yields an accepted verdict + conversation id", async () => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ conversation_id: "conv_42" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const v = await openHandsProvider.submit(REQ);
    expect(v.accepted).toBe(true);
    expect(v.externalJobId).toBe("conv_42");
  });
});
