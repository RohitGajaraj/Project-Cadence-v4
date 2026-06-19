# WM-F3: RBAC Enforcement (owner/admin/member/viewer roles)

**Status:** ◐ shipped cycle 37
**Spec:** `docs/planning/workspace-tenancy-and-monetization-plan.md` (WM-F3)

## Overview

Real role-based access control (RBAC) for workspaces and accounts. The four roles are:
- **owner**: Billing/plan changes, delete account/workspace, transfer ownership, manage members
- **admin**: Manage members (read/invite, no billing), create/delete workspace+product, approve agent actions, edit brief+guardrails
- **member**: Create/edit content, run missions, no member/billing management
- **viewer**: Read-only access

## Implementation

### SQL (migration 20260619210000_wm_f3_rbac_enforcement.sql)

1. **RBAC helper functions** (SECURITY DEFINER):
   - `has_workspace_role(workspace_id, roles[])`: Check if the current user has one of the given roles in a workspace
   - `has_account_role(account_id, roles[])`: Check if the current user has one of the given roles in an account
   - Shorthand helpers: `is_workspace_owner`, `can_manage_workspace`, `is_account_owner`, `can_manage_account`

2. **Owner demotion trigger**: Prevents the workspace owner from being demoted to a lesser role via `prevent_workspace_owner_demotion` trigger on `workspace_members`

3. **Policy updates**:
   - Workspaces: Owner/admin can manage
   - Workspace members: Only owner can manage
   - Account members: Owner manages all; members see their own
   - Accounts: Owner manages; members can read

### TypeScript (src/lib/roles.functions.ts)

Server-side RBAC helpers:
- `getUserWorkspaceRole(supabase, workspaceId, userId)`: Get user's role in a workspace
- `getUserAccountRole(supabase, accountId, userId)`: Get user's role in an account
- `assertWorkspaceRole(supabase, workspaceId, userId, roles, action)`: Gate an action by role; throws `PermissionDeniedError` if denied
- `assertAccountRole(supabase, accountId, userId, roles, action)`: Gate an account action by role

Shorthand assertions:
- `assertWorkspaceOwner`, `assertCanManageWorkspace`
- `assertAccountOwner`, `assertCanManageAccount`

## Acceptance Criteria

- [x] A viewer cannot write to workspace tables
- [x] A member cannot manage members or billing
- [x] An admin cannot change billing (account owner only)
- [x] The workspace owner cannot be demoted
- [x] Unit tests on PermissionDeniedError (8/8 pass)
- [x] Lint / format clean (humanization clean)
- [x] Build green
- [x] Tests green (roles.test.ts 8/8)

## Behavioral Verification

The migration is dry-run-verified via a BEGIN..ROLLBACK on the live prod DB (cycle 37):
- Role CHECK constraint widened to support all 4 roles
- RBAC helper functions created and grant-enabled
- Owner demotion trigger prevents demotion to lesser roles
- Policies rewritten to use role-based checks

Note: live enforcement activates on the founder's next publish.

## Follow-up Work

**WM-F4** (ownership transfer): Uses the new RBAC helpers to gate the transfer operation
**WM-F5** (invites): Uses the new RBAC helpers to gate invite/accept operations
**WM-F7** (Settings IA): UI affordances gated by role

## Related

- `docs/planning/workspace-tenancy-and-monetization-plan.md` (WM-F3 spec)
- `src/lib/roles.functions.ts` (TypeScript helpers)
- `src/lib/roles.test.ts` (unit tests)
- `supabase/migrations/20260619210000_wm_f3_rbac_enforcement.sql` (migration)
