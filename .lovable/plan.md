## Two phases in this plan

**Phase A is documentation only** (close the loop on what is already shipped for pricing + credits + subscription, so Claude Code / Antigravity / Gemini do not re-do it). **Phase B is the admin console build.** Phase A ships first so nothing else duplicates effort.

---

## Phase A · Document what is already shipped (zero code)

Per the repo's Documentation Operating System rule, status lives only in `docs/planning/SOURCE-OF-TRUTH.md` and is mirrored in the feature dashboard; every shipped feature gets a feature doc with a verify checklist.

### A1. Update the SSOT
`docs/planning/SOURCE-OF-TRUTH.md`:
- Section 0 (cursor): close out the pricing + subscription + credits work, set cursor to "Admin console phase 2".
- Section 3 (queue): mark the pricing items done; queue the new Admin items.
- Section 6 (progress log): one terse dated line per shipped slice — Personal/Teams tabs, Cluster monthly+yearly, Constellation monthly-only, current-plan highlight, single popular badge, Star nudge copy, tiered credit bundles with "Best value", Stripe-ID column lockdown, admin pricing CRUD, credits-engine ON/OFF, admin add/remove.

### A2. Flip the feature dashboard rows
`docs/planning/feature-dashboard.md`:
- Pricing catalog (plans + top-ups) → ✅ Done, owner Lovable, link to feature doc.
- Subscription mgmt (Stripe Checkout, portal, cancel/resume) → ✅ Done.
- Credits engine + monthly grant + reset + ledger → ✅ Done.
- Admin console v1 (overview + pricing tabs + admin roster) → ✅ Done.
- Add new rows for Admin v2 items (see Phase B), Tier 1 (Lovable-owned), ranked under monetization.

### A3. Refresh / create feature docs
- `docs/features/pricing.md` — confirm it reflects: 5-tier catalog (Star · Cluster · Constellation · Galaxy · Cosmos), Personal vs Teams & Enterprise toggle, Cluster billing rules (monthly + yearly), Constellation monthly-only, single most-popular highlight, current-plan visual treatment, Star "Free, upgrade anytime" nudge copy. Verify checklist included.
- `docs/features/credits.md` — confirm it captures: monthly grant per tier, top-up tiered bundles (Starter packs vs At scale, 250 → 250,000), "Best value" badge logic, ledger model, admin grant/adjust (placeholder until Phase B ships it), engine ON/OFF flag.
- `docs/features/billing.md` — Stripe Checkout + customer portal + webhook, env (sandbox vs live), Stripe-ID column lockdown migration, cancel/resume semantics.
- `docs/features/admin-console.md` — rewrite to cover v1 scope (Overview + Pricing + Admin roster) and list v2 sections coming (Phase B).

### A4. Build log + decision log
- `plan.md` §4 — one line per shipped slice with WHY.
- `docs/strategy/session-decisions.md` — log the pricing-architecture rulings (5-tier scheme, billing rules per tier, single popular highlight, tiered credit bundles strategy).

### A5. Conventions consulted, not changed
No new convention files. The work followed `engine-room-doctrine.md`, `ui-voice.md`, `destructive-actions.md`, `inline-management.md`, `humanized-output.md`, `data-minimalism.md` — call those out in `pricing.md` and `admin-console.md` so future agents know which rules govern these surfaces.

Phase A delivers nothing visible in the app; it stops duplicate work. It is done in one commit batch.

---

## Phase B · Admin console v2 (the real plan)

### What I heard, written back so you can correct me

1. Do not bloat to 5 tabs. Cluster sensibly into 3 tabs with deep drawers — same functionality, less navigation.
2. Think like an admin of a B2B agentic platform, not a generic SaaS:
   - **Invitations** (single, bulk CSV, auto-approve domains, manual review queue).
   - **Promos & vouchers** (signup codes → auto-enroll user into a plan/credit grant; campaigns; expiry; usage caps).
   - **Trials & test runs** (extend trial, give a user X days of Constellation, schedule expiry).
   - **User lifecycle** (search, suspend, impersonate-as-readonly for support, password reset link, force re-verify).
   - **Workspace lifecycle** (transfer ownership, change plan, grant credits at workspace level, member roles, soft delete).
   - **Credit ops** (grant/adjust/reset at user OR workspace level with audit reason).
   - **Plan overrides** (promote a user to Cluster without Stripe charge for evaluation; auto-revert at a date).
   - **Feature flags + kill switches** (turn an agent off platform-wide, throttle a surface).
   - **Announcement banner** (push a banner to all signed-in users).
   - **System health peek** (live agent run count, credits engine state, recent incidents — link out to Govern).
   - **Audit log** (every admin action — who, what, on whom, when, reason).
3. Backend is built, not just UI.
4. Documentation closed every time.

If any of that is wrong, say so before I build.

### IA — three tabs, not five

The new admin layout (alongside the existing Overview and Pricing, which stay):

```text
Admin
├─ Overview          (existing: credits-engine ON/OFF, quick stats, link to System health)
├─ Pricing           (existing: catalog, top-up bundles, popular flag)
├─ People            (NEW: users, invitations, vouchers — one tab, three sub-panels)
├─ Workspaces        (NEW: workspaces, members, workspace-level credit grants)
└─ Platform          (NEW: feature flags, kill switches, banner, audit log)
```

Five labels total in the tab strip. Two of them are existing. Three new. Each new tab is a single page with a clear sub-section split, so functionality is not lost.

#### Tab 3 · People (one tab, three panels)

**Users panel (default):**
- Search by email/name, paginated 25/page.
- Row: email · name · plan · credit balance · workspaces · last active · status.
- Row click → drawer:
  - **Identity:** email, name, signup date, source (organic / invite / voucher), last sign-in.
  - **Plan & billing:** current tier, interval, renewal/expiry. Actions: **Override plan** (pick tier + expiry; flagged `admin_override`; auto-reverts), **Restore to paid**.
  - **Credits:** balance (included + top-up), monthly grant, last reset. Actions: **Grant credits** (amount + reason), **Adjust** (debit, reason), **Reset cycle now**.
  - **Workspaces:** list with role. Link to Workspaces tab filtered to that one.
  - **Access:** roles checkboxes (admin), suspend toggle.
  - **Activity:** last 20 ledger entries, last 20 sign-ins, last 5 admin actions targeting this user.

**Invitations panel:**
- **Send single invite:** email + role (member/admin) + workspace (optional) + welcome message + auto-grant credits (optional).
- **Bulk invite:** CSV upload (email, role, workspace, credits) → preview table → send all.
- **Pending invites table:** sortable, with **Resend**, **Revoke**, **Bulk approve**, **Bulk revoke**.
- **Auto-approve domain rules:** add `@yourco.com` rules so anyone signing up with that domain skips review (with optional auto-assign workspace + tier).
- **Approval queue:** when auto-approve is off, new signups wait here for one-click approve/reject (bulk too).

**Vouchers & promos panel:**
- **Voucher list:** code · type (signup unlock / credit grant / plan upgrade) · benefit · usage (X of Y) · valid window · status.
- **Create voucher:**
  - Code (auto-generate or custom).
  - Type: *Signup voucher* (anyone redeeming this on signup is auto-logged-in, auto-placed on tier T, gets N credits), *Existing-user voucher* (redeems for credits/plan), *Workspace voucher* (whole workspace gets benefit).
  - Benefit: tier (Star/Cluster/Constellation/Galaxy/Cosmos), credit grant, plan duration (e.g. 30 days of Cluster).
  - Limits: max uses total, max uses per user, expiry date, restrict to email domain.
  - Auto-flags: `auto_login_after_signup` (yes/no), `bypass_email_verification` (yes/no, default no).
- **Redemption log:** who redeemed, when, from what surface.
- **Campaign view:** group vouchers by tag (e.g. `yc-w26`, `producthunt-launch`) for tracking conversion.

#### Tab 4 · Workspaces

- Search by name / owner.
- Row → drawer:
  - Members list with role; add / remove / change role / bulk invite to workspace.
  - Workspace credit balance + **Grant credits at workspace scope** (separate from per-user grants).
  - Plan + override.
  - **Transfer ownership** (typed-name confirmation).
  - **Soft delete** (typed-name match per `destructive-actions.md`).
  - Connected sources count + link to that workspace's Sync surface.

#### Tab 5 · Platform

- **Feature flags & kill switches:** rows for each registered flag/surface (e.g. `agents.scout.enabled`, `chat.streaming.enabled`, `web_access.enabled`); toggle ON/OFF/throttle %; reason + audit.
- **System banner:** title + body + severity (info / warning / critical) + audience (all signed-in / tier filter) + window. Live preview.
- **Audit log:** every admin action (grant, adjust, override, suspend, voucher created, invite revoked, flag toggled, banner pushed). Filter by actor, action, target, date. CSV export.
- **System health peek:** small cards — credits engine ON/OFF, active agent runs, last 5 incidents (from `cost_incidents`), eval suite last-run pass rate. Deep links to Govern.

### Backend — what gets built

Per `Engine-Room` doctrine and `BBI` gate: every admin mutation is a SECURITY DEFINER RPC verified by `has_role(auth.uid(),'admin')`, audited inside the RPC so the trail cannot be bypassed.

**Migration 1 — schema:**
- `admin_audit_log(id, actor_user_id, action text, target_user_id, target_workspace_id, metadata jsonb, reason text, created_at)`.
- `profiles.suspended boolean default false`, `profiles.suspended_reason text`.
- `vouchers(id, code unique, type, benefit jsonb, max_uses, uses_count, max_uses_per_user, valid_from, valid_until, email_domain, auto_login, bypass_verification, campaign_tag, created_by, created_at, status)`.
- `voucher_redemptions(id, voucher_id, user_id, redeemed_at, surface)`.
- `invitations(id, email, role, workspace_id, credits_grant, status [pending/approved/revoked/redeemed], expires_at, sent_by, sent_at)` + bulk-import staging.
- `auto_approve_domains(id, domain, default_role, default_workspace_id, default_tier, created_by)`.
- `signup_approvals(id, user_id, status [pending/approved/rejected], decided_by, decided_at, reason)`.
- `feature_flags(key text pk, enabled bool, throttle_pct int, payload jsonb, updated_by, updated_at)`.
- `system_banner(id, title, body, severity, audience jsonb, starts_at, ends_at, status, created_by)`.
- Plan-override fields on `subscriptions`: `admin_override boolean`, `override_until timestamptz`, `override_reason text`.
- All with GRANTs + RLS scoped to admins via `has_role`.
- All audit-writing RPCs append to `admin_audit_log` atomically.

**Migration 2 — RPCs / triggers:**
- `admin_grant_credits(_user_id, _amount, _reason)`, `admin_adjust_credits`, `admin_reset_cycle`.
- `admin_grant_workspace_credits(_ws_id, _amount, _reason)`.
- `admin_override_plan(_user_id, _tier, _until, _reason)` + nightly job to auto-revert expired overrides.
- `admin_suspend_user(_user_id, _suspended, _reason)`.
- `admin_send_invitation(_email, _role, _ws_id, _credits, _message)` + `admin_bulk_send_invitations(_rows jsonb)`.
- `admin_approve_signup(_user_id)` / `admin_reject_signup(_user_id, _reason)` / `admin_bulk_approve(_ids[])`.
- `admin_upsert_auto_approve_domain`, `admin_delete_auto_approve_domain`.
- `admin_create_voucher`, `admin_revoke_voucher`, `redeem_voucher(_code)` (callable by any signed-in user, applies benefit + writes redemption row + handles plan override / credit grant; signup version handles auto-login by short-circuiting the post-signup gate).
- `admin_set_feature_flag(_key, _enabled, _throttle, _payload, _reason)`.
- `admin_publish_banner(_title, _body, _severity, _audience, _starts, _ends)`.
- `admin_transfer_workspace`, `admin_soft_delete_workspace`, `admin_set_member_role`.

**New server-fn modules:**
- `src/lib/admin.functions.ts` (users, audit, suspend, plan-override, credit grant/adjust).
- `src/lib/admin-invitations.functions.ts` (single/bulk invites, approval queue, auto-approve domains).
- `src/lib/admin-vouchers.functions.ts` (CRUD, redemption, campaign view).
- `src/lib/admin-workspaces.functions.ts` (workspace ops).
- `src/lib/admin-platform.functions.ts` (flags, banner, audit log read).
- `src/lib/redeem-voucher.functions.ts` (public-ish, called on signup and from settings).

**Engine integration:**
- Auth gate: respect `profiles.suspended` → bounce to "account paused" screen.
- Signup flow: accept optional `?voucher=` param → call `redeem_voucher` post-create → if `auto_login` true, skip email verification dance and land in app.
- Plan-override nightly cron in `/api/public/hooks/plan-override-tick.ts`.
- Feature flags read through a thin `useFlag(key)` hook backed by a 5-min cache.
- Banner rendered by root layout based on `system_banner` query.

### Frontend wiring

- `src/routes/_authenticated.admin.people.tsx` (3 panels via sub-tab strip inside the tab).
- `src/routes/_authenticated.admin.workspaces.tsx`.
- `src/routes/_authenticated.admin.platform.tsx`.
- Update `_authenticated.admin.tsx` TabRow to 5 entries.
- Drawers: shadcn `Sheet` with sectioned content; numbers carry `mono-label` headers; all destructive actions go through `useConfirm()` with typed-name match where irreversible.
- Copy follows the voice anchor: consequence-first ("Grant 500 credits · adds to balance", "Suspend account · blocks sign-in immediately"), no em/en dashes, no AI-tell words.
- Engine-Room compliance: top of each tab states the outcome ("Run people"), not the mechanism. Raw audit log lives under Platform tab (deepest door).

### Tests

- Unit: voucher benefit application, plan-override expiry calc, feature-flag throttle math.
- Integration: RPCs reject non-admins; audit log row written for every mutation; bulk invite handles 1000 rows; voucher max-uses race-safe; signup with voucher auto-logs in.

### Doc closure (Phase B)

- Update SSOT §0 / §6 as each slice ships.
- Feature dashboard rows for each of: Users mgmt, Invitations, Vouchers, Workspaces mgmt, Plan overrides, Feature flags, System banner, Audit log. Each with a verify link.
- Feature docs (one per item) in `docs/features/`.
- One line per slice in `plan.md` §4.
- Decision log entry for the "3 tabs, not 5" IA choice and the voucher signup-auto-login design.

### Build order (one slice per commit, verifiable each time)

1. Phase A docs (no code).
2. Migration 1 + Migration 2 + audit log RPCs.
3. `admin.functions.ts` + Users panel of People tab + suspend + credit grant + plan override.
4. Workspaces tab + workspace credit grant + transfer/soft-delete.
5. Invitations panel (single + bulk + queue + auto-approve domains).
6. Vouchers panel + `redeem_voucher` + signup flow integration + auto-login path.
7. Platform tab: feature flags + banner + audit log viewer + system health peek.
8. Auth-gate suspension respect + plan-override nightly cron.

### What I will NOT touch

- Existing Overview tab logic, Pricing tab, the user-facing `/settings` billing surface, the pricing-engine backend, the agent loop, or anything outside the admin console scope.

---

**Confirm before I begin:** (a) Phase A first, in one commit batch, then Phase B; (b) 3 new tabs (People · Workspaces · Platform) plus existing Overview + Pricing; (c) vouchers can both grant signup access and auto-log-in into a chosen tier with optional credit grant; (d) per-user and per-workspace credit grants are both supported, both audit-logged; (e) impersonation is read-only (no write-as-user) for support — say if you want full impersonation instead.