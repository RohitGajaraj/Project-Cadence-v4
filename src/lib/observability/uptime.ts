/**
 * AFD-08: Heartbeat façade (Better Stack when keyed, no-op otherwise).
 *
 * Each cron/background job pings a per-job heartbeat URL. Better Stack alerts the
 * founder if the heartbeat is missed by N minutes. Vendor swap = replace this file.
 */
import { observabilityGateOn, readObservabilityConfig } from "./config";

/**
 * Ping a heartbeat slug. The full URL is `${BETTER_STACK_HEARTBEAT_URL}/${slug}`
 * so the founder can manage all slugs in one env var.
 */
export async function heartbeat(slug: string, kind: "start" | "ok" | "fail" = "ok"): Promise<boolean> {
  const cfg = readObservabilityConfig();
  if (!cfg.betterStack.enabled) return false;
  if (!(await observabilityGateOn())) return false;

  const suffix = kind === "fail" ? "/fail" : kind === "start" ? "/start" : "";
  const url = `${cfg.betterStack.heartbeatBase}/${encodeURIComponent(slug)}${suffix}`;

  try {
    await fetch(url, { method: "GET" });
    return true;
  } catch {
    return false;
  }
}