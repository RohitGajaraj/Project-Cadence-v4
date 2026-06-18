# AGENTS.md — Operations & Engineering Manual

> **Canonical, tool-agnostic source of truth for every agent and human working in this repo.**
> Read natively by Google Antigravity, Gemini CLI, OpenAI Codex, Cursor, and the agents behind Lovable. Claude Code reads [`CLAUDE.md`](./CLAUDE.md) (a thin pointer to this file). Antigravity/Gemini precedence notes live in [`GEMINI.md`](./GEMINI.md).
>
> **Rule of the repo:** this file holds the operating rules. The founding constitution — co-founder posture, north star, model-agnostic mandate — is in [`Ai_Cofounder.md`](./Ai_Cofounder.md); its **Repo Concordance** section maps its mandated documents onto this doc system (never create its 13 root files; update the mapped equivalents). Product framing is in [`README.md`](./README.md). The build log and roadmap are in [`plan.md`](./plan.md). The UI contract is in [`design.md`](./design.md). Architecture contracts are in [`architecture/`](./architecture/). The build-in-public brand system lives in a separate PRIVATE repo (`RohitGajaraj/build-in-public`, split out 2026-06-15 to keep the founder's brand and social tokens out of this product repo); **capture postable build insights to [`docs/brand-feed.md`](./docs/brand-feed.md)** (the one-way feed the brand engine reads first, before scouting) with a **capture cue** (the screenshot, short video, link, or handle to tag that would strengthen the post). That file defines what qualifies and the voice; follow it. The engine drafts in the founder's voice and auto-stages Buffer drafts for his review — it never publishes. Keep entries public-safe, never post without his approval, and do not recreate `docs/brand/` here. Do not duplicate content between files — link instead.

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is **Cadence**, and that is the only name to use. A brief 2026-06-10 rename experiment to a different brand was reverted on 2026-06-16; the retired name must not be reintroduced anywhere (code, docs, DB, env, caches, APIs). Any stray legacy token from that experiment is to be read as equivalent to `cadence`/`Cadence`.

---

## 0. What we are building

**Cadence** is the **end-to-end product operating system**: a swarm of specialist agents runs the whole product lifecycle (discover, decide, define, build, ship, launch, learn) as one governed loop, while a human sets intent and owns the calls that matter. Its **moat** is the **decision layer** (what to build, and whether the call was right, the part with no fast oracle) plus the compounding memory; the build is a governed station within the loop (its own engine, or dispatched to Lovable / Cursor / Devin under the same governance), so Cadence **out-scopes** the build tools (the whole loop) rather than out-building them. It is **not** a PM tool with AI bolted on; AI is the core; the human decides and is accountable, agents execute. The moat (memory is one layer of it): [`docs/strategy/moat.md`](./docs/strategy/moat.md). Full thesis + personas: [`README.md`](./README.md).

Three principles govern every decision in this repo:

1. **AI is the operating system, not a feature.** Every workflow flows through an intelligent layer with telemetry, evals, guardrails, and approval gates.
2. **Fully autonomous super-agents, governed.** Agents don't just assist — they run multi-step missions end to end (discover → build → test → ship → launch → support), in parallel, behind approval gates. Autonomy is the product; governance makes it safe.
3. **The moat is the decision layer (what to build, and was it right); memory is one layer of it.** Vibe-coding owns the build layer (how to build, commoditizing); we own the decision layer (no fast oracle, does not commoditize) and dispatch the build. Cadence is model-agnostic; frontier models are an input we orchestrate. Defensibility = the no-oracle asymmetry + outcome-labeled judgment + system-of-record + the orchestration position + governance. Full canon: [`docs/strategy/moat.md`](./docs/strategy/moat.md). See also [`README.md`](./README.md).
4. **Build for agents first.** APIs, MCP, A2A, and CLIs over dashboards. The next users are agents. See [`architecture/integrations.md`](./architecture/integrations.md).

**Strategy canon and source reasoning** (read for any positioning, GTM, pricing, or fundraising work): the versioned canon lives in [`docs/strategy/`](./docs/strategy/) - **v7** (positioning + market), **v8** (calm-front structure + the hybrid Build spine), **v9** (the decision lens: the Critic-teardown wedge, the integrate/absorb/race/ignore competitor map, own-the-autonomous-engine, the tiered build-next plan), and **v10** (the master blueprint: every feature with its pain point and how it functions, the screen-by-screen spec, the analytical engine, and the disjoint-lane priority pick-list - **pick this first** for what to build and how, with execution order, the per-item build loop, and milestone gates in [`docs/planning/v10_implementation-plan.md`](./docs/planning/v10_implementation-plan.md)). **BYO Repo + All-in-One Platform reframe (2026-06-18):** the spec [`docs/strategy/byo-build-and-cadence-cloud-2026-06-18.md`](./docs/strategy/byo-build-and-cadence-cloud-2026-06-18.md) decomposes the product-repo attachment model, managed-vs-BYO paths, and the Build-to-Ship autonomy reframe; the all-phase implementation plan (P1-P5, work items + tasks) lives in [`docs/planning/byo-build-implementation-plan-2026-06-19.md`](./docs/planning/byo-build-implementation-plan-2026-06-19.md) (board group G11). The role map in [`docs/strategy/README.md`](./docs/strategy/README.md) is the single arbiter of which doc to pick. Major decisions are logged in [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md); the **raw brainstorm reasoning** behind the canon, and the source narrative for **YC / accelerator / investor applications**, is preserved in [`docs/strategy/strategic-inputs-log.md`](./docs/strategy/strategic-inputs-log.md). Standing rule (founder, 2026-06-17): these are interlinked both ways and **never orphaned** - a new strategic input is captured in the inputs log, distilled into the canon, and logged in decisions, all in the same session. **The moat / competition / defensibility canon is [`docs/strategy/moat.md`](./docs/strategy/moat.md)** (lead with the decision layer; memory is one layer; the YC objection Q&A lives there). **Repositioning Ripple Review (standing, founder 2026-06-19):** when the positioning or moat shifts, re-check pricing/gating, feature priority, IA/messaging, build-next, tests, and the canon in the same session (checklist in [`docs/strategy/moat.md`](./docs/strategy/moat.md) §11), so a reposition is never a one-time patch. **Documentation bar:** strategy docs are comprehensive and thought-process-oriented (the reasoning + insights, not just conclusions), so they serve YC / investor applications and answer questions by reference.

**Demo logins** (for screen-recording, investor / customer demos, any flow that needs a working login): two pre-provisioned accounts (`demo@redcadence.app`, `demo2@redcadence.app`, shared password `Cadence!Demo2026`) land in a fully populated Demo workspace. Full doc + re-seed instructions: [`docs/operations/demo-credentials.md`](./docs/operations/demo-credentials.md).

---

> ## THE DOCUMENTATION OPERATING SYSTEM (read first, every tool, every session)
>
> **One front door, typed ledgers behind it, status in exactly ONE place.** This is the standing rule for how this repo's docs work, for every tool (Claude Code · Antigravity · Gemini · Lovable · any future tool). It exists so you never hunt across files, nothing drifts or gets orphaned, and a session starts without re-reading the whole corpus.
>
> ### The one source of truth
> [`docs/planning/SOURCE-OF-TRUTH.md`](./docs/planning/SOURCE-OF-TRUTH.md) (SSOT) is the ONLY place for "where are we / what is next / what needs the founder." It carries: section 0 the live cursor (what is in flight + the next picks; this folded in the old root `active-task.md` on 2026-06-19), section 1 founder rulings, section 2 status, section 3 the build queue, section 4 the founder pickup list, section 5 findings, section 6 the dated progress log, section 7 the doc map. The boot hook surfaces it first.
>
> ### Which doc owns what (never duplicate status into these)
> | Concern | Owner |
> | --- | --- |
> | In-flight + next picks, status, founder to-do, progress | **SSOT** (sections 0-6) |
> | Per-feature status matrix + who-is-on-what claims | [`docs/planning/feature-dashboard.md`](./docs/planning/feature-dashboard.md) |
> | Per-feature acceptance criteria / scope (F-IDs) | [`docs/planning/feature-backlog.md`](./docs/planning/feature-backlog.md) |
> | Current-initiative build specs (per-ID, cold-buildable) | the initiative's build bible in `docs/planning/` (G10 workspace-tenancy, G11 byo-build) |
> | Open bugs / blockers | [`docs/planning/known-issues.md`](./docs/planning/known-issues.md) |
> | Cross-cutting non-functional gaps | [`docs/planning/considerations.md`](./docs/planning/considerations.md) |
> | Dated build history (what shipped + why) | [`plan.md`](./plan.md) section 4 |
> | Strategy / positioning / moat | [`docs/strategy/README.md`](./docs/strategy/README.md) (the arbiter) |
>
> ### The session loop (do this, in order)
> 1. **Start:** read the SSOT (the boot hook surfaces it) for the live cursor + queue + founder list, and `.remember/remember.md` for the conversational context the docs do not carry. That is enough to know where things stand. Do not re-read the whole corpus.
> 2. **Before picking work:** take the next item from SSOT section 0 (cursor) or section 3 (queue). Check the Active-claims table in the dashboard so you do not collide with a parallel session.
> 3. **On claim (before writing code, same commit):** add an Active-claims line in the dashboard (`<tool>`, date) and set the SSOT section 0 cursor to the pick.
> 4. **On done (same unit of work as the change):** update (a) the SSOT (section 0 cursor + section 6 progress log) and (b) the ONE typed ledger you touched (the build-bible row, known-issues, etc.), then run [`docs/conventions/doc-closure-checklist.md`](./docs/conventions/doc-closure-checklist.md). A change is not done until its docs are true.
> 5. **Before you pause or end:** leave the boards true; write the handoff to `.remember/remember.md` (what shipped with IDs, open work in priority order, founder-gated items, env notes). This is what lets the next session start without re-deriving context. Saving tokens is part of the job.
>
> ### The new-initiative rule (when a new feature or strategy spawns several sub-items)
> A new initiative that decomposes into multiple build items (e.g. 4-5 features) is logged as ONE unit, never scattered: (1) a **build bible** at `docs/planning/<initiative>-plan.md` with per-ID specs (context, files, migration, steps, acceptance, verify); (2) a **board group** in the dashboard (e.g. G10/G11) with the pick-order; (3) an **SSOT section 3** queue entry pointing to the bible; (4) the reasoning in [`docs/strategy/strategic-inputs-log.md`](./docs/strategy/strategic-inputs-log.md) and the decision in [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md). Sub-items live in the bible, mirrored as dashboard rows. Never create new root files; placement policy: [`docs/README.md`](./docs/README.md).
>
> ### Keep the hierarchy thin (anti-rot: so this cleanup is the LAST one)
> The doc set must stay thin and purpose-driven: ONE doc per purpose, each serving its full purpose, no duplicates, no orphans, no redirect stubs. This repo has been cleaned up repeatedly; these rules exist so it does not rot again. Every tool, every session:
> - **Extend, do not create.** Before creating any doc, check the map above and [`docs/README.md`](./docs/README.md). If a doc already serves the purpose, ADD to it. Create a new file ONLY for a genuinely new purpose, in the right subfolder, linked from that folder's index in the same commit.
> - **No duplicated status or content.** Status lives only in the SSOT. Never copy a status board, queue, or canon paragraph into a second file; link instead.
> - **Merge on sight.** If two docs drift toward the same job, merge them immediately: overwrite the survivor with the union of the content, then archive or delete the other. Do not "deal with it later".
> - **Archive, do not orphan.** When a doc is superseded, move it to the nearest `archive/` (`docs/planning/archive/`, `docs/strategy/archive/`) and remove inbound links. Delete outright only when it has zero unique data (capture anything unique into the survivor first).
> - **Check before you commit.** Run `bun run docs:check` (wraps `scripts/docs-doctor.sh`) to catch rot early: stray files at repo root or `docs/` top level, macOS " 2" duplicates, more than one "single source of truth" / "Live status board" claim, orphaned docs (in `docs/` but linked from nowhere), and broken relative links. Fix what it flags in the same commit.
>
> If you remember one rule, remember this: **status lives only in the SSOT; everything else is typed detail it points to. One purpose per doc, extend before you create, archive before you orphan.**

---

## 1. Pre-action protocol (run before any non-trivial task)

0. **Resolving "what is in flight or next to build":** `git pull origin main`, then read [`docs/planning/SOURCE-OF-TRUTH.md`](./docs/planning/SOURCE-OF-TRUTH.md): section 0 (the live cursor) for what is in flight, section 3 for the build queue, section 4 for founder-gated items. Check the Active-claims table in [`docs/planning/feature-dashboard.md`](./docs/planning/feature-dashboard.md) so you do not collide with a parallel/other session. On pickup, flip the dashboard row to `🔨 In Dev (<tool>, date)` + an Active-claims line AND set the SSOT section 0 cursor, in the same commit, before writing feature code. On completion, flip the row to `✅`, clear the claim, and update the SSOT (section 0 + section 6). The full model is the **Documentation Operating System** block above. This is non-negotiable so concurrent sessions never duplicate or clobber work.
1. **State the request in one sentence.** If ambiguous, ask before acting.
2. **Scan skills and agents first, and then available plugins and tools (MCP, etc.) then act.** Surface candidate skills ([`docs/operations/skills.md`](./docs/operations/skills.md)) and subagents ([`docs/operations/subagents.md`](./docs/operations/subagents.md)) with a one-line "why," before invoking. Never reason from scratch when a skill exists. This is non-negotiable.
3. **Invoke the smallest set that fits.** One or two skills, justified in one line. No invoking five overlapping skills "for completeness."
4. **Track multi-step work as tasks.** Create tasks up front; update as you go. Do not batch-complete at the end.
5. **Confirm destructive or shared-state actions.** Pushes, force-pushes, branch deletes, migrations, external sends. One past approval does not extend forward.
6. **For UI work, run the dev server and verify visually.** Type-checking is not feature-checking. See [`architecture/frontend.md`](./architecture/frontend.md).
7. **End with one or two sentences:** what changed, what is next.

If you catch yourself thinking "this is a quick fix, I can skip the protocol" — that is the signal to follow it.

---

## 2. Skill-first & Agent-first protocol (scan, shortlist, pick, code)

**Before any non-trivial task, follow this protocol:**

1. Scan available skills/agents/plugins/MCP servers (active list in session reminder)
2. Shortlist candidates across ALL namespaces (GStack, ecc, superpowers, ruflo, design, context7, user-installed, etc.)
3. Pick the best fit (no namespace bias; best-fit wins)
4. Invoke & execute, then code

**Why scan?** 700+ skills exist. Skipping the scan means hallucinating, burning tokens, and missing the right tool. A 30-second scan prevents a 30-minute wrong path.

**Selection priority - all equal:**

1. **User instructions win.** If [`AGENTS.md`](./AGENTS.md), [`CLAUDE.md`](./CLAUDE.md), [`GEMINI.md`](./GEMINI.md), or the request says "use X," use X.
2. **Scan the full installed set + project folders** — shortlist candidates across all namespaces.
3. **Best fit wins.** Pick the most relevant skill for the task. All namespaces equal.
4. **Process before implementation:** `superpowers:brainstorming` / `superpowers:debugging` before you code.
5. **Specific over general:** `ecc:typescript-reviewer` for TypeScript beats a generic reviewer; `ecc:database-reviewer` for migrations; `ecc:security-reviewer` for security.
6. **Repo-local convention beats cross-repo default** — see [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md).
7. **When in doubt, ask.** A 10-second clarification beats a 10-minute wrong path.

**Common skill categories (examples, not exhaustive):**

| Category                       | Examples                                                                                                                                                                         | When to reach for                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Process & discipline**       | `superpowers:brainstorming`, `superpowers:debugging`, `superpowers:test-driven-development`, `superpowers:systematic-debugging` , etc.                                           | _Before_ implementation — these shape how you code.                |
| **Code review**                | `ecc:typescript-reviewer`, `ecc:python-reviewer`, `ecc:rust-reviewer`, `ecc:go-reviewer`, `ecc:csharp-reviewer`, `ecc:java-reviewer`, `pr-review-toolkit:code-reviewer` , , etc. | Language-specific or pattern-specific review. Better than generic. |
| **Security & compliance**      | `ecc:security-reviewer`, `ecc:a11y-architect`, `ecc:healthcare-reviewer` , etc.                                                                                                  | Security audits, accessibility, compliance. Domain-specific.       |
| **Database & data**            | `ecc:database-reviewer`, `ecc:mle-workflow`, `ruflo-migrations:migrate-create` , etc.                                                                                            | Schema design, migrations, data patterns.                          |
| **Build & deploy**             | `ecc:build-fix`, `ecc:go-build`, `ecc:rust-build`, `ecc:kotlin-build`, `ecc:cpp-build`, etc.                                                                                     | Build errors. Language-specific is better than generic.            |
| **Design & frontend**          | `emil-design-eng`, `design-taste-frontend`, `frontend-design`, `ecc:frontend-design-direction` , etc.                                                                            | UI/UX work, motion, design systems.                                |
| **Docs & context**             | `context7-plugin:docs`, `ecc:update-docs`, `claude-api:doc-coauthoring` , etc.                                                                                                   | Library docs, documentation, knowledge.                            |
| **Architecture & planning**    | `ecc:plan`, `ecc:architecture-decision-records`, `ecc:blueprint` , etc.                                                                                                          | System design, ADR, multi-layer architecture.                      |
| **Testing & validation**       | `ecc:tdd-workflow`, `ecc:e2e-testing`, `ecc:test-coverage` , etc.                                                                                                                | TDD, end-to-end tests, coverage analysis.                          |
| **Performance & optimization** | `ecc:performance-optimizer`, `ecc:refactor-clean`, `ecc:cost-tracking` , etc.                                                                                                    | Speed, memory, bundle size, cost.                                  |
| **Workflow shortcuts**         | `to-prd`, `to-issues`, `prototype`, and 700+ others                                                                                                                              | Domain-specific, user-installed, project-local.                    |

Full skill-selection logic & anti-patterns: [`docs/operations/skills.md`](./docs/operations/skills.md). Subagent selection: [`docs/operations/subagents.md`](./docs/operations/subagents.md).

---

## 3. Engineering rules

> **§3.0 — The Engine-Room Doctrine (the product's first UX law, non-negotiable).** Complexity lives in the engine, never in the experience: the user meets the _output_ of the machine, never the machine. All observability/governance/internal machinery (traces, evals, prompts, budgets, raw logs, agent internals) lives behind one recessed "Engine Room" door, revealed on demand; user-facing labels name the _outcome_, not the mechanism; users bring their own sources via one Connect button and never touch keys/DBs/wiring. Every new user-facing surface runs the **Engine-Room Test** ("would a smart non-technical person feel this is for them, or does it expose how the machine works?") and carries a greppable `Engine-Room:` line. This rule outranks any single surface, feature, or metric, and constrains solutioning and architecture (one door not many; outcome objects not machine objects reach the front; progressive disclosure is a reused component contract). Body + how-to-achieve: [`docs/conventions/engine-room-doctrine.md`](./docs/conventions/engine-room-doctrine.md). Founder ruling 2026-06-16.

> **§3.0b — Data minimalism: every field earns its place (non-negotiable).** Capture nothing by default. No field, input, stored column, or pixel of screen real estate exists unless a _named consumer_ needs it: run the **Value Test** (what value, to whom, where consumed, does anything change if absent?) and satisfy the **wiring rule** — a captured field ships in the _same change_ as the surface/prompt/behavior that reads it; there is no "collect now, use later." Speculative capture is allowed only with a documented, credible near-term consumer named at the point of capture. Unearned capture costs the user's time, our storage, privacy surface, and maintenance, forever. This is the data-and-input sibling of §3.0 (calm front). Body + worked example (the onboarding `role` removal): [`docs/conventions/data-minimalism.md`](./docs/conventions/data-minimalism.md). Founder ruling 2026-06-18.

### Architecture

1. **Every AI call goes through the chokepoint** (`src/lib/ai/runtime.server.ts`). No second path. Contract: [`architecture/runtime.md`](./architecture/runtime.md).
2. **Every multi-step autonomous workflow goes through the orchestration layer.** No ad-hoc agent loops. Contract: [`architecture/orchestration.md`](./architecture/orchestration.md).
3. **RLS on every user table; scope by `user_id` + `workspace_id` + `product_id`.** No client-trusted role checks. Auth/tenancy/governance contract: [`architecture/security.md`](./architecture/security.md). Data contract: [`architecture/data.md`](./architecture/data.md).
4. **Server boundary integrity.** The service-role client is never imported from client code.
5. **App logic = server functions. Cron-poked endpoints = `/api/public/hooks/*`.** Contract: [`architecture/frontend.md`](./architecture/frontend.md).
6. **Loader + Suspense, not `useEffect + fetch`.**
7. **Boundaries on every route** — error, not-found, and a root default.
8. **Repo invariants are enforced by hooks** (commit policy, migration safety). See [`docs/operations/hooks.md`](./docs/operations/hooks.md) and [`docs/operations/commits.md`](./docs/operations/commits.md).

### Visual / tokens

7. **Semantic tokens only.** Hex literals in components are banned. See [`design.md`](./design.md).
8. **Motion via the canonical motion library; respect `prefers-reduced-motion`.**
9. **AI message UI contract** — every AI message exposes score, model+via, latency, tokens, cost, citations, feedback, View Trace, Replay-with. See [`design.md`](./design.md).
   9a. **Humanized output, zero AI fingerprints (two levels, both mandatory).** No em/en dashes, no invisible Unicode (zero-width, non-breaking space, BOM, soft hyphen), no AI-cliché phrasing in: (1) anything we author (code, docs, UI copy, comments, commit messages, seed data) AND (2) anything the platform generates for a user (PRDs, drafts, chat, research, rationales). The runtime sanitizer at the AI chokepoint (`src/lib/ai/runtime.server.ts`) is the hard gate; the system-prompt directive (`prompts.server.ts`) is the soft one. Applies to every co-dev tool (Claude Code, Lovable, Gemini, Antigravity). See [`docs/conventions/humanized-output.md`](./docs/conventions/humanized-output.md). `ui-voice.md` is its UI-string application.
   9b. **UI voice & language.** Length budgets, AI-tell denylist, no em/en dashes in UI copy. See [`docs/conventions/ui-voice.md`](./docs/conventions/ui-voice.md).
   9c. **No native browser chrome.** No `alert`/`confirm`/`prompt`/`open`/`onbeforeunload`/native `<dialog>` in `src/**`. Use `useConfirm()` / `usePrompt()` + `sonner` + shadcn. ESLint-enforced. See [`docs/conventions/ui-chrome.md`](./docs/conventions/ui-chrome.md).
   9d. **Destructive actions.** Typed-name match for irreversible deletes; `useConfirm` for other destructive flows; Undo over confirm for reversible. See [`docs/conventions/destructive-actions.md`](./docs/conventions/destructive-actions.md).
   9e. **Manage X inline.** Workspace/product management lives next to the thing, never on a settings route. See [`docs/conventions/inline-management.md`](./docs/conventions/inline-management.md).

### Process

10. **No mocks, ever.** If it renders, it reads/writes real data.
11. **No half-finished implementations.** Do not stub and ship.
12. **Surgical changes only.** Touch only what the task requires. Every changed line traces to the request.
13. **You're free to choose the style which goes well with the Objective & what is that being tried to achieve.**
14. **Delete your own orphans.** Remove imports/vars your change made unused; do not delete pre-existing dead code without asking.
15. **Comments default to none.** Comment only when the _why_ is non-obvious.

### AI-specific

16. **Budget caps are sacred.** Enforced server-side. See [`architecture/runtime.md`](./architecture/runtime.md).
17. **Cache hits still get logged.**
18. **Guardrails run on input and output.**
19. **Eval failure is a deploy gate.** A ≥10-point score regression (on the 0–100 eval scale — KI-14) on any "Cadence core" case blocks merge unless explicitly waived.
20. **Drift is a passive watcher, not a blocker.**

### Testing

21. **Unit tests** for pure logic (pricing, guardrails, chunker, ICE/cron helpers).
22. **Integration tests** for chokepoint behavior (budget throw, cache short-circuit-but-log, guardrail block aborts, ticks idempotent).
23. **Run the dev server for UI changes.** If you cannot test UI in this environment, say so explicitly.

Full testing strategy: [`plan.md`](./plan.md).

---

## 4. Behavioral guidelines (reduce LLM coding mistakes)

These guidelines reduce common errors and ensure coordinated work. They apply to all tools (Claude Code, Antigravity, Gemini, Lovable) equally.

### 4.1 Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask first.
- If multiple interpretations exist, present them — do not pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- State a brief plan before writing code (even for small tasks).

### 4.2 Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 4.3 Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the task request.

### 4.4 Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. Cross-document update protocol (the closed documentation loop)

**This is a document-driven project. Documentation is a closed loop, not an afterthought.** Every time a feature is built, a decision is made, a convention changes, or a non-obvious learning emerges, the relevant docs **must** be updated in the same unit of work — before the task is considered done. Concretely, on every meaningful change:

- Update the doc(s) the change touches (table below).
- **Flip the row in the [Feature Dashboard](./docs/planning/feature-dashboard.md)** (the master status board) the moment a feature changes state: `🔨 In Dev` on pickup (+ Active-claims line, pushed immediately), `✅` on completion, or `⏸️`/`⏭️`/`🚧` with a reason. This is the front-door status every session reads before starting work; keeping it live is what stops parallel sessions colliding.
- **Update the Live status board** at the top of [`docs/planning/feature-backlog.md`](./docs/planning/feature-backlog.md) — _Now building · Next up · Blocked · Progress · Recent log · Last updated_. This is the granular shared cursor every tool (Claude Code, Antigravity, Gemini, Lovable) reads to know where we stopped and what's next; leave it true at the end of every session, even a paused one. Keep it consistent with the dashboard.
- Append a line to the **active build log** ([`plan.md`](./plan.md) section 4), and supersede the matching legacy entry (section 5) if one exists. (The board's _Recent log_ is a short rolling mirror; §4 is the full history — don't let them contradict.)
- Capture durable learnings in memory ([`docs/operations/memory.md`](./docs/operations/memory.md)) and session-local notes in Project Memory.
- **Capture comprehensively, thought-process-oriented (standing, founder 2026-06-19), applies to ALL strategy and decision docs.** When a chat produces an important decision, analysis, insight, or answer, write the reasoning and the *why* (not just the conclusion) into the relevant canon in the same session: decisions to [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md); reasoning + insights to [`docs/strategy/strategic-inputs-log.md`](./docs/strategy/strategic-inputs-log.md); moat / competition to [`docs/strategy/moat.md`](./docs/strategy/moat.md). These docs must serve YC / investor applications and let any future question be answered by reference; brief high-level capture is not enough.
- If the change invalidates something written elsewhere, fix it now — do not leave drift.

A change is not "done" until its documentation is true. An agent that ships code without updating docs has left the loop open. This rule is enforceable via a hook ([`docs/operations/hooks.md`](./docs/operations/hooks.md)) and is non-negotiable.

| Change type                                          | Update                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New product capability                               | [`README.md`](./README.md) + [`plan.md`](./plan.md)                                                                                                                                                                                                                                                                                                 |
| New convention or rule                               | this file or the relevant guidance doc                                                                                                                                                                                                                                                                                                              |
| New skill/subagent for this repo                     | [`docs/operations/skills.md`](./docs/operations/skills.md) / [`docs/operations/subagents.md`](./docs/operations/subagents.md)                                                                                                                                                                                                                       |
| Visual / motion / UI contract                        | [`design.md`](./design.md)                                                                                                                                                                                                                                                                                                                          |
| AI runtime change                                    | [`architecture/runtime.md`](./architecture/runtime.md) + [`plan.md`](./plan.md)                                                                                                                                                                                                                                                                     |
| Data schema change                                   | [`architecture/data.md`](./architecture/data.md) + [`plan.md`](./plan.md) + a migration                                                                                                                                                                                                                                                             |
| Frontend pattern change                              | [`architecture/frontend.md`](./architecture/frontend.md)                                                                                                                                                                                                                                                                                            |
| Integration / connector / protocol change            | [`architecture/integrations.md`](./architecture/integrations.md) + [`plan.md`](./plan.md)                                                                                                                                                                                                                                                           |
| Repo layout change                                   | [`ENTRY.md`](./ENTRY.md)                                                                                                                                                                                                                                                                                                                            |
| New file (any kind)                                  | Follow the **file-placement policy** in [`docs/README.md`](./docs/README.md) § "Repository map & file-placement policy": put it in the correct subfolder, add a row/link in that folder's index, and a "Related" cross-link block at the bottom — all in the same commit. Never at repo root or `docs/` top level; no duplicates or redirect stubs. |
| Start / pause / finish / block any feature           | **[Feature Dashboard](./docs/planning/feature-dashboard.md)** row (flip status + Active-claims) **first**, then the **Live status board** in [`docs/planning/feature-backlog.md`](./docs/planning/feature-backlog.md) (+ rollup mark)                                                                                                               |
| Phase / milestone completion                         | [`plan.md`](./plan.md) + [`docs/planning/archive/strategic-tasks.md`](./docs/planning/archive/strategic-tasks.md)                                                                                                                                                                                                                                   |
| Tech-stack decision                                  | [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md)                                                                                                                                                                                                                                                                                    |
| Session-friction pattern                             | this file, section 7                                                                                                                                                                                                                                                                                                                                |
| Durable rule / convention (cross-tool)               | New file under [`docs/conventions/`](./docs/conventions/) + reference from §3 above + thin pointer in tool memory if useful                                                                                                                                                                                                                         |
| Voice / UI-chrome / destructive / inline-mgmt change | [`docs/conventions/`](./docs/conventions/) (rule body) + the matching contract in `architecture/*.md` or `design.md` (restatement)                                                                                                                                                                                                                  |
| Add a captured field / input / stored column         | Run the Value Test + wiring rule in [`docs/conventions/data-minimalism.md`](./docs/conventions/data-minimalism.md) **before** adding; the consumer ships in the same change, or the field does not ship                                                                                                                                             |

**If you change capability scope without updating both README and plan, you have created drift.** Drift is the most expensive failure mode here.

---

## 6. When to escalate to the human

Do not proceed silently. Ask first when:

- The task is ambiguous and you would have to guess intent.
- A destructive operation is on the table.
- The change touches shared infrastructure or secrets.
- You discover unexpected state (unfamiliar files, in-progress branches, unstaged WIP).
- A skill or hook is blocking and you are not authorized to disable it.
- The work has exceeded the inferred scope of the request.
- You are about to commit something not explicitly approved. See [`docs/operations/commits.md`](./docs/operations/commits.md).

The cost of one clarification is far below the cost of one unwanted action.

---

## 7. Session-friction patterns (closed loop)

If you hit the same friction twice, add a row here before the third time. The cost of a note is far below repeated retries.

### Fact-forcing gate blocks Edit/Write of existing files

- **Symptom:** `[Fact-Forcing Gate] Before editing <path>, present these facts: …`
- **Permanent behavior:** Before any batch of Edit/Write on existing files, present a facts block in the response text _before_ the tool calls fire — cross-references/importers, public interfaces affected (or N/A), data files touched (or N/A), and the instruction verbatim. For new files: name the callers, confirm no existing file serves the purpose, quote the instruction.
- **If it persists across sessions:** set `ECC_GATEGUARD=off` or add `pre:edit-write:gateguard-fact-force` to `ECC_DISABLED_HOOKS`, then restart.

### Case-insensitive filesystem collisions

- **Symptom:** `File has not been read yet` when creating `AGENTS.md` while `agents.md` exists (macOS/Lovable filesystems are case-insensitive).
- **Permanent behavior:** never rely on case to distinguish two files. This repo uses `AGENTS.md` (the cross-tool standard) and `subagents.md` (engineering-subagent guidance) — distinct names, no collision.

### `git mv` invalidates Read tracking

- **Symptom:** `File has not been read yet` on a file you read under its old path.
- **Permanent behavior:** After any `git mv`/`mv`, re-Read the file at its new absolute path before the first Edit.

### Cost discipline

- **Symptom:** repeated `COST WARNING`.
- **Permanent behavior:** batch independent operations into one message with parallel tool calls. Do not narrate each step. Do not retry a blocked op in isolation — fix the pattern, then retry the batch.

---

### Stale redirect rot (absolute `file://` links to other repos)

18 redirect stubs (root `TASKS.md`, `commits.md`, `skills.md`, `memory.md`, `hooks.md`, `subagents.md`, `tools.md`, `docs/agent-ecosystem-plan.md`, and 11 under `docs/`) silently pointed into the retired `project-Cadence-v3` repo via absolute `file://` links — routing any tool that followed them out of this codebase (found and fixed 2026-06-11). **Rule:** redirect/pointer docs use relative in-repo links only — never absolute `file://` paths, never paths into another repo. When relocating a doc, retarget every stub in the same commit and verify with `grep -rn "file://" --include="*.md" .`.

## 8. Founding principles we build by (YC + Anthropic 2026 playbook, applied)

These are constraints on what we ship, not slogans.

- **AI as OS, not tool.** Every workflow runs through an intelligent layer.
- **Closed loops everywhere.** Every important process monitors its own output and self-corrects.
- **Queryable company.** Every action produces an artifact the system can learn from.
- **Software factories with a human in the loop.** Humans write specs and tests; agents implement and iterate until they pass.
- **No human middleware.** Remove routing layers; velocity equals information-flow speed.
- **Token-max in product value, token-optimize in our build.** Run a high inference bill where it replaces expensive headcount — but build the platform itself lean.
- **Founder as orchestrator.** The founder leads agent strategy directly; does not delegate conviction.
- **MVP-stage discipline.** Cadence is MVP-stage. Do not conflate MVP tactics with Launch/Scale tactics. Avoid: AI-codegen tech debt, hype-over-evidence, late security, over-scoping, founder bottleneck.

---

## 9. Open-source and licensing discipline

Lean toward open-source dependencies with permissive licenses (MIT / Apache-2.0 / BSD). Before adopting any dependency or vendor:

- Confirm the license is permissive and compatible. Flag anything copyleft (GPL/AGPL) or source-available (BSL/SSPL) **before** it lands.
- Flag any vendor lock-in (proprietary runtime, closed gateway, non-portable data) at the earliest point, not after build.
- Full standing analysis and the keep-vs-change decision: [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md).

---

## 10. Cross-tool co-development (Claude Code · Antigravity · Gemini · Lovable)

This repo is built across several agentic tools at once. The hard rule that makes that safe: **the git repo is the only shared substrate. Each tool's agent layer sits on top of it and is NOT shared.** Do not assume one tool's capabilities exist in another.

### 10.1 What is portable across tools, and what is not

| Layer                     | Portable?        | Where it lives                                                      | Consumed by                                                                                           |
| ------------------------- | ---------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Code + committed docs** | ✅ Fully         | git tree                                                            | every tool, via clone/sync                                                                            |
| **Operating rules**       | ✅ As plain text | `AGENTS.md` (canonical) + thin pointers (`CLAUDE.md`, `GEMINI.md`)  | Claude Code, Antigravity, Gemini, Codex, Cursor natively; Lovable by pasting into its Knowledge field |
| **MCP servers**           | ✅ Open standard | `.mcp.json` (repo root, env-driven, no secrets)                     | Claude Code + Antigravity read it directly; Gemini via extension; Lovable ✗                           |
| **Claude Code skills**    | ❌ Harness-bound | `.claude/skills/`                                                   | Claude Code only                                                                                      |
| **Claude Code subagents** | ❌ Harness-bound | `.claude/agents/`                                                   | Claude Code only                                                                                      |
| **Claude Code hooks**     | ❌ Harness-bound | `.claude/settings.json` + `.claude/hooks/`                          | Claude Code only                                                                                      |
| **Marketplace plugins**   | ❌ Harness-bound | `.claude/settings.json` → `enabledPlugins` (declared, not vendored) | Claude Code only                                                                                      |

**Consequence:** moving skills/subagents/hooks into the repo does **not** make Antigravity or Lovable execute them — those tools have no Skill/subagent/hook runtime. The only way to give _every_ tool the same behavior is to distill the rule into `AGENTS.md` (or an MCP server). Skills/agents/hooks are a Claude-Code accelerator on top of the shared rules, never a substitute for them.

### 10.2 Layer ownership (avoid duplicate tooling)

- **`.mcp.json` owns MCP _servers_.** It is the single, tool-agnostic source for Supabase, Playwright, etc. Both Claude Code and Antigravity read it. **Do not** also source the same server from a Claude Code _plugin_ — that registers the tool twice. Plugins here are for skills/agents only.
- **`enabledPlugins` (in `.claude/settings.json`) owns Claude-Code skills/agents** that you want pinned to the repo for any Claude Code instance (yours on another machine, a teammate, CI). Declare them; never vendor plugin source into the tree.
- **`.claude/skills/` + `.claude/agents/`** hold only _project-specific_ skills/agents (ones that encode this repo's conventions). Do **not** bulk-copy a personal user-level library (`~/.claude/skills/`) in here — it bloats the repo, drifts from upstream, and most of it is irrelevant to this project. Copy the subset that is genuinely Cadence-specific.

### 10.3 Per-tool entry points

- **Claude Code** → reads `CLAUDE.md` → `AGENTS.md`. Gets MCP from `.mcp.json`, skills/agents from `.claude/` + `enabledPlugins`.
- **Antigravity** → reads `GEMINI.md` (highest precedence) → `AGENTS.md`, plus modular rules in `.agent/rules/`. Configure its MCP to mirror `.mcp.json`.
- **Gemini CLI** → set `context.fileName` in `.gemini/settings.json` to `["GEMINI.md", "AGENTS.md"]`. Bundle MCP servers via an extension.
- **Lovable** (browser) → reads **only** the git repo (via GitHub sync) + its own Knowledge/instructions field. It will not honor any of the above tooling. Paste the relevant `AGENTS.md` rules into its Knowledge field, and treat its scope as UI/code scaffolding that lands in the repo.

### 10.4 The reconciliation workflow

All tools meet at **git**, not at a shared brain. To co-develop without drift:

1. **One canonical rule source.** If you change a rule, change it in `AGENTS.md`. The pointers (`CLAUDE.md`, `GEMINI.md`, Lovable Knowledge) only point.
2. **MCP parity.** When you add a server to `.mcp.json`, mirror it into Antigravity/Gemini config in the same unit of work so the tools have matching capabilities.
3. **Divide by strength.** Let Lovable handle UI scaffolding; let Claude Code/Antigravity handle agent-heavy, server, and migration work (where skills/subagents/hooks earn their keep). Both land in the same repo.
4. **Reconcile through commits, frequently.** Two tools editing the same files diverge fast. Pull/sync before a session, commit small, and never let one tool sit on a long-lived uncommitted working tree while another edits.
5. **Secrets never enter committed config.** `.mcp.json` and rules files use `${ENV_VAR}` placeholders; real values live in `.env` (git-ignored) or the tool's own secret store.

---

> **Final note.** This repo is shipped by one operator working with a swarm of agents. Speed matters, but speed _with drift_ is worse than steady, doc-true work. Follow the protocol. Update the docs you change. Capture friction in section 7. Ask when unsure.
