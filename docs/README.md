# docs/ — Index

> Parent index for everything under `docs/`. Every new doc added to this folder must be listed here so nothing lives in a silo. If you add a file and don't link it from this index (or its subfolder's index), the doc loop is open — close it in the same commit.
>
> Operating rules live in [`../AGENTS.md`](../AGENTS.md). Product thesis lives in [`../README.md`](../README.md). Build log + roadmap live in [`../plan.md`](../plan.md). Architecture contracts live in [`../architecture/`](../architecture/). This folder holds the _operator-facing_ and _strategic_ docs that wrap those contracts.

---

## 📍 Repository map & file-placement policy — READ BEFORE CREATING ANY FILE

> **This is the standing anti-rot rule.** Every file has exactly one correct home and must be linked from that home's index in the same commit. This section exists so no tool (Claude Code · Antigravity · Gemini · Lovable · future me) ever re-scatters the repo. We have spent hours regrouping before — this is how we stop doing that.

### Where everything lives

| When you create… | Put it in… | And link it from… |
| --- | --- | --- |
| A strategy / positioning doc | `docs/strategy/vN-…-YYYY-MM-DD.md` (**current = v6**) | [`docs/strategy/README.md`](./strategy/README.md) |
| A **superseded** strategy doc | `docs/strategy/archive/` | [`docs/strategy/README.md`](./strategy/README.md) (Archived) |
| A planning / backlog / known-issue / handoff doc | `docs/planning/` | this file (§ Live status & backlog) |
| A market / competitive / research reference | `docs/references/` | this file (§ References) |
| An ops runbook or policy (commits · hooks · memory · skills · subagents · tools · git-discipline · demo-credentials · runbooks) | `docs/operations/` | this file (§ Operator guides) |
| A durable cross-tool convention (UI chrome · voice · destructive · inline · checklist) | `docs/conventions/` | [`docs/conventions/README.md`](./conventions/README.md) |
| A build-in-public / brand content doc | the separate **private** `build-in-public` repo (not this repo) | n/a (moved out 2026-06-15) |
| A per-feature operator / demo spec | `docs/features/` | [`docs/features/README.md`](./features/README.md) |
| An architecture contract (runtime · orchestration · security · data · frontend · integrations) | `architecture/` | this file (links throughout) |
| An ADR / technical decision | `docs/decisions/` | this file (§ Decisions) |
| A **verification / QA** screenshot (proof a build rendered) | `docs/screenshots/<group>/` — **gitignored, local only** | n/a (not committed) |
| A **canonical design-reference** image a parallel build must match | `design-reference/` (next to the `*.jsx` references) — **committed, curated** | the relevant spec / [`../DESIGN.md`](../DESIGN.md) |

### Repo root is reserved — do not add docs here

Root holds **only**: AI-entry docs (`README.md`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `ENTRY.md`, `Ai_Cofounder.md`), build/config (`package.json`, `vite.config.ts`, `wrangler.jsonc`, `tsconfig.json`, `eslint.config.js`, `components.json`, `bun.lock`, `bunfig.toml`, `.gitignore`, `.prettier*`, `.mcp.json`, `.lovable-config.txt`, `requirements.txt`, `.env*`), and the live cursors `plan.md` + `active-task.md` + `DESIGN.md`. **Nothing else.**

### Hard rules (the loop stays closed)

1. **No new doc at repo root or at `docs/` top level** (except the reserved entries above). Pick a subfolder.
2. **No redirect stubs, no duplicates.** One canonical file per topic. If a file moves, repoint its inbound links — never leave a pointer file behind.
3. **Every new doc is linked from its folder's index in the same commit.** A doc nothing links to is an orphan — that is the open-loop defect.
4. **Latest positioning is always v7** ([`docs/strategy/v7-agentic-product-os-2026-06-14.md`](./strategy/v7-agentic-product-os-2026-06-14.md); v6 retained as engine/IA detail) until a newer `vN` supersedes it and updates [`docs/strategy/README.md`](./strategy/README.md).
5. **Images split by purpose — input vs. artifact.** **Verification / QA screenshots** (proof a build rendered) are **local-only, gitignored** under `docs/screenshots/` — they are transient evidence and bloat git history (binaries never diff; every version is kept forever). **Canonical design-reference images** that a parallel build (Lovable · Gemini · Antigravity · Claude Code) must *match* are **committed to `design-reference/`** — those tools only see `main`, not your local folder or chat image-cache, so a load-bearing reference must be in git or they're flying blind. Curate ruthlessly: **one canonical image per screen**, linked from its spec, exactly like the `*.jsx` references already there — not a dump of every crop. (Git images don't consume session context — they're inert until an agent opens one; the only cost is repo size, so the rule is "few and durable, never bulk.") If volume ever gets heavy, escalate to **Git LFS** or keep heavy assets in the design project and reference by URL. **The full bucket map (scenario to location), the retention windows, and the automatic sweep are the standing rule in [`conventions/workspace-hygiene.md`](./conventions/workspace-hygiene.md) — no image ever belongs at the repo root or the `docs/` top level.**

> Entry docs ([`../README.md`](../README.md), [`../CLAUDE.md`](../CLAUDE.md), [`../AGENTS.md`](../AGENTS.md), [`../GEMINI.md`](../GEMINI.md), [`../.lovable-config.txt`](../.lovable-config.txt)) point here as the canonical map. Keep this section true; it is the contract.

---

## Live status & backlog

| File                                                                     | Purpose                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`planning/feature-dashboard.md`](./planning/feature-dashboard.md)       | **★ THE MASTER FEATURE STATUS BOARD (front door).** Every feature with status (Done / In Dev / Partial / Paused / Deferred / Blocked / Pending), a one-line "why it matters", a stable ID, and a build cue. **Standing rule: read it BEFORE starting any feature work** (respects In-Dev claims so parallel sessions never collide); flip a row to In Dev on pickup and Done on completion, same commit. Human-readable master view of the backlog board below. |
| [`planning/feature-backlog.md`](./planning/feature-backlog.md)           | **Granular ledger + Build-order rollup** + full feature entries with "How to use / verify" blocks. The detail behind the dashboard above; its Live status board is mirrored at-a-glance in the dashboard.                                       |
| [`planning/foundation-audit.md`](./planning/foundation-audit.md)         | Foundation-phase audit tickets and acceptance criteria.                                                                                                                                                                                         |
| [`planning/considerations.md`](./planning/considerations.md)             | Cross-cutting concerns that don't fit a single architecture doc.                                                                                                                                                                                |
| [`planning/known-issues.md`](./planning/known-issues.md)                 | **Live known-issues tracker** — open bugs/blockers with stable KI-IDs; doubles as the June 22 demo punch list. The constitution concordance target for `KNOWN_ISSUES.md`.                                                                       |
| [`planning/archive/v4-rebuild-handoff-2026-06-11.md`](./planning/archive/v4-rebuild-handoff-2026-06-11.md) | **v4 rebuild session tracker** — what was decided/produced on 2026-06-11 and how a fresh session resumes without re-spending tokens.                                                                                                  |
| [`planning/v7-trd-2026-06-14.md`](./planning/v7-trd-2026-06-14.md)       | **v7 Technical Requirements Document** — code-verified architecture snapshot (Part A) + the M-0 to M-D requirements as What/Why/Where/Acceptance with Built/Partial/Missing tags (Part B). The engineering contract for the v7 canon.            |
| [`planning/v7-build-status.md`](./planning/v7-build-status.md) | **The "what next" source of truth.** Always-current build-state tracker: M-0 to M-D status, what is Built, In progress, or Blocked, and the explicit next pick. Read after `active-task.md`. Tier 1, continuous. |
| [`planning/archive/v7-feature-map-2026-06-14.md`](./planning/archive/v7-feature-map-2026-06-14.md) | **v7 feature map.** The shipped-state catalog by lifecycle station and surface; each feature tagged Built, Partial, or Missing-Planned. |
| [`planning/archive/v7-functionality-map-2026-06-14.md`](./planning/archive/v7-functionality-map-2026-06-14.md) | **v7 functionality map.** How each major flow behaves: inputs, steps, the four states, the human-in-the-loop gates, and the data read and written. |
| [`planning/v7-prd-2026-06-14.md`](./planning/v7-prd-2026-06-14.md) | **v7 PRD.** Problem, personas, epics as user stories with acceptance criteria and priorities tied to M-0 to M-D, and the launch-gating success metrics. |
| [`operations/demo-credentials.md`](./operations/demo-credentials.md)     | Pre-provisioned demo logins (two emails + shared password), what each account ships with, how they were created, and the re-seed SQL. Use for screen recordings, YC / investor demos, and anywhere a working login is needed.                   |
| [`features/agent-ecosystem-plan.md`](./features/agent-ecosystem-plan.md) | **F-AGENT-1 → F-AGENT-4 bundle plan** — orchestrator (shipped), persistent memory + self-reflection + trust auto-advance, event reactor + auto-pipelines, Swarm HUD. The canonical, session-surviving plan for the agent-native behavior layer. |
| [`features/auth-flows.md`](./features/auth-flows.md)                     | Authentication flows — sign-up, sign-in, password visibility toggle, forgot-password / reset-password flow, session lifecycle, demo accounts.                                                                                                   |

## Brand & build-in-public

The build-in-public brand system was **split into a separate private repo** (`RohitGajaraj/build-in-public`) on 2026-06-15, so the founder's personal brand, voice, drafts, and social tokens stay out of this (shareable) product repo. It is no longer in `docs/brand/`. **Standing rule for every tool working in this repo:** when a non-obvious build insight surfaces, append it to that repo's `content-well.md` (the one-way insight feed) so the weekly content routine can draft from it; never post to the founder's accounts without his explicit approval. Do not recreate `docs/brand/` here.

## Architecture contracts (the `../architecture/` folder)

| File | What it specifies |
| --- | --- |
| [`../architecture/runtime.md`](../architecture/runtime.md) | The AI chokepoint: callModel, callModelStream, guardrails, cost, BYO keys. |
| [`../architecture/orchestration.md`](../architecture/orchestration.md) | Missions, the agent loop, auto-advance, handoff, memory. |
| [`../architecture/data.md`](../architecture/data.md) | The data layer: tables, RLS, key RPCs. |
| [`../architecture/security.md`](../architecture/security.md) | Auth, tenancy, governance, the kill switch. |
| [`../architecture/integrations.md`](../architecture/integrations.md) | Connectors, BYO keys, agent interop. |
| [`../architecture/frontend.md`](../architecture/frontend.md) | Frontend patterns and the app shell. |
| [`../architecture/diagrams.md`](../architecture/diagrams.md) | New. The visual companion: system, deployment, ERD, sequence, and state diagrams (Mermaid). |
| [`../architecture/deployment.md`](../architecture/deployment.md) | New. Build and deploy path, runtime topology, secrets, the cron loop, migrations, rollback. |
| [`../architecture/api.md`](../architecture/api.md) | New. The API and interface reference: public routes, server functions, the A2A and the planned MCP surface. |
| [`../architecture/observability.md`](../architecture/observability.md) | New. Telemetry (cost, traces, evals, drift, the gauntlet) plus the non-functional requirements. |
| [`../architecture/threat-model.md`](../architecture/threat-model.md) | New. STRIDE analysis, the anon-read surface inventory, secrets, the agent-washing posture. |

## Operator guides (what surfaces mean and how to use them)

| File                                                                                         | What it explains                                                                                                                                                                                       | Tightly coupled to                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`features/trust-and-autonomy.md`](./features/trust-and-autonomy.md)                         | Agent Trust score (0–100), qualitative bands, the three ingredients in the tooltip, and the four autonomy arcs (Observing → Proving → Trusted → Ambient) at the approval gate.                         | [`features/a2a-handoff.md`](./features/a2a-handoff.md), [`../architecture/security.md`](../architecture/security.md), [`../architecture/orchestration.md`](../architecture/orchestration.md)                                                                               |
| [`features/a2a-handoff.md`](./features/a2a-handoff.md)                                       | Agent-to-agent handoff contract (Bundle 4 / E1–E5): missions, structured payloads, receiver-arc gating, failure policy.                                                                                | [`features/trust-and-autonomy.md`](./features/trust-and-autonomy.md), [`../architecture/orchestration.md`](../architecture/orchestration.md)                                                                                                                               |
| [`features/web-access.md`](./features/web-access.md)                                         | Web I/O tools for agents (`web.search` / `fetch` / `map` / `crawl`) backed by Firecrawl — what they do, default approvals, safety model, setup.                                                        | [`features/trust-and-autonomy.md`](./features/trust-and-autonomy.md), [`features/a2a-handoff.md`](./features/a2a-handoff.md), [`../architecture/runtime.md`](../architecture/runtime.md), [`../architecture/integrations.md`](../architecture/integrations.md)             |
| [`features/github-issue-approval-flow.md`](./features/github-issue-approval-flow.md)         | The `github.issue.create` → `prd.link_issue` approval flow (Bundle 6 lifecycle close): what happens on Approve, which repo/token, idempotency, failure modes, verification checklist, secret rotation. | [`features/trust-and-autonomy.md`](./features/trust-and-autonomy.md), [`features/a2a-handoff.md`](./features/a2a-handoff.md), [`../architecture/orchestration.md`](../architecture/orchestration.md), [`../architecture/integrations.md`](../architecture/integrations.md) |
| [`operations/fnd-runtime-restart-playbook.md`](./operations/fnd-runtime-restart-playbook.md) | Forced-restart verification playbook for FND-RUNTIME 0.9 — operator steps to prove a long mission resumes from checkpoint with no duplicate external writes after a worker restart.                    | [`planning/foundation-audit.md`](./planning/foundation-audit.md), [`features/bundle-9-builder.md`](./features/bundle-9-builder.md), [`../architecture/runtime.md`](../architecture/runtime.md)                                                                             |
| [`operations/git-discipline.md`](./operations/git-discipline.md)                             | Cross-tool commit/push WHY discipline; enforced by hooks.                                                                                                                                              | [`../AGENTS.md`](../AGENTS.md)                                                                                                                                                                                                                                             |
| [`operations/autonomous-build-loop.md`](./operations/autonomous-build-loop.md) | Standing playbook for an unattended / overnight build run: the contract, the per-item loop, the gates, the doc-loop, collision-safe worktree isolation, context-continuity and handoff, and the usage-limit retry resilience. Re-invokable via `/overnight-build`. Live run status: [`planning/overnight-build-report.md`](./planning/overnight-build-report.md). | [`../AGENTS.md`](../AGENTS.md), [`planning/feature-dashboard.md`](./planning/feature-dashboard.md), [`operations/git-discipline.md`](./operations/git-discipline.md) |
| [`operations/auth-backend-migration-runbook.md`](./operations/auth-backend-migration-runbook.md) | PLANNED runbook to leave Lovable Cloud and own our Supabase project + Google OAuth. Why it is the right long-term call, the two moves, $0 cost, the Lovable bring-your-own-Supabase path, and a phased checklist with owner tags.                                | [`operations/demo-credentials.md`](./operations/demo-credentials.md), [`../architecture/security.md`](../architecture/security.md)                                                                                                                                          |

## Per-feature operator & demo guides

One canonical page per shipped, user-facing feature. The **single place** to open during a demo or when learning a feature months later. Strategy stays in [`strategy/`](./strategy/); architecture stays in [`../architecture/`](../architecture/); the build log stays in [`../plan.md`](../plan.md) §4 — these pages consolidate, they do not invent. Folder index + template: [`features/README.md`](./features/README.md).

| ID        | Feature                                                  | Doc                                                                                    |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| F-AGENT-1 | Orchestrator + multi-agent missions                      | [`features/f-agent-1-orchestrator.md`](./features/f-agent-1-orchestrator.md)           |
| F-AGENT-2 | Persistent memory + self-reflection + trust auto-advance | [`features/f-agent-2-memory-reflection.md`](./features/f-agent-2-memory-reflection.md) |
| F-AGENT-3 | Event reactor + auto-pipelines                           | [`features/f-agent-3-event-reactor.md`](./features/f-agent-3-event-reactor.md)         |
| F-AGENT-4 | Swarm HUD                                                | [`features/f-agent-4-swarm-hud.md`](./features/f-agent-4-swarm-hud.md)                 |
| Bundle 9  | Builder agent · PR · CI loop · file-claim conflict guard — **superseded by F-STUDIO** | [`features/bundle-9-builder.md`](./features/bundle-9-builder.md)                       |
| F-BRAIN | **Brain** — Perplexity-grade research over web+workspace AND the company brain (auto-retention, remember/capture actions, brain status); deep-linked citations, model switcher | [`features/brain.md`](./features/brain.md)                                       |
| F-STUDIO | **Studio** — the in-platform development engine: repo reads, multi-file DB-staged changesets, `studio/*` branches, PR + CI self-correct, in-platform merge behind gates; two doors (agent contract + `/studio` human surface with Monaco diffs and mid-session steering) | [`features/studio.md`](./features/studio.md)                                       |

## Strategy (versioned positioning)

See [`strategy/README.md`](./strategy/README.md) for the full version index, the archive, and the cascade rule. **Current positioning source of truth: [`strategy/v6-agentic-product-os-2026-06-13.md`](./strategy/v6-agentic-product-os-2026-06-13.md)** — the Agentic Product OS umbrella (PM Chief of Staff felt entry + Decision-System moat), phased build, market evidence. Engine / expansion map: [`strategy/v4-feature-map-2026-06-11.md`](./strategy/v4-feature-map-2026-06-11.md) (+ adversarial companion [`strategy/v4-stress-test-2026-06-11.md`](./strategy/v4-stress-test-2026-06-11.md)). Wedge UX detail: [`strategy/v5-chief-of-staff-2026-06-11.md`](./strategy/v5-chief-of-staff-2026-06-11.md). Personas: [`strategy/v3-positioning-cadence-2026-06-10.md`](./strategy/v3-positioning-cadence-2026-06-10.md). Superseded iterations (v1/v2/v3-audit*) live in [`strategy/archive/`](./strategy/archive/). Cross-session decisions: [`strategy/session-decisions.md`](./strategy/session-decisions.md).

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
| [`references/external-strategy-synthesis-2026-06-14.md`](./references/external-strategy-synthesis-2026-06-14.md) | **Synthesis (read first).** Fuses the two Google Cloud reports + the live market/WTP/investor research into the convergence thesis, validations, sharpening corrections, and the handoff to **v7**. |
| [`references/ai-agent-trends-2026-gcp.md`](./references/ai-agent-trends-2026-gcp.md)                 | **Google Cloud + DeepMind "AI Agent Trends 2026"** (49 pp) — page-cited digest: the 5 enterprise shifts, all data points, frameworks (grounding · digital assembly line · A2A/MCP/AP2 · 5 Pillars), quotes, implications. Names the "Chief of Staff for AI" role we productize. |
| [`references/future-of-ai-startups-2025-gcp.md`](./references/future-of-ai-startups-2025-gcp.md)     | **Google Cloud "Future of AI: Perspectives for Startups 2025"** (75 pp) — page-cited digest: 20+ VC/founder voices, the 15 takeaways, moat/last-mile/ambient-agent/budget-replacement frameworks, the quote bank, and our **fundraising spine**. |

## Rule: keep this index true

When you add a new file under `docs/`:

1. Add a row to the appropriate table above.
2. Add a "Related" / cross-link block at the bottom of the new doc pointing to its tightly-coupled siblings (other `docs/*.md` and the relevant `architecture/*.md`).
3. If the new doc explains an operator-facing surface, also add a "How to use / verify" block to its [`planning/feature-backlog.md`](./planning/feature-backlog.md) entry.
4. If it changes a contract documented in `architecture/*`, update that contract in the same commit.

A doc that nothing links to is invisible. Close the loop.
