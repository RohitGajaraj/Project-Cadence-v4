/**
 * BYO-P3 WI1 — Deploy capture (pure core).
 *
 * The `RepoProvider.readDeployments()` call returns raw provider deployment
 * entries; this module owns the provider-agnostic shaping the server function
 * (`captureDeployments` in deployments.functions.ts) persists into the
 * `deployments` table. Kept pure (no Supabase, no network) so it is unit-
 * testable and reused without a DB — same leaf-module pattern as
 * studio-rollbacks.ts.
 */

import type { DeploymentEntry } from "@/lib/connectors/repo-provider";

/** Normalized deploy status the outcome surface renders, independent of provider vocab. */
export type DeployStatus = "success" | "failure" | "pending" | "in_progress" | "unknown";

/**
 * Map a provider's deployment status string onto the normalized set. GitHub
 * Deployments use `success|failure|error|inactive|in_progress|queued|pending`;
 * GitLab environments use `success|failed|running|canceled`. Anything
 * unrecognized is "unknown" rather than silently coerced to success — the
 * outcome view must never imply a deploy succeeded when it did not.
 */
export function normalizeDeployStatus(status: string): DeployStatus {
  const s = status.trim().toLowerCase();
  if (s === "success" || s === "active" || s === "deployed" || s === "passed") return "success";
  if (s === "failure" || s === "failed" || s === "error" || s === "canceled" || s === "cancelled")
    return "failure";
  if (s === "in_progress" || s === "running" || s === "building") return "in_progress";
  if (s === "queued" || s === "pending" || s === "waiting") return "pending";
  return "unknown";
}

/**
 * Collapse a provider's deployment list to the latest entry per environment.
 * Providers return one row per deploy attempt; the outcome surface wants the
 * current state of each environment, so we keep the newest `createdAt` per
 * environment. Stable: ties (equal timestamps) keep the first seen.
 */
export function dedupeLatestDeployments(entries: DeploymentEntry[]): DeploymentEntry[] {
  const latest = new Map<string, DeploymentEntry>();
  for (const e of entries) {
    const env = (e.environment || "production").trim() || "production";
    const prev = latest.get(env);
    if (!prev || new Date(e.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
      // Store with the normalized environment so consumers that render entries
      // directly never see a blank/untrimmed environment label.
      latest.set(env, { ...e, environment: env });
    }
  }
  return Array.from(latest.values());
}

export type DeploymentRow = {
  user_id: string;
  workspace_id: string;
  product_id: string | null;
  changeset_id: string | null;
  provider: string;
  environment: string;
  status: DeployStatus;
  commit_sha: string;
  deploy_url: string | null;
  triggered_by: string | null;
  deployed_at: string | null;
};

/**
 * Shape deduped provider entries into `deployments` upsert rows. The DB unique
 * key is (changeset_id, environment, commit_sha), so re-capturing the same
 * deploy updates status in place rather than duplicating.
 */
export function deploymentRowsFor(args: {
  entries: DeploymentEntry[];
  userId: string;
  workspaceId: string;
  productId: string | null;
  changesetId: string | null;
  provider: string;
  triggeredBy?: string | null;
}): DeploymentRow[] {
  return dedupeLatestDeployments(args.entries).map((e) => ({
    user_id: args.userId,
    workspace_id: args.workspaceId,
    product_id: args.productId,
    changeset_id: args.changesetId,
    provider: args.provider,
    environment: (e.environment || "production").trim() || "production",
    status: normalizeDeployStatus(e.status),
    commit_sha: e.sha,
    deploy_url: e.url ?? null,
    triggered_by: args.triggeredBy ?? null,
    deployed_at: e.createdAt ?? null,
  }));
}
