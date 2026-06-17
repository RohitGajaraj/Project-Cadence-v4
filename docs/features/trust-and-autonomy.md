# Agent Trust Score & Autonomy Dial

> Canonical explanation of what the Trust score on `/agents` means, how it is
> computed, what the four arc levels (Observing → Proving → Trusted → Ambient)
> do at the approval gate, and how operators should think about moving the
> dial. Linked from `docs/feature-backlog.md` (C6) and
> `architecture/orchestration.md`.

## 1. What the number means (operator view)

**Scale: 0 to 100.** Every agent gets one Trust score, recomputed on every read
from the real history Cadence already records. No cached column, can't go
stale.

|  Score | Qualitative label   | What it says                                                                                                     |
| -----: | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 0 to 34 | At-risk / Observing | Brand new or recently failed. Keep on Observing. Every tool call should queue for review.                       |
| 35 to 54 | Observing           | Below neutral. Mistakes still likely; keep human eyes on every step.                                             |
| 55 to 74 | Proving             | Earning trust. Right more often than not, but worth catching errors with a one-click confirm.                    |
| 75 to 89 | Trusted             | Consistently succeeds, takes feedback well, evals look good. Day-to-day default; confirm-mode tools run inline. |
| 90 to 100 | Ambient             | Exceptionally reliable. Runs inline except for hard-locked high-risk tools (e.g. `calendar.create`).             |

Agents with fewer than ~10 missions are pulled toward 50 (neutral) by a
Bayesian shrinkage prior so a single lucky run can't show 95.

## 2. The three ingredients (tooltip breakdown)

The chip's hover tooltip on `/agents` shows the full breakdown. The formula:

```
raw = 0.4 · mission_success_rate
    + 0.3 · approval_acceptance_rate
    + 0.3 · mean_eval_score
score = round( shrink(raw, samples) · 100 )
shrink(r, n) = (r · n + 0.5 · 10) / (n + 10)
```

| Weight | Signal                   | Source                                         | What it measures                                                                                |
| -----: | ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
|    40% | Mission success rate     | `agent_runs.status` (`completed` vs total)     | End-to-end: did the mission finish without erroring or being rejected?                          |
|    30% | Approval acceptance rate | `agent_approvals.status` (`approved` vs total) | When the human had to decide, did they say yes? Proxy for "the agent proposed the right thing." |
|    30% | Mean eval score          | `evals.score` joined via `ai_events.agent_id`  | Automated quality scores on outputs (plan quality, code correctness, spec completeness, etc.).  |

The total **samples** number (`missions + approvals + evals`) drives the
shrinkage. Until it crosses ~10, the score is conservative by design.

## 3. The Autonomy Dial: what each arc actually does

The dial lives in `agent_autonomy(user_id, agent_id, arc)`. The agent loop
(`src/lib/ai/loop.server.ts`) composes the arc with each tool's per-tool
`agent_tools.mode` (`auto` / `confirm` / `review`) via
`resolveApprovalMode(toolMode, arc)` in `src/lib/ai/trust.server.ts`.

| Arc           | Effect on `auto` tools                        | Effect on `confirm` tools | Effect on `review` tools |
| ------------- | --------------------------------------------- | ------------------------- | ------------------------ |
| **Observing** | Forced to `review` (operator sees every step) | Forced to `review`        | `review` (unchanged)     |
| **Proving**   | Promoted to `confirm` (one-click)             | `confirm` (unchanged)     | `review` (unchanged)     |
| **Trusted**   | Run inline                                    | Run inline                | `review` (unchanged)     |
| **Ambient**   | Run inline                                    | Run inline                | `review` (unchanged)     |

### Safety floors (non-negotiable)

1. **`review` is sticky.** The dial can never downgrade a tool that the
   operator (or platform) has explicitly marked `review`.
2. **Hard-locked tools.** `calendar.create` and any future tool flagged
   high-risk keep `confirm` even at Ambient. Add these in the
   `resolveApprovalMode` overrides, never via the dial.
3. **Score is not auto-applied to the dial.** The UI surfaces a
   _suggested arc_ derived from the score, but the operator is the one who
   moves it. Trust must be granted, not assumed.

## 4. How operators should use it

- **Start new agents on Observing.** Watch their work; approve the good ones.
- **Promote to Proving** once you've seen a handful of clean runs. You
  still confirm everything, but with one click instead of a full review.
- **Promote to Trusted** when the score climbs into the mid-70s and you
  notice you're approving without reading. That's the signal to let it run.
- **Reserve Ambient** for agents whose mistakes you'd be comfortable
  catching after the fact, not before.
- **Demote at the first regression.** A drop in approval acceptance or a
  failed mission is a reason to step the dial back down. The safety floor
  is there for hard limits, not for routine prudence.

## 5. Where it lives in the codebase

- Table: `supabase/migrations/<ts>_agent_autonomy.sql` (`agent_autonomy`).
- Compute + combiner: `src/lib/ai/trust.server.ts`
  (`computeAllAgentTrust`, `resolveApprovalMode`, `suggestArc`, `loadAgentArc`).
- Server functions: `src/lib/trust.functions.ts`
  (`getAllAgentTrust`, `setAgentArc`).
- Loop integration: `src/lib/ai/loop.server.ts` calls
  `resolveApprovalMode(toolMode, arc)` at every tool-call gate.
- UI: `src/components/cockpit/TrustDial.tsx` (the Trust Dial on the Agents
  tab — score, the 4-stage arc as a clickable dial, suggested promotion, and
  the breakdown), wired into `src/components/cockpit/AgentsPanel.tsx`.

## 6. What this is _not_

- Not a leaderboard. The score is operator-facing context, not a public
  metric.
- Not auto-promoted. The dial is always a human decision.
- Not retroactive. Changing the arc affects future tool calls, not the
  current decision queue.
- Not a substitute for evals or guardrails. It's a summary _of_ them.

## 7. AMBIENT-ARC: surfacing the dial on the cockpit (shipped 2026-06-17)

The engine computed all of this (`getAllAgentTrust` returns `score`,
`arc`, `suggested_arc`, and the `breakdown`) and the loop already executed
unattended at the **Ambient** arc, but the cockpit only ever showed a bare
`trust_arc` string on the agent card. AMBIENT-ARC closes that visibility gap.

The **Trust Dial** (`src/components/cockpit/TrustDial.tsx`, on the Agents tab)
renders, per agent:
- the 0-100 trust **score** and sample count;
- the four arcs as a **clickable dial** (Observing → Proving → Trusted →
  **Ambient**) — the current arc is filled, Ambient glows ember; clicking a
  stage sets the arc via `setAgentArc`. The dial **is** the control;
- a **"Promote to {suggested}"** affordance whenever `suggested_arc` is higher
  than the current arc (the score-derived hint, never auto-applied — safety
  floor #3);
- an expandable **breakdown** (missions / approvals / eval-mean) and a
  plain-language meaning per arc (Ambient = "runs confirm-gated tools
  unattended where it is safe to").

This is the only place **Ambient** is shown: the user-wide AutonomyCard ladder
(Today) deliberately tops out at Trusted because Ambient is per-agent, not a
workspace stage. No new server fn and no migration — it consumes the existing
`getAllAgentTrust` / `setAgentArc`. Trust is user + agent scoped (agents are
not workspace-scoped), so the dial is intentionally workspace-agnostic.

**Fast-follow (not built):** an auto-promotion achievement on the Today
AutonomyCard when an agent crosses into a new arc.

## 8. Related

- A2A handoff (how receiver-arc gating applies on handoff): [`a2a-handoff.md`](./a2a-handoff.md)
- Orchestration contract (approval modes, sweeper, mission lifecycle): [`../architecture/orchestration.md`](../architecture/orchestration.md)
- Governance & approval gates (kill-switch, caps, Decision Queue): [`../architecture/security.md`](../architecture/security.md)
- AI runtime chokepoint (where the gate is enforced server-side): [`../architecture/runtime.md`](../architecture/runtime.md)
- Feature ticket (C6, Trust score + Autonomy dial): [`feature-backlog.md`](./feature-backlog.md)
- Parent index: [`README.md`](./README.md)
