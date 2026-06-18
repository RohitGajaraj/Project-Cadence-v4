# Cadence, Single Source of Truth (SSOT)

> **Founder: this is the ONE file to read.** Status, what we are building, what is deferred to you, findings, and progress all live here. Everything else (the feature dashboard, the build report, the strategy docs) is detail this file points to. The autonomous build loop keeps this file current every cycle.
>
> **Last updated:** 2026-06-18 (post cycle-19 + full live verification + backlog reconciliation). **Maintainer:** the autonomous build loop, every cycle.

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

> **Re-ordering in progress (2026-06-18):** the order below is the first cut (buildability/file-disjointness). Per the founder ruling, it is being re-ranked by **strategic impact against the current positioning** (workflow `cadence-strategic-build-rank`); the #1 highest-impact item and the corrected order land here when that completes. Do not assume the top row below is the #1 until this note is removed.

### Build next (top pick)
- **`APP-HEALTH`, app health/status endpoint** · P1 · no migration · new `src/routes/api/health.ts`. A `/api/health` route that pings Supabase and returns `{ok, version, migrations}` (distinct from `health.functions.ts`, which is a migration-drift server fn, not an HTTP endpoint). Closes a P0 `considerations.md` gap, brand-new file (collides with nothing), follows the `api/chat.ts` pattern. **Confidence unbuilt: HIGH.**

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
| `F-AGENTS-MENTIONABLE` | @-mentionable agents → mission | no | mention parser in chat/card components + `chat.ts`/`missions.functions.ts` | Parse `@agentslug` → dispatch a mission (chat→mission spawn already exists, reuse it) | HIGH (thin reuse) |
| `U6-AUDIT` | Export audit log | yes | `projects.functions.ts` + new `export_log` migration + `DataExportCard.tsx` | Audit row per export + history view | PARTIAL |
| `R3-PREFS` | Notification prefs + in-app digest | yes | `notifications.functions.ts` + new `notification_prefs` migration + Settings UI | Prefs table + toggle UI + in-app digest rollup (email SENDING is gated, excluded) | PARTIAL |
| `F3-CRON` | Continuous auto-cluster cron | yes (cron) | new `api/public/hooks/discovery-tick.ts` + `discovery.functions.ts` | Scheduled incremental re-cluster. NOTE: commits recurring AI cost, build gated OFF, flag founder publish-verify | HIGH |
| `P7-COST-INCIDENT` | Cost-incident source + persistent incidents table | yes | `incidents.functions.ts` + new `incidents` migration | Cost-threshold incident derivation + persistent table | PARTIAL |
| `K2` | Rollback / revert-to-revision + flag kill | no | `studio.functions.ts` + `registry.server.ts` (`studio.revert`) + `ChangesPanel.tsx` | Revert path off `studio_changeset_revisions` (table exists) via GitHub Data API; documented rollback + revert button | HIGH |
| `F-BUILDER-MULTIFILE` | Pre-declared touch-list + max-N scope | maybe | `studio.functions.ts` + `registry.server.ts` + `builder_file_claims` | Up-front declared touch list + per-mission file-count cap | PARTIAL |
| `P4-GATE` | Eval regression as a hard merge gate | no | `evals.functions.ts` + `eval-runner.server.ts` + `registry.server.ts` | Wire a ≥10pt regression check into the merge gate (reuse the J2 CI-gate pattern) | PARTIAL |
| `P5-ALERT` | Drift threshold → Attention/incident | no | `drift.functions.ts`/`drift.server.ts` + `notifications.functions.ts` | Emit an in-app alert/incident when drift trips (passive watcher today; in-app only) | PARTIAL |
| `D4-REPLAY` | Replay-and-branch + checkpoint-diff | maybe | `missions.functions.ts` + `_authenticated.missions.$missionId.tsx` | Re-run a mission with a different model/prompt + checkpoint diff (cancel half shipped) | PARTIAL |
| `FND-0.5` | Prompt pre-filter on tool allow-list + product scoping | maybe | `loop.server.ts` + `registry.server.ts` + `agent_tools` | Pre-filter high-risk tools before they enter the prompt; scope allow-list by product | PARTIAL |
| `KI-16` | Per-tick advance cap | no | `mission-advance.server.ts`/`resume-runs.ts` | Per-tick dispatch cap (only a global `MAX_RUNNING_PER_WORKSPACE=5` exists) | HIGH |
| `O3` | Fact-currency / staleness flag | maybe | `lineage.functions.ts` / knowledge fns | Flag stale facts on the provenance graph (skill-pack-over-MCP half depends on Q1/Q2, excluded) | HIGH |

**Disjoint build order:** APP-HEALTH → DATA-RETENTION → PROVIDER-FALLBACK → MODEL-REGISTRY-DEPRECATION → PLAN-ENFORCE → then the lane-disjoint P2 set: F-AGENTS-MENTIONABLE, U6-AUDIT, R3-PREFS, F3-CRON, P7-COST-INCIDENT, the Build-lane set (K2 → F-BUILDER-MULTIFILE → P4-GATE, sequenced, all touch studio/registry), D4-REPLAY, KI-16, O3, P5-ALERT, FND-0.5.

---

## 4. Founder pickup list (gated, needs you; the loop will NOT do these)

When you have a moment, these unblock the next tier. Each needs a decision/secret/account from you.

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

- **2026-06-18, backlog reconciliation + this SSOT.** Cross-referenced v10/v9/v8 + dashboard + considerations vs `src/`; disproved the "thin backlog" read; produced the section-3 queue (~17 autonomous items). Created this single source of truth and codified the founder's standing rulings (section 1). Next: build down the queue from `APP-HEALTH`.
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
