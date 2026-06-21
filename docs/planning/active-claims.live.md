# Build status - LIVE (auto-generated; do not edit)

> **The real-time view of who is building what + what is next.** Regenerated every few seconds by the `com.cadence.active-claims-sync` watcher from the atomic claim ledger (`~/.cadence-parallel`, instant) and origin/main's register (read-only `git fetch`, no pull needed). **Git-ignored** - it never rots, never conflicts. Instant CLI view: `bash scripts/lane.sh board`.
>
> **Updated 2026-06-21 05:53:47** | active lanes: 1 | Tier items done: 0 | register source: origin/main
>
> **COLLISIONS ARE PREVENTED BY THE LEDGER, NOT THIS FILE.** Before any work, a session MUST run `bash scripts/lane.sh claim <ID> <lane> "<globs>"` and proceed only if it returns success (exit 0 = won). A `HELD`/`CONFLICT` result means another lane has it - pick the next 🟢 free item below. Never start work before claiming.

## In progress now (per lane)

| Lane | Rank | ID | Activity | Claimed | Status | Files |
| --- | --- | --- | --- | --- | --- | --- |
| lane 0 | - | - | _(idle, no active claim)_ | - | - | - |
| lane 1 | #- | Q1-MCP | Q1 Phase 4a: native MCP streamable-HTTP transport hands | 05:47 (6m) | 🔨 In Dev | mcp-protocol.ts, mcp-protocol.test.ts +3 |
| lane 2 | - | - | _(idle, no active claim)_ | - | - | - |
| lane 3 | - | - | _(idle, no active claim)_ | - | - | - |
| lane 4 | - | - | _(idle, no active claim)_ | - | - | - |

## Top of the rank - LIVE status (✓ done · 🔒 building · 🟢 free)

> **Status meaning:** ⬜ open · 🔨 building now · ◐ built + gates green, **pending your publish-verify** · ✅ verified live. A lane marks **◐ when it finishes building** (honest status), and only flips to ✅ after you publish and it is behaviorally verified - so a `◐` here means the lane HAS finished it, not that it is unfinished.

| State | Rank | ID | Priority | Status (origin) | Who |
| --- | --- | --- | --- | --- | --- |
| 🟢 FREE | #1 | DBR-1.5 | Tier 1 | ◐ | - |
| 🟢 FREE | #2 | MOAT-VIS | Tier 1 | ◐ | - |
| 🟢 FREE | #3 | F-IA-BRAIN-GRAPH | Tier 1 | ◐ | - |
| 🟢 FREE | #4 | MOAT-METRIC | Tier 1 | ◐ | - |
| 🟢 FREE | #5 | EMBED-CHOKEPOINT | Tier 1 | ⬜ | - |
| 🟢 FREE | #6 | FIRECRAWL-FLOOR | Tier 1 | ◐ | - |
| 🟢 FREE | #7 | H1-TASKS | Tier 1 | ◐ | - |
| 🟢 FREE | #8 | W1-AUTO | Tier 1 | ◐ | - |
| 🟢 FREE | #9 | O1 | Tier 1 | ◐ | - |
| 🟢 FREE | #10 | O3 | Tier 1 | ◐ | - |
| 🟢 FREE | #11 | Q1 / ENG-07 / F-MCP-V1 | Tier 1 | ◐ | - |
| 🟢 FREE | #12 | H2-WRITES | Tier 1 | ◐ | - |
| 🟢 FREE | #13 | WM-F1 | Tier 1 | ◐ | - |
| 🟢 FREE | #14 | WM-F1b | Tier 1 | ◐ | - |
| 🟢 FREE | #15 | WM-M2 | Tier 1 | ◐ | - |
| 🟢 FREE | #16 | WM-F3 | Tier 1 | ◐ | - |
| 🟢 FREE | #17 | WM-M5 | Tier 1 | ◐ | - |
| 🟢 FREE | #18 | WM-F2 | Tier 1 | ◐ | - |

## Standing reservations (safety, not a lane task)
- `CHOKEPOINT` (lane `core`) - AI chokepoint/agent core - no lane touches this
