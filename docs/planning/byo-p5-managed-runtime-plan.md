# BYO-P5: Managed End-to-End Runtime (Ops, Cost, and Security Plan)

Status: PLAN, founder-gated, produced 2026-07-01. No code written.

## 0. Why this doc exists

BYO-P1 through P4 shipped a provider-agnostic `RepoProvider` seam, autonomous build-to-ship, and managed AI credits. P5, the managed end-to-end runtime (Cadence hosts the DB, auth, and deploy for an app it built, no user GitHub/Supabase/hosting account required), was explicitly held back as "a company-scale bet" needing its own ops/cost/security plan before any code got written. This is that plan. It takes the five open questions the founder named (hosting provider + economics, tenant isolation model, COGS/allowance math, security/compliance scope, build-vs-partner) and closes each to a concrete, defensible recommendation, so what's left for the founder is a small set of named decisions rather than an open design space. It does not re-litigate anything already decided in P1-P4 or in moat.md.

## 1. The five open questions

### 1.1 Hosting provider selection + economics

**Recommendation:** Cloudflare Workers for Platforms (WfP) for compute/edge hosting of the generated app, paired with one Cadence-owned Supabase project (not one project per hosted app) for the shared DB/auth layer described in 1.2.

**Rationale:** Cadence already deploys to Cloudflare Workers via TanStack Start, so WfP is same-vendor and self-serve (a $25/mo add-on on top of the mandatory $5/mo Workers Paid plan, a $30/mo floor, not Enterprise-gated), and Cloudflare ships a reference implementation (VibeSDK, the "AI Vibe Coding Platform") built on WfP for exactly this use case: deploying AI-generated projects at scale. The apps Cadence generates are stateless SPA/SSR + API routes, the same shape Cadence itself runs, so WfP's request-scoped V8 isolate model fits without a rewrite of the build target.

**Still the founder's call:** whether to add Cloudflare Containers (a heavier, separate product) for the minority of generated apps that need a genuine persistent process or long-running background job, since WfP's own docs confirm Workflows cannot run inside a WfP dispatch namespace. Defer that until a real generated app actually needs it, don't build it speculatively.

**Operational precondition, not yet true today:** Cadence's current Cloudflare Workers + Supabase deployment is Lovable-managed (`docs/operations/procurement-inventory.md` line 17), not a founder-owned account with billing control. Neither Workers Paid nor the WfP add-on nor a new dedicated Supabase project can be purchased against that account. This does not require executing the full `docs/operations/auth-backend-migration-runbook.md` migration (which is about moving Cadence's OWN product database off Lovable, still correctly deferred, unrelated to P5). It requires a smaller, independent move: open a directly-owned Cloudflare account and a directly-owned Supabase account, scoped only to the P5 hosted-app layer, before P5b can start. This is a P5a-adjacent prerequisite, effort S, and the first thing to confirm before any of the below becomes actionable.

### 1.2 Tenant isolation model

**Recommendation:** pool, not silo, but only with three technical controls in place before it ever touches real data: (1) hosted apps receive an anon key bound to that tenant's RLS policies only, never a service-role key, injected via the credential path in Section 2, (2) a mandatory RLS-audit gate blocks any deploy where a generated app's artifact embeds a service-role key or targets a table without RLS enabled, and (3) an automated cross-tenant isolation test (attempt a read across tenant boundaries with tenant A's credentials, assert zero rows) runs before an app first receives production traffic and on a recurring schedule after. Shared schema, `tenant_id`/`hosted_app_id` scoping, Postgres RLS, enforced through a small number of narrow data-access paths. Do not provision a dedicated Supabase project per hosted app, and never let hosted-app data live inside the same Supabase project as Cadence's own product/billing/workspace tables: this must be a new, separate, Cadence-owned Supabase project, provisioned specifically for hosted-app tenancy.

**Rationale:** AWS's SaaS Lens names pool as the default posture for early-stage, low-trust-sensitivity tenants where cost-per-tenant has to trend toward zero, which fits this product's early cohort on cost. But the analogy only goes so far: AWS's guidance assumes a tenant only ever touches an application layer Cadence itself writes and reviews. A hosted app is arbitrary AI-generated backend code holding direct DB credentials, serving that tenant's own external end users, not Cadence's. That is a materially different trust boundary, and the failure mode is specific and known: AI-generated Supabase apps commonly embed a service-role key instead of an anon key, or ship a table with RLS left off, and either mistake in one hosted app breaks isolation for every tenant in the pool at once, not just for that tenant. The three controls above exist to close exactly that gap; pool-without-them is not the recommendation. With them in place, the model costs nothing new to build beyond the controls themselves: the `AppRuntimeProvider` scopes every deployed-app row by `workspace_id` the same way every other Cadence table already does. This deliberately diverges from Lovable's and Replit's default (a dedicated Supabase project or dedicated GCP project per app): those are silo-model, and at Supabase's public $25/mo-per-project Pro-tier floor (the free tier pauses after a week of inactivity and cannot reliably host paying customers' data, and there is no viable standalone $10 production tier), with no bulk discount outside its unpriced partner program, silo-by-default is not economical for Cadence pre-scale: 100 hosted apps at $25/mo each is $2,500/mo in DB hosting alone, against roughly $25-40/mo for the pooled model at the same scale (Section 3). Graduation triggers (noisy neighbor, a tenant's compliance ask, data volume outgrowing the shared instance) move a specific tenant to its own schema or project later; isolation is a per-tenant dial, not a one-time system-wide choice. A documented cross-tenant leak is a different category from these judgment-call triggers: it is a hard, non-negotiable graduation-plus-incident-response trigger, not a threshold to weigh.

Customer-initiated exit is a separate case from Cadence-initiated graduation and needs its own path even though there is no per-tenant Supabase project to hand off wholesale. `AppRuntimeProvider.exportTenantData` (Section 2) produces a `tenant_id`-scoped export of that tenant's rows only, running under the same RLS-bound credential class every hosted app already runs under (so the export mechanism cannot leak another tenant's rows even by construction), plus a pointer to the code artifact, which already lives in Cadence's build/version system independent of any hosting decision. This must exist before GA (P5e, Section 5), not deferred to P5f: it is what makes the no-hostage claim in Section 7 actually true under a pooled model.

**Still the founder's call:** the actual thresholds that fire a judgment-call graduation (how much CPU/IO contention, what compliance ask, what data volume) are a judgment call once there is real usage data, not something this plan can set in advance. The three technical controls above are not optional and are not this kind of judgment call.

### 1.3 COGS and the generous-allowance-plus-overage math at runtime scale

**Recommendation:** extend the same design principle already set for AI credits (L1): a generous included allowance bundled into the subscription, metered fair-use overage beyond it. But treat this explicitly as a second, compounding COGS line, not a free extension of the existing one, and treat per-tenant usage attribution as a required build item, not an assumption.

**Rationale:** the Workers Paid plan ($5/mo) includes 10M requests/mo and 30M CPU-ms/mo, and the WfP add-on ($25/mo, $30/mo floor combined) includes 1,000 scripts. At the modest-traffic assumption used in Section 3 (roughly 500 requests/app/mo, roughly 5ms CPU/request), that comfortably absorbs hundreds of typical hosted apps on the request/CPU axis before any overage bills; the binding constraint at scale is the 1,000-script cap, not requests or CPU. The DB side is flatter still under the pooled model in 1.2, since it's one project's cost, not N. See the cost table in Section 3. For the fair-use principle to actually hold, rather than becoming blended COGS drag on every tenant regardless of who caused it, overage has to be attributable back to the tenant that caused it: each hosted app's named script slot in the WfP dispatch namespace already gives Cloudflare-side per-tenant metering for free, since dispatch namespace analytics report request count and CPU-ms per script, so that side needs no new infrastructure. The DB side does not have this for free and needs an explicit `tenant_id`-tagged usage rollup (query counts, IO, storage per tenant, sampled via `pg_stat_statements` or Supabase's log drains), which is a named P5c build item (Section 5), not something this plan can assume into existence.

**Still the founder's call:** the actual overage price points, and where the "generous" line sits, is a pricing/packaging decision that belongs to the monetization plan (G10), not this ops plan. This plan estimates COGS; it does not set price. GA pricing copy should keep hosting allowance framed as an outcome/commodity line, not presented as a feature-parity peer of the AI-credit/decision-layer allowance in the same breath: that framing is what actually protects the "hosting is commodity, only decision and memory are the moat" position at the point of sale (Section 7).

### 1.4 Security/compliance scope

**Recommendation:** ship the day-one minimal checklist only: encryption verified on by default, the RLS-audit gate and cross-tenant isolation test from 1.2 running and blocking on failure, DPA template published, sub-processor disclosure extended, a one-page incident response plan, basic access logging, and hosted-app secrets handled through the vault pattern in Section 4. Explicitly defer SOC 2, HIPAA, and PCI.

**Rationale:** GDPR applies from day one with no size exemption if any hosted app has an EU end user, so the minimal checklist is not optional. SOC 2 has no proactive trigger worth pursuing pre-revenue: the correct move, per research, is to start a Type 1 the moment a real enterprise deal is blocked on it, not before. PCI and HIPAA are avoided structurally (Stripe-only card handling, no PHI ingestion) rather than solved.

**Still the founder's call:** when the first enterprise prospect actually asks for SOC 2, whether to start the Type 1 immediately is a live decision at that time, informed by which deal is on the table, not a decision this plan can pre-make.

### 1.5 Build vs. partner

**Recommendation:** build a thin native `AppRuntimeProvider` adapter on top of the two commodity, publicly-priced APIs already chosen (Cloudflare's API for WfP, Supabase's Management API for the one pooled project). Do not wait on or design around Supabase's "Supabase for Platforms" program or Neon's "Agent Plan": both are apply-only and their pricing is unverifiable from public docs.

**Rationale:** this is the same seam discipline already applied to `RepoProvider`, `DelegateProvider`, and the proposed `BuildDriver`: scaffold the interface and a native floor adapter first, keep the provider swappable, never bet the whole layer on an unpriced partner program. Once the pool model in 1.2 actually hits a graduation trigger that demands silo economics, that is the point at which Supabase for Platforms' Pico tier or Neon's Agent Plan becomes worth applying for, and by then there is real usage data to negotiate with.

**Still the founder's call:** whether to open a Supabase for Platforms and/or Neon Agent Plan application now, in parallel, purely to get real quoted numbers ahead of any graduation need. This costs time, not money, and de-risks the eventual P5f phase in Section 5.

## 2. Recommended architecture: the `AppRuntimeProvider` seam

Same seam discipline as `RepoProvider` (`src/lib/connectors/repo-provider.ts`) and the dormant-floor-adapter discipline of `DelegateProvider` (`src/lib/delegate/provider.ts`): a pure `.ts` contract file, a native adapter behind a `.server.ts` file that reads credentials, a factory that resolves by `providerId`, and a `RESERVED_...IDS` array naming future adapters before they're wired so nothing silently fans out to a misconfigured provider.

```ts
export interface AppRuntimeProvider {
  readonly providerId: "cloudflare-wfp"; // RESERVED_APP_RUNTIME_PROVIDER_IDS reserves "neon-silo", "supabase-for-platforms" before they are wired
  provisionApp(ref: AppRuntimeRef, spec: AppRuntimeSpec): Promise<AppRuntimeHandle>;
  deploy(handle: AppRuntimeHandle, artifact: BuildArtifact, env: Record<string, string>): Promise<DeploymentResult>;
  readDeployments(handle: AppRuntimeHandle): Promise<DeploymentEntry[]>;
  readHealth(handle: AppRuntimeHandle): Promise<HealthStatus>;
  readLogs(handle: AppRuntimeHandle, opts?: LogQuery): Promise<LogEntry[]>;
  readEnvVars(handle: AppRuntimeHandle): Promise<Record<string, string>>;
  setEnvVar(handle: AppRuntimeHandle, key: string, value: string): Promise<void>;
  rollback(handle: AppRuntimeHandle, toDeploymentId: string): Promise<DeploymentResult>;
  exportTenantData(handle: AppRuntimeHandle): Promise<TenantExportArtifact>;
  teardown(handle: AppRuntimeHandle): Promise<void>;
}

export function appRuntimeProviderFor(
  providerId: AppRuntimeProvider["providerId"],
  credentials: AppRuntimeCredentials,
): AppRuntimeProvider { /* native cloudflare-wfp adapter only, at first */ }
```

Notes on the design:

- `provisionApp` does not create a new database or a new Supabase project under the recommended pooled model (1.2). It registers a new tenant row (`workspace_id`, `product_id`, `hosted_app_id`) against the single shared, Cadence-owned Supabase project (a project distinct from Cadence's own product/billing/workspace database, never the same project), and creates a named script slot in the Cloudflare WfP dispatch namespace. A future silo adapter (`neon-silo`) would instead provision a real dedicated Neon project per call.
- `provisionApp` issues that tenant's hosted app an anon key bound to its own RLS policies only, injected via `setEnvVar`. The Supabase service-role key never leaves Cadence's server-side vault and is never issued to a hosted app, regardless of what the generated code asks for. This is the single control that keeps one tenant's bug from becoming every tenant's breach; see the RLS-audit gate and isolation test in Section 4.
- `readEnvVars` returns the tenant's own application env vars, redacted by default in the Engine Room UI; an explicit reveal is an audit-logged action. It never returns Cadence's own Cloudflare/Supabase Management API credentials, which are scoped to a build-time service role and held in the same AES-256-GCM vault used for connector credentials elsewhere in the codebase, not exposed to any per-tenant code path.
- `exportTenantData` produces a `tenant_id`-scoped export (a dump restricted to that tenant's own rows, run under the same RLS-bound credential class every hosted app runs under, so it cannot leak another tenant's data even by construction) plus a pointer to the code artifact already tracked in Cadence's build/version system. This exists specifically to back the portability guarantee in Section 7 under a pooled model that has no per-tenant project to hand off wholesale; it is distinct from `teardown` (delete) and is a required P5c/P5e item, not optional polish.
- `AppRuntimeSpec` should carry a `dedicatedDb: boolean` flag defaulted to `false`, the switch a future graduation (1.2) flips per tenant, not a system-wide config.
- `deploy` / `rollback` follow the same two-control-point pattern proposed for `BuildDriver`: spec out (the deploy manifest and env config), gate in (a health-check pass before the dispatch route cuts traffic to the new script version), plus the RLS-audit gate from Section 4 for any deploy touching the DB layer. No traffic cutover without a passing health check, and on first deploy, a passing isolation test.
- Each hosted app's named script slot in the WfP dispatch namespace gives Cloudflare-side per-tenant usage metering for free (dispatch namespace analytics report request count and CPU-ms per script); this is what feeds the "noisy neighbor" graduation trigger (1.2) and any future per-tenant overage billing (Section 3). The DB side has no equivalent for free and needs an explicit `tenant_id`-tagged usage rollup, a named P5c build item (Section 3, Section 5).
- A `nullAppRuntimeProvider` (mirroring `nullDelegateProvider`) ships alongside the native adapter from day one, always `available: false`, so any misconfiguration fails closed rather than silently routing to a live provider.
- Per the Engine-Room Doctrine, none of this surfaces as raw infrastructure. The user sees a "Cadence-hosted" toggle and an outcome ("live at your-app.cadence.app"), not a dispatch namespace, a script name, or a Supabase project ref. Machinery (logs, env vars, rollback, export) lives behind one reveal-on-demand Engine Room panel.

## 3. Cost model

Estimates only, built from the researched unit prices, not an official quote from either vendor. Assumes the pooled model (1.2: one shared Cloudflare WfP namespace and one shared Supabase project across all hosted apps) and the same modest-traffic assumption used in the WfP research (roughly 500 requests/app/mo, roughly 5ms CPU/request).

| Hosted apps | Cloudflare (Workers Paid + WfP) | Supabase (shared DB + auth) | Est. total COGS/mo | Est. COGS per app/mo |
|---|---|---|---|---|
| 10 | $30 ($5 Workers Paid + $25 WfP, flat, well inside the 10M req/30M CPU-ms included caps) | $25 (flat, Pro tier, the only viable production floor, bundles a $10 compute credit) | $55 | $5.50 |
| 100 | $30 (flat, still inside the 1,000-script cap and the 10M req/30M CPU-ms caps at this traffic assumption) | $25-40 (Pro tier flat, possibly a compute-tier step-up as aggregate storage/connections grow) | $55-70 | $0.55-0.70 |
| 1,000 | $30 at the recommended traffic assumption, but at the edge of the 1,000-script cap; every script beyond it adds $0.02/mo | $25-75+ (a compute-tier bump is likely as aggregate storage/connections grow across all tenants) | $55-105+ | $0.055-0.105 |

What this excludes, and is not yet priced: per-tenant custom domains (Cloudflare for SaaS is a separate paid product; per-tenant cost is unverified in the research), R2/object storage for hosted apps that need file uploads, Supabase database egress bandwidth (billed separately from both Cloudflare requests and R2, and not yet estimated here), any traffic materially heavier than the 500-req/app/mo assumption (WfP overage is $0.30/extra million requests, $0.02/extra million CPU-ms), Stripe fees on whatever portion of subscription revenue this hosting tier is attributed to, idle or abandoned tenants still consuming a script slot and DB rows against the shared account's caps (nothing in this plan yet reclaims a dormant hosted app's slot), the support/incident-response burden of operating hosted infrastructure for a tenant's own end users (a materially different support surface than Cadence's own app), and the engineering/ops cost of building and running P5 itself, which Section 5 sizes only as S/M/L effort and does not dollarize into COGS.

**The same tension flagged for L1 AI credits applies here, and it compounds.** A "generous allowance, metered overage" pool now exists on two independent COGS lines (AI usage and hosted-app runtime) inside what may be a single subscription price. If hosted-app usage per customer scales faster than seat/subscription growth, the two allowances erode margin independently and at different rates. For overage to actually be attributable to the tenant that caused it, rather than becoming blended drag on every tenant (the "noisy neighbor" case named in 1.2), the per-tenant usage rollup named in Section 2 has to exist; it is a P5c build item, not an assumption this plan can leave implicit. This plan surfaces the COGS shape; it does not resolve whether hosting draws from the same allowance pool as AI credits or a separate one, that is a monetization decision for Section 1.3's founder call.

## 4. Security and compliance posture

**In scope now:**

- Encryption at rest and in transit: default-on for both Supabase and Cloudflare, verify it is actually on, do not build custom crypto.
- RLS-audit gate and automated cross-tenant isolation test (Section 1.2): before any tenant's app receives production traffic, and on a recurring schedule after, an automated check confirms no service-role Supabase key is present in the deployed artifact's env vars (only the tenant-scoped anon key), every table the generated app touches has RLS enabled, and a synthetic cross-tenant read attempt (tenant A's credentials against tenant B's rows) returns zero rows. A failure blocks deploy or promotion and pages on-call. This is the technical control that makes the pooled model's isolation claim actually true, not a policy authored in good faith.
- Hosted-app secrets and credentials: env vars encrypted via the same AES-256-GCM, service-role-only vault already used for connector credentials elsewhere in the codebase. The Engine Room UI redacts secret values by default; an explicit reveal is an audit-logged action, not a plain `readEnvVars` dump. Cadence's own Cloudflare and Supabase Management API credentials, the single credential capable of provisioning or reading every tenant, live in that same vault, scoped to a build-time service role never exposed to any per-tenant code path or the Engine Room UI, and rotate on the same schedule as other vaulted connector credentials.
- Sub-processor disclosure: `SUBPROC-DISCLOSURE` (`docs/features/subprocessor-disclosure.md`) is already live at `/subprocessors` and derives its list from the actual infra/model-provider catalog. Extend that catalog to include Cloudflare WfP and the dedicated Supabase project as soon as either is provisioned, so the disclosure never drifts from what's actually running.
- A published Data Processing Agreement template, linkable from the trust page. Every customer whose app Cadence hosts is a controller under GDPR; Cadence is their processor. The DPA's representation of "appropriate technical measures" under GDPR Art. 28 is only true once the RLS-audit gate and isolation test above are actually live, so publish the DPA at P5c completion (Section 5), not as day-one boilerplate ahead of them. Once those controls are live, the DPA itself is boilerplate legal text, not custom work per customer.
- A one-page incident response plan: who's on-call, who gets notified, and the GDPR 72-hour breach-notification clock. A confirmed cross-tenant isolation failure is a named incident-response trigger, not just a graduation trigger (Section 1.2).
- Basic access logging/audit trail for who touched hosted-app data, extending the existing `U6-AUDIT` mechanism rather than building a parallel one.

**Explicitly deferred, not solved:**

- SOC 2 (Type 1 or Type 2). Do not start until a real enterprise deal is blocked on it. When that happens, per the research, start a Type 1 immediately (fast, cheap, unblocks the deal) and roll into the Type 2 observation window from there.
- HIPAA. Never build toward this unless healthcare is deliberately chosen as a market. If a hosted app happens to process PHI, that is the customer's compliance burden as controller, not Cadence's as infra provider, and the ToS should say so explicitly.
- PCI beyond SAQ A. Never let raw card data touch Cadence's servers or a hosted app's Cadence-managed backend. Route all payment capture in hosted apps through Stripe Elements/Checkout/hosted fields, the same posture Cadence already uses for its own billing.
- Pen tests, ISO 27001, dedicated security headcount, formal DPIAs. All premature before the first enterprise ask.

## 5. Phased build sequence

| Phase | Scope | Effort | Founder-gated |
|---|---|---|---|
| P5a | Scaffold the `AppRuntimeProvider` interface, the `nullAppRuntimeProvider` dormant floor, and `RESERVED_APP_RUNTIME_PROVIDER_IDS`. No live infra provisioned, no paid account, no cost. | S | Covered by sign-off on this plan; no separate gate. |
| P5b | Smallest viable technical slice: a founder-only "Cadence-hosted" toggle on a Product that provisions a real but minimal deploy, a single script pushed to a live Cloudflare WfP dispatch namespace serving a static/SSR shell. No DB wiring, no billing, not user-facing. Requires purchasing Workers Paid ($5/mo) plus the WfP add-on ($25/mo), a $30/mo floor. | S | Yes: first real recurring paid-infra commitment and first live dispatch namespace. |
| P5c | Provision the one dedicated, Cadence-owned Supabase project (distinct from Cadence's own product/billing/workspace database) for the pooled DB/auth layer (1.2), at the $25/mo Pro-tier floor. Wire RLS/`tenant_id` scoping, the anon-key-only credential path (never issue the service-role key to a hosted app), the RLS-audit gate and automated cross-tenant isolation test (Section 4), the per-tenant DB usage rollup (Section 2, Section 3), `exportTenantData`, and env-var/secret injection into the deployed Worker via `setEnvVar` through the AES-256-GCM vault. Still founder-only toggle. | L | Yes: second recurring paid-infra commitment, the first time hosted-app data lives outside Cadence's own product tables, and the phase that makes the pooled model's isolation claim technically true rather than asserted. |
| P5d | Deploy manifest + health-check/rollback gate (the spec-out/gate-in pattern from Section 2). Logs/status/env-var/export surface behind one Engine Room panel (calm front, reveal-on-demand, per `engine-room-doctrine.md`). Expand to a small, founder-selected external beta. | M | Yes: first external users' apps hosted on Cadence-managed infra. |
| P5e | Compliance and billing layer: DPA template published (gated on P5c's isolation controls being live), sub-processor disclosure updated, incident response one-pager, access logging extended, custom-domain support (Cloudflare for SaaS), overage metering wired into the existing credits/billing system using the per-tenant attribution built in P5c, `exportTenantData` exposed to users as a self-serve export/leave path. General availability toggle. | L | Yes: GA launch, revenue-bearing and compliance-facing. |
| P5f (not scheduled) | Per-tenant graduation to silo (Neon Agent Plan or Supabase for Platforms) for any hosted app that trips an isolation graduation trigger from 1.2. Not on the current roadmap; pursue only when a real trigger fires. | L | Yes, whenever it is proposed. |

## 6. Risks and what still needs founder sign-off

1. P5b and P5c commit Cadence to new recurring paid infra ($30/mo Cloudflare: $5 Workers Paid plus $25 WfP, plus $25/mo Supabase Pro minimum, a roughly $55/mo floor) before any hosted-app revenue exists. Founder must approve the spend trigger, not just the plan.
2. The pooled isolation model (1.2) intentionally diverges from Lovable's and Replit's dedicated-per-app-DB precedent, and depends on the RLS-audit gate and isolation test (Section 1.2, Section 4) actually running as designed, not just on the AWS SaaS Lens analogy. The concrete failure mode is a hosted app embedding a service-role key or shipping a table without RLS: either mistake in one tenant's AI-generated code breaks isolation for the whole pool at once. Founder must confirm this cost/isolation tradeoff is acceptable given that mitigation, and confirm what the ToS says about liability if a pooled-model bug ever leaks one hosted app's end-user data into another's despite the gate.
3. WfP's isolation is a V8-isolate/logical boundary; Cloudflare's own docs do not claim mitigation of the generic Spectre-class shared-CPU side-channel risk that comes with any multi-tenant isolate host. This is an accepted-risk item, not a solved one, and the founder should be aware of it before real end-user data is hosted.
4. Custom-domain cost (Cloudflare for SaaS) is unpriced per tenant in the research. This could materially change the unit economics in Section 3 at scale and needs a real quote before P5e/GA.
5. Whether hosted-app COGS draws from the same subscription allowance as AI credits, or a separate metered line, is unresolved (Section 3). This is a monetization decision that intersects directly with the G10 workspace/tenancy/monetization plan and needs a founder call before GA pricing is set.
6. Deferring SOC 2/HIPAA (Section 4) means Cadence cannot yet promise dedicated-tenant or compliance guarantees to a hosted app's own end users who may demand them. Founder should confirm this is acceptable for the intended launch ICP.
7. Supabase for Platforms and Neon's Agent Plan are both apply-only with unpublished pricing. If the pooled model ever needs to graduate to silo (P5f), real negotiated pricing is unknown until an application is submitted. Founder should decide whether to open that application now, in parallel, even though P5f is not scheduled.
8. The anon-key-only credential path (Section 2) closes the most common AI-generated-app isolation failure, but it depends on the build pipeline actually enforcing it end to end, never handing a service-role key to generated code and never letting a user paste one into a hosted app's env vars via `setEnvVar`. Founder sign-off should include confirming this is a hard invariant in the build/deploy pipeline, not just a documented convention.
9. Neither Cloudflare nor Supabase for the P5 hosted-app layer can be purchased on Cadence's existing Lovable-managed accounts (Section 1.1). Opening founder-owned accounts for both, scoped to this layer only, is a hard precondition for P5b, not a parallel-track nice-to-have. This is independent of, and does not require, the separately-deferred move to own Cadence's own product database (`auth-backend-migration-runbook.md`).

## 7. What this explicitly does not change

- The portability guarantee stands: hosted-app data and code stay exportable even while Cadence-hosted, via `exportTenantData` (Section 2) for the pooled DB and the existing build/version system for code. Nothing in this plan introduces a hostage-lock mechanism.
- Hosting remains commodity infrastructure, never the differentiator, per moat.md's monetization-as-moat stance. Nothing here is priced or positioned as a headline reason to pay. GA pricing and marketing copy must keep hosting allowance framed as an outcome (a "Cadence-hosted" toggle, a live URL), never presented as a feature-parity peer of the AI-credit/decision-layer allowance in the same breath (Section 1.3): that framing is what protects the "hosting is commodity, only decision and memory are the moat" position at the point of sale.
- The existing BYO path (P1-P4: `RepoProvider`, GitHub/GitLab, user-owned Supabase/hosting) is unaffected and remains the default for every user until P5 actually ships. P5 is additive, not a replacement.
- Cadence's own account/workspace/product tenancy model is extended by the `AppRuntimeProvider`'s `workspace_id` scoping, not replaced or duplicated.

## Related / cross-references

- [`docs/strategy/byo-build-and-cadence-cloud.md`](../strategy/byo-build-and-cadence-cloud.md)
- [`docs/planning/byo-build-implementation-plan.md`](./byo-build-implementation-plan.md)
- [`architecture/security.md`](../../architecture/security.md)
- [`architecture/data.md`](../../architecture/data.md)
- [`docs/operations/procurement-inventory.md`](../operations/procurement-inventory.md)
- [`docs/strategy/moat.md`](../strategy/moat.md)
- [`docs/conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md)
