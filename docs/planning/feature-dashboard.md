# Feature Dashboard - the one master prioritized feature register

> **SSOT first.** The single front-door tracker is [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (live cursor, status, build queue, founder rulings, findings, progress). This file is the per-feature master register + live In-Dev claims (machine/loop view) it points to, not the tracker to follow day-to-day.

> **What this is.** ONE canonical, at-a-glance, prioritized register of **every** feature - what is built, in dev, partial, paused, deferred, blocked, or open - each with a one-line "what it does", a category, and a priority, so any session can pick the top open item cold. This is the **front door** to status. Per-feature acceptance detail lives in [`feature-backlog.md`](./feature-backlog.md); current-initiative build specs live in [`workspace-tenancy-and-monetization-plan.md`](./workspace-tenancy-and-monetization-plan.md) (G10) + [`byo-build-implementation-plan.md`](./byo-build-implementation-plan.md) (G11).
>
> **Created:** 2026-06-16 · **Last updated:** 2026-06-19 16:31 (WM-M11 → ◐: per-tier credit grant + monthly cycle reset + credit-tick hook, overnight cycle 31; WM-M4 → ◐ cycle 30; WM-M10 → ✅ cycle 29; earlier 05:30 IST: restructured into a single master prioritized register: every G0-G11 row is one numbered row; sorted open-first by priority, then done-by-category). **Maintainer rule:** Tier 1, continuous (update in the same commit as any status change; stamp the precise time on every update).

---

## STANDING RULE - REGISTER FIRST, THEN BUILD (non-negotiable, read before any feature work)

**No feature is built that is not tracked here first.** Every tool (Claude Code, Antigravity, Gemini, Lovable, a future session) must:

1. **`git pull origin main`**, then read this register. It is checked before any activity starts so a new or parallel session knows what is already in flight, deferred, or done, and does not collide or redo.
2. **REGISTER a new feature HERE FIRST.** Before any code, add a row with an **ID + Category + Priority** (and a one-line "What it does"). If it is not in this sheet with an ID, it does not get built.
3. **Respect the claims.** If a row is `🔨 In Dev`, another session may be on it - do not start it. Pick a different row or coordinate. Check the **Active claims** table first.
4. **On pickup:** flip Status to `🔨 In Dev (<tool>, YYYY-MM-DD)`, add a line to the **Active claims** table, and commit + push immediately so others see the claim - same commit, before you write feature code. (The literal `In Dev (` substring is preserved so the session-start hook can grep live claims.)
5. **On completion:** flip to `✅` (or `◐` if partial) with the date, remove the Active-claims line, and update the linked detail doc + `plan.md` §4 in the same unit of work (the closed-doc loop).
6. **On defer/pause/block:** flip to `⏭️` / `⏸️` / `🚧` and put the SHORT REASON in the **Comments** column (e.g. "deferred: post-PMF", "blocked: needs founder OAuth").

> Same shared-cursor discipline as the SSOT live cursor (section 0) and [`feature-backlog.md`](./feature-backlog.md). When they disagree, fix all in the same commit.

### How to pick something up
Say **"pick `<ID>`"** (e.g. "pick WM-M1", "start SEN-01", "do F-IA-V4") and the agent resolves the ID here, reads the row, opens the linked detail (backlog / WM plan / BYO plan / feature doc), and builds. The IDs are stable and shared with [`feature-backlog.md`](./feature-backlog.md).

### Status legend
| Mark | Meaning |
| --- | --- |
| ✅ | **Done** - built, on `main`, verified (date where known) |
| 🔨 | **In Dev** - actively being built this/another session (see Active claims); keeps the literal `In Dev (` for the hook |
| ◐ | **Partial** - foundation built, real remaining work; Comments says what is left |
| ⏸️ | **Paused** - built or started but intentionally idle; reason in Comments |
| ⏭️ | **Deferred** - deliberately not now (gate/sequence reason in Comments) |
| 🚧 | **Blocked** - cannot proceed until a dependency clears (founder action / KI); reason in Comments |
| ⬜ | **Open** - not started, ready to pick up |

### Category legend (11 categories; mapped from the source groups)
| Category | What it covers | Source group |
| --- | --- | --- |
| Foundational | Core autonomous loop, memory engine, platform/auth/runtime infra | G0 + G9 |
| Sense | Get real signal in, cluster it, keep it fresh | G1 |
| Decide | Turn signal into governed decisions + specs (incl. the wedge) | G2 |
| Build | The autonomous Build -> QA -> Ship execution chain | G3 |
| Launch | Ship to market, learn from outcomes, feed it back | G4 |
| Monetization | Pricing, entitlements, tenancy/RBAC/billing, PLG | G5 + G10 (tenancy/RBAC/billing rows) |
| Credit | The credit metering engine (WM-M10..WM-M16) | G10 (credit rows) |
| Interop | External agents/tools (MCP, A2A), team interop, export | G6 |
| Cockpit | IA, observability, the operator's view of the machine | G7 |
| Governance | Trust, safety, evals, drift, critic, incidents, humanization | G8 |
| BYO | Provider-agnostic repos + managed Cadence Cloud runtime | G11 |

---

## Active claims (who is on what, right now)

> Keep this table empty when nothing is in flight. Add a row the moment you pick something up.

| ID | Feature | Tool / session | Since | Notes |
| --- | --- | --- | --- | --- |
| AGENT-EXP | Agent experience (roster model · faces · identity · relay) | Claude Code · `worktree-agent-experience` | 2026-06-18 | Off the overnight tip; forward-integrate only. Owns `agent-vocabulary.ts`, the agent routes, `govern`, `AgentsPanel`, `orchestrator`, new migrations, `docs/features/agent-experience.md`. Phase 1 (catalog model + migrations + prompts + station-aware planning) and Phase 2 (relay UI + station spine + Engine Room Team) BOTH BUILT, gate green (tsc + build clean; lint-clean on changed files); pushed to the branch; pending merge to main + the signup smoke-test. Detail: [`../features/agent-experience.md`](../features/agent-experience.md) |

---

## At a glance

- **Total features = 142** · **Open = 81** · **Done = 61**
  ("Open" = every row not ✅: ⬜ open + 🔨 in dev + ◐ partial + ⏸️ paused + ⏭️ deferred + 🚧 blocked.)
- **Overall completion: 42% done** (60 of 142 fully done; ~49% counting partials as half-done). **58% remaining** (82 of 142 open). _The Monetization + Credit + BYO lanes (G10/G11) are the bulk of what is open. (WM-F1 → ◐; WM-F1b added as the hardening follow-up; WM-M2 → ◐ accounts/billing/credit migration, cycle 28; WM-M10 → ✅ credit unit + conversion, cycle 29; WM-M4 → ◐ dormant credit seam, cycle 30; WM-M11 → ◐ credit grant + cycle reset, cycle 31.)_
- **By status (of 141 total):**

| Status | Count |
| --- | --- |
| **Total** | **142** |
| ✅ Done | 60 |
| ⬜ Open (ready to pick up) | 53 |
| ◐ Partial | 19 |
| ⏭️ Deferred | 7 |
| ⏸️ Paused | 3 |
| 🔨 In Dev | 0 |
| 🚧 Blocked | 0 |

- **By category (Total / Open / Done):**

| Category | Total | Open | Done |
| --- | --- | --- | --- |
| Foundational | 19 | 2 | 17 |
| Sense | 12 | 9 | 3 |
| Decide | 12 | 2 | 10 |
| Build | 14 | 6 | 8 |
| Launch | 8 | 6 | 2 |
| Monetization | 27 | 26 | 1 |
| Credit | 7 | 7 | 0 |
| Interop | 5 | 4 | 1 |
| Cockpit | 17 | 8 | 9 |
| Governance | 12 | 4 | 8 |
| BYO | 8 | 8 | 0 |
| **Total** | **141** | **82** | **59** |

> **Priority rationale** lives in the v10 pick-list ([`v10-master-blueprint`](../strategy/v10-master-blueprint.md) §15-16, execution mechanics in [`v10_implementation-plan.md`](./v10_implementation-plan.md)) + the SSOT build queue ([`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) §0/§3/§4). The current founder-directed initiative is the WM tenancy + monetization + credit engine (WM-*, build top-down by the WM-1..WM-6 order below). BYO (BYO-*) awaits founder greenlight. This register does not restate that prose; the Priority column encodes it.

**Priority key (open items):** `P0` close-the-loop/wedge core · `P1` monetize/defend/deepen autonomy · `P2` breadth/polish · `WM-1`..`WM-6` the WM initiative pick-order · `BYO-1`..`BYO-7` the BYO phase order · `deferred` / `cut` per the v10 + SSOT defer list. Done rows read `shipped`.

---

## Master register

> Sorted: all NOT-done rows first (by Priority: P0 > P1 > P2 > WM-order > BYO-order > deferred/cut), then all ✅ done rows grouped by Category in G0..G11 order. `#` is the running serial over this final order.

| # | Status | ID | Feature | What it does | Category | Priority | Added | Comments |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ⏸️ | SEN-01 | Connector dock: 2nd live ingest | Adds a second real ingest source (Slack / GitHub issues / support) so the loop closes on real data | Sense | P0 | - | paused: needs founder to register one provider OAuth client (F-CONN) |
| 2 | ◐ | M-C-PRICE | Pricing + entitlements | Plan tiers, billing fns, Stripe webhook, Settings Plan; the revenue rails (relocated to account-level via WM-M1/2/3) | Monetization | P1 | - | needs founder Stripe secrets to go live; carried/expanded by G10 WM rows |
| 3 | ⬜ | Q2 | A2A server/client + Agent Cards + scopes/audit | Peer agents discover and call Cadence, governed by scopes + audit | Interop | P1 | - | needs founder decision on outward-facing surface + scopes/audit posture |
| 4 | ◐ | Q1 / ENG-07 / F-MCP-V1 | MCP server + read-only externals | Other agents/tools use Cadence as a tool (signals/opps/PRDs read, append decision) | Interop | P1 | - | Phases 1-3 done (foundation + dispatch + token UI); remaining Q2/Phase 4: full streamable-HTTP transport + external discovery |
| 5 | ⬜ | SEN-05 | Quant analytics inbound | Ingests PostHog/Amplitude/Mixpanel product metrics as a first-class signal | Sense | P1 | - | gated on a product-analytics connector OAuth + recurring spend |
| 6 | ⬜ | F-ANALYTICS-1 | Cohort metrics + telemetry ingestion | Released features get real usage data into `product_analytics` | Launch | P1 | - | depends on SEN-05 |
| 7 | ⬜ | F-ANALYTICS-2 | Opportunity impact eval | Post-release cohort feeds Product Memory and auto-adjusts ICE; the loop learns if a bet paid | Launch | P1 | - | depends on F-ANALYTICS-1 |
| 8 | ◐ | H2-WRITES | Outcome roadmap governed writes | Extends the H2 Now/Next/Later board with governed write paths | Decide | P1 | - | follow-on to H2; full write surface still partial |
| 9 | ◐ | PLG | PLG funnel | Public onboarding to first-win to upgrade; turns share traffic into activated paying users | Monetization | P1 | 2026-06-17 | Phases 1,2,4 done; Phase 3 (memory-expiry banner on Today/Brain) queued behind the autonomous loop |
| 10 | ◐ | ENG-06 / F-GOV-COST-SURFACE | Cost-per-outcome chip + unit-economics roll-up | "What you got for what you spent" chip on the front + full per-agent telemetry behind the Engine Room | Cockpit | P1 | 2026-06-17 | B1 + B3 built; B2 (Missions glance) deferred; live-verify on next publish |
| 11 | ⬜ | SANDBOX | Sandbox / preview spine | A sandbox to run agent tests + preview a build before merge | Build | P1 | - | needs founder to pick a provider (Cloudflare Sandbox SDK / E2B / Vercel) + infra/spend |
| 12 | ⬜ | AMBIENT-ARC | Ambient autonomy arc (Trust Dial) | Per-agent autonomy arc incl. Ambient + suggested promotion on the Agents tab | Governance | P1 | - | recon: shipped as `TrustDial.tsx`; see trust-and-autonomy.md §7 |
| 13 | ◐ | F3 | Continuous discovery feed | Always-fresh, per-product clustered signal feed (`/product?tab=signals`) | Sense | P2 | 2026-06-18 | remaining: auto-cluster cron (F3-CRON shipped gated off; activation founder-gated, commits recurring AI spend) |
| 14 | ◐ | O1 | Knowledge graph + query | Provenance walk: "why is this on the roadmap / being built?" back to root source signals | Sense | P2 | 2026-06-18 | remaining: typed graph explorer + drift/skill-pack export (O3) |
| 15 | ⬜ | O3 | Fact currency/drift + skill packs | Flags stale facts on the provenance graph; exports versioned skill bundles over MCP | Sense | P2 | - | depends on O1 + Q1 |
| 16 | ◐ | D4 | Cancel / replay-and-branch / checkpoints | Brake-pedal cancel + replay a finished mission (optionally a different model) with a branch link | Decide | P2 | 2026-06-18 | remaining D4b: rich side-by-side checkpoint-diff; pending publish + live verify |
| 17 | ◐ | K2 | Rollback triggers + one-action revert | One-action non-destructive revert-to-revision in the Build Changes tab | Build | P2 | 2026-06-18 | remaining K2b: `studio.revert` agent tool (needs `agent_tools` migration) + feature-flag kill; parked on a backup branch, issue #4 |
| 18 | ◐ | BLD-05 | Inspector gate (tests + preview before merge) | A test + preview bar on the PR/Checks tab before the operator clears the merge gate (warn-only on no tests) | Build | P2 | 2026-06-18 | wiring + unit tests built; live-verify pending; on branch `bld-05-inspector-gate` (PR pending) |
| 19 | ⬜ | F-BUILDER-MULTIFILE | Scoped multi-file build | Pre-declared touch list + max-N files; safer multi-file edits | Build | P2 | - | thin slice of I1 |
| 20 | ⬜ | BLD-04 | Delegate-out to external coding agents | A2A-style hand-off of build work, still governed | Build | P2 | - | depends on Q2; founder posture call (BYO-key + governance) |
| 21 | ◐ | LRN-04 | Product Memory consult/write visibility | Surfaces the wired memory loop per mission | Launch | P2 | - | per-mission surfacing is N3 (shipped) |
| 22 | ◐ | LCH-01 / L1 | Launch-kit mission | Turns a shipped changeset into 5 human-approved artifacts (changelog/blog/email/social/docs) | Launch | P2 | 2026-06-18 | remaining: a launch MISSION template + governed outbound send (never auto-sends) |
| 23 | ⬜ | L2 | Customer pages / announcements | Public-facing announcement pages (`p.$slug`) with approval to publish | Launch | P2 | - | M2 milestone |
| 24 | ⬜ | M1 / LRN-01 | Support triage loop | Tickets to drafted replies to bug clusters to signals; support feeds back into Discover | Launch | P2 | - | M2; needs an inbound channel |
| 25 | ⬜ | SEN-04 | Researcher watchtower | Scheduled competitor crawl briefs; ambient competitive signal without manual research | Sense | deferred | - | cut/defer: post-PMF |
| 26 | ⬜ | F-AUDIO-1 | Speech transcription + chunking | Upload meeting audio to transcript to diarized chunks | Sense | deferred | - | cut/defer: post-PMF |
| 27 | ⬜ | F-AUDIO-2 | Action-item extraction from transcripts | Meetings become drafted opportunities/PRDs citing the transcript | Sense | deferred | - | cut/defer: post-PMF; depends on F-AUDIO-1 |
| 28 | ⏭️ | K1-deploy | Cadence-triggered deploy gate | Trigger the actual deploy from Cadence | Build | deferred | - | deferred: needs a Cloudflare/Lovable deploy hook + founder config; deploy is external today |
| 29 | ⬜ | F-IA-V4 | Collapse IA to 7 surfaces | Route consolidation + redirects + vocab enforcement; one coherent product | Cockpit | P2 | - | design-adjacent; bundled with the founder-gated design pass |
| 30 | ⬜ | F-IA-TODAY-BRIEFING | Merge Today + Briefing | One morning surface, not two | Cockpit | P2 | - | bundled with the design/IA pass |
| 31 | ⬜ | F-IA-CULL-CALDOCS | Cull /calendar /meetings /docs /sync from nav | De-clutter the operator nav (data kept) | Cockpit | P2 | - | bundled with the design/IA pass |
| 32 | ⬜ | F-IA-AGENTS-TABS | Fold /prompts + /agents into one route | Agents live in one place | Cockpit | P2 | - | bundled with the design/IA pass |
| 33 | ⬜ | F-COCKPIT-MACHINE-MODE | Human <-> Machine mode toggle | Full-screen dispatch board, the "watch the factory" view | Cockpit | P2 | - | absorbed by F-IA-V4 |
| 34 | ◐ | R3 | Notifications | In-app Attention feed + global bell with the live "what needs you" count | Cockpit | P2 | 2026-06-18 | remaining: email + digests + per-user prefs (R3-PREFS) |
| 35 | ◐ | R4 | Settings expansion | Self-serve control: budgets, guardrails, health, prefs, admin | Cockpit | P2 | - | Plan tab shipped; rest partial |
| 36 | ◐ | U6 | Full data-portability / export wizard | Exports the whole workspace as one RLS-scoped JSON with per-section selection | Interop | P2 | 2026-06-18 | remaining: an export audit-log (U6-AUDIT) |
| 37 | ⬜ | A6 / ENG-08 | Roles + RBAC + invites | owner/admin/member/viewer roles + invites; per-persona approval lanes | Interop | P2 | - | superseded/expanded by WM-F3/F4/F5 (G10); build from the WM rows |
| 38 | ◐ | FND-0.7 | Prompt-injection defense | XML-tags + escapes untrusted tool/RAG output; guardrails support injection rules | Governance | P2 | - | remaining: a learned injection classifier + hard quarantine (regex-only today) |
| 39 | ◐ | FND-0.5 | Agent blast-radius limits | Per-agent tool allow-list + scope so an agent cannot reach beyond its remit | Governance | P2 | - | next autonomous pick: pre-filter high-risk tools + product-scope the allow-list |
| 40 | ◐ | P7 | Incidents log | Read-only log of failed tool runs, errored auto-pipelines, guardrail blocks, linked to traces | Governance | P2 | 2026-06-18 | remaining: a cost-incident source + a persistent incidents table (P7-COST-INCIDENT) |
| 41 | ⬜ | KI-15 / KI-16 | Stale zero-step completion · advance-cap | Per-tick dispatch cap + stale zero-step-mission completion edge cases | Foundational | P2 | - | low: KI-15 done, KI-16 (per-tick cap) genuinely unbuilt; high-scale only |
| 42 | ⏭️ | HUMAN-SWEEP | Full-product humanization sweep | Sweep all UI strings + seed data for AI fingerprints | Foundational | deferred | - | deferred: pre-launch gate, so screen churn does not force a re-sweep |
| 43 | ✅ | WM-M1 | Entitlements core (5 account tiers + matrix) | The tier model + limits both threads read; unblocks all pricing/limit work | Monetization | WM-1 | 2026-06-19 13:50 | SHIPPED (overnight cycle 26): 5 slug tiers + full matrix (limits, credits, RBAC, collab) + `limitFor` + Constellation `planPresentation`; legacy fields kept as aliases; `src/lib/entitlements.ts` (+ 14 tests). tsc/build/lint/test green |
| 44 | ◐ | WM-F1 | Scope agent memory/runs/roster to workspace | The moat compounds per workspace/account (today user-scoped) | Monetization | WM-1 | 2026-06-19 14:45 | CORE shipped (overnight cycle 27): nullable `workspace_id` on all 5 agent tables (backfilled) + recall RPCs rewritten with `for_workspace` (service-role-safe, null-tolerant) + a security fix (cross-user reflection leak) + recall threading + outcome/reflection tagging. Verified by a BEGIN..ROLLBACK dry-run on prod (0 nulls). NOT NULL + RLS swap + roster unique-swap + remaining insert-path tagging -> WM-F1b. Live recall-isolation activates on publish |
| 44b | ⬜ | WM-F1b | Agent-workspace hardening (NOT NULL + RLS + roster key + full tagging) | Closes WM-F1's transitional gaps: NOT NULL on workspace_id, RLS membership swap, agents UNIQUE(workspace_id,slug), and tagging the remaining ~6 agent_memory insert paths (handoff/registry/swarm/gauntlet) so ALL new memory is workspace-isolated | Monetization | WM-1 | 2026-06-19 14:45 | needs a per-insert-site workspace_id audit (several service-role paths); follow-up to WM-F1 |
| 45 | ◐ | WM-M2 | accounts table + billing/credit/decay migrations | Moves billing to the account; adds the credit-pool shell + 30d rolling decay | Monetization | WM-2 | 2026-06-19 15:40 | CORE shipped (overnight cycle 28): migration adds `accounts`/`account_members`/`account_credits`/`credit_ledger` + `workspaces.account_id` (backfilled, NOT NULL via an owner_id auto-fill trigger) + 5-tier CHECK widen + 30d rolling decay (rolls off `last_used_at`, dormant) + `credits_enabled()`/`is_account_member`/`ensure_user_default_account`; `billing.functions.ts` reads the plan from the account (shim fallback). Dry-run-verified on prod (5 accounts, all 7 ws linked, 0 nulls, rolled back). Live on publish. Types regen + account-aware webhook tracked with WM-M3 |
| 46 | ✅ | WM-M10 | Credit unit + cost-to-credit conversion + legibility | What one credit is + the calm per-action legibility layer (no meter-anxiety) | Credit | WM-2 | 2026-06-19 15:58 | SHIPPED (overnight cycle 29): `src/lib/ai/pricing.ts` adds `CREDIT_COGS_USD` + `creditsForCost` (0 for non-billable, >= 1 margin-positive for billable) + `estimateCreditsForCall` (composes the USD estimator) + the pure display-only `actionCreditRange` legibility layer (calibrated shapes through the same conversion; no DB); 15 unit tests (29 asserts). tsc/build/lint/test green. Numbers are §7 placeholders; the dormant `WM-M4` seam fills via WM-M12 |
| 47 | ⬜ | WM-F3 | RBAC enforcement | Real owner/admin/member/viewer permissions for teams | Monetization | WM-3 | 2026-06-19 | effort M; needs WM-M2 |
| 48 | ⬜ | WM-M5 | Tier limit gates (DB triggers) | Enforce per-product/workspace caps at the DB (clients write direct, so triggers guard) | Monetization | WM-3 | 2026-06-19 | effort M; needs WM-M1, WM-M2 |
| 49 | ⬜ | WM-F2 | Account-level memory pooling (paid) | Paid accounts compound memory across workspaces (the flywheel) | Monetization | WM-3 | 2026-06-19 | effort M; needs WM-M2, WM-F1 |
| 50 | ⬜ | WM-F9 | Isolation audit + scope leak fixes | Close cross-member leaks (meetings/notes/briefs/chat) before invites | Monetization | WM-3 | 2026-06-19 | effort S, no deps; do before WM-F5 |
| 51 | ◐ | WM-M11 | Per-tier credit amounts + monthly grant + cycle reset | Included resets, top-ups persist; the account credit pool | Credit | WM-3 | 2026-06-19 16:31 | CORE shipped (overnight cycle 31): new `credits.functions.ts` (pure `monthlyGrantCredits`/`resetDelta` + dormant `grantMonthlyAllowance`/`resetCreditCycle`) + `credit-tick` cron hook (grants un-granted, resets due accounts, preserves top-ups). Gated behind `credits_enabled()` (dormant). 7 unit tests; tsc/build/lint green, 208/208. Grant math verified; the DB writes + tick activate on publish + flag + pg_cron |
| 52 | ⬜ | WM-M15 | Margin levers (cost-aware routing + cache) | Keeps credits margin-positive (no self-serve BYOK to lean on) | Credit | WM-3 | 2026-06-19 | effort M; needs WM-M10 |
| 53 | ⬜ | WM-F4 | Ownership transfer | Transfer an account/workspace; unblocks owner-leaves | Monetization | WM-4 | 2026-06-19 | effort M; needs WM-F3 |
| 54 | ⬜ | WM-F5 | Invites (account/workspace) | Add teammates (no invite flow today) | Monetization | WM-4 | 2026-06-19 | effort M; needs WM-F3, WM-M2 |
| 55 | ⬜ | WM-M3 | Billing rails (account Stripe + webhook map) | 5-tier checkout + seats; webhook price-to-tier (dormant until secrets) | Monetization | WM-4 | 2026-06-19 | effort M; needs WM-M1, WM-M2; founder Stripe secrets to go live |
| 56 | ◐ | WM-M4 | Runtime credit seam (dormant) | The seam the credit engine plugs into; credits-only (no self-serve BYOK) | Monetization | WM-4 | 2026-06-19 16:17 | CORE shipped (overnight cycle 30): `CreditExhaustedError` + cached `creditsEnabled()` + `resolveCreditAccountId` + `assertAccountCredits` (pre-call) + `debitAccountCredits` (post-call) wired into callModel + callModelStream at the chokepoint; gated behind `credits_enabled()` (dormant no-op, zero behavior change). tsc/build green, 201/201 tests, eslint clean. WM-M12 fills the bodies (atomic draw-down). Live debit on publish + flag flip |
| 57 | ⬜ | WM-F7 | Settings IA (Account/Workspace/Personal) | A clear rubric for where each setting lives | Monetization | WM-5 | 2026-06-19 | effort M; needs WM-M2, WM-F3 |
| 58 | ⬜ | WM-F8 | Workspace switch hardening | No stale-data flash on switch; agents/memory switch too | Monetization | WM-5 | 2026-06-19 | effort S; needs WM-F1 |
| 59 | ⬜ | WM-M6 | Pricing surfaces (5 tiers + Usage panel) | The new model shown across pricing page + Settings Plan + Usage | Monetization | WM-5 | 2026-06-19 | effort M; needs WM-M1, WM-M3 |
| 60 | ⬜ | WM-M12 | Credit debit engine (fills the WM-M4 seam) | Meters credits from the account pool; halts clean when empty | Credit | WM-5 | 2026-06-19 | effort M; needs WM-M4, WM-M10, WM-M11 |
| 61 | ⬜ | WM-M13 | Capped top-up purchase (Stripe credit packs) | Paid-only capped fair-use top-ups; per-cycle ceiling, off by default | Credit | WM-5 | 2026-06-19 | effort M; needs WM-M3, WM-M12; founder sets pack prices + ceiling |
| 62 | ⬜ | WM-M14 | Per-product / per-member attribution + caps | See + cap spend per product/member on the pooled account | Credit | WM-5 | 2026-06-19 | effort M; needs WM-M12 |
| 63 | ⬜ | WM-M7 | Upgrade nudges (value-framed) | Convert at natural moments, never punitive | Monetization | WM-6 | 2026-06-19 | effort S; needs WM-M5, WM-M6 |
| 64 | ⬜ | WM-M8 | Tier identity motif (Constellation glyph) | The unique animated plan identity (rename-able via slug decoupling) | Monetization | WM-6 | 2026-06-19 | effort S; needs WM-M1, WM-M6 |
| 65 | ⬜ | WM-M9 | Remove BYOK from self-serve (enterprise-only) | Credits-only self-serve; retire the user-key path; model-agnostic routing (our keys) stays | Monetization | WM-6 | 2026-06-19 | effort S; needs WM-M1 |
| 66 | ⬜ | WM-F6 | Move product between workspaces | Relocate a product + its data across workspaces | Monetization | WM-6 | 2026-06-19 | effort M; needs WM-M2 |
| 67 | ⬜ | WM-M16 | Credit / usage UI (balance, legibility, attribution) | Calm balance + action ranges + attribution in Settings | Credit | WM-6 | 2026-06-19 | effort M; needs WM-M6, WM-M12, WM-M14 |
| 68 | ⏭️ | WM-S1 | Sample workspace for every new account | Every signup + investors land in a populated space | Monetization | deferred | 2026-06-19 | deferred: gate at ~50-60% platform complete |
| 69 | ⏭️ | WM-S2 | Guided tour | Teaches the loop in the sample workspace | Monetization | deferred | 2026-06-19 | deferred: gate at ~50-60% platform complete |
| 70 | ⏭️ | WM-S3 | Onboarding Concierge agent | Seeds the real workspace from real context day one | Monetization | deferred | 2026-06-19 | deferred: gate at ~50-60% platform complete |
| 71 | ⏭️ | WM-S4 | Workspace Steward agent | Nudges stale brief / outcome-less decisions (feeds the moat) | Monetization | deferred | 2026-06-19 | deferred: gate at ~50-60% platform complete |
| 72 | ⏭️ | WM-S5 | Investor-demo rich population + reset | Every demo surface populated; self-serve reset | Monetization | deferred | 2026-06-19 | deferred: gate at ~50-60% platform complete |
| 73 | ⬜ | BYO-P1a | RepoProvider interface + GitHub adapter | Lifts GitHub calls behind a provider-agnostic interface (behavior-preserving) | BYO | BYO-1 | 2026-06-19 | keystone; pending founder greenlight (no code until approved) |
| 74 | ⬜ | BYO-P1b | Product-level repo binding + per-Product RLS | Moves binding workspace -> product; per-Product UI + RLS | BYO | BYO-1 | 2026-06-19 | pending greenlight; parallel P1a; must honor workspace `agent_memory` RLS |
| 75 | ⬜ | BYO-P1c | Managed / auto-create repo (user's own org) | User creates a repo in their own account/org; portable, value-locked not hostage | BYO | BYO-2 | 2026-06-19 | pending greenlight; needs BYO-P1a, BYO-P1b |
| 76 | ⬜ | BYO-P1d | Calm-front Build surface | One product-framed decision on a new repo; git behind the Engine Room | BYO | BYO-3 | 2026-06-19 | pending greenlight; needs BYO-P1a, BYO-P1b |
| 77 | ⬜ | BYO-P2 | Multi-provider (GitLab; Bitbucket demand-gated) | GitLab launch pair; Bitbucket demand-gated; each adapter bounded by the interface | BYO | BYO-4 | 2026-06-19 | pending greenlight; needs BYO-P1a |
| 78 | ⬜ | BYO-P3 | Autonomous Build to Ship + capture | Agent runs the whole chain; deploy capture + in-app changelog; PRD join | BYO | BYO-5 | 2026-06-19 | pending greenlight; effort L; needs BYO-P1d |
| 79 | ⬜ | BYO-P4 | Managed AI credits (= WM credits) | Metered AI; included allowance + fair-use overage | BYO | BYO-6 | 2026-06-19 | built under WM (G10), cross-referenced not duplicated; needs WM-M2 |
| 80 | ⬜ | BYO-P5 | Managed end-to-end runtime | DB + auth + hosting so the user launches without leaving Cadence | BYO | BYO-7 | 2026-06-19 | founder-gated; sequenced last (needs BYO-P3 + loop proven) |
| 81 | ⏸️ | F-CONN | Connector platform (OAuth) | The connector engine that brings external sources in; built but parked pending a founder OAuth-client registration | Sense | P2 | - | parked: needs founder to register an OAuth client; unblocks SEN-01 |
| 82 | ⏸️ | M-C-EXPIRY | Memory-expiry enforcement engine | Free-tier memory expiry, built but gated off via memory_expiry_enabled() | Monetization | deferred | - | dormant: gated off; WM-M2 reworks it to a 30-day rolling window |
| 83 | ✅ | F-AGENT-1 | Orchestrator + multi-agent missions | The mission DAG that runs the whole loop | Foundational | shipped | - | |
| 84 | ✅ | F-AGENT-2 | Persistent memory + self-reflection + trust auto-advance | Agents remember and earn autonomy; the moat's substrate | Foundational | shipped | - | |
| 85 | ✅ | F-AGENT-3 | Event reactor + auto-pipelines | Signals trigger missions with no human poke | Foundational | shipped | - | |
| 86 | ✅ | F-AGENT-4 | Swarm HUD | See the agent mesh working (Missions Agents tab) | Foundational | shipped | - | |
| 87 | ✅ | P1-AA | Deterministic auto-advance | Missions advance unattended past wave 0 | Foundational | shipped | - | |
| 88 | ✅ | P1-RETRY | Bounded hop retry | A failed hop retries with backoff, not a dead mission | Foundational | shipped | - | |
| 89 | ✅ | P1-BUDGET | Adaptive step budget | Step budget scales to role/arc, not a static cap | Foundational | shipped | - | |
| 90 | ✅ | W1 | Memory-compounding loop | Outcomes distil into recallable memory across agents (the moat wired) | Foundational | shipped | - | |
| 91 | ✅ | W2 | Executed-unattended audit | The cockpit shows what the loop ran without you | Foundational | shipped | - | |
| 92 | ✅ | W3 | A2A hardening + moat on cockpit | Handoffs validate memory refs; outcomes-remembered count shown | Foundational | shipped | - | |
| 93 | ✅ | M-0 | Loop runs end-to-end on live data | Plan to dispatch to specialist execution confirmed live (hollow-completion fixed) | Foundational | shipped | 2026-06-15 | |
| 94 | ✅ | FND-AUTH | Auth + tenancy + RLS | The multi-tenant spine (user_id + workspace_id + product_id) | Foundational | shipped | - | |
| 95 | ✅ | FND-CHOKE | AI runtime chokepoint | One governed path for every AI call (callModel / callModelStream) | Foundational | shipped | - | |
| 96 | ✅ | KI-13 | Resilient signup | A real account can be created without a 500 (handle_new_user subtransactions) | Foundational | shipped | - | verify live |
| 97 | ✅ | KI-14 | Eval score scale to 0-100 | Eval scores do not overflow / false-fail the gate | Foundational | shipped | - | |
| 98 | ✅ | F-A2A-CARD | Public A2A agent card | Discoverability for external agents | Foundational | shipped | - | |
| 99 | ✅ | F-HUMANIZE-HOOK | Pre-commit dash/invisible-char trace hook | Build-time backstop for the humanization rule | Foundational | shipped | 2026-06-18 | run `bash scripts/install-git-hooks.sh` to activate |
| 100 | ✅ | KI-10 | Ingest webhook + per-token rate limit | One secure live ingest path for public use | Sense | shipped | 2026-06-16 | |
| 101 | ✅ | F-BRAIN | Brain (web + workspace research) | Perplexity-grade research feeding decisions | Sense | shipped | - | |
| 102 | ✅ | N2 | Re-score + insight memo + daily brief | The daily brief synthesizes "what the loop learned" from re-scored outcomes | Sense | shipped | 2026-06-16 | AI brief output needs a live re-verify on the deployed app |
| 103 | ✅ | F-CHAT-NL-INTENT | Conversational command of the swarm | Drive missions in natural language | Decide | shipped | - | |
| 104 | ✅ | H1 | PRD / spec generation | Cited specs from opportunities | Decide | shipped | 2026-06-14 | |
| 105 | ✅ | DEF-03 | Critic-on-spec red team | Specs get an adversarial pass before commit | Decide | shipped | 2026-06-14 | |
| 106 | ✅ | F-DEC-CARD | Decision card + Critic badge on Today | The human makes the call with the Critic's view in front of them | Decide | shipped | - | |
| 107 | ✅ | WEDGE | Critic-teardown first-run (the launch wedge) | A new account names a feature and gets an evidence-backed Ship/Revise/Kill teardown in the first session | Decide | shipped | 2026-06-17 | |
| 108 | ✅ | F-SHARE-TEARDOWN | Shareable Critic-teardown link (viral loop) | A public `/t/$slug` teardown link ("why your pet feature is wrong, with receipts") drives signups | Decide | shipped | 2026-06-17 | |
| 109 | ✅ | F-SHARE | Shareable-decision viral loop + rate limit | A public decision link drives signups; secure anon-read (also a Monetization surface) | Decide | shipped | 2026-06-16 | |
| 110 | ✅ | H2 | Outcome roadmap (Now/Next/Later) | Human commits opportunities to buckets with an outcome + measure; agent ICE orders within | Decide | shipped | 2026-06-17 | |
| 111 | ✅ | H3 | Scheduling (calendar-aware work blocks) | Schedules open deep-work tasks into free time within working hours | Decide | shipped | 2026-06-16 | |
| 112 | ✅ | DEC-02-LOOP | Critic as an explicit loop step | The Critic is a routable, gating-exempt agent-loop tool (`critic.evaluate`) | Decide | shipped | 2026-06-17 | full mission_steps DAG-node promotion deferred to Phase 2 |
| 113 | ✅ | F-STUDIO | Build engine | Repo reads, multi-file changesets, `studio/*` branches, PR + CI, gated merge | Build | shipped | - | |
| 114 | ✅ | I1 | Build multi-file coding (per-hunk accept/reject) | Operator curates a staged changeset before the gated commit | Build | shipped | 2026-06-16 | |
| 115 | ✅ | I1b | True revision history (atomic revisions) | Each commit records a revision; the Changes tab shows commit history with GitHub links | Build | shipped | 2026-06-16 | revert-to-revision delivered separately (K2) |
| 116 | ✅ | I2 | Watch-the-agents-build live surface | Live per-session cockpit: timeline/steer + Changes/PR/Cost + inline gates + merge gate | Build | shipped | 2026-06-16 | true SSE streaming deferred (nice-to-have) |
| 117 | ✅ | I3 | Branch/worktree isolation per mission | Concurrent missions cannot share a branch or clobber files (per-path claims + per-changeset branch) | Build | shipped | 2026-06-16 | |
| 118 | ✅ | J1 | Test generation + run | The Build agent authors tests per change; tests run in the connected repo's GitHub Actions CI | Build | shipped | 2026-06-16 | |
| 119 | ✅ | J2 | QA gate + self-correct loop | Merge refuses while CI is red or pending; the fix-on-red-until-green loop closes | Build | shipped | 2026-06-16 | |
| 120 | ✅ | K1 | Release notes for a shipped changeset | Generate/regenerate factual release notes via the AI chokepoint, persisted + shown | Build | shipped | 2026-06-16 | |
| 121 | ✅ | LRN-02 | Outcome reviews (predicted vs actual) | Human verdict + ICE rescore + a drafted Historian verdict (predicted vs actual) on the outcome card | Launch | shipped | 2026-06-17 | |
| 122 | ✅ | N3 | Mission Compounding View | Per mission: "drew on N prior memories" + the lineage + a copy-snapshot export | Launch | shipped | 2026-06-16 | |
| 123 | ✅ | W6 | Persona onboarding tracks | Per-track sample data + first-win moment (Solo / Founding PM / Tech Founder); WEDGE delivery surface | Monetization | shipped | 2026-06-17 | live-verify on next publish |
| 124 | ✅ | F-A2A | Internal A2A handoff contract | Agents hand off missions with structured payloads | Interop | shipped | - | |
| 125 | ✅ | F-GAUNTLET | Gauntlet metrics | The north-star metrics (acceptance, autonomy, retention), honestly instrumented | Cockpit | shipped | - | |
| 126 | ✅ | F-MEMVIEW | `/memory` compounding-memory view | The moat made visible | Cockpit | shipped | 2026-06-14 | |
| 127 | ✅ | F-AUTONOMY | AutonomyCard on Today | The trust arc (observing to proving to trusted) is visible to the operator | Cockpit | shipped | - | |
| 128 | ✅ | F-TODAY-LOOPPULSE | Loop Pulse hero | Today's hero opens with "while you were away" (last 24h, non-zero parts only) | Cockpit | shipped | 2026-06-16 | |
| 129 | ✅ | E8 | Loop Health Monitor | An always-on health strip on Missions: verdict + queue depth + last ingest/run | Cockpit | shipped | 2026-06-16 | |
| 130 | ✅ | B3 | Product switcher + portfolio view | A Portfolio section on `/product`: every product with loop status + click-to-switch | Cockpit | shipped | 2026-06-16 | command-K product-switch deferred |
| 131 | ✅ | B5 | Archive / delete product | Soft archive + restore + JSON export + honest export-then-delete | Cockpit | shipped | 2026-06-17 | |
| 132 | ✅ | F-AGENTS-MENTIONABLE | Agents as @-mentionable users | `@agentslug goal` in chat dispatches a specialist directly (skips the orchestrator) | Cockpit | shipped | 2026-06-18 | |
| 133 | ✅ | OPS-01 | Flow mode | Ambient soundscape + focus timer + notification quieting; a calm operating surface | Cockpit | shipped | 2026-06-16 | |
| 134 | ✅ | F-TRUST | Trust score + four autonomy arcs | Autonomy is earned and visible at the gate | Governance | shipped | - | |
| 135 | ✅ | FND-0.6 | Kill-switch + spend caps | The brake pedal; budgets enforced server-side | Governance | shipped | - | |
| 136 | ✅ | F-HUMANIZE | `humanizeText()` runtime sanitizer | Zero AI fingerprints in generated output, at the chokepoint | Governance | shipped | 2026-06-14 | |
| 137 | ✅ | DEC-02 | Critic adversarial pass on opportunities | Opportunities get a red-team ship/revise/kill verdict at promotion (CriticBadge) | Governance | shipped | 2026-06-16 | verified |
| 138 | ✅ | P4 | Eval harness + regression gate | A >=10pt eval drop per suite hard-blocks the agent's merge | Governance | shipped | 2026-06-18 | P4-GATE cycle 23 |
| 139 | ✅ | P5 | Drift watch | Score/cost/latency drift per surface/model; open incidents surface in the Attention feed | Governance | shipped | 2026-06-18 | P5-ALERT cycle 22 |
| 140 | ✅ | P3 | Prompt studio | Versioning + A/B + pin + rollback; runtime loads versioned prompts | Governance | shipped | 2026-06-18 | verified already built (was stale ⬜) |
| 141 | ✅ | C4 / E7 | Agent detail + run history + memory inspector | Pick an agent and see its recent runs + its private and shared memory | Governance | shipped | 2026-06-18 | a dedicated detail route is optional polish |

---

## Status reconciliation note
Statuses here are reconciled from [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (sections 0/2/3, the live cursor + status + build queue) and [`feature-backlog.md`](./feature-backlog.md) (granular ledger). Where docs conflict on a "done" claim, trust this file + the live code, then fix the others in the same commit. Granular acceptance criteria + "how to use / verify" blocks live in [`feature-backlog.md`](./feature-backlog.md); milestone exit criteria + the founder pickup list live in [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (sections 2-4); open bugs live in [`known-issues.md`](./known-issues.md). F-SHARE is one feature listed under both Decide (G2) and Monetization (G5); it is a single row here (Decide, shipped) per the register-one-row-per-ID rule.

## Related
- [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) - the ONE front-door tracker (live cursor, build queue, founder pickup list, findings, progress)
- [`feature-backlog.md`](./feature-backlog.md) - granular ledger + per-feature acceptance criteria
- [`workspace-tenancy-and-monetization-plan.md`](./workspace-tenancy-and-monetization-plan.md) - WM (G10) per-ID build specs incl. the credit engine (WM-M10..WM-M16, §4.2.1)
- [`byo-build-implementation-plan.md`](./byo-build-implementation-plan.md) - BYO (G11) per-phase build specs
- [`v10-master-blueprint.md`](../strategy/v10-master-blueprint.md) §15-16 + [`v10_implementation-plan.md`](./v10_implementation-plan.md) - the priority rationale + execution mechanics
- [`known-issues.md`](./known-issues.md) - open bugs with KI-IDs
- [`../../AGENTS.md`](../../AGENTS.md) §1 (pre-action) + §5 (doc-update protocol) - where the standing rule is enforced
