# BYO Build + All-in-One Platform: Implementation Plan (all phases)

> _Created: 2026-06-19 · Last updated: 2026-06-19_

> **Status: PLAN (2026-06-19).** ONE document, all phases P1-P5 bifurcated, with work items + tasks + division of work, grounded in the real codebase. Spec: [`../strategy/byo-build-and-cadence-cloud.md`](../strategy/byo-build-and-cadence-cloud.md). Tracked in the SSOT as group **G11 / BYO-\***. (This is the single all-phase implementation plan.)
>
> **Build progress:** **P1a-d ✅ + P2 ✅** (2026-06-26) · **P4 ✅** (managed credits = WM engine) · **P3 ✅ (founder-greenlit 2026-06-29; lane 1; all 6 WIs):** WI1 deploy capture (`deployments` table + `captureDeployments`/`listDeployments` via provider-agnostic `readDeployments`), WI2 changeset→PRD join (`studio_changesets.prd_id` + `studio_changeset_link_prd` self-heal trigger + `getChangesetByPrd`), WI4 in-app changelog (`changelog_entries` + `studio_changeset_to_changelog` trigger + durable `publishChangelogEntry` + `/changelog` route), WI6 outcome-tick (`recordOutcome` pulls merged release notes → learning + changelog feed). **WI3 (attended pinned-chokepoint edit):** the single trust-graduated ship decision — `studio.pr.merge` follows the trust arc via `resolveApprovalMode("confirm", arc)` (observing→review … trusted/ambient→auto) behind the default-off `STUDIO_AUTO_SHIP` flag; the in-tool CI-green + eval-regression gates still block a bad merge; `studio.revert`/`delegate.openhands` stay review-pinned. **WI5 (emergent):** self-correct-on-red-CI works via the `MergeBlocked: …stage a fix, and commit again` error feeding back to the loop (re-stage/re-commit). Gate-green (tsc 0, 1632 tests + 11 ladder tests); build-review 5/5 + loop-security review 5/5, 0 defects. **Only remaining step is founder config: `STUDIO_AUTO_SHIP=1` (like `credits_enabled`).** · **P5 ⬜ founder-gated: ops/cost/security plan produced 2026-07-01** ([`byo-p5-managed-runtime-plan.md`](./byo-p5-managed-runtime-plan.md)); no code yet, awaiting founder review + a directly-owned Cloudflare/Supabase account.
>
> **Gate:** P1 is reuse-heavy and needs no founder input to design, but **no product code is written until the founder greenlights a phase.** Each phase's bite-sized, code-complete TDD tasks are produced at build time (after reading the exact current code) and executed via subagent-driven development, one task at a time with review between. P5 is founder-gated (infra/secrets).
>
> **Sequencing + ownership (2026-06-21):** this whole G11 / BYO-* lane is founder-gated AND sequenced **BEHIND the Decision Brain (H1, TOPMOST 2026-06-20)**; no autonomous cycle picks up any BYO-* row until both the founder greenlights it and the core loop is proven. **`BYO-P4` (managed AI credits) is LOVABLE-OWNED** (it is the WM credit engine, now built by Lovable in parallel; do not pick it up). Per moat.md, never position or price build or host as the differentiator (own only the PM-shaped 80%); host is sequenced strictly after the loop is proven.

**Goal:** Product-level, provider-agnostic, BYO-or-managed repos; a fully autonomous Build to Ship chain that surfaces only outcomes; managed AI credits; and (sequenced last) a managed end-to-end runtime, so a user runs their whole product org on Cadence.

**Architecture:** A provider-agnostic `RepoProvider` interface with per-provider adapters (GitHub first, behavior-preserving); repo binding moved from workspace-level to Product-level; managed/auto-create repos in the user's OWN org; a calm-front Build surface with git behind the Engine Room; deploy capture + the Build-merge to PRD-outcome join; managed AI credits on the existing metering rails; managed runtime last.

**Tech stack:** TanStack Start (React 19), Supabase (RLS migrations), the connector platform (`resolveProviderAuth`, `connection_bindings`), the `studio.*` agent tools + agent loop + trust arc + `agent_approvals`, the AI gateway (`runtime.server.ts`), the existing Ship to Learn loop (`prds.outcome` / `learnings`).

## Global constraints (verbatim from canon)
- DB slugs/identifiers never renamed; migrations are timestamped, idempotent, RLS-aware, additive.
- Humanized output: no em/en dashes in authored or generated content.
- Calm front: name the outcome, not the mechanism; git machinery behind the Engine Room.
- Lock-in is value-based; everything portable (repos in the user's own org).
- Reuse-first: connector registry, `resolveProviderAuth`, agent loop, trust arc, approvals, `studio_changesets`, the Ship to Learn loop.

---

## Phase map (build order; effort S=hours, M=1-2 days, L=multi-day)

| Order | ID | Title | Effort | Depends on | Founder-gated |
| --- | --- | --- | --- | --- | --- |
| 1 | BYO-P1a | RepoProvider interface + GitHub adapter (behavior-preserving) | M | none | no |
| 1 | BYO-P1b | Product-level repo binding + per-Product RLS | M | none (parallel P1a) | no |
| 2 | BYO-P1c | Managed / auto-create repo (user's own org) | M | P1a, P1b | no |
| 3 | BYO-P1d | Calm-front Build surface (git behind Engine Room) | M | P1a, P1b | no |
| 4 | BYO-P2 | Multi-provider: GitLab adapter (Bitbucket demand-gated) | M | P1a | no (secret to go live) |
| 5 | BYO-P3 | Autonomous Build to Ship + deploy capture + changelog + PRD join | L | P1d | no |
| 6 | BYO-P4 | Managed AI credits (allowance + overage on existing rails) | S | metering exists | no (Stripe secrets) |
| 7 | BYO-P5 | Managed end-to-end runtime (DB + auth + hosting) | L | P3 + loop proven; plan: [`byo-p5-managed-runtime-plan.md`](./byo-p5-managed-runtime-plan.md) | YES |

---

## Phase 1 - Foundation (reuse-heavy keystone)

### BYO-P1a - RepoProvider interface + GitHub adapter (behavior-preserving refactor)
The keystone; unblocks P1b/P1c/P1d/P2. No behavior change, proven by parity tests.
- **Files:** create `src/lib/connectors/repo-provider.ts` (interface + `RepoRef` + `repoProviderFor()` factory); create `src/lib/connectors/providers/github-repo.server.ts` (adapter wrapping today's GitHub calls); modify `src/lib/ai/tools/registry.server.ts` (the 5 tools: repo.tree ~1078-1120, repo.read ~1122-1167, repo.search ~1169-1204, studio.commit/pr.open/pr.merge, github.ci.read); `src/lib/ai/studio-ci.ts` (verdict helpers already interface-agnostic, document as shared).
- **Tasks:** define the interface (`readTree, readFile, search, createBranch, commitFiles, openChangeRequest, readChecks, mergeChangeRequest, createRepo, readDeployments?`); extract the GitHub calls into adapter methods + shared `ghHeaders()`/`ghJson()`; make `requireGithub()` return `{ token, repo, provider }`; rewrite the 5 tools to call the interface with identical arg/return signatures; parity test per tool (same I/O before/after).
- **Verification:** parity tests pass; a real changeset commits -> PRs -> merges on the demo workspace; tsc/build/lint green; zero behavior change.

### BYO-P1b - Product-level repo binding + per-Product RLS
- **Files:** migration `supabase/migrations/20260619xxxxxx_p1b_product_binding.sql`; `src/lib/connectors/resolve.server.ts`; `src/routes/_authenticated.sync.tsx`; Settings route; new `src/components/connections/ProductBindingsSection.tsx`.
- **Tasks:** activate the reserved `connection_bindings.product_id` (relax the unique index to allow product-scoped rows; add `idx_connection_bindings_product`); enforce product belongs to workspace; extend `resolveProviderAuth(productId?)` resolution order (workspace+product -> workspace -> user connection -> env); per-Product binding UI (connect existing / create) on `/sync` + Settings; RLS via `is_workspace_member(workspace_id)`.
- **Verification:** a new Product resolves its own repo; two Products in one workspace bind different repos; cross-workspace reads RLS-denied.
- **Risk to honor:** coordinate with the workspace session - this RLS work must NOT widen `agent_memory` access across products.

### BYO-P1c - Managed / auto-create repo in the user's own org
- **Files:** `github-repo.server.ts` (createRepo), `repo-provider.ts`, `ProductBindingsSection.tsx`, `src/lib/connectors.functions.ts`.
- **Tasks:** `createRepo({name, private, org?})` -> `POST /user/repos` or `POST /orgs/{org}/repos` in the user's account; `createRepoAction` server fn returns `{repoRef, binding}`; "Create repo" modal (name defaults to Product name, private toggle, org selector from the user's memberships); hard guard: never a Cadence-owned org.
- **Verification:** the created repo lives in the user's own account/org; the binding resolves; no Cadence-owned repos ever.

### BYO-P1d - Calm-front Build surface (git behind the Engine Room, one trust-graduated decision)
- **Files:** `src/routes/_authenticated.build.$missionId.tsx`; `src/components/studio/{ApprovalCard,ChangesPanel,CiPanel}.tsx` + new `EngineRoomDisclosure.tsx`; `src/lib/studio.functions.ts`; `docs/conventions/engine-room-doctrine.md`.
- **Tasks:** an `EngineRoomDisclosure` (recessed, closed-by-default) holding PR/CI/merge/trace, outcome-named ("Changes", "Quality checks", "What we learned"); Build defaults to Changes + Cost, PR tab moves inside; CiPanel shows one "Quality checks" badge outside, full runs inside; the single product-framed ship decision ("Ready to ship X to <Product>. Go?") via `agent_approvals` (`tool_name='studio.ship.confirm'`) composed with the trust arc (observing=review, trusted=confirm, ambient=silent); ship outcome line ("Shipped X. Live. Early result: ...").
- **Verification:** outcomes by default; git only under the Engine Room; one approval on a new repo, graduating to silent on a trusted agent; humanized copy.

---

## Phase 2 - Multi-provider: GitLab (Bitbucket demand-gated)
GitLab is the launch pair (merge requests + pipelines); each adapter is bounded because everything sits behind the interface.
- **Work items:** `gitlab.server.ts` adapter (PAT/OAuth, instance URL for self-hosted, the full interface: tree/file/search/branch/commit/MR/pipelines/merge with **MR IID not global id**); `resolve.server.ts` GitLab auth (oauth_gateway + instance_url in connection metadata + `GITLAB_TOKEN/REPO/INSTANCE_URL` env fallback); `registry.ts` entry (`gitlab` ProviderId, scopes `api`, capabilities parity); binding UI gains GitLab; `createRepo()` in the user's own namespace (guard against any Cadence group); pipeline-status mapping (`success/failed/running/skipped -> success/failure/pending/neutral`, no-CI -> success); parity + integration tests; webhook signature verification (`X-Gitlab-Token`, groundwork for P3 sync); GitLab setup guide.
- **Verification:** a full commit -> MR -> merge -> pipeline-read cycle works on a GitLab repo; parity with GitHub.
- **Risks:** API version skew on self-hosted (fallback to commit-statuses API); MR IID/ID confusion; gateway must pass custom instance URLs.

## Phase 3 - Autonomous Build to Ship + deploy capture + changelog
Closes the lifecycle-gap-map seams: deploy blind spot, draft-only ship, the disjoint Build-merge vs PRD-outcome paths.
- **WI1 Deploy capture:** new `deployments` table (workspace_id, product_id, changeset_id FK, environment, status, commit_sha, deploy_url, provider, timestamps, triggered_by; RLS workspace-scoped); `readDeployments(ref, sha)` on the interface + GitHub adapter (Deployments API); surface in the outcome view.
- **WI2 Build-merge -> PRD join:** add `studio_changesets.prd_id` (FK, nullable); populate on dispatch; `recordOutcome` pulls the merged changeset's `release_notes` so a merge feeds the existing Ship to Learn loop automatically; `getChangesetByPrd()` helper.
- **WI3 Trust-graduated single decision:** `studio.ship.confirm` tool (no-op gate) seeded in `agent_tools`; the loop queues it once per changeset after CI is green + retries exhausted; mode composed via `resolveApprovalMode()` (observing=review -> ambient=auto-silent); on approve, merge + readDeployments + log to memory.
- **WI4 In-app changelog:** `changelog_entries` table (fed from `release_notes` on merge); `/changelog` route (workspace-scoped, by Product, reverse-chron); link from the outcome surface.
- **WI5 Self-correct continuity:** on red CI, the agent reads the failure, re-stages, re-commits on the same branch, re-reads CI inline; the human sees no CI/retry blur, only the single decision after retries.
- **WI6 Outcome-tick integration:** merge -> shipped -> learning flows end to end.
- **Verification:** an agent runs branch->commit->PR->CI->(self-correct)->one decision->merge->deploy-capture autonomously; the merge stamps the PRD and feeds a learning; the changelog entry appears.

## Phase 4 - Managed AI credits (L1)
Metering already exists (`ai_events.est_cost_usd` + `plan_tier`); Stripe + entitlements rails are built. This is packaging, not a new meter.
- **Work items:** credit-allowance + usage schema (per-tier included allowance, balance); runtime enforcer in `callModel`/the gateway (deduct allowance, 402/overage path) in `runtime.server.ts`; overage pricing + invoice projection; usage UI (real-time balance + invoice + manage credits/top-ups); enterprise-only BYOK (self-serve BYOK is REMOVED per the 2026-06-19 ruling; enterprise-only, and if enabled the runtime's `byoOverride` bypasses metering; see WM-M9 + [`../strategy/moat.md`](../strategy/moat.md) §7); entitlements gate `ai_credits` as a plan feature; (deferred) Stripe overage line items + overage alerts; end-to-end metering tests.
- **Design note:** "one subscription" = generous included allowance + metered fair-use overage (still calm), not literally-unlimited; self-serve BYOK is removed (enterprise-only); self-serve is credits-only.
- **Verification:** AI usage deducts allowance; overage path bills correctly; enterprise BYOK (if enabled) bypasses metering; balances are accurate.

## Phase 5 - Managed end-to-end runtime (L3) [FOUNDER-GATED, sequenced last]
The all-in-one North Star: DB + auth + hosting so a user launches without leaving Cadence. Heaviest, latest; needed its own ops/cost/security plan before any build.
- **Plan produced 2026-07-01:** [`byo-p5-managed-runtime-plan.md`](./byo-p5-managed-runtime-plan.md) answers the five open questions below with concrete recommendations (Cloudflare Workers for Platforms + one pooled Cadence-owned Supabase project; pooled tenant isolation with an RLS-audit gate + automated cross-tenant isolation test; a COGS estimate table; GDPR-now/SOC2-HIPAA-PCI-deferred compliance scope; build a thin native `AppRuntimeProvider` adapter rather than wait on unpriced partner programs), an `AppRuntimeProvider` seam design (mirrors `RepoProvider`/`DelegateProvider`), and a P5a-P5f phased build sequence starting from a founder-only, no-billing technical scaffold. No code written. **Flagged precondition:** Cadence's current Cloudflare/Supabase is Lovable-managed, not a founder-owned billing account, so P5b cannot start until a directly-owned Cloudflare + Supabase account exists for this layer specifically (independent of the separately-deferred `auth-backend-migration-runbook.md`).
- **Work items (high-level):** hosting-provider selection + economics; multi-tenant isolation + security architecture; Database-as-a-Service for user apps; auth/authorization for user apps; API gateway + request routing; app deploy pipeline (CI/CD + runtime handoff); env/secrets management; observability + error handling; cost control + usage metering; compliance + data residency; the deploy-console UI; support + incident playbooks; **portability guarantees (export + self-hosting)** so lock-in stays value-based; integration with the Build to Ship chain.
- **Open questions to resolve before building:** which hosting provider; tenant isolation model; COGS + the one-subscription allowance math at runtime scale; security/compliance scope; build-vs-partner. **All five now have a recommendation in the linked plan; the plan itself, plus the account precondition and the P5b spend trigger, are what remain for founder sign-off.**
- **Verification:** deferred until the phase is greenlit with its own plan (now produced; see above).

---

## Cross-references (parallel sessions)
- **Workspace session (G10 / WM-\*):** Product is the unit (D1); P1b binding rides on it. **Honor the open multi-product `agent_memory` RLS isolation concern - P1b must not widen cross-product memory access; coordinate before merge.** P4 depends on WM-M2 (accounts table).
- **Monetization session (M-C):** pricing rails + `ai_events` metering already exist; P1-P3 change nothing there; P4 is packaging on top. No conflict.

## Risks
- `registry.server.ts` is 2400+ lines and GitHub-coupled; P1a must be surgical + parity-tested.
- Lovable sync can revert `CREATE OR REPLACE` migrations; the TS interface is the durable source.
- RLS coordination with the workspace session (above) before merge.
- P5 is a company-scale bet; do not start without its own ops/cost/security plan.

## The gate + execution model
No product code until the founder greenlights a phase. On greenlight: the phase's bite-sized, code-complete TDD tasks are produced (after reading the exact current code) and executed via subagent-driven development (a fresh subagent per task, review between). Worktree isolation per the git-worktrees discipline.

---
**Related:** [`../strategy/byo-build-and-cadence-cloud.md`](../strategy/byo-build-and-cadence-cloud.md) (spec) · [`../features/lifecycle-gap-map.md`](./lifecycle-gap-map.md) (the deploy/review/ship capture P3 closes) · SSOT group G11 / BYO-\* in [`feature-dashboard.md`](./feature-dashboard.md) + [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md).
