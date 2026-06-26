// BYO-P1b: Product-level connection bindings.
//
// Parallel to the workspace-level binding functions in
// src/lib/connections.functions.ts, but scoped to a product (projects row).
// One binding per (product_id, provider, resource_kind) — same partial-unique
// index discipline as the workspace-scoped rows (which carry product_id IS NULL).
//
// Resolution order after this phase:
//   1. Product-scoped binding  (product_id match)
//   2. Workspace-scoped binding (existing fallback)
//   3. User connection
//   4. Env fallback
// The chokepoint (src/lib/connectors/resolve.server.ts) implements order 1-4.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { BindingRow, ConnectionRow, WorkspaceBindingRow } from "@/lib/connections.functions";
import type { ProviderId } from "@/lib/connectors/registry";

const BINDING_COLUMNS =
  "id,connection_id,workspace_id,product_id,provider,resource_kind,resource_id,resource_label,config,created_by,created_at,updated_at";

const CONNECTION_COLUMNS =
  "id,provider,account_label,status,user_id";

// Product row shape returned from the DB (minimal set needed for the UI).
export type ProductRow = {
  id: string;
  name: string;
  workspace_id: string;
};

export type ProductBindingRow = WorkspaceBindingRow & {
  product_id: string;
  product_name: string | null;
};

/**
 * List all product-scoped bindings for products the caller can see (workspace
 * membership RLS scopes the result). Decorates each row with connection info
 * (account label, status) and the product name — both fetched via the service-
 * role client because connection rows are own-row RLS.
 */
export const listProductBindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const admin = supabaseAdmin as unknown as SupabaseClient;

    // All product-scoped bindings visible to this user (RLS: is_workspace_member).
    const { data, error } = await db
      .from("connection_bindings")
      .select(BINDING_COLUMNS)
      .not("product_id", "is", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as BindingRow[];

    if (rows.length === 0) return { bindings: [] as ProductBindingRow[] };

    // Decorate with connection info.
    const connectionIds = [...new Set(rows.map((b) => b.connection_id))];
    const connectionMap = new Map<
      string,
      { provider: ProviderId; account_label: string | null; status: string; user_id: string }
    >();
    const ownerDisplayMap = new Map<string, string | null>();
    if (connectionIds.length > 0) {
      const { data: conns } = await admin
        .from("connections")
        .select(CONNECTION_COLUMNS)
        .in("id", connectionIds);
      for (const c of conns ?? []) {
        connectionMap.set(c.id as string, {
          provider: c.provider as ProviderId,
          account_label: (c.account_label as string | null) ?? null,
          status: c.status as string,
          user_id: c.user_id as string,
        });
      }
      const ownerIds = [...new Set([...connectionMap.values()].map((c) => c.user_id))];
      if (ownerIds.length > 0) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id,display_name,full_name")
          .in("id", ownerIds);
        for (const p of (profiles ?? []) as {
          id: string;
          display_name: string | null;
          full_name: string | null;
        }[]) {
          ownerDisplayMap.set(p.id, p.display_name ?? p.full_name ?? null);
        }
      }
    }

    // Decorate with product names.
    const productIds = [...new Set(rows.map((b) => b.product_id!).filter(Boolean))];
    const productMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: projects } = await db
        .from("projects")
        .select("id,name")
        .in("id", productIds);
      for (const p of (projects ?? []) as { id: string; name: string }[]) {
        productMap.set(p.id, p.name);
      }
    }

    const bindings: ProductBindingRow[] = rows.map((b) => {
      const conn = connectionMap.get(b.connection_id);
      return {
        ...b,
        product_id: b.product_id!,
        provider: conn?.provider ?? b.provider,
        account_label: conn?.account_label ?? null,
        connection_status: (conn?.status ?? "disconnected") as ConnectionRow["status"],
        owner_display: conn ? (ownerDisplayMap.get(conn.user_id) ?? null) : null,
        product_name: b.product_id ? (productMap.get(b.product_id) ?? null) : null,
      };
    });

    return { bindings };
  });

/**
 * Bind a connection resource to a specific product. The connection owner must
 * be the caller. Insert-or-update on the partial unique key
 * (product_id, provider, resource_kind) WHERE product_id IS NOT NULL.
 */
export const upsertProductBinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        connectionId: z.string().uuid(),
        productId: z.string().uuid(),
        resourceKind: z.string().min(1).max(60),
        resourceId: z.string().min(1).max(300),
        resourceLabel: z.string().min(1).max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;

    // Verify connection ownership (own-row RLS).
    const { data: conn, error: connError } = await db
      .from("connections")
      .select("id,user_id,provider,status")
      .eq("id", data.connectionId)
      .maybeSingle();
    if (connError) throw new Error(connError.message);
    if (!conn) throw new Error("Connection not found.");
    if ((conn as { user_id: string }).user_id !== context.userId) {
      throw new Error("Only the connection owner can bind it to a product.");
    }

    // Resolve the product's workspace (for the binding row's workspace_id).
    const { data: product, error: productError } = await db
      .from("projects")
      .select("id,workspace_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Product not found or you do not have access.");
    const workspaceId = (product as { workspace_id: string }).workspace_id;

    const now = new Date().toISOString();

    // Select-then-write (PostgREST can't target a partial unique index via upsert).
    const { data: existing, error: existingError } = await db
      .from("connection_bindings")
      .select("id")
      .eq("product_id", data.productId)
      .eq("provider", (conn as { provider: string }).provider)
      .eq("resource_kind", data.resourceKind)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { data: updated, error } = await db
        .from("connection_bindings")
        .update({
          connection_id: data.connectionId,
          resource_id: data.resourceId,
          resource_label: data.resourceLabel ?? null,
          created_by: context.userId,
          updated_at: now,
        })
        .eq("id", (existing as { id: string }).id)
        .select(BINDING_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return { binding: updated as unknown as BindingRow };
    }

    const { data: inserted, error } = await db
      .from("connection_bindings")
      .insert({
        connection_id: data.connectionId,
        workspace_id: workspaceId,
        product_id: data.productId,
        provider: (conn as { provider: string }).provider,
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

/**
 * Remove a product-scoped binding. Membership RLS (is_workspace_member) and
 * the write policy (creator or workspace admin) authorize the delete.
 */
export const removeProductBinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { error } = await db.from("connection_bindings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Products (projects) accessible to the caller in the active workspace.
 * Used by the ProductBindingsSection to drive the per-product binding UI.
 */
export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;

    // Resolve the active workspace.
    const { data: ws, error: wsError } = await context.supabase.rpc(
      "current_user_default_workspace",
    );
    if (wsError || !ws) return { products: [] as ProductRow[] };
    const workspaceId = ws as unknown as string;

    const { data: projects, error } = await db
      .from("projects")
      .select("id,name,workspace_id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const visible = ((projects ?? []) as (ProductRow & { archived_at?: string | null })[]).filter(
      (p) => !p.archived_at,
    );
    return { products: visible as ProductRow[] };
  });
