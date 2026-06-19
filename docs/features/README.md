# docs/features/: Per-feature operator & demo guides

> _Created: 2026-06-06 · Last updated: 2026-06-19_

> Every shipped, user-facing Cadence feature gets one canonical page here. This is the **single place** to open when running a demo, onboarding a new operator, or remembering what a feature actually does months later. Strategy and bundle plans live in [`../strategy/`](../strategy/) and [`agent-ecosystem-plan.md`](./archive/agent-ecosystem-plan.md); architecture contracts live in [`../../architecture/`](../../architecture/); the build log lives in [`../../plan.md`](../../plan.md) §4. **These per-feature pages are the demo deliverable**: they consolidate, they do not invent.

## When to add a file here

Add a `docs/features/<slug>.md` page in the same commit that ships any feature that:

- adds a route, panel, or modal an operator interacts with, OR
- adds an agent capability the operator can see or approve, OR
- you would point to during a demo or sales call.

Internal-only refactors, schema-only changes, and pure infrastructure work do **not** need a feature page (they belong in `architecture/*.md` and `plan.md` §4 only).

## File template (every page follows this skeleton)

```text
# {F-ID} — {Feature name}

> Status · Shipped YYYY-MM-DD · Route(s) · Owner agent(s)

## What it does          (one paragraph)
## Why it exists         (one paragraph, link to plan.md §4 entry)
## Where to find it      (nav path, route, panels)
## Demo script           (≤ 90s, numbered, read-aloud)
## How it works          (tables, server fns, tools — 5–10 bullets, link architecture/*.md)
## Governance & guardrails (approval modes, RLS scope, kill-switches)
## Verification checklist (concrete "is this live and correct" steps)
## Known limits / out of scope
## Related                (plan.md entry · architecture/*.md · feature-backlog row · siblings)
```

## Index

| ID        | Feature                                                        | Status                                          | Route(s)                                          | Doc                                                                  |
| --------- | -------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| C4/E7 | Agent inspector (run history) | ◐ Core shipped 2026-06-18 | `/missions?tab=agents` | [`c4-e7-agent-inspector.md`](./c4-e7-agent-inspector.md) |
| P7 | Incidents log (read-only) | ◐ Core shipped 2026-06-18 | `/govern?tab=incidents` | [`p7-incidents.md`](./p7-incidents.md) |
| R3 | Notifications (in-app Attention feed) | ✅ Shipped 2026-06-20 | `/govern?tab=attention` | [`r3-notifications.md`](./r3-notifications.md) |
| U6 | Workspace data export (data portability) | ◐ Core shipped 2026-06-18 | `/settings?section=data` | [`u6-data-export.md`](./u6-data-export.md) |
| SUBPROC-DISCLOSURE | Sub-processor disclosure registry (model providers + infra) | ◐ Backend shipped 2026-06-20 | (no UI yet; `getSubprocessors` fn) | [`subprocessor-disclosure.md`](./subprocessor-disclosure.md) |
| APP-HEALTH | App-level health/readiness endpoint (uptime monitors / LBs) | ◐ Endpoint shipped 2026-06-20 | `GET /api/public/health` | [`app-health.md`](./app-health.md) |
| D4 | Mission cancellation (per-mission brake) | ◐ Cancellation shipped 2026-06-18 | `/missions/$id` | [`d4-mission-cancellation.md`](./d4-mission-cancellation.md) |
| O1 | Provenance ("why is this on the roadmap?") | ◐ Provenance shipped 2026-06-18 | `/product?opp=` | [`o1-provenance.md`](./o1-provenance.md) |
| LCH-01 | Launch-kit drafting (changelog/blog/email/social/docs) | ◐ Drafting shipped 2026-06-18 | `/build/$missionId` Changes | [`lch-01-launch-kit.md`](./lch-01-launch-kit.md) |
| F3 | Continuous discovery feed (always-fresh + per-product) | ◐ Per-product clustering shipped 2026-06-18 | `/product?tab=signals` | [`f3-continuous-discovery.md`](./f3-continuous-discovery.md) |
| F-AGENT-1 | Orchestrator + multi-agent missions                            | ✅ Shipped 2026-06-06                           | `/missions`, `/missions/$id`                      | [`f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md)           |
| F-AGENT-2 | Persistent agent memory + self-reflection + trust auto-advance | ✅ Shipped 2026-06-06                           | `/agents`                                         | [`f-agent-2-memory-reflection.md`](./f-agent-2-memory-reflection.md) |
| F-AGENT-3 | Event reactor + auto-pipelines                                 | ✅ Shipped 2026-06-06                           | `/governance` (Auto-pipelines · Reactor activity) | [`f-agent-3-event-reactor.md`](./f-agent-3-event-reactor.md)         |
| F-AGENT-4 | Swarm HUD                                                      | ✅ Shipped 2026-06-06                           | `/swarm`                                          | [`f-agent-4-swarm-hud.md`](./f-agent-4-swarm-hud.md)                 |
| F-V6-SHARE | Shareable decision links (the viral loop)                    | ✅ Shipped 2026-06-14                           | `/d/$slug` (public)                               | [`shareable-decisions.md`](./shareable-links.md)                 |
| M-C       | Pricing, plans & entitlements (monetization foundation)        | 🔨 Foundation built 2026-06-16 (migration pending sync; Stripe keys pending) | `/settings?section=billing` | [`pricing.md`](./pricing.md)                                         |
| H1 | PRD → engineering task-graph (the Planner step)                          | ✅ Shipped 2026-06-14                           | `/prds/$id`                                       | [`task-graph.md`](./task-graph.md)                                   |
| Bundle 9  | Builder agent · PR · CI loop · file-claim conflict guard       | ✅ Slice 1 2026-06-04 · Slices 2 + 3 2026-06-06 | `/build`, `/prds/$id`, `/missions/$id`            | [`bundle-9-builder.md`](./archive/bundle-9-builder.md)                       |
| v6 P1     | The Loop Runs Itself · auto-advance · hop retry · adaptive budget · memory_refs | ✅ Shipped 2026-06-14 (migrations pending sync)  | `/missions`, `/missions/$id`, `/swarm`            | [`loop-runs-itself.md`](./loop-runs-itself.md)                       |
| v6 P3 T2  | The Gauntlet · acceptance rate · autonomy ratio · ritual retention | ✅ Shipped 2026-06-14 (ritual_sessions migration pending sync) | `/govern?tab=gauntlet`                  | [`gauntlet-metrics.md`](./gauntlet-metrics.md)                       |
| M-B       | Compounding-memory view (the moat made visible)               | ✅ Shipped 2026-06-14                           | `/memory`                                         | [`memory-view.md`](./memory-view.md)                                 |
| OPS-01    | Flow mode (ambient calm-state: soundscape + focus timer + quieting) | ✅ Shipped 2026-06-16                      | Chrome (`AppShell` footer)                        | [`flow-mode.md`](./flow-mode.md)                                     |
| WEDGE     | Critic-teardown first-run (the launch wedge)                   | ✅ Shipped 2026-06-17                           | Today (cold-start)                                | [`wedge.md`](./wedge.md)                                             |
| F-SHARE-TEARDOWN | Shareable Critic-teardown links (the viral loop)        | ✅ Shipped 2026-06-17 (migration pending sync)  | `/t/$slug` (public)                               | [`shareable-teardowns.md`](./shareable-links.md)                 |
| W6        | Persona onboarding tracks (Solo / Founding PM / Tech Founder)   | ✅ Shipped 2026-06-17 (live-verify on next publish) | `/onboarding`                                 | [`onboarding-tracks.md`](./onboarding-tracks.md)                     |
| ENG-06    | Cost per outcome (calm-front chip + Engine Room unit-economics) | ◐ B1+B3 built 2026-06-17 (tsc/lint/build green; live-verify on next publish; B2 deferred) | Today · `/govern?tab=analytics` | [`cost-per-outcome.md`](./cost-per-outcome.md)                       |
| F-AGENTS-MENTIONABLE | @-mention an agent in chat to dispatch it directly | ✅ Shipped 2026-06-18 (server cycle 19 commit; composer picker + case-insensitive parse cycle 21; live-verify on next publish) | `/chat` (Ask) | [`agents-mentionable.md`](./agents-mentionable.md) |
| LIFECYCLE | Build->Ship lifecycle gap map (audit + capture model + build plan) | 📋 Audit 2026-06-18 (no code yet; founder review pending) | n/a (planning doc) | [`lifecycle-gap-map.md`](../planning/lifecycle-gap-map.md) |
| WM | Workspaces, accounts & tenancy + monetization (initiative) | 📋 Plan 2026-06-19 (build pending; board G10) | Settings · workspace switcher | [`workspaces.md`](./workspaces.md) |
| F-BRAIN | Brain: Perplexity-grade research + the company brain, one surface | ✅ Shipped | `/chat` (Threads) | [`brain.md`](./brain.md) |
| F-STUDIO | Studio → Build: the in-platform development engine | ✅ Code landed 2026-06-12 (migration pending Lovable sync) | `/build`, `/build/$missionId` | [`studio.md`](./studio.md) |
| F-CRITIC-AGENT | Critic agent (adversarial red-team on opportunities + PRDs) | ✅ Shipped | Opportunities · `/prds/$id` (verdict cards) | [`critic-agent.md`](./critic-agent.md) |
| F-SCRIBE-CITATIONS | Scribe RAG citations (inline evidence in generated PRDs) | ✅ Shipped | `/prds/$id` (Citations card) | [`prd-rag-citations.md`](./prd-rag-citations.md) |
| WEB-ACCESS | Web access for agents (governed Firecrawl tool set) | ✅ Shipped | Agent tools (search · map · fetch · crawl) | [`web-access.md`](./web-access.md) |
| C6 | Agent trust score & autonomy dial | ✅ Shipped | `/agents` | [`trust-and-autonomy.md`](./trust-and-autonomy.md) |
| BUNDLE-4 | Agent-to-agent (A2A) handoff (E1→E5, multi-agent missions) | ✅ Shipped | `/missions`, `/missions/$id` | [`a2a-handoff.md`](./a2a-handoff.md) |
| BUNDLE-6 | GitHub issue approval flow (lifecycle close to the eng system of record) | ✅ Shipped | `/prds` (Send to issue gate) | [`github-issue-approval-flow.md`](./github-issue-approval-flow.md) |
| F-V5-INGEST-WEBHOOK | Public continuous-ingest webhook door | ✅ Shipped 2026-06-11 (rate limiting 2026-06-16) | Public `/api/public/ingest` endpoint | [`ingest-webhook.md`](./ingest-webhook.md) |
| Q1-MCP | Read-only Model Context Protocol (MCP) server | ◐ Phases 1-3 shipped 2026-06-17 (Phase 4 future) | MCP server · Settings (token UI) | [`q1-mcp.md`](./q1-mcp.md) |
| AUTH | Authentication flows (sign in / up / recover / session) | ✅ Shipped | `/login`, `/signup` | [`auth-flows.md`](./auth-flows.md) |

## Rules

1. **Consolidate, don't restate.** A feature page links to its `plan.md` §4 entry and architecture bullet, and it doesn't duplicate them. If you find yourself rewriting an architectural contract here, move it to `architecture/*.md` and link.
2. **Stay demo-ready.** The Demo script section must be runnable end-to-end on the seeded demo workspace (`demo@redcadence.app`). If a step breaks, fix the page in the same commit you fix the feature.
3. **One source of "How to use / verify".** The detailed walkthrough lives here. `docs/feature-backlog.md` rows link to this page rather than duplicating the checklist.
4. **Update the index above** whenever you add a page. A page that isn't in the index is invisible.

## Related

- [`../README.md`](../README.md), parent docs index
- [`../planning/feature-backlog.md`](../planning/feature-backlog.md), live status board + ledger
- [`agent-ecosystem-plan.md`](./archive/agent-ecosystem-plan.md), F-AGENT-1→4 bundle strategy
- [`agent-experience.md`](./agent-experience.md), the agent roster model, faces, identity, and the relay (the "19 vs 6" resolution, built on the F-AGENT-1→4 substrate)
- [`../../architecture/orchestration.md`](../../architecture/orchestration.md), agent orchestration contract
- [`../../plan.md`](../../plan.md) §4, active build log
