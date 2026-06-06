# docs/ — Index

> Parent index for everything under `docs/`. Every new doc added to this folder must be listed here so nothing lives in a silo. If you add a file and don't link it from this index (or its subfolder's index), the doc loop is open — close it in the same commit.
>
> Operating rules live in [`../AGENTS.md`](../AGENTS.md). Product thesis lives in [`../README.md`](../README.md). Build log + roadmap live in [`../plan.md`](../plan.md). Architecture contracts live in [`../architecture/`](../architecture/). This folder holds the *operator-facing* and *strategic* docs that wrap those contracts.

## Live status & backlog

| File | Purpose |
|---|---|
| [`feature-backlog.md`](./feature-backlog.md) | **Live status board** (Now building / Next up / Blocked / Recent log) + full feature ledger with "How to use / verify" blocks. The shared cursor every tool reads at session start. |
| [`foundation-audit.md`](./foundation-audit.md) | Foundation-phase audit tickets and acceptance criteria. |
| [`considerations.md`](./considerations.md) | Cross-cutting concerns that don't fit a single architecture doc. |
| [`demo-credentials.md`](./demo-credentials.md) | Pre-provisioned demo logins (two emails + shared password), what each account ships with, how they were created, and the re-seed SQL. Use for screen recordings, YC / investor demos, and anywhere a working login is needed. |
| [`agent-ecosystem-plan.md`](./agent-ecosystem-plan.md) | **F-AGENT-1 → F-AGENT-4 bundle plan** — orchestrator (shipped), persistent memory + self-reflection + trust auto-advance, event reactor + auto-pipelines, Swarm HUD. The canonical, session-surviving plan for the agent-native behavior layer. |
| [`auth-flows.md`](./auth-flows.md) | Authentication flows — sign-up, sign-in, password visibility toggle, forgot-password / reset-password flow, session lifecycle, demo accounts. |

## Operator guides (what surfaces mean and how to use them)

| File | What it explains | Tightly coupled to |
|---|---|---|
| [`trust-and-autonomy.md`](./trust-and-autonomy.md) | Agent Trust score (0–100), qualitative bands, the three ingredients in the tooltip, and the four autonomy arcs (Observing → Proving → Trusted → Ambient) at the approval gate. | [`a2a-handoff.md`](./a2a-handoff.md), [`../architecture/security.md`](../architecture/security.md), [`../architecture/orchestration.md`](../architecture/orchestration.md) |
| [`a2a-handoff.md`](./a2a-handoff.md) | Agent-to-agent handoff contract (Bundle 4 / E1–E5): missions, structured payloads, receiver-arc gating, failure policy. | [`trust-and-autonomy.md`](./trust-and-autonomy.md), [`../architecture/orchestration.md`](../architecture/orchestration.md) |
| [`web-access.md`](./web-access.md) | Web I/O tools for agents (`web.search` / `fetch` / `map` / `crawl`) backed by Firecrawl — what they do, default approvals, safety model, setup. | [`trust-and-autonomy.md`](./trust-and-autonomy.md), [`a2a-handoff.md`](./a2a-handoff.md), [`../architecture/runtime.md`](../architecture/runtime.md), [`../architecture/integrations.md`](../architecture/integrations.md) |
| [`github-issue-approval-flow.md`](./github-issue-approval-flow.md) | The `github.issue.create` → `prd.link_issue` approval flow (Bundle 6 lifecycle close): what happens on Approve, which repo/token, idempotency, failure modes, verification checklist, secret rotation. | [`trust-and-autonomy.md`](./trust-and-autonomy.md), [`a2a-handoff.md`](./a2a-handoff.md), [`../architecture/orchestration.md`](../architecture/orchestration.md), [`../architecture/integrations.md`](../architecture/integrations.md) |
| [`fnd-runtime-restart-playbook.md`](./fnd-runtime-restart-playbook.md) | Forced-restart verification playbook for FND-RUNTIME 0.9 — operator steps to prove a long mission resumes from checkpoint with no duplicate external writes after a worker restart. | [`foundation-audit.md`](./foundation-audit.md), [`features/bundle-9-builder.md`](./features/bundle-9-builder.md), [`../architecture/runtime.md`](../architecture/runtime.md) |
| [`git-discipline.md`](./git-discipline.md) | Cross-tool commit/push WHY discipline; enforced by hooks. | [`../AGENTS.md`](../AGENTS.md) |

## Per-feature operator & demo guides

One canonical page per shipped, user-facing feature. The **single place** to open during a demo or when learning a feature months later. Strategy stays in [`strategy/`](./strategy/); architecture stays in [`../architecture/`](../architecture/); the build log stays in [`../plan.md`](../plan.md) §4 — these pages consolidate, they do not invent. Folder index + template: [`features/README.md`](./features/README.md).

| ID | Feature | Doc |
|---|---|---|
| F-AGENT-1 | Orchestrator + multi-agent missions | [`features/f-agent-1-orchestrator.md`](./features/f-agent-1-orchestrator.md) |
| F-AGENT-2 | Persistent memory + self-reflection + trust auto-advance | [`features/f-agent-2-memory-reflection.md`](./features/f-agent-2-memory-reflection.md) |
| F-AGENT-3 | Event reactor + auto-pipelines | [`features/f-agent-3-event-reactor.md`](./features/f-agent-3-event-reactor.md) |
| F-AGENT-4 | Swarm HUD | [`features/f-agent-4-swarm-hud.md`](./features/f-agent-4-swarm-hud.md) |

## Strategy (versioned positioning)

See [`strategy/README.md`](./strategy/README.md) for the version index and the cascade rule. Current positioning: [`strategy/v2-positioning-2026-06-02.md`](./strategy/v2-positioning-2026-06-02.md). Cross-session decisions: [`strategy/session-decisions.md`](./strategy/session-decisions.md).

## Decisions (ADRs)

| File | Decision |
|---|---|
| [`decisions/tech-stack.md`](./decisions/tech-stack.md) | Stack choices + keep-vs-change analysis. |
| [`decisions/durable-runtime.md`](./decisions/durable-runtime.md) | Durable workflow / runtime choice. |
| [`decisions/parallel-development-model.md`](./decisions/parallel-development-model.md) | Multi-tool parallel development model. |
| [`decisions/tenancy-retrofit.md`](./decisions/tenancy-retrofit.md) | Workspace/product tenancy retrofit. |
| [`decisions/naming.md`](./decisions/naming.md) | Product naming. |

## References (external research feeding the product)

| File | Purpose |
|---|---|
| [`references/competitive-reference.md`](./references/competitive-reference.md) | Competitive landscape notes. |
| [`references/idea-origination-inputs.md`](./references/idea-origination-inputs.md) | Inputs that shaped the original idea. |
| [`references/research-references-aakash-gupta.md`](./references/research-references-aakash-gupta.md) | PM-voice research references. |

## Rule: keep this index true

When you add a new file under `docs/`:
1. Add a row to the appropriate table above.
2. Add a "Related" / cross-link block at the bottom of the new doc pointing to its tightly-coupled siblings (other `docs/*.md` and the relevant `architecture/*.md`).
3. If the new doc explains an operator-facing surface, also add a "How to use / verify" block to its [`feature-backlog.md`](./feature-backlog.md) entry.
4. If it changes a contract documented in `architecture/*`, update that contract in the same commit.

A doc that nothing links to is invisible. Close the loop.