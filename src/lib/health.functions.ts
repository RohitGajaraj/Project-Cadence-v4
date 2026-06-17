import { createServerFn } from "@tanstack/react-start";

/**
 * Backend drift check. Compares the list of migration versions this build
 * expects against what's actually applied in supabase_migrations.schema_migrations.
 *
 * Cannot auto-APPLY migrations from the app: Lovable Cloud Workers have no
 * DDL credentials and no migration runner. The job here is to FAIL LOUD with
 * a clear message instead of letting users hit cryptic Postgres errors
 * (missing column, undefined function) deep inside flows like onboarding.
 *
 * REQUIRED_VERSIONS: bump when you ship a new migration that user-facing
 * code depends on. The list is built from the leading numeric prefix of each
 * file under supabase/migrations/. Keep this in sync; the prebuild check in
 * scripts/check-migrations.sh enforces the inverse (every file applied).
 */
const REQUIRED_VERSIONS = [
  "20260617150000", // Q1 MCP tokens + audit
  "20260617160000", // DEC-02-LOOP critic.evaluate registered as agent tool
  "20260617191502", // Reapplied MCP + critic (after deleted_at fix)
] as const;

export type BackendHealth = {
  ok: boolean;
  pending: string[];
  checkedAt: string;
  reason?: string;
};

export const checkBackendHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<BackendHealth> => {
    const checkedAt = new Date().toISOString();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .schema("supabase_migrations" as never)
        .from("schema_migrations" as never)
        .select("version");
      if (error) {
        // Fail open: a query failure here shouldn't block users. The build-time
        // gate (scripts/check-migrations.sh) is the hard wall.
        return { ok: true, pending: [], checkedAt, reason: `probe-error: ${error.message}` };
      }
      const applied = new Set<string>(
        ((data ?? []) as Array<{ version: string }>).map((r) => r.version),
      );
      const pending = REQUIRED_VERSIONS.filter((v) => !applied.has(v));
      return { ok: pending.length === 0, pending: [...pending], checkedAt };
    } catch (err) {
      return {
        ok: true,
        pending: [],
        checkedAt,
        reason: `probe-threw: ${(err as Error).message}`,
      };
    }
  },
);