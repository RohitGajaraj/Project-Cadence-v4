# docs/ — Index

> Parent index for everything under `docs/`. Every new doc added to this folder must be listed here so nothing lives in a silo. If you add a file and don't link it from this index (or its subfolder's index), the doc loop is open — close it in the same commit.
>
> Operating rules live in [`../AGENTS.md`](../AGENTS.md). Product thesis lives in [`../README.md`](../README.md). Build log + roadmap live in [`../plan.md`](../plan.md). Architecture contracts live in [`../architecture/`](../architecture/). This folder holds the _operator-facing_ and _strategic_ docs that wrap those contracts.

## Live status & backlog

| File                                                                     | Purpose                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`planning/feature-backlog.md`](./planning/feature-backlog.md)           | **Live status board** (Now building / Next up / Blocked / Recent log) + full feature ledger with "How to use / verify" blocks. The shared cursor every tool reads at session start.                                                             |
| [`planning/foundation-audit.md`](./planning/foundation-audit.md)         | Foundation-phase audit tickets and acceptance criteria.                                                                                                                                                                                         |
| [`planning/considerations.md`](./planning/considerations.md)             | Cross-cutting concerns that don't fit a single architecture doc.                                                                                                                                                                                |
| [`planning/known-issues.md`](./planning/known-issues.md)                 | **Live known-issues tracker** — open bugs/blockers with stable KI-IDs; doubles as the June 22 demo punch list. The constitution concordance target for `KNOWN_ISSUES.md`.                                                                       |
| [`planning/v4-rebuild-handoff-2026-06-11.md`](./planning/v4-rebuild-handoff-2026-06-11.md) | **v4 rebuild session tracker** — what was decided/produced on 2026-06-11 and how a fresh session resumes without re-spending tokens.                                                                                                  |
| [`operations/demo-credentials.md`](./operations/demo-credentials.md)     | Pre-provisioned demo logins (two emails + shared password), what each account ships with, how they were created, and the re-seed SQL. Use for screen recordings, YC / investor demos, and anywhere a working login is needed.                   |
| [`features/agent-ecosystem-plan.md`](./features/agent-ecosystem-plan.md) | **F-AGENT-1 → F-AGENT-4 bundle plan** — orchestrator (shipped), persistent memory + self-reflection + trust auto-advance, event reactor + auto-pipelines, Swarm HUD. The canonical, session-surviving plan for the agent-native behavior layer. |
| [`features/auth-flows.md`](./features/auth-flows.md)                     | Authentication flows — sign-up, sign-in, password visibility toggle, forgot-password / reset-password flow, session lifecycle, demo accounts.                                                                                                   |

## Operator guides (what surfaces mean and how to use them)

| File                                                                                         | What it explains                                                                                                                                                                                       | Tightly coupled to                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`features/trust-and-autonomy.md`](./features/trust-and-autonomy.md)                         | Agent Trust score (0–100), qualitative bands, the three ingredients in the tooltip, and the four autonomy arcs (Observing → Proving → Trusted → Ambient) at the approval gate.                         | [`features/a2a-handoff.md`](./features/a2a-handoff.md), [`../architecture/security.md`](../architecture/security.md), [`../architecture/orchestration.md`](../architecture/orchestration.md)                                                                               |
| [`features/a2a-handoff.md`](./features/a2a-handoff.md)                                       | Agent-to-agent handoff contract (Bundle 4 / E1–E5): missions, structured payloads, receiver-arc gating, failure policy.                                                                                | [`features/trust-and-autonomy.md`](./features/trust-and-autonomy.md), [`../architecture/orchestration.md`](../architecture/orchestration.md)                                                                                                                               |
| [`features/web-access.md`](./features/web-access.md)                                         | Web I/O tools for agents (`web.search` / `fetch` / `map` / `crawl`) backed by Firecrawl — what they do, default approvals, safety model, setup.                                                        | [`features/trust-and-autonomy.md`](./features/trust-and-autonomy.md), [`features/a2a-handoff.md`](./features/a2a-handoff.md), [`../architecture/runtime.md`](../architecture/runtime.md), [`../architecture/integrations.md`](../architecture/integrations.md)             |
| [`features/github-issue-approval-flow.md`](./features/github-issue-approval-flow.md)         | The `github.issue.create` → `prd.link_issue` approval flow (Bundle 6 lifecycle close): what happens on Approve, which repo/token, idempotency, failure modes, verification checklist, secret rotation. | [`features/trust-and-autonomy.md`](./features/trust-and-autonomy.md), [`features/a2a-handoff.md`](./features/a2a-handoff.md), [`../architecture/orchestration.md`](../architecture/orchestration.md), [`../architecture/integrations.md`](../architecture/integrations.md) |
| [`operations/fnd-runtime-restart-playbook.md`](./operations/fnd-runtime-restart-playbook.md) | Forced-restart verification playbook for FND-RUNTIME 0.9 — operator steps to prove a long mission resumes from checkpoint with no duplicate external writes after a worker restart.                    | [`planning/foundation-audit.md`](./planning/foundation-audit.md), [`features/bundle-9-builder.md`](./features/bundle-9-builder.md), [`../architecture/runtime.md`](../architecture/runtime.md)                                                                             |
| [`operations/git-discipline.md`](./operations/git-discipline.md)                             | Cross-tool commit/push WHY discipline; enforced by hooks.                                                                                                                                              | [`../AGENTS.md`](../AGENTS.md)                                                                                                                                                                                                                                             |

## Per-feature operator & demo guides

One canonical page per shipped, user-facing feature. The **single place** to open during a demo or when learning a feature months later. Strategy stays in [`strategy/`](./strategy/); architecture stays in [`../architecture/`](../architecture/); the build log stays in [`../plan.md`](../plan.md) §4 — these pages consolidate, they do not invent. Folder index + template: [`features/README.md`](./features/README.md).

| ID        | Feature                                                  | Doc                                                                                    |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| F-AGENT-1 | Orchestrator + multi-agent missions                      | [`features/f-agent-1-orchestrator.md`](./features/f-agent-1-orchestrator.md)           |
| F-AGENT-2 | Persistent memory + self-reflection + trust auto-advance | [`features/f-agent-2-memory-reflection.md`](./features/f-agent-2-memory-reflection.md) |
| F-AGENT-3 | Event reactor + auto-pipelines                           | [`features/f-agent-3-event-reactor.md`](./features/f-agent-3-event-reactor.md)         |
| F-AGENT-4 | Swarm HUD                                                | [`features/f-agent-4-swarm-hud.md`](./features/f-agent-4-swarm-hud.md)                 |
| Bundle 9  | Builder agent · PR · CI loop · file-claim conflict guard | [`features/bundle-9-builder.md`](./features/bundle-9-builder.md)                       |
| F-BRAIN | **Brain** — Perplexity-grade research over web+workspace AND the company brain (auto-retention, remember/capture actions, brain status); deep-linked citations, model switcher | [`features/brain.md`](./features/brain.md)                                       |

## Strategy (versioned positioning)

See [`strategy/README.md`](./strategy/README.md) for the version index and the cascade rule. **Current source of truth: [`strategy/v4-feature-map-2026-06-11.md`](./strategy/v4-feature-map-2026-06-11.md)** (scope, agent mesh, IA, milestones M1–M5) with its adversarial companion [`strategy/v4-stress-test-2026-06-11.md`](./strategy/v4-stress-test-2026-06-11.md). Personas remain in [`strategy/v3-positioning-circuit-2026-06-10.md`](./strategy/v3-positioning-circuit-2026-06-10.md). Cross-session decisions: [`strategy/session-decisions.md`](./strategy/session-decisions.md).

## Conventions (durable cross-tool rules)

Git-tracked rules every tool follows. One file per rule. Index + how to add: [`conventions/README.md`](./conventions/README.md).

| File                                                                             | Rule                                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`conventions/ui-chrome.md`](./conventions/ui-chrome.md)                         | No native browser chrome. Use `useConfirm`/`usePrompt`/`sonner`/shadcn.      |
| [`conventions/ui-voice.md`](./conventions/ui-voice.md)                           | Voice anchor, length budgets, AI-tell denylist, no em/en dashes.             |
| [`conventions/destructive-actions.md`](./conventions/destructive-actions.md)     | Typed-name match for irreversible deletes; Undo over confirm for reversible. |
| [`conventions/inline-management.md`](./conventions/inline-management.md)         | Workspace + product management inline, never a settings route.               |
| [`conventions/doc-closure-checklist.md`](./conventions/doc-closure-checklist.md) | 8-step per-feature checklist that closes the documentation loop.             |

## Decisions (ADRs)

| File                                                                                   | Decision                                 |
| -------------------------------------------------------------------------------------- | ---------------------------------------- |
| [`decisions/tech-stack.md`](./decisions/tech-stack.md)                                 | Stack choices + keep-vs-change analysis. |
| [`decisions/durable-runtime.md`](./decisions/durable-runtime.md)                       | Durable workflow / runtime choice.       |
| [`decisions/parallel-development-model.md`](./decisions/parallel-development-model.md) | Multi-tool parallel development model.   |
| [`decisions/tenancy-retrofit.md`](./decisions/tenancy-retrofit.md)                     | Workspace/product tenancy retrofit.      |
| [`decisions/naming.md`](./decisions/naming.md)                                         | Product naming.                          |

## References (external research feeding the product)

| File                                                                                                 | Purpose                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [`references/competitive-landscape-2026-06-11.md`](./references/competitive-landscape-2026-06-11.md) | **June-2026 market scan with source links** (AI-PM tools, suite agents, autonomous engineering, MCP/A2A, naming, investor signal). Read this instead of re-researching. |
| [`references/competitive-reference.md`](./references/competitive-reference.md)                       | Competitive landscape notes (older).  |
| [`references/idea-origination-inputs.md`](./references/idea-origination-inputs.md)                   | Inputs that shaped the original idea. |
| [`references/research-references-aakash-gupta.md`](./references/research-references-aakash-gupta.md) | PM-voice research references.         |

## Rule: keep this index true

When you add a new file under `docs/`:

1. Add a row to the appropriate table above.
2. Add a "Related" / cross-link block at the bottom of the new doc pointing to its tightly-coupled siblings (other `docs/*.md` and the relevant `architecture/*.md`).
3. If the new doc explains an operator-facing surface, also add a "How to use / verify" block to its [`planning/feature-backlog.md`](./planning/feature-backlog.md) entry.
4. If it changes a contract documented in `architecture/*`, update that contract in the same commit.

A doc that nothing links to is invisible. Close the loop.
