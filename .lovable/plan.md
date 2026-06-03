
# Plan: Agentic Proof Platform (supersedes the "YC demo cut" framing)

## 1. Why this changes

The previous cut optimized for a 90-second YC demo. Your ask is broader: prove — to YC, to design partners, to real PMs/founders — that Cadence delivers **agentic-native product management** that legacy PM tools (Jira/Linear/Productboard/ProductPlan/Aha) structurally cannot. The demo is a by-product; the platform is the point.

Two shifts:

- **From "demo cut" → "proof cut."** Every bundle must work end-to-end on real data, not just present convincingly for 90 seconds.
- **From "show 8 things" → "prove 4 claims."** Each claim is something legacy PM tools cannot do, and each maps to capability bundles + a measurable proof artifact.

## 2. The four claims we are proving

| # | Claim (vs. legacy PM tools) | Proof artifact |
|---|---|---|
| C1 | **Agents operate, humans govern** — agents run multi-step missions, not assist with forms | Live Mission Graph + Decision Queue with real approval gates firing |
| C2 | **Agent-to-agent handoff is first-class** — no human in the routing path | A2A trace: Discovery → Strategist → Planner, each reading prior agent's output, with full lineage |
| C3 | **The whole lifecycle is one governed loop** — Discover → Define → Plan → (later: Build/Ship/Learn) | One vertical slice running on real product data, ending in a re-scored opportunity |
| C4 | **Trust is earned and visible** — autonomy is dialed, not assumed | Trust Score + Autonomy Dial per agent, changing behavior of approval gates in real time |

If a visitor cannot point to each claim being true in the running product within 5 minutes, we have not shipped the proof.

## 3. The 8 capability bundles (re-scoped for proof, not demo)

Order = build order. Each has an explicit **"proof bar"** — the minimum that makes the claim true, not just visible.

1. **Governed Foundation** (kill-switch, mission spend caps, approval gates, audit log)
   *Proof bar:* killing an agent mid-mission halts spend within 1 tick; every action has a row in the audit log queryable from the UI. Supports C1, C4.

2. **Strategic Briefing surface** (human intent → machine-readable brief every agent reads)
   *Proof bar:* changing the brief visibly changes the next Discovery + Strategist output. Supports C1, C3.

3. **Agent Roster + Trust Score + Autonomy Dial** (6 durable agents from `plan.md` §6 visible as operators)
   *Proof bar:* dialing autonomy from Observing → Trusted removes a specific approval gate; Trust Score moves based on real outcomes. Supports C1, C4.

4. **Agent-to-Agent comms + handoff + sub-agent spawning** ⭐ the thesis (E1–E5)
   *Proof bar:* one mission with ≥3 hops between agents, each reading prior agent's structured output via the orchestration layer (not prompt-stuffing), full trace replayable. Supports C2.

5. **Live Mission Graph** (one screen showing the swarm) (E6, X1)
   *Proof bar:* the graph updates in real time as agents act; clicking a node opens that agent's trace + cost + tokens. Supports C1, C2.

6. **Vertical slice: Discover → Define → Plan** on real product data
   *Proof bar:* seeded with real signals from a real product (per your earlier answer), produces a real PRD + sprint plan, one item routed to approval, operator approves, plan updates. Supports C3.

7. **Decision Queue + approval gates UX** (the governance surface)
   *Proof bar:* every gate the agents hit lands in the queue with context (what, why, cost-if-approved, who proposed), approve/reject changes downstream behavior. Supports C1, C4.

8. **Product Memory + lineage + export** (anti-lock-in, learn-loop seed)
   *Proof bar:* every artifact (signal, theme, opportunity, PRD, decision) has lineage backward to its source; "Export everything" produces a complete, re-importable archive. Supports C3, and is the foundation for the Analyst learn loop later.

**Explicitly deferred** (named, dated, linked so reviewers see them as "foundation built, next milestone" — not gaps): autonomous Build/Test/Ship (S4–S6), GTM/Launch, Support, MCP/A2A external interop, advanced eval/drift/guardrail UIs, multi-product portfolio, BYO keys, billing.

## 4. Build sequence (concrete, doc-loop closed)

Reuse the sequence from the prior approved plan, but each step now ships against its **proof bar**, not just a demo screen:

```
FND-RUNTIME 0.9 (durable runtime) → FND-CACHE 0.2
  → Bundle 1 (Governed Foundation: kill-switch UI + spend caps + audit log query)
  → Bundle 2 (Strategic Briefing)
  → Bundle 3 (Agent Roster + Trust + Autonomy skeleton)
  → Bundle 4 (A2A handoff primitives) ← hardest, longest
  → Bundle 5 (Mission Graph reading from bundle 4)
  → Bundle 6 (Vertical slice on real data)
  → Bundle 7 (Decision Queue polish)
  → Bundle 8 (Product Memory lineage + Export)
```

Each bundle, in the same unit of work:
- Ships against its proof bar (not "looks done")
- Updates `docs/feature-backlog.md` Live status board + entry
- Appends a one-liner to `plan.md` §4
- Updates the matching `architecture/*.md` contract
- Adds "How to use / verify" block per the Core memory rule
- If strategic, an entry in `docs/strategy/session-decisions.md`

## 5. What changes in the docs (this turn, on approval)

- **`docs/feature-backlog.md`** — rename "▶ YC demo cut" to "▶ Agentic Proof Platform (v1)"; reframe each bundle with its claim + proof bar; keep reserved IDs C5/C6/U6.
- **`docs/strategy/session-decisions.md`** — new entry: "Reframed YC demo cut into Agentic Proof Platform: proof bars, not demo screens; same 8 bundles, harder bar."
- **`plan.md` §4** — one-line log entry referencing the reframe.
- **`active-task.md`** — keep pointed at FND-RUNTIME 0.9 (unchanged; foundation work was already next).
- **`README.md`** — no change yet; only update when bundle 4 ships (then we can publicly claim A2A).

## 6. What this is NOT

- Not adding new agents beyond the 6 durable + ephemeral in `plan.md` §6.
- Not changing the tech stack, the runtime chokepoint, or RLS model.
- Not pulling S4–S6 (Build/Test/Ship) forward — they remain deferred with a public milestone.
- Not building polish (animations, marketing pages) until the 8 bundles hit their proof bars.

## 7. One open question before I start cutting docs

The "real product data" you confirmed earlier — is it (a) **Cadence itself** (we eat our own dog food: real signals from this repo's issues, user feedback, decisions), or (b) **an external design partner's product** you already have access to? This changes the Bundle 6 seed plan and what we can show publicly. If you don't have a design partner lined up yet, I recommend (a) — Cadence-on-Cadence is the most credible YC story anyway ("we run our own roadmap on it").

On approval, I'll close the doc loop in one turn (status board + session-decisions + plan §4 + reframed bundle entries) and then start FND-RUNTIME 0.9.
