import { describe, it, expect } from "bun:test";
import { assembleHealth } from "./app-health";

const NOW = "2026-06-20T00:00:00.000Z";

describe("assembleHealth", () => {
  it("returns status ok + HTTP 200 when every dependency is ok", () => {
    const { body, httpStatus } = assembleHealth({ database: "ok" }, NOW);
    expect(httpStatus).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({ worker: "ok", database: "ok" });
  });

  it("returns status degraded + HTTP 503 when the database is down", () => {
    const { body, httpStatus } = assembleHealth({ database: "error" }, NOW);
    expect(httpStatus).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("error");
  });

  it("always reports the worker as ok (reaching this code means it is serving)", () => {
    expect(assembleHealth({ database: "ok" }, NOW).body.checks.worker).toBe("ok");
    expect(assembleHealth({ database: "error" }, NOW).body.checks.worker).toBe("ok");
  });

  it("echoes the injected timestamp and a stable service id, and leaks nothing else", () => {
    const { body } = assembleHealth({ database: "error" }, NOW);
    expect(body.time).toBe(NOW);
    expect(body.service).toBe("cadence");
    // No message/detail/error fields that could leak internals on the public endpoint.
    expect(Object.keys(body).sort()).toEqual(["checks", "service", "status", "time"]);
  });

  it("is pure: same inputs give the same output", () => {
    expect(assembleHealth({ database: "ok" }, NOW)).toEqual(
      assembleHealth({ database: "ok" }, NOW),
    );
  });
});
