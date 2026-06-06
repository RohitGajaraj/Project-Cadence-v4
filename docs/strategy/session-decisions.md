# Strategic Decisions Log

> **What this is.** A running record of major strategic decisions, tradeoffs evaluated, and facts presented during development sessions. Not a transcript — only decisions that shaped the product direction, architecture, or operating model.
>
> **Who reads this.** Any agent or human starting a new session who needs to understand *why* things are the way they are without re-reading the full conversation history. This file is a shortcut to institutional reasoning.
>
> **Update rule.** When a session produces a strategic decision, a major tradeoff resolution, or a significant positioning or architecture change — add an entry here in the same session. This is not a one-time activity; it is a constant update obligation. Reference: `docs/strategy/README.md` (cascade rule).
>
> **Cross-references.** Versioned positioning: [`v2-positioning-2026-06-02.md`](./v2-positioning-2026-06-02.md). Feature backlog: [`../feature-backlog.md`](../feature-backlog.md). Operating rules: [`../../AGENTS.md`](../../AGENTS.md).

---

## How to add an entry

```
### YYYY-MM-DD — Short title of the decision
**Decision:** What was decided.
**Why:** The reasoning, constraints, or facts that drove it.
**Tradeoffs considered:** What was ruled out and why.
**Impact:** Which files, features, or behaviors changed as a result.
```

---

## Decision log

### 2026-06-06 — Defer UI/UX revamp; commit to F-AGENT-1→4 agent-ecosystem bundle

**Decision:** Pause Restructure Phases 3–4 (Cohere editorial restyle of remaining ~18 routes) and ship the four-step **agent ecosystem bundle** instead: F-AGENT-1 Orchestrator + multi-agent missions → F-AGENT-2 persistent memory + self-reflection + trust auto-advance → F-AGENT-3 event reactor + auto-pipelines → F-AGENT-4 Swarm HUD. Canonical plan: [`../agent-ecosystem-plan.md`](../agent-ecosystem-plan.md).

**Why:** Ground-truth survey of the running system (10 missions, 17 runs, 28 checkpoints, 9 handoffs, 35 agents, 0 rows in `agent_memory`) found the substrate ~95% complete but the behavior missing — single-agent planner loops, no event reactor, no self-reflection, no swarm-level surface, no meta-agent decomposing goals. Without this bundle the "autonomous product OS" thesis is unproven in product behavior, no matter how polished the UI. Operator explicitly asked to prioritize core agent-ecosystem depth over visual restructure.

**Tradeoffs considered:**
- *Continue Restructure Phases 3–4 first* — rejected: visual coherence helps reviewers but does not move the thesis; the published hack-under-review survives on substance.
- *Resume Bundle 9 Slice 2 (Proof Platform v1.1)* — rejected: depends on the orchestrator being real before the Builder loop is worth deepening.
- *Ship a one-off demo-only feature for the review* — rejected: would not compose with the rest of the loop.

**Impact:** F-AGENT-1 shipped same session (orchestrator agent + `mission_steps` DAG + four planner tools + per-agent loop cap + `/missions` composer + DAG panel). F-AGENT-2/3/4 queued. `active-task.md` (root) tracks in-flight sub-steps. Status board in `docs/feature-backlog.md` updated. Plan persisted in `docs/agent-ecosystem-plan.md` so any tool can pick it up across sessions. Restructure Phases 3–4 resume after the bundle closes.

---

### 2026-06-02 — Reposition from "AI-native product OS" to "autonomous product OS"

**Decision:** The product is now positioned as the "autonomous product OS." The word "AI-native" is dropped. The operating model is "agents do, humans govern" — not "AI assists human."

**Why:** "AI-native" is table stakes in 2026 — every SaaS claims it. "Autonomous" is still differentiated. The framing shift also resolves a deeper product question: agents are the operators, not tools that assist operators. The human role is governor (sets strategy, approves at gates), not operator.

**Tradeoffs considered:** Keeping "AI-native" would have been familiar but generic. "Agent-first" was considered but "autonomous" better captures that agents execute full missions end-to-end, not just first steps.

**Impact:** README.md rewritten. AGENTS.md §0 updated. All tool configs updated. design.md framing updated. "Agents do. Humans govern." is now the core operating statement.

---

### 2026-06-02 — Three equal primary personas (no hierarchy)

**Decision:** Three personas are all primary targets with equal priority. No P1 > P2 > P3 ranking. Each has its own pain point and hook.

| Persona | Pain | Hook |
|---|---|---|
| Solo / Lead PM at AI-native B2B SaaS | Mechanical work crowds out judgment | "Your agents handle the process. You handle the judgment." |
| Founder operating as the whole product org | Tool sprawl + being the glue | "Run the product org you can't afford to hire." |
| Technical Founder / Indie Hacker | Everything not coding falls on them | "Your product org, running itself." |

**Why:** All three face the same root problem (they are the glue across a fragmented lifecycle) but with different framing needs. Serving all three from day one allows faster validation and prevents premature narrowing.

**Tradeoffs considered:** Narrowing to one persona for a tighter wedge was discussed. Rejected because the product value proposition is identical across all three — only the sales language differs.

**Impact:** README.md "Who Cadence is for" section updated with three equal sections. Persona-specific onboarding tracks added as feature W6 in `docs/feature-backlog.md`.

---

### 2026-06-02 — Trust arc is emergent behavior, not a scheduled timeline

**Decision:** The trust arc (Observing → Proving → Trusted → Ambient) describes how the operator-agent relationship evolves as agents earn trust through demonstrated performance. It is NOT a calendar schedule (no "Week 1, Month 1, Month 3, Month 6" prescriptions).

**Why:** Baking specific timeframes into product docs creates wrong expectations. Some operators may reach "Trusted" in days if agents perform well; others may stay in "Observing" for months by preference. The progression is driven by earned trust (Agent Trust Score) and operator choice (Autonomy Dial), not elapsed time.

**Tradeoffs considered:** Keeping the timeline as a UX guide was discussed. Rejected for product docs but the four-stage arc is kept as a UX design directive — it tells designers what states to design for, not when users reach them.

**Impact:** docs/strategy/v2-positioning-2026-06-02.md §7 — explicit timeline removed, replaced with emergent trust framing. design.md — trust arc added as a UX directive with design requirements for each stage (Trust Score, Autonomy Dial, Loop Health Monitor).

---

### 2026-06-02 — Portability as a first-class feature, not vendor lock-in as a moat

**Decision:** Cadence's moat is compounding value (Product Memory accumulates over time), not vendor lock-in. Full data export in open formats is a first-class feature (U6), not an afterthought.

**Why:** Vendor lock-in is a bad starting USP for a new product. PMs have been burned by Jira, Confluence, and proprietary formats — positioning around portability builds trust faster. "We win by value, not friction."

**Tradeoffs considered:** Positioning lock-in as a moat (like Salesforce) was discussed. Rejected at this stage — the trust required to accept lock-in comes after demonstrated value, not before it. The real switching cost is the accumulated intelligence, not a contract.

**Impact:** README.md "Portability commitment" section added. Feature U6 (Full data portability / export) added to `docs/feature-backlog.md`. docs/strategy/v2-positioning-2026-06-02.md §6 documents the full reasoning.

---

### 2026-06-02 — "Agents do. Humans govern." replaces all "human + AI" framing

**Decision:** All language that frames humans as active operators alongside AI is replaced. The correct frame: agents execute missions end-to-end; humans govern at approval gates.

**Retired language:** "AI assists human", "human + AI collaboration", "human in the loop", "stay in the loop", "AI helps you write specs"

**New language:** "Agents do. Humans govern." / "agents execute, human approves" / "governance gates" / "set intent, govern exceptions"

**Why:** The old framing undersells the product and confuses the target user. A PM who thinks they're getting a "smarter Notion" is not the right buyer. The right buyer wants to orchestrate agents, not work alongside them.

**Impact:** All docs updated. The operating model table in README.md reflects this. design.md component and state language updated.

---

### 2026-06-02 — Skill-first mandate expanded to skills + agents + plugins + MCPs

**Decision:** The "skill-first" protocol that was previously framed as "scan skills and agents" is now explicitly four categories: skills, agents, plugins, and MCP servers. All four must be scanned before any task.

**Why:** Only scanning skills misses agents that may have specialized capabilities, plugins that extend functionality, and MCP servers that provide real-time tool access. Scanning all four ensures the best available tool is used, not just the most familiar one.

**Tradeoffs considered:** Keeping "skills first" as shorthand was considered. Rejected because the shorthand was causing agents to skip the agent, plugin, and MCP scan.

**Impact:** AGENTS.md Standing Order 1 updated. CLAUDE.md mandatory section updated. GEMINI.md updated. .lovable-config.txt Section 3 updated. load-project-memory.sh hook updated.

---

### 2026-06-02 — gstack is one option, not a mandate for commits

**Decision:** commits.md previously said "gstack is required." This is changed to "use a commit skill — gstack-ship and commit-commands:commit are good defaults if available, but scan available skills first." The principle is skill-first for commits, not gstack-first.

**Why:** Mandating gstack creates vendor bias, contradicts the equal-namespace principle established elsewhere, and may not always be the best tool available. The commit discipline (message quality, no --no-verify, no force-push to main) is what matters, not which skill executes it.

**Tradeoffs considered:** Keeping gstack as default was discussed since it does handle commits well. Kept as a "good default if available" but removed as a hard requirement.

**Impact:** commits.md updated. hooks.md table updated. No behavioral change if gstack is available — it still works; it's just no longer the only valid option.

---

### 2026-06-02 — Skill-generated documentation must not create duplicate folder structures

**Decision:** When skills (gstack-office-hours, gstack-document-release, etc.) generate documentation, they must not create new folders that duplicate the existing docs/ structure. The rule: check existing docs first, merge if applicable, only create new files when the content is genuinely unique.

**Why:** The gstack-office-hours skill creates a `docs/office-hours/` folder when run. This directly conflicted with the new `docs/strategy/` structure. If skills keep creating arbitrary folders, the docs/ directory becomes fragmented and the closed-loop mechanism breaks down.

**Specific example:** Running `/gstack-office-hours` would create `docs/office-hours/YYYY-MM-DD-design.md`. The correct action is: merge the content into `docs/strategy/vN-positioning-YYYY-MM-DD.md` (a new version) and reference `docs/strategy/README.md`.

**Impact:** AGENTS.md §5 updated with explicit skill-generated docs rule. CLAUDE.md, GEMINI.md, .lovable-config.txt all updated with this rule.

---

### 2026-06-02 — docs/strategy/ is the versioned positioning system

**Decision:** All product positioning documents live in `docs/strategy/` as versioned files (v1, v2, v3, ...). The latest version is always the source of truth. New strategic positioning decisions create a new version file.

**Rules:**
1. Always read the LATEST version in `docs/strategy/` — check `docs/strategy/README.md` to find it
2. When a positioning or USP change is significant enough to warrant it, create a new version: `vN-positioning-YYYY-MM-DD.md`
3. Update `docs/strategy/README.md` index
4. Cascade changes to README.md, AGENTS.md §0, tool configs, and feature-backlog.md

**Why:** Point-in-time snapshots allow understanding how thinking evolved. The latest version governs current decisions. Earlier versions give context on why choices were made.

**Tradeoffs considered:** Keeping positioning in README.md only was discussed. Rejected because README is the product face, not a strategic reasoning document.

**Impact:** docs/office-hours/ folder (created by gstack skill) migrated to docs/strategy/. v1 and v2 files created. docs/strategy/README.md index created with cascade rule.

---

### 2026-06-02 — HyperAgent tech stack is reference only — existing stack stays

**Decision:** HyperAgent (Airtable's open-source agent platform) was reviewed as a reference. The existing Cadence tech stack is not changed. No migration triggered.

**Facts reviewed:** HyperAgent uses React, Next.js, Radix UI, Zustand, Zod, Recharts, Motion, cmdk, @dnd-kit, @tanstack/react-virtual, lucide-react — all MIT/Apache/ISC licensed.

**Why the existing stack stays:** TanStack Start + Vite + shadcn/ui + Framer Motion + Supabase + Cloudflare Workers is already chosen deliberately. The stack overlap (Radix, cmdk, lucide, dnd-kit, Zod, Recharts) confirms correct choices. Changing the stack would break the Lovable co-development workflow and slow progress significantly.

**Coexistence constraint:** Any tech decision must preserve the Lovable + Claude Code + Antigravity + Gemini co-development model. Stack changes that break any of these are rejected.

**Potential future additions flagged:** `@tanstack/react-virtual` (virtual scrolling for signal feeds) and `fuse.js` (fuzzy search supplement) — MIT-licensed, safe to add if a concrete need arises.

**Impact:** `docs/decisions/tech-stack.md` updated with HyperAgent reference note and explicit decision to keep existing stack.

---

### 2026-06-02 — Six new features added from autonomous product OS positioning

**Decision:** Six features were added to `docs/feature-backlog.md` derived from the autonomous product OS repositioning.

| ID | Feature | Why added |
|---|---|---|
| C5 | Strategic Briefing surface | Agents need context once, not per-mission. The "brief the team" mechanism. |
| C6 | Agent Trust Score + Autonomy Dial | Makes trust arc tangible. Governance as policy, not micromanagement. |
| E8 | Loop Health Monitor | "Is my product org running?" — single view. |
| N3 | Mission Compounding View | Makes Product Memory accumulation visible and rewarding. |
| U6 | Full data portability / export | Anti-lock-in commitment made concrete. Export everything in open formats. |
| W6 | Persona-specific onboarding tracks | Three tracks for three equal personas. Time-to-value measured per track. |

**Impact:** docs/feature-backlog.md "New features" section added. All six are linked to the autonomy/trust/portability positioning decisions above.

---

### 2026-06-03 — Lock a YC demo cut: 8 capability bundles, A2A as the centerpiece

**Decision:** For the Y Combinator application, ship a focused demo cut composed of 8 capability bundles built from existing backlog IDs. The product scope is unchanged; this is a scope *overlay* that defines what must be demo-ready first. The centerpiece is bundle #4 — agent-to-agent communication, structured messaging, mission handoff across stages, sub-agent spawning, and parallel sessions (E1–E5) — surfaced through a Live Mission Graph (E6).

**Sub-decisions:**
1. **Demo persona = Founder-as-PM** ("run the product org you can't afford to hire"). Strongest YC narrative; justifies the full-lifecycle ambition; the other two personas (Solo PM, Technical Founder) remain equal in the product but are not the demo script.
2. **Defer autonomous Build/Test/Ship (S4–S6, epics I/J/K) from the demo cut.** Position as "foundation built (chokepoint, trust stack, orchestration); next milestone." A polished partial demo beats an unpolished full one — and reviewers reward focus.
3. **Demo data = real product** (mine or a design partner's), not synthetic. Real signals beat seeded signals every time for YC.
4. **Three new backlog IDs reserved:** C5 Strategic Briefing surface, C6 Agent Trust Score + Autonomy Dial, U6 Full data portability / export.

**Why:** The product backlog already contains everything needed to make the YC pitch — but if every feature is "in progress," nothing is demo-ready. The YC reviewer needs to see *one* clean 90-second demo that proves the thesis (agents do, humans govern; agents talk to agents and finish missions end-to-end). Bundling existing IDs by demo-readiness rather than by epic forces sequencing discipline without scope creep.

**Tradeoffs considered:**
- *Keep S4–S6 in the demo cut:* rejected — too much surface to polish in time; any visible seam in autonomous coding hurts more than it helps.
- *Pick the Solo PM persona for safety:* rejected — Founder-as-PM is the larger market and the stronger YC story.
- *Ship synthetic demo data for control:* rejected — reviewers can smell synthetic data, and the Founder-as-PM frame demands a real product behind it.
- *Build a brand-new "YC demo" track separate from the backlog:* rejected — would create exactly the kind of doc drift §5 of `AGENTS.md` forbids. Overlay instead.

**Impact:** `docs/feature-backlog.md` gained a new top section "▶ YC demo cut" with the 8-bundle table, sequence, deferrals, and three new feature stubs (C5/C6/U6). Live status board "Next up" now points at the YC-cut sequence (still starting with FND-RUNTIME 0.9). `plan.md` §4 logged. `active-task.md` seeded at repo root for the immediate next sub-task (FND-RUNTIME 0.9 scoping). No code, schema, or RLS changes in this session.

---

### 2026-06-03 — Reframe "YC demo cut" → "Agentic Proof Platform (v1)"; default seed = Cadence-on-Cadence

**Decision:** Replace the framing "YC demo cut" with **Agentic Proof Platform (v1)**. The 8 capability bundles, the build sequence, the deferrals, and the reserved IDs (C5, C6, U6) are unchanged. What changes: every bundle now ships against an explicit **proof bar** — the minimum end-to-end behavior on real data that makes a claim true — mapped to **four claims** that legacy PM tools (Jira, Linear, Productboard, ProductPlan, Aha) structurally cannot make:
- **C1** Agents operate, humans govern.
- **C2** Agent-to-agent handoff is first-class (no human in the routing path).
- **C3** The whole lifecycle is one governed loop.
- **C4** Trust is earned and visible (dialed, not assumed).

The YC application becomes a by-product of shipping the proof platform, not its primary driver.

**Sub-decisions:**
1. **Default real-data seed = Cadence-on-Cadence** (we run our own roadmap on Cadence). Most credible YC narrative; no dependency on a design partner; if one is signed before bundle 6, their product becomes an additional seed, not a replacement.
2. **Proof bars are the new "done" criterion** for each bundle. "Renders" or "looks demo-able" is not enough; behavior must hold end-to-end on real data.
3. **Public README still does not claim A2A** until bundle 4 hits its proof bar (≥3 hops via the orchestration layer with replayable trace).

**Why:** A 90-second demo can be polished into untruth; a proof bar cannot. Framing the work as a proof platform forces every bundle to deliver something legacy tools cannot do — which is the only honest YC narrative, and the only narrative that survives first contact with a design-partner CTO.

**Tradeoffs considered:**
- *Keep the "YC demo cut" framing:* rejected — invites demo-driven development (Potemkin screens), which collapses on real-data evaluation.
- *Pull S4–S6 (Build/Test/Ship) forward to widen the proof surface:* rejected — same reason the prior decision deferred them; widening surface without depth hurts more than it helps.
- *Wait for a design partner before committing to bundle 6's seed:* rejected — Cadence-on-Cadence removes the dependency and is the better story regardless.

**Impact:** `docs/feature-backlog.md` reframed: section title `▶ YC demo cut` → `▶ Agentic Proof Platform (v1)`, added four-claims table and per-bundle proof bars, added "Real-data seeding" subsection. Live status board "Next up" + "Progress" updated to reference the proof platform. `plan.md` §4 logged. `active-task.md` unchanged (FND-RUNTIME 0.9 still next; no work in flight is invalidated). No code, schema, or RLS changes in this session.

---

### 2026-06-03 — Extend Proof Platform → v1.1: full PM lifecycle on real systems via agentic orchestration

**Decision:** Extend the Agentic Proof Platform from a front-half slice (Discover → Define → Plan) to the **entire product-management lifecycle**: Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn → re-feeds Discover. The previously deferred backlog (S4 Build, S5 Test, S6 Ship, L Launch, M Support) is **un-deferred** for the proof platform — but ships as **thin agentic orchestration over existing tools**, not as new autonomous IDEs / CI / helpdesks.

**Realism rule (the constraint that keeps scope sane):** Agents orchestrate existing tools where the tool already exists; they don't replace them. Concretely:
- Build = Builder opens a **real scoped PR** on the Cadence repo via GitHub MCP (not a new IDE; not Cursor/Devin).
- Test = Builder reads **existing GitHub Actions** results (not a new test runner).
- Ship = approval-gated merge + ingest the **existing deploy webhook** (not a new pipeline).
- Launch = changelog + **one outbound channel** (Slack OR email), send-gated by approval.
- Support = **one inbound channel** (email forward or webhook) → ticket → linked to PRD/opportunity → loops back as a signal.
- Learn = Analyst attaches outcome → re-scores opportunity → next Discovery cycle reflects it.

**Sub-decisions:**
1. **Full-lifecycle by orchestration, not replacement.** The thesis is "agent-native operating *system*" — agents drive the existing PM stack. Building our own IDE/CI/helpdesk would dilute the thesis and is out of scope at any depth beyond what's listed above.
2. **Builder agent writes to the Cadence repo itself** (option (a) in the plan). Requires a `GITHUB_TOKEN` runtime secret with `repo` scope, added when Bundle 9 starts (not now). Branch protection on `main` ensures no agent can bypass review; every merge is approval-gated through Cadence's own Decision Queue.
3. **One channel per stage in v1.1.** One outbound channel (Slack OR email) for Launch; one inbound channel for Support. Depth comes after the loop closes, not before.
4. **Proof bars are per-bundle and end-to-end.** Bundle 9 is not "done" until a real PR exists on the Cadence repo for a real planned task. Bundle 10 not "done" until a real merge fires a real deploy that lands in the Mission Graph. Etc.
5. **Seven new reserved IDs:** N1 (GitHub-issues sync), I-thin (Builder scoped PR), J-thin (CI read), K-thin (merge gate + deploy webhook), L-thin (changelog + one channel), M-thin (one inbound channel), Z1 (Analyst learn loop).

**Why:** A half-lifecycle demo (Discover → Plan) does not prove the product to a PM audience — a real PM walks the *whole* loop every week. v1's demo was credible to a YC reviewer but not yet credible to a design-partner CTO. v1.1 makes the loop close on real systems, so the same artifact (signal → opportunity → PRD → PR → deploy → ticket → re-scored opportunity) is the demo *and* the daily working surface.

**Tradeoffs considered:**
- *Build a full autonomous coding agent (compete with Cursor/Devin):* rejected — multi-quarter scope, off-thesis (we're the OS, not the IDE), and the operator-as-judge story is stronger with scoped PRs on a real repo.
- *Keep S4–S6 deferred and ship v1 as-is:* rejected — user feedback explicitly: "the complete lifecycle should be covered, not half-baked." Half-lifecycle reads as half-product to a PM audience.
- *Stage launch + support across multiple channels:* rejected — depth before the loop closes inverts the priority. One channel per stage now; multi-channel after Bundle 12 ships.
- *Use a throwaway demo repo for Builder writes:* rejected — weakens the Cadence-on-Cadence story; branch protection makes the real-repo choice safe.

**Impact:** `docs/feature-backlog.md` updated: section title `(v1)` → `(v1.1) — full product lifecycle, end-to-end on real systems`, added Realism Rule table (9 lifecycle stages), expanded bundles 8→12 (added 9 Build+Test, 10 Ship, 11 Launch, 12 Support→Learn), expanded build sequence 8→12 steps, added Demo narrative paragraph, expanded Real-data seeding to include repo-write decision, rewrote Explicitly-deferred list to reflect orchestration-not-replacement scope, added 7 new reserved-ID stubs (N1, I-thin, J-thin, K-thin, L-thin, M-thin, Z1), refreshed live status board (Next up + Progress + Recent log). `plan.md` §4 logged. `active-task.md` unchanged — FND-RUNTIME 0.9 is still next; no in-flight work invalidated. No code, schema, RLS, or secret changes in this session.

---

*This log is maintained as part of the closed documentation loop. Every session that produces a strategic decision adds an entry here. Reference: `docs/strategy/README.md`. Last updated: 2026-06-03.*
