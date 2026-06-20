# Admin console (`/admin/*`, inbuilt)

> _Created: 2026-06-20 · Last updated: 2026-06-20 (Lovable cycle: v1 shipped)_

> Status · **v1 shipped 2026-06-20 (◐).** Two tabs live: **Overview** + **Pricing**. v2 (People · Workspaces · Platform) is the next initiative — plan below.

## v1 (shipped)

- **Overview tab:** credits-engine ON/OFF master toggle (`adminSetCreditsEnabled` → `app_settings.credits_enabled` flag, read by `credits_enabled()` SQL fn). Admin roster: list current admins, add admin by email, remove admin. Server fns in `src/lib/pricing.functions.ts` (`adminListAdmins`, `adminAddAdminByEmail`, `adminRemoveAdmin`, `adminBootstrapSelfAsAdmin`).
- **Pricing tab:**
  - Plan catalog CRUD (`adminUpsertBundle`, `adminDeleteBundle`) — edits clone-and-archive Stripe Prices so existing subscribers stay on their original price.
  - Top-up bundle catalog CRUD (`adminUpsertTopupBundle`, `adminDeleteTopupBundle`).
  - **"Most popular" marker** on plan rows: exactly one plan per audience can carry it; controls the centered badge on the Plan picker.
  - **"Best value" marker** on top-up bundles per group (Starter / At scale).
- **Access:** every admin RPC is `SECURITY DEFINER` and gates on `has_role(auth.uid(),'admin')`. First admin granted via `adminBootstrapSelfAsAdmin`.

## v2 (planned, next initiative)

Three new tabs (clustered, not five), each with deep drawers, so functionality is not lost:

1. **People** — Users panel (search, drawer with identity / plan & billing / credits / workspaces / access / activity), Invitations panel (single + bulk CSV + pending queue + auto-approve domains + manual review), Vouchers & promos panel (signup vouchers with auto-login, credit-grant vouchers, plan-upgrade vouchers, campaign tags, redemption log).
2. **Workspaces** — search, members + roles, workspace-level credit grants, plan override, transfer ownership, soft delete.
3. **Platform** — feature flags & kill switches, system banner publisher, audit log viewer, system health peek.

**Backend:** all admin mutations remain SECURITY DEFINER + `has_role` + atomic write to `admin_audit_log`. New tables: `admin_audit_log`, `vouchers`, `voucher_redemptions`, `invitations`, `auto_approve_domains`, `signup_approvals`, `feature_flags`, `system_banner`; plan-override columns on `subscriptions`. New server-fn modules: `admin.functions.ts`, `admin-invitations.functions.ts`, `admin-vouchers.functions.ts`, `admin-workspaces.functions.ts`, `admin-platform.functions.ts`, `redeem-voucher.functions.ts`.

> **Cold-buildable build bible: [`../planning/admin-console-v2-plan.md`](../planning/admin-console-v2-plan.md).** Any agent picking this up reads that doc first — it carries the migration spec, per-module server-fn list, frontend pattern rules, signup wiring, cron hooks, strict build order, and acceptance checklist. Do not re-derive scope from this page; this page is the index, the build bible is the contract.

## What it does

The single inbuilt admin hub. Sits inside the app, same auth, same theme. No separate portal.

- `/admin` — admin shell with left nav (Pricing, Members, Workspaces, Flags as placeholders for future surfaces).
- `/admin/pricing` — table editor for the pricing catalog (plans, credit bundles, feature lines, top-up bundles). Edits hit service-role server fns and clone-and-archive Stripe Prices so existing subscribers stay on their original price.

## Access control

- Gated server-side by `has_role(auth.uid(), 'admin')` (the canonical separate-roles pattern; `public.app_role` enum + `user_roles` table + security-definer `has_role()` fn).
- Granting the first admin is a one-off via the backend:
  `insert into public.user_roles(user_id, role) values ('<uid>', 'admin');`

## How it works (planned, Phase 8)

- **Pricing editor:** reads `pricing_plans` / `pricing_bundles` / `pricing_features` / `pricing_topup_bundles`. Edits go through a service-role server fn that:
  1. Clones a new Stripe Price (recurring or one-time) for any price/credit change.
  2. Archives the old Stripe Price (existing subs untouched; new checkouts use the new id).
  3. Updates the row with the new `stripe_price_id_*`.
- **Free edits** (copy, sort order, recommended toggle, active toggle): plain row update, no Stripe call.
- **Future:** Members, Workspaces, Flags surfaces share the same admin shell.

## How to verify (planned)

- Grant admin to a test user → `/admin` loads; non-admins get 404/redirect.
- Edit Cluster 1k monthly price from $25 → $29: new Stripe Price created, old archived, `/pricing` shows $29, existing Pro 1k subscriber is unchanged (still on the old price until they next change bundle/recurrence).
- Toggle a bundle inactive → disappears from `/pricing` and from the Settings → Plan bundle picker; existing subs keep working.

## Related

- [`./billing.md`](./billing.md)
- [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) — G12 Phase 8
- [`../../architecture/security.md`](../../architecture/security.md) — admin role