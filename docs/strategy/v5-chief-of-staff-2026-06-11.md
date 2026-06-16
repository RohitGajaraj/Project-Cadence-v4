# v5: The PM Chief of Staff Wedge (2026-06-11)

> **Status: current for the felt product (wedge UX, nav, vocabulary, demo).** This does **not** supersede [`v4-feature-map-2026-06-11.md`](./v4-feature-map-2026-06-11.md). v4 remains the expansion map (stations, 19-agent mesh, M2 to M5, enterprise plane). v5 governs what a user *feels* on day one and what ships by June 22. Founder-ratified 2026-06-11: identity = PM Chief of Staff · cut = mothball hard · ingest door = Slack. Decision entry: [`session-decisions.md`](./session-decisions.md).

---

## Why v5 exists

Founder verdict on the post-F-IA-V4 build: "overwhelming, disconnected, does not play the vital role." A three-agent audit (strategy canon · code reality · operator experience) confirmed:

- **The engine is real.** Signals → themes → opportunities (ICE) → Critic red-team → cited PRD → approval → auto-captured decision is wired end-to-end, zero mocks. About 24 minutes of genuine PM value in a first session. Chat NL-dispatch, approvals/kill-switch/budgets, decisions log, calendar, demo seed: all live.
- **The costume is the problem.** Roughly 50 to 70 navigable destinations serve a 19-agent org-OS story the code doesn't deliver: Govern exposes 9 engine-room tabs; Learn/Memory/Support are stubs; mission-start hides behind a chat classifier; Approvals are buried; the loop dead-ends at "GitHub issue created"; voice anchor saves but is never injected.
- **Strongest where the market is crowded, weakest where the whitespace is** (v4 stress-test F4), and the felt product exposes that instead of hiding it.

## The thesis

> **Cadence is the senior PM's Chief of Staff: it runs the evidence-to-decision loop every day.** Agents read everything that came in, surface the 2 to 3 calls that need the PM's judgment, each with cited evidence and a Critic challenge, draft the artifacts that follow from the call, and remember every decision and outcome so the next call is sharper. Agents execute behind approval gates; the human judges. The org-cockpit (multi-seat, build/launch/support stations, MCP/A2A) is the expansion path, sold later, hidden now.

**The daily ritual is the product.** Felt surface = **Today (the Calls queue) · Product (the work) · Knowledge (the contents) · Brain (the intelligence you talk to, see [`../features/brain.md`](../features/brain.md))** + a **Trust drawer** (kill-switch, budgets, approvals policy, Engine Room link). Everything else is engine room: intact, reachable, not navigation.

**UI vocabulary, five agents:** Scout (senses) · Strategist (ranks) · Critic (challenges) · Scribe (drafts) · **Chief of Staff** (orchestrates; UI rename of Orchestrator). The 19-agent mesh stays here in strategy as the expansion map. This realizes the constitution's "AI PM Chief of Staff" orchestrator and its smallest-viable-category mandate ([`../../Ai_Cofounder.md`](../../Ai_Cofounder.md)).

## Gap analysis (current state vs thesis)

| Bucket | What |
| --- | --- |
| **In place, keep, load-bearing** | Discovery spine (`src/lib/discovery.functions.ts`: cluster → promote → `runCritic` → `generatePrd` + RAG citations) · chat dispatch (`src/routes/api/chat.ts`) · governance substrate (approvals, kill-switch, budgets, traces, guardrails) · decisions auto-capture · Today substrate · calendar/meetings · demo seed · AI chokepoint + loop |
| **Overlapping, consolidate** | 7 surfaces × tabs ≈ 50 to 70 destinations for a 4-surface product · Missions/Agents/Today-Agents show the same runs three ways · tasks vs roadmap vs missions partially duplicate "work" |
| **Wrong role, mothball (hide, don't delete)** | Govern as 9-tab nav (→ Trust drawer + one Engine Room page) · `/build` canvas · `/learn` stubs · Memory stub tab · Agents-config page (→ simple roster sheet) |
| **Missing, build** | Slack ingest (the #1 "gives up" moment) · Calls-queue ritual on Today · Start-mission button (no classifier dependency) · loop-closure primitive (shipped echo → outcome → learning → visible re-score) · Memory Context pill on traces · voice anchor injection · cost chip on Today |

## The plan: phases A to E to June 22 (F-IDs)

| F-ID | Phase | Scope | Days |
| --- | --- | --- | --- |
| `F-V5-RITUAL` | A: The Ritual | Today rebuilt as the Calls queue: needs-you call cards (pending approvals + Critic-flagged opps/PRDs, evidence + verdict + inline Approve/Reject/Open); brief leads with "your 3 calls today" then overnight agent activity; **Start mission** button (direct `createMission`, no classifier); **cost chip** (today's spend from `ai_events`, Law 7 pulled forward); Approvals pinned to rail | 1 to 3 |
| `F-V5-MOTHBALL` | B: The Cut | Nav = Today · Product · Knowledge · Chat + Trust drawer; `/govern` → single Engine Room page (all 9 tabs intact, drawer-only access); `/build`, `/learn`, agents-config → `beforeLoad` redirects (F-IA-V4 pattern; reversal = 1 day); Memory stub tab removed; 5-agent vocabulary pass (Orchestrator → "Chief of Staff", UI strings + agent seed display names) | 2 to 4 |
| `F-V5-INGEST-WEBHOOK` (supersedes `F-V5-SLACK`) | C: The Door | **Founder ruling 2026-06-12: no Slack app. The universal webhook door IS the ingest strategy.** Per-workspace ingest token (generate/rotate/revoke on `/sync`) + public `POST /api/public/ingest-signals` (Bearer token, ≤50 signals/req) → signals stamped to the workspace → existing `signal.created` auto-pipeline routes to Scout. Anything that can POST feeds it (Zapier, Slack's own webhook tools, forms, scripts), no per-vendor OAuth connectors at the wedge stage. Shipped 2026-06-12; rate-cap + token hashing queued post-demo (KI-10) | 4 to 8 |
| `F-V5-LOOP-CLOSE` | D: The Loop | Shipped echo: GitHub issue closed ⇒ "shipped" event on PRD + outcome card (first write path in `outcome.functions.ts`); outcome check card → result entry → **learning** entry → **visible re-score** of related opportunities (M2's proof bar in miniature); Memory Context pill on trace detail (recalls already happen in `loop.server.ts`, surface them); voice anchor injected into prompt assembly. Absorbs prior release-notes/outcome-seeding gaps | 7 to 10 |
| `F-V5-DEMO` | E: Hardening | KI-02 forced-restart kill-test; full golden-path walkthrough on `demo@redcadence.app` (fix stumbles only, no scope); demo script against the seeded Lumen workspace | 10 to 11 |

**Explicitly deferred (logged, not lost):** FND-CHOKEPOINT-STREAM (chat through the chokepoint, first post-demo P0; chat is now the front door) · FND-TENANCY full RLS sweep · sandbox/CI/DR · PRD → engineering task graph · M3+ (roles, design scaffolds, MCP/A2A, portfolio) · support triage.

## Verification bars

1. **Ritual:** fresh demo login lands on Today showing ≥2 real call cards with evidence + Critic; approve one → action executes + decision logs without leaving Today.
2. **Door:** post in the connected Slack channel → signal appears, auto-clusters on next tick.
3. **Loop:** approve PRD → issue → close issue → shipped event + outcome card → enter result → learning exists and a related opportunity's score visibly changes.
4. **Cut:** nav shows 4 surfaces + drawer; `/govern`, `/build`, `/learn` deep links redirect; Engine Room reachable from drawer.
5. `bun run lint` + build green; KI-02 passes per [`../operations/fnd-runtime-restart-playbook.md`](../operations/fnd-runtime-restart-playbook.md).

## Related

[`v4-feature-map-2026-06-11.md`](./v4-feature-map-2026-06-11.md) (expansion map) · [`v4-stress-test-2026-06-11.md`](./v4-stress-test-2026-06-11.md) (diagnosis) · [`session-decisions.md`](./session-decisions.md) (rulings) · [`../planning/feature-backlog.md`](../planning/feature-backlog.md) (F-V5 board) · [`../planning/known-issues.md`](../planning/known-issues.md) (KI-01/02/03) · [`../../Ai_Cofounder.md`](../../Ai_Cofounder.md) (constitution) · [`../../plan.md`](../../plan.md) §4 (build log)
