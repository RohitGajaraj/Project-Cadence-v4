# YC demo build plan — what to ship, in what order

The backlog already names this exact problem: **Agentic Proof Platform v1.1** in `docs/feature-backlog.md` defines 12 capability bundles + a build sequence whose endpoint is *"one continuous mission from a real signal → re-scored opportunity, passing through a real PR, real merge, real deploy, real outbound message, real inbound ticket."* That **is** the YC demo. This plan trims it to the minimum that proves the four claims, and orders it for fastest demo readiness.

## What we're proving in the demo (the four claims, unchanged)

1. **C1** — Agents *operate*, humans *govern* (multi-step missions + real approval gates)
2. **C2** — Agent-to-agent handoff is first-class (no human in the routing path)
3. **C3** — The whole lifecycle is *one* governed loop (Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn → re-feeds Discover)
4. **C4** — Trust is earned and visible (Trust Score + Autonomy Dial change real behavior)

If a YC partner cannot see each of these *running on real data* in ~5 minutes, the demo hasn't shipped.

## Current state (where we actually are)

- ✅ **Bundle 1 (Governed Foundation)** — chokepoint, tenancy, budgets, kill-switch, durable runtime (checkpoints + resume + idempotency + backpressure + cron sweeper), `github.issue.create` tool. Two leftovers: forced-restart integration test, operator end-to-end run.
- ◑ **Bundle 6 (Discover → Define → Plan slice)** — code shipped (3 PM tools + N1 GitHub write); needs operator to run the mission once on a real signal to confirm green.
- ☐ Bundles 2, 3, 4, 5, 7, 8, 9, 10, 11, 12 — not started.

## The 6-bundle minimum path to a credible YC demo

I'm cutting bundles 7 (Decision Queue polish), 8 (lineage view + export), and the unstarted "polish" tail. They're real, but not what makes or breaks the YC pitch — the **loop closing on real data** is.

| Order | Bundle | Why it's in the demo cut | Claim it proves |
|---|---|---|---|
| **1** | Close out **Bundle 1 + 6** | The whole demo runs on durable runtime + the first lifecycle slice. Without operator verification + the restart test, the foundation is "trust me," not provable. | C1, C3 |
| **2** | **Bundle 2 — Strategic Briefing (C5)** | One brief per workspace that visibly steers Discovery + Strategist output. Small, fast, and it's the YC narrative anchor ("here's the operator setting intent"). | C1, C3 |
| **3** | **Bundle 3 — Agent Roster + Trust Score + Autonomy Dial (C6)** | The on-screen artifact for C4. Dialing autonomy must *actually remove* an approval gate, and Trust Score must move on real eval/approval outcomes — not be a static badge. | C1, C4 |
| **4** | **Bundle 4 — A2A handoff (E1–E5)** ⭐ | The single hardest, most differentiating bundle. Without structured agent→agent handoff, "agents operate, humans govern" is marketing. ≥3 hops, each agent reading the prior agent's structured output via the orchestration layer, full replayable trace. | **C2** |
| **5** | **Bundle 5 — Live Mission Graph (E6)** | The visualization on top of #4. Click a node → that agent's trace + cost + tokens + approval state. This is the on-screen artifact that makes C2 land in a screen-share. | C1, C2 |
| **6** | **Bundles 9 + 10 + 11 + 12 — collapsed lifecycle close** | The minimum slice of Build (real PR) → Ship (approve merge + deploy webhook lands) → Launch (real outbound message) → Support → Learn (real inbound ticket → re-scored opportunity). One channel each, no extras. **This is the moment the loop closes — and the moment YC says "wait, do that again."** | C3, C4 |

Bundles 7 and 8 (Decision Queue polish, lineage view + export) ship after YC. They're polish on already-working substrate.

## What each bundle ships (just enough detail to scope)

### 1. Close out Bundle 1 + 6 — 1–2 days
- Forced-restart integration test (Done-criterion 1 of FND-RUNTIME).
- Operator runs the existing Discover → Define → Plan mission against a real Cadence signal; approves the GitHub write; confirms real issue appears.
- Small `prd.link_issue` tool so the PRD links back to the issue URL (noted as a possible follow-up in `active-task.md`).
- Flip `docs/foundation-audit.md` §0.9 🟡 → ✅, delete `active-task.md`, update status board.

### 2. Strategic Briefing (C5) — 1–2 days
- One `workspace_briefs` row per workspace: mission, ICP, current quarter focus, anti-goals.
- Edit surface (single-page editor, autosave).
- Inject the brief into the system prompt of Discovery + Strategist via the prompt registry — so changing it visibly changes the next mission's output.
- Verification: edit the brief, rerun a mission, diff the Strategist's output.

### 3. Agent Roster + Trust Score + Autonomy Dial (C6) — 3–4 days
- `/agents` becomes the operator's home for the swarm: list of agents, last mission, current dial.
- Trust Score = weighted composite of `eval_runs` pass-rate (60%) + `agent_approvals` accept-rate (30%) + recent mission completion (10%). Pre-existing tables — no new schema needed.
- Autonomy Dial: Observing / Proving / Trusted / Ambient. Each level changes the **default approval mode** the loop applies for that agent's tool calls. "Trusted" auto-approves `confirm`-mode tools the agent has scored ≥0.85 on; "Observing" forces `review` on writes. *This is the part where the dial must change real behavior.*
- Verification: dial Builder from Proving → Trusted, rerun the lifecycle mission, watch one approval gate disappear from the queue.

### 4. A2A handoff (E1–E5) — 5–7 days, hardest bundle
- **E1 Protocol** — typed envelope `{ from_agent, to_agent, mission_id, intent, payload_schema, payload, trace_id, parent_event_id }`.
- **E2 Tables** — `agent_handoffs` (append-only) + extend `agent_runs` with `parent_run_id`.
- **E3 Orchestrator hand-off API** — a server fn `handoff(toAgent, payload)` available to any agent's tool surface; it spawns a child `agent_runs` row, copies tenancy keys, and resumes via the existing loop.
- **E4 Structured payload contract** — each agent declares `produces` + `consumes` schemas in `agents` row; the orchestrator validates payloads at the boundary (Zod) so handoff is structured, not prompt-stuffed.
- **E5 Tracing** — every handoff writes an `ai_events` row of kind `handoff` linking parent + child trace ids.
- Verification: run the Discover→Define→Plan mission and confirm the trace shows ≥3 agent hops, each consuming the prior's typed payload, with no prompt-stuffing.

### 5. Live Mission Graph (E6) — 3–4 days
- New route `/missions/$id` rendering a DAG of `agent_runs` linked by `parent_run_id` + `agent_handoffs`.
- Real-time via Supabase Realtime on `agent_runs` + `ai_events`.
- Node = agent step; click → drawer with trace, cost, tokens, approval state. Edge color = handoff kind.
- Verification: open the graph while a mission runs, watch nodes light up in order, click any node to inspect.

### 6. Collapsed lifecycle close (Bundles 9 + 10 + 11 + 12) — 7–10 days
- **9 Build** — Builder agent gets a `github.pr.open` tool (scoped diff, single file or two, gated `confirm`). Reads CI status via `github.checks.list`. Surfaces failures back as a trace event.
- **10 Ship** — Approval-gated `github.pr.merge`. Webhook endpoint `/api/public/hooks/github-deploy` ingests deploy events into a new `deploys` table; mission graph lights up the Ship node with commit SHA + deploy URL.
- **11 Launch** — Growth agent gets `changelog.draft` (writes a markdown changelog row on merge) + `slack.post` (one outbound channel; confirm-gated; sends to one configured workspace). Real send.
- **12 Support + Learn** — `/api/public/hooks/support-inbound` ingests one inbound channel (email-to-webhook or Slack DM) into `signals`. Support agent tool `signal.triage` links the new signal to the original PRD/opportunity. Analyst agent tool `outcome.attach` writes a measured outcome onto the opportunity and triggers `backlog.prioritize`. **The loop closes here** — the same opportunity that started the mission gets re-scored based on the outcome of shipping it.

## The demo script (~3 minutes, what we rehearse against)

1. **Strategic Brief on screen** (Bundle 2) — "this is what the operator set the swarm to focus on this quarter."
2. **Run a mission from a real Cadence signal** (Bundles 1+6) — Discovery → Strategist → Builder.
3. **Switch to Mission Graph** (Bundle 5) — watch hops happen live; click one node to show structured handoff payload (Bundle 4).
4. **Approval gate fires** (Bundle 7-lite via existing Governance page) — operator approves GitHub PR open.
5. **PR appears on the repo** (Bundle 9). CI runs (Bundle 9). Approve merge (Bundle 10). Deploy webhook lands.
6. **Outbound message drafted to Slack** (Bundle 11) — approve, sent for real.
7. **Inbound support ticket arrives** (Bundle 12) → triaged → outcome attached → opportunity re-scored → shows up at the top of next Discovery cycle.
8. **Cut to Agent Roster** (Bundle 3) — Builder's Trust Score moved; dial it up; show one approval gate vanish on the next mission.

Every step on real data. Every step traceable. Every step on this repo.

## Timeline estimate (working solo, plan-mode honest)

| Bundle | Estimate | Cumulative |
|---|---|---|
| 1+6 close-out | 1–2 days | 2 days |
| 2 Brief | 1–2 days | 4 days |
| 3 Trust/Dial | 3–4 days | 8 days |
| 4 A2A | 5–7 days | 15 days |
| 5 Mission Graph | 3–4 days | 19 days |
| 6 Lifecycle close | 7–10 days | **~29 days** |

About 4 weeks of focused build to a demo that proves all four claims on real data, on this repo. Drop A2A's full schema validation or cut Trust Score scoring math to read-only and you can shave a week.

## What I need from you to start

- Confirm this is the cut you want (or trim further — e.g., drop Bundle 12 inbound to keep the loop "almost-closed" and save ~3 days).
- Confirm you'll do the Bundle 1+6 operator verification yourself (open `/agents`, run the mission, approve the GitHub write) — that unblocks the audit flip and starts the clock on Bundle 2.

Once you say go, I'll start by closing out Bundle 1+6, then march down the list.