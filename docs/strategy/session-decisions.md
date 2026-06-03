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

*This log is maintained as part of the closed documentation loop. Every session that produces a strategic decision adds an entry here. Reference: `docs/strategy/README.md`. Last updated: 2026-06-02.*
