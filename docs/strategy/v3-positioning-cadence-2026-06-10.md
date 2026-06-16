# Product Positioning v3: Strategic Pivot to the B2B Enterprise Cockpit

> **What this is.** A record of the 2026-06-10 strategic pivot to the **B2B Enterprise Product Cockpit** positioning, focusing on target personas, the pluggable multi-model substrate, and the 12-stage product development lifecycle. (The rename that accompanied it was reverted on 2026-06-16; the product is Cadence.)
>
> **When to revisit.** When aligning agent system prompts, adjusting UX layouts, or introducing custom tenant integrations for enterprise clients.
>
> **Cross-references.** Product thesis ➔ [`../../README.md`](../../README.md). backlogs ➔ [`../feature-backlog.md`](../feature-backlog.md). Build roadmap ➔ [`../../plan.md`](../../plan.md). Rules ➔ [`../../AGENTS.md`](../../AGENTS.md).

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is **Cadence**. This is a superseded v3 positioning doc kept for its personas; a brief 2026-06-10 rename experiment to a different brand was reverted on 2026-06-16 and the retired name must not be reintroduced.

---

## 1. The Story of Cadence ⚡

### Naming note (reverted)

This v3 session briefly explored a rebrand away from Cadence on trademark and SEO grounds. That rename was **reverted on 2026-06-16** after the replacement proved to have its own collisions. The product name is **Cadence**; fresh-name exploration is paused, see [`../decisions/naming.md`](../decisions/naming.md).

### The Closed-Loop Lifecycle

The product lifecycle is a closed, unbroken loop. In a modern product organization, information is the current that flows through it:

1. **User Signals** (Ingested via Perplexity/WhisperFlow) flow into:
2. **Opportunities & Scored Themes** (Discovery) which transition to:
3. **Cited Specs & PRDs** (Definition) which map to:
4. **Task Graphs & dependency roadmaps** (Planning) which trigger:
5. **Isolated Branch Code Modifications** (Cursor Building) which are validated by:
6. **Automated Evals & QA container tests** (Testing) which deploy to:
7. **Production & GTM Asset Releases** (Shipping & Launching) which generate:
8. **Customer Feedback & Support tickets** (Operating) which feed back to:
9. **Learnings & Re-scoring** (Learning).

If any seam requires manual data transport, spreadsheets, or un-tracked updates, **the loop breaks**, and the current stops flowing. **Cadence** keeps the product current running in a continuous, unbroken, agent-run loop under human governance.

---

## 2. Target Personas (B2B Enterprise Team)

Rather than focusing exclusively on the solo PM, Cadence addresses the entire cross-functional B2B enterprise team:

### P1: Enterprise Director / VP of Product (The Portfolio Governor)

- **Pain:** Swarm drift, lack of visibility into agent actions, security audits, budget overruns, and portfolio alignment.
- **Role:** Sits at the strategic level. Controls budget caps, monitors multi-product roadmap health, and acts as the ultimate gatekeeper for the global kill-switch.

### P2: Lead / Senior PM (The Daily Cockpit Operator)

- **Pain:** Mechanical process work (spec writing, ticket updates, alert triage, release logs) eating up time needed for strategic judgment and taste.
- **Role:** Sets the strategic brief, prompts the Swarm Chat router, reviews auto-drafted specs, and approves opportunities promoted to the backlog.

### P3: Engineering Lead / Tech Architect (The Code Gatekeeper)

- **Pain:** Agent-written code drifting from internal architecture guidelines, introducing regressions, or breaking sandboxed environments.
- **Role:** Reviews the files claimed by the Builder Agent, monitors automated CI feedback loops, and validates code diffs before merging PRs.

### P4: UX/UI Designer (The Visual Validator)

- **Pain:** Generated code failing to match design system tokens or looking off-brand in mockups.
- **Role:** Reviews UI scaffolding layout previews in the visual sandbox (Lovable-style) and edits styling tokens.

### P5: GTM Lead / Product Marketer

- **Pain:** Generating changelogs, marketing collateral, newsletter posts, and distribution updates by hand for every release.
- **Role:** Approves auto-drafted GTM assets and coordinates launch announcements.

### P6: Customer Success & Support Lead

- **Pain:** High ticket volumes, slow bug triage, and user signals getting lost before reaching the PM.
- **Role:** Oversees agent-triaged support tickets, validating customer friction logs that flow back into the Signal Feed.

---

## 3. The 12-Stage Product Lifecycle

The platform offering represents the complete lifecycle, executed by specialist agents:

- **S1. Signal Capture:** Multi-source ingestion (Slack, Zendesk, Intercom, Sales logs) clustered by the **Scout Agent** into cited opportunities.
- **S2. Audio Sync (WhisperFlow):** High-context audio recording, transcription, and meeting extraction, fanning sync notes directly to the backlog.
- **S3. ICE Prioritization:** Strategist Agent evaluates strategic alignment, ICE scores, and schedules priorities.
- **S4. Spec Definition:** Conversational spec generation (PRD Writer) compiling acceptance criteria, data shifts, and non-goals with RAG citations.
- **S5. Sprint Planning:** Dependency task graphs auto-generated and synced to Linear/Jira by the Sprint Planner.
- **S6. Agentic Build:** Isolated branch modifications and surgical file-lock claims executed by the Builder Agent.
- **S7. Visual QA:** Sandbox preview environments generated for designers and PMs to visually validate code changes.
- **S8. Safe Release:** Merges PRs, deploys release tags, and monitors production health (auto-rollback on anomalies).
- **S9. GTM Launch:** Marketer Agent drafts positioning charts, blog posts, newsletter copy, and distribution announcements.
- **S10. Support Triage:** Customer success agents auto-reply, categorize tickets, and route bugs back to Signal Capture.
- **S11. Cohort Analytics:** Automates feature adoption tracking, cohort analysis, and funnel monitoring.
- **S12. Learn & Reflect:** Compares outcome telemetry with the original PRD specifications, writing post-mortems to the Product Memory Graph.

---

## 4. Pluggable Multi-Model Substrate

To deliver optimal results, Cadence decouples cognitive tasks from individual providers, acting as an intelligent router:

1. **Gemini 1.5 Pro:** Leverages a 1M+ token context window to parse audio meeting transcripts (WhisperFlow) and support logs without chunking loss.
2. **DeepSeek-Coder-V2 / Claude 3.5 Sonnet:** Surgical, high-accuracy multi-file code generation and linter-guided repairs.
3. **Claude 3.5 Sonnet / GPT-4o:** Complex logical reasoning, specification drafting, and dependency graph planning.
4. **Gemini 1.5 Flash / GPT-4o-mini:** Fast, low-latency natural language intent classification and real-time dashboard events.

### Enterprise Data Sovereignty

- All model calls run through the **AI Chokepoint** (`runtime.server.ts`), enabling private, encrypted **BYO (Bring Your Own) Keys** stored securely via Supabase `pgsodium`. This ensures that enterprise customer data never leaves private VPC endpoints and respects zero-data-retention compliance policies.
