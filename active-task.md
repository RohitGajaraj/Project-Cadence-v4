# Active task — Phase 1: "The Loop Runs Itself" (Agentic Product OS build)

> **✅ PHASE 0 ("Honest Wedge") COMPLETE 2026-06-13** — W1–W6 all shipped on **main**, build-green, 7-agent adversarial review passed, smoke-tested live on the demo Today. Build-log: [`plan.md`](plan.md) §4 (top entry). **Open gate (unchanged):** the W3 + W6 migrations (`20260613170000_w3_decision_reason`, `20260613180000_w6_demo_trusted_seed`) apply on the next **Lovable sync** — the seeded demo decision cards + `decision_reason` column land then; until then the demo shows its pre-existing pending gates (already verified rendering correctly).
>
> **Next up — Phase 1** ([`v6` doc](docs/strategy/v6-agentic-product-os-2026-06-13.md) §9): event-reactor auto-handoff across mid-loop hops; hop-failure retry/recovery; adaptive step budgets; a supervised end-to-end mission demonstrably runs unattended. Files: `src/lib/ai/loop.server.ts`, `handoff.server.ts`. This closes the gap between *claimed* and *wired* autonomy (Appendix B) — the `memory_refs[]` contract field (added in W5) gets populated here.

> **Handoff 2026-06-13.** Work directly on **main** (repo convention — all tools on main, no long-lived branches).
> **Canonical plan:** [`docs/strategy/v6-agentic-product-os-2026-06-13.md`](docs/strategy/v6-agentic-product-os-2026-06-13.md) — read **§9 (Phase 1)** + the runtime-reality audit in Appendix B.
> **Session read order:** `git pull origin main` → this file → v6 doc §9 → [`docs/README.md`](docs/README.md) (file-placement policy) → [`AGENTS.md`](AGENTS.md).

## State at handoff (main @ `0b721ab`)
- ✅ Docs reorganized + fully interlinked; **v6 = current positioning** everywhere; file-placement policy live in `docs/README.md` + all entry docs.
- ✅ Published Lovable app **verified healthy** (login renders, public env injected, no crash). `vite.config.ts` is the robust version (Lovable framework config + hardcoded public fallbacks) — **DO NOT touch it.**
- ⏸️ `lovable-sync-1781272474` branch is stale (52 behind) / superseded — **do not merge.**
- **Founder rulings (locked):** Agentic Product OS umbrella = PM Chief of Staff (felt entry) + Decision System (moat) · genuine autonomous end-to-end execution as North Star with **claim-never-outruns-wiring** · defer agent marketplace but keep the A2A contract · beachhead = senior/founding PM at A–C B2B SaaS · **Cadence = placeholder name** (Cadence ≡ Circuit) · **no hard date** (~45-day envelope; demoable milestone ~every 2 weeks).

## ✅ Phase 0 — DONE (dependency order W1 → W6, all shipped 2026-06-13)
**First (small):** ☑ `docs/strategy/session-decisions.md` entry recording the Agentic-Product-OS rulings (commit `ad23831e`). Then (all ☑ — see `plan.md` §4 for detail):
- ☑ **W1** delete sprint/kanban/capacity (`20836fc2`) · ☑ **W2** 5-agent vocabulary (`d59822b5`) · ☑ **W3** decision-first card (`c2fdc475`) · ☑ **W4** cold-start on-ramp (`5a1df53d`) · ☑ **W5** memory visible + `memory_refs[]` (`22224912`) · ☑ **W6** demo seed @ `trusted` (`da06bb65` + fix `d9952374`) · ☑ orchestration-tool consequences polish (`5731dcaa`).

<details><summary>Original Phase 0 checklist (kept for reference)</summary>

**First (small):** add a `docs/strategy/session-decisions.md` entry recording the Agentic-Product-OS rulings above (standing obligation). Then:

- **W1 — DELETE the human-PM-legacy surfaces.** `git rm` `src/components/product/RoadmapPanel.tsx` + `src/components/product/TasksPanel.tsx` + `src/lib/roadmap.functions.ts` (all 4 roadmap server fns are used only by RoadmapPanel — the whole file is safely deletable). Strip `roadmap`/`tasks` from the `Tab` union / `TABS` / `PRODUCT_DESC` / imports / render branches in `src/routes/_authenticated.product.tsx`. Repoint `/roadmap` + `/tasks` to redirect stubs (do **not** delete the route files → avoids `routeTree.gen.ts` desync). ⚠️ **Today shares the `tasks` table** (`_authenticated.index.tsx` has its own task-capture list + "Tasks shipped" tile reading `tasks`): delete the product-tab kanban + sprint planner ONLY; **keep the `tasks` table + Today's list.** Audit `["roadmap"]`/`["tasks"]` query-key invalidations before removing.
- **W2 — 5-agent vocabulary.** Map internal agent slugs → the 5 user-facing names (Scout · Strategist · Critic · Scribe · Chief of Staff) at the **display layer only** (`src/lib/agent-vocabulary.ts`). ⚠️ **Do NOT rename DB slugs** (rename-disclaimer pattern: internal identifiers stay).
- **W3 — Decision-first card.** New `src/components/today/DecisionCard.tsx` per Appendix D — collapsed = `the call as a question → evidence count + Critic verdict → [Approve][Open]`; fields: question · cited/countable/click-through evidence · Critic verdict · what-happens-if-approve (blast radius) · cost · model · undo path; actions Approve / Reject(+reason) / Open / Defer. ⚠️ It **enriches the existing `getNeedsYou` queue** (`src/lib/today.functions.ts`, rendered ~`index.tsx:418-597`) — not greenfield. Reuse `CriticBadge`.
- **W4 — Cold-start on-ramp.** Narrated empty-Today state that IS the on-ramp ("forward me your last 20 pieces of feedback and I'll surface your first calls"), gated on real emptiness. Fixes the self-serve <10-min wow that the webhook-only ingest decision broke.
- **W5 — Memory visible + A2A field.** Surface the loop-closure re-score (Memory Context pill on trace detail + a Today line). ⚠️ **The re-score already happens** in `src/lib/outcome.functions.ts:200-253` (writes `learnings` prior_ice→new_ice) — surface it, don't rebuild. Add the missing `memory_refs[]` field to `HandoffPayload` in `src/lib/ai/handoff.server.ts` and thread it through.
- **W6 — Demo seed @ `trusted`.** Migration inserting `agent_autonomy` rows at `arc='trusted'` for the demo account's 5 agents + seed one real overnight mission. ⚠️ `loadAgentArc` returns `observing` when no row exists (`src/lib/ai/trust.server.ts:194`) → without explicit rows the demo silently review-gates every action. Do **NOT** seed `ambient` (that auto-executes everything and removes the calls that ARE the wedge).

</details>

## Standing rules (non-negotiable, carry into Phase 1)
- Work on **main**; commit small with a one-line **WHY**; push so other tools pulling main see it.
- **Claim never outruns wiring** — no "fully autonomous" copy anywhere. Voice: *"the loop runs the reversible work; you make the calls."*
- **File-placement policy** (`docs/README.md`): every new file → correct subfolder + linked from that folder's index, same commit; never repo root or `docs/` top level; no duplicates/stubs; screenshots local-only under `docs/screenshots/`.
- Closed-doc loop: update `plan.md` §4 + the relevant doc in the **same commit**.
- Scan skills/agents/plugins/MCP before each task (AGENTS.md §2).

## Verify (Phase 0 done bar)
- `bun run lint` + `bun run build` green.
- Fresh `demo@redcadence.app` / `Cadence!Demo2026` login lands on **Today** with ≥2 real decision-first call cards (evidence + Critic verdict); approve one → executes + logs the decision without leaving Today; **no sprint button, no kanban** anywhere; an empty/new workspace shows the cold-start on-ramp.

## Inherited open gates (carry forward — full tracker: `docs/planning/known-issues.md`)
- **KI-13:** live signup 500s (`handle_new_user`) — demo creds only; no new real accounts. First-run onboarding unreachable for real new users.
- **Migration-apply via Lovable sync:** unapplied migrations (incl. W6's `agent_autonomy` seed) land when the Lovable project syncs `main` + deploys — same window as the prior F-STUDIO / F-V5-LOOP-CLOSE gates. Write reads pre-migration-tolerant where adjacent.
- **KI-14:** eval score scale mixed (seeds 0–1 vs runner 0–100).
