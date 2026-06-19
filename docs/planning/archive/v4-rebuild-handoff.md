> ARCHIVED 2026-06-17. Superseded by [the v10 master blueprint](../../strategy/v10-master-blueprint.md) and governed by the [role map](../../strategy/README.md). Kept for history only; do not use for current decisions. Internal links may be stale.

# v4 Rebuild — Session Tracker & Handoff (2026-06-11)

> _Created: 2026-06-11 · Last updated: 2026-06-19_

> **What this is.** The progress log + resume instructions for the v4 "agentic feature map rebuild" activity commissioned by the founder on 2026-06-11. If you are a fresh AI session (Claude / Lovable / Antigravity / any account) picking this work up: **read this file first**, then follow "How to resume" below. Do NOT redo completed steps — their outputs are linked.
>
> **The founder's brief (condensed).** Stress-test the current feature set; rebuild the end-to-end feature pipeline so EVERY lifecycle step is run by AI agents (human-in-loop only at governance gates); think L0→L5 detail across all stakeholders (PM core + design, eng, QA, GTM, support, growth, research, analyst); one unified platform, no context-switching; multi-model pluggable substrate; simple front / powerful engine (Claude Code, Perplexity, Lovable as inspiration); restructure + cross-reference all docs so any dev tool can build from them without context loss; current features are not demo-ready and the IA is overwhelming — fix the storyline; include a focus/ambient extra (e.g. subtle music) where relevant.

---

## Decisions taken this session (founder-confirmed)

1. **Naming: DEFERRED to the final activity.** Founder rejected Rigel/Tanager/Sittella/Perihelion (and earlier Cadence/Cadence are conflicted). **"Cadence" stays the interim working name** in all docs, with the existing rename disclaimer. Fresh naming directions logged in [`../decisions/naming.md`](../decisions/naming.md). Do not block any work on naming.
2. **GTM: PLG wedge → enterprise.** Land with the individual senior PM (self-serve, 10-minute wow), expand team → org. Enterprise governance (SSO, audit, budgets) built into the architecture from day 1, sold later. Founder weighting: **pain-point/end-user first, investor framing secondary.**
3. **Future-proofing rule (founder mandate):** at every platform node, define (a) native agents, (b) pluggable external-agent slots (MCP/A2A), and (c) the frontier-absorption path — if a lab ships a "PM frontier model" or PM-specialized agents, it plugs into the chokepoint as a routable brain and *strengthens* the platform. Solutioning at every level must keep this in mind.
4. **No version gating (V1/V2).** Plan end-to-end full scope; sequence by milestone (M1…M5), each milestone independently demo-able.

## Progress checklist (update as steps complete)

- [x] **Step 1 — Read all project docs.** Core docs read (README, plan.md §1–4, v3 positioning, backlog structure, AGENTS.md structure, naming.md, active-task.md); full doc + src sweep done via subagent. Key facts: 34 authenticated routes, 40 server-fn domains, orchestrator + mission_steps DAG + event reactor + swarm HUD + builder CI loop + full trust stack already exist; substrate ~solid, UX/story is the bottleneck.
- [x] **Step 2 — Doc/source sweep.** Done (subagent). Notable: duplication is intentional pointer files; gaps flagged: 18 agents vs 4-persona roster mismatch, fragmented observability surfaces, undefined Human/Machine mode, naming drift (Mission/Run/Trajectory).
- [x] **Step 3 — Market + competitor research.** Output: [`../references/competitive-landscape.md`](../references/competitive-landscape.md). Headline: end-to-end agent-run PM lifecycle is whitespace; feedback layer commoditizing; build layer solved ($48B vibe-coding); MCP table stakes; governance is the differentiator; bottleneck moved from engineering to product alignment.
- [x] **Step 4 — Stress-test verdict.** Output: [`../strategy/archive/v4-stress-test.md`](../strategy/archive/v4-stress-test.md).
- [x] **Step 5 — End-to-end agentic feature map (L0→L5).** Output: [`../strategy/archive/v4-feature-map.md`](../strategy/archive/v4-feature-map.md). **This is now the strategic source of truth** (supersedes v3 positioning for feature scope).
- [x] **Step 6 — Naming.** Deferred by founder decision; fresh candidate directions + criteria logged in [`../decisions/naming.md`](../decisions/naming.md). Final pick = last activity before launch.
- [x] **Step 7 — Doc rewrites + cross-referencing.** README.md, plan.md (§1–3 feature scope + build order + log entry), design.md (IA contract), docs/planning/feature-backlog.md (v4 overlay section), CLAUDE.md/GEMINI.md/ENTRY.md/AGENTS.md read-order pointers, session-decisions entry.
- [x] **Step 8 — Cross-reference verification.** All links checked; naming consistent (Cadence interim + deferred-rename note); build log appended.

## How to resume in a fresh session

1. Read this file, then [`../strategy/archive/v4-feature-map.md`](../strategy/archive/v4-feature-map.md) (the new source of truth), then [`plan.md`](../../plan.md) §3 (build order) and [`feature-backlog.md`](./feature-backlog.md) (Live status board).
2. Whatever step above is unchecked: do it next, then check it off here and append a line to plan.md §4 (build log).
3. If all steps are checked: this activity is CLOSED. Next work = **Milestone M1 "The Golden Path"** per the feature map §9 — start with the IA collapse (`F-IA-V4`) and the demo spine. Use Lovable for UI-heavy slices, Claude Code/Antigravity for server/agent slices (per AGENTS.md §10).
4. Standing open ops item (unrelated to this rebuild): calendar OAuth client IDs — see [`../decisions/calendar-oauth-credentials.md`](../decisions/calendar-oauth-credentials.md).

## Doc map after this rebuild (what changed where)

| Doc | Role after v4 rebuild |
| --- | --- |
| `docs/strategy/archive/v4-feature-map.md` | **Canonical feature scope + agent mesh + IA + milestones (read before any feature work)** |
| `docs/strategy/archive/v4-stress-test.md` | Why v3 wasn't enough — the argued verdict |
| `docs/references/competitive-landscape.md` | Market research with links (don't re-research) |
| `plan.md` | Thin pointer to the v4 map for scope; build order; ACTIVE BUILD LOG stays here |
| `docs/planning/feature-backlog.md` | Ticket-level F-IDs; v4 overlay section maps backlog → stations |
| `README.md` | Product thesis, updated to v4 framing |
| `docs/strategy/archive/v3-positioning-cadence.md` | Historical — superseded by v4 for scope; persona definitions still valid |
| `docs/decisions/naming.md` | Naming deferred; fresh directions; final activity |
