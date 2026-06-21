/**
 * BLD-04: server-only OpenHands adapter + resolver for the `DelegateProvider` seam.
 *
 * Holds the parts that read env + touch the network: the dormancy flag, the
 * OpenHands HTTP adapter, the resolver, and the `submitDelegation` entry point the
 * (future, registry-gated) `delegate.openhands` tool will call. Never imported by
 * client code (`.server.ts`).
 *
 * Dormancy is enforced structurally: the adapter reports `available === false`
 * unless BOTH the `DELEGATE_OUTBOUND_ENABLED` flag and an `OPENHANDS_ENDPOINT` are
 * set, and the resolver falls back to the `nullDelegateProvider` floor whenever no
 * available adapter matches. So with nothing configured (the default), every
 * delegation attempt returns a clear "disabled" verdict and NO network call is
 * made. The HTTP path is also fail-safe: any transport error returns a refusal
 * verdict, never throws into the caller.
 */

import {
  buildOpenHandsRequest,
  mapOpenHandsResponse,
  nullDelegateProvider,
  type DelegateProvider,
  type DelegateRequest,
  type DelegateVerdict,
} from "./provider";

/** Dormant by default. On only when the founder sets the flag to 1/true. */
export function delegateEnabled(): boolean {
  const v = process.env.DELEGATE_OUTBOUND_ENABLED;
  return v === "1" || v === "true";
}

/** Bound the outbound call so a hung external agent can't stall the build path. */
const OPENHANDS_TIMEOUT_MS = 30_000;

function refusal(reason: string): DelegateVerdict {
  return { provider: "openhands", accepted: false, externalJobId: null, reason };
}

/**
 * The OpenHands self-host adapter. `available` is a getter (re-evaluated each
 * access) so flipping the env at runtime is honored without a reload. `submit`
 * defends the dormancy invariant again before any network call, builds the bounded
 * request, posts it with a timeout, and maps the response, fail-safe throughout.
 */
export const openHandsProvider: DelegateProvider = {
  id: "openhands",
  get available(): boolean {
    return delegateEnabled() && !!process.env.OPENHANDS_ENDPOINT;
  },
  async submit(req: DelegateRequest): Promise<DelegateVerdict> {
    if (!this.available) {
      return refusal(
        "delegate-out is disabled (no DELEGATE_OUTBOUND_ENABLED / endpoint configured)",
      );
    }
    const endpoint = process.env.OPENHANDS_ENDPOINT as string;
    const apiKey = process.env.OPENHANDS_API_KEY;
    try {
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/v1/tasks`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(buildOpenHandsRequest(req)),
        signal: AbortSignal.timeout(OPENHANDS_TIMEOUT_MS),
      });
      if (!res.ok) return refusal(`openhands http ${res.status}`);
      const json = (await res.json().catch(() => null)) as Parameters<
        typeof mapOpenHandsResponse
      >[0];
      return mapOpenHandsResponse(json);
    } catch (err) {
      return refusal(`openhands unreachable (${err instanceof Error ? err.name : "error"})`);
    }
  },
};

/** Backends with a live adapter today (each still gated by its own `available`). */
const WIRED_DELEGATE_PROVIDERS: readonly DelegateProvider[] = [openHandsProvider];

/**
 * Resolve the active `DelegateProvider`. A `preferred` id with a wired + available
 * adapter wins; otherwise the dormant {@link nullDelegateProvider} floor is
 * returned (so disabled/unknown selections refuse cleanly rather than failing or
 * routing to an unconfigured backend). A new adapter is added to
 * {@link WIRED_DELEGATE_PROVIDERS} and the resolver picks it up with no call-site
 * change, the same shape as `resolveExecProvider`.
 */
export function resolveDelegateProvider(preferred?: string | null): DelegateProvider {
  const match = preferred
    ? WIRED_DELEGATE_PROVIDERS.find((p) => p.id === preferred && p.available)
    : WIRED_DELEGATE_PROVIDERS.find((p) => p.available);
  return match ?? nullDelegateProvider;
}

/**
 * The single entry point a delegate-out tool calls: resolve the active provider and
 * submit the task. When delegation is disabled (the default) this resolves to the
 * floor and returns an `accepted: false` verdict with no network call. The caller
 * (the future governed tool) is responsible for the human-approval gate in front of
 * this, delegation is a high-blast-radius external action.
 */
export async function submitDelegation(
  req: DelegateRequest,
  preferred?: string | null,
): Promise<DelegateVerdict> {
  return resolveDelegateProvider(preferred).submit(req);
}
