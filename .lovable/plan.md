# F-IA-V4 — Collapse 30+ routes into 7 surfaces

This is the M1 keystone refactor. It touches every route file, the sidebar (`AppShell.tsx`), the command palette, and several conventions docs. I want your sign-off on the mapping and phasing before I move any files, because the wrong call here breaks every bookmark in the app.

## Target IA (from `v4-feature-map-2026-06-11.md` §7)

| # | Surface | Route | Tabs / sections | Absorbs |
|---|---|---|---|---|
| 1 | **Home** | `/` | Daily brief · Needs-you · Loop pulse · Flow | index, briefing, inbox(badge) |
| 2 | **Chat** | `/chat` | (unchanged) | chat |
| 3 | **Missions** | `/missions` | Live list · DAG · Build · Activity | cockpit, missions, swarm, build, agents(view) |
| 4 | **Product** | `/product` | Signals · Opportunities · Specs · Roadmap · Releases | discovery, opportunities, prds, roadmap, tasks, outcome(part) |
| 5 | **Knowledge** | `/knowledge` | Memory · Decisions · Docs · Calendar | docs, decisions(?), calendar, meetings |
| 6 | **Learn** | `/learn` | Support · Outcomes · Learnings | outcome(part), analytics(user-facing) |
| 7 | **Govern** | `/govern` | Approvals · Policy · Budgets · Guardrails · Traces · Evals · Drift · Prompts | governance, guardrails, budgets, observe, traces, evals, drift, prompts |
| — | **Settings** | `/settings` | + Staff (agent config), Connectors, Models/BYOK | settings, integrations, sync, agents(config) |

**Pinned rail:** Home · Chat · Missions (per spec). Approvals + Calendar drop off the pin (they live inside Home/Knowledge); current pin has 4, spec says 3.

## Phasing (I will pause after each phase for review)

### Phase 1 — Scaffold the 7 surfaces (additive, no breakage)
1. Create `_authenticated.missions.tsx` (layout), `_authenticated.product.tsx`, `_authenticated.knowledge.tsx`, `_authenticated.learn.tsx`, `_authenticated.govern.tsx` as tabbed shells using the existing `validateSearch` ?tab= pattern (proven on `/observe`, `/governance`).
2. Each new surface initially **re-uses existing panel components** (e.g. `/product?tab=signals` renders the current `DiscoveryPage` body as a panel). No business-logic edits — pure composition.
3. Add a temporary feature flag `cadence.ia.v4` (localStorage) so AppShell can show the new nav alongside the old one during cutover.

### Phase 2 — Rewrite AppShell + CommandPalette
1. New nav: pinned (Home/Chat/Missions) + collapsible groups (Product, Knowledge, Learn, Govern, Settings).
2. CommandPalette destinations updated to the 7 surfaces (deep-links via `?tab=`).
3. Update `architecture/frontend.md` (pinned rail rule, surface contracts) in the same commit.

### Phase 3 — Convert legacy routes to redirects
Flip these to `beforeLoad: throw redirect(...)`:
- `/cockpit`, `/swarm`, `/build`, `/agents` (view) → `/missions?tab=…`
- `/discovery`, `/opportunities`, `/prds`, `/roadmap`, `/tasks`, `/outcome` → `/product?tab=…`
- `/docs`, `/calendar`, `/meetings`, `/meetings/$id` → `/knowledge?tab=…` (+ `?item=`)
- `/governance`, `/guardrails`, `/budgets`, `/observe`, `/traces` (index), `/evals`, `/drift`, `/prompts` → `/govern?tab=…`
- `/integrations`, `/sync`, `/agents` (config) → `/settings?section=…`
- `/inbox`, `/briefing`, `/analytics` already redirect — repoint to new surfaces.

Deep-link routes preserved as-is: `/prds/$id`, `/missions/$missionId`, `/traces/$traceId`.

### Phase 4 — Close the doc loop
- Update `architecture/frontend.md` surface-by-surface contracts (replace `/observe` and `/governance` sections with the 7 new ones).
- Update `docs/feature-backlog.md` live status board: flip `F-IA-V4` to ✅, log entry.
- Append to `plan.md` §4.
- Delete `active-task.md` if F-IA-V4 was the only open thing (it isn't — Calendar OAuth task survives, so update that file's preamble).

## What I will NOT do without further direction

- **Touch business logic, server fns, or DB.** Pure routing + composition refactor.
- **Redesign panel internals.** A "Signals tab" in Phase 1 is the current `/discovery` page body in a tab, not a redesigned one.
- **Merge `decisions` into Knowledge** unless you confirm — there's no `/decisions` route today; decisions live inside missions/specs. I'll leave Knowledge with Memory/Docs/Calendar in Phase 1 and add Decisions if/when we build that surface.
- **Remove the v3 feature flag** until you've clicked through the new IA and signed off.

## Risk / open questions

1. **Pinned rail is 4 today (Home/Approvals/Calendar/Chat), spec says 3 (Home/Chat/Missions).** Approvals badge moves to Home's needs-you queue; Calendar moves into Knowledge. Confirm you want me to drop them from the pin.
2. **`/tasks` absorption.** Spec says "Tasks fold into Product→Roadmap." I'll fold the current Tasks page in as a Roadmap sub-view or a "Tasks" tab — your call which.
3. **Estimated touch:** ~7 new route files, ~15 route files converted to redirects, AppShell rewrite, CommandPalette rewrite, 2 doc files. Probably 3 sequential turns to land cleanly. I'll pause after Phase 1 so you can click around before I rip out the old nav.

Reply **"go phase 1"** to start, or correct the mapping first.
