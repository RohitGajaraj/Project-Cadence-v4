# Parallel build — Lane 2 report

> Lane 2 of the numbered parallel build (`parallel/lane-2`, worktree `cadence-lane-2`). Identity is the lane NUMBER, not a theme; picks the highest-RANKED free item via `bash scripts/lane.sh next`. Per-cycle loop + rules: [`../../operations/autonomous-build-loop.md`](../../operations/autonomous-build-loop.md) §15-16; lane-local config: `.remember/LANE.md` (git-ignored). This file is the run log; the master status board is [`../feature-dashboard.md`](../feature-dashboard.md).

---

## 2026-06-22 — DBR-3f: shared-premise precedent (DBR multi-hop, graph-over-vectors)

**Picked:** `DBR (H1)` (`lane.sh next` rank 3; ranks 1-2 WM-M15/WM-M9 are chokepoint-pinned / attended → skipped inline). Claimed the register row atomically and **held** it for the increment.

**Shipped (◐ dormant-correct):** the multi-hop graph-over-vectors query the decision-brain evidence table names but had never been built — "what happened the last time a decision rested on the SAME upstream premise as this one?" Walks the DERIVATION graph UP to the decision's premise ancestors, then back DOWN to their other descendants (cousins sharing a premise off the target's own path), and reports each cousin PRD's recorded outcome (missed-first). Distinct from DBR-2/3, which walk the supersedes/contradicts reversal edges.

- New PURE `src/lib/ai/shared-premise.ts` (two-directional walk + outcome-ranked selection + Critic block; 21 tests incl. a depth-complete subtree-exclusion regression).
- New `src/lib/ai/shared-premise.server.ts` (two bounded, fail-safe BFS closures via one column-parameterized helper + a `prds.outcome` join).
- Wired an independent fail-safe `sharedPremise` block + guidance into `runCritic` (`src/lib/ai/critic.server.ts`).

**Adversarial review:** 3-lens Workflow (correctness / runtime-safety / over-claim) = **unanimous SHIP, 0 blockers, 0 must-fix.** Folded 3 cheap real improvements: depth-complete subtree exclusion; honesty-softened block framing; symmetric `.limit` on the outcomes query. Tenancy proven clean (user_id-filtered closures; RLS-scoped `prds` read; UUID-gated ids).

**Gate:** tsc 0 / 21 shared-premise tests / **1102 full suite** / no em/en-dash in generated strings. Byte-identical + fail-safe until derivation edges + recorded outcomes both exist.

**State:** committed + fast-forward pushed to `origin/main`. `DBR (H1)` claim **HELD** (heartbeat) for the next increment (next: extend the same resolver to the proactive precedent nudge, mirroring DBR-3b's Critic → nudge fan-out). Docs: `decision-brain.md` (DBR-3f), dashboard row (Increment 8), `plan.md` §4.

## 2026-06-22 — DBR-3g: shared-premise precedent on the proactive nudge (Critic → nudge fan-out)

Second increment on the held DBR umbrella. Extended DBR-3f's resolver from the Critic to the PROACTIVE nudge ("value before you ask"), mirroring DBR-3b.

- Refactored `src/lib/ai/shared-premise.server.ts` → structured `resolveSharedPremiseItems` (the Critic formatter is now a thin wrapper, behavior-preserved).
- New `src/lib/shared-premise.functions.ts` (`getSharedPremisePrecedent`, RLS-scoped, fail-safe) + new `src/components/decision/SharedPremiseNudge.tsx` (mirror of PrecedentNudge; shows decisions built on the SAME upstream premise), mounted on `OpportunityDetail.tsx` + `_authenticated.prds.$id.tsx`.
- Extended the held DBR ledger claim's globs to cover the new + touched files (cross-lane reservation).

**Review:** focused code-review (feature-dev:code-reviewer) = **SHIP_WITH_FIXES** — refactor confirmed behavior-preserving, RLS clean, dormant-safe; folded both must-fixes (null-summary trailing-colon render; `enabled: !!targetId` guard).

**Gate:** tsc 0 / **1110 full suite** / no em/en-dash in UI copy. Renders nothing until derivation edges + outcomes exist.

**State:** committed + FF-pushed to `origin/main`. `DBR (H1)` claim still **HELD**. IA note: three decision asides now stack on these surfaces (precedent / shared-premise / currency) — flagged as a candidate for the founder-prompted IA-consolidation pass.

## 2026-06-22 — DBR-3h: name the shared premise (felt-voice completion)

Third increment on the held DBR umbrella. The shared-premise precedent now names WHICH premise two decisions share ("the same opportunity 'Mobile checkout revamp'") instead of "the same ground".

- `collectSharedPremiseCousins` additively tracks premise provenance (a `seedOf` map; BFS first-reach from all ancestors = the closest common ancestor / LCA → the most-specific shared premise). Existing DBR-3f tests stayed green (additive fields).
- New fail-safe, `user_id`-scoped `attachPremiseTitles` resolves the premise title per kind; `formatSharedPremisePrecedent` + `SharedPremiseNudge` name it, generic fallback when unresolved.

**Review:** focused code-review = **SHIP_WITH_FIXES** — LCA provenance confirmed correct + dormant-safe; folded both (defense-in-depth `user_id` on title queries; deterministic `ancestorKind` preferring the node's own `child_kind`).

**Gate:** tsc 0 / **1113 full suite** / +3 tests (24 in the file) / no em/en-dash. Byte-identical / generic phrasing until premise titles resolve.

**State:** committed + FF-pushed to `origin/main`. `DBR (H1)` claim still **HELD** (shared-premise feature now complete across Critic + nudge + named premise).

## 2026-06-22 — lane.sh slash-id fix (unblock claiming slash-named register items)

Before building, the claim of `M1 / LRN-01` returned a false `HELD`: the atomic mutex `mkdir "$CLAIMS/$id"` splits on the `/` into a nonexistent nested path, so it failed and was misread as "held" — every slash-named register item (`M1 / LRN-01`, `LCH-01 / L1`) was permanently unclaimable. Fix: one `_cdir()` helper replacing ONLY `/` (every existing id stays byte-identical), routed through all 7 CLAIMS/DONE path sites; logical id kept in `meta id=`. +2 regression tests (`scripts/lane.test.sh` 11/11, was 9/9). Committed + pushed. Files: `scripts/lane.sh`, `scripts/lane.test.sh`.

## 2026-06-22 — M1 / LRN-01: Support triage loop, increment 1 (autonomous core)

**Picked:** `M1 / LRN-01` (Support triage) — the founder's constraint this run was "untouched items only, start from zero, no AI chokepoint / Stripe / BYO keys." Of all 18 `⬜` rows it was the ONLY one not Gated/Deferred/chokepoint; the rerank put it at #2. Claimed the register row and **held** it for the increment.

**Shipped (◐ dormant-correct, never touches the AI chokepoint):** the loop "tickets → recurring clusters → Discover signals," server + engine only.
- `support_tickets` table (workspace-scoped, RLS via `is_workspace_member`; migration `20260622090000`, forward-only, applies on the founder's next publish).
- PURE `src/lib/support/triage.ts` — Unicode-aware tokenizer + **greedy-leader clustering against each cluster's common core** + signal-payload shaping (deterministic, 24 tests).
- `src/lib/support/draft.ts` — deterministic humanized template reply (works with no AI) + a dormant `DraftProvider` seam for the founder-gated AI layer (routes through an EXISTING `CallSurface` when wired; no new surface).
- `src/lib/support-triage.functions.ts` — add/bulk/list tickets, `runSupportTriage` (emits each recurring cluster as a `source='support-triage'` signal → feeds Discover), `listSupportClusters`, `draftSupportReply`.

**Adversarial review:** two reviewers (runtime-fatal + clustering-logic). Runtime: **no fatal bugs** — columns/RLS/call-shapes clean, verified against the LIVE DB (`signals` insert columns + FK/helper targets all exist; `support_tickets` correctly absent in prod = dormant). Logic: determinism exhaustively sound, but a **HIGH** false-positive — single-link union-find welds two unrelated themes via one broad "bridge" ticket. **Folded every real fix before commit:** greedy-leader-against-the-core (kills the bridge merge + a long-ticket false-negative), Unicode-folding tokenizer, hardened `clusterKey` (top-6, no collision); +5 regression tests.

**Gate:** tsc 0 / eslint 0 (5 files) / 33 support tests / **1146 full suite** / no em/en-dash in generated strings.

**State:** committed + FF-pushed to `origin/main` (`f42e383846..c476c27c95`). `M1 / LRN-01` is **`done`-marked** (◐): the autonomous core is complete and NO further autonomous slice remains — all three remainders need the founder (UI-surface PLACEMENT is a taste/IA call; inbound channel = connector OAuth + spend; AI-written draft = chokepoint + spend). Docs: `docs/features/m1-support-triage.md` (new), dashboard row (◐), `plan.md` §4, `session-decisions.md`.

**Board state after this cycle:** with the founder's constraint this run (untouched `⬜` only, no `◐` partials, no chokepoint / Stripe / BYO / input-needed), the autonomous pick-list is now **dry** — `lane.sh next` returns only `DBR (H1)`, which is a `◐` PARTIAL (the constraint excludes it). Surfaced to the founder for a scope decision (continue into partials / build M1's UI with a chosen placement / hold).
