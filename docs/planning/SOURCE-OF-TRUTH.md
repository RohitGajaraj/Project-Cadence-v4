# Cadence, Single Source of Truth (SSOT)

> **Founder: this is the ONE file to read.** Status, what we are building, what is deferred to you, findings, and progress all live here. Everything else (the feature dashboard, the build report, the strategy docs) is detail this file points to. The autonomous build loop keeps this file current every cycle.
>
> **Last updated:** 2026-06-18 (cycle 24: K2 operator revert-to-revision). **Maintainer:** the autonomous build loop, every cycle.

---

## 1. Standing instructions (founder rulings, durable, do not re-ask)

These are permanent operating rules. The loop follows them without being reminded.

1. **Build everything buildable WITHOUT founder input FIRST, migrations included.** Close every autonomous loop before anything that needs the founder. A database migration that needs no taste/secret/spend/account decision is fair game (gate it offline, flag it for publish-verify). _(Founder ruling 2026-06-18.)_
2. **The design / UX-polish pass is LAST, and done ONCE.** Only on the finalized product. It is not a repeated activity, do not redo design again and again and burn tokens/time. Do not run it until the foundation is built and the founder says the product is final. _(Founder ruling 2026-06-18.)_
3. **Founder-gated work comes AFTER the autonomous foundation.** Taste / positioning / product-tasting, secrets, OAuth registration, infra/sandbox picks, recurring AI spend, the founder's accounts, outbound sending, anything irreversible/outward-facing. The loop keeps a clean pickup list (section 4) and never does these unilaterally. _(Standing.)_
4. **Cross-reference the canon before claiming scope.** Never call the backlog "thin" or "done" from a narrow scan. Read v10 blueprint → v10 implementation plan → this file → the dashboard → v9 → v8 → `considerations.md` (cross-cutting gaps the dashboard omits) → the code, and verify built-vs-pending against `src/`. _(Founder ruling 2026-06-18, after a too-quick "thin backlog" call was disproven.)_
5. **Context authority.** The loop may compact / clear / roll its own context whenever it is heavy, on its own judgement, and note the roll in the handoff (`.remember/remember.md`). Roll only at clean boundaries between items, never mid-build. _(Founder ruling 2026-06-18.)_
6. **This file is the single source of truth.** Reconcile new status, decisions, deferrals, findings, and progress HERE. If a tracking file becomes redundant, fold it in and remove it. _(Founder ruling 2026-06-18.)_
7. **The non-negotiables that already governed the loop still hold:** never self-pause/idle (only a real usage limit pauses, with a sub-5-min recheck); only the founder ends the run; humanized output (no em/en dashes in anything authored or generated); gate every change on `tsc --noEmit` + `bun run build` + lint + adversarial review; commit explicit paths with a WHY; work in the worktree and fast-forward push to `main`. Full operating manual: [`../../AGENTS.md`](../../AGENTS.md); loop playbook: [`../operations/autonomous-build-loop.md`](../operations/autonomous-build-loop.md).

---

## 2. Current status (where the product is)

- **Cycles 1-19 shipped AND live-verified on the published app** (`cadence-flow-beta.lovable.app`). All checked features work. The core loop (Sense → Decide → Plan → Build → Launch → Learn), the Engine Room (approvals, attention, incidents, spend, trust dial), the 13-agent mesh with handoffs + memory-as-moat, discovery + per-product clustering, provenance, and missions are all live.
- **Approx completion:** ~55+ of ~101 tracked feature rows done, but true completion is higher than the dashboard shows (several ⬜ rows are already built, see section 5). The remaining work splits into the autonomous queue (section 3) and the founder pickup list (section 4).
- **Two open findings from the live sweep** (neither a code bug), section 5.
- Milestone framing (legacy M-0 to M-D): M-0/M-A (loop on real data) and M-B (moat visible) are met (the loop is live-verified, /memory + Gauntlet shipped); M-C (monetize) and M-D (dual-user/scale) map to the founder pickup list (section 4).

---

## 3. THE BUILD QUEUE (autonomous, the loop builds straight down this)

Everything here needs **no founder input** and can be built, gated offline, and flagged for publish-verify. Source: 2026-06-18 backlog reconciliation (cross-referenced canon vs `src/`).

**Ordered by STRATEGIC IMPACT vs the current positioning** (workflow `cadence-strategic-build-rank`, 2026-06-18; founder ruling: highest-impact first, never buildability). Scoring lens = the current v10 milestone gate (Sprint P0: close the loop on REAL DATA + land the wedge). The catalog tables below are the buildable set; the strategic order + the pruned (off-milestone) set are at the end of this section.

### #1 (shipped this cycle), `F3-CRON` continuous auto-cluster (always-fresh SENSE)
Strategic #1 (impact 7/10): it advances the binding P0 constraint (autonomous SENSE on real data) from the only side code can move, since SEN-01 is founder-blocked on an OAuth registration. Today `clusterSignals` only runs when a human pokes it, so the front of the loop is not autonomous; a scheduled incremental re-cluster is what the North Star demands at SENSE. **Shipped 2026-06-18 (cycle 20), gated OFF** so it commits zero AI spend until activated: a `cluster-tick` hook + an extracted `clusterSignalsCore` + an owner opt-in toggle + the `auto_cluster_enabled` migration. **Activation is founder-gated (section 4):** apply the migration on publish, owner enables the toggle, then wire the cron schedule. Detail: [`../features/f3-continuous-discovery.md`](../features/f3-continuous-discovery.md).

### P1
| ID | Title | Migration | Files / domain | Scope | Confidence unbuilt |
| --- | --- | --- | --- | --- | --- |
| `DATA-RETENTION` | ai_events/token_usage retention + purge | yes | new migration (pg_cron purge) + `api/public/hooks/retention-tick.ts` + `projects.functions.ts` | Bounded retention + right-to-be-forgotten cascade; conservative default TTL (e.g. 180d) | HIGH |
| `PROVIDER-FALLBACK` | Multi-provider fallback chain | no | `runtime.server.ts` (`resolveGateway`/`attempt`/`callModelStream`) | Extend the existing retry+single fallback into an ordered provider chain so an outage degrades, not hard-fails | PARTIAL |
| `PLAN-ENFORCE` | Plan-tier runtime enforcement | yes | `entitlements.ts` + `runtime.server.ts` + migration (quota cols) | Enforce free-vs-pro caps at the chokepoint (entitlements are feature-flags only today); sensible defaults, founder tunes numbers later. _Sequence with PROVIDER-FALLBACK (both touch runtime.server.ts)._ | HIGH |
| `MODEL-REGISTRY-DEPRECATION` | Deprecation flags on the model catalog | no | `src/lib/ai/models.ts` | Add `deprecated`/`sunset`/`replacement` + route-around when flagged (benchmark cadence is the gated half, excluded) | PARTIAL |

### P2
| ID | Title | Migration | Files / domain | Scope | Confidence |
| --- | --- | --- | --- | --- | --- |
| `F-AGENTS-MENTIONABLE` ✅ shipped 2026-06-18 | @-mentionable agents → mission | no | `chat.ts` (server parse + single-step dispatch) + `_authenticated.chat.tsx` (composer @-picker) | SHIPPED: parse `@agentslug` → pre-planned single-step mission to that specialist; composer picker reuses `listAgents` | n/a (built) |
| `U6-AUDIT` | Export audit log | yes | `projects.functions.ts` + new `export_log` migration + `DataExportCard.tsx` | Audit row per export + history view | PARTIAL |
| `R3-PREFS` | Notification prefs + in-app digest | yes | `notifications.functions.ts` + new `notification_prefs` migration + Settings UI | Prefs table + toggle UI + in-app digest rollup (email SENDING is gated, excluded) | PARTIAL |
| `F3-CRON` ✅ shipped 2026-06-18 (gated off) | Continuous auto-cluster cron | yes | `cluster-tick.ts` + `cluster.server.ts` + `discovery.functions.ts` + `SignalsPanel.tsx` + migration | SHIPPED gated off (see #1 above); activation is founder-gated (section 4) | n/a (built) |
| `P7-COST-INCIDENT` | Cost-incident source + persistent incidents table | yes | `incidents.functions.ts` + new `incidents` migration | Cost-threshold incident derivation + persistent table | PARTIAL |
| `K2` ◐ operator path shipped 2026-06-18 | Rollback / revert-to-revision + flag kill | no | new `studio-revert.server.ts` + `studio.functions.ts` (`revertToRevision`) + `ChangesPanel.tsx` | SHIPPED operator revert button (non-destructive forward commit via GitHub Data API). Deferred K2b: `studio.revert` agent tool (needs `agent_tools` migration) + flag kill | partial |
| `F-BUILDER-MULTIFILE` | Pre-declared touch-list + max-N scope | maybe | `studio.functions.ts` + `registry.server.ts` + `builder_file_claims` | Up-front declared touch list + per-mission file-count cap | PARTIAL |
| `P4-GATE` ✅ shipped 2026-06-18 | Eval regression as a hard merge gate | no | new `eval-gate.ts` + `registry.server.ts` (`studio.pr.merge`) | SHIPPED: ≥10pt latest-vs-prior eval drop (per suite) blocks the agent's merge; pure readiness fn mirrors the J2 CI gate; reads the scheduled eval trend | n/a (built) |
| `P5-ALERT` ✅ shipped 2026-06-18 | Drift threshold → Attention/incident | no | `notifications.functions.ts` (4th probe over `drift_incidents`) | SHIPPED: open drift incidents surface in the Attention feed as severity-coded cards linking to `/drift`; live-derived, no migration | n/a (built) |
| `D4-REPLAY` | Replay-and-branch + checkpoint-diff | maybe | `missions.functions.ts` + `_authenticated.missions.$missionId.tsx` | Re-run a mission with a different model/prompt + checkpoint diff (cancel half shipped) | PARTIAL |
| `FND-0.5` | Prompt pre-filter on tool allow-list + product scoping | maybe | `loop.server.ts` + `registry.server.ts` + `agent_tools` | Pre-filter high-risk tools before they enter the prompt; scope allow-list by product | PARTIAL |
| `KI-16` | Per-tick advance cap | no | `mission-advance.server.ts`/`resume-runs.ts` | Per-tick dispatch cap (only a global `MAX_RUNNING_PER_WORKSPACE=5` exists) | HIGH |
| `O3` | Fact-currency / staleness flag | maybe | `lineage.functions.ts` / knowledge fns | Flag stale facts on the provenance graph (skill-pack-over-MCP half depends on Q1/Q2, excluded) | HIGH |

**Strategic order (by impact vs the current P0 milestone), 2026-06-18 rank:**
1. ✅ `F3-CRON` (7) shipped (cycle 20), gated off (above).
2. ✅ `F-AGENTS-MENTIONABLE` (6) shipped. Felt agentic-command, deterministic single-step-DAG reuse of the chat→mission spawn. Server half auto-committed mid-build by a parallel process (mislabeled "cycle 19", `40646dce0a`); cycle 21 completed it (composer @-picker + case-insensitive parse) and reconciled the docs.
3. ✅ `P5-ALERT` (6) shipped (cycle 22). Open `drift_incidents` now surface in the Engine Room Attention feed (R3) as severity-coded cards linking to `/drift`; a 4th live-derived probe in `getNotifications`, no migration.
4. ✅ `P4-GATE` (6) shipped (cycle 23). `studio.pr.merge` is now hard-gated on eval regression too (new `eval-gate.ts`, mirrors the J2 CI gate): a ≥10pt drop in the latest completed eval run vs the prior, per suite, blocks the agent's merge. Reads the scheduled eval trend, no run triggered.
5. ◐ `K2` (rollback/revert-to-revision) operator path shipped (cycle 24): a non-destructive "Revert to revision" button in the Changes tab (new `studio-revert.server.ts` + `revertToRevision` server fn). Deferred `K2b`: the `studio.revert` agent engine-tool (needs an `agent_tools` migration) + feature-flag kill.
6. **NEXT:** `D4-REPLAY` (replay-and-branch + checkpoint-diff), then `FND-0.5`, `F-BUILDER-MULTIFILE`, `R3-PREFS`, `U6-AUDIT`, `P7-COST-INCIDENT`, and `K2b`.

**Pruned (off the current milestone, do NOT build now), 2026-06-18 rank:** `APP-HEALTH` (generic ops, near-zero strategic impact now), `PLAN-ENFORCE` (monetization plumbing, gated behind M-C), `DATA-RETENTION` (team/enterprise, M-D), `PROVIDER-FALLBACK` (resilience hygiene; a single fallback already exists), `MODEL-REGISTRY-DEPRECATION` (catalog hygiene, no current breakage), `KI-16` (high-scale-only), `O3` (depends on the unbuilt O1 graph). These re-enter the queue when their milestone arrives.

---

## 4. Founder pickup list (gated, needs you; the loop will NOT do these)

When you have a moment, these unblock the next tier. Each needs a decision/secret/account from you.

- **`F3-CRON` activation** (mechanism shipped 2026-06-18, gated off), to turn on always-fresh SENSE: (1) the migration applies on your next publish; (2) a workspace owner flips the "Auto-cluster new signals" toggle in the Signals tab; (3) wire a scheduler to POST `/api/public/hooks/cluster-tick` every ~6h (pg_cron snippet + publish-verify checklist in [`../features/f3-continuous-discovery.md`](../features/f3-continuous-discovery.md)). It commits recurring AI spend, so the on switch stays your call.
- **`F-CONN`**, register ≥1 OAuth client (GitHub/Linear) to unblock a 2nd live ingest source (`SEN-01`).
- **`SEN-05` / `F-ANALYTICS-1/2`**, product-analytics connector OAuth + recurring spend.
- **`M-C-PRICE`**, set Stripe secrets + price IDs to flip billing live.
- **`M-C-EXPIRY`**, flip `memory_expiry_enabled()` (monetization-timing / product-tasting call).
- **`SANDBOX` / `BLD-05`**, pick a sandbox provider (Cloudflare Sandbox SDK / E2B / Vercel); infra + spend.
- **`BLD-04`**, delegate-out to external coding agents (BYO-key + governance posture).
- **`Q2`**, external A2A server (outward-facing surface, scopes/audit posture).
- **`A6 / ENG-08`**, roles / RBAC / invites (team-tier sequencing call; can be built as a migration when you green-light the tier).
- **Demo seed lineage edges**, a migration is buildable, BUT it touches the drift-prone `seed_demo_workspace` and needs a re-seed to show live; risky to do blind. On your OK the loop will add `recordLineage` to the seed so demos show populated provenance (finding 2, section 5).
- **PII mandatory-redaction policy**, mandatory-vs-optional is your policy call.
- **The design / UX-polish pass**, ruled LAST, once, on the finalized product (standing instruction 2).
- **`F-IA-*` IA consolidation** (cull nav, merge routes, collapse to 7 surfaces), design-adjacent / product-tasting; bundled with the design pass.
- **Cut/defer post-PMF:** `F-AUDIO-1/2`, `SEN-04`.

---

## 5. Open findings, bugs, and solutions

- **Finding 1 (transient, not a bug):** `/product?tab=specs` rendered empty once during the deploy window; clean on reload. Likely a deploy/hydration hiccup. Watch; not reproducible.
- **Finding 2 (seed-data gap, not a bug), queued to founder:** the demo seed never writes `artifact_lineage` edges, so the Lineage drawer + O1 provenance always show empty states on demos. Features are wired correctly and degrade gracefully, but the demo cannot show off lineage/provenance/the memory-moat story. Fix = a seed migration + a re-seed (founder pickup, section 4).
- **Dashboard corrections (stale rows, trust this file + the code over them):**
  1. `F-CHAT` "Ask can spawn a mission", v10 §7 frames it as a gap but it is **already built** (`src/routes/api/chat.ts:162-383`). v10 text is stale.
  2. v10 §15 lists `D4/P7/P3/R3/B5/U6/Q1-MCP/DEC-02-LOOP/H1-TASKS/MOAT-VIS/AMBIENT-ARC/F-SHARE-TEARDOWN` as ⬜/◐, the dashboard (fresher) marks most ✅/◐ with the real remainder. Trust the dashboard over v10 §15.
  3. `KI-15`+`KI-16` are bundled in one row: KI-15 is **done** (`sweepStaleUnconsumedMessages`), KI-16 (per-tick cap) is genuinely **unbuilt**.
  4. `health.functions.ts` is a migration-drift checker, NOT an app health endpoint (so `APP-HEALTH` is real work).
  5. `considerations.md` P0 gaps (app monitoring, data retention, plan enforcement, provider fallback) are NOT dashboard rows at all, real autonomous work the dashboard omits. This is why the backlog looked thinner than it is.

---

## 6. Progress log (append-only, newest first)

- **2026-06-18, cycle 24, `K2` operator revert-to-revision shipped (strategic #5, partial).** The Build engine now has a one-action rollback: a confirm-gated "Revert" button on every prior revision in the Changes tab. New shared helper `src/lib/ai/studio-revert.server.ts` (`revertChangesetToRevision`) does a NON-DESTRUCTIVE revert via the GitHub Git Data API: it creates a new commit whose tree is the target revision's tree, parented on the current branch head, then fast-forwards the ref (`force:false`), so history only moves forward and the revert is itself revertible. `revertToRevision` (server fn in `studio.functions.ts`) resolves GitHub auth for the changeset's workspace via `resolveGitHub` and delegates to the helper; the ChangesPanel button is shown only while the branch is live (`committed`/`pr_open`) and never on the latest revision. The helper is self-contained (own gh fetch helpers, no registry import) so a future `studio.revert` agent tool can reuse it. Gate green (tsc + build + lint + humanization); adversarial review found no real fix (non-destructive by construction, changeset-scoped revision lookup, record-failure tolerant, RLS-scoped). Clean sync this cycle. **Deferred K2b:** the agent engine-tool (needs an `agent_tools` migration to gate `studio.revert`) + feature-flag kill (no flag system tied to changesets). Detail: [`../features/studio.md`](../features/studio.md) K2 section.
- **2026-06-18, cycle 23, `P4-GATE` shipped (strategic #4).** The Studio/Build merge tool (`studio.pr.merge`) is now hard-gated on eval regression as well as CI. A new pure module `src/lib/ai/eval-gate.ts` (`evalRegressionReadiness`, mirrors the J2 `studio-ci.ts`) blocks the agent's merge when the latest completed eval run for any suite is ≥10 points below the prior one (0-100 scale, confirmed via the KI-14 scale-fix migration). The merge tool reads the user's completed `eval_runs` (latest two per suite, explicitly user-scoped, capped at 80), fetches suite names, and throws `MergeBlocked` naming the worst-regressed suite. Reads the scheduled eval trend (no run triggered), read-only, degrades to allowed when no suite has a two-run history; the operator can always merge from GitHub directly. Gate green (tsc + build + lint + humanization); adversarial review found no real fix (scale 0-100 correct, drop direction correct, NaN/null-safe, user-scoped). Clean sync this cycle (no parallel commit). Detail: [`../features/studio.md`](../features/studio.md) step 6.
- **2026-06-18, cycle 22, `P5-ALERT` shipped (strategic #3).** Drift threshold breaches now reach the operator without visiting the Drift page: a 4th live-derived probe in `getNotifications` surfaces open `drift_incidents` in the Engine Room Attention feed (R3) as severity-coded cards (critical → warning, else info) that name the drifted metric + signed delta vs baseline and link to `/drift`. No migration (reads the existing `drift_incidents` table over its `(user_id, status, detected_at)` index), capped at 6 so a noisy week cannot flood the feed, degrades to no items on error. Both feed consumers (NotificationsPanel, AttentionBell) are kind-agnostic, so adding the `drift` kind needed no UI change. Gate green (tsc + build + lint + humanization); adversarial review found no real fix (numeric coercion guarded, severity safe-defaulted, RLS-scoped). Clean sync this cycle (no parallel/runaway commit). Detail: [`../features/r3-notifications.md`](../features/r3-notifications.md).
- **2026-06-18, cycle 21, `F-AGENTS-MENTIONABLE` completed (strategic #2).** The server half (parse `@agentslug` → pre-planned single-step `mission_steps` dispatch via `advanceMissionCore`, deterministic completion via `steps.length > 0`) was auto-committed mid-build by a parallel process (mislabeled "cycle 19", `40646dce0a`/`ffbf5c50c0`) while the main loop was still working the same worktree. Reconciled cleanly: the committed `chat.ts` matched the main loop's server work; this cycle layered the genuinely-new value on top (the composer @-agent picker: keyboard nav + click, reuses `listAgents`, never hijacks Enter-to-send; and a case-insensitive parse fix so a manually-typed `@Strategist` resolves), plus the docs the parallel commit skipped (this SSOT, the feature doc [`../features/agents-mentionable.md`](../features/agents-mentionable.md), session-decisions). Gate green (tsc + build + lint + humanization); adversarial review surfaced the case-insensitivity gap. Recurring-incident note in session-decisions: a background process is committing/pushing autonomously again (same pattern as the F3 `c304bf6396` incident).
- **2026-06-18, cycle 20 verified + closed.** Re-ran the full gate on the mid-flight `F3-CRON` tree: `tsc --noEmit` clean, `bun run build` green (the `cluster-tick` route bundles), `eslint` clean on all four touched files, and the F3 source + migration scan zero em/en dashes. Closed the feature-doc loop ([`../features/f3-continuous-discovery.md`](../features/f3-continuous-discovery.md): cron section, governance/activation, verification). Committed F3 + this close. Re-rank workflow confirmed complete (section 3 is impact-ordered). Next strategic pick: `F-AGENTS-MENTIONABLE`.
- **2026-06-18, cycle 20, `F3-CRON` (strategic #1) shipped gated off.** A multi-agent strategic ranking (workflow `cadence-strategic-build-rank`, weighting v10>v9>v8>v7>v6) picked `F3-CRON` as the highest-impact buildable item vs the current P0 milestone (over the easy-but-low-impact `APP-HEALTH`). Built the auto-cluster mechanism (the `cluster-tick` hook + extracted `clusterSignalsCore` + an owner toggle + the `auto_cluster_enabled` migration), gated OFF; gate-green; adversarial review caught + fixed a service-role `workspace_id` NOT-NULL bug. Activation is founder-gated (section 4).
- **2026-06-18, docs consolidation, `2e4421e800`.** Folded the siloed trackers into this SSOT, archived the three stale v7 docs, repointed 24 references, fixed the boot hook (v6→v10 + SSOT-first).
- **2026-06-18, backlog reconciliation.** Cross-referenced v10/v9/v8 + dashboard + considerations vs `src/`; disproved the "thin backlog" read; produced the section-3 queue (~17 autonomous items) and codified the founder's standing rulings (section 1).
- **2026-06-18, full live verification (cycles 1-19), `40b24cf972`.** Founder published everything; Playwright-swept the live app; all checked features work; logged 2 non-bug findings (section 5).
- **2026-06-18, cycle 19, `d8ee421d43`.** O1 provenance in the shared Lineage drawer (recovered from a mid-build rollover, finished, gate-green, one adversarial fix).
- Earlier cycles (1-18): see the build report and `plan.md` §4 for the full dated history.

---

## 7. Where the detail lives (this file is the front door)

This SSOT is the founder-facing tracker. These remain as detail/machine views it supersedes for day-to-day tracking:
- [`feature-dashboard.md`](./feature-dashboard.md), the per-feature status matrix (read by the session-start hook; kept for machine/loop use).
- [`overnight-build-report.md`](./overnight-build-report.md), the autonomous-loop run log (dated cycle-by-cycle detail).
- [`../../plan.md`](../../plan.md) §4, the append-only build log.
- [`considerations.md`](./considerations.md), cross-cutting engineering gaps (source of the P0/P1 infra items in section 3).
- [`v10_implementation-plan.md`](./v10_implementation-plan.md) + [`../strategy/`](../strategy/) (v10 blueprint, v9, v8), strategy/positioning canon.

_Standing rule: every cycle updates THIS file (status + queue + progress) in the same unit of work as the change, then the detail views as needed._
