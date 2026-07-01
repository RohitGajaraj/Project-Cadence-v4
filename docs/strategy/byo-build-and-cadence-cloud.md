# BYO Build + Cadence Cloud: design spec

> _Created: 2026-06-18 · Last updated: 2026-06-19_

> **Status: DESIGN (2026-06-18). No code changed.** Brainstorm output, founder review pending. Decisions made this session are marked LOCKED; the one strategic fork is flagged for the founder. This reshapes how repos attach, how the Build to Ship chain runs, and whether Cadence offers managed infrastructure. Pairs with [`../features/lifecycle-gap-map.md`](../planning/lifecycle-gap-map.md) (the deploy/review/ship capture gaps that feed straight into this).

---

## 0. The reframe (why this is coherent, not scope creep)

Cadence is **product / decision-first** (a PM Chief of Staff), not code-first. Code and Git are the **output of one station (Build)**, not the substance of the product. Two consequences shape everything below:

1. **Cadence is already "local-first."** A non-technical PM creates a Product and does all the Sense -> Decide -> Define work (signals, opportunities, PRDs, decisions, roadmap) with **no repo at all**. Git only matters when the agent ships code. So "connect your repo" is a Build-station concern, never a prerequisite to start.
2. **The posture is managed-by-default + BYO-optional** (this is Lovable's actual model). "Cadence creates a repo for you" is the managed path; "connect your own GitHub/GitLab/Bitbucket" is the BYO path. Same for AI (managed credits vs your own key). We offer the on-ramp without forcing migration, and we never trap the user.

**Positioning ruling (founder, 2026-06-18):** the North Star is the **all-in-one product org platform** - log in and run the whole lifecycle (discovery to launch) on Cadence, one subscription, nothing external to connect or pay for. This is X's soul (the decision OS + memory moat) plus Y's scope (full managed runtime). Resolved in Section 5.5; the hosting is sequenced so it comes after the loop is proven.

---

## 1. Decisions LOCKED this session

| # | Decision | Detail |
|---|---|---|
| D1 | **Unit of work = Product** | A workspace holds many Products. The DB table is named `projects` (legacy); the UI standardizes on **Product**. Label change only, no migration. |
| D2 | **Repo attaches at the Product level, optional until Build** | Each Product can BYO a repo (any provider) or have Cadence create/manage one, attached only when it reaches Build. A Product with no repo is valid (discovery/strategy needs none). |
| D3 | **Autonomy = trust-graduated** | The agent runs the entire Build to Ship chain (branch, commit, PR, CI, self-correct, merge, deploy, release notes) in the backend. On a NEW repo it pauses ONCE at a single product-framed decision ("Ready to ship X to <Product>. Go?"). That pause graduates to silent (ship-then-notify) as trust accrues. Git mechanics are never shown by default; reveal-on-demand for technical users. |
| D4 | **Ship outbound = in-app only for now** | In-app changelog from release notes. Email / social / PR distribution deferred to a later, founder-gated phase. |

---

## 2. The BYO multi-provider repo model

**A provider-agnostic `RepoProvider` interface** is the core new abstraction. Today the Build engine calls GitHub APIs directly; we lift those calls behind an interface so the agent tools never name a provider:

```
interface RepoProvider {
  readTree / readFile / search          // exploration
  createBranch / commitFiles            // write
  openChangeRequest                     // PR (GitHub) / MR (GitLab) / PR (Bitbucket)
  readChecks                            // CI status
  mergeChangeRequest
  readDeployments                       // deploy status (gap-map dependency)
  createRepo                            // managed / auto-create path
}
```

- **Adapters:** GitHub (exists, refactor behind the interface), **GitLab** and **Bitbucket** (new). Adding a provider = one adapter, no Build-engine changes.
- **Attachment options on a Product:** (a) connect an existing repo, any provider (BYO); (b) Cadence creates one (managed) either in the user's own connected account/org, or in a Cadence-owned org (see open decision O4).
- **Two-way sync:** on connect, deep-read the repo; thereafter sync on change (provider webhooks inbound; agent actions outbound). The continuous mirror is a Phase deliverable, not day one.
- **Credential chain unchanged** (`resolveProviderAuth`: workspace/user connection first), plus a **hard guardrail: a real customer can never fall through to the dev/env token**; if unconnected, we prompt to connect, we do not borrow ours. The env token stays a local/demo fallback only.
- **Binding granularity moves from workspace-level to Product-level** using the `connection_bindings.product_id` column that is already reserved for exactly this.

---

## 3. Connector reorganization

- Move commit / PR / CI / merge / deploy out of the GitHub-specific tools and onto the `RepoProvider` interface; the agent tools (`repo.tree`, `studio.commit`, `studio.pr.open`, `github.ci.read`, ...) call the interface.
- Provider registry gains `gitlab` and `bitbucket`. The 8 existing providers (Linear, Notion, GDocs, etc.) are unaffected (they are inflow/outflow only; only the Git providers gain the full build surface).
- UX: Settings -> Connected accounts to authenticate a provider; per-Product repo attach (connect existing or create) replaces the single workspace-level binding on `/sync`.

---

## 4. Autonomous Build to Ship (the calm front)

- The agent performs the whole technical chain autonomously in the backend. **The human never touches git.**
- **The only surfaced moment** is a single product-framed decision on a new repo ("Ready to ship Smart Routing to Mobile App. Go?"), which **graduates to silent** via the existing trust arc (observing -> proving -> trusted -> ambient).
- **Only decisions and outcomes surface** ("Shipped X. Live. Early result: +6% activation."). The PR/CI/merge/deploy machinery lives behind the **Engine Room door**, revealed on demand for the technical founder who wants it.
- Ship publishing: in-app changelog now (D4).
- This is the Engine-Room Doctrine applied end to end; it also closes the human-review concern from the gap-map (the agent reviews; only a decision surfaces).

---

## 5. Cadence Cloud (the managed dimension), decomposed

Three layers, very different scope. Conflating them is the trap.

| Layer | What | Cost / risk | Recommendation |
|---|---|---|---|
| **L1 - Managed AI credits** | Metered AI through our gateway so the user needs no LLM key (vs BYOK). | Low (gateway exists); mostly packaging + metering + billing. | **Do it**, as the default with BYOK optional. Biggest friction-kill for a non-technical user. |
| **L2 - Managed PM data** | The user's products / decisions / PRDs / memory live in our Supabase already. | None (already true). | **Position it**, no build. "Plan everything, migrate nothing" is already real for the PM work. |
| **L3 - Managed runtime for the user's shipped app** | DB + auth + hosting for the app the agent builds (literal Lovable Cloud, and beyond). | Very high: ops, cost, security, compliance, on-call. | **In scope, sequenced late** (founder ruling: the all-in-one North Star). Build after the loop + BYO path is proven. |

A **managed repo** (Cadence creates the repo) sits between L2 and L3 and is already part of the repo model (D2 / auto-create); reasonable to include now.

### Positioning ruling (founder, 2026-06-18): the all-in-one platform

**Resolved: combined X + Y, leaning full-platform.** Cadence keeps X's *soul* (the PM / decision OS and the memory moat as the differentiator) AND takes on Y's scope (host the full lifecycle end to end). The North Star: a user logs in and runs their entire product org on Cadence, discovery -> decisions -> build -> deploy -> launch, on **one subscription**, with nothing external to wire up or pay for separately. L3 (managed runtime) is therefore IN SCOPE, not deferred.

Two guardrails so the ambition stays buildable and honest:
1. **Sequence the hosting.** The end-state is the positioning and the architecture's North Star, but we build in order: the PM loop + BYO/connect path first (mostly built), then the managed runtime as a later, deliberate phase. We do not take on full-PaaS ops before the loop is proven.
2. **Portability stays (lock-in is value, not hostage).** Even hosting everything, the user's code and data remain exportable; the lock-in is the memory moat + the all-in-one convenience, never a trap (Section 5.5). What makes leaving pointless is that the brain does not travel, not that the door is locked.

---

## 5.5 Business, monetization, and implicit lock-in

> Founder directive (2026-06-18): make the lock-in subtle and implicit, never coercive; weigh every decision through a business / monetization / growth / evangelization lens. This section is the standing answer; apply it to all future calls.

**The call: lock in through VALUE, never through hostage.** Coercive lock-in (code you cannot get out, proprietary formats, punitive exit) is explicit, breeds distrust, raises churn, and poisons word-of-mouth. Value lock-in is implicit, compounding, and is itself the evangelization engine. The levers, strongest first:

1. **The compounding memory moat (primary).** Every decision, outcome, learning, and the agent's judgment tuned to THIS product accumulate. After a few months Cadence knows the product like a senior teammate; leaving means losing that brain, not a file. Implicit (felt as "Cadence just gets my product"), irreplaceable, and it does not travel to a competitor even with a full data export. Make it VISIBLE (the Memory surface) so the user both feels the stickiness and brags about it.
2. **Operational dependence on the autonomous loop.** Once the agent runs discovery -> decide -> build -> ship -> learn, leaving means re-taking that cognitive and operational load. Soft, value-based.
3. **Judgment tuned to the user.** The agent learns the user's bar, patterns, and past calls. Exported raw data cannot reconstitute this.
4. **Multiplayer / workspace context.** Shared decisions and context across a team deepen the well and add a social switching cost.

**The deliberate anti-lock-in stance (this is the subtle part):** keep everything PORTABLE. Managed repos live in the USER's own account/org; data is exportable; no proprietary trap. Counterintuitively, easy exit INCREASES trust, adoption, and evangelization, and the moat (memory + tuned judgment) does not leave with the files anyway. "Let them leave easily; they will not want to."

**Monetization aligned to the moat:**
- Cheap/free to start so value (and memory) can accrue; the accrued value is the conversion trigger.
- Paid tiers = the autonomous loop running for you + managed AI credits (L1, usage-based, scales revenue with delivered value) + multiple products + team seats.
- The more a user relies on the loop and the memory, the more they pay AND the more (value-)locked-in they are. Revenue and stickiness rise together, by design, without coercion.

**Evangelization:** the wow is the OUTCOME ("I told it to ship X; it shipped and reported the result"), the VISIBLE memory ("look how much it knows my product"), and the shareable teardowns / decision links (the viral loops already built). Outcomes and felt intelligence travel; mechanics do not.

**Correlation with the live monetization work (parallel sessions, 2026-06-18):** the pricing rails already exist (tiers Free / Pro ~$39 / Team; `plan_tier` + `entitlements.ts` + Stripe webhook + billing UI - built, needs secrets, row M-C-PRICE), and per-event cost metering is already captured (`ai_events.est_cost_usd` + `plan_tier`), so **L1 managed AI credits needs almost no new metering**. The one honest tension the all-in-one one-subscription model introduces is **variable COGS**: we now eat the LLM spend AND the hosting spend per user. "One subscription, nothing extra" is the right felt promise, but margin holds only if each tier carries a **generous included allowance + metered fair-use overage** (still one subscription, still calm), not a literally-unlimited flat fee. This matches the margin watch in v7 §14 and the "ship simple usage pricing now, defer outcome-pricing" call in v9 §6. Net: the all-in-one promise is a packaging + allowance design on top of rails that already exist, not a new billing build.

---

## 6. Drift / reuse plan (what changes, what is reused, what is retired)

**Reused as-is (the foundation is sound):**
- Connector registry + `resolveProviderAuth` + the connections / bindings tables.
- The agent loop, the trust arc, and the approval system (D3 rides directly on these).
- `studio_changesets` / `studio_changes` / `studio_changeset_revisions` / `studio_rollbacks`; missions / mission_steps.
- The Ship -> Learn outcome loop (`prds.outcome` -> `learnings` -> ICE re-score -> memory); strong, leave it; the work is to FEED it (close the gap-map seam).
- The AI gateway (becomes the metering point for L1 managed credits).

**Changed:**
- `connection_bindings` moves to Product-level (use the reserved `product_id`).
- Build-engine tools refactor onto the `RepoProvider` interface (GitHub becomes one adapter).
- Repo binding UX moves from one-per-workspace to per-Product (connect or create).
- The Build surface reframes to calm / outcome-first; git mechanics move behind the Engine Room.
- The "project" UI label becomes "Product."

**Added:**
- `RepoProvider` interface + GitLab + Bitbucket adapters; the managed/auto-create repo path.
- Per-Product repo attach UX; the two-way sync mirror.
- Deploy capture (the `deployments` model from the gap-map) on the interface.
- L1 managed-AI-credits packaging + metering; the in-app changelog.

**Retired / reframed:**
- The workspace-level single-repo assumption.
- The git-mechanics-forward Build UI (becomes reveal-on-demand).

---

## 7. Proposed phasing (sequence after founder review)

- **P0 - Positioning + cheap wins:** founder picks fork X vs Y; standardize the "Product" label; position L2.
- **P1 - Foundation (reuse-heavy):** Product-level repo binding; the `RepoProvider` interface (GitHub behind it); managed/auto-create repo; the calm-front Build surface.
- **P2 - Multi-provider:** GitLab adapter on the interface (launch pair with GitHub). Bitbucket is demand-gated (built on first real customer signal; the interface makes it a small add).
- **P3 - Autonomy + capture:** trust-graduated single-pause Build to Ship; in-app changelog; deploy capture + the Build-merge to PRD-outcome join (from the gap-map).
- **P4 - Managed convenience:** L1 managed AI credits (metering already exists; mostly packaging + the included-allowance design).
- **P5 - Managed end-to-end runtime (L3):** DB + auth + hosting so the user launches without leaving Cadence. The final, deliberate phase per the all-in-one ruling; gated on the loop + BYO path being proven and on an ops/cost/security plan of its own.

---

## 8. Open decisions for the founder

1. **The positioning fork: RESOLVED -> all-in-one platform** (X's soul + Y's scope, sequenced; Section 5.5). Remaining open calls: the pricing/allowance shape (the COGS tension above) and provider order.
2. **Managed AI credits (L1): offer as the default, with BYOK optional?** (Recommended: yes.)
3. **First provider after GitHub: RESOLVED -> GitLab (launch pair with GitHub); Bitbucket demand-gated.** Rationale: the `RepoProvider` interface is the real investment; each adapter after is bounded. BYO repos cost us no hosting (they live in the user's account). GitLab is the clear #2 (market + self-hosted/enterprise), so it ships at launch; Bitbucket (Atlassian/Jira shops, lower demand) is a small later adapter built on first real customer signal, keeping the support/maintenance surface lean.
4. **Managed repo location: RESOLVED -> the user's own account/org** (portable). Per Section 5.5, lock-in is value-based (the memory moat), not hostage-based; a Cadence-owned org is rejected as coercive. (Re-open only if the founder picks fork Y and a managed runtime forces it.)

---

## Related
- [`../planning/byo-p5-managed-runtime-plan.md`](../planning/byo-p5-managed-runtime-plan.md) - the P5 ops/cost/security plan this doc's Section 7 (Phase 5) said was needed before any build; produced 2026-07-01, answers the five open questions in Section 8 of this doc that pertain to hosting.
- [`build-driver-and-dispatch.md`](./build-driver-and-dispatch.md) - **the code-gen-side twin of this doc.** This doc specced `RepoProvider` (WHERE code lives); that doc specs `BuildDriver` (WHO writes it), so the native loop becomes one adapter and external engines plug in behind one seam. Read both together for the full build picture. (board group G13, founder-gated; decided 2026-06-28).
- [`../features/lifecycle-gap-map.md`](../planning/lifecycle-gap-map.md) - the Build/Deploy/Review/Ship capture gaps this builds on.
- [`README.md`](./README.md) - strategy doc role map (link this in when committed).
- Engine-Room Doctrine ([`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md)) - the calm-front law D3/Section 4 implement.
- [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) - operationalizes Section 5.5 (account-level billing, managed-credits-default with BYOK optional, memory-persistence as the charge) into the Account > Workspace > Product tenancy + the WM-* build items.
