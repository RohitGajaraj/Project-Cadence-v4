// WM-F8 (workspace switch hardening): decides which TanStack Query cache
// entries survive a workspace switch and which get cleared.
//
// The bug this closes: switching the active workspace mutated React state but
// never touched the query cache, so any workspace-scoped query whose key omits
// the workspace id kept serving the PREVIOUS workspace's cached rows until it
// happened to refetch -- a stale-data flash that reads like a cross-workspace
// leak. On switch we clear every workspace-scoped query so nothing stale ever
// renders (active observers refetch under the new workspace context), while the
// handful of genuinely user/account-global queries below are preserved so the
// switcher, the signed-in identity, and account billing/connections do not
// blank or needlessly refetch.

/**
 * Query-key roots that are user- or account-global, NOT workspace-scoped, so
 * they must survive a workspace switch. Membership is by EXACT root match (a
 * Set, not a prefix test) so a `workspace-`-prefixed key such as
 * `workspace-bindings` or `workspace-brief` is never mistaken for the global
 * `workspaces` list -- those are per-workspace and SHOULD clear on switch.
 */
export const GLOBAL_QUERY_KEY_ROOTS: ReadonlySet<string> = new Set<string>([
  "workspaces", // the switcher's own list (user-global); clearing it would blank the switcher mid-switch
  "profile", // signed-in user identity (user-global)
  "billing", // account-level plan / billing (moved to the account in WM-M2)
  "connections", // account-level connected accounts (Settings > Connected accounts)
  "calendar-connections", // account-level connected calendars
  "integrations", // account-level connector catalog
  "api-keys", // personal BYO model keys (user-level)
  "mcp-tokens", // personal MCP tokens (user-level)
]);

/**
 * True when a query should be cleared on a workspace switch. A query is treated
 * as workspace-scoped unless its root key is in {@link GLOBAL_QUERY_KEY_ROOTS}.
 * A non-string or empty root fails safe to workspace-scoped (cleared), so a
 * newly added query is isolated by default rather than leaked across a switch.
 */
export function isWorkspaceScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey?.[0];
  return typeof root === "string" ? !GLOBAL_QUERY_KEY_ROOTS.has(root) : true;
}
