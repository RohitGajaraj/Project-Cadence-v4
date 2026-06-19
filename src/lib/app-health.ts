/**
 * App-level health (APP-HEALTH, considerations.md SRE lens P0).
 *
 * The platform's own liveness/readiness signal for external uptime monitors and load
 * balancers - distinct from `health.functions.ts`, which checks migration DRIFT for the app's
 * own flows. This module is the PURE assembly: given the dependency-check results it returns the
 * response body + the right HTTP status (200 healthy / 503 degraded), so a monitor reacts on the
 * status code without parsing the body. Pure (the timestamp is injected), so it is fully
 * unit-tested in app-health.test.ts; the live DB probe lives in the route.
 *
 * Deliberately leaks NOTHING: only `ok`/`error` per-check states, never an error message,
 * connection string, or stack trace (the endpoint is public + unauthenticated).
 */

export type CheckState = "ok" | "error";

export type HealthChecks = {
  /** Whether the database answered a cheap probe. */
  database: CheckState;
};

export type HealthBody = {
  status: "ok" | "degraded";
  service: "cadence";
  /** ISO timestamp, injected by the caller so this stays pure. */
  time: string;
  checks: {
    /** Implicitly ok: if this code ran, the worker is alive and serving. */
    worker: "ok";
    database: CheckState;
  };
};

/**
 * Assemble the health response. Overall status is `degraded` (HTTP 503) if ANY dependency check
 * is not `ok`, else `ok` (HTTP 200). Worker liveness is implicit - reaching this code means the
 * worker is serving. Pure + deterministic.
 */
export function assembleHealth(
  checks: HealthChecks,
  nowIso: string,
): { body: HealthBody; httpStatus: number } {
  const degraded = checks.database !== "ok";
  return {
    body: {
      status: degraded ? "degraded" : "ok",
      service: "cadence",
      time: nowIso,
      checks: { worker: "ok", database: checks.database },
    },
    httpStatus: degraded ? 503 : 200,
  };
}
