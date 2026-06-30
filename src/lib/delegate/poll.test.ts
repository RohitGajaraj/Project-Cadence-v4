import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { pollDelegateJob, type DelegatePollResult } from "./poll.server";

const savedEnv = { ...process.env };
const savedFetch = globalThis.fetch;
afterEach(() => {
  for (const k of ["DELEGATE_OUTBOUND_ENABLED", "OPENHANDS_ENDPOINT", "OPENHANDS_API_KEY"]) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = savedFetch;
});

function mockFetch(body: unknown, status = 200): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

// ────────────────────────────────────────────────────────────────────────────
// Dormancy
// ────────────────────────────────────────────────────────────────────────────

describe("pollDelegateJob — dormant when delegation is disabled", () => {
  test("returns 'disabled' and makes NO network call when flag is unset", async () => {
    delete process.env.DELEGATE_OUTBOUND_ENABLED;
    delete process.env.OPENHANDS_ENDPOINT;
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("must not reach network when disabled");
    }) as typeof fetch;
    const r = await pollDelegateJob("job_123");
    expect(r.status).toBe("disabled");
    expect(fetchCalled).toBe(false);
  });

  test("returns 'disabled' when flag is set but endpoint is missing", async () => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    delete process.env.OPENHANDS_ENDPOINT;
    const r = await pollDelegateJob("job_123");
    expect(r.status).toBe("disabled");
  });

  test("returns 'disabled' when flag is '0' and endpoint is set", async () => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "0";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
    const r = await pollDelegateJob("job_123");
    expect(r.status).toBe("disabled");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Terminal statuses
// ────────────────────────────────────────────────────────────────────────────

describe("pollDelegateJob — terminal status mapping (enabled)", () => {
  beforeEach(() => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
  });

  test("maps 'done' status with result text (last_agent_message)", async () => {
    mockFetch({ conversation_id: "j1", status: "done", last_agent_message: "PR created at #42" });
    const r = await pollDelegateJob("j1");
    expect(r.status).toBe("done");
    expect(r.result).toBe("PR created at #42");
    expect(r.error).toBeUndefined();
  });

  test("maps 'completed' to 'done'", async () => {
    mockFetch({ task_id: "j1", status: "completed" });
    const r = await pollDelegateJob("j1");
    expect(r.status).toBe("done");
  });

  test("maps 'failed' status with error text", async () => {
    mockFetch({ task_id: "j1", status: "failed", error: "timeout after 1h" });
    const r = await pollDelegateJob("j1");
    expect(r.status).toBe("failed");
    expect(r.error).toBe("timeout after 1h");
    expect(r.result).toBeUndefined();
  });

  test("maps 'cancelled' to 'failed'", async () => {
    mockFetch({ task_id: "j1", status: "cancelled" });
    const r = await pollDelegateJob("j1");
    expect(r.status).toBe("failed");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// In-progress statuses
// ────────────────────────────────────────────────────────────────────────────

describe("pollDelegateJob — in-progress statuses", () => {
  beforeEach(() => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
  });

  test.each(["queued", "running", "pending", "accepted", "started"])(
    "maps '%s' to 'running'",
    async (status: string) => {
      mockFetch({ task_id: "j1", status });
      const r: DelegatePollResult = await pollDelegateJob("j1");
      expect(r.status).toBe("running");
    },
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Fail-safe transport
// ────────────────────────────────────────────────────────────────────────────

describe("pollDelegateJob — fail-safe transport (enabled)", () => {
  beforeEach(() => {
    process.env.DELEGATE_OUTBOUND_ENABLED = "1";
    process.env.OPENHANDS_ENDPOINT = "https://oh.internal";
  });

  test("returns 'unknown' on transport error, never throws", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const r = await pollDelegateJob("j1");
    expect(r.status).toBe("unknown");
    expect(r.error).toBeTruthy();
  });

  test("returns 'unknown' on non-2xx response", async () => {
    globalThis.fetch = (async () => new Response("not found", { status: 404 })) as typeof fetch;
    const r = await pollDelegateJob("j1");
    expect(r.status).toBe("unknown");
    expect(r.error).toContain("404");
  });

  test("returns 'unknown' on malformed JSON, never throws", async () => {
    globalThis.fetch = (async () => new Response("not-json", { status: 200 })) as typeof fetch;
    const r = await pollDelegateJob("j1");
    expect(r.status).toBe("unknown");
  });

  test("returns 'unknown' for an unrecognised status string", async () => {
    mockFetch({ task_id: "j1", status: "in_review_by_admin" });
    const r = await pollDelegateJob("j1");
    expect(r.status).toBe("unknown");
  });
});
