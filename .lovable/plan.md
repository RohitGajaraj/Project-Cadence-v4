
# F-AGENT-4 — Swarm HUD + per-feature demo/operator docs pattern

Two things in one unit of work:

1. **Establish a per-feature documentation pattern** so any shipped F-AGENT-* feature (and future bundles) has one canonical, demo-ready doc — instead of details being scattered across `plan.md` log entries, `architecture/orchestration.md` bullets, and `docs/feature-backlog.md` rows.
2. **Build F-AGENT-4 (Swarm HUD)** end-to-end, and ship its doc using the new pattern.

## Part 1 — Documentation pattern

New folder: `docs/features/` with a one-file-per-shipped-feature pattern. Each file is the **single page** to open during a demo or when learning a feature months later.

**Folder index:** `docs/features/README.md` — table of every feature file (ID · name · status · route · doc link · one-line "what it does"). Hooked into `docs/README.md` operator-guides table so the parent index stays true.

**Per-feature file template** (every file follows this exact skeleton — drives consistency and demo prep):

```text
# {F-ID} — {Feature name}

> Status · Shipped YYYY-MM-DD · Route(s) · Owner agent(s)

## What it does (one paragraph)
## Why it exists (one paragraph, links to plan.md §4 entry)
## Where to find it in the app
   - Nav path, route, panels (with screenshots/short captions if useful later)
## Demo script (≤ 90 seconds, numbered steps an operator can read aloud)
## How it works (architecture, server fns, tables, tools — 5–10 bullets, links to architecture/*.md)
## Governance & guardrails (approval modes, RLS scope, kill-switches)
## Verification checklist (concrete steps to confirm the feature is live and correct)
## Known limits / out of scope
## Related
   - Links: plan.md §4 entry · architecture/*.md · docs/feature-backlog.md row · sibling feature docs
```

**Backfill for the bundle** — create stubs (≤ ~80 lines each) for the three already-shipped F-AGENT features, populated from their existing `plan.md` §4 entries and `architecture/orchestration.md` bullets (no new claims — pure consolidation):

- `docs/features/f-agent-1-orchestrator.md`
- `docs/features/f-agent-2-memory-reflection.md`
- `docs/features/f-agent-3-event-reactor.md`
- `docs/features/f-agent-4-swarm-hud.md` ← full doc, written as F-AGENT-4 ships

**Doc-index plumbing:**
- Add `docs/features/` row to `docs/README.md` (operator-guides table).
- Update `docs/agent-ecosystem-plan.md` to link each F-ID to its new feature doc (the plan stays the bundle-level strategy; per-feature pages are the demo/operator deliverable).
- Update **Core memory rule**: when a feature ships a user-facing surface, the "How to use / verify" block now lives in `docs/features/{slug}.md` and `docs/feature-backlog.md` links to it (instead of duplicating). One source of truth per feature.

## Part 2 — Build F-AGENT-4 Swarm HUD

(Unchanged from the previous plan — repeated here so this single plan is the full unit of work.)

### Goal
A new route **`/swarm`** (nav slot between Missions and Inbox) that answers in one glance: what is every agent doing right now, which missions are advancing / stalled / failing, what is waiting on me, what did the reactor just fire, and where is the swarm spending time / tokens / cost in the last hour. Read-only HUD; the only writes are Approve / Reject / Dispatch / Skip, reusing the existing server fns from `/inbox` and `/governance`.

### Data sources (no new tables)
One new server fn `getSwarmHud()` in **`src/lib/swarm.functions.ts`** (one round-trip, 2s refetch, RLS-scoped):

| Panel | Source |
|---|---|
| Live agents | `agents` + latest `agent_runs` per agent |
| Missions in flight | `missions` + `mission_steps` aggregate |
| Handoff feed | `agent_messages` last 50 |
| Pending approvals | `agent_approvals` WHERE status=`pending` |
| Reactor firings | `event_queue` last 50 + pending `confirm` |
| Throughput strip | `ai_events` last 60 min (count, sum cost, p50 latency, 5-min buckets) |
| Guardrail hits | `guardrail_hits` last 1h |

No migration unless p50 of `getSwarmHud()` > 200ms on the demo workspace — then add covering indexes on `agent_messages(created_at desc)` and `event_queue(created_at desc)` in a single small migration.

### UI sections
```text
┌──────────────────────────────────────────────────────────────┐
│ HEADER · Swarm · N agents · M missions · last refresh 2s ago│
├───────────────┬──────────────────────────┬──────────────────┤
│ Throughput 1h │ Agents grid (one card    │ Attention queue  │
│ runs · cost · │ per agent: status pill,  │ - Pending approv.│
│ p50 latency · │ current sub-goal, trust  │ - Confirm reactor│
│ sparkline     │ arc, step k/N → click    │   firings        │
│               │ jumps to mission/run)    │ inline Approve / │
│               │                          │ Reject / Dispatch│
│               │                          │ / Skip           │
├───────────────┴──────────────────────────┴──────────────────┤
│ Missions in flight (table → /missions/$id)                  │
├──────────────────────────────────────────────────────────────┤
│ Handoff feed (live, mono timestamps, from → to · mission)   │
├──────────────────────────────────────────────────────────────┤
│ Reactor firings (event_type · target · mode · status · age) │
└──────────────────────────────────────────────────────────────┘
```

Editorial layout, semantic tokens from `design.md` only, mono-label headers, `rule-hairline` rows. Reuse `StatusPill`, `TrustArcBadge`, `AgentAvatar`, the Approve/Reject row from `/inbox`, the Dispatch/Skip row from `/governance` — import, do not duplicate.

### Files

**New**
- `src/lib/swarm.functions.ts` — `getSwarmHud()`.
- `src/routes/_authenticated.swarm.tsx` — page, 2s `refetchInterval`, suspense + error + not-found boundaries.
- `src/components/cadence/SwarmAgentCard.tsx`, `SwarmHandoffFeed.tsx`, `SwarmThroughputStrip.tsx`, `SwarmMissionsTable.tsx`.
- `docs/features/README.md` — index.
- `docs/features/f-agent-1-orchestrator.md`
- `docs/features/f-agent-2-memory-reflection.md`
- `docs/features/f-agent-3-event-reactor.md`
- `docs/features/f-agent-4-swarm-hud.md` (full)

**Edited**
- `src/routes/_authenticated.tsx` — add **Swarm** nav item between Missions and Inbox.
- `docs/README.md` — add `docs/features/` row to operator-guides table.
- `docs/agent-ecosystem-plan.md` — link each F-ID to its new feature doc.
- `docs/feature-backlog.md` — F-AGENT-4 ☐ → ✅; Live status board (Now building cleared, Last updated, Recent log one-liner); F-AGENT-1/2/3 entries get a link to their new feature doc.
- `plan.md` §4 — append dated F-AGENT-4 + docs-pattern entry with WHY.
- `architecture/orchestration.md` — promote F-AGENT-4 from "Still deferred" to a new shipped bullet; remove from deferred list.

**Deleted**
- `active-task.md` on completion.

### Out of scope (explicit)
- Pause/steer-from-graph controls (deferred).
- `agent.spawn` fan-out + parent merge (E4 polish, deferred).
- Per-mission message-cap loop guard (deferred).
- New mutations beyond the four buttons that already exist on `/inbox` and `/governance`.
- Cross-workspace HUD (workspace-scoped, like every other surface).

### Acceptance criteria

1. **Route live.** `/swarm` renders under `_authenticated`; has error + not-found boundaries.
2. **One query, 2s refresh.** Network tab shows a single `getSwarmHud` call every ~2s; no per-panel waterfall.
3. **Live agents reflect reality.** Starting a mission from `/missions` flips the orchestrator card on `/swarm` to `running` within one refresh tick.
4. **Handoff feed updates.** Triggering `agent.handoff` causes a new row to appear at the top of the feed within one tick with correct `from → to` slugs and a mission link.
5. **Attention panel works end-to-end.** Inline Approve/Reject calls the same fn `/inbox` uses; Dispatch/Skip calls the same fn `/governance` uses.
6. **Reactor firings panel matches `/governance`.** Same last-50 ordering, same status pills.
7. **Throughput strip reads from `ai_events`.** Last-hour count, sum cost, p50 latency match a direct SQL spot-check.
8. **RLS holds.** `demo2@redcadence.app` sees only their own agents/missions/queue rows.
9. **Design integrity.** No hex literals; semantic tokens only; matches editorial pattern in `design.md`.
10. **Performance budget.** `getSwarmHud()` p50 ≤ 200ms on the seeded demo workspace; if exceeded, ship the index migration listed above.
11. **Docs loop closed.** `docs/features/f-agent-4-swarm-hud.md` published; three backfill files for F-AGENT-1/2/3 published; `docs/features/README.md` index live; `docs/README.md`, `plan.md` §4, `architecture/orchestration.md`, `docs/feature-backlog.md` all updated in the same commit; `active-task.md` deleted; commit message includes WHY.
12. **Demo-readiness.** From `docs/features/f-agent-4-swarm-hud.md` alone, a new operator can sign in as the demo user, navigate to `/swarm`, and follow the demo script to show the swarm in action without opening any other doc or source file.

Switch me to build mode and I'll ship both the docs pattern and the HUD in one pass.
