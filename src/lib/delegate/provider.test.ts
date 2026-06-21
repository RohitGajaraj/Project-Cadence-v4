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
  test("maps the normalized request to the OpenHands task body", () => {
    const body = buildOpenHandsRequest(REQ);
    expect(body.goal).toBe(REQ.task);
    expect(body.repo).toBe(REQ.repoUrl);
    expect(body.branch).toBe(REQ.baseBranch);
    expect(body.metadata).toEqual({ context: { prdId: "p1" }, cadence_run_id: "run_123" });
  });

  test("bounds the task text and tolerates missing context/run id", () => {
    const body = buildOpenHandsRequest({
      task: "x".repeat(DELEGATE_TASK_MAX_CHARS + 500),
      repoUrl: "r",
      baseBranch: "b",
    });
    expect(body.goal.length).toBe(DELEGATE_TASK_MAX_CHARS);
    expect(body.metadata).toEqual({ context: {}, cadence_run_id: null });
  });
});

describe("mapOpenHandsResponse (pure mapping)", () => {
  test("accepts only on a known status WITH a task id", () => {
    const v = mapOpenHandsResponse({ task_id: "t1", status: "queued" });
    expect(v.accepted).toBe(true);
    expect(v.externalJobId).toBe("t1");
  });

  test("a task id without an accepted status is refused", () => {
    expect(mapOpenHandsResponse({ task_id: "t1", status: "rejected" }).accepted).toBe(false);
  });

  test("an accepted status without a task id is refused (no phantom acceptance)", () => {
    const v = mapOpenHandsResponse({ status: "running" });
    expect(v.accepted).toBe(false);
    expect(v.externalJobId).toBe(null);
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

  test("a well-formed accepted response yields an accepted verdict + job id", async () => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ task_id: "oh_42", status: "queued" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const v = await openHandsProvider.submit(REQ);
    expect(v.accepted).toBe(true);
    expect(v.externalJobId).toBe("oh_42");
  });
});
