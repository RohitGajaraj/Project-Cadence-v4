## Resolved doubts (from this turn)

- **Admin pricing console = inbuilt.** New gated route `/admin/pricing` inside a broader `/admin` hub (same app, same auth, same theme). Future admin surfaces (member invites, workspace controls, kill switches, audit viewer) plug in next to it. No separate portal.
- **Top-ups live on a separate page**, not the main Plan tab. `/settings/credits` holds bundles, balance, cycle anchor, ledger. The Plan tab carries only a subtle "Need more credits? →" link to it. Anthropic pattern.
- **Annual toggle per paid card** with live "Save $X" badge stays in scope (×10 = ~17% off).
- **Per-card feature list** rendered from a single DB source so `/pricing`, Settings → Plan, and admin edits never drift.

## Closed documentation loop (runs at every phase, non-negotiable)

This is folded into each phase below. Per the repo rule (`AGENTS.md` §5), a phase isn't done until its docs are true. **Before build:** plan committed + SSOT cursor flipped + dashboard row claimed + feature-doc skeleton created. **During build:** update SSOT progress log + `plan.md` §4 entry per shipped sub-ID. **After each phase:** flip dashboard row to ✅, update feature doc with how-to-verify, log decision in `session-decisions.md`, append reasoning to `strategic-inputs-log.md` if strategic.

**Docs touched every phase:**
- `docs/planning/SOURCE-OF-TRUTH.md` (cursor + progress)
- `docs/planning/feature-dashboard.md` (status row + Active-claims)
- `docs/planning/feature-backlog.md` (live board + F-IDs)
- `docs/features/billing.md` + `docs/features/credits.md` + `docs/features/admin-console.md` (new feature pages, how-to-verify)
- `plan.md` §4 (dated build-log line per ship)
- `architecture/data.md` (new tables), `architecture/security.md` (admin role + RLS), `architecture/runtime.md` (credit metering flip)
- `docs/strategy/session-decisions.md` (pricing-model decision, top-up isolation decision)
- `docs/strategy/strategic-inputs-log.md` (why credit-bundle model + admin-console reasoning)
- `docs/conventions/engine-room-doctrine.md` (top-up isolation as Engine-Room application)

## Tier shape (placeholder prices, editable from admin console)

**Individual:** Star (free, 100/mo) · Cluster / Pro (500/1k/2k/5k @ $15/$25/$45/$99) · Constellation / Max (2k/5k/10k/25k @ $45/$99/$179/$399)
**Business:** Galaxy / Team (500/1k/2.5k/5k/10k per seat @ $20/$30/$55/$99/$179) · Cosmos / Enterprise ("Contact sales")
Annual on every paid tier = monthly × 10. Top-up bundles (separate page): 250 / 1k / 2.5k credits.

## Phases

### Phase 0 — Plan landed + docs primed (before any code)
Commit this plan. Create feature-doc skeletons (`billing.md`, `credits.md`, `admin-console.md`). Add board group **G12 — Stripe rail + admin pricing** to `feature-dashboard.md` with F-IDs F12.1–F12.9. Set SSOT §0 cursor to F12.1. Log decision in `session-decisions.md`.

### Phase 1 — Enable Stripe (Lovable-managed)
Call `enable_stripe_payments`. Confirms +3.5% tax bundle, no API-key handling. Doc: append to `billing.md`, note in `plan.md` §4.

### Phase 2 — DB tables for pricing (admin-editable source of truth)
Migration creates:
- `pricing_plans` (tier, display_name, tagline, sort_order, active)
- `pricing_bundles` (id, tier, credits, monthly_cents, yearly_cents, stripe_price_id_monthly, stripe_price_id_yearly, recommended, active)
- `pricing_features` (tier, label, sort_order)
- `pricing_topup_bundles` (credits, price_cents, stripe_price_id, active)
RLS: `SELECT` to `anon` + `authenticated` (so `/pricing` works logged-out); `INSERT/UPDATE/DELETE` service-role only. Seed from current `entitlements.ts` constants. Doc: update `architecture/data.md`, `architecture/security.md`.

### Phase 3 — Stripe SKU registration (one Product per tier, many Prices per bundle × recurrence)
Server fn `syncStripeCatalog()` walks `pricing_bundles` rows missing a `stripe_price_id_*` and creates Prices. Idempotent. Doc: `billing.md` "catalog sync" section.

### Phase 4 — Entitlements becomes DB-backed
`entitlements.ts` reads `pricing_*` tables (cached). Feature gates stay tier-level (memory, Critic, RBAC, SSO). Credit amount comes from active bundle. Doc: update `architecture/runtime.md`.

### Phase 5 — Checkout + portal server fns
- `createCheckoutSession({tier, bundleId, recurrence})` — main subscription.
- `createTopUpCheckout({bundleId})` — one-time, separate function, separate Stripe Product.
- `createBillingPortalSession()` — Customer Portal redirect.
Webhook hardened: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.{updated,deleted}` → write `accounts.{plan_tier, credit_bundle, stripe_*}` + `workspaces.plan_tier` + call `grantMonthlyAllowance` / `resetCreditCycle`. Top-up checkout grants credits without touching subscription. Doc: `billing.md`.

### Phase 6 — UI: Settings → Plan (clean, no top-up)
Two-toggle (Individual/Business). Cards reactive to DB. Annual toggle per paid card with live "Save $X" chip. Credit-bundle Select inside each card. "Manage subscription" button → portal. Single subtle line at bottom: **"Need more credits? →"** linking to `/settings/credits`. Public `/pricing` reuses the same component. Doc: update `billing.md` + Engine-Room note in `engine-room-doctrine.md`.

### Phase 7 — UI: `/settings/credits` (separate top-up page)
Credit balance card + cycle anchor + 3 top-up bundle buttons + recent ledger (last 20 grants/debits). Per-cycle cap rule: top-ups capped at 2× current monthly bundle. Doc: new `docs/features/credits.md` how-to-verify.

### Phase 8 — UI: `/admin` hub + `/admin/pricing` console
- `/admin` lands an admin shell (left nav: Pricing, Members, Workspaces, Flags placeholders).
- `/admin/pricing` = table editor for plans / bundles / features / top-ups. Edits hit service-role server fns. Stripe rule: price changes **clone-and-archive** (never mutate an existing Price; existing subs untouched). Active toggles archive/unarchive. "Recommended" + copy edits are free.
- Gated by `has_role('admin')` server-side. Doc: new `docs/features/admin-console.md`, update `architecture/security.md`.

### Phase 9 — Flip credits engine on
`credits_enabled()` returns true. Runtime chokepoint meters AI calls against credits. Doc: update `architecture/runtime.md`, `plan.md` §4.

### Phase 10 — Verify + close docs
Sandbox checkouts: every tier × bundle × recurrence, top-up bundles, portal cancel. Admin smoke test: edit Cluster 1k price → new Stripe Price cloned → `/pricing` shows new amount → existing Pro 1k subs untouched → new checkout uses new Price. Flip G12 rows to ✅. Final pass on all docs above. Founder demo notes added to `demo-credentials.md`.

## Out of scope
Cosmos self-serve, per-user credit allocation admin, memory-expiry enforcement, member-invite admin UI (placeholder nav only — separate feature later).

## Founder gates (one round before build)
1. Confirm **inbuilt `/admin/pricing`** under role-gated hub (vs. separate portal).
2. Confirm **top-ups on `/settings/credits`**, subtle link from Plan tab.
3. Annual = ×10 (17% off) OK?
4. Top-up cap "2× current monthly bundle per cycle" OK?
5. Flip `credits_enabled()` ON at Phase 9, or hold one cycle?
