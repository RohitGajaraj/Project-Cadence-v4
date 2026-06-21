# Workspace, Accounts, Tenancy, Monetization & the Credit Engine, Cross-Tool Implementation Plan (the build bible)

> _Created: 2026-06-19 · Last updated: 2026-06-19_

> **What this is.** The single, self-contained source of truth for the account / workspace / product tenancy redesign, the monetization model it carries, AND the credit engine that powers it. It holds the strategy, the justifications, the quantified model, and a build spec for every work item, written so **any tool (Claude Code, Antigravity, Gemini, Lovable, a fresh session) can pick up a single `WM-*` ID and build it from this doc alone**, with no dependence on the conversation that produced it. As of 2026-06-19 it also carries the **credit engine** (the cost-to-credit conversion math, per-tier amounts, grant/reset, top-ups, the debit logic, per-product attribution, and the margin levers), merged in from the parallel credits thread and segregated under §4.2.1 (`WM-M10` to `WM-M16`); see §2.7 for the merge.
>
> **Status:** PLAN (2026-06-19). Foundation lane is buildable now; Showcase lane is deferred. No feature code written yet; this doc + its registration are step one. **Credit engine (`WM-M10` to `WM-M16`) added 2026-06-19** (the two parallel threads, tenancy and credits, merged into this one source of truth per founder ruling; §4.2.1).
> **Maintainer rule:** update the item's status here, in `feature-dashboard.md`, and in `SOURCE-OF-TRUTH.md` in the same unit of work as any change (the closed-doc loop).
> **Owns the decision record with:** [`../strategy/session-decisions.md`](../strategy/session-decisions.md) (the decision) + [`../strategy/strategic-inputs-log.md`](../strategy/strategic-inputs-log.md) (the reasoning) + [`../strategy/byo-build-and-cadence-cloud.md`](../strategy/byo-build-and-cadence-cloud.md) Section 5.5 (the monetization canon this aligns to).

> [!IMPORTANT]
> **SUPERSESSION (2026-06-21): the Stripe rail described below for `WM-M3` / `WM-M13` was implemented differently by the Lovable 2026-06-20 cycle.** The LIVE rail is `src/lib/payments.functions.ts` (`createCheckoutSession`, `createPortalSession`, `getMySubscription`, `cancel/resumeMySubscription`, `createTopUpCheckout`) + the webhook `src/routes/api/public/payments/webhook.ts`, routed through the Lovable connector gateway (`connector-gateway.lovable.dev/stripe`). Env: `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY` (server) + `PAYMENTS_SANDBOX_WEBHOOK_SECRET` / `PAYMENTS_LIVE_WEBHOOK_SECRET` + `VITE_PAYMENTS_CLIENT_TOKEN` (client `pk_test_` / `pk_live_`) + `LOVABLE_API_KEY`. Tiers resolve via `lookup_keys` in `src/lib/billing-tier.ts`. The `src/routes/api/stripe/webhook.ts` + `STRIPE_SECRET_KEY` / `STRIPE_PRICE_*` references throughout this plan are historical / superseded (that webhook is dead/legacy: it hardcodes tier `'pro'` and writes only the now-RLS-revoked `workspaces.stripe_*` shim columns). The live rail is live-capable but currently sandbox/test-mode and dormant pending founder secrets (`PaymentTestModeBanner` shows the state). Canonical live docs: [`../features/billing.md`](../features/billing.md) + [`../features/credits.md`](../features/credits.md), and the master register [`feature-dashboard.md`](./feature-dashboard.md) (row `M-C-PRICE` + the `M-C-*` / `ADM-*` rows).

---

## 0. How to use this document (any tool, any session)

1. **To build something:** find its `WM-*` ID in the index (Section 4.0), jump to its spec. Each spec has: why, current state with file paths, what to build, files to touch, the migration, gotchas, acceptance criteria, verification, and dependencies. That is everything needed to build it cold.
2. **Pick order:** follow Section 5 (build order + dependencies). Respect `Depends on`. Claim the row in `feature-dashboard.md` before you start (flip to In Dev, add an Active-claims line) so parallel tools do not collide.
3. **Hard gates every tool MUST honor** (non-negotiable, from [`../../AGENTS.md`](../../AGENTS.md) and the SSOT standing rules):
   - **Build gate:** `bun run lint` + `tsc --noEmit` + `bun run build` all green before any commit. Never commit red.
   - **Humanized output:** zero em/en dashes and zero AI-cliche phrasing in anything authored or generated (the runtime sanitizer is the hard gate; authored docs follow it too). See [`../conventions/humanized-output.md`](../conventions/humanized-output.md).
   - **Migrations:** timestamped SQL in `supabase/migrations/`, RLS-aware, additive/forward-only, idempotent where possible; the migration-safety hook enforces this.
   - **Tenancy correctness:** every new table that holds tenant data carries the right scope column and an RLS policy; never trust client-side role checks.
   - **Commits:** explicit paths, a one-line WHY; branch off `main` (do not commit straight to the default branch); use a worktree for parallel work.
   - **Package manager is bun** (`bun install`, `bun run ...`). Not npm.
4. **Naming is presentation-only.** The database, Stripe, and RLS key on the **slugs** `free | pro | max | team | enterprise`. The **display names** (Constellation: Star / Cluster / Constellation / Galaxy / Cosmos) and the motif live only in `planPresentation()` + UI, so any tier can be renamed or re-themed later with a one-file edit, no migration. Build against slugs.
5. **Status truth** lives in [`feature-dashboard.md`](./feature-dashboard.md) (per-item board) and [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (front-door queue). This doc is the *how*; those are the *where it stands*.

---

## 1. Context and problem

Cadence's workspace layer was scaffolded but never given product thought: switching, settings, roles, ownership transfer, and "what a new user sees" are vague, and the moat object (decision memory) is scoped to the user, one level above the boundary the product sells. The investor-ready, fully-populated experience exists only for two `demo@` accounts, not for real signups.

This plan makes the **account -> workspace -> product** model the deliberate spine of the product, scopes the compounding memory so the moat and the implicit lock-in are enforced data facts, lands the team primitives (RBAC, invites, ownership transfer, move-product), defines a clean settings information architecture, and carries the account-level monetization model (with the credit engine arriving from a parallel thread onto a dormant seam). The seeded "showcase" experience for every new user is designed but deferred until the platform is roughly 50 to 60 percent complete and fine-tuned.

---

## 2. The locked model (decisions + justifications)

### 2.1 Boundary: Account -> Workspace -> Product (three levels)

- **Account / Org** owns billing, the plan tier, the AI credit pool, members/seats, and is the boundary memory pools across. A solo user has a personal account (one member); a team is the same structure with many members. One table models both.
- **Workspace** is a pooled container under the account (a company, a product area, a client, an initiative). Tenant data (signals, opportunities, PRDs, decisions, tasks, docs, conversations, traces, evals, memory) is workspace-scoped for isolation.
- **Product** (DB table `projects`, UI label "Product") is the unit of work under a workspace; products share the account's credit pool and are count-limited by tier.

### 2.2 Billing attaches at the ACCOUNT level (the flywheel)

Plan, credits, and Stripe billing live on the **account**, not the workspace. Per-workspace billing would tax the one thing that makes the product un-leaveable: if a new workspace cost a new plan, users would make fewer, less context would accrue, and the moat would be shallower. Account-level pooling means the more a user puts in, the deeper the moat. Workspace count is gated only at the free line (free = 1 workspace); past it, workspaces are generous/pooled, never per-workspace-billed. (Reconciled with the parallel credits/monetization thread and [`../strategy/byo-build-and-cadence-cloud.md`](../strategy/byo-build-and-cadence-cloud.md) Section 5.5.)

**Market evidence for the account-level call (2026-06-19 benchmark).** This is not a contrarian bet; it is the dominant pattern among products whose value compounds with usage. Lovable's per-project billing is the **outlier** and the wrong comp for us (it is a build tool, not a memory-compounding decision OS): it taxes the exact behavior, more products and workspaces, that deepens our moat, so users consolidate and the silos thin. Every platform whose value compounds with use pools at the org/account level and treats the sub-container as **cost attribution, not a separate bill**: Anthropic (Organization -> Workspaces), OpenAI (Organization -> Projects), Vercel/v0, Bolt (account token pool), Replit Pro (pooled). The per-seat-per-workspace billers, Linear and Notion, deliberately do the opposite, but they have **no per-workspace moat**; a workspace there is an admin silo, the inverse of our case. The reasoning + full benchmark are logged in [`../strategy/strategic-inputs-log.md`](../strategy/strategic-inputs-log.md) (2026-06-19) and feed [`../strategy/moat.md`](../strategy/moat.md) §7.

### 2.3 The moat is the decision layer; memory is one layer of it

Cadence's **scope** is end-to-end (it runs the whole product lifecycle as one governed loop); its **moat** is **owning the decision layer** (what to build, and was it right), which has no fast oracle, while vibe-coding tools own one station (the build), which is racing to zero. We out-scope the build tools (the whole loop) rather than out-building them; the build is a governed station within the loop (own or dispatched). **Memory is one layer of the moat, not the headline.** Full articulation, competition map, and objection Q&A: [`../strategy/moat.md`](../strategy/moat.md). The layers, deepest first: (1) the no-fast-oracle asymmetry; (2) outcome-labeled judgment (the closed decision -> shipped -> outcome -> was-it-right loop, which is what "memory" really is); (3) system-of-record (continuous, org-scoped, cross-tool); (4) the orchestration position (above and dispatching the build tools, ours or Lovable/Cursor); (5) governance and accountability.

For this plan's mechanics: scope decision memory to the workspace for isolation, and **pool recall across the account's workspaces for paid accounts** so it compounds. Lock-in is **gravity, not a wall**: a full data export does not export the tuned judgment + accrued memory, so keep export easy (it raises trust and word of mouth) and stay effectively un-leaveable. **Memory persistence is the primary charge lever** (free memory decays on a 30-day rolling window; paid persists); usage credits ride on top.

### 2.4 The tier ladder and quantified matrix

Display theme: **Constellation** (your product knowledge, mapped). Slugs are canonical; names are a skin (Section 2.8).

| Slug | Name | Workspaces | Products | AI credits | Memory | Collaboration |
|---|---|---|---|---|---|---|
| `free` | **Star** | 1 | 2 | base (1x), starter, sized for the "aha"; no top-ups | 30-day rolling decay | solo |
| `pro` | **Cluster** | generous/pooled | 3 | 5x; capped top-ups | persistent + pooled | solo |
| `max` | **Constellation** | pooled | ~5 | 20x; capped top-ups | persistent + pooled | solo |
| `team` | **Galaxy** | pooled, many | generous | pooled; capped top-ups | persistent + cross-workspace pooled | members + seats + RBAC + approval lanes; transparent per-seat price |
| `enterprise` | **Cosmos** | custom | custom | custom credit model (see notes) | persistent + pooled | SSO, SCIM, audit, residency, SLA; contact sales |

Notes:
- **We price the decision layer; build/host is never a value driver.** The reason-to-pay at every tier is a decision-layer capability (persistent + cross-workspace memory, Critic everywhere, the outcome/was-it-right loop, governance/approval lanes). AI credits are only the meter. We do NOT gate or price on build minutes, deploys, or hosting (build is dispatched and receded).
- **AI credits are the upgrade lever; product counts are secondary and tunable.** Free 2 / Pro 3 / Max ~5 are deliberately modest and NOT the headline. A solo PM upgrades Pro -> Max for **more AI credits (5x -> 20x) + priority**, not for products. Free gets 2 products specifically so the user feels cross-product memory carry.
- **Top-ups are a capped add-on, not an unlimited spigot** (Anthropic-style): paid tiers only, drawn from a separate purchased balance, with a per-cycle ceiling, and **off by default**. Free has no top-ups (running low = upgrade). This protects margin and keeps the one-subscription promise honest.
- **The primary free limiter is AI credits** (sized for the aha, not a full project), with 30-day rolling memory decay as the second pull toward upgrade.
- **Cross-workspace memory pooling** is a property of any **paid account** with more than one workspace, not a Team-only bolt-on.
- **Enterprise (Cosmos) credit models, pick per deal:** (a) seat-based pooled (per-seat allowance, pooled org-wide); (b) committed org pool (annual credit commitment, volume discount); (c) postpaid usage (metered, invoiced monthly, true-up); (d) BYOK or dedicated capacity (their keys / isolated, COGS off our book). Plus the non-credit value that is the real reason they pay enterprise: SSO/SCIM, audit, residency, SLA, support. Outcome-based pricing (charging on shipped outcomes) is credible here later given the moat, but deferred for now.

### 2.4.1 Usage-variant packaging (the Anthropic-style presentation, target model)

Decision 2026-06-19 (founder): present the ladder the way Anthropic Claude does, tuned to our moat. The slugs and the entitlements engine do not change; this is a presentation + packaging layer over §2.4, plus two new priced variants. It is documented here and scheduled as WM-M17 / WM-M18 / WM-M19 (deferred behind the core builds, picked up once the core elemental work lands; §4.0, §4.2.2).

**Two toggles, not one flat grid.**
- **Individual:** Star (`free`), Cluster (`pro`), Constellation (`max`).
- **Business:** Galaxy (`team`), Cosmos (`enterprise`).

**The "one plan name, many variants" trick (the core of the ask), in two places.**
- **Constellation (`max`)** is a single card with two usage variants chosen at checkout: "5x more usage than Pro" and "20x more usage than Pro" (a "Save" anchor on the higher one, the way Anthropic prices 20x at less-per-unit than 5x). It fills the documented Cluster-to-Galaxy gap: the power individual who has outgrown Pro but is not a team.
- **Galaxy (`team`)** is a single card with two seat variants: a Standard seat and a Premium seat, carrying the same 5x / 20x usage principle per seat (Standard about 25 to 30 dollars per seat; Premium higher; founder-gated).

**Copy rule (important).** A numeric usage multiplier ("Nx more usage than Pro") appears ONLY on Constellation and on Galaxy's seat variants. Star and Cluster are sold on features and benefits (persistent memory, Critic everywhere, share links, "higher usage" qualitatively), never a number, exactly like Anthropic's Pro card. Cluster's allowance is the silent reference unit that the Constellation and Galaxy multipliers multiply against.

**Cosmos (`enterprise`)** is per-seat plus usage at API / pay-as-you-go rates (pooled), plus per-user credit allocation and spend limits for fine-grained admin control. The per-user allocation rides on the WM-M14 per-member caps that already shipped (2026-06-19), so it is wiring + an admin surface, not new engine design.

**The Cadence tweak (the USP, not a copy).** Each tier's identity is the decision-layer capability (persistent + cross-workspace memory, Critic, the outcome / was-it-right loop, governance). The 5x / 20x and the seat variants are only the usage selector layered on top. We sell compounding judgment, not tokens; the variant is just how much of it you run. This protects margin (credits are sized in the grant, not the per-credit price; §2.6) and separates us from a pure usage reseller.

**Why five tiers, not four.** Collapsing Constellation re-opens the Cluster-to-Galaxy gap and leaves the high-willingness power individual uncovered (money left on the table, a persona unserved). The two-toggle presentation already delivers the frictionless feel without dropping a tier. Keep five; present as two toggles. Persona coverage (the v3 personas): Star / Cluster to the solo PM and indie (P7); Constellation to the power individual; Galaxy seats to the PM, eng, design, GTM and support team (P2 to P6); Cosmos to the org / VP (P1). All seven covered.

**Coherence gate (founder, §7).** The Constellation and Galaxy-seat multipliers and their "Nx more usage than Pro" labels must be chosen together so the math and the words agree (the engine is anchored to Free internally; the copy is framed against Pro). The structure supports any values; only the numbers are gated.

### 2.5 Lock-in / monetization / evangelization

Lock-in is value depth, ranked: (1) compounding decision memory (the product gets smarter about your product over time); (2) persistence as a subtle paywall (free decays, paying keeps it); (3) record-of-record (decision, then shipped, then outcome, then was-the-reasoning-right becomes the team's audit trail); (4) system-of-record-and-action (connected sources, tuned brief/voice/guardrails). Deliberate non-move: keep "export anytime." Evangelization rides on the shareable Critic teardown (already built), the visible memory ("look how much it knows my product"), and outcome proof.

### 2.6 No self-serve BYOK, COGS, one-subscription, capped top-ups

**BYOK (user-supplied model keys) is removed from all self-serve tiers** (founder ruling 2026-06-19). All self-serve usage flows through our AI credits + capped top-ups, so 100 percent of value is monetized and the UX is one clean path. **"Model-agnostic" is preserved and is NOT the same as BYOK:** we still route across providers (Anthropic, Google, and others) with OUR keys, so we are never locked to one lab; only USER-supplied keys are retired. BYOK / data residency / their-own-provider-contract is offered ONLY as a negotiated **enterprise** option (Cosmos), never a self-serve toggle. See WM-M9 for the removal.

One-subscription "calm" model: each tier carries a generous included allowance plus cheap fair-use **capped** top-ups (paid tiers only, per-cycle ceiling, off by default), never a literally-unlimited flat fee, because the product eats both LLM and hosting COGS. Because there is no self-serve BYOK, margin discipline (credits sized right, small-model routing, caching) is essential, not optional. The upgrade driver is more AI credits (Pro -> Max) and collaboration / multi-workspace / persistent memory (-> Team), never credit starvation.

### 2.7 Division of ownership with the parallel credits thread

This plan owns: tenancy (accounts/workspaces/products), the billing **boundary** (account-level schema), the entitlements **structure**, the pricing **surfaces**, settings IA, the credit **seam**, AND, **as of 2026-06-19 (founder ruling to combine the two threads into one source of truth), the credit ENGINE itself**, now specified in §4.2.1 (`WM-M10` to `WM-M16`): what one credit is, the cost-to-credit conversion, per-tier amounts + grant/reset, the debit draw-down, capped top-up purchase, per-product/member attribution + caps, and the margin levers (small-model routing + caching). The credits thread no longer exists as a separate doc; its reasoning is preserved in [`../strategy/strategic-inputs-log.md`](../strategy/strategic-inputs-log.md) (2026-06-19). The three integration objects, the `accounts` table, the entitlements matrix, and the `assertAccountCredits` / `debitAccountCredits` seam, remain the contract the BYO / Cadence-Cloud thread (**G11**, whose `BYO-P4` managed-credits work IS this engine, not a duplicate) plugs into.

The parallel **G11 (BYO repo + Cadence Cloud, all-in-one build/host)** is **part of the end-to-end scope/vision** (run your whole product org on Cadence), sequenced after the loop is proven (founder ruling 2026-06-19, refined): we lead with the decision-layer moat and deliver the build as a governed station (own engine or dispatched to Lovable/Cursor/Devin), out-scoping vibe-coding (the whole loop) rather than out-building it. The moat stays the decision layer, not the hosting. G10 and G11 meet only at the accounts table + entitlements matrix + the credit seam.

### 2.8 Naming and motif system (Constellation)

The thought process: name tiers after **what the product does to your knowledge** (connects scattered points into a navigable map that gets richer with use), so the name is the value and the depth is visible. Star (one point) -> Cluster (connecting) -> Constellation (a full pattern) -> Galaxy (shared, many) -> Cosmos (org-wide, governed). Brand-independent (survives the product itself being renamed; "Cadence" is a placeholder). Motif: a small starfield glyph beside the plan name that gains stars, connecting lines, and glow per tier; subtle drift + occasional twinkle; respects `prefers-reduced-motion` (static richer-per-tier states); tier accent hue from a dedicated palette that excludes the reserved status colors. Distinct from Kimi (notes) and Claude (tree). Built as **WM-M8**. Rename-anytime is guaranteed by the slug/display decoupling.

### 2.9 Decision journey (forks resolved, compact)

| Fork | Options weighed | Choice + why |
|---|---|---|
| Tenant boundary | product-first (flat) / workspace=tenant / account>workspace>product | **Account>Workspace>Product.** Memory pools at the account; products are the metered unit. Serves the moat + the founder's "plan at the top, products under it." |
| Billing level | per-workspace / per-account | **Per-account, pooled.** Per-workspace billing taxes the moat (the flywheel argument). |
| Solo to team | separate personal/team / scratch+team / graduate-in-place | **Graduate in place;** the line is members and seats, not workspace count. Personal side-projects use a separate signup. |
| Memory persistence charge vs usage credits | one or the other | **Both, layered.** Persistence is the primary charge (free decays); credits ride on top + protect margin via top-ups. |
| BYOK (user keys) | keep self-serve / remove | **Removed from self-serve; enterprise-only.** Model-agnostic routing (our keys) preserved. Cleaner monetization; credits are the only self-serve path. |
| Moat / positioning lead | memory / decision-layer | **Decision layer leads; memory is one layer.** System of record + accountability for product decisions, above and dispatching the build tools. See [`../strategy/moat.md`](../strategy/moat.md). |
| All-in-one build (G11) / end-to-end scope | recede / part of the offering | **Part of the end-to-end scope (sequenced); the moat stays the decision layer.** Out-scope vibe-coding (the whole loop), do not out-build it; the build is a governed station (own or dispatched). |
| Tier naming | musical (Kimi-taken) / abstract vibe / value-mapped | **Constellation** (value-mapped, brand-independent, rename-able). |
| Showcase timing | now / deferred | **Deferred** until ~50-60% platform maturity; tracked + resurfaced. |
| Cross-thread ownership | merge / split at interface / credits owns all pricing | **Split at the interface** (accounts table + entitlements matrix + seam). |

---

## 3. Architecture overview (target schema + interfaces)

**New / changed schema**
- `accounts` (id, owner_id, plan_tier, stripe_customer_id, stripe_subscription_id, plan_updated_at, created_at) + `account_members` (account_id, user_id, role). Solo = one member.
- `workspaces.account_id uuid -> accounts(id)`. Plan/billing reads move from `workspaces` to `accounts` (keep `workspaces.plan_tier` as a derived compat shim during transition only).
- `agent_memory`, `agent_runs`, `agents` (+ `agent_tools`, `agent_approvals`) gain `workspace_id` (today user-scoped).
- `account_credits` (account_id PK, balance_credits, monthly_grant_credits, cycle_anchor) + `credit_ledger` (account_id, user_id, delta_credits, reason, surface, ai_event_id, created_at), service-role-write only.
- `workspace_invitations` (token, email, role, expiry, status). `workspace_audit_log` (transfer/role events).
- Scope leaks fixed: `meetings`, `notes`, `daily_briefs`, `copilot_messages` gain `workspace_id` + RLS.

**Helpers / interfaces**
- RLS helpers (SECURITY DEFINER, recursion-safe): existing `is_workspace_member(ws)`, plus new `is_account_member(account)`, `has_workspace_role(ws, roles[])`, `has_account_role(account, roles[])`.
- Recall: `match_agent_memory` + `recent_agent_reflections` rewritten to filter on `workspace_id` + membership (preserve the existing expiry predicate) with a paid-account pooled-recall branch over the account's workspaces.
- Entitlements: pure map in `src/lib/entitlements.ts` (the structure both threads read).
- Credit seam: `assertAccountCredits` (pre-call) + `debitAccountCredits` (post-call) in `src/lib/ai/runtime.server.ts`, dormant behind `credits_enabled()`; credits-only (no self-serve BYOK; see WM-M9).
- Credit engine (§4.2.1, `WM-M10` to `WM-M16`): `creditsForCost` / `estimateCreditsForCall` / `actionCreditRange` in `src/lib/ai/pricing.ts` (the cost-to-credit math + the calm legibility layer); `grantMonthlyAllowance` / `resetCreditCycle` / `getCreditAttribution` in a new `src/lib/credits.functions.ts`; the debit draw-down (included -> top-up -> halt) + per-product/member caps inside the seam; capped top-up checkout on `billing.functions.ts` + the Stripe webhook; the margin levers (cost-aware routing + cache) at the chokepoint. The pool is the **account**; the ledger is service-role-write-only; the whole engine stays dormant behind `credits_enabled()`.
- Dormancy flags mirror the existing `memory_expiry_enabled()` pattern: `credits_enabled()` returns false until the engine lands; `memory_expiry_enabled()` stays founder-gated.

**Reused as-is:** the RLS pattern in `supabase/migrations/20260530120200_tenancy_c_tighten_policies.sql` (mirror it), `resolveProviderAuth`, the agent loop + trust arc + approvals, the AI gateway chokepoint + `ai_events` cost capture, the dormant pricing rails (`entitlements.ts`, `billing.functions.ts`, the Stripe webhook), the dormant memory-expiry engine (`memory-tick.ts`), `pricing.tsx`, the Settings BillingTab.

---

## 4. Work items (ID-addressable build specs)

### 4.0 Index

| ID | Title | Lane | Status | Depends on |
|---|---|---|---|---|
| WM-M1 | Entitlements core (5 account-level tiers + matrix) | Monetize | ✅ Done 2026-06-19 | none |
| WM-F1 | Scope agent memory / runs / roster to workspace | Foundation | ◐ Core done 2026-06-19 | none (account-pooled recall needs WM-M2) |
| WM-F1b | Agent-workspace hardening (RLS swap + universal insert tagging; NOT NULL + roster key → WM-F1c) | Foundation | ◐ Core done 2026-06-19 | WM-F1 |
| WM-M2 | `accounts` table + billing relocation + credit/decay migrations | Monetize | ◐ Core done 2026-06-19 | WM-M1 |
| WM-F2 | Account-level memory pooling (paid) | Foundation | Pending | WM-M2, WM-F1 |
| WM-F3 | RBAC enforcement (owner/admin/member/viewer) | Foundation | Pending | WM-M2 |
| WM-F4 | Ownership transfer | Foundation | Pending | WM-F3 |
| WM-F5 | Invites (account/workspace) | Foundation | Pending | WM-F3, WM-M2 |
| WM-F6 | Move product between workspaces | Foundation | Core ◐ (cycle 46) | WM-M2 |
| WM-F7 | Settings IA (Account / Workspace / Personal) | Foundation | Pending | WM-M2, WM-F3 |
| WM-F8 | Workspace switch hardening | Foundation | Core ◐ (cycle 45) | WM-F1 |
| WM-F9 | Isolation audit + scope leak fixes | Foundation | Pending | none (do before WM-F5) |
| WM-M3 | Billing rails (account-level Stripe + webhook map) | Monetize | ◐ Core shipped 2026-06-20 (Lovable; built differently - LIVE rail is `src/lib/payments.functions.ts` + `src/routes/api/public/payments/webhook.ts` via the Lovable connector gateway; dormant pending founder secrets - see the supersession note) | WM-M1, WM-M2 |
| WM-M4 | Runtime credit seam (dormant) | Monetize | ◐ Core done 2026-06-19 | WM-M2 |
| WM-M5 | Tier limit gates (product + workspace) | Monetize | Pending | WM-M1, WM-M2 |
| WM-M6 | Pricing surfaces (pricing page + Settings Plan + Usage) | Monetize | Pending | WM-M1, WM-M3 |
| WM-M7 | Upgrade nudges (value-framed) | Monetize | Pending | WM-M5, WM-M6 |
| WM-M8 | Tier identity motif (Constellation starfield glyph) | Monetize | Pending | WM-M1, WM-M6 |
| WM-M9 | Remove BYOK from self-serve (enterprise-only) | Monetize | Pending | WM-M1 |
| WM-M10 | Credit unit + cost-to-credit conversion + legibility layer | Monetize (Credit engine) | ✅ Done 2026-06-19 | WM-M1 |
| WM-M11 | Per-tier credit amounts + monthly grant + cycle reset | Monetize (Credit engine) | ◐ Core done 2026-06-19 | WM-M2, WM-M10 |
| WM-M12 | Credit debit engine (fills the WM-M4 seam; draw-down + halt) | Monetize (Credit engine) | ◐ Core done 2026-06-19 | WM-M4, WM-M10, WM-M11 |
| WM-M13 | Capped top-up purchase (Stripe credit packs) | Monetize (Credit engine) | ◐ Core shipped 2026-06-20 (Lovable; `createTopUpCheckout` in `src/lib/payments.functions.ts` + `handleCheckoutCompleted` in `src/routes/api/public/payments/webhook.ts`; KNOWN BUG - top-up webhook never increments the spendable balance, see `feature-dashboard.md` row M-C-TOPUP-BUG) | WM-M3, WM-M12 |
| WM-M14 | Per-product / per-member attribution + caps | Monetize (Credit engine) | ◐ Core done 2026-06-19 | WM-M12 |
| WM-M15 | Margin levers (cost-aware routing + cache) | Monetize (Credit engine) | Pending | WM-M10 |
| WM-M16 | Credit / usage UI (balance, legibility, attribution) | Monetize (Credit engine) | Pending | WM-M6, WM-M12, WM-M14 |
| WM-M17 | Clubbed usage variants (Max 5x/20x + Team Standard/Premium seats) | Monetize | Deferred (post-core; P2/P3) | WM-M3, WM-M6, WM-M11 |
| WM-M18 | Plan-card states + change flow (current/upgrade tags, downgrade guard) | Monetize | Deferred (post-core; P2) | WM-M6 |
| WM-M19 | Enterprise usage model (per-seat + API-rate usage + per-user allocation) | Monetize | Deferred (post-core; P3) | WM-M3, WM-M14 |
| WM-S1 | Sample workspace for every new account | Showcase | Deferred | foundation done |
| WM-S2 | Guided tour | Showcase | Deferred | WM-S1 |
| WM-S3 | Onboarding Concierge agent | Showcase | Deferred | WM-S1 |
| WM-S4 | Workspace Steward agent | Showcase | Deferred | WM-S3 |
| WM-S5 | Investor-demo rich population + reset | Showcase | Deferred | WM-S1 |
| WM-D | Docs, registration, cross-link, cascade | Docs | In progress | none |

### 4.1 Lane F, Foundation / Tenancy

#### WM-F1 · Scope agent memory / runs / roster to workspace
- **Why:** the moat (decision memory) is user-scoped today, one level above the boundary we sell; scope it so it compounds per workspace/account and the lock-in is an enforced data fact.
- **Current state:** `agents` (user_id, slug, enabled, autonomy), `agent_runs` (user_id, agent_id), `agent_memory` (user-scoped) carry no `workspace_id`. Recall is `match_agent_memory(query_embedding vector(1536), for_user uuid, for_agent_slug text, match_count int)` with an `expires_at IS NULL OR expires_at > now()` filter; `recent_agent_reflections` has the same shape. The sole recall caller is `src/lib/ai/memory.server.ts` (around lines 55, 67). The loop already threads `workspaceId` (`src/lib/ai/loop.server.ts`; `ToolContext.workspaceId` in `src/lib/ai/tools/registry.server.ts`); `rememberOutcome` / `autoReflect` / `createMission` already receive it (today only in metadata).
- **Build:** (1) migration adds `workspace_id` to `agent_memory`, `agent_runs`, `agents`, `agent_tools`, `agent_approvals`; deterministic backfill from the owning user's default workspace (`current_user_default_workspace()` or a `ORDER BY created_at, id LIMIT 1` CTE for users owning >1); add index; assert no nulls; set NOT NULL; add membership RLS mirroring tenancy_c. (2) Rewrite `match_agent_memory` + `recent_agent_reflections`: drop the exact old signature, recreate with a `for_workspace uuid` parameter, add `is_workspace_member(workspace_id)`, **preserve the expiry predicate**, re-GRANT. (3) Make the roster workspace-scoped: dedupe `(user_id, slug)` rows first, then swap `UNIQUE(user_id, slug)` -> `UNIQUE(workspace_id, slug)`. (4) Update `memory.server.ts` to pass the active workspace.
- **Files:** new `supabase/migrations/<ts>_wm_f1_agent_workspace_scope.sql`; `src/lib/ai/memory.server.ts`; verify `src/lib/ai/loop.server.ts` + `registry.server.ts` pass workspace through.
- **Gotchas:** preserve EVERY predicate in the recall rewrite and re-GRANT or recall silently breaks; drop-before-recreate the exact 4-arg signature; backfill must leave zero orphan/null; do not break existing single-user accounts (keep `user_id`, keep the DEFAULT bridge); use SECURITY DEFINER helpers to avoid RLS recursion; dedupe before the unique-key swap.
- **Acceptance:** a member of workspace A cannot recall workspace B's memory; recall still returns within a workspace; `tsc`/build/lint green; an existing single-user account is unaffected.
- **Verify:** RLS test (cross-workspace recall returns nothing); recall smoke test; migration applies cleanly on a Supabase branch.
- **◐ CORE shipped 2026-06-19 (overnight cycle 27); hardening split to WM-F1b.** Migration `20260619150000_wm_f1_agent_workspace_scope.sql`. **Deviations from the spec above, deliberate and safe (live-DB-verified via the Lovable MCP):**
  - Live schema check found `agent_runs` + `agent_approvals` ALREADY had `workspace_id`; only `agents`/`agent_memory`/`agent_tools` needed the column.
  - Column is **NULLABLE with no DEFAULT bridge** (NOT NULL deferred to WM-F1b). The spec's `current_user_default_workspace()` DEFAULT bridge ERRORS under service-role (`auth.uid()` is null → it would insert a null-owner workspace), and `agent_memory` has ~10 insert paths (several service-role) that omit `workspace_id`; forcing NOT NULL now would break them. Backfill uses `ensure_user_default_workspace(user_id)` (explicit arg, always returns a workspace, handled the 1 orphan account + 2 multi-workspace users).
  - Recall membership guard is **service-role-safe** (`auth.uid() IS NULL OR m.workspace_id IS NULL OR is_workspace_member(...)`): an UNCONDITIONAL guard would silently empty background recall (the loop calls these as `service_role`). A NULL `workspace_id` recalls as global (no regression for untagged rows).
  - **Security fix folded** (adversarial review): `recent_agent_reflections` now filters `m.user_id = coalesce(auth.uid(), for_user)` (was `= for_user`), closing a pre-existing cross-user reflection read.
  - **Deploy-window fallback:** `recallMemoryRefs` retries the legacy call on `PGRST202` so recall never goes dark before the migration applies; falls back ONLY on function-not-found (a transient error must not widen recall).
  - Tagged new `rememberOutcome` + `autoReflect` rows with `workspace_id` (pre-migration-tolerant post-insert update).
  - **Verification (what ran):** `bunx tsc --noEmit` 0; eslint clean; `bun run build` ✓; humanization scan clean; a `BEGIN..ROLLBACK` dry-run of the full migration on the live prod DB applied clean, left **0 nulls** across all 5 tables, recreated both RPCs with the new signatures, then rolled back (prod unchanged). Live recall-isolation activates on the founder's next publish.
- **WM-F1b (deferred hardening):** set `workspace_id` NOT NULL (after a per-insert-site audit + tagging the remaining ~6 `agent_memory` insert paths: `handoff.server.ts`, `registry.server.ts` tools, `agent_loop.functions.ts`, `swarm.functions.ts`, `gauntlet.functions.ts`, `agent-runs.functions.ts`/`memory.functions.ts`); swap the 5 tables' RLS to membership-keyed (mirror tenancy_c); swap `agents UNIQUE(user_id,slug)` -> `UNIQUE(workspace_id,slug)`; regenerate `src/integrations/supabase/types.ts` so the new `for_workspace` RPC arg is typed. Until then, recall is workspace-scoped for backfilled rows + new outcomes/reflections, and global (owner-scoped) for the other untagged kinds.
- **◐ CORE shipped 2026-06-19 (overnight cycle 37); the residual NOT NULL + roster-key + types-regen split to WM-F1c.** Migration `20260619220000_wm_f1b_agent_workspace_hardening.sql`. **What shipped, and why it deviates from the bullet above (deliberate, dry-run-verified on prod via the Lovable MCP):**
  - **Universal insert tagging via a DB trigger, not per-file edits.** Instead of hand-editing the ~6 insert paths (fragile, easy to miss one, several are SQL/service-role paths like `seed_default_agents`), a shared `user_id`-fed BEFORE-INSERT trigger (`set_row_workspace_from_user`, reused from WM-F9, service-role-safe because it sources `NEW.user_id` not `auth.uid()`) fills `workspace_id` on EVERY insert that omits it, on all 5 agent tables. This is strictly more robust than the planned per-site audit. The one app insert with the active workspace in scope (`memory.remember` / `memoryRemember` in `registry.server.ts`) additionally tags the ACTIVE workspace (pre-migration-tolerant post-insert update, mirroring `rememberOutcome`), so a multi-workspace user's explicit memories land in the active workspace, not just the default.
  - **DUAL-KEY membership RLS, not pure membership.** The 5 tables' owner-only `auth.uid() = user_id` policy is replaced with `auth.uid() = user_id AND is_workspace_member(workspace_id)`. This deviates from the bullet's "membership-keyed (mirror tenancy_c)" on purpose: the recall RPCs (`match_agent_memory`/`recent_agent_reflections`) are USER-scoped + workspace-narrowed (a teammate must not read another member's raw memory rows), so the table RLS must match. The dual key is strictly MORE restrictive than the prior owner-only policy, so it can never widen access or lock the owner out (the owner is always a member of every workspace their rows were backfilled to, since `ensure_user_default_workspace` inserts a `workspace_members` row in every branch). `is_workspace_member(null)` is false, so orphaned (null-workspace) rows are correctly hidden from the table reader while recall (SECURITY DEFINER) still treats null as global.
  - **DEFERRED to WM-F1c (each a separate, riskier change with a concrete reason):** (1) NOT NULL on `agents`/`agent_memory`/`agent_tools.workspace_id` — WM-F1 set the FK to `ON DELETE SET NULL` specifically so deleting a workspace does NOT cascade-delete the moat memory; forcing NOT NULL requires flipping that FK to `ON DELETE CASCADE` (delete a workspace = destroy its decision memory), an irreversible data-loss product call, founder-gated. The trigger already guarantees no NEW null and the WM-F1 backfill left zero existing nulls, so isolation is fully enforced WITHOUT the constraint. (2) `agents UNIQUE(user_id,slug) → UNIQUE(workspace_id,slug)` — `seed_default_agents()` uses `ON CONFLICT (user_id, slug)`; swapping the key requires recreating that function's conflict target and changes roster-seeding semantics ahead of the workspace-scoped roster READ path (WM-F8, `listAgents` still filters by `user_id`); low value today (no multi-member workspaces) and unverifiable offline (needs a publish + a new-user signup). (3) Types regen — `generate_typescript_types` reflects the LIVE schema, and WM-F1/F1b are not published yet, so regenerating now would produce pre-WM types; it belongs in the post-publish step.
  - **Verification (what ran):** `bunx tsc --noEmit` 0; `eslint src/lib/ai/tools/registry.server.ts` 0; `bun run build` ✓; `bun test` 252/252; humanization scan clean on both authored files; AND a two-pass `BEGIN..ROLLBACK` dry-run of WM-F1's column essentials + the full WM-F1b on the live prod DB — 5 filler triggers + 5 dual-key policies created, 0 old owner-only policies remaining (dual-key actually enforces, no permissive-policy-wins bug), the trigger fills `workspace_id` on an insert that omits it, `seed_default_agents` still succeeds (ON CONFLICT intact), `is_workspace_member(null)=false`, and a simulated-JWT read as a real owner returned all 23 of their `agent_memory` rows (no reader breakage); a direct check found 0 memory-owners without a `workspace_members` row. Rolled back, then re-confirmed prod is untouched (still the old owner-only policy, no `workspace_id` column). Adversarial self-review folded 2 humanization fixes; no runtime-fatal bug. **Live isolation activates on the founder's next publish (not a behavioral live test → ◐, not ✅).** No UI breadcrumb (RLS plumbing).

#### WM-F2 · Account-level memory pooling (paid)
- **Why:** for paid accounts, memory should compound across all the account's workspaces (the flywheel); free stays single-workspace.
- **Build:** with `workspaces.account_id` in place (WM-M2), add `is_account_member(account)` helper and a pooled-recall branch in `match_agent_memory` that spans the account's workspaces when the account's tier has `crossWorkspaceMemory` (any paid tier). Gate read-side only; writes stay workspace-scoped.
- **Files:** migration (helper + recall branch update); no app change beyond passing `account_id`/entitlement to the recall call in `memory.server.ts`.
- **Gotchas:** free accounts have one workspace so pooling is a no-op; do not leak across accounts; keep the single-workspace path identical.
- **Acceptance:** a paid account with two workspaces recalls across both; a free account does not; cross-account never pools.
- **Verify:** RLS/recall test across two workspaces under one paid account vs a free account.

#### WM-F3 · RBAC enforcement (owner / admin / member / viewer)
- **Why:** roles exist in `workspace_members.role` but only `owner` is enforced; a team needs real permissions.
- **Build:** add `has_workspace_role(ws, roles[])` and `has_account_role(account, roles[])` SECURITY DEFINER helpers; swap domain RLS policies to role-keyed checks per the matrix below; add a `prevent_owner_demotion` trigger.
- **Permission matrix:** owner = account billing/plan, delete account/workspace, transfer ownership, manage members; admin = manage members (not billing), create/delete workspace + product, approve agent actions, edit brief/guardrails; member = create/edit content, run missions, no member/billing management; viewer = read-only.
- **Files:** migration (helpers + policy swaps + trigger); UI affordances gated by role where relevant (later, in WM-F7).
- **Gotchas:** RLS recursion (helpers must be DEFINER); do not lock the owner out; keep service-role paths intact.
- **Acceptance:** a viewer cannot write; a member cannot manage members/billing; an admin cannot change billing; the owner cannot be demoted to orphan the account.
- **Verify:** RLS tests per role.

#### WM-F4 · Ownership transfer
- **Why:** `leaveWorkspace` blocks the owner with "transfer it first," but no transfer exists.
- **Build:** a transactional SECURITY DEFINER RPC that reassigns `accounts.owner_id` (and/or workspace owner), adjusts `account_members`/`workspace_members` roles atomically, and writes a `workspace_audit_log` row; surface it in Settings (Account); remove the dead-end block in `src/lib/workspaces.functions.ts`.
- **Files:** migration (RPC + `workspace_audit_log`); `src/lib/workspaces.functions.ts`; Settings UI (`src/routes/_authenticated.settings.tsx`).
- **Gotchas:** atomic (all writes or none); guard that the new owner is a member; audit every transfer.
- **Acceptance:** owner can transfer to another member; old owner becomes admin; an audit row is written; non-owners cannot transfer.
- **Verify:** Playwright transfer flow + audit row check.
- **Status (◐ CORE shipped cycle 43; UI shipped FE cycle 1, 2026-06-20):** the RPC + `workspace_audit_log` + `transferWorkspaceOwnership` server fn shipped cycle 43 (dry-run-verified on prod). The **UI shipped FE cycle 1**: `src/components/settings/MembersCard.tsx` (Settings > Workspace > Members) surfaces the transfer as a per-member "Make owner" action behind an inline two-step confirm (it demotes the owner to admin), reusing the members list as the picker (no separate member-picker needed). Member identity for that list comes from a new membership-gated SECURITY DEFINER RPC `workspace_members_with_identity` (migration `20260620213000`), because `profiles` RLS is own-row-only and email lives in `auth.users`. The `leaveWorkspace` dead-end is no longer a dead-end (owners can now hand over via the UI). **Role management added + owner-only correction (FE cycle 3, 2026-06-20):** a new `changeWorkspaceMemberRole` fn (the role chip becomes an inline `<select>` on manageable rows) completes the surface, and a cycle-1 silent-failure was fixed: the WM-F3 `workspace_members` policy is `for all` + owner-only, so an admin's remove deleted 0 rows but PostgREST reported success; all management (role/remove/transfer) is now gated to `isOwner`, and `removeWorkspaceMember`/`changeWorkspaceMemberRole` use `.select()` + a 0-row throw so an RLS-blocked write fails loudly. ◐ live on publish; the identity-RPC live dry-run is pending (MCP unauthorized this session, flagged for publish-verify). The Playwright transfer-flow check is part of the deferred hosted Playwright pass (§ verification).

#### WM-F5 · Invites (account / workspace)
- **Why:** there is no invite flow; membership is manual.
- **Build:** `workspace_invitations` table (token, email, role, expiry, status); `inviteMember` / `listInvitations` / `revokeInvitation` server fns; an `accept_workspace_invitation` RPC (the invitee is not a member yet, so accept cannot rely on membership RLS); a pluggable `src/lib/email.server.ts` that no-ops gracefully when no provider env is set and always returns a copy-paste link; an accept route `src/routes/join.$token.tsx`; Settings (members) UI.
- **Files:** migration; new `src/lib/email.server.ts`; `src/lib/workspaces.functions.ts`; new `src/routes/join.$token.tsx`; Settings UI.
- **Gotchas:** token single-use + expiry; accept RPC is SECURITY DEFINER; do not leak workspace data pre-accept; email send is gated (link fallback always works).
- **Acceptance:** invite -> email/link -> accept -> member with the assigned role; revoke works; expired tokens rejected.
- **Verify:** Playwright invite + accept; RLS check on pre-accept access.

#### WM-F6 · Move product between workspaces
- **Why:** products cannot move; cross-workspace consolidation needs it (paid/team).
- **Build:** a transactional `move_product` RPC reassigning the product + all child rows that carry `product_id`/`workspace_id` (signals, themes, opportunities, prds, docs, tasks, decisions, conversations, rag_chunks, ai_events) to the destination workspace; guard with admin-in-both + same-account. Harden product-level scoping first (product_id has no RLS on those ~10 tables today). Memory stays at the workspace (does not move).
- **Files:** migration (RPC + product-scope RLS hardening); `src/lib/projects.functions.ts`; UI action.
- **Gotchas:** one atomic RPC (partial moves corrupt tenancy); permission both sides; do not move across accounts.
- **Acceptance:** moving a product relocates all its child data; permissions enforced; no orphan rows.
- **Verify:** move a seeded product across two workspaces; assert child-row counts move.
- **Status (cycle 46, ◐ CORE):** shipped the transactional `move_product` RPC + `moveProduct` server fn. **Key finding:** the spec's "harden product-level scoping first (product_id has no RLS)" is ALREADY satisfied - all product-scoped tables are read-gated by `is_workspace_member(workspace_id)` (verified live), so reassigning `workspace_id` IS the move (access follows; no RLS-hardening migration needed). The RPC reassigns the product + 13 product-scoped tables: 10 direct children + 3 grandchildren (doc_versions/messages/learnings, scoped through their parent so none orphan). Untyped-client trap handled: the product FK is `project_id` on 8 tables but `product_id` on ai_events/connection_bindings/rag_chunks/studio_changesets. Guard = owner/admin-in-both (WM-F3 `can_manage_workspace`) + same-account (WM-M2 `account_id`). **Behaviorally dry-run-verified on prod** (BEGIN..ROLLBACK, stubbing unpublished WM-M2/F3/F9): a real product's 9 signals / 2 prds / 10 tasks / 3 decisions / 8 messages all moved, 0 orphans; cross-account + non-manager both blocked; rolled back. tsc/build/lint/274-tests green. **UI shipped (FE cycle 2, 2026-06-20):** a "Move to workspace" `DropdownMenuSub` in each product's actions menu (the AppShell sidebar product ⋯ menu, beside Rename/Delete) lists the user's other workspaces; picking one opens a non-destructive confirm (the move is reversible, so no destructive/typed-confirm) then calls `moveProduct`, clears the now-moved active product, and refreshes. Hidden when there is only one workspace. Built per the frontend build protocol (emil-design-eng + impeccable). tsc 0 / eslint 0 / build ✓. ◐ live on publish. **Honest limit (refinement WM-F6c):** destinations are not yet filtered to the same account (the client `Workspace` type lacks `account_id`), so a cross-account pick is offered then rejected by the RPC's same-account guard with a toast (safe; backend is the authority); add `account_id` to the `useWorkspace` query to filter client-side. **Follow-up WM-F6b:** `artifact_lineage` + other generic-provenance tables (their product linkage is via generic artifact ids, deferred to avoid a wrong remap).

#### WM-F7 · Settings IA (Account / Workspace / Personal)
- **Why:** settings have no rubric (voice/model are user-global, brief is workspace, plan is workspace).
- **Build:** regroup into three levels. **Account/Org:** plan, billing, credits/usage, members, seats. **Workspace:** brief, voice anchor, guardrails, connected sources, agents/autonomy. **Personal:** profile, personal BYO keys, notifications. Move voice anchor + default-model to workspace-level with a per-user override (resolution: user -> workspace -> system default).
- **Files:** `src/routes/_authenticated.settings.tsx` (+ the brief/voice/model server fns for the scope change); migration if the voice/model scope columns move.
- **Gotchas:** preserve existing values on the scope migration; the override resolution must be deterministic and tested.
- **Acceptance:** the three levels render; voice/model resolve user -> workspace -> default; nothing lost on migration.
- **Verify:** unit test the resolution; Playwright the three settings groups.

#### WM-F8 · Workspace switch hardening
- **Why:** `use-workspace.tsx` never resets the query cache on switch, causing a stale-data flash that reads like a leak; agents/runs/memory now switch too (after WM-F1).
- **Build:** add `activeWorkspaceId` to all workspace-scoped TanStack Query keys (now including agents, runs, memory, approvals); reset/invalidate workspace-scoped queries on switch in `src/hooks/use-workspace.tsx`; keep the AppShell switcher; add account context where needed.
- **Files:** `src/hooks/use-workspace.tsx`; any query hook missing the workspace key.
- **Gotchas:** do not over-invalidate global/user queries; ensure no stale render between switch and refetch.
- **Acceptance:** switching shows no stale data; agents/runs/memory reflect the new workspace immediately.
- **Verify:** Playwright switch between two seeded workspaces; assert no cross-bleed and no stale flash.
- **Status (cycle 45, ◐ CORE):** shipped the single-site cache reset (the higher-leverage half): `setActiveWorkspaceId` now calls `queryClient.removeQueries({predicate})` on a real switch, clearing every workspace-scoped query (active AND inactive, so navigating after a switch never surfaces stale cross-workspace cache) while a pure, unit-tested allowlist (`src/hooks/workspace-query-scope.ts`) preserves user/account-global queries. Chosen over threading `activeWorkspaceId` into ~40 query keys because the single switch chokepoint catches every query (including un-keyed ones) in one surgical, offline-verifiable change. **Honest scope:** correct + gate-green + driven (AppShell switcher), but most server-fn reads are still user-scoped server-side today, so the user-visible "no cross-workspace flash" scales as reads become workspace-filtered (WM-F9b). Two-workspace Playwright check needs a publish. **Follow-up WM-F8b:** add `activeWorkspaceId` to the un-keyed workspace-scoped query keys (defense-in-depth + instant cached switch-back).

#### WM-F9 · Isolation audit + scope leak fixes
- **Why:** `meetings`, `notes`, `daily_briefs`, `copilot_messages` are still `auth.uid() = user_id` with no `workspace_id`; a real cross-member leak the moment invites ship.
- **Build:** migration adds `workspace_id` + backfill + membership RLS to each; audit for any other domain table missing scope.
- **Files:** migration; any reads of those tables that should now be workspace-scoped.
- **Gotchas:** backfill correctness; do this BEFORE WM-F5 (invites) so a second member cannot see the owner's notes.
- **Acceptance:** a second member cannot read the owner's meetings/notes/briefs/chat.
- **Verify:** RLS test per table.
- **◐ CORE shipped 2026-06-19 (overnight cycle 35).** Migration `20260619190000_wm_f9_isolation_scope.sql` adds `workspace_id` (FK `ON DELETE CASCADE`) + a deterministic backfill (`ensure_user_default_workspace(user_id)`) + a shared `set_row_workspace_from_user` BEFORE-INSERT trigger (fills from `NEW.user_id`, so it is service-role-safe for the agent-tool insert paths like `notes.create` / `scheduler` and avoids the WM-F1 NOT-NULL trap) + NOT NULL + an index + a **DUAL-KEY** RLS policy `auth.uid() = user_id AND is_workspace_member(workspace_id)`. The dual key keeps the tables USER-PRIVATE per the acceptance (it is strictly MORE restrictive than the old `auth.uid() = user_id`, so it can never widen access) while adding workspace scoping. **The audit clause ("any other domain table missing scope") was honored:** an adversarial 3-lens review extended the same fix from the named 4 (`meetings`, `notes`, `daily_briefs`, `copilot_messages`) to **10 tables**, adding the prototype family (`prototypes`, `prototype_files`, `prototype_messages`, `prototype_attachments`), `scheduler_proposals`, and `ritual_sessions` (which already had a decorative workspace_id column). The public-share policies on prototypes/prototype_files are preserved. `sync_mappings` is a documented deferral (connector-internal sync state, scoped with the connectors workspace-binding work). The `ON DELETE CASCADE` blast radius was disclosed by fixing the `AppShell` delete-workspace confirm copy. **Verification (ran):** a `BEGIN..ROLLBACK` behavioral dry-run of the full migration on the LIVE prod DB, in two passes (the named 4 then the 6 audit tables): all 10 backfilled to 0 nulls, the trigger fills `workspace_id` on an insert that omits it, NOT NULL holds, the old owner-only policies are REMOVED (0 remaining, so the dual-key actually enforces, no permissive-policy-wins bug), the new dual-key policies created, public-share policies preserved, then rolled back (prod untouched). Offline: `tsc` 0, `bun test` 239/239, eslint 0 (AppShell), build ✓, humanization clean. A 3-lens adversarial review: reader-breakage lens verified (under a simulated user JWT on prod) the dual-key breaks no current reader; all real findings folded. **◐ not ✅:** the migration is dry-run-verified but the LIVE isolation activates on the founder's next publish (not behaviorally verifiable on the published app until then). **Follow-up `WM-F9b`:** thread the active workspace into the writes/reads of these tables (so the active-workspace view is exact, not just the default-workspace backfill), and reach a `sync_mappings` verdict. No UI breadcrumb (RLS plumbing; the delete-confirm copy update is the only user-visible bit).

### 4.2 Lane M, Monetization wiring (credit ENGINE owned by the parallel thread; only the boundary + dormant seam here)

#### WM-M1 · Entitlements core (5 account-level tiers + matrix)
- **Why:** entitlements are a 3-tier feature-flag map today; expand to the 5-tier account model.
- **Current state:** `src/lib/entitlements.ts` (`PlanTier` = free|pro|team; `entitlementsFor`, `planPresentation`, `FREE_MEMORY_RETENTION_DAYS = 14`); tested in `src/lib/entitlements.test.ts` (which asserts `isPlanTier("enterprise") === false`).
- **Build:** expand `PlanTier`/`PLAN_TIERS`/`isPlanTier` to `free|pro|max|team|enterprise`; bump retention 14 -> 30; extend the `Entitlements` type + `entitlementsFor` with the full matrix (workspaceLimit [free=1, paid generous/null], productLimit, memoryPersists, memoryDecayDays=30, crossWorkspaceMemory [true for paid], seats, rbac, approvalLanes, criticEverywhere, shareLinks, creditMultiplier, creditMonthlyBase, creditTopUps (capped: paid-only, per-cycle ceiling, none on free), topUpCapPerCycle, productLimit (Free 2 / Pro 3 / Max ~5), enterpriseCreditModel, priority, export), keeping legacy fields as aliases; NO `byokBypassesCredits` (self-serve BYOK is removed, see WM-M9); rewrite `planPresentation` with the Constellation display names + price/credit/limit lines; add `limitFor(tier, kind)`; update `entitlements.test.ts` (flip the enterprise assertion; assert 5 tiers + the new fields).
- **Files:** `src/lib/entitlements.ts`, `src/lib/entitlements.test.ts`.
- **Gotchas:** keep legacy field names as aliases so nothing downstream breaks; `normalizePlanTier` must still fail safe to `free`.
- **Acceptance:** 5 tiers typed + tested; `bun test` green for entitlements.
- **Verify:** `bun test src/lib/entitlements.test.ts`.
- **✅ Shipped 2026-06-19 (overnight cycle 26).** Built exactly to spec. Field naming notes: the export field is `dataExport` (avoids the `export` keyword), and the retention field stayed `memoryRetentionDays` (the consumed name) rather than `memoryDecayDays` (free now = 30). All legacy fields (`memoryPersists`, `memoryRetentionDays`, `sharedWorkspaceMemory`, `perRoleApprovalLanes`, `criticEverywhere`, `shareLinks`) retained so the 6 consumers compile untouched; new fields added: `crossWorkspaceMemory`, `workspaceLimit`, `productLimit`, `seats`, `rbac`, `approvalLanes`, `dataExport`, `creditMultiplier`, `creditMonthlyBase`, `creditTopUps`, `topUpCapPerCycle`, `enterpriseCreditModel`, `priority`. Added `limitFor` + `FREE_MONTHLY_CREDITS` (500, placeholder) + `TOP_UP_CAP_PER_CYCLE` (5000, placeholder). `planPresentation` now returns the Constellation names + value-framed highlights; prices are placeholders (free $0, pro $39/mo committed, max $99/mo + team $25/seat/mo founder-gated §7.1, enterprise Contact sales). 14 tests (115 asserts) pass; tsc/build/lint clean. **Interim, expected:** Settings BillingTab now maps 5 tiers (WM-M6 finalizes), `pricing.tsx` still hardcodes 3 (renamed) tiers until WM-M6, and the dormant memory-expiry DB trigger still reads 14d until WM-M2 widens it.

#### WM-M2 · `accounts` table + billing relocation + credit/decay migrations
- **Why:** relocate billing from workspace to account; add the credit pool shell and the rolling decay.
- **Current state:** `workspaces.plan_tier` (CHECK `free|pro|team`, set only by the Stripe webhook + `protect_workspace_billing_columns` trigger); `stripe_*` on `workspaces`. `ai_budgets` is user-scoped (not the pool). Memory-expiry engine dormant at 14 days (`set_agent_memory_expiry`, `memory_expiry_enabled()`).
- **Build:** create `accounts` + `account_members`; add `workspaces.account_id`; backfill one account per existing workspace-owner and relink; move `plan_tier`/`stripe_*` reads to the account (keep `workspaces.plan_tier` as a derived compat shim during transition); widen the tier CHECK to add `max`/`enterprise`; extend the expiry trigger's paid-tier IN-list to all paid slugs; create `account_credits` + `credit_ledger` with a service-role-only protect trigger/RLS; add `credits_enabled()` flag (returns false); change memory decay 14 -> 30 and make it roll off `last_used_at` (refresh `expires_at` on recall).
- **Files:** new migration(s) in `supabase/migrations/`; `src/lib/billing.functions.ts` (read plan from account).
- **Gotchas:** the CHECK widen is a DROP+ADD in a DO block (match the existing style); do not break the dormant rails (no secret -> 200 no-op / default free); the credit tables are write-protected to service-role so a user cannot self-grant.
- **Acceptance:** accounts exist + every workspace linked; tiers accept 5 values; credit tables exist + protected; decay is 30-day rolling; dormant billing still inert.
- **Verify:** migration applies on a branch; backfill leaves no orphan workspace; `get_advisors` clean.
- **◐ CORE shipped 2026-06-19 (overnight cycle 28).** Migration `20260619160000_wm_m2_accounts_billing_credits.sql` + `src/lib/billing.functions.ts`. **Deviations / decisions, deliberate and safe (live-DB-verified via the Lovable MCP):**
  - `accounts` mirrors `workspaces` billing exactly (owner_id → `auth.users` `ON DELETE CASCADE`, `protect_account_billing_columns` clone). The protect trigger is created **after** the backfill insert, else the migration role (no JWT → `auth.role() = ''` ≠ `service_role`) would clobber backfilled tiers to free.
  - `workspaces.account_id` is **NOT NULL** here (not deferred like WM-F1's `agent_memory.workspace_id`): workspaces always carry `owner_id`, and a BEFORE-INSERT `set_workspace_account` trigger derives `account_id` from `owner_id` (never `auth.uid()`, so it is service-role-safe) on every future insert. `ensure_user_default_account(owner_id)` is the idempotent provisioner (mirrors `ensure_user_default_workspace`).
  - Backfill: **one account per distinct workspace owner**, DISTINCT ON the highest tier (then any Stripe, then newest), with an owner `account_members` row + a zero `account_credits` shell. Current DB = 5 owners / 7 workspaces / all free, so a clean free backfill, but the SQL is correct on a paid DB.
  - Credit shell carries a `topup_credits` column (the WM-M11/M12 included-vs-top-up split needs it). `credit_ledger` is RLS member-read + **no write policy** (service-role-write-only); `reason` ∈ grant/reset/debit/topup/adjustment; `ai_event_id`/`product_id` are plain uuid tags (no FK, to avoid coupling).
  - `set_agent_memory_expiry` reworked to 30 days rolling off `last_used_at` (INSERT-OR-UPDATE so a recall touch refreshes the window), paid-list widened to `pro|max|team|enterprise`, **still gated behind `memory_expiry_enabled()` (= false) → zero live effect**. The paid-check keeps reading the `workspaces.plan_tier` shim (smallest correct change; WM-M3 can make it account-aware when the shim is retired).
  - `billing.functions.ts` `getBillingState` now reads the plan **account-first** with a workspace-shim fallback, tolerant of both deploy-window edges (missing `account_id` column → known-columns read; missing `accounts` table → keep shim). Checkout stays 3-tier (WM-M3 reworks it).
  - **Verification (what ran):** `bunx tsc --noEmit` 0; `bunx eslint` clean on the changed file; `bun run build` ✓; humanization scan 0 hits; a `BEGIN..ROLLBACK` dry-run of the full migration on the live prod DB applied clean (`accounts=5`, all 7 workspaces linked, **0 nulls**, `credits_enabled=false`), then rolled back (prod confirmed untouched). Live billing-from-account + the schema activate on the founder's next publish.
  - **Follow-ups (not blocking):** regenerate `src/integrations/supabase/types.ts` so the new tables/columns are typed (currently reached via the untyped cast, same as WM-F1); WM-M3 moves the Stripe webhook to write the account (today it still writes the workspace shim, consistent while billing is dormant); the repo-wide `bun run lint` debt (~4340 pre-existing errors in untouched files) is unrelated to this diff.

#### WM-M3 · Billing rails (account-level Stripe + webhook map)
> _Reconciled 2026-06-21 against shipped code: the Lovable 2026-06-20 cycle shipped this differently. The LIVE rail is `src/lib/payments.functions.ts` + `src/routes/api/public/payments/webhook.ts` via the Lovable connector gateway, with env `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY` + `PAYMENTS_SANDBOX/LIVE_WEBHOOK_SECRET` + `VITE_PAYMENTS_CLIENT_TOKEN` and tiers via `lookup_keys` (`billing-tier.ts`). The `src/routes/api/stripe/webhook.ts` + `STRIPE_SECRET_KEY` / `STRIPE_PRICE_*` plan below is historical/superseded. Live docs: [`../features/billing.md`](../features/billing.md)._
- **Why:** checkout/webhook are 3-tier and hardcode `"pro"`; move to the account + 5 tiers + seats.
- **Build:** Stripe customer/subscription on the account; checkout price map `STRIPE_PRICE_{PRO,MAX,TEAM}` + seat `quantity` for Galaxy/team; replace the webhook's hardcoded `"pro"` with a `price_id -> tier` map writing the account; enrich `BillingState` with account credit balance + seatCount (null-tolerant). Stays a 200 no-op until secrets are set.
- **Files:** `src/lib/billing.functions.ts`; `src/routes/api/stripe/webhook.ts`.
- **Gotchas:** keep the no-secret no-op; map unknown prices to `free` via `normalizePlanTier`.
- **Acceptance:** with test price IDs, each tier checks out + the webhook sets the right account tier; without secrets, inert.
- **Verify:** unit-test the price->tier map; dormant-path smoke.

#### WM-M4 · Runtime credit seam (dormant)
- **Why:** give the credit engine a clean place to plug in without re-plumbing.
- **Current state:** `src/lib/ai/runtime.server.ts` `callModel` (~line 689) and `callModelStream` (~1038) already do per-user budget check + `incrementBudget` + `estimateCostUsd` + `ai_events` insert, and already carry `workspaceId` on `CallOpts`.
- **Build:** add `assertAccountCredits(supabase, accountId, surface)` right after the existing budget check, and `debitAccountCredits(...)` next to `incrementBudget`; resolve the account from `workspaceId` (fallback to the user's default account); add a typed `CreditExhaustedError`; gate both behind `credits_enabled()` (no-op while false). There is no self-serve BYOK bypass (BYOK removed in WM-M9); an enterprise BYOK case, if ever enabled, is handled by the enterprise credit model, not a self-serve skip.
- **Files:** `src/lib/ai/runtime.server.ts`.
- **Gotchas:** must be a pure seam (no behavior change while dormant); account resolution must never throw on the hot path.
- **Acceptance:** dormant = zero behavior change; when enabled (test), a platform call debits the account pool.
- **Verify:** unit-test the seam with the flag on/off.
- **◐ CORE shipped 2026-06-19 (overnight cycle 30).** All in `src/lib/ai/runtime.server.ts`. Added `CreditExhaustedError`; a cached `creditsEnabled()` (memoizes the `credits_enabled()` flag 5 min so the dormant hot path is about one RPC per process, not per call); `resolveCreditAccountId` (workspace -> account, fallback `ensure_user_default_account`, never throws); `assertAccountCredits` wired right after the per-user budget check in BOTH `callModel` and `callModelStream`; `debitAccountCredits` wired next to `incrementBudget` at both post-call sites. Gated behind `credits_enabled()` -> strict no-op while dormant (the flag + tables do not exist on prod until WM-M2 publishes, so the gate self-protects). Writes use the service-role `supabaseAdmin`. **Deliberate scope:** a minimal functional v1 enabled-path (balance check + best-effort ledger debit + non-atomic decrement); **WM-M12 hardens it** (the atomic draw-down RPC, included-then-top-up order, the blocked `ai_events` event, per-product attribution). **Verification (ran):** tsc 0, eslint 0 on the file, full `bun test` 201/201 (no chokepoint regression), build ✓, humanization clean. Adversarial review: no real fix. **◐ not ✅:** the live debit is DB-coupled and activates only on publish + the flag flip, so it is not behaviorally verifiable offline (no isolable unit test for a dormant DB seam); verified by tsc + build + the green suite + the dormant no-op guarantee.

#### WM-M5 · Tier limit gates (product + workspace)
- **Why:** enforce free/paid caps; the client writes products directly so server-only checks are bypassable.
- **Current state:** `createProject` in `src/lib/projects.functions.ts` (~line 165) has no limit; `AppShell.tsx` (~lines 406, 446) inserts/deletes products directly from the browser; `ensureDefaultWorkspace` is the only workspace-create path.
- **Build:** `assertCanCreateProduct(supabase, workspaceId)` in `createProject`; `assertCanCreateWorkspace(supabase, accountId)` for the future create-workspace fn (never gate the first workspace); DB triggers `enforce_product_limit` / `enforce_workspace_limit` as the authoritative guard; a shared `LimitReachedError { kind, currentTier, limit, upsellTier }`.
- **Files:** `src/lib/projects.functions.ts`; new `src/lib/limits.functions.ts` (or inline); migration (the triggers).
- **Gotchas:** the DB trigger is the real guard (client bypasses server fns); never gate `ensureDefaultWorkspace`.
- **Acceptance:** free account blocked at product #3 and workspace #2 (via the trigger, not just the server fn); paid generous.
- **Verify:** attempt the over-limit insert directly; assert the trigger blocks it.
- **◐ CORE shipped 2026-06-19 (overnight cycle 36).** Migration `20260619200000_wm_m5_tier_limit_gates.sql` adds the pure `tier_product_limit` / `tier_workspace_limit` SQL functions (a MIRROR of `entitlements.ts` `limitFor`, documented as a keep-in-sync coupling) + `enforce_product_limit` / `enforce_workspace_limit` BEFORE-INSERT triggers (SECURITY DEFINER, `search_path` pinned). New `src/lib/limits.functions.ts` adds the typed `LimitReachedError { kind, currentTier, limit, upsellTier }` + the pure `nextUpsellTier` / `isOverLimit` helpers + the best-effort, pre-migration-tolerant `assertCanCreateProduct(supabase, workspaceId)` nice-path, wired into `createProject`. **Two deliberate design calls (session-decisions):** (1) the product cap is **account-WIDE** (counted across all the account's workspaces, joined via `workspaces.account_id`), not per-workspace, so a paid user with pooled workspaces cannot bypass the cap by spreading products across workspaces; the first workspace is never gated (existing-count 0 < every cap >= 1, resolved via `owner_id` so it survives the alphabetical BEFORE-trigger fire-order ahead of `set_workspace_account`). (2) The whole gate ships **DORMANT** behind a new `limit_gates_enabled()` flag (= false), mirroring `credits_enabled()` / `memory_expiry_enabled()`, because activating hard caps before a live upgrade path (Stripe) would trap free users; the founder flips it when pricing is live (founder gate, §7). `assertCanCreateProduct` reads the same flag (cached) so the server pre-check and the DB guard agree. **Verification (ran):** a `BEGIN..ROLLBACK` behavioral dry-run on the LIVE prod DB (WM-M2 essentials applied first, then WM-M5, flag flipped on): on a real free account, inserts up to the cap (2 products) succeeded and the 3rd was blocked with the exact message; a 2nd workspace was blocked; all six pure limit-function values correct; rolled back (prod untouched). `bun test` 252/252 (13 new limits tests), `tsc --noEmit` 0, `eslint` 0 on the 3 changed files, `bun run build` ✓, humanization clean. **◐ not ✅:** the mechanism is behaviorally dry-run-verified, but the live gate is dormant + the migration is not on prod, so enforcement activates on the founder's next publish + the `limit_gates_enabled()` flip. **Follow-up:** wire `assertCanCreateWorkspace` once a generic create-workspace server fn exists (today only `ensure_user_default_workspace`, which is never gated); pair with the WM-M7 upgrade nudges.

#### WM-M6 · Pricing surfaces (pricing page + Settings Plan + Usage)
- **Why:** the founder wants the new model reflected in all three pricing surfaces.
- **Current state:** `src/routes/pricing.tsx` (SSR, maps `planPresentation` over the tiers) + the Settings BillingTab in `src/routes/_authenticated.settings.tsx` (maps `PLAN_TIERS`) both auto-expand to 5 tiers.
- **Build:** (a) finalize `entitlements.ts` presentations + `billing.functions.ts` + webhook (from M1/M3); (b) Settings -> Account -> Plan: render 5 tiers + a Usage panel (account credits vs grant, products vs limit, members vs seats) + generalized upgrade buttons + a Contact-sales card for Cosmos; (c) public `pricing.tsx`: 5 tiers + transparent per-seat Galaxy + Contact-sales Cosmos + a hero ("one subscription, export anytime, credits stay generous"). Align copy with `byo-build-and-cadence-cloud.md` (memory persistence is the charge; credits ride on top).
- **Files:** `src/routes/pricing.tsx`; `src/routes/_authenticated.settings.tsx` (BillingTab + Usage); `docs/features/pricing.md`.
- **Gotchas:** Usage panel renders gracefully pre-engine ("-"); the Contact-sales tier has no checkout CTA.
- **Acceptance:** both surfaces show 5 Constellation tiers with correct limits/credits; Usage panel reads account state.
- **Verify:** Playwright the pricing page + Settings Plan.
- **Extends into (deferred):** the Anthropic-style two-toggle presentation, the Max / Team usage variants (`WM-M17`), and the "Current plan" tag + "Upgrade" calls to action + downgrade guard (`WM-M18`) build directly on these surfaces; see §2.4.1 + §4.2.2.

#### WM-M7 · Upgrade nudges (value-framed)
- **Why:** convert at the natural moments without being punitive.
- **Build:** a reusable `UpgradeNudge` driven by `useEntitlements()` (reads `BillingState`), placed at: hit product limit (on `createProject` `LimitReachedError`), want a second workspace, memory about to decay (Star only, within ~5 days of `expires_at`), credits low (below a soft threshold). All gain-framed; hard blocks only server-side and always point to a path.
- **Files:** new `src/components/plg/UpgradeNudge.tsx`; the four call sites.
- **Gotchas:** never punitive copy; the decay nudge only shows once expiry is live.
- **Acceptance:** each trigger renders the right gain-framed nudge linking to Plan.
- **Verify:** unit/Playwright each placement.

#### WM-M8 · Tier identity motif (Constellation starfield glyph)
- **Why:** the unique, ownable animated plan identity (Section 2.8); the founder explicitly wants this planned.
- **Build:** a reusable `TierGlyph` component rendering an SVG starfield per tier (stars + connecting lines + glow scaling with the tier), subtle drift + occasional twinkle via motion, `prefers-reduced-motion` static fallback, tier accent hue from a dedicated palette excluding the reserved status colors (ember/green/blue/red). Use beside the plan name in `pricing.tsx`, the Settings Plan cards, and the in-app current-plan badge.
- **Files:** new `src/components/plg/TierGlyph.tsx`; consumed in `pricing.tsx`, `_authenticated.settings.tsx`, the plan badge in the app shell.
- **Gotchas:** no layout shift; reduced-motion respected; keep it subtle (calm-front doctrine); colors must not collide with status semantics.
- **Acceptance:** each tier shows a richer glyph than the one below; reduced-motion shows static states; lint/tsc/build green.
- **Verify:** visual check across the 5 tiers + reduced-motion.
- **Note:** this is design-polish; sequence it with WM-M6. The design-last rule is waived for this item per the founder's explicit ask.

#### WM-M9 · Remove BYOK from self-serve (enterprise-only)
- **Why:** founder ruling 2026-06-19. All self-serve usage flows through our credits; user-supplied keys weaken monetization and confuse the UX. Model-agnostic provider routing (our keys) stays.
- **Current state:** BYOK is built: `user_api_keys` (encrypted), `byokeys.functions.ts`, the Settings BYO-keys UI, and a BYO routing branch in `src/lib/ai/runtime.server.ts` (routes to the user's key when the model prefix matches a known provider). Documented in `architecture/integrations.md` (BYO keys), `runtime.md`, `deployment.md`, `api.md`, `data.md`, `threat-model.md`, `observability.md`.
- **Build:** remove the Settings BYO-keys UI from self-serve; retire the self-serve `byokeys.functions.ts` surface; remove the self-serve BYO routing branch in `runtime.server.ts` while KEEPING provider routing via our gateway/keys (model-agnostic stays) and the local-dev gateway fallback; keep `user_api_keys` + the routing behind an enterprise-only flag, or remove entirely if no enterprise path is wired yet. Re-correct the BYOK mentions across the docs (the cascade).
- **Files:** `src/routes/_authenticated.settings.tsx` (remove BYO UI), `src/lib/byokeys.functions.ts`, `src/lib/ai/runtime.server.ts` (BYO branch), the architecture docs.
- **Gotchas:** do NOT remove model-agnostic provider routing (our keys); only the user-key path. Keep the local-dev gateway fallback. No client bundle should reference user keys.
- **Acceptance:** no self-serve BYO-keys UI; provider routing via our gateway still works; tsc/build/lint green; no stale self-serve "BYOK" copy left.
- **Verify:** `rg -i "byok|bring your own"` shows only enterprise-context or model-agnostic mentions; a non-BYO call still routes correctly.

### 4.2.1 Credit engine (WM-M10 to WM-M16), the metering math, owned by this plan as of 2026-06-19

The credit **engine**, what one credit is, the cost-to-credit conversion, per-tier amounts, grant/reset, the debit logic, top-ups, attribution, and the margin levers, merged in from the parallel credits thread per the founder ruling 2026-06-19 (§2.7). It plugs into three things this plan already builds: the entitlements matrix (`WM-M1`), the `accounts` / `account_credits` / `credit_ledger` tables (`WM-M2`), and the dormant `assertAccountCredits` / `debitAccountCredits` seam (`WM-M4`). **The pool is the account** (the flywheel, §2.2); the ledger is service-role-write-only; **there is no self-serve BYOK bypass** (removed in `WM-M9`); and the whole engine stays dormant behind `credits_enabled()` until the founder flips it (§4 founder gates). Charging is on the decision layer; credits are only the meter (`../strategy/moat.md` §7). The user-facing unit is calm and abundant, never a raw provider cost.

#### WM-M10 · Credit unit definition + cost-to-credit conversion + legibility layer
- **Why:** a credit must be a stable user-facing unit abstracting blended managed COGS (inference + infra), priced with margin so the user never sees raw provider cost and the meter stays calm. This is the "what is one credit" the `WM-M4` seam was left waiting for.
- **Current state:** `src/lib/ai/pricing.ts` has `estimateCostUsd(tokens, model)` (per-model USD); `ai_events.est_cost_usd` records per-call cost already; `WM-M1` adds `creditMultiplier` / `creditMonthlyBase` to entitlements; `WM-M2` adds `account_credits`. No credit unit exists yet.
- **Build:** in `pricing.ts` add `CREDIT_COGS_USD` (the USD of blended COGS one credit represents; margin lives in grant-sizing, not the per-credit price; founder-tunable, §7) + an optional per-model `creditRateMultiplier`; `creditsForCost(estCostUsd, model): number = ceil(estCostUsd / CREDIT_COGS_USD * rate)`, never 0 for a billable call; `estimateCreditsForCall(model, promptTokens, completionTokens)` composing the existing estimator. Add the **legibility layer**: `actionCreditRange(actionKind)` returning an approximate per-action credit range (for example "a PRD draft is about 40 to 120 credits") computed from historical `ai_events` averages, for calm UI display only (the real debit stays metered and honest). Unit-test in `pricing.test.ts`.
- **Files:** `src/lib/ai/pricing.ts`, `src/lib/ai/pricing.test.ts`.
- **Gotchas:** deterministic + margin-positive; the numbers are placeholders (§7) but the mechanism is final; the legibility range is display-only and must never be rendered as a flat per-action charge.
- **Acceptance:** `creditsForCost` is model-aware and never returns 0 for a billable call; `bun test` green for pricing.
- **Verify:** `bun test src/lib/ai/pricing.test.ts` (free / cheap / premium model costs).
- **Depends on:** `WM-M1`. Parallel-safe with `WM-F1`.
- **✅ SHIPPED 2026-06-19 (overnight cycle 29).** All in `src/lib/ai/pricing.ts` (+ new `pricing.test.ts`). **Built to spec, with one deliberate scope call:** `actionCreditRange` is a PURE function (no DB / no `ai_events` query) so the item stays "no DB, pricing.ts only" — the spec's "historical `ai_events` averages" is the future calibration source (WM-M16), not a live read; for now the range is computed by running calibrated representative token shapes (chat_reply / research / prd_draft / mission_step / embedding) through the SAME `estimateCreditsForCall`, so the displayed range can never contradict the real meter. `CREDIT_COGS_USD = 0.0002` and the empty `MODEL_CREDIT_RATE` (pure COGS pass-through, default rate 1) are §7 placeholders; the mechanism is final. `creditsForCost` returns 0 for a non-billable (zero/negative/non-finite) cost and >= 1 (rounds up, margin-positive) for any billable call. **Verification (ran):** `bun test` 15/15 (29 asserts), `tsc --noEmit` 0, `eslint` 0 on both files, `bun run build` ✓, humanization clean. Behaviorally verified by the unit tests (pure module, no publish), so ✅. **Drives nothing live yet** — the `WM-M4` seam fills these into the debit path in WM-M12.

#### WM-M11 · Per-tier credit amounts + monthly grant + cycle reset
- **Why:** each tier's included allowance must be granted and reset per billing cycle; included resets, purchased top-ups persist. This is the logic behind `account_credits.monthly_grant_credits` / `cycle_anchor`.
- **Current state:** `WM-M2` creates `account_credits(account_id, balance_credits, monthly_grant_credits, cycle_anchor)`; `WM-M1` carries `creditMonthlyBase` / `creditMultiplier` per tier; the dormant memory-expiry cron (`src/routes/api/public/hooks/memory-tick.ts`) is the model for a scheduled tick.
- **Build:** `grantMonthlyAllowance(accountId, tier)` + `resetCreditCycle(accountId)` in a new `src/lib/credits.functions.ts`; a `credit-tick` hook under `src/routes/api/public/hooks/` (mirror `memory-tick.ts`) or a Stripe-cycle-driven reset; grant on account creation (the starter free grant) and on plan change; reset zeroes the included balance, re-grants the tier allowance, and **preserves the purchased top-up balance**. All writes go through the service-role `credit_ledger` (kind `grant` / `reset`), never the client.
- **Files:** new `src/lib/credits.functions.ts`; new `src/routes/api/public/hooks/credit-tick.ts`; reads `entitlements.ts`.
- **Gotchas:** included vs top-up are distinct balances / ledger reasons; reset must not wipe top-ups; dormant behind `credits_enabled()`.
- **Acceptance:** a new free account gets the starter grant; a cycle reset re-grants included and keeps top-ups; the ledger reconciles to the balance.
- **Verify:** simulate signup + a cycle rollover on a Supabase branch; assert balances + ledger sum.
- **Depends on:** `WM-M2`, `WM-M10`.
- **◐ CORE shipped 2026-06-19 (overnight cycle 31).** New `src/lib/credits.functions.ts` (pure `monthlyGrantCredits(tier)` + `resetDelta`, dormant `grantMonthlyAllowance` + `resetCreditCycle`) + new `src/routes/api/public/hooks/credit-tick.ts` (mirrors `memory-tick.ts`: `requireHookCaller` auth, grants un-granted accounts, resets accounts past ~30 days since `cycle_anchor`, preserving top-ups). Per-tier amounts come from `entitlements.creditMonthlyBase` (free 500 / pro 2500 / max 10000 / team 10000 / enterprise null -> 0, the negotiated model). All writes via the service-role `supabaseAdmin`; gated behind `credits_enabled()` -> strict no-op while dormant; pre-migration tolerant. The ledger reconciles (writes `amount - currentIncluded`, so the sum of deltas equals the included balance); top-ups are never touched by a reset. **Verification (ran):** `bun test credits.test.ts` 7/7 (24 asserts), full `bun test` 208/208, tsc 0, eslint 0 on all 3 files, build ✓ (registers the new route), humanization clean. Adversarial review: no real fix. **◐ not ✅:** the pure grant math is unit-verified, but the grant/reset DB writes + the scheduled tick are dormant and DB-coupled, activating only on publish + the flag flip + a pg_cron schedule. The immediate signup grant (vs the tick's grant on the next run) can be wired into onboarding/WM-M3 when the engine is activated.

#### WM-M12 · Credit debit engine (fills the WM-M4 seam)
- **Why:** `WM-M4` added the dormant `assertAccountCredits` / `debitAccountCredits` seam; this fills the bodies so a real call meters credits from the account pool and halts cleanly when empty.
- **Current state:** `WM-M4` placed both seam fns in `src/lib/ai/runtime.server.ts` (after the per-user budget check; next to `incrementBudget`), gated by `credits_enabled()`, resolving the account from `workspaceId`. The `ai_events` insert + `estimateCostUsd` already run on every call (`callModel` and `callModelStream`).
- **Build:** `assertAccountCredits` pre-check projects the call's credits (`estimateCreditsForCall`) and compares to (included + top-up) balance; if insufficient and overage is not permitted, it throws the typed `CreditExhaustedError` (the call is NOT made) and logs a blocked `ai_events` row (mirror the existing governance-halt pattern). `debitAccountCredits` post-call converts the actual `est_cost_usd` via `creditsForCost`, draws down **included first, then top-up**, writes a `credit_ledger` debit tagged `account_id` + `user_id` + `surface` + `ai_event_id` + `product_id`, and decrements `account_credits.balance` atomically (an RPC). The pool is account-level; per-product attribution rides on the tag (surfaced in `WM-M14`). No self-serve BYOK bypass (`WM-M9` removed it); any enterprise BYOK case is handled by the enterprise credit model, not a hot-path skip.
- **Files:** `src/lib/ai/runtime.server.ts`; the debit/assert RPCs (migration); `src/lib/credits.functions.ts`.
- **Gotchas:** the debit is atomic (no partial spend); account resolution must never throw on the hot path (fall back to the user's default account); dormant = zero behavior change; the draw-down order is included-then-top-up.
- **Acceptance:** with the flag on, every managed call writes a debit and decrements the pool; a drained pool halts with `CreditExhaustedError` (surfaced as a calm message, not a raw 500); with the flag off, zero behavior change.
- **Verify:** unit-test the seam with the flag on/off; drain a test pool and assert the next call halts; assert the ledger sum equals the balance delta.
- **Depends on:** `WM-M4`, `WM-M10`, `WM-M11`.
- **◐ CORE shipped 2026-06-19 (overnight cycle 32).** New migration `20260619170000_wm_m12_credit_debit_rpc.sql` adds the atomic `debit_account_credits` RPC (SECURITY DEFINER + `FOR UPDATE`; draws INCLUDED-first then TOP-UP in one locked tx, floors at 0, writes the tagged `credit_ledger` debit). `runtime.server.ts`: `assertAccountCredits` projects the call (`projectCallCredits`, new pure helper in `pricing.ts`) and halts with `CreditExhaustedError` + a blocked `ai_events` row when the pool cannot cover it; `debitAccountCredits` calls the atomic RPC and passes `ai_event_id` (threaded from both call sites). `_product_id` is tagged null for now (WM-M14 threads the product context). Gated behind `credits_enabled()` -> dormant no-op. **Verification (ran):** `bun test pricing.test.ts` 19/19, full `bun test` 212/212, tsc 0, eslint 0 on 3 files, build ✓, humanization clean, AND a behavioral dry-run of the RPC on the live prod DB (debit 70 then 60 on included=100/topup=50 -> included=0, topup=20, ledger_sum=-130, 2 rows), rolled back. Adversarial review: no real fix. **◐ not ✅:** the RPC + projection are verified, but end-to-end live metering is DB-coupled + dormant (activates on publish + the flag flip).

#### WM-M13 · Capped top-up purchase (Stripe credit packs)
> _Reconciled 2026-06-21 against shipped code: top-ups shipped in the Lovable 2026-06-20 cycle as `createTopUpCheckout` (`src/lib/payments.functions.ts`) + `handleCheckoutCompleted` (`src/routes/api/public/payments/webhook.ts`), NOT on `billing.functions.ts` + `api/stripe/webhook.ts`. KNOWN BUG (`feature-dashboard.md` row M-C-TOPUP-BUG): the webhook writes the `credit_topups` row but never increments `account_credits.topup_credits` or inserts a `credit_ledger` row, so purchased top-ups do not reach the spendable balance even once `credits_enabled()` flips on; the static `TOPUP_CREDITS` map only knows `topup_250` / `topup_1k` / `topup_2_5k`. Live docs: [`../features/credits.md`](../features/credits.md)._
- **Why:** paid tiers can buy capped fair-use top-ups (Anthropic-style: a separate purchased balance, a per-cycle ceiling, off by default), which protects the one-subscription promise and margin (§2.6).
- **Current state:** `WM-M3` puts Stripe checkout/webhook on the account; `src/lib/billing.functions.ts` + `src/routes/api/stripe/webhook.ts` exist (dormant until secrets).
- **Build:** a credit-pack checkout in `billing.functions.ts` (`createTopUpCheckout(accountId, packId)`, paid-tiers-only, gated by `topUpCapPerCycle` from entitlements + an off-by-default flag); handle `checkout.session.completed` for credit packs in the webhook -> a `credit_ledger` grant (kind `topup`) to the account's top-up balance; enforce the per-cycle ceiling server-side. Stays a 200 no-op until secrets exist.
- **Files:** `src/lib/billing.functions.ts`; `src/routes/api/stripe/webhook.ts`; reads `entitlements.ts`.
- **Gotchas:** the ceiling is enforced server-side (a user cannot exceed it by replaying checkout); free tier has no top-ups; off by default.
- **Acceptance:** with test price IDs, a paid account buys a pack and the top-up balance rises (ledger `topup`); the per-cycle ceiling blocks the next over-cap purchase; free tier cannot reach the flow.
- **Verify:** a Stripe test-mode pack purchase; a ceiling-block unit test.
- **Depends on:** `WM-M3`, `WM-M12`.

#### WM-M14 · Per-product / per-member attribution + caps
- **Why:** the pool is account-level, but owners need to see and optionally cap spend per product and per member (the `credit_ledger` already carries `product_id` / `user_id`; nothing surfaces or caps it yet).
- **Build:** `getCreditAttribution(accountId, { range })` in `credits.functions.ts` grouping the ledger by `product_id` + `user_id`; optional per-product / per-member credit caps (extend the existing per-user / per-surface `ai_budgets` / `ai_surface_budgets` pattern) enforced inside `assertAccountCredits`; a typed cap signal (mirror `LimitReachedError`).
- **Files:** `src/lib/credits.functions.ts`; `src/lib/ai/runtime.server.ts` (the cap check in the assert); a migration if a per-product cap table is needed.
- **Gotchas:** attribution sums must reconcile to total debits; caps are optional and owner-set; reads are RLS-scoped to account membership.
- **Acceptance:** a 3-product account shows correct per-product and per-member spend; a per-product cap halts only that product while the account pool still has credits.
- **Verify:** seed multi-product / multi-member debits and assert the rollup; set a product cap, exceed it, and assert a scoped halt.
- **Depends on:** `WM-M12`.
- **◐ CORE shipped 2026-06-19 (overnight cycle 33).** Migration `20260619180000_wm_m14_credit_caps.sql` adds `credit_caps` (account-scoped, `scope` product/member, `target_id`, `cap_credits`, `window_kind` cycle/day/month, member-read RLS, service-role write) + two composite `credit_ledger` indexes (`(account_id,user_id,created_at)` + `(account_id,product_id,created_at)`) so the scoped window sums + attribution rollup stay index-served. `src/lib/credits.functions.ts` adds the PURE, unit-tested `rollupAttribution` (groups debits by product + member, reconciles `sum(byProduct) == sum(byMember) == totalDebited`), `sumDebitCredits`, `capExceeded`, `creditWindowStartIso`, plus `computeCreditAttribution(injected RLS client, accountId, {sinceIso})` (the read for the WM-M16 Usage panel; the createServerFn HTTP boundary is deferred to WM-M16 to avoid a staged-but-undriven wrapper, and to keep `credits.functions.ts` test-safe with relative imports only). `src/lib/ai/runtime.server.ts` adds `CreditCapError`, `assertCreditCaps` (called inside `assertAccountCredits` after the pool check; sums the call's product/member window debits and halts ONLY that scope while the pool may still have credits; degrades to allow on any read error; a strict no-op when no cap exists or while dormant), and threads `productId` into the debit ledger tag (replacing the WM-M12 `null` stub). `src/lib/ai/cluster.server.ts` feeds `productId` from the discovery-clustering path (server-derived projectId, scoped to the user's signals), so **per-product attribution is genuinely driven there**; per-MEMBER attribution (userId) is driven on every metered call; other call sites pass null (unattributed) until they adopt the optional field. The whole path stays dormant behind `credits_enabled()`. **Verification (ran):** `bun test credits.test.ts` 22/22 (46 asserts: rollup reconciliation, cap boundaries, window math), full `bun test` 227/227, `tsc --noEmit` 0, eslint 0 on 4 files, `bun run build` ✓, humanization clean on my lines, AND a `BEGIN..ROLLBACK` behavioral dry-run on the live prod DB (scaffolded on the exact WM-M2 shapes: credit_caps + indexes + RLS created, the cap-sum query returned the right product-debit rows), then rolled back (prod confirmed clean; transactions confirmed honored first by a probe). A 5-lens adversarial review surfaced 6 findings; **5 folded** (the per-product seam now driven via discovery + disclosed honestly; the RLS-scoped-client invariant on `computeCreditAttribution`; the productId-belongs-to-account invariant; the stale `getCreditAttribution` comment), 1 confirmed honest (the unwritten cap table is a disclosed WM-M16 dependency). **◐ not ✅:** the pure math is unit-verified (✅), but the live caps + attribution are DB-coupled + dormant, activating on the founder's publish + the `credits_enabled()` flip. **Follow-up (`WM-M14`-adopt):** thread `productId` at the remaining product-scoped call sites (studio / prd) so per-product attribution covers them too; the owner-write cap path + UI land with WM-M16. No UI breadcrumb yet (engine + chokepoint; the Usage view is WM-M16).

#### WM-M15 · Margin levers (cost-aware routing + cache)
- **Why:** because there is no self-serve BYOK, the platform eats LLM + infra COGS, so margin discipline is structural, not optional (§2.6). Cheap models for familiar patterns, premium only for hard reasoning, plus caching, keep credits margin-positive.
- **Current state:** `src/lib/ai/models.ts` is the catalog; `runtime.server.ts` routes; the queued `PROVIDER-FALLBACK` extends the fallback chain. No cost-aware routing or response cache today.
- **Build:** a routing helper that picks the cheapest adequate model per task class (a small model for routine / precedented steps, premium for novel reasoning), wired at the chokepoint; a response / embedding cache (content-hash keyed) for repeated calls; both observable in `ai_events` (which model ran, cache hit). Conservative and behind config so it never degrades quality on the hard path.
- **Files:** `src/lib/ai/runtime.server.ts`, `src/lib/ai/models.ts`, a cache helper.
- **Gotchas:** never route a genuinely-hard reasoning step to a weak model (a quality gate); cache-invalidation correctness; measure the margin effect via `ai_events`.
- **Acceptance:** routine steps route to a cheaper model; a repeated identical call hits cache; no quality regression on the hard path.
- **Verify:** unit-test the route picker per task class; a cache-hit test.
- **Depends on:** `WM-M10`. Parallel-safe with most of Lane F.
- **◐ ROUTING half shipped 2026-06-19 (overnight cycle 34); CACHE half split to `WM-M15b`.** New pure module `src/lib/ai/routing.ts`: `blendedPrice` (rank by the in+out price mean), `cheapestLiveModel` (the live-only cost floor, gemini-2.5-flash-lite today), and `costRoutedModel(surface, requestedModel)` (downgrade a routine surface's call to the cheapest live model, only when genuinely cheaper). Wired once at the AI chokepoint (`runtime.server.ts` `callModel` + `callModelStream`) as `effectiveModel`, threaded through byo detection, the provider call, the recorded `modelUsed`, the pre-call credit projection, and the post-call debit. **Gated behind the `AI_COST_ROUTING` env flag (default OFF), so it is byte-identical to today until the founder enables it.** **Two safety layers from the 5-lens adversarial review (which caught a real quality-gate hole):** (1) a NARROW routable set `{brief, scheduler, test}` only, EXCLUDING `judge` (the Critic, the launch wedge, runs on it with a deliberate reasoning model and renders user-facing), `eval` (its subject call IS the model under test, so rerouting corrupts the benchmark), and `embed` (`cheapestLiveModel` only knows chat models); (2) a TIER GUARD: a deliberately-chosen reasoning/premium/code/vision model is never downgraded even on a routable surface, and an unknown model is never downgraded. The credit-coherence fix: the pre-call halt now projects `effectiveModel` (no false over-block) and the debit meters the credit rate on `modelUsed` (the model actually run, matching the est_cost_usd basis). **Verification (ran):** `bun test routing.test.ts` 12/12, full `bun test` 239/239, tsc 0, eslint 0 on 3 files, build ✓, humanization clean. 5-lens adversarial review -> 7 findings, ALL real ones folded (2 HIGH: judge + eval removed; 1 NIT: embed removed; 4 LOW: credit-coherence threaded). **◐ not ✅:** the pure router is unit-verified (✅), but the live routing effect is config-gated (activates on the founder's `AI_COST_ROUTING` flip). **Honest scope:** even when enabled the lever is conservative by design (most volume is on deliberately-chosen models, correctly protected), so its immediate margin impact is modest; the bigger lever is the `WM-M15b` cache. No UI breadcrumb (chokepoint).

#### WM-M15b · Response / embedding cache (the second margin lever) [SPLIT from WM-M15, cycle 34]
- **Why:** repeated identical AI calls (same model + same messages) re-pay full COGS; a content-hash cache serves the second one free, a direct margin win that, unlike routing, never overrides the caller's model choice (so it is safer to apply broadly).
- **Current state:** `WM-M15` shipped the routing half; there is no response cache. An in-process cache is near-useless on Cloudflare Workers (ephemeral isolates), so this needs a persistent store.
- **Build:** a content-hash key over (model, normalized messages, responseFormat); a persistent cache store (a `ai_response_cache` table or Cloudflare KV) with a conservative TTL; a read at the chokepoint before the provider call and a write after, both gated by a flag and observable in `ai_events` (cache hit/miss). Skip caching when guardrails or a prompt template that could change the output are in play.
- **Files:** `src/lib/ai/runtime.server.ts`, a cache helper (+ a migration if table-backed).
- **Gotchas:** cache-invalidation correctness (never serve a stale answer after a prompt/guardrail/model change); do not cache non-deterministic or user-personalized calls; bound the store size + TTL.
- **Acceptance:** a repeated identical call hits cache (no provider call, observable in `ai_events`); a changed prompt/model misses; no stale output served.
- **Verify:** a cache-hit unit test (pure key + store mock); a publish-time live check of the hit path.
- **Depends on:** `WM-M10` (the cost basis), `WM-M15` (the chokepoint seam).

#### WM-M16 · Credit / usage UI (balance, legibility, attribution)
- **Why:** the user needs a calm, honest view of credits (balance, what actions cost, where they went) without meter-anxiety (engine-room-doctrine: name the outcome, not the meter).
- **Current state:** `WM-M6` builds the Settings Account Plan + Usage panel; `WM-M7` builds the value-framed upgrade nudges. This item fills the credit specifics.
- **Build:** in the `WM-M6` Usage panel, render the account credit balance vs grant (+ the top-up balance), the `actionCreditRange` legibility hints, and the `WM-M14` per-product / per-member attribution; wire the low-credit nudge (`WM-M7`) at a soft threshold; keep it calm and dismissible. Pre-engine it renders "-" gracefully.
- **Files:** `src/routes/_authenticated.settings.tsx` (the Usage panel), `src/components/plg/*` (the nudge); consumes `credits.functions.ts`.
- **Gotchas:** calm-front (no anxiety meters); graceful pre-engine; humanized copy (the sanitizer).
- **Acceptance:** the Usage panel shows balance + action ranges + attribution; the low-credit nudge is gain-framed; it renders gracefully before the engine is live.
- **Verify:** Playwright the Settings Usage panel on a seeded account.
- **Depends on:** `WM-M6`, `WM-M12`, `WM-M14`.

### 4.2.2 Usage-variant packaging + plan-state work (WM-M17 to WM-M19), deferred behind core builds

These implement §2.4.1 (the Anthropic-style two-toggle presentation + the Max / Team variants + the plan-card states + the Enterprise usage model). Scheduled AFTER the core elemental builds, gated on the billing rails (`WM-M3`) + the pricing surfaces (`WM-M6`); the founder picks these up once core work lands. All numbers are founder-gated (§7). Column-additive, low risk, orthogonal to the dormant credit-engine internals; and the cheapest possible time to lock the model because billing is still dark (`credits_enabled()` = false, Stripe secrets unset, no paying customers, so zero churn / grandfathering risk).

#### WM-M17 · Clubbed usage variants (Max 5x/20x + Team Standard/Premium seats)
- **Why:** §2.4.1; the founder wants one plan name to hold multiple priced usage variants, the way Anthropic does (Max usage 5x / 20x; Team Standard / Premium seat), to capture the power individual and to segment seat intensity without a wall of cards.
- **Current state:** `entitlements.ts` returns ONE price + ONE credit multiplier per slug; `planPresentation(tier)` has no variant param; `billing.functions.ts` `CheckoutInput` is `{tier, workspaceId}` with no variant; the Stripe webhook maps a single price per tier; `accounts` has `plan_tier` but no variant column. The data model can represent this additively (a nullable variant column + a variant param threaded through).
- **Build:** (a) `entitlements.ts`: add a `PlanVariant` type; a Max variant table (`{ id, creditMultiplier, priceUsd }`, "5x" / "20x more usage than Pro") and a Team seat-variant table (Standard / Premium, the 5x / 20x principle per seat); thread an optional `variant` through `entitlementsFor(tier, variant?)` and `planPresentation(tier, variant?)` so the Max and Galaxy cards expand to two rows under one name; keep Pro / Free feature-framed (no public multiplier, per the §2.4.1 copy rule). (b) `billing.functions.ts`: `CheckoutInput` gains `variant?`; `createCheckoutSession` routes the variant to the right Stripe price ID (`STRIPE_PRICE_MAX_5X` / `STRIPE_PRICE_MAX_20X`, `STRIPE_PRICE_TEAM_STD` / `STRIPE_PRICE_TEAM_PREMIUM`); `BillingState` returns `planVariant`. (c) the Stripe webhook: set `metadata[plan_variant]` and reverse-map `price_id -> (tier, variant)`, then store both on the account. (d) `credits.functions.ts`: `monthlyGrantCredits(tier, variant?)` resolves the variant multiplier. (e) migration: `accounts.plan_variant text` (nullable, CHECK in the allowed set), backfill existing `max` / `team` rows to the default variant, extend `protect_account_billing_columns()` to guard the new column.
- **Files:** `src/lib/entitlements.ts` (+ test), `src/lib/billing.functions.ts`, `src/routes/api/stripe/webhook.ts`, `src/lib/credits.functions.ts`, a new migration, config (the new `STRIPE_PRICE_*` secrets, founder-set).
- **Gotchas:** the multiplier values + their "Nx more than Pro" labels must agree (the §2.4.1 coherence gate); the variant is meaningful only for `max` and `team` (null elsewhere); keep the no-secret no-op; the per-seat Team variant is per-seat, not per-account, so the grant math differs from Max.
- **Acceptance:** the Max card shows two usage options and the Team card two seat options, each routes to the right price, the webhook stores the variant, and the monthly grant reflects the chosen variant; non-variant tiers unaffected; tsc / build / lint green.
- **Verify:** unit-test the `price_id -> (tier, variant)` map + `entitlementsFor(tier, variant)`; dormant-path smoke (no secret = inert).
- **Depends on:** `WM-M3`, `WM-M6`, `WM-M11`. **Priority:** M17a (Max, per-account) P2; M17b (Team seats, per-seat, higher complexity) P3.

#### WM-M18 · Plan-card states + change flow (current/upgrade tags, downgrade guard)
- **Why:** founder flag; today Settings -> Plan renders the current plan and the other plans identically, with no signal of which one the account is on, and there is no considered plan-change flow (the lone affordance is "Upgrade to Pro"). The user wants a clear "Current plan" tag, "Upgrade" calls to action on higher tiers, and a guarded downgrade.
- **Current state:** `getBillingState()` returns `planTier` (and, after `WM-M17`, `planVariant`); the BillingTab in `_authenticated.settings.tsx` maps `PLAN_TIERS` but does not compare each card to the active plan; the only mutation is `upgrade.mutate("pro")`.
- **Build:** (a) M18a, presentation states: in the BillingTab (and the public pricing page where relevant), compare each card to `billingState.planTier` (+ variant) and render one of, "Current plan" tag on the active tier, "Upgrade" on higher tiers, a quiet / disabled or "Downgrade" affordance on lower tiers, so the current and base plans never render identically. (b) M18b, change flow: upgrades proceed immediately; downgrades require an explicit confirm and reconcile entitlements (warn about memory moving to decay, products / seats over the new cap, the credit grant dropping), and either block with a "reduce usage first" message or defer the change to cycle end when current usage exceeds the target tier's limits. Define the policy in one place.
- **Files:** `src/routes/_authenticated.settings.tsx` (BillingTab), `src/routes/pricing.tsx`, `src/lib/billing.functions.ts` (the change-flow + reconciliation helpers).
- **Gotchas:** the downgrade reconciliation must be honest about what the user loses (calm, not alarmist, copy, per the humanized + engine-room doctrines); never silently destroy data on downgrade; the "Current plan" comparison must account for the variant (a Max-5x account viewing Max-20x sees "Upgrade", not "Current").
- **Acceptance:** the active plan shows a "Current plan" tag, higher tiers show "Upgrade", downgrades require confirm + reconcile and block / defer when over-limit; no current/base duplication.
- **Verify:** Playwright the BillingTab on accounts at different tiers; assert the right state per card; a downgrade-over-limit blocks / defers.
- **Depends on:** `WM-M6` (and `WM-M17` for variant-aware "Current"). **Priority:** P2.

#### WM-M19 · Enterprise usage model (per-seat + API-rate usage + per-user credit allocation)
- **Why:** §2.4.1; Cosmos (enterprise) is per-seat plus usage at API / pay-as-you-go rates (pooled), plus per-user credit allocation and org / per-user spend limits for fine-grained governance (the founder's explicit ask). The per-user allocation substrate (per-member caps) shipped as `WM-M14` on 2026-06-19, so this is wiring + an admin surface, not new engine design.
- **Current state:** `WM-M14` shipped `credit_caps` (account-scoped, scope product / member, cap + window) + `assertCreditCaps` + the attribution rollup; `credit_ledger` already tags `user_id`. Enterprise is "Contact sales" with a custom credit model (§2.4 note). No per-seat + API-rate billing model and no admin allocation surface yet.
- **Build:** the enterprise credit model (one of the §2.4 options, default seat-based pooled + metered usage at API rates, invoiced) + an admin surface for per-user credit allocation / spend limits built on the `WM-M14` `credit_caps` member scope + a cap write path; org-level spend limits; surface per-user and per-product attribution (`WM-M14` `computeCreditAttribution`) in an admin view.
- **Files:** `src/lib/credits.functions.ts` (the cap write path + allocation helpers), `src/lib/billing.functions.ts` (the enterprise model), an admin settings surface, a migration only if a new allocation table is needed beyond `credit_caps`.
- **Gotchas:** enterprise is negotiated, so keep the model configurable per deal; build on `WM-M14` rather than a parallel mechanism; reads RLS-scoped to account membership; deferred per the GTM sequencing (enterprise comes after the loop is proven, §2.7).
- **Acceptance:** an enterprise account can set per-user credit allocations + org spend limits, usage bills at the configured model, and the admin view shows per-user / per-product attribution.
- **Verify:** seed an enterprise account, set a per-user allocation, exceed it, assert the scoped halt; assert the attribution rollup.
- **Depends on:** `WM-M3`, `WM-M14`. **Priority:** P3 (enterprise deferred).

#### Lovable handoff (ready-to-send, NOT yet sent)
When the founder picks this up, send Lovable this as a `plan_mode=true` (spec, no build) message first, then convert it to a build prompt:

> Spec only for now, do not implement. Adopt Anthropic Claude's two-toggle pricing presentation, tuned to Cadence. Individual toggle: Star (free) / Cluster (pro) / Constellation (max). Business toggle: Galaxy (team) / Cosmos (enterprise). Constellation is one card with two usage variants at checkout, "5x more usage than Pro" and "20x more usage than Pro" (a Save anchor on 20x). Galaxy is one card with two seat variants, Standard and Premium, the same 5x / 20x principle per seat. Star and Cluster are sold on features only, NEVER a usage number (Cluster is the silent reference unit the multipliers anchor to). Cosmos is per-seat + usage at API rates + per-user credit allocation (built on the shipped WM-M14 per-member caps). Column-additive only: add a nullable `accounts.plan_variant`, thread an optional variant through `entitlementsFor` / `planPresentation` / `createCheckoutSession` / the Stripe webhook (price -> tier+variant reverse-map) / `monthlyGrantCredits`. Settings -> Plan must tag the active plan "Current plan" and show "Upgrade" on higher tiers (no current/base duplication), and guard downgrades (confirm + entitlement reconciliation; block or defer when over-limit). Honor the humanized-output and engine-room doctrines. Prices, multipliers, and final names are founder-gated placeholders; do not invent them. Reference: docs/planning/workspace-tenancy-and-monetization-plan.md §2.4.1 + WM-M17/M18/M19.

### 4.3 Lane S, Showcase (DEFERRED, gate: platform ~50 to 60 percent complete and fine-tuned)

These are specified now and **resurfaced at every milestone gate**; do not build until the gate.

#### WM-S1 · Sample workspace for every new account
- **Why:** every new user (and investors) should land in something fully populated, not just two `demo@` accounts.
- **Build:** a richly seeded, branded sample/explore workspace (reuse + rebrand the existing `seed_demo_workspace` Lumen narrative; proposed name "Northwind"), present alongside the user's own clean workspace; resettable sandbox; provisioned per signup.
- **Files:** the seed function (migration) + onboarding provisioning (`src/lib/onboarding.functions.ts`).
- **Acceptance:** a new signup has a populated sample workspace + an empty real one.

#### WM-S2 · Guided tour
- **Build:** an interactive walkthrough overlaid only on the sample workspace (where to start, the loop, where it ends); the user's own workspace is free play (no tour).
- **Acceptance:** the tour runs in the sample, not in the real workspace.

#### WM-S3 · Onboarding Concierge agent
- **Build:** an agent that connects the user's sources and seeds their REAL workspace from real context on day one (cold start -> warm start), reusing the Watch/Research/Listen mesh.
- **Acceptance:** with a connected source, the concierge seeds real signals into the real workspace.

#### WM-S4 · Workspace Steward agent
- **Build:** an agent that nudges when the brief is stale or decisions lack a logged outcome (which feeds the memory moat).
- **Acceptance:** stale brief / outcome-less decisions surface a nudge.

#### WM-S5 · Investor-demo rich population + reset
- **Build:** ensure every surface in the sample is populated and current (more eval runs, longer drift history); a self-serve "Reset sample" in settings.
- **Acceptance:** every demo surface is populated; reset works.

### 4.4 Lane D, Docs / registration / cascade

#### WM-D · Documentation, registration, cross-link, cascade (this deliverable)
- Register all `WM-*` in `feature-dashboard.md` (new group, Foundation active/Next, Showcase Deferred) + a build-queue section in `SOURCE-OF-TRUTH.md`, both pointing here.
- Cascade: a `session-decisions.md` entry + a `strategic-inputs-log.md` entry; a `strategy/README.md` role-map row; cross-link `byo-build-and-cadence-cloud.md` both ways.
- Create `docs/features/workspaces.md`; update `docs/features/pricing.md`.
- Update `architecture/data.md` + `architecture/security.md`.
- Update the SSOT section 0 (the live cursor) + `plan.md` Section 4.
- Cross-reference this plan from `AGENTS.md`, `CLAUDE.md`, `README.md`, and the Lovable config so every tool finds it.

---

## 5. Build order, phases, dependencies

1. **Critical path:** `WM-M1` (entitlements core, no DB) and `WM-F1` (memory scoping) first. `WM-M10` (credit unit + conversion, no DB) can build in parallel here too; it only needs `WM-M1`.
2. **`WM-M2`** (accounts table + migrations) next; it unblocks billing relocation, pooling, limit gates, and the credit pool (`account_credits`).
3. **Parallel after M2:** `WM-F3` (RBAC), `WM-M5` (limit gates), `WM-F2` (account pooling), `WM-F9` (leak fixes, do before invites), `WM-M11` (per-tier credit amounts + grant/reset).
4. **Then:** `WM-F4`/`WM-F5` (transfer, invites), `WM-M3`/`WM-M4` (billing rails, credit seam), `WM-F7`/`WM-F8` (settings IA, switch hardening), `WM-M6`/`WM-M7`/`WM-M8` (surfaces, nudges, motif), `WM-M9` (remove self-serve BYOK; sequence with the monetization surfaces).
5. **The credit engine (after the `WM-M4` seam + the `WM-M2` pool exist), §4.2.1:** `WM-M12` (the debit engine that fills the seam) is the keystone; then `WM-M13` (top-ups, after `WM-M3`), `WM-M14` (attribution + caps), `WM-M16` (credit / usage UI, with `WM-M6`). `WM-M15` (margin levers) can build any time after `WM-M10`.
6. **Then:** `WM-F6` (move product) and full cross-account features.
7. **Deferred:** `WM-S*` behind the maturity gate.

Flip switches (`memory_expiry_enabled`, `credits_enabled`, Stripe secrets) are last and founder-gated. The AI credit **engine is specified here** (§4.2.1, `WM-M10` to `WM-M16`), no longer a separate thread; it plugs onto the `WM-M4` seam and goes live only when the founder flips `credits_enabled()`.

---

## 6. Verification and acceptance (global)

- **Hard gate:** `bun run lint` + `tsc --noEmit` + `bun run build` green before any commit; no secret/service-role leak into the client bundle.
- **Tests:** `entitlements.test.ts` (5 tiers); RLS tests (member of A cannot read B; recall pools across an account's workspaces only when paid); the limit triggers block over-limit direct inserts; the credit seam debits only when enabled and only for non-BYOK.
- **Migrations:** apply cleanly on a Supabase branch; accounts backfill leaves no orphan; single-user accounts still work; `get_advisors` clean.
- **Playwright (hosted):** second workspace blocked on Star / allowed on a paid account; product limit on Star; invite + accept; ownership transfer + audit row; switch with no stale flash + paid pooling; Settings shows Account/Workspace/Personal; pricing + BillingTab show 5 Constellation tiers; BYOK call does not debit.
- **Regression:** seeded `demo@` accounts + new-user onboarding still work.

---

## 7. Open founder decisions (defaults chosen; non-blocking)

1. Crescendo (`max`) and Galaxy (`team`) per-seat prices, defaults are placeholders.
2. **Credit numbers (the engine is now specified here in §4.2.1; only the values are open):** `CREDIT_COGS_USD` + the per-model rate (`WM-M10`); the per-tier monthly credit amounts + the starter free grant (`WM-M11`); the top-up pack prices + the per-cycle ceiling (`WM-M13`). The mechanism is final and stays dormant behind `credits_enabled()`; only these numbers need the founder, and not until the engine goes live.
3. Workspace generosity past the free line, default generous/unlimited pooled.
4. Workspace-scoped agent roster, default yes.
5. Sample workspace name, default "Northwind."
6. Memory-decay + credits flip timing, default dormant until first-win is reliable.
7. Final tier display names + motif, default Constellation (rename-able anytime via the slug decoupling).
8. Whether to keep an enterprise BYOK / residency path long-term, or remove BYOK entirely later (default: enterprise-only, negotiated).
9. **Usage-variant numbers + labels (§2.4.1, `WM-M17`):** the Constellation (`max`) variant multipliers + prices ("5x" / "20x more usage than Pro", Anthropic anchors about 100 / 200 dollars) and the Galaxy (`team`) seat-variant multipliers + prices (Standard about 25 to 30 dollars per seat, Premium higher). Each multiplier and its "Nx more usage than Pro" label must be set together so the math and the copy agree (the coherence gate). Default: placeholders; the structure supports any values.
10. **Downgrade policy (`WM-M18`):** block-when-over-limit vs defer-to-cycle-end, and the memory / credit / seat reconciliation shown on downgrade. Default: confirm + reconcile, block or defer when current usage exceeds the target tier.
11. **Enterprise usage model + per-user allocation (`WM-M19`):** the per-seat + API-rate model choice (the §2.4 options) and the per-user credit allocation / org spend-limit policy, built on the shipped `WM-M14` caps. Default: seat-based pooled + metered usage at API rates, per-user allocation via `credit_caps`.
12. **Customer-facing naming (extends item 7):** plain names (Free / Pro / Max / Team / Enterprise = the slugs) for legibility vs the Constellation motif names (Star / Cluster / Constellation / Galaxy / Cosmos) as the primary label. The slug decoupling makes this a one-file change either way.

---

## 8. Cross-links and cascade map

- Status: [`feature-dashboard.md`](./feature-dashboard.md) (per-item board), [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (front door).
- Execution context: [`v10_implementation-plan.md`](./v10_implementation-plan.md), [`considerations.md`](./considerations.md).
- Strategy: [`../strategy/moat.md`](../strategy/moat.md) (the moat / competition / positioning canon, the source for §2.3), [`../strategy/byo-build-and-cadence-cloud.md`](../strategy/byo-build-and-cadence-cloud.md) (Section 5.5 monetization canon), [`../strategy/session-decisions.md`](../strategy/session-decisions.md), [`../strategy/strategic-inputs-log.md`](../strategy/strategic-inputs-log.md), [`../strategy/README.md`](../strategy/README.md) (role map).
- Architecture: [`../../architecture/data.md`](../../architecture/data.md), [`../../architecture/security.md`](../../architecture/security.md).
- Feature specs: [`../features/workspaces.md`](../features/workspaces.md), [`../features/pricing.md`](../features/pricing.md).
- Conventions: [`../conventions/humanized-output.md`](../conventions/humanized-output.md), [`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md).
- Entry points that reference this plan: [`../../AGENTS.md`](../../AGENTS.md), [`../../CLAUDE.md`](../../CLAUDE.md), [`../../README.md`](../../README.md), the Lovable config.
