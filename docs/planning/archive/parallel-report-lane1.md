# Parallel build — Lane 1 report

> Lane 1 (`parallel/lane-1`, worktree `cadence-lane-1`). Preferred: Cockpit, then Governance; roams the whole board. Driver: continuous `/loop` in this terminal. Full rules: `docs/operations/autonomous-build-loop.md` §15-16.

## 2026-06-25 (22:00) — M1/LRN-01 increment 2: Support signals UI shipped

**181/213 done (85.0% strict / 86.6% weighted).**

Built the Engine Room > Quality & insight > "Support signals" panel — closes the support→Discover feedback loop. Outcome-named per Engine-Room doctrine ("Support signals", "Recurring themes", not "triage"/"clusters").

**What shipped:** `src/components/governance/SupportSignalsPanel.tsx` (~325 lines) — paste area for support tickets, import + triage buttons, `ClusterCard` sub-component with theme/ticket-count/subjects preview and per-cluster "Reply template" toggle. Wired to existing `src/lib/support-triage.functions.ts` (list, bulkImport, runTriage, draftReply). Added "support" tab to `src/lib/engine-room-bands.ts` (quality-insight band, 13→14 tabs); updated tab test in lockstep (14 tabs, `bandForTab("support")`). Registered in `src/routes/_authenticated.govern.tsx` (TABS array + GOVERN_DESC + render switch — validateSearch auto-handles via `TABS.some()`).

**Code-review findings fixed:** (1) `r.body` → `r.reply` (DraftVerdict uses `.reply`, not `.body`); (2) dead `fmt` function removed; (3) no `dangerouslySetInnerHTML` — XSS-safe by design (all text via JSX).

**Gates:** tsc 0 · 9/9 band tests pass · code-review clean. **Commit:** `e4108cf698`. Code on origin/main.

---

## 2026-06-25 (21:00) — LANDING-PAGE-V11: public landing page shipped

**178/213 done (83.6% strict / 85.7% weighted). v11 Tier-1 front all 21 items ✅.**

Built `src/routes/index.tsx` — a standalone public route at `/` (NOT inside `_authenticated` layout). Authenticated users get a client-side redirect to `/missions` in `beforeLoad`; unauthenticated visitors see the full 5-section page (hero, three pillars, trust ledger mockup with verdict badges, what it is not, who it is for + footer). All Ember Editorial tokens; mobile-safe overflow wrapper on the ledger table.

Code-review workflow caught 3 issues; all fixed before commit: (1) title had em dash → changed to colon `"Cadence: Decision and outcome OS for product teams"`, (2) `--moss-success`/`--madder` CSS vars not defined in styles.css → replaced with `--emerald`/`--rose` (both defined), (3) ledger table not mobile-safe → added `overflowX: "auto"` wrapper + `minWidth: 480` on inner grid.

**Gates:** tsc 0 · 1541 tests pass · code-review clean. **Commits:** `d99e0e7811` (landing page) + `d2502429a6` (dashboard close). Code on origin/main.

**Board status after close:** Tier 1 = 0 (all 21 ✅). Next picks are Tier 3 (DEF-04 ◐ gated-remainder, REPO-DECLUTTER-V11 ✅) and Tier 4. `bash scripts/lane.sh next` returns exit 2 (board dry) — long-polling.

---

## 2026-06-22 (17:51) — FINAL closure of the former-Lovable monetization/credit/billing block (founder-directed)

The founder flagged this was the **3rd** re-map of Lovable's monetization work ("is it not documented properly, or not logically closed?") and ruled: close it logically + permanently, mark done where done, leave a note, never re-pick.

- **Diagnosis (the real cause):** an 8-agent adversarial verification workflow (evidence + file:line per item) confirmed every block item was build-complete or had a tiny buildable slice; the only real remainder is **founder go-live config**. They kept being re-picked for ONE mechanical reason — they sat at `◐`+Tier-1/3, which is *exactly* `lane.sh next`'s eligibility. A **logical-closure failure**, not a docs-content gap. (`lane.sh done` is pruned after 48h, so closure had to live in the register row.)
- **Built the 3 genuinely-buildable slices** (commit 48ff382cf3): **M-C-BILLING-TESTS** — extracted the top-up cap (duplicated across 2 fns, a verifier-flagged UI-vs-backend drift risk) into one pure `topUpCycleCap()` + an SQL↔TS parity guard; **WM-M18** — guarded downgrade-confirm dialog (`useConfirm` on paid→paid downgrade); **WM-M6** — verified 5-tier model live in-app + fixed the stale public-pricing comment. Adversarial review caught + fixed a self-introduced 5000→2500 cap drift before commit. Gate: tsc 0, lint clean, `bun test` 1085 pass.
- **Closed the whole block to terminal states** (commit 71f99906ce): ✅ `M-C-PRICE`/`WM-M3`/`WM-M13`/`WM-M15` (+ the 3 above); Gated 👤 `WM-M9` (chokepoint), `WM-M17`/`WM-M19` (founder numbers). Authoritative 🔒 do-not-re-pick banners in the dashboard At-a-glance, SSOT §0, AGENTS.md §3; session-decisions entry. `lane.sh done` on all 7 ✅.
- **Reconciled by-priority Done to ✅** (commit 18e8518aed, founder TASK 2): re-ran `rerank-dashboard.py` (its `classify()` maps ✅→Done) so by-priority **Done = 132 == ✅ status = 132** (was 81 vs 125). Emptied the dead `Lovable` set in the script. New tally: **179 rows; strict 132/179 = 73.7%, weighted 144.38/179 = 80.7%**.
- **Net:** the monetization/credit/billing/admin block is build-complete + gate-green and will NEVER re-surface in `lane.sh next` (no item is `◐`+Tier-1/3 anymore). The only open monetization work is the founder's, in SSOT §4. **Breadcrumb:** Settings → Plan (downgrade confirm) · `/pricing` · Settings → Credits.

## 2026-06-22 (15:57) — DBR-3e: decision precedent cited in chat/Ask

The 5th "value at every step" moment — the brain now volunteers DECISION precedent IN CONVERSATION.
- One file (`src/routes/api/chat.ts`): a fail-safe block loads `loadDecisionPrecedent` for the user's message and pushes a `formatDecisionPrecedent` block into the chat answer's `systemParts`, so the assistant grounds in the workspace's own outcome history ("you shipped a similar bet and it missed").
- **Adversarial review (code-reviewer) on the live chat route = SHIP_WITH_FIXES; folded all 3:** verdict tags flagged as labels not `[n]` citations; added the passive-text/no-injection rider; a min-length floor (>= 4 words) so trivial messages skip the embed.
- **Gates:** tsc 0 · `bun test` 1064/1064 · eslint + prettier clean. Collision-safe (chat.ts not chokepoint-pinned).
- **◐ render-on-publish**, byte-identical until the workspace has outcome memories. Four of the five "value at every step" moments are now live (Critic, nudge, currency banner, chat). **Breadcrumb:** any chat (Ask) conversation on a decision question.

---

## 2026-06-22 (15:39) — DBR-3d: decision-currency banner (flag the VIEWED decision)

Governing-decision (3a/3b/3c) flagged stale PRECEDENTS; this flags the decision you're VIEWING if IT has been superseded/contradicted — so you never unknowingly act on a stale decision.
- New `getDecisionCurrency` server fn (resolves the viewed entity's own currency via the shared `resolveGoverningForNodes`) + a fail-safe `DecisionCurrencyBanner` above the precedent nudge on the opportunity detail + PRD page ("superseded by 'X'. Act on the current one, not this.").
- **Self-reviewed** (glue on already-reviewed engine); folded a real UI copy bug (double "by"). No new test (reuses the 32 governing tests).
- **Gates:** tsc 0 · `bun test` 1064/1064 · eslint clean on my files (1 pre-existing PRD-page warning, not mine) · prettier clean. Collision-safe (only CHOKEPOINT was claimed).
- **◐ render-on-publish**, byte-identical until the entity is graph-marked stale. **Breadcrumb:** opportunity detail / PRD page → banner above the nudge.

---

## 2026-06-22 (15:25) — DBR-3c: NAME the governing decision

Completes "return the governing DECISION, not the nearest text": the Critic block + precedent nudge now NAME the replacement by title ("replaced by 'New checkout flow'"), not an opaque id.
- Optional `governingTitle` on `GoverningDecisionItem`; fail-safe server resolver `attachGoverningTitles` (batch `prds`/`opportunities` lookup, RLS-scoped, zero query when no stale items) threaded through `resolveGoverningForNodes` → both surfaces get titles with **no `critic.server.ts` change**. +1 test (32).
- **Self-reviewed** (additive on already-reviewed code); table/column names confirmed by existing call sites; folded a real tsc fix (Supabase builder is `PromiseLike`, not `Promise`).
- **Gates:** tsc 0 · `bun test` 1059/1059 (+1) · eslint + prettier clean (5 files). Collision-safe (disjoint from Lane 2's `knowledge-graph-view.*`).
- **Context:** the moat is now armed live (founder published the migration; Lane 2's DB-backed flag), so DBR-3a/3b/3c light up automatically as edges accrue once THIS build publishes. **◐ render-on-publish.**

---

## 2026-06-22 (15:10) — DBR-3b: governing-decision on the proactive precedent nudge

Continuing "go deeper now". DBR-3a put governing-decision in the Critic; **DBR-3b extends it to the proactive precedent nudge** so a stale precedent is flagged the moment the brain surfaces it.
- Extracted the closure loader to a reusable `src/lib/ai/governing-decision.server.ts` (`resolveGoverningForNodes`); refactored `runCritic` onto it (DRY, behavior-preserved).
- `getDecisionPrecedent` annotates each precedent with its governing decision; `PrecedentNudge.tsx` flags "Superseded/Contradicted" inline. Pure `findGoverningFor` (+4 tests → 31).
- **Adversarial review (code-reviewer) = SHIP_WITH_FIXES, all 3 folded:** skip a redundant query; **fixed a silent frontier truncation** (`.slice(0,50)` → chunked + 500-node cap); documented prd-first single-match.
- **Gates:** tsc 0 · `bun test` 1034/1034 (+4) · eslint + prettier clean (6 files). Collision-safe (disjoint from Lane 2's `supersession.*`).
- **◐ not ✅:** dormant + byte-identical until publish + `DECISION_BRAIN_SUPERSESSION` on. **Breadcrumb:** opportunity detail / PRD page → Precedent nudge.

---

## 2026-06-22 (14:45) — Decision Brain depth: DBR-3a governing-decision retrieval (founder "go deeper now")

**Directive (founder, this run):** run the autonomous loop; start with core USP / moat / foundational items; surface where founder input is genuinely needed. The #1 item is the Decision Brain; its autonomous increments are all shipped-but-dormant and the next depth was founder-parked "enrichment," so that fork was surfaced with 3 options. Founder chose **"go deeper now."**

**Shipped ◐ — DBR-3a governing-decision retrieval** (the moat's "current belief, not the similar old one"):
- NEW pure `src/lib/ai/governing-decision.ts` — `resolveGoverning` (supersedes-chain walk, current-only, cycle-guarded), `selectGoverningDecisions`, `formatGoverningDecisions`, `nextSupersessionFrontier`; **27 unit tests**.
- DRIVEN into `runCritic` (`critic.server.ts`) via a bounded fail-safe forward-closure loader (`loadSupersedesClosure`) so the chain reaches the TRUE current decision, then a corrective "Governing decision" prompt block (distinct from DBR-2, which only lists edges).
- **3-lens adversarial review (ultracode) = SHIP_WITH_FIXES;** the one cross-lens should-fix (similarity-bounded edges truncated multi-hop → could name a stale intermediate as "current") was **fixed at root** with the closure loader + a loop-simulation test.
- **Gates:** tsc 0 · `bun test` 1030/1030 (+5) · eslint clean (3 files). Build stays red locally (node 20.9 < 20.19, pre-existing) → offline gates only.
- **◐ not ✅:** dormant + byte-identical until the founder publishes (applies the DBR-1.5 migration) + flips `DECISION_BRAIN_SUPERSESSION`; the live Critic-cites-a-governing-decision path verifies then.

**Also this cycle:** cleared two stale prettier-only files from the tree (`NotificationsTab`, `billing-webhook`) as a standalone style commit so the lane started clean. **Collision-safe:** Lane 2 concurrently built `supersession-confidence` (disjoint globs).

**Pending founder publish-verify:** open the Critic on an opportunity/spec after publishing + flag-on + a seeded supersession edge; confirm the verdict cites the current governing decision over the superseded match.

**Next DBR-3 (autonomous):** richer typed-edge auto-extraction (`validates`/`cites`/`depends-on`). **Founder-gated:** the deep-graph enrichment (storage crossover, viz-at-scale, ambient aggressiveness).

---

## 2026-06-22 — Founder partial-closure cruise (live-verify on the published app)

**Directive (founder, this session):** cruise the partial (`◐`) items one by one; if a partial needs building (incl. frontend + wiring) build it fully; do not punt "Lovable" items to Lovable — pick them up and close them; logically/live test, mark ✅ in the dashboard + registry with proper docs; stay collision-safe with the other live session.

**Key enabler:** the published app at `https://cadence-flow-beta.lovable.app` is **current with `origin/main`** (the deploy screenshot is at the HEAD commit), so each `◐` was verified against **real production data** (demo account `demo@redcadence.app`) via Playwright + Supabase/Lovable SQL + direct HTTP — not just unit mocks. Local build stays red (node 20.9 < 20.19), so offline gates = `bunx tsc --noEmit` + `bun test`.

### Closed → ✅ (12 items, each pushed to main individually)

| Item | Register | How verified live |
| --- | --- | --- |
| APP-HEALTH | #50 | `curl /api/public/health` → 200 `{status:ok, checks:{worker:ok,database:ok}}` |
| SUBPROC-DISCLOSURE | #49 | public `/subprocessors` SSR registry (infra + catalog-derived model providers) |
| EVAL-COVERAGE | #52 | `/govern?tab=evals` coverage chips + one-click guard opens pre-targeted form |
| RELIABILITY-SLO | #55 | Missions glance "86.42%" = exact live 7d `ok/(ok+error)` **+ success-synonym code fix** |
| RELIABILITY-GLANCE | #53 | "Heads up · AI error budget spent" fires correctly (budget exhausted) |
| RUNAWAY-DETECT | #54 | glance popover "No spinning missions detected" (correct vs 21 live missions) |
| RUNAWAY-INCIDENTS | #29 | Engine Room → Incidents renders live (2 real `execution` incidents) |
| ENG-06 | #32 | Analytics "COST PER OUTCOME $0.0039" + per-agent/per-model roll-up |
| F3 | #34 | Lumen signals feed renders real Scout-clustered themes (conf 82/91/74) |
| U6 | #44 | clicked Download → real 483 KB RLS-scoped JSON (counts match demo seed exactly) |
| LRN-04 | #39 | mission detail "COMPOUNDING · 8 prior memories" (consult) + "FILES THIS AS A DECISION" (write) |
| FND-0.5 | #46 | Tool-reach selector live on every agent; migration applied (live DB); enforcement wired (`loop.server.ts` `capToolsByRisk` :259/:926) |

**One real code fix (RELIABILITY-SLO):** live 30-day data showed `normalizeStatus` counted 17 seed `success` rows as errors (75.66% vs true 84.66%). Fixed `src/lib/reliability/slo.ts` to recognize success-synonyms as `ok` (fail-visible preserved for genuinely-unknown), +1 regression test; reliability suite 57 pass, tsc 0; proven on live data.

### Findings handed to the founder (not mine to close)
- **Credit/billing UI is live in Stripe test mode** (pricing tiers, plan "Active · renews Jul 21", Credits balance/grant/top-ups/caps/attribution) — but **Metering is OFF** ("Metering is off while we finish the credits rollout"). The credit **debit engine** (WM-M12) is dormant behind that one flag. Flipping metering is a **founder action** and is the single gate to the credit engine going live.
- The Lovable-owned billing items (WM-M6/M16/M18/M-C-PRICE-SYNC, etc.) are mid-flight in the live Lovable builder; their remainders are genuine Lovable-build or founder-flag, documented rather than over-flipped.

### Next buildable slices (collision-safe, for the continued loop)
- **D4b** — rich side-by-side checkpoint-diff (original vs replay) on `/missions/$id`; cancellation + replay-and-branch already shipped + live-verified. Files: `missions.$missionId.tsx` + a new component + `missions.functions.ts` (none chokepoint-pinned).
- Avoid: chokepoint AI core (`runtime/loop/registry/cache/memory.server.ts`, pinned), Lane 2's L2/announcements/`p.$slug` + tenancy/workspace area.

### Collision notes
- One rebase conflict resolved cleanly (kept Lane 2's AMBIENT-ARC ✅ + my ENG-06 ✅).
- Every close: ledger `claim` → flip own row → commit explicit paths + WHY → ff-push → `done`-mark.

## Cycle (2026-06-24, autonomous loop) — TEST-SEED ✅
- **TEST-SEED (v11 #1, Tier 1 Foundational)** — minimal deterministic dev/test seed. New migration `20260624030000_test_seed_dev_surfaces.sql`: per demo account, one closed outcome→supersession→governing-decision loop (2 opps, 2 decisions, 16 learnings cohort, 16 memory rows, 3 lineage edges incl. live `supersedes` + bitemporal retired). Schema verified live via Lovable MCP; applied + verified live (supersedes 0→1, memory-depth lift now computes ~55-63 pts, Trust Ledger/memory/provenance render). Idempotent (sentinel), demo-scoped, lint-clean. `lane.sh done TEST-SEED`.

## Cycle (2026-06-24, autonomous loop) — AMBIENT-SENSE ◐
- **AMBIENT-SENSE (v11 #3, Tier 1 Sense)** — sensing front-half feeding cluster-tick. New pure tagger `src/lib/sensing/normalize.ts` (13 tests) + `sense-tick` cron (mirrors cluster-tick) + migration `20260624040000_ambient_sense.sql` (auto_sense flag, applied live via Lovable). Rule-based, zero AI spend, off-by-default. Adversarial fix: workspace-scoped. Route-tree + supabase types hand-registered (node20 blocks the vite generator). Gate: tsc 0, 1214 tests, lint clean. ◐ + `lane.sh done`; remainder founder-gated (real source, cron schedule, AI enrichment).

## Cycle (2026-06-24, autonomous loop) — AMBIENT-TRIGGER ◐
- **AMBIENT-TRIGGER (v11 #4, Tier 1 Sense)** — self-driving policy layer. Pure `src/lib/sensing/trigger.ts` (`evaluateTriggers`, 10 tests) + `trigger-tick` cron: self-originates `proposed` missions (zero spend, resume-runs ignores them = reversibility gate) + Trust-Ledger `decisions` receipts when clusters/outcomes cross a threshold. Migration `20260624050000_ambient_trigger.sql` (auto_trigger flag, applied live; demo input verified 6 clusters/8 missed). tsc 0, 1238 tests, lint clean. Route+types hand-registered. ◐ + `lane.sh done`; remainder founder-gated (cron, execution/promotion, competitor source).

## 2026-06-25 — INTEROP-V11 Q2 governed inbound WRITE (founder-lifted gate)

Founder lifted the Q2 scopes/audit gate ("pick up the founder-gated items"). Built the outward GOVERNED WRITE surface, dormant + reversible:
- Migration `20260625140000`: `mcp_tokens.scopes text[]`, `interop_write_enabled()` (default false) + `admin_set_interop_write_enabled` (admin-gated), `issue_mcp_token` +`_scopes`.
- `ingest_signal` write tool reusing the LIVE signals insert + the `screenIngestText` injection screen (verified prod schema, so no append_decision-style drift).
- Two locks: per-token `write:signal` scope AND the global dormant gate; `tools/list` scope-filtered; `tools/call` re-checks (defence in depth); legacy flat path can't write; gate fails closed; every attempt audited.
- A2A card advertises the governed `discovery.ingest_signal` skill honestly.
- Gate: tsc 0; 77 MCP tests pass (new mcp.functions.test.ts + 14 protocol tests). `bun run build` not used as gate (known node20/ESM lovable-tagger failure in lane worktrees).
- Remaining (founder): apply migration on publish, mint a write-scoped token, flip `admin_set_interop_write_enabled(true)`.

### 2026-06-25 (cont.) — INTEROP-V11 Q2 VALIDATED + closed properly (founder pushback)

Founder challenged: don't mark ✅ just because asked — validate it works. Did:
- Applied migration `20260625140000` to the LIVE prod DB via Lovable MCP; verified objects (scopes col, gate fns, issue_mcp_token single 6-arg overload).
- Functionally round-tripped on real Postgres: gate read false→true→false; token mint persists scopes=['write:signal']; the exact ingestSignal signals insert lands with content-fallback. Cleaned up (DB dormant, 0 tokens).
- Full suite green: bun test 1490/0, tsc 0; 3-lens adversarial security review clean (authz/tenant/injection) + 2 fail-mode fixes folded.
- CAUGHT A REAL GAP checking the published hub: main had the ✅ flag but NOT the Q2 code (it lived only on parallel/lane-1) → published hub couldn't have the feature. Landed the actual code + migration on origin/main (overlay of the 8 feature files onto main, tsc+72 MCP tests green, pushed). Main now consistent: code + migration + ✅.
- Remaining = founder PUBLISH only (live worker still on pre-Q2 build 4f4dc478). After publish: mint a write:signal token + admin_set_interop_write_enabled(true) to activate; dormant + read-only until then.

### 2026-06-25 (cont.) — board dry → long-polling

`bash scripts/lane.sh next` = exit 2 (BOARD DRY). State: every Tier-1/Tier-3 ⬜/◐ autonomous item is done or claimed — SEC-INGEST-INJECTION ✅, INTEROP-V11 ✅ (this session, live-validated + on main), DBR (H1) held by lane 2 (DBR-4 MCP/A2A, on the mcp.* files), M1 👤 Gated (founder), CHOKEPOINT pinned. Remaining work is founder-gated (needs a key / OAuth / provider / chokepoint edit / taste call) or dormant-low-value (M1's project_id triage slice fires on no live caller). Both this session's features (INTEROP-V11 Q2 + lane-2 DBR-3i) + the land-on-main standing rule are on `origin/main`; lane↔main at 0 delta; nothing dangling. Long-polling ~25 min for a new row / released claim / founder push. Founder next action: publish `main` (deploys INTEROP-V11 Q2 + DBR-3i; the Q2 migration is already applied + dormant) + the gated activations.

### 2026-06-25 (new session) — board dry confirmed, long-polling

New session started. `bash scripts/lane.sh next` = exit 2 (BOARD DRY). Re-verified: all Tier-1/Tier-3 open items are Gated/Deferred/Parked. No new rows in the dashboard since last session. State: lane-1 branch is 0 commits ahead/behind origin/main after rebase. Remaining founder-gated actions: SANDBOX provider pick, BLD-04 OPENHANDS_ENDPOINT + key, FIRECRAWL-FLOOR SearXNG deploy, Stripe live keys, DBR_ENTITY_ALIASING wrangler secret (already activated per dashboard), EMBED-CHOKEPOINT attended session. Long-polling ~25 min.
