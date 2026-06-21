// WM-F8 (workspace switch hardening): decides which TanStack Query cache
// entries survive a workspace switch and which get cleared.
//
// The bug this closes: switching the active workspace mutated React state but
// never touched the query cache, so any workspace-scoped query whose key omits
// the workspace id kept serving the PREVIOUS workspace's cached rows until it
// happened to refetch -- a stale-data flash that reads like a cross-workspace
// leak. On switch we clear every workspace-scoped query so nothing stale ever
// renders (active observers refetch under the new workspace context), while the
// genuinely global queries below are preserved so the switcher, the signed-in
// identity, and account billing/connections do not blank or needlessly refetch.
//
// WM-F8b (2026-06-22) refines "global" into two tiers, because a workspace
// switch can cross ACCOUNTS (a user can be a member of workspaces in different
// accounts, reachable since WM-F5 invites shipped):
//   * USER-global  -- the signed-in identity and personal keys. These never
//     change on ANY switch, so they always survive.
//   * ACCOUNT-global -- billing / connections / integrations. These are correct
//     only for the ACTIVE workspace's account, so a SAME-account switch
//     preserves them (no needless refetch) but a CROSS-account switch must
//     clear them, or the new account would show the previous account's billing
//     and connected accounts (a stale cross-account flash).

/**
 * Query-key roots tied to the signed-in USER, not to any account or workspace
 * (identity + personal credentials). They survive every workspace switch,
 * including a cross-account one -- who you are does not change when you switch.
 */
export const USER_GLOBAL_QUERY_KEY_ROOTS: ReadonlySet<string> = new Set<string>([
  "workspaces", // the switcher's own list (the user's workspaces across all accounts); clearing it would blank the switcher mid-switch
  "profile", // signed-in user identity
  "api-keys", // personal BYO model keys (user-level)
  "mcp-tokens", // personal MCP tokens (user-level)
]);

/**
 * Query-key roots tied to the ACTIVE workspace's ACCOUNT (moved to the account
 * in WM-M2). They survive a same-account workspace switch but MUST clear on a
 * cross-account switch so the new account never renders the previous account's
 * billing / connected accounts / connector catalog.
 */
export const ACCOUNT_GLOBAL_QUERY_KEY_ROOTS: ReadonlySet<string> = new Set<string>([
  "billing", // account-level plan / billing
  "connections", // account-level connected accounts (Settings > Connected accounts)
  "calendar-connections", // account-level connected calendars
  "integrations", // account-level connector catalog
]);

/**
 * Every root that is NOT workspace-scoped (the union of the two tiers above).
 * Retained as the single "would this be cleared on a SAME-account switch"
 * predicate input, so {@link isWorkspaceScopedQueryKey} keeps its meaning.
 */
export const GLOBAL_QUERY_KEY_ROOTS: ReadonlySet<string> = new Set<string>([
  ...USER_GLOBAL_QUERY_KEY_ROOTS,
  ...ACCOUNT_GLOBAL_QUERY_KEY_ROOTS,
]);

/**
 * True when a query is strictly workspace-scoped -- i.e. it would be cleared on
 * ANY switch (it is in neither global tier). A non-string or empty root fails
 * safe to workspace-scoped (cleared), so a newly added query is isolated by
 * default rather than leaked across a switch.
 */
export function isWorkspaceScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey?.[0];
  return typeof root === "string" ? !GLOBAL_QUERY_KEY_ROOTS.has(root) : true;
}

/** Minimal shape needed to read a workspace's account; avoids a cyclic import of the full Workspace type. */
type WorkspaceAccountRef = { id: string; account_id?: string | null };

/**
 * Whether a workspace switch crosses ACCOUNTS, which decides if account-global
 * caches (billing/connections/integrations) must be cleared too.
 *
 * Conservative by design: it returns `false` (preserve account-global caches)
 * ONLY when both workspaces are known AND both carry a concrete, equal
 * `account_id`. In every other case -- a differing account, or an unknown/blank
 * account on either side -- it returns `true` so account-global caches are
 * cleared rather than risk showing a previous account's data. (`account_id` is
 * NOT NULL on the live schema since WM-M2, so the unknown case is the rare
 * pre-migration / odd-state path, where an extra refetch is harmless.)
 */
export function accountChangedOnSwitch(
  workspaces: ReadonlyArray<WorkspaceAccountRef>,
  fromWorkspaceId: string | null,
  toWorkspaceId: string | null,
): boolean {
  const accountOf = (id: string | null): string | null => {
    if (!id) return null;
    const account = workspaces.find((w) => w.id === id)?.account_id;
    return typeof account === "string" && account.trim() !== "" ? account : null;
  };
  const from = accountOf(fromWorkspaceId);
  const to = accountOf(toWorkspaceId);
  if (from !== null && to !== null) return from !== to;
  return true;
}

/**
 * The full switch-reset predicate: should this query be cleared when the active
 * workspace switches? USER-global never clears; ACCOUNT-global clears only when
 * the switch crossed accounts; everything else (workspace-scoped) always clears.
 * A non-string/empty root fails safe to cleared.
 */
export function shouldClearOnWorkspaceSwitch(
  queryKey: readonly unknown[],
  opts: { accountChanged: boolean },
): boolean {
  const root = queryKey?.[0];
  if (typeof root !== "string") return true;
  if (USER_GLOBAL_QUERY_KEY_ROOTS.has(root)) return false;
  if (ACCOUNT_GLOBAL_QUERY_KEY_ROOTS.has(root)) return opts.accountChanged;
  return true;
}
