# Cadence Pricing Strategy

> _Created: 2026-06-26 (founder session — 4-tier model decision + credit-dropdown architecture)_
> _Last updated: 2026-06-26_

> **Status: CANONICAL.** This is the single source of truth for WHY Cadence prices the way it does, WHAT each tier signals to the user, and HOW the credit model works. The IMPLEMENTATION spec (per-ID build tasks) lives in [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md). The TECHNICAL billing rail lives in [`../features/billing.md`](../features/billing.md). This doc is the strategy layer those two reference.

> **Maintainer rule:** every pricing decision — tier change, feature gate move, credit model adjustment — must be recorded here AND in [`session-decisions.md`](./session-decisions.md) in the same session.

---

## 0. The decision this document records (2026-06-26)

The founder reviewed six reference pricing pages (Lovable, Lovable with credit dropdown open, Replit, Bolt.new, Claude Individual, Claude Team & Enterprise) and resolved the following standing ambiguities:

1. **4 tiers, not 5.** Drop the separate "Max/Constellation" tier. A credit dropdown on Pro covers that persona.
2. **Lovable-style credit dropdown, not Anthropic-style usage multipliers.** Linear pricing per credit, no volume discount on credit selection.
3. **Annual/monthly frequency toggle is the ONLY discount mechanism.** Switching monthly to annual gives a percentage discount (e.g., pay 10 months, get 12 = ~17% off). Selecting more credits does NOT give a discount.
4. **Enterprise = platform fee + per-seat + API usage rates.** Contact sales path. No public self-serve price.
5. **Credits are account-level pooled**, not per-seat. Admins set per-user spend limits from the existing `credit_caps` engine (WM-M14). The pool is shared; control is per-user.

These decisions supersede the 5-tier Anthropic-style packaging described in [`workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) §2.4.1 (which is retained as the historical reasoning). For public pricing presentation and WM-M17/M19 implementation, **this doc governs**.

---

## 1. Why we went with 4 tiers and the Lovable model

### What we rejected: Anthropic's 5-tier multiplier model

Anthropic's pricing (Free / Pro / Max, with Max showing "5x or 20x more usage than Pro") is optimized for users who already understand AI token consumption deeply. The "5x / 20x" framing is a multiplier on a unit the user cannot directly observe. It works for Anthropic because:
- Claude's users are often developers who think in tokens/context windows
- The multiplier is legible because "5x more Claude usage" is a felt experience

For Cadence, this model has two problems:
1. **Cadence users think in outcomes, not usage.** A PM does not ask "how many tokens will I burn this month?" They ask "how many missions can I run, how many decisions can I analyze, how much of the loop can I automate?" A usage multiplier is abstract where it should be concrete.
2. **The 5-tier stack is cognitively heavy.** Free / Pro / Max / Team / Enterprise with Individual/Business toggles and 5x/20x sub-choices on Max is too many decisions at the moment of purchase.

### What we chose: Lovable's 4-tier credit dropdown

Lovable's model (Free / Pro / Business / Enterprise, with a credit dropdown on Pro and Business) maps exactly to how Cadence users think:
- The credit dropdown is a concrete selector: "I run about 400 credits of missions per month, so I'll pick 400."
- 4 tiers with a clean value step at each boundary is a faster purchase decision.
- The dropdown lets users self-size without a menu of named sub-plans. Each credit option routes to its own Stripe price (catalog-managed).

**The key correction from the Anthropic model:** the dropdown does NOT give a volume discount. More credits = more cost, linearly. The only discount is switching from monthly to annual billing (roughly 17% off, framed as "get 2 months free"). This keeps the math simple and the upgrade motivation honest: you upgrade credits because you need more, not because a discount made a bigger bundle look smart.

### Why this fits Cadence specifically

Cadence's value is the decision layer, not the raw AI compute. Credits are the meter; the decision memory, the Critic, the Trust Ledger, the governance rails — those are the product. The credit dropdown says "how much of the engine do you want running" and the tier boundary says "what level of the product do you need." These are orthogonal questions, which is why the dropdown sits inside a tier card rather than across separate tier cards.

---

## 2. The 4-tier ladder

### Tier slugs (DB-canonical; names are presentation-only)

The database, Stripe, and all RLS checks key on slugs. Display names are a skin over the slug, changeable with a one-file edit and no migration.

| Slug | Display name | Who it is for |
|---|---|---|
| `free` | Free | Solo PM or indie trying the loop. Enough to feel the aha. |
| `pro` | Pro | Power individual who needs persistent memory + the full loop. |
| `team` | Business | Team whose decisions need shared memory, approval lanes, and admin control. |
| `enterprise` | Enterprise | Org with governance, compliance, SSO, and negotiated pricing needs. |

> Note: the `max` slug remains valid in the database (existing data) but is NOT a public pricing tier. The Pro credit dropdown covers the persona that Max was designed for. No migration needed; `max` stays as a backward-compat slug.

### Base prices (placeholder values; set final numbers in Stripe and Admin console)

| Tier | Monthly price (base) | Annual price (base) | Included credits |
|---|---|---|---|
| Free | $0 | $0 | 50 credits/mo |
| Pro | $20/mo | $17/mo (billed annually, ~17% off) | 100 credits/mo |
| Business | $50/mo | $42/mo (billed annually, ~17% off) | 100 credits/mo |
| Enterprise | Platform fee (contact sales) | Negotiated | Custom |

Annual toggle shows a "Save X%" nudge on the Pro and Business cards only. Free and Enterprise do not have annual toggles.

### Credit dropdown ladder (Pro and Business)

Same ladder for both tiers. Price per rung is the per-tier base price multiplied linearly by the credit ratio (no volume discount):

| Credits/mo | Pro monthly price | Business monthly price |
|---|---|---|
| 100 (base) | $20 | $50 |
| 200 | $40 | $100 |
| 400 | $80 | $200 |
| 800 | $160 | $400 |
| 1,200 | $240 | $600 |
| 2,000 | $400 | $1,000 |
| 3,000 | $600 | $1,500 |
| 4,000 | $800 | $2,000 |
| 5,000 | $1,000 | $2,500 |
| 7,500 | $1,500 | $3,750 |
| 10,000 | $2,000 | $5,000 |

> **These are placeholder linear prices; the actual values are set in Stripe by the founder and flow through the admin pricing catalog (`pricing_bundles` table). The table above records the model, not the final numbers.**

Each dropdown option maps to a Stripe `lookup_key` via `billing-tier.ts:lookupKeyFor(tier, credits, interval)`, e.g., `cluster_200_monthly`, `galaxy_400_yearly`. The webhook reads credits from the lookup key to grant the right monthly allowance.

---

## 3. Full value matrix per tier (what users actually get)

The matrix is organized by value dimension, not just credits and workspace limits. Every limit listed is a real gate the product enforces.

### 3.1 Decision Memory (the core moat)

Memory is why someone pays. It is the primary charge lever and the lock-in mechanism. A user's decisions, outcomes, and "was I right?" loop are the moat. Memory limits are the clearest upgrade signal because the user FEELS the decay.

| Dimension | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Memory persistence | 30-day rolling decay | Persistent, never expires | Persistent, never expires | Persistent, custom retention |
| Cross-workspace recall | No | Within your own workspaces (paid benefit) | Pooled across all team members' workspaces | Org-wide, cross-workspace |
| Decision Brain (supersession engine) | No | Yes (Critic red-teams every PRD + bet) | Yes + custom Critic profiles | Yes + approved-model lists + custom profiles |
| Trust Ledger history | 30 days (mirrors memory) | Full persistent history | Full persistent history | Full + compliance-grade export + legal hold |

### 3.2 Agent Execution Capacity (the loop engine)

This is what "credits" actually buy: the amount of autonomous loop execution the user gets per month. More credits = more missions run autonomously, more Critic passes, more research cycles.

| Dimension | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Monthly AI credits | 50 (starter aha) | 100-10,000 (dropdown) | 100-10,000 (dropdown, pooled across team) | Custom (committed pool or API-rate metered) |
| Parallel missions | Limited (2) | More (5) | Team-level (based on seat count and pool) | Custom |
| Agent loop depth | 3 steps max | 6 steps (full) | 6 steps + approval gates | 6 steps + custom gates |
| Credit top-ups | Not available | Capped fair-use top-ups | Capped fair-use top-ups | Custom volume / postpaid |
| Rollover | No | No | No | Negotiated |
| Billing frequency discount | N/A | Monthly or Annual (~17% off annual) | Monthly or Annual (~17% off annual) | N/A (negotiated) |

### 3.3 Research and Signal Ingestion (the Sense layer)

How much context the loop can pull from the outside world — and how far it can push decisions back out.

> **2026-06-27 decision — integration tiering (founder session):**
> Inspired by Notion's pricing page (Basic integrations on Plus, Premium integrations on Business). Cadence's core value is connecting to where work happens — GitHub, Linear, Notion, Jira. Connector access IS the product, not a feature list item, so tiering it drives the sharpest upgrade signal below memory. The read/write split is the key: Pro lets you pull signals in; Business lets Cadence push decisions back out to where the team works. The upgrade moment: "why is my team still copy-pasting Cadence decisions back into Jira? Business does that automatically."

**Connector tier definitions (enforced at the server credential chokepoint — `resolve.server.ts`):**

| Tier | Connector access |
|---|---|
| Free | Manual input only. No live connectors. |
| Pro | Read connectors — pull signals in (GitHub issues/PRs, Linear cycles, Notion pages, Jira tickets). No write-back. |
| Business | Read + Write connectors — read signals in AND push decisions back (create GitHub issues from PRDs, update Linear/Jira ticket status, write Cadence decisions to Notion pages). Team-shared sources (one GitHub OAuth covers the whole team). |
| Enterprise | Custom connectors + connector development. Full API rates. Dedicated pipelines. |

**Why read-only on Pro:** a solo PM who pulls signals in gets enormous value. They can see their GitHub repo health, their Linear backlog health, their Notion docs. That is the aha moment. But write-back is a TEAM operation — creating a GitHub issue from a PRD should be reviewed before it lands in the repo. Governance belongs to Business. This creates a clear, felt upgrade reason even before a second seat is added.

**Why write-back on Business only:** write-back connectors create real-world artifacts. A mis-configured agent that creates 200 duplicate Jira tickets is a team incident, not a personal one. Approval lanes (also Business) are the safety gate for write-back connectors. The two features are designed to ship together.

**Per-connector capability map:**

| Provider | Reads in (Pro+) | Writes out (Business+) |
|---|---|---|
| GitHub | Issues, PRs, commits, repo health | Create issues from PRDs; auto-close on ship |
| Linear | Cycles, issues, project status | Create/update issues; link PRDs to cycles |
| Jira | Tickets, sprints, epic health | Create tickets; transition status from agent decisions |
| Notion | Pages, databases, docs | Write decision records; update PRD status |
| Google Docs | Documents as signal source | Write Cadence summaries to docs |
| Figma | Design files (reference only) | N/A (read-only by nature) |
| Google Calendar | Meeting events for context | N/A (read-only) |
| Microsoft Outlook | Meeting events for context | N/A (read-only) |

**Implementation:** `connectorTier: 'none' | 'read' | 'read_write' | 'custom'` field in `Entitlements`. The enforcement chokepoint is `assertConnectorCapability(planTier, capability)` in `entitlements.ts`, called in every server function that triggers an outflow operation.

| Dimension | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Connector tier | None (manual input) | Read (inflow only) | Read + Write (inflow + outflow) | Custom + write-back |
| Max connectors | 0 live | Unlimited (read-only) | Unlimited (read + write) | Unlimited + bespoke |
| Write-back to GitHub/Linear/Jira/Notion | No | No | Yes | Yes |
| Team-shared connector pool | No | No (personal per-user OAuth) | Yes (one OAuth covers team) | Yes + dedicated pipelines |
| Ambient signal ingestion | Manual | Auto (sense-tick on your account) | Auto + team-shared sources | Auto + dedicated pipelines |
| Custom connector development | No | No | No | Yes |
| Web research | Basic | Full | Full | Full |
| Research depth (concurrent agents) | 1 | 3 | 5+ | Custom |

### 3.4 Collaboration and Governance (the team layer)

The sharpest Pro-to-Business differentiator. This is not about seats as a number — it is about shared accountability for what the agents decide and do.

| Dimension | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Seats | 1 (solo) | 1 (solo) | Many | Many (per-seat billed) |
| Roles (RBAC) | No | No | Owner / Admin / Member / Viewer | Full + custom role definitions |
| Approval lanes | No | No | Yes (per-role gating for agent actions) | Yes + custom gate policies |
| Shared playbook library | No | Personal only | Team-shared (everyone can access and run) | Org-wide |
| Per-user credit spend limits | No | No | Yes (admin sets via `credit_caps`) | Yes + org-level spend limits |
| Team-wide agent audit trail | No | No | Yes | Yes + compliance export |
| Workspace guardrails | Personal | Personal | Workspace-level (admin sets) | Org-level + approved-model lists |
| Centralized billing | No | No | Yes | Yes |

### 3.5 Workspace and Product Organization

These are upgrade signals, but they are secondary to memory and governance. The workspace and product limits exist to create a natural feel of "I've outgrown this tier," not to punish users.

| Dimension | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Workspaces | 1 | Pooled (no hard limit) | Pooled | Custom |
| Products (projects) | 2 | 3 | Generous (no hard limit) | Custom |
| Connectors per product | 1 | Unlimited | Unlimited | Unlimited |
| Custom workspace brief/voice | No | Yes | Yes | Yes |

### 3.6 Support and SLA

| Dimension | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Support channel | Community | Email (next-business-day) | Chat (same-business-day SLA) | Dedicated CSM + named contacts |
| Incident response | Community | Best effort | Priority | 24/7 |
| Onboarding | Self-serve | Self-serve | Onboarding session | Custom |
| SLA | No | No | Yes | Signed SLA |

### 3.7 Privacy, Security, and Compliance

| Dimension | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| No model training on content | Default Cadence policy | Default Cadence policy | Explicitly confirmed | Contractually guaranteed |
| SSO | No | No | No | Yes (SAML/OIDC) |
| SCIM provisioning | No | No | No | Yes |
| Data residency | No | No | No | Custom |
| DPA / BAA | No | No | No | Yes |
| Audit export | No | No | Full (last 90 days) | Full + custom retention |
| HIPAA-ready | No | No | No | Offering available |

---

## 4. The credit pool architecture (Business + Enterprise)

### How Business credits work

Under the Business plan, credits are **account-level pooled**. The $50/mo base (or whatever the dropdown selects) buys a credit pool for the entire account — not 100 credits per seat. This is the right model because:

1. **AI usage is uneven across a team.** The PM running a critical product decision this week uses more credits than the designer reviewing a brief. A per-seat allocation wastes credits for low-use members and starves high-use members. A shared pool lets the team allocate credits to the highest-value work.
2. **Credit pooling is itself a collaboration feature.** When the whole team draws from one pool, everyone has a stake in using it well. This encourages governance (which is what Business tier is for).
3. **Admin control via per-user spend caps.** The `credit_caps` table (from WM-M14) lets admins set maximum monthly spend per member. This is the governance layer: the pool is shared, but admins control who can access how much of it.

**How per-user spend caps work:**
- Admin goes to Admin > Usage and sets a monthly cap for each member (e.g., member A: 30 credits, member B: 50 credits, unset members: unlimited from pool).
- The `assertCreditCaps` function enforces the cap at the time of each agent action debit.
- The `computeCreditAttribution` function shows per-user and per-product usage in the admin view.
- When the pool runs low, all members see a "team credit pool is low" signal. The admin tops up or reduces caps.

### How Enterprise credits work

Enterprise accounts have a negotiated credit model. Options (per §2.4 of the monetization bible):
- **(a) Seat-based pooled:** each seat carries a monthly allowance, pooled org-wide. Admins allocate from the pool. Simplest to invoice.
- **(b) Committed org pool:** annual credit commitment with a volume discount. Like a pre-paid block.
- **(c) Postpaid metered:** usage invoiced monthly at API rates, true-up at cycle end. Best for unpredictable usage.
- **(d) BYOK / dedicated capacity:** customer's own model keys or a dedicated inference deployment. COGS off Cadence's book.

The default recommendation is (a) seat-based pooled + per-user caps, which is the Anthropic Team/Enterprise model (from reference image 6). The enterprise contact-sales path selects the model per deal.

---

## 5. The upgrade narrative ("why would I upgrade?")

This section documents the felt reason at each tier transition — not the feature list, but the human moment.

### Free to Pro

**The moment:** the user has been running missions and making decisions for a few weeks. They go back to reference a decision from 6 weeks ago and it is gone (30-day decay). Or they run a mission and the Critic does not red-team it because Critic-everywhere is a Pro feature. The memory decay is felt, not just noticed.

**The felt reason:** "I made a decision two months ago about the product direction. I need to know if it was right and what I've learned since. It is gone. I need my memory to persist."

**Secondary reasons:**
- The Critic is not on my side on every spec I write (Pro: Critic everywhere)
- I can only track 2 products (Free limit)
- I cannot recall across all my workspaces (cross-workspace memory is paid)

**What does NOT drive this upgrade:** workspace count, connector count, product count. These are guardrails, not felt limits.

### Pro to Business

**The moment:** a second person needs to see, comment on, or approve what the agent is doing. Or the user wants to run the loop for a whole team but cannot share credit expenses, cannot see who ran what, and cannot set rules on what the agents are allowed to decide alone.

**The felt reason:** "My team is using this tool but I have no idea what the agents are deciding on their behalf. I need approval before agents commit to a direction. I need to share the cost fairly across the team."

**The key insight:** Pro is a solo PM with a very capable assistant. Business is when decisions cross people and accountability must be shared. The upgrade is NOT about getting more credits per person — it is about getting governance.

**Secondary reasons:**
- Team members cannot access the same playbook library (shared playbooks are Business)
- Personal workspace guardrails are not enforced across the team
- No central billing view: each person's usage is invisible to the admin
- No shared connected sources: each person has their own GitHub OAuth (Business: team-shared connectors)

**What does NOT drive this upgrade:** the number of seats is a consequence, not the cause. The cause is shared accountability.

### Business to Enterprise

**The moment:** the organization needs procurement, compliance, and a contract. Legal has questions. IT needs SSO. Security needs a DPA. The company wants guaranteed data residency or a negotiated usage commitment.

**The felt reason:** "Our security team will not approve a product without SSO, SCIM, and a signed DPA. Our legal team wants a contract and SLA. Our finance team wants to negotiate a committed spend rather than a monthly credit pool."

---

## 6. The "why does workspace and product count matter?" question

The founder raised this directly: "if I'm on Free with 1 workspace and 2 products and Pro gives me pooled workspaces and 3 products, what is the real motivation to upgrade?"

**The honest answer:** workspace and product limits are weak upgrade drivers. They exist as guardrails, not as the primary charge lever. They create a natural "I want more" feeling for power users, but they are not the reason someone pulls out a credit card.

**The real upgrade ladder is:**

1. **Free → Pro:** Memory decay becomes pain. This is unavoidable and deeply felt. Every PM who uses the product for more than 30 days hits it. This is the primary charge lever.
2. **Pro → Business:** Shared accountability becomes necessary. This happens when decisions affect a team. This is the governance charge lever.
3. **Business → Enterprise:** Compliance and contract become necessary. This happens at org scale. This is the procurement charge lever.

**Workspace and product limits serve two purposes:**
- They prevent abuse on the free tier (a solo user with 20 products is likely a developer testing the API, not a genuine PM; the 2-product limit creates a natural pressure to self-identify as a paying customer)
- They give the product a clean onboarding story: "start with 2 products. When you have a third real product, upgrade" (the 3-product Pro limit is a clean hand-off)

They are NOT the reason to build elaborate product-count enforcement. They are a secondary guardrail.

---

## 7. Value factors beyond memory and workspace

These are features that have user value but are often undercommunicated. They should appear on the pricing page and in settings, not just in the feature matrix.

### 7.1 Critic depth (not just "on/off")

Free users get no Critic. Pro users get the Critic on every PRD and bet. Business users get Critic with custom profiles (e.g., "red-team from the perspective of our largest enterprise customer" as a saved profile). Enterprise users get approved-model lists (the Critic runs on a specific model the security team has approved).

This is a meaningful upgrade signal that the pricing page should communicate: the Critic gets SMARTER and more customizable as you upgrade.

### 7.2 Trust Ledger completeness

On Free, the Trust Ledger (the record of what agents decided, why, and whether it was right) is only 30 days deep (mirrors memory). On Pro+, it is the full history. This means a Pro user can run a quarterly retrospective ("look at every decision we made this quarter and how many were validated by outcome") — something a free user literally cannot do.

This should be a pricing page highlight: "Full decision audit history" on Pro.

### 7.3 Playbook sharing (team multiplier)

On Pro, a user's playbook (a saved pattern of "run the Critic → PRD → mission → ship" for a specific context) is personal. On Business, the whole team can access and run each other's playbooks. This is a compound value: one person invests in building a great playbook pattern, and the whole team benefits. The value scales with team size, which is exactly what a team tier should do.

### 7.4 Research depth (ambient intelligence)

On Free, research runs manually. On Pro, the ambient sense-tick runs on your account (the product monitors your signals and surfaces insights without you asking). On Business, sense-tick monitors team-shared sources, meaning one GitHub OAuth covers all team members' activity in the repo, and one PostHog connection covers all team members' analytics view.

This is the "shared intelligence" value of Business beyond seats: the product gets smarter for the whole team at once, not just individually.

### 7.5 Approval lanes as trust infrastructure

Approval lanes (Business+) are not just a permission feature. They are the mechanism by which the product becomes safe to give to a team: the agents cannot commit a product direction, close a decision, or merge a build without a designated human approving it. For a PM team where agents are making real product decisions, this is the safety gate that makes the product enterprise-ready before the formal enterprise tier.

For the Business tier, approval lanes are a SELLING POINT, not just a feature. They let the team say "our agents are governed" to a skeptical head of product.

---

## 8. Enterprise model detail

Enterprise (Cosmos slug) is not a self-serve tier. The contact-sales path is deliberate:
- Pricing is a function of seat count, usage commitment, and compliance requirements — no single price fits all
- Enterprise conversations involve procurement, legal, and security, which need human handling
- The "platform fee based on company size" (Lovable's Enterprise model) is the right frame: a base platform fee that covers all employees (like an org-level access), plus per-seat pricing for active users, plus API-rate metered usage for heavy volume

**The Enterprise pricing formula (for sales use):**
- Platform fee (indexed to company headcount or negotiated flat)
- + per active seat per month (standard or premium tier — mirrors Claude's Standard $20/seat / Premium $100/seat model from image 6)
- + metered API usage at cost (for committed pools or postpaid)
- + optional: BYOK / dedicated capacity (removes the metered usage element)

**Enterprise features that justify the premium (all confirmed built):**
- SSO / SAML / OIDC
- SCIM provisioning
- Custom data retention and legal hold
- Dedicated CSM and named contacts
- DPA / BAA
- 24/7 incident response
- Compliance-grade audit export
- Org-level spend limits and per-user allocation
- Custom connector development
- Volume pricing on credits
- Custom MSA, indemnification, and IP terms

---

## 9. Implementation map (what code changes)

> **2026-06-27 additions — connector tiering:**
>
> | What | File | Change |
> |---|---|---|
> | Add `connectorTier` entitlement + `assertConnectorCapability` helper | `src/lib/entitlements.ts` | New field + exported function |
> | Enforce connector capability at credential chokepoint | `src/lib/connectors/resolve.server.ts` | Add `requiredCapability` param; block outflow for Free/Pro |
> | Add `minTier` to catalog entries | `src/lib/connectors/catalog.ts` | `CatalogEntry` gains `minTier: PlanTier` |
> | Surface connector tiers on pricing page | `src/routes/pricing.tsx` | Add connector access row to feature highlights |
> | Surface connector tiers in settings/billing | `src/components/billing/PlanPicker.tsx` | Update highlights |
> | Update `planPresentation()` highlights | `src/lib/entitlements.ts` | Pro highlights get "read connectors"; Business gets "write-back connectors" |

This section maps the strategy to the build items. Full per-file specs live in [`workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) §4.2.2.

| What | File | Change |
|---|---|---|
| Drop Max from public pricing; rename Team → "Business" in presentation | `src/lib/entitlements.ts` | `planPresentation("team")` display name → "Business"; `planPresentation("max")` marked internal/deprecated; add `creditAmount?` param so price line updates dynamically |
| Credit dropdown tiers + linear pricing | `src/lib/billing-tier.ts` | Add `CREDIT_DROPDOWN_TIERS` constant + `priceForCredits(tier, credits, interval)` — the pricing table mapping (tier, credits, interval) to dollars; annual discount factor constant |
| Variant-aware checkout | `src/lib/payments.functions.ts` | `CheckoutInput` adds `credits` field; `createCheckoutSession` routes to the right Stripe lookup key via `lookupKeyFor` |
| Store credit tier on account | `src/routes/api/public/payments/webhook.ts` | Parse credits from lookup key via `creditsFromLookupKey`; store on account for grant calculation |
| 4-tier pricing page with dropdown | `src/routes/pricing.tsx` | Full redesign: 4-column layout, credit dropdown on Pro + Business, annual/monthly toggle per card with % savings nudge, "includes everything in X, plus:" feature lists |
| In-app billing tab with credit dropdown | `src/routes/_authenticated.settings.tsx` | BillingTab: credit dropdown for upgrade, "Current plan" tag, annual toggle |
| Monthly grant reflects selected credits | `src/lib/credits.functions.ts` | `monthlyGrantCredits(tier, creditAmount)` resolves from account's stored credit tier |
| Enterprise admin allocation surface | `src/lib/credits.functions.ts` + new admin UI | Per-user credit allocation write path on `credit_caps` member scope; org spend limit |
| DB: no new tier schema needed | — | `max` slug stays valid; `team` slug is "Business" in presentation. No migration for this change. |
| DB: enterprise per-user allocation | Migration | If needed: new `enterprise_seat_allocation` table, or reuse `credit_caps` (WM-M14) |

---

## 10. What this document supersedes

- The 5-tier Anthropic-style packaging in [`workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) §2.4.1 (the "Max 5x/20x + Team Standard/Premium seat variants" framing). That section is retained as historical reasoning. **This doc's 4-tier model governs.**
- The `billing.md` tier shape section (which describes an old 5-tier individual/business split). `billing.md` documents the technical rail; this doc documents the strategy it executes.
- Any prior reference to "Constellation/Galaxy/Cosmos" as the public tier names. Those names are now internal only (slug presentation aliases). The public names are Free / Pro / Business / Enterprise.

---

## 11. Cross-references

- **Implementation specs (build tasks):** [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) — WM-M17 (credit dropdown), WM-M18 (plan-card states), WM-M19 (enterprise usage model)
- **Technical billing rail:** [`../features/billing.md`](../features/billing.md) — how Stripe, checkout, webhooks, and the pricing catalog work
- **Credit engine:** [`../features/credits.md`](../features/credits.md) — the debit/grant/top-up engine
- **Entitlements code:** `src/lib/entitlements.ts` — the 5-tier capability matrix (code-level source of truth)
- **Billing-tier code:** `src/lib/billing-tier.ts` — Stripe lookup key generation and parsing
- **Monetization moat:** [`moat.md`](./moat.md) §7 — why account-level pooling deepens the moat
- **Decision record:** [`session-decisions.md`](./session-decisions.md) — 2026-06-26 entry for this decision
- **v11 Guiding Star:** [`v11-guiding-star.md`](./v11-guiding-star.md) — the product direction that pricing supports
- **Feature dashboard:** [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) — WM-M17/M19 build status
