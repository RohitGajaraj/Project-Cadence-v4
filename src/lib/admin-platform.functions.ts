/**
 * Admin Console v2 — Platform tab server fns: feature flags, system banner,
 * audit log, and the public-readable helpers (banner + flag) consumed by the
 * app shell.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeatureFlag = {
  id: string; key: string; enabled: boolean; payload: string;
  updated_by: string | null; updated_at: string;
};

export const adminListFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeatureFlag[] | { error: string }> => {
    const { data, error } = await context.supabase.rpc("admin_list_flags");
    if (error) return { error: error.message };
    return ((data ?? []) as unknown as Array<{ id: string; key: string; enabled: boolean; payload: unknown; updated_by: string | null; updated_at: string }>).map(
      (r): FeatureFlag => ({ ...r, payload: JSON.stringify(r.payload ?? {}) }),
    );
  });

export const adminUpsertFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; enabled: boolean; payloadJson: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    let payload: unknown = {};
    try { payload = JSON.parse(data.payloadJson || "{}"); } catch { return { error: "Payload must be valid JSON" }; }
    const { error } = await context.supabase.rpc("admin_upsert_flag", {
      _key: data.key, _enabled: data.enabled, _payload: payload,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminDeleteFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_delete_flag", { _id: data.id });
    if (error) return { error: error.message };
    return { ok: true };
  });

export type SystemBanner = { id: string; message: string; level: "info" | "warn" | "alert"; expires_at: string | null };

export const getActiveBanner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemBanner | null> => {
    const { data } = await context.supabase.rpc("get_active_banner");
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;
    return row as SystemBanner;
  });

export const adminSetBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message: string; level: "info" | "warn" | "alert"; active: boolean; expiresAt: string | null }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_set_banner", {
      _message: data.message, _level: data.level, _active: data.active, _expires_at: data.expiresAt,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const adminClearBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase.rpc("admin_clear_banner");
    if (error) return { error: error.message };
    return { ok: true };
  });

export type AuditRow = {
  id: string; actor_user_id: string | null; actor_email: string | null;
  action: string; target_kind: string; target_id: string | null;
  payload: string; created_at: string;
};

export const adminListAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetKind?: string | null; targetId?: string | null; limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<AuditRow[] | { error: string }> => {
    const { data: rows, error } = await context.supabase.rpc("admin_list_audit_log", {
      _target_kind: data.targetKind ?? null,
      _target_id: data.targetId ?? null,
      _lim: data.limit ?? 100,
      _off: data.offset ?? 0,
    });
    if (error) return { error: error.message };
    return ((rows ?? []) as unknown as Array<Omit<AuditRow, "payload"> & { payload: unknown }>).map(
      (r): AuditRow => ({ ...r, payload: JSON.stringify(r.payload ?? {}) }),
    );
  });