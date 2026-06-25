/**
 * AFD-03: Env wiring + dormant-by-design configuration for the observability façade.
 *
 * Every vendor SDK call in `src/lib/observability/*` reads from here. If the env var is
 * absent OR `observability_enabled()` is false in app_settings, the façade no-ops. This
 * mirrors the credit-engine dormant pattern: ships keyless, gated OFF; founder flips it on.
 *
 * Plan: docs/planning/analytics-and-failure-detection-plan.md
 * Spec: docs/features/observability-facade.md
 */

export type ObservabilityConfig = {
  posthog: {
    apiKey: string | null;
    host: string; // EU residency default
    enabled: boolean;
  };
  sentry: {
    dsn: string | null;
    environment: string;
    release: string | null;
    sampleRate: number;
    enabled: boolean;
  };
  betterStack: {
    heartbeatBase: string | null; // e.g. https://uptime.betterstack.com/api/v1/heartbeat
    enabled: boolean;
  };
};

/**
 * Read config once per request. `process.env` is only populated inside server-fn / route
 * handlers, so this MUST NOT be invoked at module-scope of a shared file.
 */
export function readObservabilityConfig(): ObservabilityConfig {
  const env = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;
  const posthogKey = env.POSTHOG_API_KEY?.trim() || null;
  const sentryDsn = env.SENTRY_DSN?.trim() || null;
  const heartbeatBase = env.BETTER_STACK_HEARTBEAT_URL?.trim() || null;

  return {
    posthog: {
      apiKey: posthogKey,
      host: env.POSTHOG_HOST?.trim() || "https://eu.i.posthog.com",
      enabled: !!posthogKey,
    },
    sentry: {
      dsn: sentryDsn,
      environment: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || "production",
      release: env.SENTRY_RELEASE?.trim() || env.CF_VERSION_METADATA_ID?.trim() || null,
      sampleRate: Number(env.SENTRY_SAMPLE_RATE ?? "1.0"),
      enabled: !!sentryDsn,
    },
    betterStack: {
      heartbeatBase,
      enabled: !!heartbeatBase,
    },
  };
}

/**
 * Gate read — mirrors credits_enabled(). Hits app_settings via the admin client. Cached
 * for a short window inside one request to avoid duplicate round-trips.
 *
 * Returns false if the read fails, the gate is missing, or the gate is explicitly false.
 * Always pair this with `readObservabilityConfig()` env presence checks at call sites.
 */
let _gateCache: { v: boolean; until: number } | null = null;
const GATE_TTL_MS = 30_000;

export async function observabilityGateOn(): Promise<boolean> {
  if (_gateCache && _gateCache.until > Date.now()) return _gateCache.v;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("observability_enabled");
    if (error) {
      _gateCache = { v: false, until: Date.now() + GATE_TTL_MS };
      return false;
    }
    const v = Boolean(data);
    _gateCache = { v, until: Date.now() + GATE_TTL_MS };
    return v;
  } catch {
    return false;
  }
}

/** Strip obvious PII before sending to a vendor. Caller responsibility too. */
export function scrubPII<T extends Record<string, unknown>>(props: T | undefined): T | undefined {
  if (!props) return props;
  const banned = new Set(["email", "phone", "name", "full_name", "first_name", "last_name", "password"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (banned.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out as T;
}