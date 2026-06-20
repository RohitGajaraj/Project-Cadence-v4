# Admin console (`/admin/*`, inbuilt)

> _Created: 2026-06-20 · Last updated: 2026-06-20_

> Status · Role gate + admin-editable pricing tables landed 2026-06-20 (Phase 2 of G12). `/admin` shell + `/admin/pricing` UI = Phase 8.

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