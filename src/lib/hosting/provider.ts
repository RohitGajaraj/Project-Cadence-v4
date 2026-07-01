/**
 * BYO-P5 (Managed end-to-end runtime): the `AppRuntimeProvider` seam.
 *
 * One swappable abstraction for "Cadence hosts a user's app end to end (DB,
 * auth, deploy), no external account required". The plan
 * (`docs/planning/byo-p5-managed-runtime-plan.md`) recommends Cloudflare
 * Workers for Platforms plus one pooled, Cadence-owned Supabase project as
 * the first adapter (`cloudflare-wfp`); `neon-silo` and
 * `supabase-for-platforms` are reserved ids for a future per-tenant silo
 * adapter, wired only if a specific tenant trips an isolation graduation
 * trigger (plan Section 1.2).
 *
 * The whole capability is DORMANT: this file ships only the contract, the
 * shared types, and the {@link nullAppRuntimeProvider} floor (P5a). No
 * adapter exists yet, and none should until the founder opens a
 * directly-owned Cloudflare account and a directly-owned Supabase account
 * scoped to this layer (the plan's Section 1.1 precondition); wiring
 * `cloudflare-wfp` for real is P5b/P5c, a separate increment.
 *
 * This module is PURE (no env, no I/O), mirroring `delegate/provider.ts`:
 * the contract, the null floor, and the shared types only. A future
 * `cloudflare-wfp.server.ts` adapter plugs in behind this interface without
 * changing it.
 */

/** Every app-hosting backend named in the plan, wired or not. */
export type AppRuntimeProviderId = "cloudflare-wfp" | "neon-silo" | "supabase-for-platforms";

/** Identifies one hosted app: which tenant, which product, which app. */
export interface AppRuntimeRef {
  workspaceId: string;
  productId: string;
  hostedAppId: string;
}

/** Provisioning intent for a hosted app. */
export interface AppRuntimeSpec {
  /**
   * false (default) = pooled, shared runtime/DB, the plan's recommended
   * day-one model. true = a future silo adapter's dedicated runtime/DB,
   * flipped per tenant only on a real graduation trigger, never system-wide.
   */
  dedicatedDb: boolean;
}

/** A live handle to a provisioned hosted app, returned by `provisionApp`. */
export interface AppRuntimeHandle {
  providerId: AppRuntimeProviderId;
  ref: AppRuntimeRef;
}

/** The deployable output of a Build mission, in the shape a runtime provider consumes. */
export interface BuildArtifact {
  files: Array<{ path: string; content: string }>;
}

export interface DeploymentResult {
  deploymentId: string;
  url: string | null;
  status: "success" | "failure" | "pending";
}

export interface DeploymentEntry {
  deploymentId: string;
  status: string;
  url: string | null;
  createdAt: string;
}

export interface HealthStatus {
  healthy: boolean;
  checkedAt: string;
  detail?: string;
}

export interface LogQuery {
  since?: string;
  limit?: number;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

/** A tenant-scoped data export, backing the portability guarantee under the pooled model (plan Section 1.2). */
export interface TenantExportArtifact {
  hostedAppId: string;
  exportedAt: string;
  downloadUrl: string;
}

export interface AppRuntimeProvider {
  readonly providerId: AppRuntimeProviderId;
  /** Whether this backend is wired AND permitted (flag + credentials) right now. */
  readonly available: boolean;

  provisionApp(ref: AppRuntimeRef, spec: AppRuntimeSpec): Promise<AppRuntimeHandle>;
  deploy(
    handle: AppRuntimeHandle,
    artifact: BuildArtifact,
    env: Record<string, string>,
  ): Promise<DeploymentResult>;
  readDeployments(handle: AppRuntimeHandle): Promise<DeploymentEntry[]>;
  readHealth(handle: AppRuntimeHandle): Promise<HealthStatus>;
  readLogs(handle: AppRuntimeHandle, opts?: LogQuery): Promise<LogEntry[]>;
  readEnvVars(handle: AppRuntimeHandle): Promise<Record<string, string>>;
  setEnvVar(handle: AppRuntimeHandle, key: string, value: string): Promise<void>;
  rollback(handle: AppRuntimeHandle, toDeploymentId: string): Promise<DeploymentResult>;
  exportTenantData(handle: AppRuntimeHandle): Promise<TenantExportArtifact>;
  teardown(handle: AppRuntimeHandle): Promise<void>;
}

/** Shared refusal reason every dormant-floor method throws, so callers see one consistent message. */
export const APP_RUNTIME_DISABLED_REASON =
  "AppRuntimeProvider is disabled (no live adapter configured yet; see docs/planning/byo-p5-managed-runtime-plan.md)";

/**
 * The dormant floor: refuses every call. This is what a future resolver
 * returns whenever no live adapter is configured, so a hosting attempt
 * degrades to a clear, typed error instead of a silent no-op or a hand-off
 * to an unconfigured provider. Callers should check `.available` before
 * calling any method.
 */
export const nullAppRuntimeProvider: AppRuntimeProvider = {
  providerId: "cloudflare-wfp",
  available: false,
  async provisionApp(): Promise<AppRuntimeHandle> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async deploy(): Promise<DeploymentResult> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async readDeployments(): Promise<DeploymentEntry[]> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async readHealth(): Promise<HealthStatus> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async readLogs(): Promise<LogEntry[]> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async readEnvVars(): Promise<Record<string, string>> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async setEnvVar(): Promise<void> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async rollback(): Promise<DeploymentResult> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async exportTenantData(): Promise<TenantExportArtifact> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
  async teardown(): Promise<void> {
    throw new Error(APP_RUNTIME_DISABLED_REASON);
  },
};

/**
 * Backends named in the plan but not yet wired to a real adapter. Every id
 * lives here today, including `cloudflare-wfp` (the plan's recommended
 * first adapter), because P5a ships the contract only, with zero live
 * provisioning. Listed here so a future resolver and the docs stay the
 * single source of "what can plug in", with nobody hard-coding a provider
 * id elsewhere. `cloudflare-wfp` moves out of this list the moment its
 * adapter ships (P5b), mirroring how `RESERVED_DELEGATE_PROVIDER_IDS`
 * excludes `openhands` once that adapter was wired.
 */
export const RESERVED_APP_RUNTIME_PROVIDER_IDS: readonly AppRuntimeProviderId[] = [
  "cloudflare-wfp",
  "neon-silo",
  "supabase-for-platforms",
];
