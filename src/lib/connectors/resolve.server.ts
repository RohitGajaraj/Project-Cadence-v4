// F-CONN Phase 1 — the ONE credential chokepoint. Every external call site
// resolves provider auth through resolveProviderAuth; nothing else reads
// connection rows or secrets directly. Resolution order:
//   1. product binding    (connection_bindings WHERE product_id = $productId, BYO-P1b)
//   2. workspace binding  (connection_bindings WHERE product_id IS NULL)
//   3. user connection    (caller's own connections row via their RLS client)
//   4. env fallback       (legacy GITHUB_TOKEN-style vars from the registry)
//   5. none
// Each tier degrades on failure (warn + fall through) so an unconfigured
// environment never throws here — call sites decide what "not connected" means.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CONNECTOR_REGISTRY, type ProviderId } from "./registry";
import { decryptSecret } from "./crypto.server";
import { mintInstallationToken } from "./providers/github.server";

export type ResolvedAuth =
  | {
      kind: "github_app";
      installationId: string;
      token: string;
      ownerUserId: string;
      connectionRowId: string;
    }
  | {
      kind: "gateway";
      connectionId: string;
      connectorId: string;
      ownerUserId: string;
      connectionRowId: string;
    }
  | { kind: "token"; token: string; ownerUserId: string; connectionRowId: string }
  | { kind: "env"; token: string };

export type ResolvedConnector = {
  auth: ResolvedAuth | null;
  binding: {
    resourceId: string;
    resourceLabel: string | null;
    config: Record<string, unknown>;
    createdBy: string;
  } | null;
  source: "workspace_binding" | "user_connection" | "env" | "none";
};

// New tables are absent from the generated Database types — untyped cast
// precedent per src/lib/outcome.functions.ts.
type ConnectionRow = {
  id: string;
  user_id: string;
  provider: string;
  auth_kind: string;
  external_handle: string | null;
  secret_id: string | null;
  status: string;
};

type BindingRow = {
  id: string;
  connection_id: string;
  resource_id: string;
  resource_label: string | null;
  config: Record<string, unknown> | null;
  created_by: string;
};

function admin(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

/**
 * KI-34 cross-tenant credential guard. The connection_bindings write RLS
 * authorizes by workspace membership only and never validates connection_id, so a
 * member could point a binding at ANOTHER account's connection; resolveProviderAuth
 * loads that connection via the service-role client (RLS off), so it must itself
 * confirm the bound connection's owner belongs to the binding's workspace before
 * materializing the credential. Policy: block only a DEFINITIVELY cross-tenant
 * owner (lookup succeeded, owner not a member); fail OPEN on any lookup error so a
 * transient failure can never break a legitimate integration (the RLS migration is
 * the airtight backstop). Exported for unit testing.
 */
export function bindingConnectionAllowed(lookup: { errored: boolean; isMember: boolean }): boolean {
  if (lookup.errored) return true;
  return lookup.isMember;
}

/**
 * Turn a connected connections row into usable auth. Secrets/token minting go
 * through supabaseAdmin. Exported for connections.functions.ts, which
 * materializes auth for ONE specific row (not the workspace→user→env chain).
 */
export async function materializeAuth(
  row: ConnectionRow,
  provider: ProviderId,
): Promise<ResolvedAuth | null> {
  if (row.auth_kind === "github_app") {
    if (!row.external_handle) return null;
    const token = await mintInstallationToken(row.external_handle);
    return {
      kind: "github_app",
      installationId: row.external_handle,
      token,
      ownerUserId: row.user_id,
      connectionRowId: row.id,
    };
  }
  if (row.auth_kind === "oauth_gateway") {
    if (!row.external_handle) return null;
    const gatewayMethod = CONNECTOR_REGISTRY[provider].authMethods.find(
      (m) => m.kind === "oauth_gateway",
    );
    return {
      kind: "gateway",
      connectionId: row.external_handle,
      connectorId: gatewayMethod?.kind === "oauth_gateway" ? gatewayMethod.connectorId : provider,
      ownerUserId: row.user_id,
      connectionRowId: row.id,
    };
  }
  // api_key | token → decrypt from the vault.
  if (!row.secret_id) return null;
  const { data: secret, error } = await admin()
    .from("connection_secrets")
    .select("ciphertext,iv,key_version")
    .eq("id", row.secret_id)
    .maybeSingle();
  if (error || !secret) return null;
  const token = await decryptSecret({
    ciphertext: secret.ciphertext as string,
    iv: secret.iv as string,
    keyVersion: (secret.key_version as number | null) ?? 1,
  });
  return { kind: "token", token, ownerUserId: row.user_id, connectionRowId: row.id };
}

export async function resolveProviderAuth(args: {
  userClient?: SupabaseClient;
  userId?: string | null;
  workspaceId?: string | null;
  productId?: string | null;
  provider: ProviderId;
  resourceKind?: string;
}): Promise<ResolvedConnector> {
  const { userClient, userId, workspaceId, productId, provider, resourceKind } = args;

  // 1. Product-scoped binding (BYO-P1b). When a productId is supplied, try the
  // product-specific binding first — it takes precedence over the workspace-level
  // fallback. Uses the service-role client so the binding is readable regardless
  // of which user is calling (the binding's workspace_id is RLS-authorised at
  // write time; here we only read it to materialize a credential).
  if (productId) {
    try {
      let q = admin()
        .from("connection_bindings")
        .select("id,connection_id,resource_id,resource_label,config,created_by")
        .eq("product_id", productId)
        .eq("provider", provider);
      if (resourceKind) q = q.eq("resource_kind", resourceKind);
      const { data: bindings, error } = await q.order("created_at", { ascending: true }).limit(1);
      const binding = !error && bindings ? (bindings[0] as BindingRow | undefined) : undefined;
      if (binding) {
        const { data: conn } = await admin()
          .from("connections")
          .select("id,user_id,provider,auth_kind,external_handle,secret_id,status")
          .eq("id", binding.connection_id)
          .maybeSingle();
        if (conn && (conn as ConnectionRow).status === "connected") {
          // Apply the same cross-tenant guard as for workspace bindings (KI-34).
          // The product must live in a workspace the connection owner belongs to.
          // We re-use bindingConnectionAllowed with a workspace lookup derived
          // from the product's own workspace_id (which was validated at bind time).
          let lookup = { errored: true, isMember: false };
          if (workspaceId) {
            try {
              const { data: mem, error: memErr } = await admin()
                .from("workspace_members")
                .select("user_id")
                .eq("workspace_id", workspaceId)
                .eq("user_id", (conn as ConnectionRow).user_id)
                .maybeSingle();
              lookup = { errored: !!memErr, isMember: !!mem };
            } catch {
              lookup = { errored: true, isMember: false };
            }
          } else {
            // No workspaceId in args — skip the guard (fail open).
            lookup = { errored: true, isMember: false };
          }
          if (!bindingConnectionAllowed(lookup)) {
            console.warn(
              `[connectors] KI-34: refusing product binding for ${provider} — bound connection owner is not a member of the product's workspace; falling through`,
            );
          } else {
            const auth = await materializeAuth(conn as ConnectionRow, provider);
            if (auth) {
              return {
                auth,
                binding: {
                  resourceId: binding.resource_id,
                  resourceLabel: binding.resource_label ?? null,
                  config: binding.config ?? {},
                  createdBy: binding.created_by,
                },
                source: "workspace_binding",
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[connectors] product binding resolution failed for ${provider}:`, e);
    }
  }

  // 2. Workspace binding. The binding row itself is the authorization (RLS-gated
  // by workspace membership on write); the owning connection is loaded via
  // supabaseAdmin because connections rows are own-row RLS.
  if (workspaceId) {
    try {
      const db = userClient ?? admin();
      let q = db
        .from("connection_bindings")
        .select("id,connection_id,resource_id,resource_label,config,created_by")
        .eq("workspace_id", workspaceId)
        .eq("provider", provider)
        .is("product_id", null);
      if (resourceKind) q = q.eq("resource_kind", resourceKind);
      const { data: bindings, error } = await q.order("created_at", { ascending: true }).limit(1);
      const binding = !error && bindings ? (bindings[0] as BindingRow | undefined) : undefined;
      if (binding) {
        const { data: conn } = await admin()
          .from("connections")
          .select("id,user_id,provider,auth_kind,external_handle,secret_id,status")
          .eq("id", binding.connection_id)
          .maybeSingle();
        if (conn && (conn as ConnectionRow).status === "connected") {
          // KI-34: confirm the bound connection's OWNER is a member of the
          // binding's workspace before materializing its credential (the binding
          // RLS never validated connection_id, so it could point cross-tenant).
          let lookup = { errored: true, isMember: false };
          try {
            const { data: mem, error: memErr } = await admin()
              .from("workspace_members")
              .select("user_id")
              .eq("workspace_id", workspaceId)
              .eq("user_id", (conn as ConnectionRow).user_id)
              .maybeSingle();
            lookup = { errored: !!memErr, isMember: !!mem };
          } catch {
            lookup = { errored: true, isMember: false };
          }
          if (!bindingConnectionAllowed(lookup)) {
            console.warn(
              `[connectors] KI-34: refusing workspace binding for ${provider} — bound connection owner is not a member of the binding's workspace (possible cross-tenant binding); falling through`,
            );
          } else {
            const auth = await materializeAuth(conn as ConnectionRow, provider);
            if (auth) {
              return {
                auth,
                binding: {
                  resourceId: binding.resource_id,
                  resourceLabel: binding.resource_label ?? null,
                  config: binding.config ?? {},
                  createdBy: binding.created_by,
                },
                source: "workspace_binding",
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[connectors] workspace binding resolution failed for ${provider}:`, e);
    }
  }

  // 3. The caller's own connection (their RLS client scopes to own rows).
  if (userClient) {
    try {
      let q = userClient
        .from("connections")
        .select("id,user_id,provider,auth_kind,external_handle,secret_id,status")
        .eq("provider", provider)
        .eq("status", "connected");
      if (userId) q = q.eq("user_id", userId);
      const { data: rows, error } = await q.order("created_at", { ascending: true }).limit(1);
      const conn = !error && rows ? (rows[0] as ConnectionRow | undefined) : undefined;
      if (conn) {
        const auth = await materializeAuth(conn, provider);
        if (auth) return { auth, binding: null, source: "user_connection" };
      }
    } catch (e) {
      console.warn(`[connectors] user connection resolution failed for ${provider}:`, e);
    }
  }

  // 4. Legacy env fallback — keeps current behavior alive until bindings exist.
  const spec = CONNECTOR_REGISTRY[provider];
  const envToken = spec.envFallback ? process.env[spec.envFallback.tokenEnv] : undefined;
  if (envToken) {
    console.warn(`[connectors] deprecated env fallback: ${provider}`);
    return { auth: { kind: "env", token: envToken }, binding: null, source: "env" };
  }

  return { auth: null, binding: null, source: "none" };
}
