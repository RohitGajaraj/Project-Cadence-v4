/**
 * WM-F6c: same-account "Move to workspace" destinations.
 *
 * The move_product RPC (WM-F6) only relocates a product within the SAME account
 * (it guards on owner/admin-in-both AND both workspaces sharing an account_id).
 * Before this, the sidebar's "Move to workspace" submenu offered EVERY other
 * workspace the user could see, so picking a cross-account one was accepted by
 * the UI and then rejected by the RPC with a toast. This helper narrows the
 * destination list to the same account so a user is never offered a move that
 * cannot succeed.
 *
 * Conservative by design (mirrors {@link workspaceScopeId}'s philosophy): hide a
 * destination ONLY when we are CERTAIN it is a different account, meaning both the
 * source and the destination have a concrete, non-blank account id and they
 * differ. If either id is unknown (null / blank / the column absent before
 * WM-M2's schema is the deployed read schema), the destination is still offered.
 *
 * Failing OPEN is safe because the RPC remains the authoritative same-account
 * guard: offering an ineligible destination can never let an invalid move
 * through (the RPC still rejects it), it would only surface the same toast as
 * before. Failing CLOSED, by contrast, could wrongly hide a VALID destination
 * and silently strand a product, so when in doubt we show, never hide.
 *
 * In production the match is exact: WM-M2 backfilled workspaces.account_id NOT
 * NULL and the workspaces query selects it, so a provably cross-account option
 * is never offered; the fail-open windows are only the pre-WM-M2-deploy state
 * or a missing projection. Either way this stays purely cosmetic: move_product
 * re-derives the source workspace and both account ids server-side from the FOR
 * UPDATE-locked rows and never trusts the client account_id, so it remains the
 * authoritative same-account guard.
 */
import { workspaceScopeId } from "./workspace-scope";

export function moveDestinationWorkspaces<W extends { id: string; account_id?: string | null }>(
  workspaces: readonly W[],
  sourceWorkspaceId: string | null,
): W[] {
  // Products in the move menu belong to the active (source) workspace, so the
  // source account is that workspace's account. If the source isn't in the list
  // (or has no concrete account id), sourceAccount is null and every other
  // workspace is offered, the pre-WM-F6c behaviour.
  const source = workspaces.find((w) => w.id === sourceWorkspaceId);
  const sourceAccount = workspaceScopeId(source?.account_id);

  return workspaces.filter((w) => {
    if (w.id === sourceWorkspaceId) return false; // never "move" to itself
    const destAccount = workspaceScopeId(w.account_id);
    // Only exclude when both accounts are known AND provably different.
    if (sourceAccount && destAccount && destAccount !== sourceAccount) return false;
    return true;
  });
}
