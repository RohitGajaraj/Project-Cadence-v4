/**
 * DATA-RETENTION-b - right-to-be-forgotten erasure: the pure, unit-tested
 * legibility layer over the `forget_workspace` / `forget_account` RPCs.
 *
 * The erase itself is a dormant, service-role-only SQL cascade
 * (`supabase/migrations/20260621012900_data_retention_b_right_to_erasure.sql`).
 * This module owns NO database access; it only turns an erase RESULT into a
 * verifiable receipt an operator / DPO / dry-run can read to confirm exactly
 * what was deleted, and never claims success when the cascade was a dormant
 * no-op. Keeping the math pure means it is covered by fast unit tests with no
 * publish dependency (the SQL side is verified by a live dry-run on publish).
 *
 * Spec: docs/features/right-to-erasure.md.
 */

/** The dormant flag + RPC names, for documentation and a single invocation source. */
export const RIGHT_TO_ERASURE = {
  /** SQL flag that gates every destructive function; ships `false` (dormant). */
  enabledFlag: "right_to_erasure_enabled",
  /** Erase one workspace (all its tenant rows + the workspace row). */
  forgetWorkspaceFn: "forget_workspace",
  /** Erase a whole account (every workspace under it + account-scoped rows). */
  forgetAccountFn: "forget_account",
  /** Read-only residue check: counts of any tenant rows still present. */
  residueFn: "erasure_residue",
} as const;

/** A dormant no-op result (the flag is off). */
export type ErasureSkipped = { skipped: "dormant" };

/** The result of `forget_workspace(_workspace_id)`. */
export type WorkspaceErasureResult = {
  workspace_id: string;
  /** {table_name: rows_deleted}, omitting tables that had no matching rows. */
  tables: Record<string, number>;
  /** Rows deleted from `workspaces` (1 on success, 0 if it was already gone). */
  workspaces: number;
};

/** The result of `forget_account(_account_id)`. */
export type AccountErasureResult = {
  account_id: string;
  /** One per workspace erased under the account. */
  workspaces: ErasureResult[];
  /** {table_name: rows_deleted} for account-scoped tables (credits/ledger/members/...). */
  account_tables: Record<string, number>;
  /** Rows deleted from `accounts` (1 on success). */
  accounts: number;
};

export type ErasureResult = ErasureSkipped | WorkspaceErasureResult | AccountErasureResult;

/** A flat, human-readable summary of an erase, regardless of scope. */
export type ErasureReceipt = {
  /** True when the cascade was a dormant no-op (nothing was deleted). */
  dormant: boolean;
  /** Total content rows deleted across every table (excludes the workspace/account rows). */
  totalRows: number;
  /** Merged {table: rows} across all scopes (workspace + account-scoped). */
  byTable: Record<string, number>;
  /** Count of `workspaces` rows removed. */
  workspacesErased: number;
  /** Count of `accounts` rows removed. */
  accountsErased: number;
};

function isSkipped(r: ErasureResult): r is ErasureSkipped {
  return (r as ErasureSkipped).skipped === "dormant";
}

function isAccount(r: ErasureResult): r is AccountErasureResult {
  // Structural, not just key presence: an account result's `workspaces` is an ARRAY
  // (a workspace result's is a number), so a malformed/deserialized object can never
  // be misread as an account and then iterated as if `workspaces` were a list.
  return "account_id" in r && Array.isArray((r as AccountErasureResult).workspaces);
}

function mergeCounts(into: Record<string, number>, from: Record<string, number> | undefined): void {
  if (!from) return;
  for (const [table, n] of Object.entries(from)) {
    // Defensive: a non-finite or negative count is treated as 0, never trusted.
    const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    if (safe > 0) into[table] = (into[table] ?? 0) + safe;
  }
}

/**
 * Fold an erase result (workspace, account, or dormant) into a flat receipt.
 * Recurses into an account's per-workspace results so the totals are complete.
 */
export function summarizeErasure(result: ErasureResult): ErasureReceipt {
  const receipt: ErasureReceipt = {
    dormant: false,
    totalRows: 0,
    byTable: {},
    workspacesErased: 0,
    accountsErased: 0,
  };

  if (isSkipped(result)) {
    receipt.dormant = true;
    return receipt;
  }

  if (isAccount(result)) {
    for (const ws of result.workspaces) {
      const sub = summarizeErasure(ws);
      // A dormant sub-result inside a non-dormant account cannot happen, but if it
      // did we must not mark the whole account dormant - only roll the real numbers.
      mergeCounts(receipt.byTable, sub.byTable);
      receipt.workspacesErased += sub.workspacesErased;
    }
    mergeCounts(receipt.byTable, result.account_tables);
    receipt.accountsErased +=
      Number.isFinite(result.accounts) && result.accounts > 0 ? Math.floor(result.accounts) : 0;
  } else {
    mergeCounts(receipt.byTable, result.tables);
    receipt.workspacesErased +=
      Number.isFinite(result.workspaces) && result.workspaces > 0
        ? Math.floor(result.workspaces)
        : 0;
  }

  receipt.totalRows = Object.values(receipt.byTable).reduce((a, b) => a + b, 0);
  return receipt;
}

/**
 * True when an erase verifiably removed the tenant: the residue check came back
 * empty AND the receipt is not a dormant no-op. Use after `erasure_residue` to
 * gate "erasure complete" - never trust a dormant result as done.
 */
export function isErasureComplete(
  receipt: ErasureReceipt,
  residue: Record<string, number> | null | undefined,
): boolean {
  if (receipt.dormant) return false;
  // residue is the jsonb from erasure_residue; an empty `{}` can deserialize to
  // null through some JSON layers, so never dereference it unguarded.
  return Object.keys(residue ?? {}).length === 0;
}
