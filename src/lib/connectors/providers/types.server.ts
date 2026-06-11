// F-CONN Phase 1 — provider adapter contract (server-only).
// Adapters wrap provider APIs behind a uniform shape so connections.functions.ts
// can verify credentials and enumerate bindable resources without per-provider
// branching at the call site.

import type { ResolvedAuth } from "../resolve.server";

export type ValidateResult = {
  ok: boolean;
  accountLabel?: string | null;
  accountEmail?: string | null;
  detail?: string;
};

export type ResourceItem = { id: string; label: string };

export interface ConnectorAdapter {
  /** Probe the credential; never throws — failures come back as { ok: false, detail }. */
  validate(auth: ResolvedAuth): Promise<ValidateResult>;
  /** Enumerate bindable resources of a kind (e.g. 'repo'). Absent on providers without resources. */
  listResources?(auth: ResolvedAuth, kind: string, opts?: { q?: string }): Promise<ResourceItem[]>;
}
