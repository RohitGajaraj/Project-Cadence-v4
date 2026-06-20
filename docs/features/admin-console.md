# Admin console (`/admin/*`, inbuilt)

> _Created: 2026-06-20 · Last updated: 2026-06-20 (Lovable cycle: v2 shipped)_

> Status · **v2 shipped 2026-06-20 (◐).** Five tabs live: **Overview** + **Pricing** (v1) and **People** + **Workspaces** + **Platform** (v2). All 8 steps of the v2 build bible are complete. Live on the founder's next publish (the v2 migrations + cron hooks apply then).

## Where the status is tracked (read this before checking the dashboard)

The Admin Console does **not** have its own row in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md). Its status is carried by **row 81 · `M-C-PRICE` · Pricing + entitlements (incl. Admin Console v1 + v2)**, inside the Lovable-owned monetization block. Interpret that row as follows:

- **Status glyph on row 81** (`◐` partial / `✅` shipped / `⬜` not started) reflects the **whole** monetization + admin block, not the admin console alone. The admin console specifically is shipped pending publish; row 81 stays `◐` until the founder also provisions live Stripe secrets and flips the credits engine ON.
- **Owner = `Lovable`** on row 81 means a Claude / Antigravity / Gemini lane must **not** pick it up. Any change to the admin console (new tab, new RPC, new schema) goes through a Lovable cycle and updates this page + the build bible + `plan.md` §4 in the same change. This rule is also enforced by the dashboard's "Lovable-owned + frozen" block.
- **% completion** shown on row 81 is a blended figure for billing + credits + pricing + admin console. Do not read it as admin-console-only progress.
- **Source of truth for admin console scope, acceptance, and behavior** is this feature page and the build bible [`../planning/admin-console-v2-plan.md`](../planning/admin-console-v2-plan.md); dashboard row 81 only carries a one-line summary + pointer back here.
- **Where to log a new admin-console change:** (a) update this page's status line + the relevant `vN` section, (b) append a one-liner to `plan.md` §4 with the WHY, (c) refresh the "Last updated" stamp on row 81 of the dashboard and adjust its one-line summary if scope shifted. No new dashboard row.

## v2 (shipped)

- **People tab** (`/admin/people`) — Users search + drawer (identity, plan override w/ expiry + reason, credit grants, monthly credit reset, suspend/restore, per-user audit log), **Invitations panel** (single + bulk invites, auto-approve domain rules, manual signup-approval queue), **Vouchers panel** (signup vouchers w/ auto-login, credit-grant vouchers, plan-upgrade vouchers, campaign tags, redemption log + public `redeemVoucher` RPC).
- **Workspaces tab** (`/admin/workspaces`) — Search tenants, drawer for members + roles, workspace-level credit grants, plan override, ownership transfer, soft-delete + restore.
- **Platform tab** (`/admin/platform`) — Feature flags / kill switches, system-banner publisher, full audit-log viewer, system-health peek.
- **Backend:** 8 new tables (`admin_audit_log`, `vouchers`, `voucher_redemptions`, `invitations`, `auto_approve_domains`, `signup_approvals`, `feature_flags`, `system_banner`), `profiles.suspended`, `subscriptions.plan_override_tier/expires_at/reason`, all admin RPCs `SECURITY DEFINER` + `has_role(auth.uid(),'admin')` + atomic write to `admin_audit_log`. Server-fn modules: `admin.functions.ts`, `admin-invitations.functions.ts`, `admin-vouchers.functions.ts`, `admin-workspaces.functions.ts`, `admin-platform.functions.ts`. Public voucher redemption in `redeem-voucher.functions.ts`.
- **Security hardening (same cycle):** mirrored `stripe_customer_id` / `stripe_subscription_id` from `accounts` / `subscriptions` / `workspaces` into `*_billing_secrets` tables; revoked column-level `SELECT` on the originals for `authenticated` + `anon`; only `service_role` (webhooks + admin RPCs) can read.
- **Cron:** `/api/public/hooks/admin-expiry-tick` calls `cron_tick_admin_expiries()` nightly to clear expired plan overrides and invitations.

## How to verify (v2)

- Grant admin (`adminBootstrapSelfAsAdmin` or insert into `user_roles`) → `/admin` shows the People / Workspaces / Platform tabs alongside Overview / Pricing.
- People → search a user → drawer opens → grant 500 credits, set a Star override expiring in 7 days → audit log shows both actions.
- Invitations → create a single invite + a bulk CSV; add `@company.com` to auto-approve domains; queue a signup for manual review and approve it.
- Vouchers → create a 1-month Cluster voucher, redeem from a fresh signup with `?voucher=CODE`, see the redemption log entry.
- Workspaces → search a tenant → transfer ownership → soft-delete → restore.
- Platform → flip a feature flag, publish a banner, scroll the audit log.

## v1 (shipped)

- **Overview tab:** credits-engine ON/OFF master toggle (`adminSetCreditsEnabled` → `app_settings.credits_enabled` flag, read by `credits_enabled()` SQL fn). Admin roster: list current admins, add admin by email, remove admin. Server fns in `src/lib/pricing.functions.ts` (`adminListAdmins`, `adminAddAdminByEmail`, `adminRemoveAdmin`, `adminBootstrapSelfAsAdmin`).
- **Pricing tab:**
  - Plan catalog CRUD (`adminUpsertBundle`, `adminDeleteBundle`) — edits clone-and-archive Stripe Prices so existing subscribers stay on their original price.
  - Top-up bundle catalog CRUD (`adminUpsertTopupBundle`, `adminDeleteTopupBundle`).
  - **"Most popular" marker** on plan rows: exactly one plan per audience can carry it; controls the centered badge on the Plan picker.
  - **"Best value" marker** on top-up bundles per group (Starter / At scale).
- **Access:** every admin RPC is `SECURITY DEFINER` and gates on `has_role(auth.uid(),'admin')`. First admin granted via `adminBootstrapSelfAsAdmin`.

> **Build bible (now historical):** [`../planning/admin-console-v2-plan.md`](../planning/admin-console-v2-plan.md) — Steps 1-8 all shipped. Kept as the cold-buildable record of intent + acceptance.

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