## Goal

Deliver a brutally honest, end-to-end audit of Cadence that (a) walks the running app as a first-time governor, (b) benchmarks against the agent-OS / agent-build / product-OS landscape, (c) challenges the current thesis where it deserves challenge, and (d) lands as a versioned strategy document the swarm can read on the next session — plus a tight executive summary inline in chat.

No code will be written in this audit. All recommendations get **Impact × Effort × Horizon × Strategic importance × Primary benefit** tags and a Top-5 / Top-10 / Top-20 rollup so the team can act.

---

## What I will read and walk (evidence base)

**Repo (already partly loaded):**
- `README.md`, `docs/strategy/v2-positioning-2026-06-02.md`, `docs/strategy/session-decisions.md`
- `plan.md` §1–6, `docs/feature-backlog.md` Live status board + Build-order rollup
- `architecture/{runtime,orchestration,frontend,data,security,integrations}.md`
- `design.md` + `src/styles.css` tokens
- All 31 authenticated routes under `src/routes/_authenticated.*` — read each to map IA, surface intent, redundancy, and dead ends
- `src/components/cadence/AppShell.tsx` (nav IA), `CommandPalette.tsx`, `MissionGraph.tsx`
- Server-fn surface in `src/lib/*.functions.ts` (what's actually wired vs. just routed)
- `docs/references/competitive-reference.md` + `docs/considerations.md`

**Live preview walk** (as a brand-new operator on `demo@redcadence.app`):
- `/login` → `/` (Today) → can I tell what this product is in 10 seconds?
- Sidebar pillar-by-pillar: Workspace · Discover · Deliver · Agents · AI Ops · Govern · Settings
- Critical surfaces: `/briefing`, `/discovery`, `/opportunities`, `/prds`, `/roadmap`, `/build`, `/agents`, `/missions`, `/swarm`, `/inbox`, `/governance`, `/traces`, `/evals`, `/drift`, `/budgets`, `/integrations`, `/chat`, `/analytics`
- Capture screenshots of each surface for the audit (embedded in the doc as references; not committed images)
- Try to actually run a mission end-to-end: signal → opportunity → PRD → build → ship → learn. Note exactly where the loop breaks.
- Hit each empty state on a fresh workspace to test first-run UX.

**Competitive research** (spawned in parallel as read-only background subagents — each returns a focused brief, none of it bloats my context):
- **Engineering-autonomy lane:** Factory.ai (Droids), Cognition Devin, Replit Agent, Cursor Agents, Lovable itself, Bolt, v0, OpenAI Codex, Claude Code, Augment
- **Product-OS / PM lane:** Linear (Agents + Skills), Productboard AI, Notion AI, Coda AI, Height Copilot, Airtable AI, Monday AI
- **Agent-OS / orchestration lane:** LangGraph Platform, CrewAI Enterprise, AutoGen Studio, Vellum, Sema4 (formerly Reworkd), Lindy, Relevance AI, Stack AI, n8n + agents, Make
- **Governance / trust-stack lane:** Langfuse, Braintrust, Arize Phoenix, Weights & Biases Weave, Helicone, Maxim AI, Patronus, Lakera
- **Adjacent inspirations the user named:** Paxel (YC W25 — Human/Machine mode)
- For each: positioning, wedge, UX model, governance posture, what they own, what they don't, what they teach us

---

## Audit framework (the deliverable's structure)

The doc will follow the framework the user laid out, in this exact order:

```text
0. Executive Summary (1 page, brutal)
1. Top 10 Critical Findings (ranked by user × business impact)
2. Core Problem & Value Proposition audit
   - "What is this?" 10-second test
   - Positioning vs. v2 doc — is the product the positioning?
3. UX & Product Flow audit
   - IA tree (current 6-pillar nav, 31 routes)
   - Cognitive-load map per surface
   - Empty-state inventory
   - The closed-loop walk: where it breaks, why, and at which seam
4. AI-Native & Agent-First experience
   - Human-mode vs. Machine-mode (Paxel-inspired) recommendation
   - MCP / A2A / structured-output readiness
   - Where the product still puts a human in the middle
5. Feature Rationalization matrix
   - Must Have · Nice to Have · Differentiator · Commodity · Merge · Remove · Missing
   - Special call-out: 31 authenticated routes — which collapse, which die
6. Dashboard & Visual experience (incl. `/` Today, `/swarm`, `/missions`)
7. User Journey maps × 7 personas (first-time, returning, power, enterprise, founder, investor, AI agent)
8. Market & Competitive positioning (post-research synthesis)
9. Technical & AI readiness (chokepoint, orchestration, scaling risk)
10. Investor lens — what a YC partner asks, what concerns them, what excites
11. Hidden Assumptions Audit (e.g. "three equal personas" — is that focus or hedge?)
12. Missing Opportunities (network effects, growth loops, retention loops)
13. Thesis Challenge (since user asked) — three alternative positionings stress-tested against current one
14. Rebuild-from-scratch exercise — keep / remove / merge / redesign / introduce
15. Prioritized Roadmap
    - Top 5 (this week / next 2 weeks)
    - Top 10 (1–2 months)
    - Top 20 (3–6 months)
    - With Impact × Effort × Horizon × Strategic-importance × Primary-benefit on every item
16. Investor Readiness Scorecard (Problem · Market · Product · UX · AI · Differentiation · Scalability · Vision — 1–10 each, with the why)
```

Every recommendation will be tagged like:

```text
[REC-014] Collapse /traces + /analytics + /drift into one "Observability" surface
  Impact: High   Effort: Medium   Horizon: 1–2 months
  Strategic: Important   Benefit: Product Clarity, UX
  Why: three nav items, one mental model; cost of fragmentation > cost of merge
```

---

## Specific things I will challenge (since you said "challenge the thesis")

These are flagged now so you know the audit isn't going to be polite:

1. **"Three equal personas."** Three equal primaries on day one usually means none. I will test whether the Solo/Lead PM, Founder-as-PM, and Technical Founder actually share a wedge — or whether the product is hedging.
2. **"Autonomous product OS."** Is "OS" earned by the current product, or is it aspirational language a Linear + Cursor + Langfuse stack already covers? I will pressure-test the moat against a hypothetical "Linear ships an end-to-end agent" scenario.
3. **31 authenticated routes.** A "calm, single-purpose app" with 31 routes is a contradiction. I will propose a target IA (likely ~8–12 surfaces) and name what dies.
4. **The "watch the agents build" promise.** Is it delivered, or is `/swarm` + `/missions` + `/build` + `/traces` four half-built versions of one idea?
5. **Governance-first as a wedge.** Compelling for enterprise; possibly invisible to the SMB/founder personas you've named primary. There may be a positioning mismatch.
6. **Human-mode vs. Machine-mode (Paxel).** I will recommend whether to adopt this as a real product surface, not just a label — and what it would replace.
7. **Product Memory as moat.** Test: if a competitor exports their own graph in a week, does Cadence's lead survive?

---

## Deliverables

**1. Committed repo doc:** `docs/strategy/v3-audit-2026-06-06.md`
- Full audit in the structure above
- Updates `docs/strategy/README.md` index
- Adds a one-line entry to `docs/strategy/session-decisions.md` referencing the audit
- Updates `docs/feature-backlog.md` Live status board "Last updated" + "Recent log"
- Does **not** add new features to the backlog automatically — recommendations live in the audit and graduate to backlog items only on your sign-off (separate session)

**2. In-chat executive summary** (~1 page) covering:
- The 5 sharpest findings
- The Top-5 immediate actions
- The single biggest thesis risk
- A one-paragraph "if I had to rebuild this in 8 weeks" answer

**3. No code changes.** Audit only. Implementation goes through normal backlog flow after you triage the recommendations.

---

## Process & timing

- Spawn 3 parallel background agents for competitive research (engineering-autonomy lane / product-OS lane / agent-OS + governance lane) — each returns a 1-page brief, runs while I do other work
- Walk the live preview surface-by-surface in parallel with reading the remaining repo docs
- Synthesize → draft audit → land both deliverables in one message
- Expected wall-clock: a single long working turn after you approve this plan

If you'd rather narrow scope (e.g. skip the rebuild exercise, drop investor scorecard, or limit competitive set), say so and I'll trim before starting.

