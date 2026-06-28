# Cadence: Moat, Competition & Defensibility (the founder + YC reference)

> _Created: 2026-06-19 · Last updated: 2026-06-25_

> **⭐ Superseded for direction by [v11: The Guiding Star](./v11-guiding-star.md) (2026-06-23).** v11 reconciles the headline thesis (the moat is the **decision-and-outcome layer**: own the loop, sense continuously, keep the receipts; memory is one component, not the headline), and carries the current villain/defense pressure-test, the market/pricing section, and the agentic build plan (now in the [feature dashboard](../planning/feature-dashboard.md) as the ranked v11 build front). This doc remains the detailed moat-stack + competition map + YC objection-Q&A reference.
>
> **What this is.** The standing reference on what our moat is, who our competition is, why we win, and how the moat ripples into pricing, features, and the platform. Written for three uses: (1) the founder's Y Combinator application + interview prep, (2) the founder's day-to-day "what is our moat / who do we compete with" reference, (3) the canon every tool reads before any positioning, pricing, or feature-priority call.
>
> **Status:** LIVING canon. Current positioning (v11, 2026-06-23): **the moat is the decision-and-outcome layer** (own the loop, sense continuously, keep the receipts); **memory is one component**, not the headline. Three pillars verified real in code + live DB.
>
> **Standing rule (do not let this go stale):** this doc is updated on **every** strategic reposition, in the same session, and is never orphaned. A reposition also triggers the **Repositioning Ripple Review** in Section 11 (pricing, features, gating, IA, build-next, tests, canon). Wired into [`README.md`](../../README.md), [`AGENTS.md`](../../AGENTS.md), [`CLAUDE.md`](../../CLAUDE.md), [`GEMINI.md`](../../GEMINI.md), and the cascade rule in [`README.md`](./README.md) (this folder). Reasoning history lives in [`strategic-inputs-log.md`](./strategic-inputs-log.md); decisions in [`session-decisions.md`](./session-decisions.md).
>
> **Documentation bar (standing).** This and every strategy doc is written comprehensive and **thought-process-oriented**, the reasoning and the insights, not just conclusions, so it directly serves founder / YC / accelerator / investor applications and lets any future question be answered by reference without re-deriving. Capture the "why" and the "how we decided," not only the "what."

---

## 1. The one-line thesis

**Cadence is the decision and outcome operating system for product teams: it runs the whole product lifecycle (sense to decide to define to build to ship to learn) as one governed, self-initiating loop, an AI operating system that owns the loop and an action system where the work is done, not an AI feature or a chatbot. Its moat is the decision-and-outcome layer over three pillars: own the loop, sense continuously, and keep the receipts (the auditable, compounding record of what was decided and whether it was right). Vibe-coding tools own one station (the build); Cadence owns the whole loop and orchestrates them under its governance rather than out-building them.**

The PM does not lack a builder. They lack a decision system. Lovable will build you the wrong feature, beautifully, in ten minutes. Cadence stops you from building the wrong thing, and proves which thing was right.

---

## 2. The moat stack (deepest first)

Each layer below is harder to copy than the one above it. Memory is layer 2, not the headline.

1. **The no-fast-oracle asymmetry (why the category exists).** Code has a fast oracle: it compiles or it does not, tests pass or fail, in seconds, at near-zero cost. That tight loop is why AI coding exploded and why it commoditizes. "What to build" has **no** fast oracle: the feedback on a product decision arrives in weeks to quarters, confounded by ten variables, and a wrong call costs a team a quarter. You cannot run a Cursor-style instant loop on judgment. So the decision layer is structurally defensible in a way the build layer is not. We live on the side that does not commoditize.
2. **Outcome-labeled judgment (what "memory" really is).** The defensible asset is not "memory" in the abstract; it is the **closed loop**: decision, then the evidence behind it, then what shipped, then what actually happened, then was the reasoning right. That dataset (a) only exists if you own the whole loop, (b) accrues over calendar time (weeks to quarters per outcome), and (c) cannot be backfilled or bought. A competitor with all your raw data still cannot reconstruct your tuned judgment.
3. **System of record for the product decision (continuous, org-scoped, cross-tool).** Vibe-coding is episodic (build a thing, leave). Cadence is continuous: signal flows in from many tools, the loop ranks and decides and learns, daily. It is org-scoped (the whole product function across products over time), not project-scoped (one app). The switching cost is being the system-of-record-and-action for the org's decisions, the way Salesforce is for sales.
4. **The orchestration position (above and dispatching the builders).** Cadence drives the execution tools (our engine, Lovable, Cursor, Devin, Linear, GitHub) over MCP/A2A. If you are the decision brain that orchestrates every build tool, you are more valuable than any one of them and not threatened by them.
5. **Governance and accountability.** Approval gates, audit trail, "last time we reasoned this way, here is what happened." This makes a PM look like the smartest person in the room and makes autonomy sellable to an enterprise. Vibe-coding has no concept of product-decision governance.

---

## 3. Memory is one layer, not the headline

We say this explicitly because "memory is the moat" sounds copyable. Memory matters because of **what** it remembers (outcome-labeled decisions, layer 2) and because the **system of record** (layer 3) is the only place that loop can close. A competitor cannot "add memory" and catch up, because the value is the accumulated, outcome-labeled judgment over calendar time inside the loop, not a feature flag. Make memory **visible** (the Memory/Brain surface) so the user both feels the stickiness and brags about it, but lead the pitch with the decision layer.

**The engine under the memory layer (2026-06-20, current top build).** Memory becomes defensible in *form*, not just in accumulation, when it is a **typed, bi-temporal decision knowledge graph** (decision → evidence → outcome → supersession) rather than flat vector recall. A graph is what lets the Critic answer "what contradicts this" and "what happened last time," which flat similarity structurally cannot, and it is what makes the accumulated, outcome-labeled judgment literally un-backfillable (a competitor can copy the schema in a day and still not have your history). This is the **Decision Brain**, now the topmost build priority: spec [`../features/decision-brain.md`](../features/decision-brain.md), strategy [`horizon-bets.md`](./horizon-bets.md) (H1).

---

## 4. Competition map (integrate / absorb / race / ignore)

| Posture | Players | Why | Our move |
|---|---|---|---|
| **Different layer, dispatch them** | Lovable, Cursor, Bolt, v0, Replit Agent (vibe-coding) | They own "how to build" (racing to zero, billions invested). We own "what to build / was it right." | Out-scope them (own the whole end-to-end loop), do not out-build them. Deliver the build as a governed station (own engine or dispatched to them); build/host is part of the offering, not the moat. |
| **Integrate and orchestrate** | Linear, Jira, GitHub, Figma, Notion (docs) | They own a workspace or execution surface we cannot dislodge. | Be the decision/memory brain that drives them over MCP/A2A. Sit above; do not fight for the surface. |
| **Absorb as a feature** | ChatPRD, generic AI-PRD writers, prompt-library PM GPTs | Their whole product is one step in our DECIDE/DEFINE station. | Out-feature them by connecting the PRD to the signal that justified it and the outcome that judged it, which they structurally cannot. |
| **Race on the moat** | Productboard (Spark), Atlassian Rovo, Dovetail / Enterpret, Notion AI | The real fight: they have data + distribution we lack. | Our only durable edge is the outcome-memory flywheel + being cross-tool-neutral. Pull interop (MCP/A2A) forward; obsess over the memory loop now. |
| **Ignore / route to** | OpenAI / Anthropic / Google horizontal "PM agents" | A model we route to, not a competitor, iff our value lives in proprietary outcome data + governance + domain depth (none of which a model release contains). | Stay model-agnostic; treat a lab PM agent as an input we orchestrate. |

The existential threat is not the labs. It is that Linear / Notion / Productboard / Atlassian already have the workspace, the data, and the distribution, and "discovery to spec to tickets" is a natural feature extension for them. The two defenses that survive a bundled-feature attack: (a) the outcome-memory data they cannot backfill, and (b) being the neutral brain across tools. Both argue for pulling interop forward and obsessing over the memory loop now.

---

## 5. The PM positioning, and the two-phase question

**The question:** if the platform learns to make the right calls autonomously, why is the PM needed in phase 2?

**The answer (it flips the fear into the strategy):**
- We do not replace the PM's judgment; we delete the grunt work around it and make the judgment compound and become accountable.
- Even at the autonomous limit: the **patterned 80%** of decisions (reversible, precedented, outcome-seen) automate; the **novel 20% + intent + accountability** stay human. Someone must own "we bet the quarter on X" to the board, the customers, the team. A machine cannot be accountable, cannot be fired, cannot hold the relationship.
- As deciding gets cheaper, the org makes **more** decisions, not fewer (more products, more bets, faster cycles). Demand for decisioning expands.
- **The buyer evolves, and our TAM grows with autonomy.** Phase 1: the PM (a force-multiplier, one PM doing the work of a team). Phase 2: the org / founder / exec running the product function on Cadence with fewer humans doing grunt decisioning, and that work runs on us.
- **We win in both futures because we are the substrate either way:** the PM-augmented world needs a force-multiplier; the more-autonomous world still needs a system of record + governance + an intent-setter. We are not betting on PMs staying busy; we are the OS the product function runs on.

This is why **credits-not-seats** monetization is correct: if we charged per-PM-seat we would shrink as PMs are automated; by charging for the decision work (credits) we grow as decisioning automates. The "what happens when the PM isn't needed" fear is the exact scenario the credits model is built to win.

**What we solve, plainly:** product decisioning today is slow, undocumented, headcount-bound, and unaccountable. We make it fast, governed, compounding, and increasingly autonomous, steerable by one human, and we are the system of record and accountability for it.

---

## 6. Why a vibe-coding tool is not our competitor

A user can go to Lovable/Cursor, describe an app, get a preview, tests, a deploy, and a host. So why come to Cadence? Because the hard, expensive, slow part is not building it; it is knowing **which** thing is worth building, defending that call with evidence, and learning whether you were right. Vibe-coding makes the cheap part (building) cheaper. We own the expensive part (deciding). And increasingly, the PM will **use** Lovable/Cursor as the builder, dispatched from Cadence. We are not in their race; we are the layer they run beneath.

---

## 7. Monetization as moat

- **Credits, not seats.** We monetize the decision work, not headcount, so revenue rises as decisioning automates and expands (Section 5).
- **No self-serve BYOK** (founder ruling 2026-06-19). All self-serve usage flows through our credits + capped top-ups, so 100 percent of value is monetized and the UX is one path. Model-agnostic routing (our keys, never locked to one lab) is preserved; only user-supplied keys are retired. BYOK/residency is an enterprise-only negotiated option.
- **We price the decision layer.** The reason-to-pay at every tier is a decision-layer capability (persistent + cross-workspace memory, Critic everywhere, the outcome loop, governance). Build/host is never a value driver or a gate. The cleanest mispricing test: if a tier's headline reason-to-pay is a build/host feature, it is wrong for this positioning.
- **Usage variants are spending options within a plan, not new plans (Anthropic-style, 2026-06-19).** The Max card offers "5x" / "20x more usage than Pro" and Team offers Standard / Premium seats; these select how much usage you run, while the plan's identity stays the decision-layer capability. We sell compounding judgment; the variant is just throughput. This keeps the grid frictionless and the charge on the decision layer, not tokens. Packaging spec: [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) §2.4.1 + WM-M17.
- **Lock-in is gravity, not a wall.** Keep "export anytime." A full export does not carry the tuned judgment, so easy exit raises trust and word of mouth while the brain stays. The lock-in layers (value-based, ranked): compounding decision memory; persistence as a subtle paywall (free decays, paid persists); the record-of-record / audit trail; the system-of-record-and-action (connected sources, tuned brief/voice/guardrails).
- **Account-level pooling, not per-workspace billing (the market-confirmed call).** Billing, credits, and memory pool at the account; workspaces are cost-attribution containers, not separate bills. This is the dominant pattern among products whose value compounds with usage (Anthropic org to workspaces, OpenAI org to projects, Vercel, Bolt, Replit Pro); the per-workspace billers (Linear, Notion) have no per-workspace moat. Per-workspace billing would be a perverse incentive, charging users to weaken our own moat (more workspaces and products are more compounding memory), so they would consolidate and the silos would thin. The credit meter itself stays calm via a legibility layer (approximate per-action ranges, not a raw per-call counter). Evidence + full benchmark: [`strategic-inputs-log.md`](./strategic-inputs-log.md) (2026-06-19); engine spec: [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) §4.2.1.
- Full tier matrix + the account-level model: [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) §2.4, and [`../features/pricing.md`](../features/pricing.md).

---

## 8. Strategic implications across the platform (the ripple, not a one-time patch)

The decision-layer reposition changes more than the workspace layer. These are the standing consequences; re-run them on every reposition (Section 11).

- **Pricing / value metric:** price judgment metered by credits; gate decision-layer value (memory, Critic, outcomes, governance), never build/host; free gets the wedge + limited memory, paid gets the compounding; enterprise can move to outcome-based later.
- **Feature priority + hard-gating:** prioritize the un-commoditizable ends, **SENSE (ingestion), DECIDE (Critic, decision record), LEARN (outcomes, memory)**, as the moat; **deliver BUILD end-to-end as a governed station** (own engine or dispatched), but do not position or price it as the differentiator. Hard-gate decision-layer capabilities, not build features. The build loop picks decision-layer work first.
- **IA / surfaces / messaging:** the hero path is the decision loop (sense -> decide -> learn); build is calm and recessed; messaging is "the decision system," not "the AI builder." (Visual/IA polish stays under the design-last rule, a tracked future pass.)
- **What to test:** that the wedge + Critic + outcome loop + memory are the prominent path, and build is dispatched, not the hero.
- **Adjacent initiatives:** the all-in-one build/host vision (G11, [`byo-build-and-cadence-cloud.md`](./byo-build-and-cadence-cloud.md)) is **part of the end-to-end scope** (run your whole org on Cadence), sequenced after the loop is proven; it is the offering, but the moat stays the decision layer, not the hosting.

---

## 9. Why now

Code got cheap (the build layer commoditized), which moves the bottleneck to the define/decide layer. The orchestration substrate (MCP at scale, A2A, Agent Skills) makes "the brain above the tools" buildable. Outcome-memory is genuinely uncollected data: no incumbent is closing the decision-to-outcome loop today. The window is short (incumbents can extend toward this), which is the argument for pulling interop forward and compounding the memory loop now.

---

## 10. Objection / scenario Q&A (interview prep; append over time)

The founder's three questions and the classic investor objections, with crisp answers. Add new ones as they arise.

- **If the platform learns to decide, why is the PM needed (the two-phase question)?** See Section 5. Short: the 80% patterned automates, the 20% novel + intent + accountability stays human, decision *volume* expands, and we are the substrate in both futures. Credits-not-seats means we grow as PMs automate.
- **Why come to Cadence when Lovable/Cursor build end-to-end?** See Section 6. Building is the cheap part; we own the expensive part (deciding what is worth building and whether it worked), and we dispatch the builders. _The architecture that implements "dispatch the builders" (§6 + §8): the `BuildDriver` seam in [`build-driver-and-dispatch.md`](./build-driver-and-dispatch.md), where the code generator is a swappable adapter (native / Claude Agent SDK / OpenHands / BYO) and the decision, governance, and outcome loop above it never move (board group G13, decided 2026-06-28)._
- **What is the moat beyond memory?** See Section 2. The decision layer: the no-fast-oracle asymmetry + system-of-record + orchestration position + governance. Memory is one layer.
- **If you save 40% of a PM's time, doesn't the company hire fewer PMs, so your TAM shrinks as you succeed?** We sell more product output per PM, not fewer PMs, and we monetize the decision work (credits), which expands as decisioning gets cheaper. The metric that proves it: outcome-accuracy-lift-per-account rising as a single account's memory grows.
- **What stops Lovable/Cursor from adding the decision layer?** It is a different business with no fast oracle, and the moat is outcome-labeled data accrued over calendar time inside a loop they do not run. They are optimized for, and culturally committed to, the build race.
- **What stops Linear/Notion/Productboard from bundling this?** The real threat. Our defenses: the outcome-memory data they cannot backfill, and cross-tool neutrality (we drive all of them; they will not drive each other). Pull MCP/A2A forward to be the neutral brain.
- **Is the memory really defensible, or backfillable?** Not backfillable: it is decision + evidence + outcome + was-it-right, accrued over weeks-to-quarters inside the loop. Raw data dumps do not reconstruct tuned judgment.
- **What is the wedge / the first 10 minutes?** The Critic teardown: point Cadence at a feature you believe in and get an evidence-backed red-team ("why your pet feature is wrong, with receipts"). Emotionally sticky and shareable; needs no full loop.
- **Single-player to team path?** Graduate in place: invite + upgrade turns a solo account into a team/org account with memory preserved; the line is members/seats, not workspace count.
- **Margin / COGS (agentic workflows are token-heavy)?** Credits + capped top-ups + small-model routing + caching; no self-serve BYOK means we must keep margin discipline, which the credits model enforces.
- **Do the foundation labs eat you?** A horizontal PM agent is a model we route to. Our value is proprietary outcome data + governance + domain depth + cross-tool neutrality, none of which a model release contains.
- **Is dual-persona (solo + team) unfocus?** Sequence it (solo first, team next) and lead the story with one; the account model graduates solo to team without a rebuild.

---

## 11. The Repositioning Ripple Review (standing process)

Whenever the positioning or moat shifts, run this checklist in the same session so we never rework blind:

1. **This doc:** update the thesis, the stack, the competition map, and the Q&A.
2. **Pricing / gating:** does the value metric still match the moat? Are the gated capabilities the moat capabilities (not build/host)? Update [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) §2.4 + [`../features/pricing.md`](../features/pricing.md) + `src/lib/entitlements.ts`.
3. **Feature priority:** re-rank the lanes in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) + [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) through the new lens.
4. **IA / messaging:** does the hero path and the copy still reflect the lead? (Mark visual work for the design-last pass.)
5. **What to test:** add/adjust the holistic test (is the moat path the prominent path?).
6. **Canon cascade:** [`README.md`](../../README.md) (thesis + MOAT), [`AGENTS.md`](../../AGENTS.md) §0, [`session-decisions.md`](./session-decisions.md), [`strategic-inputs-log.md`](./strategic-inputs-log.md), and the role map in [`README.md`](./README.md).

---

## 12. Captured insights (the crystallized reasoning)

The load-bearing insights surfaced while working through the strategy, preserved verbatim in spirit so the reasoning is never lost. Each is the kind of crisp framing that answers an investor question directly.

1. **The fast-oracle asymmetry (the deepest one).** Code has a fast oracle: it compiles or it does not, in seconds, at near-zero cost, which is why AI coding exploded and why it commoditizes. "What to build" has no such oracle: feedback arrives in weeks to quarters. When building becomes free, the only scarce thing, and the only thing worth being right about, is the decision. Whoever owns the decision layer sits above whoever owns the build layer and can dispatch the build to any of them. That is the position, not a feature.
2. **Strategy and schema are the same decision (memory scoping).** The entire moat pivots on one line: today decision memory is scoped to the user; scoping it to the workspace/account turns the abstract "compounding memory" pitch into an enforced, per-tenant data fact, and simultaneously becomes the substrate for the paywall (decay vs persist) and the team upgrade (cross-workspace pooling). You cannot separate the positioning from the database here.
3. **Pricing must mirror the moat (the mispricing test).** The cleanest test of whether pricing matches the positioning: if a tier's headline reason-to-pay is a build or host feature, it is mispriced. The reason-to-pay must always be a decision-layer capability (persistent memory, Critic everywhere, the outcome loop, governance). Credits are only the meter; the decision layer is the product.
4. **Credits-not-seats is aligned with the autonomous future.** If we charged per-PM-seat we would shrink as PMs get automated. By charging for the decision work (credits), we grow as decisioning gets cheaper and the org makes more decisions. The "what happens when the PM is not needed" fear is the exact scenario the credits model is built to win.
5. **The billing boundary is a one-time cheap move (the timing argument).** The workspace-vs-account billing disagreement reduces to one schema question: does the billing foreign key point at workspaces or at a new accounts table? Because billing is still dormant (no live secrets; plan_tier set only by a webhook), this is the one cheap moment to move it; after real subscriptions exist, relocating the boundary is a migration nightmare.
6. **Two parallel agent threads coordinate via an interface, not an implementation.** G10 (tenancy) and G11 (build/cloud) avoid collision because they agree on three concrete objects: the accounts table, the entitlements matrix, and the assert/debit credit seam. Each can change its internals freely as long as the interface holds. That is why the division-of-ownership question matters more than it looks: it chooses where the seam sits.
7. **Decoupling the brand name from the slug makes renaming free.** The database, Stripe, and RLS key on stable slugs (`free|pro|max|team|enterprise`); the display name lives only in one function. A tier can be renamed or re-themed any time with a one-file edit and no migration, which matters while the product name itself ("Cadence") is a placeholder. A naming change that is a nightmare in most billing systems is trivial here.
8. **Name the tiers after the product's job.** Naming tiers after what the product does to your knowledge (connects scattered points into a navigable map that gets richer with use) makes the ladder self-explanatory and brand-proof; the motif encodes the ladder, so the visual does the selling, and it survives a product rename.
9. **Isolation was the strong part; the work is lifecycle + lock-in + experience.** The code audit's counterintuitive finding: tenant isolation is already DB-enforced via RLS, so the workspace redesign is mostly a lifecycle, lock-in, and experience problem, not a security rebuild. The highest-leverage technical fix (scoping memory) is also the highest-leverage strategic one.
10. **Two artifacts for two readers (the documentation pattern).** A canonical narrative doc for the human (every input, decision, justification) plus machine-readable rows for the build loop (the tracker), with the rows pointing back to the canon. One source of truth, executable by agents, no drift.
11. **"Without a PM this is nothing" is the positioning, not the weakness.** We are not a build tool a PM uses on the side; we are the PM's judgment-and-accountability system, and the build is the increasingly-commoditized last mile we dispatch. The dependence on a human setting intent and owning the call IS the product, and it is what keeps us defensible and accountable.

12. **Per-workspace billing taxes the moat (the perverse-incentive test).** For a product whose moat is compounding per-tenant memory, charging per workspace/project (Lovable's model) penalizes the exact behavior that deepens the moat, so users consolidate and the silos thin. The market agrees: every value-compounds-with-usage platform (Anthropic, OpenAI, Vercel, Bolt, Replit) pools at the org/account and treats the sub-container as cost attribution; the per-seat-per-workspace billers (Linear, Notion) have no per-workspace moat. Account-level pooling makes "more usage = deeper moat" a property of the schema, not a slogan.
13. **The credit meter can be calm (the legibility layer).** Monetization need not induce meter-anxiety. A credit abstracts blended COGS with the margin living in grant-sizing, and the UI shows approximate per-action ranges ("a PRD draft is about 40 to 120 credits") rather than a raw per-call counter, so the user reads cost without watching a meter drain. Calm-front doctrine applied to billing is itself a trust and retention lever.
14. **Name the entity precisely or the strategy blurs (the vocabulary trap).** "Workspace" means the billing entity in our schema but "the thing you have many of" in Lovable, so "credits across workspaces" reads two opposite ways and briefly sent a parallel session toward the wrong billing structure. The unit of work is the Product; the billing entity is the Account; the Workspace sits between. Getting these words exact is a prerequisite for getting the monetization model right.

## 13. The reasoning in full (the thought process, not just conclusions)

How we reached each position, so this is a reasoning reference, not a list of conclusions.

**From workspace management to the moat.** The session began as a workspace/tenancy redesign. A code audit showed isolation was already DB-enforced (RLS on `workspace_id` across the core tables), so the real gaps were lifecycle (switching, transfer, invites), lock-in (where it lives in the data model), and experience (what a new user sees). The most important fix surfaced fast: decision memory was user-scoped, one level above the boundary we sell, so the moat did not compound per team. Scoping it to the workspace/account is both the security fix and the moat fix (insight 2).

**The moat doubt, resolved from first principles.** The founder challenged "memory is the moat" by observing that Lovable/Cursor build end-to-end from natural language, so a "come, build, launch, leave" tool is just a worse vibe-coding tool. The resolution is the fast-oracle asymmetry (insight 1): building has a fast oracle and commoditizes; deciding-well does not. So we do not compete on building; we own the decision layer and dispatch the build. Memory is one layer (the outcome-labeled judgment) of a deeper stack: no-oracle asymmetry, outcome-labeled judgment, system-of-record, orchestration position, governance (Section 2). The line that resolved it: Lovable builds the wrong thing beautifully; Cadence decides and proves.

**The two-phase question (does the PM become unnecessary?).** If the platform learns to decide, why need the PM in phase 2? The reasoning: the patterned 80% of decisions automate, the novel 20% + intent + accountability stay human; accountability is structurally human (a machine cannot be answerable to a board); cheaper deciding means more decisions, not fewer; and we are the substrate in both the augmented and the autonomous future. This is why credits-not-seats is right (insight 4): we monetize the decision work, which grows as it automates. What we solve, plainly: product decisioning is slow, undocumented, headcount-bound, and unaccountable; we make it fast, governed, compounding, and increasingly autonomous, steerable by one human.

**BYOK removal.** BYOK undercuts monetization (a flat license, no inference margin) and confuses the UX. Decision: remove user-supplied keys from self-serve (enterprise-only, negotiated), while preserving model-agnostic routing across providers with our keys (a constitutional principle and a margin lever). Model-agnostic is not the same as BYOK. This forces margin discipline (credits sized right, small-model routing, caching), which the credits model enforces anyway.

**Pricing, reshaped by the decision-layer lens.** Because the moat is the decision layer, pricing must mirror it (insight 3): price judgment metered by credits; gate decision-layer value, never build/host; free gets the wedge + limited memory; paid gets the compounding; top-ups are capped add-ons (paid-only, per-cycle ceiling), not an unlimited spigot; product counts are modest and secondary (Free 2 / Pro 3 / Max ~5); Pro to Max is a credits decision. Enterprise gets real credit models (seat-pooled / committed pool / postpaid / dedicated) plus the non-credit value (SSO, audit, residency, SLA).

**Tenancy and the billing boundary.** Account > Workspace > Product. Billing, credits, and memory pool at the account, not the workspace, because per-workspace billing taxes the moat (more workspaces = more compounding). The billing-boundary move is a one-time cheap moment while billing is dormant (insight 5). Solo graduates to team in place (members/seats, not workspace count); a personal side-project is a separate signup.

**Coordinating two threads.** A parallel session owns the BYO-repo / Cadence-Cloud plan (G11). Rather than merge or duplicate, the two threads split at an interface (insight 6): G10 owns tenancy + the billing boundary + entitlements + the seam; G11 owns the repo model + managed runtime + the credit packaging. G11 (all-in-one build/host) is **part of the end-to-end scope/vision** (sequenced after the loop is proven); we out-scope vibe-coding (the whole loop) rather than competing on building, and the moat stays the decision layer.

**Naming.** Musical names were rejected (Kimi owns that motif). Constellation names tiers after the product's job (insight 8) and is brand-independent (insight 7), which matters while the product name is a placeholder. The motif (a starfield that gains stars/links/glow per tier) encodes the ladder.

## 14. Related

- Build / tenancy / monetization plan: [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md)
- Monetization canon (one-subscription, COGS): [`byo-build-and-cadence-cloud.md`](./byo-build-and-cadence-cloud.md) §5.5
- Positioning canon: [`v7-agentic-product-os.md`](./v7-agentic-product-os.md)
- Decision lens / wedge / competitor posture: [`v9-decision-wedge-and-build-next.md`](./v9-decision-wedge-and-build-next.md)
- Reasoning history (fundraising source narrative): [`strategic-inputs-log.md`](./strategic-inputs-log.md)
- Decisions: [`session-decisions.md`](./session-decisions.md)
- Product thesis + MOAT summary: [`../../README.md`](../../README.md)
