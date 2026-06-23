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

**Board state after this cycle:** with the founder's constraint this run (untouched `⬜` only, no `◐` partials, no chokepoint / Stripe / BYO / input-needed), the autonomous pick-list went **dry** — `lane.sh next` returns only `DBR (H1)`, a `◐` PARTIAL. **Founder decision (2026-06-22): ALLOW `◐` partials** — the loop returns to its default (continue partials), still off chokepoint / Stripe / BYO / input-needed. Next cycle resumes the loop default starting with `DBR (H1)` (Decision Brain; shared-premise is complete, so the next slice is a NEW sub-area — e.g. dormant entity-resolution v1 / guardrail #4, compute-only, no chokepoint).

## 2026-06-22 — DBR (H1): entity-resolution v1 (guardrail #4)

**Picked:** `DBR (H1)` (the only eligible item; partials now allowed). Shared-premise is complete, so this is a NEW DBR sub-area. Claimed the register row + **held** it.

**Shipped (◐ compute-only/dormant, never touches the AI chokepoint):** a pure, deterministic entity-resolution module (`src/lib/ai/entity-resolution.ts`, 24 tests) that groups decision-graph nodes naming the SAME initiative under different titles into one canonical entity, so a later increment can collapse those fragments before the supersession / shared-premise / precedent walks run (guardrail #4 — "entity resolution early, or the graph fragments"). **Precision-first:** merges only on an exact normalized-key match (surface variants) OR an explicit declared alias (codename↔description when stated); the fuzzy inference case is the founder-gated AI layer.

**Adversarial review (false-merge hunt):** caught + folded **two HIGH false-merge bugs** before commit — an over-greedy noise list ("Story editor" merged with "Editor redesign") and an ASCII-only tokenizer ("結帳 API" merged with "付款 API" on "api") — plus an `entityId` over-claim (now content-addressed from title keys, documented re-resolve-don't-persist). +5 regression tests.

**Gate:** tsc 0 / eslint 0 (2 files) / 24 entity-resolution tests / **1184 full suite** / no em/en-dash.

**State:** committed + FF-pushed to `origin/main` (`ff7fc5c695..7549f9001b`). `DBR (H1)` claim **HELD** for the next DBR slice. ◐ compute-only. Docs: `docs/features/decision-brain.md` (DBR-ENTITY-RES + guardrail #4), `plan.md` §4, `session-decisions.md`.

## 2026-06-22 — DBR (H1): entity-resolution WIRING into the shared-premise walk (flag-gated OFF)

Continued the held DBR umbrella: wired v1 into the shared-premise walk so same-initiative nodes collapse onto one canonical id and the walk connects cousins across fragments the derivation edges miss. Extended the claim globs to `src/lib/ai/shared-premise**` (disjoint).

**Shipped (◐ flag-gated OFF `DBR_ENTITY_ALIASING`, never touches the AI chokepoint):**
- pure `canonicalNodeId` (`entity-resolution.ts`) — node id → smallest member REAL id (not a synthetic `ent:` key, so id lookups still resolve).
- pure `canonicalizeEdges` (`shared-premise.ts`) — rewrites edge ids through the canonical map, kinds untouched.
- server glue in `resolveSharedPremiseItems` (`shared-premise.server.ts`) — behind the flag, loads node titles (RLS-scoped, chunked) + collapses (target, ancestors, edges) before the cousin walk.

**Adversarial review = SOUND for ship (no fatal/high).** Byte-identical when off (flag block skipped, same object refs) and when nothing collapses. Folded two mediums: chunk the title `.in()` at `IN_BATCH=25` (an over-long IN would 414 → fail-safe silent no-op on large graphs); resolve collapse PER KIND (a node never merges onto its own same-titled derived artifact). The residual same-title false-merge is by-design and is what the founder's precision review must measure before flipping the flag.

**Gate:** tsc 0 / eslint 0 (5 files) / 26 entity-resolution + 27 shared-premise tests / **1189 full suite** / no em/en-dash. **State:** committed + FF-pushed (`57a363ab8b..38968679bf`). `DBR (H1)` RELEASED (◐; my entity-res/shared-premise arc complete — remaining DBR work is cross-lane or founder-gated).

## 2026-06-22 — SEC-INGEST-INJECTION: injection screening on the support-triage trust boundary (P0)

Released DBR (arc complete) and pivoted to a fresh, self-contained security item mined from `considerations.md` #3 (P0 — "the product's defining risk": untrusted input feeding agents). Support tickets are untrusted; the triage loop turns a cluster into a Discover signal that feeds agents — the exact boundary to screen.

**Shipped (◐, reuses existing infra, never touches the AI chokepoint, no schema change):** pure `src/lib/support/screening.ts` (`injectionScreenDecision` wrapping the battle-tested `classifyInjection`/`assessCorpusInjection`) wired into `runSupportTriage` at the signal-emission boundary — a structural attack QUARANTINES the cluster (never emitted; tickets stay open + re-screened), a lexical-only override is emitted but tagged `needs-review`, ALLOW is normal.

**Key correctness property (tested):** a genuine ticket merely QUOTING an injection is NOT over-quarantined — only a real structural attack is — so it hardens the path without dropping legitimate tickets. Proportionate self-review (small change reusing a thoroughly-tested pure classifier; no new columns; the screen is driven). +7 screening tests.

**Gate:** tsc 0 / eslint 0 (3 files) / 40 support tests / **1196 full suite** / no em/en-dash. **State:** committed + FF-pushed (`38968679bf..13981698ad`); `done`-marked. `considerations.md` #3 marked PARTIALLY ADDRESSED.

## 2026-06-22 — SEC-SIGNAL-INGEST-INJECTION: screen the LIVE signal-ingest webhook (P0)

The higher-value follow-up: the dormant support path was hardened last cycle; this hardens the LIVE, EXTERNAL door. The public `api/public/ingest-signals` webhook turns any external POST into `signals` rows (token-auth, service-role insert) — a real external attack surface.

**Shipped (◐, reuses existing infra, no schema change, no chokepoint):** new GENERIC `src/lib/ingest-guardrails.ts` (`screenIngestText`, reuses the structural-gate `classifyInjection`; domain-neutral so MCP/A2A ingest can reuse it) wired into the webhook — each item's full attacker-controlled free text (title + content + source) is screened BEFORE insert; a structural attack is REJECTED (never stored), a borderline one stored with a `needs-review` tag; the response gains a `quarantined` count.

**Focused adversarial review (external attack surface) = SOUND, no fatal/high/medium.** Confirmed: the screen is on the only insert path (no bypass), the empty-rows guard is safe (rate limit charged per-request before screening, so all-quarantine floods stay metered), `tags:[]`→`'{}'` is valid, and the classifier is ReDoS-safe (bounded quantifiers + 20k cap, 50×5000 char ceiling). **Folded the one LOW finding:** the `source` field reaches the reactor's agent-visible event payload, so it is now part of the screened text.

**Gate:** tsc 0 / eslint 0 (3 files) / 5 ingest-guardrails tests / **1201 full suite** / no em/en-dash. **State:** committed + FF-pushed (`d262f521f5..9c576c3390`); `done`-marked (webhook scope complete; live-verify on publish; external MCP/A2A screen is the remaining third class). `considerations.md` #3 updated.

---

## ▶ SESSION CLOSED — 2026-06-22 night (founder: "pick up tomorrow")

Founder paused the autonomous run. **Everything committed + fast-forward pushed to `origin/main`; tree clean, 0 ahead/0 behind; no ledger claims held** (DBR released, both SEC items done-marked). To resume: re-invoke `/overnight-build`.

**This session shipped 7 commits to `main`** (all gate-green + adversarially reviewed + documented): the `lane.sh` slash-id harness fix; M1 Support-triage core; DBR entity-resolution v1; the entity-resolution → shared-premise wiring (flag-gated OFF); and two P0 injection screens (support-triage boundary + the live signal-ingest webhook) — which together close considerations #3 for every non-chokepoint path. Suite grew **1113 → 1201** tests. Never touched the AI chokepoint / Stripe / BYO.

**WHY HOLDED:** the clean autonomous backlog within the founder's constraints (no chokepoint / Stripe / BYO / input-needed) is verifiably exhausted — the board's only eligible row (`DBR (H1)`) has only cross-lane (Lane 1's files) or founder-gated work left; the last injection surface (MCP/A2A) is in the chokepoint.

**WHERE TO PICK UP (founder-gated, the founder's call):** (a) flip `DBR_ENTITY_ALIASING` after a precision review on real data; (b) connect a support inbound channel + make the M1 `/support` UI-placement call; (c) decide on chokepoint work (MCP/A2A screen, WM-M9) and/or cross-lane DBR wiring; (d) the queued founder activations (Stripe go-live, `credits_enabled()`/`AI_COST_ROUTING`, `DECISION_BRAIN_SUPERSESSION`); (e) the one-time §14 design pass when the product is final. Canonical pickup note: `SOURCE-OF-TRUTH.md` §0 (the SESSION CLOSED note at the top); full per-commit detail: `plan.md` §4 (2026-06-22 entries).

---

## ▶ SESSION RESUMED — 2026-06-24 (continuous lane loop, autonomous)

### Cycle 1 · EVENT-REACTOR-LIVE (#2) → ◐ verified-built + retired (`done`)

Claimed EVENT-REACTOR-LIVE (lane 2); TEST-SEED (#1) skipped (held by lane 1). **Finding (live-audited via Lovable MCP vs prod `371dd588…`): the reactor is NOT unbuilt — it is already wired + scheduled end to end.** Emit = 3 `*_reactor_fanout` triggers + 12 enabled default subscriptions (path-agnostic `AFTER INSERT`, so every write path already fans out — no non-redundant TS emit to add). Consume = `event-reactor-tick` pg_cron, `active`, `* * * * *`, with KI-27/28 hardening in-handler. It is cold only for INPUT volume (`event_queue` = 1 all-time row, an `opportunity.scored`/`confirm` event correctly awaiting an operator) — a data gap owned by TEST-SEED/AMBIENT-SENSE, not a code gap.

**Prod gap surfaced → KI-38 (founder republish):** live `event_queue` lacks `attempt_count`/`next_attempt_at` (`ki27_cols_present=0`), so KI-27's migration `20260620220500` was never applied to Lovable's DB despite KI-27 being marked RESOLVED (its note records only a `BEGIN..ROLLBACK` dry-run). The deployed consume-tick `.select`s those columns → any `auto` (`signal.created`) dispatch will error until a republish applies them.

**No clean migration-free, non-redundant CODE slice exists** for this row right now (trigger emit already covers everything; new event types need a blocked migration; republish is founder-gated). So: documented the verified architecture + gap in `f-agent-3-event-reactor.md`, logged KI-38, re-scoped the dashboard row ⬜→◐, and `lane.sh done`-retired it from the auto-picker. **No feature code shipped (correct: shipping redundant emit code would be dead code).** Remaining = (a) founder republish [KI-38, gated]; (b) new event types [migration, blocked while a migration lane holds the `supabase/migrations` prefix lock]; (c) live proof [overlaps LOOP-PROVE]. Gate: doc-only, tree clean. Next: pick the next ranked unclaimed item.

### Cycle 2 · TRUST-LEDGER (#6) → ✅ built + gate-green

Skipped #3 AMBIENT-SENSE (wire cluster-tick to scheduler = pg_cron migration, blocked by lane 1's migration lock), #4 AMBIENT-TRIGGER (new event types = migration + needs AMBIENT-SENSE), #5 LOOP-PROVE (needs lane 1's not-yet-landed TEST-SEED seed) — all readably blocked. Roamed to #6 TRUST-LEDGER, the highest-ranked migration-free strong build.

**Shipped (net-new, no schema change, no chokepoint):** `/trust-ledger` authenticated surface (sidebar Trust row) rendering every decision + decided autonomous action as a receipt — what/why/evidence/who-approved+when/standing-or-superseded — with kind+outcome+search filters. Server fn `listTrustReceipts` composes workspace-scoped `decisions` + `agent_approvals` + the bitemporal `artifact_lineage` graph (supersession via active `supersedes`/`contradicts` child edges; evidence counts; source-label hydration). Pure composition helpers unit-tested (14 tests).

**Adversarial review (ecc:typescript-reviewer) — 1 real bug folded + 2 hardening:** counts computed post-filter+limit (lied with a filter on) → now from the full kind+search scope; `summarizeAction` subject length-capped; `relTime` null-guarded. **Cleared via live Lovable-MCP check:** `decisions`/`agent_approvals`/`artifact_lineage` SELECT policies are all `is_workspace_member(...)` → no tenant leak from a caller-supplied `workspaceId`, cross-member supersession visible; `args`→title is render-escaped (no XSS).

**Route registration:** hand-added to `src/routeTree.gen.ts` (the TanStack generator runs only on dev/build, both RED in lane worktrees on the pre-existing Node-20/ESM lovable-tagger issue; Lovable regenerates on the next real build). **Gate:** tsc 0 / 1215 tests green. **State:** committed + FF-pushed; `done`-marked. Remaining (separate items): a "proven-right" outcome (LOOP-PROVE), richer render (DEMO-SEED-RICH), live-verify on publish. Files: `src/lib/trust-ledger.{functions,test}.ts`, `src/routes/_authenticated.trust-ledger.tsx`, `src/components/cadence/AppShell.tsx`, `src/routeTree.gen.ts`, `docs/features/trust-ledger.md`, dashboard, plan.
