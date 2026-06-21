/**
 * WM-F9b — active-workspace read scoping.
 *
 * Single source of truth for "should this read narrow to one workspace, and to
 * which?". The active workspace lives client-side (`use-workspace.tsx`); a
 * surface that wants its list scoped passes the active id into the read server
 * fn, which routes it through here before applying `.eq("workspace_id", id)`.
 *
 * The rule is deliberately conservative: scope ONLY when given a concrete,
 * non-blank id. A null / undefined / blank value yields `null` = NO filter, i.e.
 * the pre-WM-F9b behaviour (every row the caller is already authorized to read).
 * That keeps the `workspaceId` param purely additive — any caller that does not
 * opt in is byte-identical to today, and a malformed / blank id can never
 * collapse a list to empty by accident.
 *
 * Security: this only ever NARROWS within rows the caller is already authorized
 * to see. WM-F9 dual-keys these tables at the RLS layer
 * (`auth.uid() = user_id AND is_workspace_member(workspace_id)`), so scoping to a
 * workspace the user is not a member of simply returns nothing — it can never
 * widen access. The scope id is therefore safe to take straight from the client.
 *
 * The WM-F9c long tail reuses this one helper so the scoping rule can never
 * drift read-to-read. That tail (tracked on the WM-F9 board row): the brief read
 * (already workspace-aware server-side, only its client wiring is deferred since
 * its sole caller is settings.tsx), `listCopilotMessages` (no client caller
 * yet), the prototype family / `scheduler_proposals` / `ritual_sessions` reads,
 * and the internal AI-context reads inside `sendCopilotMessage`.
 */
export function workspaceScopeId(explicit: unknown): string | null {
  if (typeof explicit !== "string") return null;
  const trimmed = explicit.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Apply the active-workspace scope to a Supabase / PostgREST query builder: adds
 * `.eq("workspace_id", id)` exactly once when {@link workspaceScopeId} yields a
 * concrete id, and is a no-op (returns the query untouched) otherwise.
 *
 * Keeping the conditional here — rather than inline in each read fn — is what
 * lets one unit test pin the load-bearing WM-F9b invariant ("scope iff a real
 * id, never otherwise"), and lets the WM-F9c long tail apply the exact same rule
 * so the read paths cannot drift. The minimal `{ eq }` constraint keeps this
 * decoupled from the concrete builder type while preserving the chain (it
 * returns the same builder, so `.order` / `.limit` stay available downstream).
 */
export function applyWorkspaceScope<Q extends { eq(column: string, value: string): Q }>(
  query: Q,
  explicit: unknown,
): Q {
  const id = workspaceScopeId(explicit);
  return id ? query.eq("workspace_id", id) : query;
}
