/**
 * AFD-05: Error capture façade (Sentry EU when keyed, no-op otherwise).
 *
 * Uses Sentry's "envelope" HTTP API directly so we don't pull a heavyweight SDK
 * into the Cloudflare Worker bundle (TanStack Start ships to Workers). Vendor
 * swap = replace this file.
 */
import { observabilityGateOn, readObservabilityConfig } from "./config";

export type ErrorContext = {
  user_id?: string;
  workspace_id?: string;
  surface?: string;
  failure_kind?: string;
  extras?: Record<string, unknown>;
  tags?: Record<string, string>;
};

/** Capture an exception. Fire-and-forget. Never throws. */
export async function captureError(err: unknown, ctx: ErrorContext = {}): Promise<boolean> {
  const cfg = readObservabilityConfig();
  if (!cfg.sentry.enabled) return false;
  if (!(await observabilityGateOn())) return false;

  // DSN format: https://<key>@<host>/<project_id>
  const dsnMatch = cfg.sentry.dsn!.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!dsnMatch) return false;
  const [, publicKey, host, projectId] = dsnMatch;

  const eventId = crypto.randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  const errObj = err instanceof Error ? err : new Error(String(err));

  const event = {
    event_id: eventId,
    timestamp: now,
    platform: "javascript",
    environment: cfg.sentry.environment,
    release: cfg.sentry.release,
    level: "error",
    user: ctx.user_id ? { id: ctx.user_id } : undefined,
    tags: {
      surface: ctx.surface ?? "unknown",
      failure_kind: ctx.failure_kind ?? "unknown",
      workspace_id: ctx.workspace_id ?? "n/a",
      ...(ctx.tags ?? {}),
    },
    extra: ctx.extras ?? {},
    exception: {
      values: [
        {
          type: errObj.name,
          value: errObj.message,
          stacktrace: errObj.stack ? { frames: parseFrames(errObj.stack) } : undefined,
        },
      ],
    },
  };

  const envelope =
    JSON.stringify({ event_id: eventId, sent_at: now, dsn: cfg.sentry.dsn }) +
    "\n" +
    JSON.stringify({ type: "event" }) +
    "\n" +
    JSON.stringify(event);

  try {
    await fetch(`https://${host}/api/${projectId}/envelope/`, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=cadence-observability-facade/1.0`,
      },
      body: envelope,
    });
    return true;
  } catch {
    return false;
  }
}

function parseFrames(stack: string) {
  return stack
    .split("\n")
    .slice(1, 30)
    .map((line) => ({ filename: line.trim() }));
}