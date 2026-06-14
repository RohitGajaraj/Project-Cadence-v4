# v7 build status and roadmap tracker (the "what next" source of truth)

> **What this is.** The single, always-current answer to "what is built, what is in progress, and what do we build next." Read [`../../active-task.md`](../../active-task.md) first (the session cursor), then this. Milestones are defined in the v7 canon section 12; feature statuses roll up from the v7 feature map; priorities come from the PRD.
>
> **Update cadence: Tier 1 (continuous).** Update this in the same commit as any change that ships a feature, moves a status, or completes a milestone. See [`../conventions/doc-update-cadence.md`](../conventions/doc-update-cadence.md). The NEXT pick is mechanical: the first not-done item in the earliest not-done milestone.
>
> **Cross-links.** Canon: [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md). Feature catalog + status: [`v7-feature-map-2026-06-14.md`](./v7-feature-map-2026-06-14.md). Requirements + priorities: [`v7-prd-2026-06-14.md`](./v7-prd-2026-06-14.md). Granular ledger: [`feature-backlog.md`](./feature-backlog.md). Open bugs: [`known-issues.md`](./known-issues.md).

---

## Current state, in one line

The autonomy and memory engine is real and verified. The active milestone is **M-0 (Unblock the loop)**: a live orchestrator slug bug and the pending migration sync (KI-13) stand between the engine and the real-data thesis. **NEXT PICK: fix the orchestrator slug bug, then own the migration apply-and-verify for KI-13.**

## The next pick (mechanical)

1. **NEXT — Orchestrator slug fix (M-0).** The orchestrator prompt names slugs (`discovery`, `growth`, `analyst`) that are not seeded, so `mission.plan` throws and any multi-agent mission with a sensing step dies. Fix: align the prompt to the seeded slugs (`discovery-scout`, `strategist`, `prd-writer`, `builder`) or add slug aliasing. Where: `src/lib/ai/tools/orchestrator.server.ts` and the orchestrator seed migration.
2. **THEN — Migration sync and KI-13 (M-0).** An owned apply-and-verify step for the pending 2026-06-14 migrations on the live database, KI-13 first (live signup still 500s). If the Lovable sync lags, apply manually within a week.
3. **THEN — One live ingest source (M-0).** Register one connector's OAuth client or use the webhook so SENSE produces real signals.
4. **THEN — The humanizeText() sanitizer + the pre-commit trace hook**, so the humanized-output rule is enforced, not only written. See the TRD requirement and [`../conventions/humanized-output.md`](../conventions/humanized-output.md).

## Milestones (M-0 to M-D)

| Milestone | Status | Exit criteria | Key items and status |
| --- | --- | --- | --- |
| **M-0 Unblock the loop** | **Next (active)** | A real account is created and a multi-agent mission runs without crashing | Orchestrator slug fix (Missing) · migration sync + KI-13 (Missing, owned) · one live ingest source (Partial) |
| **M-A Real loop, real data** | Later | A real new user signs up and the loop closes once on their data, under 10 minutes | Ambient on-ramp observing to proving to trusted (Missing) · 2 or more real ingest sources (Partial) |
| **M-B Moat visible and verified** | Later | The gauntlet metrics read real, rising numbers on at least one partner | Surface compounding memory (Built: `/memory` view shipped 2026-06-14, [`memory-view.md`](../features/memory-view.md)) · instrument the moat metric (Built: Memory-compounds card on the Gauntlet 2026-06-14 - reuse · growth · priorities-moved; NDR gated on M-C billing) · Critic as a loop step (Missing) · standing truth-audit (Partial) |
| **M-C Monetize and viral** | Later (started) | First paying PMs; a shared decision link drives signups | Pricing and entitlements (Missing) · the shareable-decision link (Built: shipped by the parallel tool, commits `2c51575b` and `4d7bf70f`) · PLG funnel (Missing) |
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

- **KI-13:** live signup 500s, pending the migration sync of `20260614140000_p3_ki13_signup_resilience.sql`.
- **Autonomous-path semantic recall:** gated on the COALESCE scope migration `20260614091000`.
- **Connectors:** OAuth-wired but not operational, pending founder OAuth-client registration.
- **Bounded retry on the autonomous path:** off until the retry-columns migration `20260614090000` applies.

## Standing task queue (post-Phase-B, in order)

1. M-0: orchestrator slug fix, then the migration apply-and-verify (KI-13), then one live ingest source.
2. The `humanizeText()` runtime sanitizer plus the pre-commit trace hook.
3. The codebase-wide humanization sweep of pre-rule docs (a Workflow: detect then fix per file; flagship v7 canon first).
4. M-A: the ambient on-ramp and a second live ingest source.
5. M-B: surface and measure the compounding memory; promote Critic to a loop step.

## How this stays current

Tier 1, continuous. On any status change or milestone completion, update the table and the next-pick list in the same commit, and add a one-line note to `plan.md` section 4. The NEXT pick is always the first not-done item in the earliest not-done milestone.

## Related

- [`../conventions/doc-update-cadence.md`](../conventions/doc-update-cadence.md) (this tracker is the "what next" source of truth it names) · [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md) · [`v7-feature-map-2026-06-14.md`](./v7-feature-map-2026-06-14.md) · [`v7-prd-2026-06-14.md`](./v7-prd-2026-06-14.md) · [`feature-backlog.md`](./feature-backlog.md) · [`../../active-task.md`](../../active-task.md)
