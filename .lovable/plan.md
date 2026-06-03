
# YC Showcase Scope — Cadence Core Demo Set

This plan picks the **smallest feature set that proves the thesis** for a YC application: *agents run the product lifecycle; humans govern. Agents talk to agents, hand work to agents, and finish missions end-to-end.* Everything outside this list is explicitly **out of scope for the YC demo cut** and stays in the backlog for later.

## 1. The problem we're solving (one paragraph for YC)

Today a PM (or founder acting as PM) is the human glue across 10–15 disconnected tools: discovery in one place, specs in another, tickets in a third, build/ship somewhere else, GTM and support in yet more. AI copilots help one step at a time but **a human still relays context between every step**. Cadence removes that glue layer: a swarm of specialist agents runs discover → define → plan → build → ship → support → learn as one continuous loop, **communicating and handing off to each other**, while the human only approves the calls that matter. The moat is the governed end-to-end loop, not the model.

## 2. The "demo-able core" — 8 capability bundles

These are the **must-show** capabilities. Each is a bundle of existing backlog IDs from `docs/feature-backlog.md`, re-grouped around what a YC reviewer needs to see in 90 seconds.

| # | Capability bundle (what the demo shows) | Why it's core for YC | Backlog IDs that compose it |
|---|---|---|---|
| **1** | **Governed foundation** — tenancy, AI chokepoint, trust tables, kill-switch, mission spend caps, approval gates | Proves "governance is a first-class product layer," not a slide | 0.1, 0.2, 0.3, 0.5, 0.6 ✅, 0.7 ✅, A1/A2, X3 |
| **2** | **Strategic Briefing surface** | The single place the human sets intent; every agent reads it as operating context. This is the "humans govern" entry point. | New (from v2 positioning §8) |
| **3** | **Agent roster + Trust Score + Autonomy Dial** | Makes "agents are operators, not tools" visible. Reviewer sees a team, not a chatbot. | C1–C4, C6 (new) |
| **4** | **Agent-to-Agent comms + handoff + sub-agent spawning** ⭐ | The thesis. Orchestrator spawns specialists, they message each other, hand missions across stages with zero context loss. | E1, E2, E3, E4, E5 |
| **5** | **Live Mission Graph** ("watch the agents work") | One screen showing the swarm: who's doing what, cost, status, where approval is needed. This is the screenshot for the YC deck. | E6, X1 |
| **6** | **One vertical end-to-end slice** — Discover → Define → Plan executed by 3 agents handing off | Proves the loop actually runs, not just that the parts exist. Uses real seeded signals. | F1–F3, G1, H1 |
| **7** | **Decision Queue + approval gates** | The "humans govern" surface. Every high-risk action shows up here with rationale + lineage. | D3, P-approvals |
| **8** | **Product Memory + lineage + full data export** | Proves the compounding-value + anti-lock-in story (key positioning point from v2). | O1, O2, "Full Data Portability" (v2 §8) |

**Explicit deferrals** (great features, NOT in the YC demo cut): autonomous Build/Test/Ship (S4–S6 / I, J, K), GTM/Launch (L), Support (M), MCP/A2A external interop (Q), advanced eval/drift/guardrail UIs beyond what the chokepoint already does, multi-product portfolio view, BYO keys UI, billing. Cite these as "on the roadmap; foundation is built (chokepoint, trust stack, orchestration)" — reviewers reward focus.

## 3. The agent-to-agent story (the centerpiece — Capability #4)

This is what YC will ask about. The demo needs to show all four primitives working together, not as separate features:

1. **Sub-agent spawning** — Orchestrator receives a mission, decomposes it, spawns ephemeral specialists. (`E1`)
2. **Structured A2A messaging** — agents pass typed messages (not free-text relay) inside a mission. (`E2`)
3. **Mission handoff with full context** — Discovery agent → Strategist agent → Planner agent, each receives the prior agent's artifacts + memory + open questions. Zero human in the middle. (`E3`)
4. **Parallel sub-agents + parallel sessions** — multiple specialists on one mission; multiple missions in flight. (`E4`, `E5`)
5. **Mission Graph** as the operator surface — live DAG of all of the above. (`E6`)

This is the screenshot/video that goes in the YC application. Everything else supports it.

## 4. The 90-second demo script (what the reviewer sees)

```text
0:00  Operator opens Cadence. Strategic Brief is already set (north star + constraints).
0:10  Operator types one intent: "Find the top 3 churn drivers and propose a sprint."
0:15  Orchestrator agent receives it, spawns: Discovery → Strategist → Planner.
0:25  Mission Graph appears. 3 agent nodes light up in parallel where possible.
0:35  Discovery agent finishes, hands off themes+citations to Strategist (visible A2A message).
0:50  Strategist drafts opportunities, hands off to Planner.
1:05  Planner proposes sprint. ONE item flagged "needs approval — affects roadmap."
1:10  Operator clicks Approve in Decision Queue. Mission completes.
1:20  Operator opens Product Memory — sees the lineage: signal → theme → decision.
1:25  Click "Export" → JSON downloads. (Anti-lock-in proof.)
```

Every second of this script maps to one of the 8 capability bundles in §2.

## 5. Build-order proposal (sequencing the demo cut)

The foundation (Capability #1) is already mostly built — `0.6` kill-switch and `0.7` injection are ✅. The remaining sequence:

1. **Finish foundation gaps** — `0.9` durable runtime (long missions can't die mid-handoff), `0.2` cache stage. *(Already next-up on the status board.)*
2. **Strategic Briefing surface** (Capability #2) — small, high-leverage, unblocks "agents read shared context."
3. **Agent roster UI + Trust Score skeleton** (Capability #3) — read-only first; the scoring math comes later.
4. **A2A messaging + handoff primitives** (Capability #4) — the protocol + DB tables + tracing. This is the hardest piece; budget the most time here.
5. **Mission Graph** (Capability #5) — the visualization on top of #4. Without #4 it's a fake screenshot; with #4 it's the demo.
6. **Vertical slice: Discover → Define → Plan** (Capability #6) — wire 3 existing agents through the new handoff primitives. Uses real seeded data.
7. **Decision Queue polish** (Capability #7) — already partly exists; make it the obvious "govern here" surface.
8. **Product Memory lineage view + Export button** (Capability #8) — small UI on top of existing tables.

## 6. What I need from you before building

Three quick decisions so the plan is unambiguous:

- **Q1 — Demo persona.** Pick ONE of the three v2 personas to script the demo around (Solo PM / Founder-as-PM / Technical Founder). Recommend **Founder-as-PM** — it's the strongest YC narrative ("run the org you can't afford to hire") and it justifies the full lifecycle ambition.
- **Q2 — Cut depth.** Are we OK explicitly deferring autonomous Build/Test/Ship (S4–S6) from the YC cut? I recommend yes — claiming end-to-end *autonomous coding* without a polished demo of it will hurt more than help. Position as "foundation built, next milestone."
- **Q3 — Demo data.** Do you have a real product (yours or a design partner's) we can seed signals/specs from, or do we ship a polished synthetic dataset? Real beats synthetic for YC every time, even if small.

Once you answer, the next plan will break each of the 8 capability bundles into concrete backlog tickets with `active-task.md`-ready sub-steps, and I'll close the doc loop into `docs/feature-backlog.md` + `plan.md` §4 + `docs/strategy/session-decisions.md` in the same unit of work.

## Out of scope (for this plan only)

- Writing any code or migrations.
- Rewriting positioning (v2 doc stands as-is).
- Re-ordering the existing `0.x` foundation backlog — only choosing what's *demo-required*.
- Pricing, naming, YC application copy itself.
