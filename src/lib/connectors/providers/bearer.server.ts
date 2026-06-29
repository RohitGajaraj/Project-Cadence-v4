// SF-CONNECTORS (Signal Fabric Phase 2) — the shared "extract the raw token" helper
// for the inside-out connector fleet (server-only).
//
// Every pull connector resolves credentials through resolveProviderAuth, which returns
// a ResolvedAuth discriminated union. Only the `token` (vaulted) and `env` (legacy
// fallback) kinds carry a directly-usable bearer string; `gateway` and `github_app`
// proxy the call elsewhere, so they return null here. Each adapter decides how to USE
// the token (Bearer header, Basic auth, request-body apiKey, …) — this only unwraps it,
// so the same unwrap logic isn't re-implemented (or subtly mis-implemented) per provider.
// Mirrors intercomBearer (intercom.server.ts), generalized for the fleet.

import type { ResolvedAuth } from "../resolve.server";

/** The directly-callable token for env/vault credentials; null for gateway/github_app. */
export function tokenBearer(auth: ResolvedAuth | null): string | null {
  if (!auth) return null;
  if (auth.kind === "token" || auth.kind === "env") return auth.token;
  return null;
}
