# v4 Stress Test — Arguing Against Our Own Product (2026-06-11)

> **What this is.** The commissioned adversarial review of Circuit as it stands (post v3, post F-COCKPIT-MERGE). Written from the seats of a founder, a senior PM end-user, an investor, and a frontier-lab strategist. Every verdict here feeds the v4 feature map ([`v4-feature-map-2026-06-11.md`](./v4-feature-map-2026-06-11.md)).
>
> **Method.** Full doc read + src inventory (34 routes, 40 server-fn domains, agent runtime), market research ([`../references/competitive-landscape-2026-06-11.md`](../references/competitive-landscape-2026-06-11.md)), and the founder's own complaint: "overwhelming, not demo-ready, no storyline, I don't know where I'd start."

---

## The one-line verdict

**Circuit has built an engine room and called it a ship.** The substrate (chokepoint, orchestrator DAG, reactor, trust stack, builder CI loop) is genuinely ahead of most seed-stage agent startups — and the user experience exposes that substrate as 34 navigation destinations instead of hiding it behind one simple promise. The result: real capability, zero felt story.

## What survives the stress test (keep, don't rebuild)

1. **The thesis.** "Agents execute, humans govern" over the closed product loop is validated by the market: the bottleneck has moved from engineering to product alignment, the lifecycle whitespace is real, and trust/verification burden is the #1 reported pain with AI tools. Do not pivot the thesis.
2. **The chokepoint + pluggable model substrate** (`runtime.server.ts`). This is the frontier-absorption mechanism: when a lab ships a PM-tuned frontier model, it becomes a routable brain here. Architecture is correct.
3. **The trust stack** (traces, evals, guardrails, budgets, approvals, checkpoints, idempotency). Enterprises require it; 35% of product teams have no AI policy — we sell them one, embodied.
4. **The orchestration spine** (missions → mission_steps DAG → handoffs → reactor). This is the hardest thing to rebuild and it exists.
5. **Tenancy + RLS discipline.** Workspace/product isolation done early = enterprise-ready later without a rewrite.

## Where it fails — argued

### F1. The IA is the org chart of the plumbing (founder's complaint, confirmed)

34 routes: agents, analytics, briefing, budgets, build, calendar, chat, cockpit, discovery, docs, drift, evals, governance, guardrails, inbox, integrations, meetings, missions, observe, opportunities, outcome, prds, prompts, roadmap, settings, swarm, sync, tasks, traces… Claude Code is a text box. Perplexity is a text box. Lovable is a text box. **Circuit is a filing cabinet.** Every internal subsystem became a nav item. Nobody can demo a filing cabinet. → **Verdict: collapse to 7 user-facing surfaces; everything else becomes tabs inside context or moves to Settings** (spec in feature map §7).

### F2. There is no golden path

A first-run user lands on Today and is invited to explore. Nothing carries them from intent to outcome. The 3-minute demo ("signal → opportunity → spec → tasks → PR → CI green → release note → learning") exists as *capabilities scattered across routes* but not as *one continuous, watchable run*. → **Verdict: M1 is a single demo spine, not more features** (feature map §9).

### F3. Agents are configured, not embodied

The platform treats agents as infrastructure to set up (roster CRUD, prompts, schedules) rather than staff you meet. A new user must understand "agents" before getting value — backwards. The PM's job-to-be-done is "run my day," not "configure a swarm." → **Verdict: outcomes first; the roster works out-of-the-box with zero config; configuration is progressive disclosure for power users.**

### F4. The loop's right half is scaffolding

S7 Visual QA, S9 GTM, S10 Support, S11 Analytics, S12 Learn are placeholders or thin reads over existing tables (`/outcome` renders approvals as "Launches"). The closed loop — the entire differentiation — is half-open. Meanwhile the left half (discover→define→plan) is the *commoditizing* half (Dovetail, Productboard, ChatPRD all do pieces). **We are strongest where the market is crowded and weakest where the whitespace is.** → **Verdict: M2 prioritizes the right half: support triage, analytics ingest, GTM drafting, learning re-score — as real agents with real connectors.**

### F5. Signal ingestion — the loop's front door — has no real doors

Paste/CSV exists; Intercom/Zendesk/Slack/app-store/analytics connectors don't. A "continuous discovery feed" without continuous sources is a demo with a hose pointed at it. → **Verdict: 3 real ingest connectors (Slack, Intercom or Zendesk, GitHub issues) + 1 analytics source are M1/M2 blockers.**

### F6. Multi-stakeholder is claimed, single-player is built

Six personas in the docs; one role in the schema ("future: roles/teams"). The designer/GTM/support/exec value props have no surfaces. For PLG this is survivable (the wedge IS the solo PM) — but approval routing by role is the heart of "humans govern" for teams. → **Verdict: M1 stays deliberately single-player (PLG wedge); M3 ships roles + per-persona approval lanes; do not pretend otherwise in positioning.**

### F7. Vocabulary drift erodes trust

Mission/Run/Trajectory/Step/Trace; Agents/Swarm/Specialists; Approvals/Inbox/Attention queue. The words won't hold still, so the mental model can't form (v3 language audit found this; it's still partially true). → **Verdict: one glossary, enforced — adopted in feature map §8; every surface uses Mission · Agent · Approval · Trace, nothing else.**

### F8. Cost story unproven

Continuous swarms reacting to every event = unbounded token burn. Budgets exist as caps, but there's no cost-per-outcome telemetry ("this shipped feature cost $14.20 of agent work"). PLG users will churn on the first surprise bill; enterprises will demand predictability. → **Verdict: cost-per-mission and cost-per-artifact become first-class UI; small-model routing defaults; budget-aware degradation.**

### F9. The moat needs the memory flywheel running

"Compounding Product Memory" is pitched, but the memory graph (X4) is mostly tables, not a queryable, agent-consulted institution. Until agents demonstrably *get better because they remember*, the moat is a slide. → **Verdict: M2 makes every mission consult memory before acting and write a learning after; show the consultation in the trace.**

### F10. Frontier-lab scenario (the founder's wipe-out test)

If Anthropic/OpenAI ships "PM mode" tomorrow: a chat that writes PRDs, plans, analyses. What dies: point doc-generation (ChatPRD's lane). What survives: the system of record + action (connectors into the org's real tools), governance/audit, tenancy, memory, the mission runtime, and cross-stage orchestration. **We survive if and only if our value is in the loop, not in any single generation step.** → **Verdict: every station in the feature map declares its frontier-absorption path (native agent ↔ plug-in external agent ↔ frontier model as brain). A lab launch should be a free capability upgrade routed through the chokepoint.**

## Investor-lens scorecard (secondary, per founder weighting)

Vision 8/10 · Substrate 8/10 · Whitespace fit 9/10 · **Felt product 3/10 · Demo-ability 3/10 · Loop closure 4/10 · Cost credibility 4/10**. The gap between the first three and the last four is the entire v4 agenda.

## What v4 must do (carried into the feature map)

1. Collapse the IA to 7 surfaces with one golden path (M1).
2. Close the right half of the loop with real agents + real connectors (M2).
3. Make memory consulted-and-written on every mission (M2).
4. Ship roles + persona approval lanes (M3), then portfolio/enterprise (M4).
5. Declare native/pluggable/frontier paths per station — never compete with models.
6. One vocabulary. One storyline. Cost on every artifact.
