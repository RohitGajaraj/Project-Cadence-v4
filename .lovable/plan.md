## Bundle 3 — Agent Trust Score + Autonomy Dial (C6)

**Goal:** make every agent's earned trust visible, and let the operator move each agent along the trust arc (Observing → Proving → Trusted → Ambient). Moving the dial changes the default approval mode for that agent's write/planning tools, so trust visibly buys autonomy.

**Proof bar (C4 — "trust is dialed, not assumed"):** dialing one agent from Observing → Trusted removes a specific approval gate on its next mission, and the change is visible in the trace + Decision Queue.

Scope is deliberately narrow: ship the working loop end-to-end (score → badge → dial → enforcement). E8 Loop Health and trust-history charts are explicitly **out of scope** and stay in the backlog.

---

### What ships

1. **Trust Score per agent**, computed from real signals already in the DB:
   - mission success rate (`agent_runs.status = completed` vs `failed`/`halted`)
   - approval acceptance rate (`agent_approvals.status = approved` vs `rejected`)
   - eval pass-rate (mean of `ai_evals` numeric scores on the agent's events)
   - sample size (so a 1-run agent doesn't show 100%)
2. **Trust arc per agent**: Observing · Proving · Trusted · Ambient — auto-suggested from the score, operator-overridable.
3. **Autonomy Dial** on each agent card: choose the arc level. The level maps to a **default approval mode** that's applied to that agent's `write`/`planning` tool calls during the loop (overriding the per-tool `agent_tools.mode` only when the agent dial is *more* permissive, never more strict than the tool's own setting — safety floor preserved).
4. **Roster polish (C1)** — surface the score badge, current arc, last-run summary, and the dial inline on each agent card on `/agents`.

### Where it lives in the UI

- `/agents` page — each agent card gets:
  - a **Trust score** chip (0–100) with a tooltip breaking down the 4 inputs
  - the **Arc** label (Observing / Proving / Trusted / Ambient) with a small dial control to change it
  - a one-line "why" ("12 missions, 91% approval acceptance, 3 evals avg 0.82")

### Enforcement points (server)

- New module `src/lib/ai/trust.server.ts` exports:
  - `computeAgentTrust(supabase, userId, agentId) → { score, arc, breakdown }` (read-only aggregation)
  - `resolveApprovalMode(toolMode, arc) → "auto" | "confirm" | "review"` — the safety-floor combiner
- `src/lib/ai/loop.server.ts` calls `resolveApprovalMode` instead of using `modeOf.get(toolName)` directly. The high-risk `calendar.create` hard-force-confirm stays.

### Done when

- Every agent on `/agents` shows a trust score + arc.
- Operator can switch an agent to **Trusted**, dispatch a goal that uses a `confirm`-mode tool, and the loop executes immediately instead of queuing an approval (visible in the trace as `status: "executed"` not `"queued"`).
- Dropping the same agent back to **Observing** re-introduces the approval queue on the next run.
- Tool-level `mode = "review"` is never downgraded by the dial (safety floor).

---

### Technical details

**New table** `agent_autonomy` (one row per `(user_id, agent_id)`):
- `arc text not null default 'observing' check (arc in ('observing','proving','trusted','ambient'))`
- `set_by uuid` (auth.users id) · `set_at timestamptz default now()`
- RLS: owner-only read/write, scoped by `user_id`. Standard GRANTs to `authenticated` + `service_role`.
- No score column — score is computed on read so it can never go stale.

**Arc → default mode mapping** (applied only when the per-tool mode is `auto` or `confirm`; `review` is sticky):
| Arc | Default mode for write/planning |
|---|---|
| Observing | `review` (operator inspects every action) |
| Proving | `confirm` (one-click approve) |
| Trusted | `auto` for `confirm`-mode tools; `confirm` for `review`-mode tools |
| Ambient | `auto` for everything except hard-locked tools (`calendar.create`, future destructive ones) |

**Trust score formula** (transparent, in the tooltip):
```
score = 0.4 * mission_success_rate
      + 0.3 * approval_acceptance_rate
      + 0.3 * mean_eval_score
shrunk toward 0.5 by a Bayesian prior when sample size < 10
```

**Server functions** (new file `src/lib/trust.functions.ts`):
- `getAgentTrust({ agentId })` → `{ score, breakdown, arc, samples }`
- `getAllAgentTrust()` → batch version for `/agents` page (one round-trip)
- `setAgentArc({ agentId, arc })` → upsert into `agent_autonomy`

**Files touched**
- New: `supabase/migrations/<ts>_agent_autonomy.sql`, `src/lib/ai/trust.server.ts`, `src/lib/trust.functions.ts`
- Edited: `src/lib/ai/loop.server.ts` (use `resolveApprovalMode`), `src/routes/_authenticated.agents.tsx` (badge + dial), `src/integrations/supabase/types.ts` (auto-regen after migration)

**Doc loop (mandatory, same turn)**
- `docs/feature-backlog.md` — flip C6 to `[status: ☑ shipped <date>]`, update Live status board (Now building → Next up = Bundle 4), add "How to use / verify" block to C6 entry, mark Step 3 progress in rollup.
- `plan.md` §4 — one-line append.
- `architecture/orchestration.md` — note the dial as the new approval-mode resolver upstream of `agent_tools.mode`.
- `active-task.md` — created at start with sub-step checklist; deleted on completion.

---

### Explicitly out of scope (stays in backlog)

- Trust history chart over time (later, after we have weeks of data).
- Auto-promotion ("score >0.85 for 7 days → suggest Trusted") — manual dial only in v1.
- E8 Loop Health Monitor (separate ticket).
- Per-tool overrides inside an agent (use the existing `agent_tools` table).

---

### Verification checklist

1. Run migration → `/agents` loads with a trust chip on every agent.
2. Dispatch a goal as **Discovery Scout** (default `confirm` tools, default arc Observing) → approval gets queued, as today.
3. Open the dial on Discovery Scout, set arc to **Trusted**, dispatch the same goal → loop executes the tool inline; trace shows `status: "executed"`, Decision Queue is not touched.
4. Set the same agent to **Observing**, dispatch again → approval queue resumes.
5. Confirm `calendar.create` still hard-forces approval at Trusted (safety floor).
6. Tooltip on the trust chip shows the 4 inputs + the formula and current sample size.
