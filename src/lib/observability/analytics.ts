/**
 * AFD-04: Analytics façade (PostHog EU when keyed, no-op otherwise).
 *
 * Single public surface so call sites never import a vendor SDK directly. Swapping
 * vendor is one file edit. EU residency by default. No PII payloads — caller scrubs,
 * façade re-scrubs as a belt-and-braces measure.
 */
import { observabilityGateOn, readObservabilityConfig, scrubPII } from "./config";

export type TrackEvent =
  | "decision_made"
  | "decision_superseded"
  | "decision_shipped"
  | "mission_started"
  | "mission_completed"
  | "agent_run_started"
  | "agent_run_completed"
  | "agent_run_failed"
  | "connection_connected"
  | "connection_disconnected"
  | "signal_ingested"
  | "ai_kill_switch_flipped"
  | "budget_exceeded";

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

/** Fire-and-forget. Never throws. Returns true if a vendor call was actually made. */
export async function track(
  event: TrackEvent,
  distinctId: string,
  props?: TrackProps,
): Promise<boolean> {
  const cfg = readObservabilityConfig();
  if (!cfg.posthog.enabled) return false;
  if (!(await observabilityGateOn())) return false;

  const payload = {
    api_key: cfg.posthog.apiKey,
    event,
    distinct_id: distinctId,
    properties: { ...scrubPII(props as Record<string, unknown>), $lib: "cadence-observability-facade" },
    timestamp: new Date().toISOString(),
  };

  try {
    // Server-side capture endpoint; works on Cloudflare Workers.
    await fetch(`${cfg.posthog.host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    // Analytics MUST never break user flows. Swallow.
    return false;
  }
}

/** Identify is a no-op when disabled; uses anon-safe trait subset only. */
export async function identify(
  distinctId: string,
  traits?: TrackProps,
): Promise<boolean> {
  const cfg = readObservabilityConfig();
  if (!cfg.posthog.enabled) return false;
  if (!(await observabilityGateOn())) return false;
  try {
    await fetch(`${cfg.posthog.host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: cfg.posthog.apiKey,
        event: "$identify",
        distinct_id: distinctId,
        properties: { $set: scrubPII(traits as Record<string, unknown>) ?? {} },
      }),
    });
    return true;
  } catch {
    return false;
  }
}