# v7 build status and roadmap tracker (the "what next" source of truth)

> **What this is.** The single, always-current answer to "what is built, what is in progress, and what do we build next." Read [`../../active-task.md`](../../active-task.md) first (the session cursor), then this. Milestones are defined in the v7 canon section 12; feature statuses roll up from the v7 feature map; priorities come from the PRD.
>
> **Update cadence: Tier 1 (continuous).** Update this in the same commit as any change that ships a feature, moves a status, or completes a milestone. See [`../conventions/doc-update-cadence.md`](../conventions/doc-update-cadence.md). The NEXT pick is mechanical: the first not-done item in the earliest not-done milestone.
>
> **Cross-links.** Canon: [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md). Feature catalog + status: [`v7-feature-map-2026-06-14.md`](./v7-feature-map-2026-06-14.md). Requirements + priorities: [`v7-prd-2026-06-14.md`](./v7-prd-2026-06-14.md). Granular ledger: [`feature-backlog.md`](./feature-backlog.md). Open bugs: [`known-issues.md`](./known-issues.md).

---

## Current state, in one line

The autonomy and memory engine is real and verified, and as of 2026-06-14 all pending migrations are applied on the live database (founder-confirmed Lovable sync), so the engine is fully wired on real data. The active milestone is **M-0 (Unblock the loop)**. What remains is a live end-to-end verification (a real signup, then one unattended multi-agent mission) and one live ingest source. **NEXT PICK: verify the loop live (signup plus one mission), then wire one live ingest source.**

## The next pick (mechanical)

1. **DONE 2026-06-14: unseeded-slug drift, sealed** (migration `20260614200000`, commit `5b0b0b93ea`). Correction worth recording, because the prior note here was wrong: a 10-agent adversarial root-cause (workflow `wf_71a7dc78`) proved `mission.plan` does not throw on stale slugs. It plans against the live enabled roster and re-validates (`orchestrator.server.ts:125,173-179`), so there is no deterministic crash. The real deterministic defect was on the event-reactor path: the default subscription seeded `signal.created` to slug `'discovery'`, but the seeded specialist is `discovery-scout`, so `dispatchEvent` (`reactor.functions.ts:222`) threw "Target agent not found" for every new account (fault-isolated, so it stayed silent while the `signal.created` SENSE fan-out was dead). Fixed in three parts: the seed function, a scoped backfill of existing rows, and the stale orchestrator prompt. Two latent gaps it surfaced are logged as KI-19.
2. **DONE 2026-06-14: migrations synced (M-0).** All pending 2026-06-14 migrations are applied on the live DB (founder-confirmed Lovable sync): KI-13 signup resilience, KI-14 eval scale, KI-17 anon-hardening, the slug-drift fix, the P1 retry plus memory-recall migrations, the webhook and connector platform. **NEXT: verify live** (a real signup, then one unattended multi-agent mission closes on the now-migrated DB), then wire one live ingest source.
3. **THEN — One live ingest source (M-0).** Register one connector's OAuth client or use the webhook so SENSE produces real signals.
4. **DONE 2026-06-14 (sanitizer): the humanizeText() runtime gate is wired** at the AI chokepoint (`src/lib/ai/humanize.ts` + `runtime.server.ts`), prose only, JSON byte-exact. Still pending: the build-time pre-commit dash/invisible-char trace hook. See [`../conventions/humanized-output.md`](../conventions/humanized-output.md).

## Milestones (M-0 to M-D)

| Milestone | Status | Exit criteria | Key items and status |
| --- | --- | --- | --- |
| **M-0 Unblock the loop** | **Next (active)** | A real account is created and a multi-agent mission runs without crashing | Unseeded-slug drift (Fixed 2026-06-14) · migrations synced (Done 2026-06-14, live) · live e2e verification (Next) · one live ingest source (Partial) |
| **M-A Real loop, real data** | Later | A real new user signs up and the loop closes once on their data, under 10 minutes | Ambient on-ramp observing to proving to trusted (Missing) · 2 or more real ingest sources (Partial) |
| **M-B Moat visible and verified** | Later | The gauntlet metrics read real, rising numbers on at least one partner | Surface compounding memory (Built: `/memory` view shipped 2026-06-14, [`memory-view.md`](../features/memory-view.md)) · instrument the moat metric (Built: Memory-compounds card on the Gauntlet 2026-06-14 - reuse · growth · priorities-moved; NDR gated on M-C billing) · Critic as a loop step (Missing) · standing truth-audit (Partial) |
| **M-C Monetize and viral** | Later (started) | First paying PMs; a shared decision link drives signups | Pricing and entitlements (Missing) · the shareable-decision link (Built: shipped by the parallel tool, commits `2c51575b` and `4d7bf70f`) · PLG funnel (Missing) · pre-launch gate: the full-product humanization sweep (deferred, see standing queue #3) |
| **M-D Dual-user and scale** | Later | An external agent integrates; a team lands | MCP server and public API (Missing) · team features (Missing) · governance and enterprise readiness (Partial) |

## What is built (the engine, code-verified 2026-06-14)

- The loop runs itself: deterministic auto-advance (`advanceMissionCore` via the resume-runs cron); multi-wave missions advance unattended past wave 0.
- Memory threads and compounds: `memory_refs` recalled and threaded into handoffs; `recordOutcome` distils outcomes into recallable global memory.
- Governance is honest: bounded retry, adaptive step budgets, the "Executed unattended" audit on the cockpit, the Today decision card with the Critic badge, the gauntlet metrics at `/govern?tab=gauntlet`.
- The green path ships real code: the Studio and Build stage to commit to PR to CI to merge loop.
- Roster: 4 specialist agents (`discovery-scout`, `strategist`, `prd-writer`, `builder`) plus the `orchestrator`, with Critic as an inline LLM call.
- Strategy and docs: the v7 canon (committed), the external-reference layer (committed), the humanized-output rule (committed), the doc-update-cadence and this tracker (in progress).

## What is in progress

- Phase-B documentation set (feature map, functionality map, TRD, PRD, plus the architecture diagrams, deployment, api, observability, threat-model). Drafting now.
- The shareable-decision viral loop (an M-C item) shipped by the parallel tool; pricing and the PLG funnel around it are still Missing.

## What is blocked or gated

- **Migrations:** all applied via the Lovable sync 2026-06-14. KI-13 signup resilience, autonomous-path semantic recall (`20260614091000`), and bounded hop-retry (`20260614090000`) are now live; a live end-to-end verification is the remaining confirmation.
- **Connectors:** OAuth-wired but not operational, pending founder OAuth-client registration (the F-CONN migration is applied; only the provider app registrations remain).

## Standing task queue (post-Phase-B, in order)

1. M-0: the unseeded-slug drift, KI-19, and the migration sync are all done (migrations applied live 2026-06-14); remaining is a live end-to-end verification (signup plus one unattended mission), then one live ingest source.
2. The `humanizeText()` runtime sanitizer (DONE 2026-06-14) plus the pre-commit trace hook (still pending).
3. Humanization sweep: the docs pass is DONE 2026-06-14 (README, strategy, feature docs). The full-PRODUCT sweep (UI strings, seed data, code-level user-facing copy) is DEFERRED to a pre-launch gate, run when the product is near-final so churn in screens and features does not force a re-sweep. **Cutoff 2026-06-14:** the sweep covers only pre-2026-06-14 (pre-rule) work; anything authored on or after 2026-06-14 is built under the rule and sanitized at runtime, so it is NOT re-checked (saves time and tokens). Claude prompts the founder at that gate. Generated output is already sanitized at runtime (`humanizeText`); new authored text is built humanized and distinctive meanwhile. (Founder ruling 2026-06-14, see session-decisions.)
4. M-A: the ambient on-ramp and a second live ingest source.
5. M-B: surface and measure the compounding memory; promote Critic to a loop step.

## How this stays current

Tier 1, continuous. On any status change or milestone completion, update the table and the next-pick list in the same commit, and add a one-line note to `plan.md` section 4. The NEXT pick is always the first not-done item in the earliest not-done milestone.

## Related

- [`../conventions/doc-update-cadence.md`](../conventions/doc-update-cadence.md) (this tracker is the "what next" source of truth it names) · [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md) · [`v7-feature-map-2026-06-14.md`](./v7-feature-map-2026-06-14.md) · [`v7-prd-2026-06-14.md`](./v7-prd-2026-06-14.md) · [`feature-backlog.md`](./feature-backlog.md) · [`../../active-task.md`](../../active-task.md)
