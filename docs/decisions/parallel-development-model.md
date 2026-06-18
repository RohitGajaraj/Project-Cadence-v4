# Parallel Development Model — Document-Driven, No Code Silos

> **How this repo is co-developed across Claude Code, Lovable, Antigravity, and Gemini without coordination overhead.** The model: files are shared, documentation is the boundary. Canonical rules: [`../../AGENTS.md`](../../AGENTS.md). This document is the detailed reference; AGENTS.md §10 is the summary pointer.

---

## Core principle: No code ownership

There are no "Claude Code files" or "Lovable files." Every tool can touch every file. The status board and the SSOT section 0 (the live cursor, [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md)) coordinate who is working on what — not file ownership rules.

**Why this works:** Documentation is the coordination mechanism. When every tool documents what it did, why, and what comes next — handoffs are seamless, conflicts are rare, and context is never lost.

---

## The three rules

**Rule 1: Whoever touches a file owns that task.**
Temporary ownership. When you start working on a task, you own it until you hand it off via the SSOT section 0 (the live cursor) and the Live status board. The next tool picks it up from there.

**Rule 2: Always check before you start.**
Before touching any file, check the Live status board (`docs/planning/feature-dashboard.md` top section). If another tool is already working on that task: stop, pick a different task. If no tool is working on it: claim it by setting "Now building" in the status board.

**Rule 3: Leave the codebase in a known state.**
When you end a session, the next tool must be able to continue without asking you questions. That means:

- The SSOT section 0 (the live cursor) tells them exactly where you stopped
- The Live status board tells them the current state
- Your commits tell them what changed and why

---

## The handoff mechanism (replaces code ownership)

| Artifact                                          | Purpose                                          | Updated when                                 |
| ------------------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| SSOT section 0 (the live cursor, `docs/planning/SOURCE-OF-TRUTH.md`) | Exact checklist of in-flight sub-steps           | Start of task, each sub-step, end of session |
| Live status board (`docs/planning/feature-dashboard.md` top) | "Now building," "Next up," "Blocked," recent log | Start and end of every session               |
| Git commits                                       | What changed, why it changed (one-line WHY)      | Every logical chunk of work                  |
| `docs/strategy/session-decisions.md`              | Major strategic decisions from sessions          | When a strategic decision is made            |
| `docs/planning/feature-backlog.md`                | Feature state (◑/☑)                              | When feature is started or completed         |
| Architecture docs (`architecture/`)               | How the system works                             | When architecture changes                    |
| `design.md`                                       | Design tokens, component contracts               | When UI patterns change                      |

---

## Session workflow for every tool

### Session start

1. `git pull origin main` — get latest from all other tools
2. Read the SSOT section 0 (the live cursor) in [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) — this is your exact handoff
3. Read Live status board (`docs/planning/feature-dashboard.md` top) — check "Now building"
4. Read latest positioning in `docs/strategy/` — know what you're building and why
5. Set "Now building" in status board with your task ID

### During work

- Commit every 5–15 minutes with a clear WHY message
- Push immediately after every commit (so other tools see your work)
- Update the SSOT section 0 (the live cursor) checkboxes as you complete sub-steps
- If you change design tokens: update `design.md` in the same commit
- If you change routing/architecture: update the relevant `architecture/*.md`

### Session end

- Push all uncommitted work
- Update Live status board: feature done (☑) or paused (with "Now building" set)
- Update the SSOT section 0 (the live cursor): exact state for the next tool
- Add to `docs/strategy/session-decisions.md` if you made a strategic decision
- Commit and push the status updates

---

## What each tool owns (and doesn't exclusively own)

### Every tool owns:

- The SSOT section 0 (the live cursor) — keep it true
- Live status board — update it
- Code quality — write clean, tested, documented code
- Doc sync — keep relevant docs in sync with code changes
- Handoff documentation — leave full context for the next tool

### No tool exclusively owns:

- Any file in `src/`
- Any file in `supabase/`
- Any doc in `architecture/`
- Any layer of the stack

The only "ownership" that exists is the temporary ownership of the current task — held until the handoff is complete.

---

## Conflict avoidance

Most conflicts are prevented by:

1. Checking the status board before starting
2. Pushing frequently (so others see your work quickly)
3. Small, focused commits (reduces merge surface)

When conflicts do happen:

1. The first tool to commit and push wins
2. The second tool pulls, gets a merge conflict, resolves it, pushes again
3. Both tools note this in the status board if it was tricky
4. No one force-pushes to resolve conflicts

---

## Cross-references

This model is summarized in:

- [`../../AGENTS.md`](../../AGENTS.md) §10 (summary pointer)
- [`../../CLAUDE.md`](../../CLAUDE.md) (Claude Code behavioral guidelines)
- [`../../GEMINI.md`](../../GEMINI.md) (Antigravity/Gemini guidelines)
- [`../../.lovable-config.txt`](../../.lovable-config.txt) Section 5 (Lovable Knowledge)

The Live status board lives in: [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md)
