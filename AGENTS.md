# AGENTS.md — Operations & Engineering Manual

> **Canonical, tool-agnostic source of truth for every agent and human working in this repo.**
> Read natively by Google Antigravity, Gemini CLI, OpenAI Codex, Cursor, and the agents behind Lovable. Claude Code reads [`CLAUDE.md`](./CLAUDE.md) (a thin pointer to this file). Antigravity/Gemini precedence notes live in [`GEMINI.md`](./GEMINI.md).
>
> **Rule of the repo:** this file holds the operating rules. Product framing is in [`README.md`](./README.md). The build log and roadmap are in [`plan.md`](./plan.md). The UI contract is in [`design.md`](./design.md). Architecture contracts are in [`architecture/`](./architecture/). Do not duplicate content between files — link instead.

---

## 0. What we are building (one paragraph, so every agent shares the same goal)

Cadence (working name — see [`docs/naming.md`](./docs/naming.md)) is an **agent-native product operating system**: the substrate on which a swarm of specialist AI agents runs the entire product lifecycle — discover, reason, plan, build, ship, GTM, support, learn — while a human sets intent and approves the calls that matter. It is **not** a PM tool with AI bolted on. AI is the core. The human is an orchestrator, not middleware. Full thesis: [`README.md`](./README.md).

Three principles govern every decision in this repo:

1. **AI is the operating system, not a feature.** Every workflow flows through an intelligent layer with telemetry, evals, guardrails, and approval gates.
2. **Fully autonomous super-agents, governed.** Agents don't just assist — they run multi-step missions end to end (discover → build → test → ship → launch → support), in parallel, behind approval gates. Autonomy is the product; governance makes it safe.
3. **The moat is the end-to-end governed loop, not the model or the data.** Cadence is model-agnostic; frontier models are an input we orchestrate. Defensibility is owning + reliably orchestrating the *whole* lifecycle, the trust/governance layer, the switching cost of being system-of-record-and-action, and agent-native interop. See [`README.md`](./README.md). (Earlier "moat is data" framing is retired.)
4. **Build for agents first.** APIs, MCP, A2A, and CLIs over dashboards. The next users are agents. See [`architecture/integrations.md`](./architecture/integrations.md).

**Demo logins** (for screen-recording, investor / customer demos, any flow that needs a working login): two pre-provisioned accounts (`demo@redcadence.app`, `demo2@redcadence.app`, shared password `Cadence!Demo2026`) land in a fully populated Demo workspace. Full doc + re-seed instructions: [`docs/demo-credentials.md`](./docs/demo-credentials.md).

---

> ##  STANDING ORDER — keep the Live status board & active-task.md current (every tool, every session)
>
> **This is a continuous obligation, not a one-time setup.** On **every** session, in **every** tool — Claude Code · Antigravity · Gemini · Lovable · any future tool — you **must** check for in-progress tasks and update the status boards:
> - **At session start:** 
>   1. Check if `active-task.md` exists in the project root. If it does, you MUST read it to resume the exact sub-steps currently in-flight.
>   2. Read the **Live status board** at the top of [`docs/feature-backlog.md`](./docs/feature-backlog.md) to align on the broader feature context.
> - **While working:** Set **Now building** in [`docs/feature-backlog.md`](./docs/feature-backlog.md) and update checked/unchecked items in `active-task.md` as you make progress.
> - **Before you end or pause — non-negotiable:** Leave the status boards true. If work on a feature is not 100% complete, verify that `active-task.md` details exactly what is left so the next tool/agent can pick it up. If the feature is complete, delete `active-task.md` from the project root and flip status checkmarks in the backlog.
>
> This shared Git-tracked cursor ensures seamless handoffs between co-developing engines. If you only remember one rule, remember this one.

---

## 1. Pre-action protocol (run before any non-trivial task)

0. **Resolving "what is currently in-flight or next to build":**
   * **Active Task Check:** Check if `active-task.md` exists in the repository root. If yes, read it and immediately resume work from the listed checklist.
   * **Backlog Check:** If no `active-task.md` exists, go to the **Build-order rollup** in [`docs/feature-backlog.md`](./docs/feature-backlog.md#build-order-rollup-status--build-sequence): take the lowest-numbered step still `◑`/`☐` → expand its Key IDs to the feature entries above → pick the first whose `[status]` isn't `☑` → open its ticket in [`docs/foundation-audit.md`](./docs/foundation-audit.md) (step 1) or its entry (later steps).
   * **Task Initialization:** Once you identify the next task, create `active-task.md` in the project root with the detailed checklist of implementation sub-steps before writing code.
1. **State the request in one sentence.** If ambiguous, ask before acting.
2. **Scan skills and agents first, and then avaialble plugins and tools(MCP,etc) then act.** Surface candidate skills ([`skills.md`](./skills.md)) and subagents ([`subagents.md`](./subagents.md)) with a one-line "why," before invoking. Never reason from scratch when a skill exists. This is non-negotiable.
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

| Category | Examples | When to reach for |
|---|---|---|
| **Process & discipline** | `superpowers:brainstorming`, `superpowers:debugging`, `superpowers:test-driven-development`, `superpowers:systematic-debugging` , etc. | *Before* implementation — these shape how you code. |
| **Code review** | `ecc:typescript-reviewer`, `ecc:python-reviewer`, `ecc:rust-reviewer`, `ecc:go-reviewer`, `ecc:csharp-reviewer`, `ecc:java-reviewer`, `pr-review-toolkit:code-reviewer` , , etc. | Language-specific or pattern-specific review. Better than generic. |
| **Security & compliance** | `ecc:security-reviewer`, `ecc:a11y-architect`, `ecc:healthcare-reviewer` , etc. | Security audits, accessibility, compliance. Domain-specific. |
| **Database & data** | `ecc:database-reviewer`, `ecc:mle-workflow`, `ruflo-migrations:migrate-create` , etc. | Schema design, migrations, data patterns. |
| **Build & deploy** | `ecc:build-fix`, `ecc:go-build`, `ecc:rust-build`, `ecc:kotlin-build`, `ecc:cpp-build`, etc. | Build errors. Language-specific is better than generic. |
| **Design & frontend** | `emil-design-eng`, `design-taste-frontend`, `frontend-design`, `ecc:frontend-design-direction` , etc. | UI/UX work, motion, design systems. |
| **Docs & context** | `context7-plugin:docs`, `ecc:update-docs`, `claude-api:doc-coauthoring` , etc. | Library docs, documentation, knowledge. |
| **Architecture & planning** | `ecc:plan`, `ecc:architecture-decision-records`, `ecc:blueprint` , etc. | System design, ADR, multi-layer architecture. |
| **Testing & validation** | `ecc:tdd-workflow`, `ecc:e2e-testing`, `ecc:test-coverage` , etc. | TDD, end-to-end tests, coverage analysis. |
| **Performance & optimization** | `ecc:performance-optimizer`, `ecc:refactor-clean`, `ecc:cost-tracking` , etc. | Speed, memory, bundle size, cost. |
| **Workflow shortcuts** | `to-prd`, `to-issues`, `prototype`, and 700+ others | Domain-specific, user-installed, project-local. |

Full skill-selection logic & anti-patterns: [`skills.md`](./skills.md). Subagent selection: [`subagents.md`](./subagents.md).

---

## 3. Engineering rules

### Architecture
1. **Every AI call goes through the chokepoint** (`src/lib/ai/runtime.server.ts`). No second path. Contract: [`architecture/runtime.md`](./architecture/runtime.md).
2. **Every multi-step autonomous workflow goes through the orchestration layer.** No ad-hoc agent loops. Contract: [`architecture/orchestration.md`](./architecture/orchestration.md).
3. **RLS on every user table; scope by `user_id` + `workspace_id` + `product_id`.** No client-trusted role checks. Auth/tenancy/governance contract: [`architecture/security.md`](./architecture/security.md). Data contract: [`architecture/data.md`](./architecture/data.md).
4. **Server boundary integrity.** The service-role client is never imported from client code.
5. **App logic = server functions. Cron-poked endpoints = `/api/public/hooks/*`.** Contract: [`architecture/frontend.md`](./architecture/frontend.md).
6. **Loader + Suspense, not `useEffect + fetch`.**
7. **Boundaries on every route** — error, not-found, and a root default.
8. **Repo invariants are enforced by hooks** (commit policy, migration safety). See [`hooks.md`](./hooks.md) and [`commits.md`](./commits.md).

### Visual / tokens
7. **Semantic tokens only.** Hex literals in components are banned. See [`design.md`](./design.md).
8. **Motion via the canonical motion library; respect `prefers-reduced-motion`.**
9. **AI message UI contract** — every AI message exposes score, model+via, latency, tokens, cost, citations, feedback, View Trace, Replay-with. See [`design.md`](./design.md).

### Process
10. **No mocks, ever.** If it renders, it reads/writes real data.
11. **No half-finished implementations.** Do not stub and ship.
12. **Surgical changes only.** Touch only what the task requires. Every changed line traces to the request.
13. **You're free to choose the style which goes well with the Objective & what is that being tried to achieve.** 
14. **Delete your own orphans.** Remove imports/vars your change made unused; do not delete pre-existing dead code without asking.
15. **Comments default to none.** Comment only when the *why* is non-obvious.

### AI-specific
16. **Budget caps are sacred.** Enforced server-side. See [`architecture/runtime.md`](./architecture/runtime.md).
17. **Cache hits still get logged.**
18. **Guardrails run on input and output.**
19. **Eval failure is a deploy gate.** A ≥0.1 score regression on any "Cadence core" case blocks merge unless explicitly waived.
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
- **Update the Live status board** at the top of [`docs/feature-backlog.md`](./docs/feature-backlog.md) — *Now building · Next up · Blocked · Progress · Recent log · Last updated*. This is the shared cursor every tool (Claude Code, Antigravity, Gemini, Lovable) reads to know where we stopped and what's next; leave it true at the end of every session, even a paused one.
- Append a line to the **active build log** ([`plan.md`](./plan.md) section 4), and supersede the matching legacy entry (section 5) if one exists. (The board's *Recent log* is a short rolling mirror; §4 is the full history — don't let them contradict.)
- Capture durable learnings in memory ([`memory.md`](./memory.md)) and session-local notes in Project Memory.
- If the change invalidates something written elsewhere, fix it now — do not leave drift.

A change is not "done" until its documentation is true. An agent that ships code without updating docs has left the loop open. This rule is enforceable via a hook ([`hooks.md`](./hooks.md)) and is non-negotiable.

| Change type | Update |
|---|---|
| New product capability | [`README.md`](./README.md) + [`plan.md`](./plan.md) |
| New convention or rule | this file or the relevant guidance doc |
| New skill/subagent for this repo | [`skills.md`](./skills.md) / [`subagents.md`](./subagents.md) |
| Visual / motion / UI contract | [`design.md`](./design.md) |
| AI runtime change | [`architecture/runtime.md`](./architecture/runtime.md) + [`plan.md`](./plan.md) |
| Data schema change | [`architecture/data.md`](./architecture/data.md) + [`plan.md`](./plan.md) + a migration |
| Frontend pattern change | [`architecture/frontend.md`](./architecture/frontend.md) |
| Integration / connector / protocol change | [`architecture/integrations.md`](./architecture/integrations.md) + [`plan.md`](./plan.md) |
| Repo layout change | [`ENTRY.md`](./ENTRY.md) |
| New file under `docs/` | Add a row to [`docs/README.md`](./docs/README.md) AND a "Related" cross-link block at the bottom of the new file (siblings + relevant `architecture/*.md`) |
| Start / pause / finish / block any feature | **Live status board** in [`docs/feature-backlog.md`](./docs/feature-backlog.md) (+ rollup mark) |
| Phase / milestone completion | [`plan.md`](./plan.md) + [`TASKS.md`](./TASKS.md) |
| Tech-stack decision | [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md) |
| Session-friction pattern | this file, section 7 |

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
- You are about to commit something not explicitly approved. See [`commits.md`](./commits.md).

The cost of one clarification is far below the cost of one unwanted action.

---

## 7. Session-friction patterns (closed loop)

If you hit the same friction twice, add a row here before the third time. The cost of a note is far below repeated retries.

### Fact-forcing gate blocks Edit/Write of existing files
- **Symptom:** `[Fact-Forcing Gate] Before editing <path>, present these facts: …`
- **Permanent behavior:** Before any batch of Edit/Write on existing files, present a facts block in the response text *before* the tool calls fire — cross-references/importers, public interfaces affected (or N/A), data files touched (or N/A), and the instruction verbatim. For new files: name the callers, confirm no existing file serves the purpose, quote the instruction.
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

| Layer | Portable? | Where it lives | Consumed by |
| --- | --- | --- | --- |
| **Code + committed docs** | ✅ Fully | git tree | every tool, via clone/sync |
| **Operating rules** | ✅ As plain text | `AGENTS.md` (canonical) + thin pointers (`CLAUDE.md`, `GEMINI.md`) | Claude Code, Antigravity, Gemini, Codex, Cursor natively; Lovable by pasting into its Knowledge field |
| **MCP servers** | ✅ Open standard | `.mcp.json` (repo root, env-driven, no secrets) | Claude Code + Antigravity read it directly; Gemini via extension; Lovable ✗ |
| **Claude Code skills** | ❌ Harness-bound | `.claude/skills/` | Claude Code only |
| **Claude Code subagents** | ❌ Harness-bound | `.claude/agents/` | Claude Code only |
| **Claude Code hooks** | ❌ Harness-bound | `.claude/settings.json` + `.claude/hooks/` | Claude Code only |
| **Marketplace plugins** | ❌ Harness-bound | `.claude/settings.json` → `enabledPlugins` (declared, not vendored) | Claude Code only |

**Consequence:** moving skills/subagents/hooks into the repo does **not** make Antigravity or Lovable execute them — those tools have no Skill/subagent/hook runtime. The only way to give *every* tool the same behavior is to distill the rule into `AGENTS.md` (or an MCP server). Skills/agents/hooks are a Claude-Code accelerator on top of the shared rules, never a substitute for them.

### 10.2 Layer ownership (avoid duplicate tooling)

- **`.mcp.json` owns MCP *servers*.** It is the single, tool-agnostic source for Supabase, Playwright, etc. Both Claude Code and Antigravity read it. **Do not** also source the same server from a Claude Code *plugin* — that registers the tool twice. Plugins here are for skills/agents only.
- **`enabledPlugins` (in `.claude/settings.json`) owns Claude-Code skills/agents** that you want pinned to the repo for any Claude Code instance (yours on another machine, a teammate, CI). Declare them; never vendor plugin source into the tree.
- **`.claude/skills/` + `.claude/agents/`** hold only *project-specific* skills/agents (ones that encode this repo's conventions). Do **not** bulk-copy a personal user-level library (`~/.claude/skills/`) in here — it bloats the repo, drifts from upstream, and most of it is irrelevant to this project. Copy the subset that is genuinely Cadence-specific.

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

> **Final note.** This repo is shipped by one operator working with a swarm of agents. Speed matters, but speed *with drift* is worse than steady, doc-true work. Follow the protocol. Update the docs you change. Capture friction in section 7. Ask when unsure.
