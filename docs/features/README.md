# docs/features/ — Per-feature operator & demo guides

> Every shipped, user-facing Cadence feature gets one canonical page here. This is the **single place** to open when running a demo, onboarding a new operator, or remembering what a feature actually does months later. Strategy and bundle plans live in [`../strategy/`](../strategy/) and [`../agent-ecosystem-plan.md`](../agent-ecosystem-plan.md); architecture contracts live in [`../../architecture/`](../../architecture/); the build log lives in [`../../plan.md`](../../plan.md) §4. **These per-feature pages are the demo deliverable** — they consolidate, they do not invent.

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

| ID | Feature | Status | Route(s) | Doc |
|---|---|---|---|---|
| F-AGENT-1 | Orchestrator + multi-agent missions | ✅ Shipped 2026-06-06 | `/missions`, `/missions/$id` | [`f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md) |
| F-AGENT-2 | Persistent agent memory + self-reflection + trust auto-advance | ✅ Shipped 2026-06-06 | `/agents` | [`f-agent-2-memory-reflection.md`](./f-agent-2-memory-reflection.md) |
| F-AGENT-3 | Event reactor + auto-pipelines | ✅ Shipped 2026-06-06 | `/governance` (Auto-pipelines · Reactor activity) | [`f-agent-3-event-reactor.md`](./f-agent-3-event-reactor.md) |
| F-AGENT-4 | Swarm HUD | ✅ Shipped 2026-06-06 | `/swarm` | [`f-agent-4-swarm-hud.md`](./f-agent-4-swarm-hud.md) |
| Bundle 9 | Builder agent · PR · CI loop · file-claim conflict guard | ✅ Slice 1 2026-06-04 · Slices 2 + 3 2026-06-06 | `/build`, `/prds/$id`, `/missions/$id` | [`bundle-9-builder.md`](./bundle-9-builder.md) |

## Rules

1. **Consolidate, don't restate.** A feature page links to its `plan.md` §4 entry and architecture bullet — it doesn't duplicate them. If you find yourself rewriting an architectural contract here, move it to `architecture/*.md` and link.
2. **Stay demo-ready.** The Demo script section must be runnable end-to-end on the seeded demo workspace (`demo@redcadence.app`). If a step breaks, fix the page in the same commit you fix the feature.
3. **One source of "How to use / verify".** The detailed walkthrough lives here. `docs/feature-backlog.md` rows link to this page rather than duplicating the checklist.
4. **Update the index above** whenever you add a page. A page that isn't in the index is invisible.

## Related

- [`../README.md`](../README.md) — parent docs index
- [`../feature-backlog.md`](../feature-backlog.md) — live status board + ledger
- [`../agent-ecosystem-plan.md`](../agent-ecosystem-plan.md) — F-AGENT-1→4 bundle strategy
- [`../../architecture/orchestration.md`](../../architecture/orchestration.md) — agent orchestration contract
- [`../../plan.md`](../../plan.md) §4 — active build log