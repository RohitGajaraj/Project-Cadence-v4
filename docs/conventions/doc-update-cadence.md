# Convention: documentation update cadence

> _Created: 2026-06-14 · Last updated: 2026-06-19_

> **What this is.** Which docs update continuously, which update at feature milestones, and which update only when the structure actually changes, plus the per-feature 8-step closure checklist that closes the loop on every shipped change. The point is to keep the living docs true without churning the stable architecture docs on every build. This complements the closed-doc loop in [`../../AGENTS.md`](../../AGENTS.md) section 5.
>
> **The principle.** Split docs by the rate of change of what they describe, not by document type. A feature map describes progress and changes constantly. An ERD describes structure and changes rarely. Tie each doc's update trigger to how fast its subject actually moves.

---

## The three tiers

### Tier 1, continuous (every unit of work, every session)

The live cursors, logs, and trackers. Update these in the SAME commit as the change that touched them. Never let them go stale; a stale Tier-1 doc is worse than none.

- `plan.md` section 4 (the build log): one line per shipped change.
- `docs/planning/SOURCE-OF-TRUTH.md` section 0 (the live cursor): the current Now-building and Next-up, at the start and end of every session.
- `docs/planning/feature-backlog.md`: the live status board.
- `docs/planning/known-issues.md`: bugs and blockers as they open and close.
- `docs/strategy/session-decisions.md`: every major decision or tradeoff.
- `.remember/`: session memory.

### Tier 2, per feature-milestone (when a meaningful set of features ships, not every build)

The product-facing maps and specs. Refresh these when a feature set lands or a feature's status changes (Built, Partial, Missing), at a milestone boundary (each M-0 to M-D completion) or after roughly two weeks of progress, whichever comes first. Do not rewrite them on every small build.

- `docs/strategy/v10-master-blueprint.md`: the current master blueprint (what we build, how it should look and behave, priority). See `docs/strategy/README.md` (the arbiter) for which strategy doc governs what.
- `docs/planning/v10_implementation-plan.md`: the execution order (build loop, sprints, milestone gates).
- `docs/planning/feature-dashboard.md`: the live board (status, board groups).
- `docs/features/*`: per-feature operator specs.

The refresh pass at each feature-milestone: update each feature's status on the board, refresh the blueprint and implementation plan if scope or priority moved, and re-check the execution order against the milestone gates. Add a one-line note to `plan.md` section 4 that the refresh happened.

### Tier 3, per structural change (only on a real architectural change, or as a deliberate refresh once a build settles)

The architecture and reference docs. These describe structure, not progress, so they should not change again and again. Update them only when the structure actually changes (a new table, a new service, a new integration, a new deploy target, a new threat surface), or as one deliberate refresh once a phase's build is complete.

- `architecture/diagrams.md`: the system, deployment, ERD, sequence, and state diagrams.
- `architecture/deployment.md`, `architecture/api.md`, `architecture/observability.md`, `architecture/threat-model.md`.
- the `architecture/` contracts: `runtime`, `orchestration`, `data`, `security`, `integrations`, `frontend`.
- the v7 TRD Part A (the current-architecture snapshot). Its Part B (the requirements) follows Tier 2.
- the strategy canon (`docs/strategy/vN-...`): updates only on a positioning shift (a new `vN`), per the strategy cascade rule in `docs/strategy/README.md`.

## The single source of truth for "what is next?"

Any "what are we building next?" question is answered by reading one chain, in order, so the answer is never guesswork:

1. `docs/planning/SOURCE-OF-TRUTH.md` section 0 (the live cursor): the current Now-building and Next-up. Read this first, every session.
2. `docs/planning/SOURCE-OF-TRUTH.md` section 3 (the build queue): the explicit build queue (top pick first), plus the founder pickup list, open findings, and the milestone framing folded in.
3. `docs/planning/feature-backlog.md` (the granular ledger, F-ID scope): the per-feature board with how-to-verify blocks.

The milestone gates and execution order are defined in `docs/planning/v10_implementation-plan.md`; the build/structure canon is `docs/strategy/v10-master-blueprint.md` (with `docs/strategy/README.md` as the arbiter of which strategy doc governs what). The feature statuses come from `docs/planning/feature-dashboard.md` and the granular `docs/planning/feature-backlog.md`. The tracker (the SSOT) is the synthesis layer that joins them.

Rules:
- The tracker and the cursor are Tier 1: update them in the same commit as any change that ships a feature, moves a status, or completes a milestone.
- The resolution of NEXT is mechanical: the first not-done item in the current (earliest not-done) milestone. No interpretation needed.
- Every item carries a status: Built, In progress, Next, Blocked, or Later. Nothing is left undescribed.
- So when asked "what next", any tool or session reads the cursor and the tracker and answers exactly: what is built, what is in between, what is the next pick, and why.

## The per-feature closure checklist

**Rule.** After any shipped feature or strategic decision, in the SAME turn, run this 8-step checklist. A change is not done until every step is true.

1. **Audit / feature doc** - add a "How to use / verify" block: route + nav path, what each control does, server enforcement points, verification checklist.
2. **`architecture/*.md`** - add or update the relevant contract (frontend pattern, security invariant, data shape, runtime hook).
3. **`design.md`** - add or update the token / voice / UI-contract entry if the feature touches visual or copy rules.
4. **Trackers** - update `docs/planning/SOURCE-OF-TRUTH.md` (section 0 the live cursor + section 6 progress) and the relevant board `docs/planning/feature-dashboard.md` (flip the status mark, board group), plus the granular `docs/planning/feature-backlog.md` (flip the status, update "Last updated", append a "Recent log" one-liner).
5. **`plan.md` §4** - append a dated one-liner with a clear WHY (not just WHAT).
6. **`docs/strategy/session-decisions.md`** - add an entry if a strategic decision or tradeoff was resolved.
7. **`docs/conventions/`** - write a new convention file if the learning is a durable rule. Reference it from [`../../AGENTS.md`](../../AGENTS.md) §3 if it is a hard engineering rule.
8. **Cross-links** - add a "Related" block at the bottom of any new doc.

**Optional.** Mirror to tool-private memory (`mem://`, Claude project memory, etc.) only as a _thin pointer_ (≤ 2 lines, "see `docs/conventions/<file>.md`"). Never duplicate body - that creates drift.

**Why.** The loop has historically closed at steps 4-5 and stopped, leaving contracts silent. The next session then reintroduces the exact thing the feature removed (a `confirm()`, an em dash, a settings-route-for-rename). This checklist is the antidote.

## How to apply

- Every change: update Tier 1 in the same commit. This is the existing closed-doc loop (AGENTS.md section 5).
- At each milestone (M-0 to M-D) or about every two weeks: run a Tier-2 refresh pass and log it in `plan.md` section 4.
- On a structural change: update the affected Tier-3 doc in the same commit as the code change. A new table updates the ERD and the data contract. A new route updates the API doc and the diagrams. A new deploy target updates `deployment.md`. Otherwise leave Tier-3 alone.
- A doc whose tier you are unsure of defaults to Tier 2.
- This convention is the tier registry: each doc's tier is the one listed in the three tiers above. A doc may also note its tier in its own header for visibility, but the registry here is authoritative.

## Why

Living docs (the feature set, status, known issues) lose all value the moment they go stale, so they must track every shipped change. Architecture docs (diagrams, topology, ERD) describe structure that changes rarely, so churning them every build is wasted effort and noisy diffs. Separating the two keeps both honest: the progress docs stay current, and the structure docs stay stable and trustworthy. Operator ruling, 2026-06-14.

## Related

- [`humanized-output.md`](./humanized-output.md): the zero-fingerprint voice rule.
- [`../../AGENTS.md`](../../AGENTS.md) section 5: the closed-doc loop and the cross-document update protocol (matrix view of the same idea).
- [`./README.md`](./README.md): how to add a new convention.
- [`../strategy/README.md`](../strategy/README.md): the strategy cascade rule (when the canon changes).