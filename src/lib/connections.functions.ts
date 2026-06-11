import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { CONNECTOR_REGISTRY, type ProviderId } from "@/lib/connectors/registry";
import { encryptSecret } from "@/lib/connectors/crypto.server";
import { materializeAuth, type ResolvedAuth } from "@/lib/connectors/resolve.server";
import { getProviderAdapter } from "@/lib/connectors/providers/index.server";
import { makeConnectState } from "@/lib/connectors/providers/github.server";

// F-CONN Phase 1 — account-level connections + workspace-level bindings.
// connections: own-row RLS (the caller only ever sees their own rows).
// connection_bindings: membership RLS (is_workspace_member) — any workspace
// member can read/bind, attribution via created_by + owner of the connection.
// connection_secrets: service-role only — always touched via supabaseAdmin.
//
// New tables are not yet in the generated Database types, so handlers use the
// untyped-client cast precedent (see outcome.functions.ts / ingest.functions.ts).
//
// Cross-module contracts consumed here (built alongside this file):
// - crypto.server: encryptSecret(plain) -> { ciphertext, iv, keyVersion }.
// - resolve.server: materializeAuth(row, provider) -> ResolvedAuth | null
//   (decrypts vault secrets / mints installation tokens via supabaseAdmin).
// - providers index: getProviderAdapter(provider) -> adapter with
//   validate(auth: ResolvedAuth) -> { ok, detail?, accountLabel? } and
//   listResources?(auth: ResolvedAuth, kind, { q? }) -> { id, label }[].
// - github.server: makeConnectState(userId) -> signed state for the GitHub App
//   install URL (CSRF; consumed by the public callback route).

export type ConnectionRow = {
  id: string;
  user_id: string;
  provider: ProviderId;
  auth_kind: "github_app" | "oauth_gateway" | "api_key" | "token";
  external_handle: string | null;
  secret_id: string | null;
  account_label: string | null;
  account_email: string | null;
  status: "connected" | "error" | "disconnected";
  status_detail: string | null;
  scopes: string[];
  // Json (not unknown) so server-fn return types stay serializable.
  metadata: Record<string, Json>;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BindingRow = {
  id: string;
  connection_id: string;
  workspace_id: string;
  product_id: string | null;
  provider: ProviderId;
  resource_kind: string;
  resource_id: string;
  resource_label: string | null;
  // Json (not unknown) so server-fn return types stay serializable.
  config: Record<string, Json>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceBindingRow = BindingRow & {
  account_label: string | null;
  connection_status: ConnectionRow["status"];
  owner_display: string | null;
};

export type ProviderAvailability = Record<
  ProviderId,
  { githubAppConfigured?: boolean; gatewayConfigured?: boolean }
>;

const CONNECTION_COLUMNS =
  "id,user_id,provider,auth_kind,external_handle,secret_id,account_label,account_email,status,status_detail,scopes,metadata,last_verified_at,created_at,updated_at";

const BINDING_COLUMNS =
  "id,connection_id,workspace_id,product_id,provider,resource_kind,resource_id,resource_label,config,created_by,created_at,updated_at";

const PROVIDER_IDS = Object.keys(CONNECTOR_REGISTRY) as [ProviderId, ...ProviderId[]];

/** Load a connection the caller owns (own-row RLS enforces ownership). */
async function loadOwnConnection(db: SupabaseClient, id: string): Promise<ConnectionRow> {
  const { data, error } = await db
    .from("connections")
    .select(CONNECTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Connection not found.");
  return data as unknown as ConnectionRow;
}

/**
 * Materialize adapter auth for ONE specific connection row (not the
 * workspace→user→env chain — that is resolveProviderAuth's job). Delegates to
 * resolve.server's materializeAuth: secrets are read via the service-role
 * client and decrypted in-process; never returned to the caller.
 */
async function materializeAdapterAuth(row: ConnectionRow): Promise<ResolvedAuth | null> {
  return materializeAuth(row, row.provider);
}

function deriveProviderAvailability(): ProviderAvailability {
  const availability = {} as ProviderAvailability;
  for (const spec of Object.values(CONNECTOR_REGISTRY)) {
    const entry: { githubAppConfigured?: boolean; gatewayConfigured?: boolean } = {};
    for (const method of spec.authMethods) {
      if (method.kind === "github_app") {
        entry.githubAppConfigured = !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_SLUG);
      }
      if (method.kind === "oauth_gateway") {
        entry.gatewayConfigured = !!process.env[method.clientIdEnv];
      }
    }
    availability[spec.id] = entry;
  }
  return availability;
}

/** The caller's account-level connections + which providers are configurable today. */
export const listConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data, error } = await db
      .from("connections")
      .select(CONNECTION_COLUMNS)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      connections: (data ?? []) as unknown as ConnectionRow[],
      providerAvailability: deriveProviderAvailability(),
    };
  });

/** Kick off the GitHub App install flow — returns the install URL for a full redirect. */
export const startGithubAppConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const slug = process.env.GITHUB_APP_SLUG;
    if (!slug || !process.env.GITHUB_APP_ID) {
      throw new Error("GitHub App setup pending — admin must configure the app credentials.");
    }
    const state = await makeConnectState(context.userId);
    return {
      installUrl: `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`,
    };
  });

/** Re-run the provider adapter's validate and persist status/last_verified_at/status_detail. */
export const verifyConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const row = await loadOwnConnection(db, data.id);
    let ok = false;
    let detail: string | null = null;
    const adapter = getProviderAdapter(row.provider);
    if (!adapter) {
      detail = "No adapter registered for this provider yet.";
    } else {
      try {
        const auth = await materializeAdapterAuth(row);
        if (!auth) {
          detail = "No credential stored for this connection — reconnect it.";
        } else {
          const result = await adapter.validate(auth);
          ok = result.ok;
          detail = result.detail ?? null;
        }
      } catch (e) {
        ok = false;
        detail = e instanceof Error ? e.message : String(e);
      }
    }
    const now = new Date().toISOString();
    const { data: updated, error } = await db
      .from("connections")
      .update({
        status: ok ? "connected" : "error",
        status_detail: detail,
        last_verified_at: now,
        updated_at: now,
      })
      .eq("id", row.id)
      .select(CONNECTION_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { ok, connection: updated as unknown as ConnectionRow };
  });

/**
 * Revoke the stored credential but keep the row (and its bindings, which render
 * as visibly-broken reconnectable chips). Secret rows are service-role only.
 */
export const disconnectConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const admin = supabaseAdmin as unknown as SupabaseClient;
    const row = await loadOwnConnection(db, data.id);
    if (row.secret_id) {
      const { error } = await admin.from("connection_secrets").delete().eq("id", row.secret_id);
      if (error) throw new Error(error.message);
    }
    const { error } = await db
      .from("connections")
      .update({
        status: "disconnected",
        status_detail: null,
        secret_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hard delete — the connection_bindings FK cascade removes every binding with it. */
export const deleteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const admin = supabaseAdmin as unknown as SupabaseClient;
    const row = await loadOwnConnection(db, data.id);
    if (row.secret_id) {
      const { error } = await admin.from("connection_secrets").delete().eq("id", row.secret_id);
      if (error) throw new Error(error.message);
    }
    const { error } = await db.from("connections").delete().eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Validate an API key with the provider adapter, vault it, create the connection. */
export const connectWithApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        provider: z.enum(PROVIDER_IDS),
        apiKey: z.string().min(8).max(4000),
        label: z.string().min(1).max(80).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const admin = supabaseAdmin as unknown as SupabaseClient;
    const spec = CONNECTOR_REGISTRY[data.provider];
    if (!spec.authMethods.some((m) => m.kind === "api_key")) {
      throw new Error(`${spec.label} does not support API-key connect.`);
    }
    let accountLabel: string | null = data.label ?? null;
    const adapter = getProviderAdapter(data.provider);
    if (!adapter) throw new Error("No adapter registered for this provider yet.");
    // Bare-token ResolvedAuth shape — no connection row exists yet.
    const result = await adapter.validate({ kind: "env", token: data.apiKey });
    if (!result.ok) throw new Error(result.detail || "API key validation failed.");
    accountLabel = accountLabel ?? result.accountLabel ?? null;

    const encrypted = await encryptSecret(data.apiKey);
    const { data: secretRow, error: secretError } = await admin
      .from("connection_secrets")
      .insert({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        key_version: encrypted.keyVersion ?? 1,
      })
      .select("id")
      .single();
    if (secretError) throw new Error(secretError.message);

    const now = new Date().toISOString();
    const { data: connection, error: connError } = await db
      .from("connections")
      .insert({
        user_id: context.userId,
        provider: data.provider,
        auth_kind: "api_key",
        secret_id: secretRow.id as string,
        account_label: accountLabel,
        status: "connected",
        last_verified_at: now,
      })
      .select(CONNECTION_COLUMNS)
      .single();
    if (connError) {
      // Never leave an orphaned ciphertext row behind.
      await admin.from("connection_secrets").delete().eq("id", secretRow.id);
      throw new Error(connError.message);
    }
    return { connection: connection as unknown as ConnectionRow };
  });

/**
 * Resources bindable from ONE connection (owner-only: the own-row RLS read
 * is the authorization). Resolves auth for that connection — not the chain —
 * then asks the provider adapter.
 */
export const listBindableResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        connectionId: z.string().uuid(),
        resourceKind: z.string().min(1).max(60),
        q: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const row = await loadOwnConnection(db, data.connectionId);
    const adapter = getProviderAdapter(row.provider);
    if (!adapter) throw new Error("No adapter registered for this provider yet.");
    const auth = await materializeAdapterAuth(row);
    if (!auth) throw new Error("No credential stored for this connection — reconnect it.");
    const items = (await adapter.listResources?.(auth, data.resourceKind, { q: data.q })) ?? [];
    return { items };
  });

/**
 * Bindings visible to the caller (membership RLS scopes to their workspaces),
 * decorated with minimal connection fields + owner display for attribution.
 * Connection rows belong to other members, so the decoration reads go through
 * the admin client — only non-secret display fields are exposed.
 */
export const listWorkspaceBindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const admin = supabaseAdmin as unknown as SupabaseClient;
    const { data, error } = await db
      .from("connection_bindings")
      .select(BINDING_COLUMNS)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as BindingRow[];

    const connectionIds = [...new Set(rows.map((b) => b.connection_id))];
    const connectionMap = new Map<
      string,
      {
        provider: ProviderId;
        account_label: string | null;
        status: ConnectionRow["status"];
        user_id: string;
      }
    >();
    const ownerDisplayMap = new Map<string, string | null>();
    if (connectionIds.length > 0) {
      const { data: conns, error: connError } = await admin
        .from("connections")
        .select("id,provider,account_label,status,user_id")
        .in("id", connectionIds);
      if (connError) throw new Error(connError.message);
      for (const c of conns ?? []) {
        connectionMap.set(c.id as string, {
          provider: c.provider as ProviderId,
          account_label: (c.account_label as string | null) ?? null,
          status: c.status as ConnectionRow["status"],
          user_id: c.user_id as string,
        });
      }
      const ownerIds = [...new Set([...connectionMap.values()].map((c) => c.user_id))];
      if (ownerIds.length > 0) {
        const { data: profiles, error: profError } = await admin
          .from("profiles")
          .select("id,display_name,full_name")
          .in("id", ownerIds);
        if (profError) throw new Error(profError.message);
        for (const p of (profiles ?? []) as {
          id: string;
          display_name: string | null;
          full_name: string | null;
        }[]) {
          ownerDisplayMap.set(p.id, p.display_name ?? p.full_name ?? null);
        }
      }
    }

    const bindings: WorkspaceBindingRow[] = rows.map((b) => {
      const conn = connectionMap.get(b.connection_id);
      return {
        ...b,
        provider: conn?.provider ?? b.provider,
        account_label: conn?.account_label ?? null,
        connection_status: conn?.status ?? "disconnected",
        owner_display: conn ? (ownerDisplayMap.get(conn.user_id) ?? null) : null,
      };
    });
    return { bindings };
  });

/**
 * Bind a resource to the caller's workspace. Only the connection owner can
 * bind their connection. Insert-or-update on the workspace-level unique key
 * (workspace_id, provider, resource_kind) WHERE product_id IS NULL — done as
 * select-then-write because PostgREST upserts can't target partial indexes.
 */
export const upsertBinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        connectionId: z.string().uuid(),
        resourceKind: z.string().min(1).max(60),
        resourceId: z.string().min(1).max(300),
        resourceLabel: z.string().min(1).max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const connection = await loadOwnConnection(db, data.connectionId);
    if (connection.user_id !== context.userId) {
      throw new Error("Only the connection owner can bind it to a workspace.");
    }
    const { data: ws, error: wsError } = await context.supabase.rpc(
      "current_user_default_workspace",
    );
    if (wsError || !ws) throw new Error("No active workspace found for this account.");
    const workspaceId = ws as unknown as string;
    const now = new Date().toISOString();

    const { data: existing, error: existingError } = await db
      .from("connection_bindings")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("provider", connection.provider)
      .eq("resource_kind", data.resourceKind)
      .is("product_id", null)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { data: updated, error } = await db
        .from("connection_bindings")
        .update({
          connection_id: connection.id,
          resource_id: data.resourceId,
          resource_label: data.resourceLabel ?? null,
          created_by: context.userId,
          updated_at: now,
        })
        .eq("id", existing.id as string)
        .select(BINDING_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return { binding: updated as unknown as BindingRow };
    }

    const { data: inserted, error } = await db
      .from("connection_bindings")
      .insert({
        connection_id: connection.id,
        workspace_id: workspaceId,
        provider: connection.provider,
        resource_kind: data.resourceKind,
        resource_id: data.resourceId,
        resource_label: data.resourceLabel ?? null,
        created_by: context.userId,
      })
      .select(BINDING_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { binding: inserted as unknown as BindingRow };
  });

/** Unbind — membership RLS authorizes any workspace member to remove a binding. */
export const removeBinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { error } = await db.from("connection_bindings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
