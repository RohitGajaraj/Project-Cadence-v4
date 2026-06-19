/**
 * Server-side RBAC helpers for WM-F3.
 *
 * These check permissions by querying the workspace_members and account_members
 * tables, typically called within server functions to gate operations.
 *
 * Permissions:
 *   - owner: billing/plan, delete account/workspace, transfer ownership, manage members
 *   - admin: manage members (not billing), create/delete workspace+product, approve actions, edit brief+guardrails
 *   - member: create/edit content, run missions
 *   - viewer: read-only
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Typed error for permission denied.
 */
export class PermissionDeniedError extends Error {
  constructor(
    public readonly action: string,
    public readonly requiredRoles: Role[],
    public readonly userRole?: Role
  ) {
    super(
      `Permission denied: ${action}. Required role(s): ${requiredRoles.join(', ')}. User role: ${userRole || 'none'}.`
    );
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Get the current user's role in a workspace.
 * Returns the role or null if not a member.
 */
export async function getUserWorkspaceRole(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string
): Promise<Role | null> {
  const { data, error } = await (supabase.from('workspace_members') as any)
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.role as Role;
}

/**
 * Get the current user's role in an account.
 * Returns the role or null if not a member.
 */
export async function getUserAccountRole(
  supabase: SupabaseClient<Database>,
  accountId: string,
  userId: string
): Promise<Role | null> {
  // WM-M2's account_members table is not in the generated Supabase types yet (it
  // ships on the founder's next publish), so cast the client before .from() to keep
  // tsc green until the post-publish types regen. (The prior `.from(...) as any` cast
  // the result, not the client, so tsc still rejected the table-name argument.)
  const { data, error } = await (supabase as any)
    .from('account_members')
    .select('role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.role as Role;
}

/**
 * Assert that the user has one of the required roles in a workspace.
 * Throws PermissionDeniedError if the check fails.
 */
export async function assertWorkspaceRole(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  requiredRoles: Role[],
  action: string
): Promise<void> {
  const userRole = await getUserWorkspaceRole(supabase, workspaceId, userId);
  if (!userRole || !requiredRoles.includes(userRole)) {
    throw new PermissionDeniedError(action, requiredRoles, userRole || undefined);
  }
}

/**
 * Assert that the user has one of the required roles in an account.
 * Throws PermissionDeniedError if the check fails.
 */
export async function assertAccountRole(
  supabase: SupabaseClient<Database>,
  accountId: string,
  userId: string,
  requiredRoles: Role[],
  action: string
): Promise<void> {
  const userRole = await getUserAccountRole(supabase, accountId, userId);
  if (!userRole || !requiredRoles.includes(userRole)) {
    throw new PermissionDeniedError(action, requiredRoles, userRole || undefined);
  }
}

/**
 * Assert that the user is a workspace owner.
 */
export async function assertWorkspaceOwner(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string
): Promise<void> {
  await assertWorkspaceRole(supabase, workspaceId, userId, ['owner'], 'workspace owner action');
}

/**
 * Assert that the user can manage the workspace (owner or admin).
 */
export async function assertCanManageWorkspace(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string
): Promise<void> {
  await assertWorkspaceRole(supabase, workspaceId, userId, ['owner', 'admin'], 'workspace management');
}

/**
 * Assert that the user is an account owner.
 */
export async function assertAccountOwner(
  supabase: SupabaseClient<Database>,
  accountId: string,
  userId: string
): Promise<void> {
  await assertAccountRole(supabase, accountId, userId, ['owner'], 'account owner action');
}

/**
 * Assert that the user can manage the account (owner only).
 */
export async function assertCanManageAccount(
  supabase: SupabaseClient<Database>,
  accountId: string,
  userId: string
): Promise<void> {
  await assertAccountRole(supabase, accountId, userId, ['owner'], 'account management');
}
