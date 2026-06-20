# Admin Console v2 - Build Bible (People · Workspaces · Platform)

> _Created: 2026-06-20 · Last updated: 2026-06-20 (all 8 steps shipped)_
>
> **Owner:** Lovable (parallel monetization/admin lane). **Status:** ✅ Steps 1-8 shipped (2026-06-20). v2 is complete; the People · Workspaces · Platform tabs are live alongside v1's Overview + Pricing. Live on the founder's next publish. Doc-closure (Step 8) closed: feature page flipped to "v2 shipped", plan.md §4 log line appended, this bible marked complete.
>
> This is the cold-buildable spec. Any agent (Lovable Cloud / Claude Code / Antigravity) should be able to pick this up, run the migration, ship the server fns, and wire the UI without re-deriving intent.

---

## 0. Why three tabs, not five

The founder rejected a 5-tab split (Users / Workspaces / Access / Invites / Vouchers) as fragmented. Cluster by **who the admin manages**, not by entity type:

- **People** - anything about a human user: identity, plan, credits, access, invitations, vouchers.
- **Workspaces** - anything about a tenant: members, roles, workspace-level credits, plan override, ownership, lifecycle.
- **Platform** - anything about the system itself: feature flags, banners, audit log, health peek.

Drawers carry the depth so no functionality is lost.

---

## 1. What NOT to touch

- v1 **Overview** tab (credits-engine ON/OFF + admin roster) - unchanged.
- v1 **Pricing** tab (plan / top-up CRUD, "Most popular", "Best value") - unchanged.
- User-facing `/settings` billing surface - unchanged.
- Pricing-engine backend (`pricing.functions.ts` plan/topup CRUD, Stripe clone-and-archive) - unchanged.
- Agent loop, runtime chokepoint, RAG, connectors - out of scope.

---

## 2. Backend (migration first)

One migration file. All new tables in `public`. Every table gets GRANT + RLS + policies in the same migration (per AGENTS.md §3 / public-schema-grants rule).

### 2.1 New tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `admin_audit_log` | Append-only record of every admin mutation. | `actor_user_id`, `action`, `target_kind` (`user`/`workspace`/`voucher`/`flag`/`banner`), `target_id`, `payload` (jsonb), `created_at` |
| `vouchers` | Promo codes. | `code` (unique), `kind` (`signup`/`credit_grant`/`plan_upgrade`), `plan_id` (nullable), `credits` (int, nullable), `auto_login` (bool, signup only), `max_redemptions` (nullable), `expires_at`, `campaign_tag`, `created_by`, `active` |
| `voucher_redemptions` | Who redeemed what, when. | `voucher_id`, `user_id`, `workspace_id` (nullable), `redeemed_at`, `meta` (jsonb) |
| `invitations` | Admin-issued invites (single + bulk). | `email`, `workspace_id` (nullable = signup-only invite), `role`, `token` (unique), `state` (`pending`/`accepted`/`revoked`/`expired`), `invited_by`, `expires_at` |
| `auto_approve_domains` | Email-domain auto-accept rules. | `domain` (unique), `workspace_id` (nullable), `default_role`, `created_by` |
| `signup_approvals` | Manual-review queue when auto-approve does not match. | `email`, `requested_workspace_id`, `state` (`pending`/`approved`/`rejected`), `reviewed_by`, `reviewed_at`, `note` |
| `feature_flags` | Server-readable kill switches. | `key` (unique), `enabled` (bool), `payload` (jsonb), `updated_by`, `updated_at` |
| `system_banner` | Global banner (one-row-active). | `message`, `level` (`info`/`warn`/`alert`), `active`, `expires_at`, `updated_by` |

### 2.2 Column additions

- `profiles.suspended` (bool, default false) - soft account lock; auth gate must check this.
- `subscriptions.plan_override_id` (uuid, fk -> `pricing_plans`, nullable), `plan_override_expires_at` (timestamptz, nullable), `plan_override_reason` (text, nullable) - admin temporary plan grant; nightly cron expires them.

### 2.3 RLS posture

- `admin_audit_log` - select for admins only via `has_role(auth.uid(),'admin')`; writes only via SECURITY DEFINER RPCs.
- `vouchers`, `auto_approve_domains`, `signup_approvals`, `feature_flags`, `system_banner` - admin-only read/write; narrow SECURITY DEFINER fns expose what the public app needs (`get_active_banner()`, `get_flag(key)`).
- `voucher_redemptions` - admin read; user can read own; writes only via `redeem_voucher` RPC.
- `invitations` - admin read/write; invitee reads own row by token via SECURITY DEFINER `get_invitation_by_token`.

### 2.4 GRANTs (mandatory)

Every new public table gets, in the same migration: GRANT to `authenticated` only where a policy permits, plus GRANT ALL to `service_role`. No `anon` grants on admin tables; public reads go through SECURITY DEFINER fns.

---

## 3. Server functions (one module per tab)

All in `src/lib/` (client-safe path, NOT `src/server/`). All gate on `has_role(auth.uid(),'admin')` inside `.handler()`. Every mutation appends one row to `admin_audit_log` in the same transaction.

### `src/lib/admin.functions.ts` - People · Users panel
- `adminSearchUsers({ q, limit, offset })` - paged list joining profile + plan + credit balance.
- `adminGetUserDetail({ userId })` - identity, plan, credits, workspaces, last 50 audit rows.
- `adminGrantCredits({ userId, delta, reason })` - signed delta; ledger + audit.
- `adminResetCreditCycle({ userId })` - clears monthly counter (preserves one-time grants).
- `adminOverrideUserPlan({ userId, planId, expiresAt, reason })`
- `adminSuspendUser({ userId, suspend, reason })` - flips `profiles.suspended`.
- `adminRevokeSessions({ userId })` - Supabase auth admin invalidates refresh tokens.

### `src/lib/admin-invitations.functions.ts` - People · Invitations panel
- `adminCreateInvitation`, `adminBulkCreateInvitations({ csv })`, `adminListInvitations`, `adminRevokeInvitation`.
- `adminListAutoApproveDomains` / `adminUpsertAutoApproveDomain` / `adminDeleteAutoApproveDomain`.
- `adminListSignupApprovals` / `adminReviewSignupApproval`.

### `src/lib/admin-vouchers.functions.ts` - People · Vouchers panel
- `adminListVouchers`, `adminCreateVoucher`, `adminUpdateVoucher`, `adminDeactivateVoucher`, `adminListRedemptions`.

### `src/lib/redeem-voucher.functions.ts` - public-facing (not admin)
- `redeemVoucher({ code })` used by signup (`?voucher=`) and by an in-app "Redeem code" field.
  - Validates `active`, `max_redemptions`, `expires_at`.
  - **signup** kind: creates user if missing, enrolls into voucher's `planId`, credits the bonus, and if `auto_login=true` confirms the email server-side (`email_confirm: true`) and issues a session.
  - **credit_grant** kind: adds credits to the caller's workspace.
  - **plan_upgrade** kind: writes a `plan_override` on the caller's subscription.
  - Always inserts a `voucher_redemptions` row.

### `src/lib/admin-workspaces.functions.ts` - Workspaces tab
- `adminSearchWorkspaces`, `adminGetWorkspaceDetail`, `adminAddWorkspaceMember`, `adminRemoveWorkspaceMember`, `adminChangeMemberRole`, `adminGrantWorkspaceCredits`, `adminOverrideWorkspacePlan`, `adminTransferWorkspaceOwnership`, `adminSoftDeleteWorkspace`, `adminRestoreWorkspace`.

### `src/lib/admin-platform.functions.ts` - Platform tab
- `adminListFlags`, `adminUpsertFlag`, `adminDeleteFlag`.
- `adminGetBanner`, `adminSetBanner`.
- `adminListAuditLog({ actorUserId?, targetKind?, targetId?, since?, limit, offset })`.
- `adminSystemHealth()` - thin pass-through to `/api/public/health`; deep-link to `/govern`.

### Public-readable helpers (SECURITY DEFINER, no admin gate)
- `get_active_banner()` - used by the app shell.
- `get_flag(key text)` - backs `useFlag(key)` hook (5-min client cache).
- `get_invitation_by_token(token text)` - used by `/join/$token`.

---

## 4. Frontend

### 4.1 Routes
- `src/routes/_authenticated.admin.tsx` - existing shell; TabRow extended to 5 entries: `Overview · Pricing · People · Workspaces · Platform`.
- `src/routes/_authenticated.admin.people.tsx` - inner sub-tab row (Users / Invitations / Vouchers).
- `src/routes/_authenticated.admin.workspaces.tsx`
- `src/routes/_authenticated.admin.platform.tsx`

### 4.2 Patterns
- Detail views are shadcn `Sheet` drawers (keeps list context); no extra routes per record.
- Destructive actions go through `useConfirm()` (`docs/conventions/destructive-actions.md`); irreversible deletes (workspace hard-delete post window, voucher hard-delete) use typed-name match.
- Section headers use `.mono-label`; numbers carry units.
- Calm front + engine-room doctrine: ember sparingly (one primary CTA per drawer), mono caps for metadata, no decorative iconography.
- **Consequence-first** copy: "Suspend · blocks sign-in", "Grant 500 credits · adds to monthly balance", "Soft-delete · 30-day restore window".

### 4.3 Top-of-tab outcome statements (one line each, calm front)
- People: "Manage who can use Cadence, grant credits, and run promo campaigns."
- Workspaces: "Inspect tenants, adjust plans, and move ownership."
- Platform: "Pull kill switches, post banners, and read the admin audit trail."

---

## 5. Signup-flow wiring

1. `/signup?voucher=CODE` -> before account creation, call `redeemVoucher({code})`.
   - signup + auto_login: creates user with `email_confirm: true`, enrolls plan, credits bonus, issues session, redirects to `/`.
   - Else: normal signup, redemption recorded on first login.
2. `/signup` (no voucher) -> check `auto_approve_domains` for the email domain. Matched -> accept into mapped workspace/role. Unmatched -> write `signup_approvals` row in `pending` + show "Your request is with the admins."
3. `/join/$token` - unchanged path; admin-issued invitations land here too.

---

## 6. Cron hooks

- `src/routes/api/public/hooks/plan-override-tick.ts` - nightly: clears `plan_override_*` where `expires_at < now()`; one audit row per expiry.
- `src/routes/api/public/hooks/invitation-expire-tick.ts` - nightly: marks expired invitations.
- Both follow `/api/public/hooks/*` cron-key auth (see `architecture/integrations.md`).

---

## 7. Build order (the pick-list)

Strict order. Each step is one commit. Per-step gates: tsc 0 + build green + targeted tests + audit-row written.

1. **Migration** - tables + columns + GRANTs + RLS + helper fns.
2. **`admin.functions.ts`** + Users panel (search + drawer + grant credits + suspend + plan override).
3. **`admin-invitations.functions.ts`** + Invitations panel.
4. **`admin-vouchers.functions.ts`** + `redeem-voucher.functions.ts` + Vouchers panel + signup wiring.
5. **`admin-workspaces.functions.ts`** + Workspaces tab.
6. **`admin-platform.functions.ts`** + Platform tab + `useFlag` hook + banner renderer in app shell.
7. **Cron hooks** for plan-override + invitation expiry.
8. **Doc-loop close:** flip `feature-dashboard.md` row, append `plan.md` §4 line, update `docs/features/admin-console.md` Status from "v2 planned" to "v2 shipped".

---

## 8. Acceptance / how to verify

- Grant admin to a test user -> all 5 tabs load; non-admin -> 404/redirect.
- **People · Users:** search by email, open drawer, grant +100 credits -> balance reflects + audit row exists. Suspend -> sign-in blocked. Override plan to Galaxy yearly, 7-day expiry -> entitlement reflects; nightly tick clears it.
- **People · Invitations:** create single invite -> link works; bulk CSV of 3 -> 3 pending rows; revoke -> link 404s.
- **People · Vouchers:** create signup voucher `LAUNCH50` (Galaxy, +500 credits, auto-login, max 50, expires 30d). `/signup?voucher=LAUNCH50` -> user lands on `/` already signed in, on Galaxy, with 500 bonus credits, redemption row carries campaign tag.
- **Workspaces:** search, open detail, change member from `member` -> `admin`, grant +1k credits to pool, transfer ownership, soft-delete + restore.
- **Platform:** flip flag `experimental.x` ON -> `useFlag('experimental.x')` returns true within 5 min. Publish banner -> renders globally; clear -> disappears. Audit log shows every prior action with actor + payload.

---

## 9. Out of scope (do not silently expand)

- Full write-as-user impersonation. Read-only support view (drawer activity tab) only; full impersonation is a separate founder-gated initiative.
- Per-user feature flags (current flags are global).
- Multi-currency on vouchers (USD only, matches pricing).
- Email-delivery polish (reuses existing transactional templates).

---

## 10. Related

- [`../features/admin-console.md`](../features/admin-console.md) - feature page (v1 status + v2 pointer).
- [`../features/billing.md`](../features/billing.md), [`../features/credits.md`](../features/credits.md), [`../features/pricing.md`](../features/pricing.md) - the surfaces this admin manages.
- [`../../architecture/security.md`](../../architecture/security.md) - admin role pattern (`user_roles` + `has_role`).
- [`../conventions/destructive-actions.md`](../conventions/destructive-actions.md), [`../conventions/ui-voice.md`](../conventions/ui-voice.md), [`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md) - UI rules every panel obeys.
- [`./feature-dashboard.md`](./feature-dashboard.md) - board row for this initiative.
- [`./SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) - live cursor.
