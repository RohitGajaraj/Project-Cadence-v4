## What you actually want

A "Build" phase that, the moment a PRD lands on the roadmap, **picks itself up, gets coded by an agent (or several in parallel), tested, and shipped** — while you watch the swarm work, like Claude Code's terminal but multi-agent and governed. Conflicts (two agents touching the same file, failing CI on the same PR, contradicting each other) must surface, not silently overwrite.

Good news: the spine for this already exists. Bad news: nothing is hooked into the *Build* lane yet. The agentic plumbing (mission graph, hops, tool calls, approval gates, idempotency, traces) is real and shipped — it just stops at `github.issue.create`. We never built the agent that **picks up the issue and codes**.

## What we already have (don't rebuild)

- **Discover → Define → Plan** is live end-to-end. A mission can ingest signals, draft a PRD, prioritise backlog, open a real GitHub issue on `RohitGajaraj/Test-Project-Cadence`, link it back to the PRD. (Bundle 6, shipped today.)
- **Mission Graph** (`/missions/$id`) already renders parallel agent hops as a live DAG with handoff edges, per-step `thought/tool_call/final`, tool-call latency, and trace links — refreshing every 2 s. This is the visualization substrate.
- **Approval gates + Decision Queue + `withIdempotency`** are real — every write tool can be `auto`/`confirm`/`review`, every approval logs a trace, re-runs return the cached result.
- **Prompt Studio** (`/prompts`) is a versioned system-prompt manager with publish/rollback/A-B/assignment. It is *not* the same thing as Code Studio.
- **Code Studio** (`/studio`) is a multi-file HTML/CSS/JS prototype sandbox (templates: blank/landing/pricing/dashboard/form) with AI co-editing. It's a Lovable-lite for **design prototypes**, not for shipping product code.

## Code Studio + Prompt Studio — keep, rename, or repurpose?

| Surface | Verdict | Why |
|---|---|---|
| **Prompt Studio** (`/prompts`, in AI Ops) | **Keep as-is.** | It's the engineering control panel for our own AI surfaces — version/A-B/rollback system prompts. Different audience (you/AI Ops), different concern from "ship a feature." Don't conflate. |
| **Code Studio** (`/studio`, in Build) | **Rename + move out of Build → "Prototype Sandbox" in Discover.** | It only emits standalone HTML/JS artifacts — it cannot edit `src/`, open PRs, or run CI. Calling it "Build" is misleading; it's a *spec/prototype* tool that belongs next to PRDs and Discovery, not next to the Builder agent. |
| **(new) Build Console** (`/build`, in Build) | **Build this.** | The actual "agent codes, tests, ships while you watch" surface. This is Bundle 9 done right. |

This kills the "is Code Studio our Builder?" ambiguity in one move and frees the Build lane for the real thing.

## The strategy — Bundle 9 as a Build Console (3 thin slices, each ~1 day, each demoable)

### Slice 1 — Builder agent + scoped PR (one agent, one issue, one PR)

End state: from `/agents`, dispatch "Build the issue `#42`". A new **Builder** agent picks it up via the existing handoff/A2A bus, opens a real PR on `RohitGajaraj/Test-Project-Cadence` with a scoped diff and a description that links back to the issue and PRD. Approval-gated at the PR-open step. The PR shows up live on the Mission Graph as a `github.pr.open` node.

Concretely:
- New agent persona `builder` (seeded alongside the existing 6) with a tight system prompt: "you only ship one file at a time, you must read the issue body before diffing, you must call `github.pr.open` with `{issue_number, branch, files: [{path, contents}], title, body}`."
- New tool `github.pr.open` in `src/lib/ai/tools/registry.server.ts` next to `github.issue.create` — same auth, same idempotency wrapper (`pr:{issue_number}`), default mode `confirm`. Uses the contents/refs/pulls REST APIs (no native git in the Worker runtime).
- Wire `agent_handoff` so the Planner finishes with `→ builder` when an issue exists.

### Slice 2 — CI-read + failure-loop (one agent, one PR, real CI feedback)

End state: Builder watches GitHub Actions on its own PR (poll every ~10 s via existing tick infra), surfaces pass/fail to the Mission Graph as a CI node, and on red proposes a follow-up commit on the same branch — gated again. Two iterations max before it escalates to Decision Queue.

- New tool `github.ci.status({pr_number})` — read-only, `auto`.
- New tool `github.commit.append({pr_number, files})` — write, `confirm`.
- CI nodes render on the Mission Graph with the same status glyph vocabulary you already have.

### Slice 3 — Build Console UI (parallel + conflict-aware)

End state: a new route `/build` that is *the* place to watch the swarm. Per-PR card columns (Queued / Drafting / In Review / CI Running / CI Failed / Awaiting Merge / Merged), each card is a mini Mission Graph (you already have the component) plus PR diff link, CI badge, current step, owning agent. Multiple PRs/agents render side-by-side and update at 2 s.

- **Parallelism is already real** — the agent loop runs N missions concurrently, each with its own `agent_runs` chain. The Build Console is just a filtered, columnar view over `agent_runs WHERE agent='builder'` joined with `tool_calls WHERE name LIKE 'github.%'`.
- **Conflict detection** = a small server fn that flags: (a) two open PRs touching the same file path (from `github.pr.open` tool-call inputs), (b) two Builder hops with the same `issue_number` in-flight, (c) Builder proposing changes to a path another Builder is mid-edit on. Hits raise a row in `agent_messages` of kind `conflict` and pulse a red dot on both cards. No auto-resolve — surface to you.
- Click a card → existing `/missions/$id` for deep view. No new deep-view surface needed.

### Nav changes (the same patch that ships Slice 3)

- Rename **Build → Code Studio** to **Discover → Prototype Sandbox** (move `/studio` route into the Discover group, change the label, keep the route path for now to avoid breaking old links — a redirect can come later).
- Add **Build → Build Console** (`/build`, icon: `Hammer` or `Cpu`).
- **Build → Roadmap** gets a "Send to Builder" button on each PRD with a linked issue → dispatches a Builder mission with the issue id.

## What this does NOT do (out of scope, explicit)

- **Not an autonomous IDE.** Builder writes scoped diffs (one file or a small file set per PR), not refactors across the codebase. Cursor/Devin is a different product.
- **Not a custom CI.** We read GitHub Actions; we don't run tests in-Worker.
- **Not auto-merge.** Merge stays a separate slice (Bundle 10 — Ship) with its own gate. PRs sit awaiting human merge.
- **No new schema** in Slice 1 or 2. Slice 3 may add one nullable column on `tool_calls` for the file-path conflict index — TBD on implementation.

## What I need from you before I start building

Two product calls:

1. **Builder scope** — confirm "Builder opens scoped PRs (single file or small file set) on `RohitGajaraj/Test-Project-Cadence`, never auto-merges, defaults to `confirm` on every write." Or push back if you want it tighter/looser.
2. **Code Studio rename** — confirm renaming `/studio` to "Prototype Sandbox" under Discover. (Route stays `/studio` so nothing breaks; only the nav label + group move.) Or tell me to delete it instead — it has no users yet.

Once those are confirmed I'll build Slice 1 + the nav patch in the next turn, then Slice 2, then Slice 3. Each slice lands its own status-board entry per the closed doc loop.
