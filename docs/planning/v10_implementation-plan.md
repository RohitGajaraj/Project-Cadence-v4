# Implementation Plan - how we execute the v10 blueprint

> _Created: 2026-06-17 · Last updated: 2026-06-19_

> **SSOT first.** The single front-door tracker is [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (status, build queue, founder rulings, findings, progress). This file is the execution mechanics, sequence, and milestone gates it points to, not the tracker to follow day-to-day.

**Date: 2026-06-17. Status: CURRENT execution plan.** This is the *how* that pairs with the [v10 master blueprint](../strategy/v10-master-blueprint.md) (the *what/why*) and the [feature dashboard](./feature-dashboard.md) (the *live status*). v10 says what to build and in what priority; this doc says how each item is built, verified, and shipped, how lanes run in parallel, and what gate each milestone must pass.

> **Three docs, three roles, no overlap.** Blueprint = target + priority + lane ([v10](../strategy/v10-master-blueprint.md)). Implementation plan = execution mechanics + sequence + gates (this doc). Dashboard = the live cursor ([feature-dashboard](./feature-dashboard.md)). Granular ledger of acceptance criteria stays in [feature-backlog](archive/feature-backlog.md). Milestone exit criteria stay in [SOURCE-OF-TRUTH](./SOURCE-OF-TRUTH.md) (sections 2-3). Open bugs in [known-issues](./known-issues.md).

---

## 1. The per-item build loop (the discipline every item follows)

Every item, P0 to P2, runs this exact loop. No exceptions, no batching at the end.

1. **Claim.** `git pull origin main`, read the dashboard, flip the item's row to `🔨 In Dev (<tool>, date)` and add an Active-claims line; commit + push that claim *before* writing feature code (the shared-cursor rule). Pick a lane no one else holds.
2. **Spec the slice.** From v10 section 15, restate the item's What / Pain / How and write the acceptance criteria + the files you will touch into the SSOT section 0 (the live cursor) at `docs/planning/SOURCE-OF-TRUTH.md`.
3. **Schema first (if needed).** DB changes go in `supabase/migrations/` as timestamped RLS-aware SQL. Migration safety is hook-enforced. Note: the live app applies migrations on the Lovable sync; a write that depends on a new migration is read-tolerant until the sync lands (the migration-sync gate).
4. **Build the pair in lockstep.** Server logic in `src/lib/<domain>.functions.ts`; consume in the matching `src/routes/_authenticated.<domain>.tsx` via TanStack Query. New agent tools go in `src/lib/ai/tools/registry.server.ts`; new AI surfaces need a valid `CallSurface` and go through the chokepoint, never the gateway directly. Every new surface carries its greppable `Engine-Room:` stamp and obeys the calm-front doctrine.
5. **Write tests with the change.** Pure logic gets unit tests (the diff/CI/hunks engines set the bar). For the agent, the Studio prompt authors tests as part of the change (J1).
6. **Verify for real, two gates.** (a) `bunx tsc --noEmit` is the real type gate; `bun run build` strips types without checking, so a green build is not a green typecheck. (b) For UI, run `bun run dev` and verify visually; type-checking is not feature-checking.
7. **Adversarial review.** Run a code-review pass (security + correctness + the humanization gate: zero AI fingerprints in authored code and in generated output). Fix findings.
8. **Ship + close the loop.** Commit with a one-line WHY + the Co-Authored-By trailer; push. Flip the dashboard row to ✅, clear the Active-claims line, append a one-liner to `plan.md` section 4 and the linked feature doc, recompute the dashboard counts. Clear the SSOT section 0 (the live cursor) entry if the feature is complete. A change is not done until its docs are true.
9. **Capture (if it qualifies).** If a genuinely postable build insight surfaced, append it to `docs/brand-feed.md` with a capture cue. Write the session handoff to `.remember/remember.md` before ending.

**Definition of done (per item):** acceptance criteria met on *real data* (no mocks); `tsc --noEmit` clean; tested; adversarially reviewed; shipped to main; dashboard + plan.md updated; UI-verified (or flagged backend-only + deploy state, since the live app can run code older than main).

---

## 2. The sequence (sprints by priority; lanes run in parallel)

Lanes are file-disjoint (v10 section 15), so different sessions can build different lanes at once. Within a lane, build top item first.

### Sprint P0 - close the loop on real data + land the wedge
The only sprint that matters until it is done. Target: the loop closes once on a real account, and a new PM feels the wedge in 10 minutes.

| Pick | Item | Lane | Parallel-safe with | Gate it moves |
| --- | --- | --- | --- | --- |
| 1 | `LRN-02` + `W1-AUTO` (outcome reviews + auto-compound) | B | C, E | M-B (moat visible) |
| 2 | `WEDGE` (Critic-teardown first-run) | C | B, A | M-C (the felt entry) |
| 3 | `MOAT-VIS` (compounding visible) | B | C | M-B |
| 4 | `SEN-01` (2nd live source; founder registers OAuth first) | A | B, C | M-A (real data) |
| 5 | `W6` (persona onboarding) | E | A, B, C | M-C |

**Sprint P0 exit (the gate):** on a real account, a signal enters, becomes a Critic-checked decision, ships, and the outcome rescores a priority that is *visible* on Today/Brain; a brand-new user reaches a cited teardown inside 10 minutes. This is v7 milestones M-A + M-B + the start of M-C.

### Sprint P1 - monetize, defend the moat, deepen autonomy
After P0 proves the loop. `F-SHARE-TEARDOWN` + `PLG` + `M-C-PRICE` (revenue + viral), `Q1-MCP` (neutral-brain moat, pulled forward), `SANDBOX` + `AMBIENT-ARC` (full build autonomy), `SEN-05` + `F-ANALYTICS-1/2` + `MOAT-METRIC` (the outer analytical loop), `DEC-02-LOOP` + `H1-TASKS` + `H2-WRITES` (DECIDE/DEFINE depth; `DEC-02-LOOP` ✅, `H1-TASKS` ✅ recon-confirmed 2026-06-18 via `generateTaskGraph` + the `/prds/$id` task-graph card). **Exit:** first paying PMs; a share link drives a signup; a trusted agent runs a confirm-gated tool unattended; the gauntlet shows outcome-accuracy lift on a real account.

### Sprint P2 - breadth and polish
`ENG-06`, `BLD-04`, `K2`, `BLD-05`, `D4`, `P7`, `P3`, `R3`, `B5`, `FND-0.7`, `U6`, IA culls. Pull only when P0/P1 gates are green.

---

## 3. Milestone gates (proof, not dates; from v7 section 13)

- **M-A real loop, real data:** a real new user signs up and the loop closes once on their data, < 10 min. Gated by `SEN-01` + `WEDGE` + `W6`.
- **M-B moat visible + verified:** compounding memory surfaced; gauntlet reads real, rising numbers on >=1 partner. Gated by `LRN-02` + `W1-AUTO` + `MOAT-VIS` + `MOAT-METRIC`.
- **M-C monetize + viral:** first paying PMs; a decision link drives signups. Gated by `M-C-PRICE` + `F-SHARE-TEARDOWN` + `PLG`.
- **M-D dual-user + scale:** an external agent integrates (`Q1-MCP`); a team lands. 
- **The launch gauntlet (overall):** >=10 PMs paying >=$150/mo equivalent; the loop closes on a partner's real data; autonomy ticks up on a real account. Gate launch on this, not a calendar.

---

## 4. Execution detail for the first picks (so we can start now)

**Pick 1 - `LRN-02` + `W1-AUTO` (Lane B).**
- *Schema:* confirm `learnings` has predicted vs actual + verdict columns (add migration if not).
- *Server:* in `outcome.functions.ts`, a `recordOutcomeReview` that captures predicted-vs-actual, writes a Historian verdict to `learnings`, re-scores the opportunity ICE; then call `rememberOutcome` (already scaffolded in `src/lib/ai/memory.server.ts` + `outcome-memory.ts`) so the outcome embeds into `agent_memory` with `metadata.source="outcome"`.
- *Accept:* closing a decision writes a verdict + an ICE rescore, and a later mission's handoff cites that outcome memory.
- *Verify:* unit-test the review fn; on a real account, close a decision and confirm the memory is recalled.

**Pick 2 - `WEDGE` (Lane C). ✅ Shipped 2026-06-17** — detail: [`../features/wedge.md`](../features/wedge.md).
- *Server:* `runWedgeTeardown` in `discovery.functions.ts` records the feature idea as an opportunity (verbatim, neutral ICE) and runs the existing Critic (`runCritic`) inline, returning `{ opportunity, review }`. No new AI infra, no migration.
- *UI:* the Today cold-start "Start here" section leads with `WedgeTeardown` ("See why your idea might be wrong"); the verdict (Ship/Revise/Kill) renders in place with risks, kill criteria, and evidence gaps, and the idea persists as an opportunity.
- *Accept:* a new user gets a teardown in the first session, < 10 min, with no setup. (The full verdict needs the AI gateway, so it renders on the deployed app; local dev shows the honest fallback.)
- *Shipped scope note:* the Critic red-teams the idea itself; feeding the workspace's connected signals into the teardown ("with receipts" from real data) is the documented fast-follow that ties into MOAT-VIS.

**Pick 3 - `MOAT-VIS` (Lane B).**
- *Server:* extend `today.functions.ts` what-changed to name the learning that moved a priority; mirror on Brain Learnings.
- *Accept:* a rescore renders with its causing learning.

**Pick 4 - `SEN-01` (Lane A).** Founder registers one OAuth client (`F-CONN`); then a connector adapter pulls real signals into `signals` → clustering. *Accept:* a non-webhook signal clusters into an opportunity.

**Pick 5 - `W6` (Lane E).** Per-track onboarding (Solo/Founding PM/Tech Founder) with seeded sample data + a first-win that lands on the wedge. *Accept:* a signed-up PM reaches first-win without hand-holding.

---

## 5. Coordination and risk

- **Multi-tool, shared cursor.** Claude Code, Lovable, Gemini, Antigravity all commit to `main` and coordinate via the dashboard claims. Always claim the lane before building; lanes are file-disjoint by design.
- **Migration-sync gate.** The live app applies migrations on the Lovable sync; if it lags, an owner applies manually within a week. Reads are migration-tolerant; gate writes on the sync.
- **Deploy divergence.** The live app can run code older than main; verify the deployed build reflects the commit, not just the repo. Flag backend-only changes + deploy state in any UI-verification note.
- **Margin.** Agentic loops are token-heavy; keep BYOK + small-model routing + cache in mind for any new AI surface.

---

## 6. Cross-references (not an orphan)

Up: [v10 blueprint](../strategy/v10-master-blueprint.md), [v7](../strategy/v7-agentic-product-os.md)/[v8](../strategy/v8-calm-front-deep-engine.md)/[v9](../strategy/v9-decision-wedge-and-build-next.md), [session-decisions](../strategy/session-decisions.md). Sideways: [feature-dashboard](./feature-dashboard.md) (status), [feature-backlog](archive/feature-backlog.md) (granular ledger), [SOURCE-OF-TRUTH](./SOURCE-OF-TRUTH.md) (sections 2-3, milestones), [known-issues](./known-issues.md). Out: [`../../AGENTS.md`](../../AGENTS.md) section 1 (the build loop is the operational form of the pre-action protocol), [`../../plan.md`](../../plan.md) (build log), [`../../architecture/`](../../architecture/).
