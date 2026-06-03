
# FND-KILLSWITCH (0.6) — Global pause, mission caps, loop token cap, approval timeout

**Why this, why now.** The Live status board in `docs/feature-backlog.md` declares this as **Next up**, and `docs/foundation-audit.md` §0.6 lists exactly four missing pieces. Spend caps are already enforced before spend in `src/lib/ai/runtime.server.ts`; this ticket adds the governance layer on top so a human can stop a runaway swarm, bound a mission's blast radius, and prevent approvals from sitting forever. It is a foundation prerequisite for everything autonomous (Epic D/E/I/J/K).

**Persona fit.** All three personas (Solo PM, founder-as-org, technical founder) need a single "stop everything" lever and predictable per-mission ceilings before they will trust autonomy. This is the governance side of "Agents do, humans govern."

---

## Scope (exactly the four gaps from foundation-audit.md §0.6)

1. **Global + per-workspace kill-switch / pause** — one switch that halts new AI calls and new loop steps.
2. **Per-mission spend cap** — a budget bound to a single agent run (mission), enforced before each call.
3. **Per-loop token cap** — cumulative input+output tokens across all steps of one loop, enforced before each call.
4. **Approval timeout + escalation** — pending `agent_approvals` auto-expire and/or escalate after a configurable TTL.

Out of scope (explicit): durable runtime (0.9, separate ticket), tenant-salted cache (separate), circuit breaker (0.8+).

---

## Build steps

### Step 1 — Data model (one migration)
New/changed tables, all three-key tenancy-aware (`user_id` + `workspace_id`, `product_id` where applicable), RLS on, GRANTs included.

- `kill_switches` — rows: `scope` (`'system'` | `'workspace'`), `workspace_id` (nullable for system), `paused` bool, `reason` text, `set_by`, `set_at`. System row is service-role-only; workspace rows are writable by workspace admins.
- `agent_runs` — add `mission_spend_cap_usd numeric`, `mission_token_cap int`, `tokens_used int default 0`, `spend_used_usd numeric default 0`, `halted_reason text`. (If `agent_runs` already tracks a run/mission; otherwise add the columns to the equivalent table — confirmed during step 0 read.)
- `agent_approvals` — add `expires_at timestamptz`, `escalation_state` (`'pending'|'expired'|'escalated'|'resolved'`), `escalated_at`, `escalated_to`.
- New view or helper RPC `current_kill_state(workspace_id uuid) returns table(system_paused bool, workspace_paused bool, reason text)` — `SECURITY DEFINER`, used by the chokepoint without exposing the table directly.

### Step 2 — Chokepoint enforcement (`src/lib/ai/runtime.server.ts`)
Before the existing per-user / per-surface cap check, in order:
1. Call `current_kill_state(workspace_id)`. If paused → throw a typed `KillSwitchError` (HTTP 423 / surfaced as a governance halt event in `ai_events`).
2. If the call carries a `runId` (mission), read `agent_runs.spend_used_usd` + `mission_spend_cap_usd`. If `projected_cost > cap` → throw `MissionCapError`.
3. If the call carries a `runId`, read `tokens_used` + `mission_token_cap`. If `projected_tokens > cap` → throw `LoopTokenCapError`.
4. On successful completion, atomically `update agent_runs set tokens_used = tokens_used + …, spend_used_usd = spend_used_usd + …` in the same transaction that writes `ai_events`.

All four errors are logged to `ai_events` with a new `event_type` value (`governance_halt`) so traces show the reason; this preserves the "cache hits still get logged" invariant for halts.

### Step 3 — Agent loop wiring (`src/lib/ai/loop.server.ts`)
- At the top of each step (before `callModel`), re-check `current_kill_state` and run caps. A pause that flips mid-mission halts the next step (no in-flight cancellation needed for MVP).
- When the chokepoint throws any governance error, the loop sets `agent_runs.halted_reason` and exits gracefully (no retry).

### Step 4 — Approval timeout + escalation
- New server function `expireStaleApprovals` in `src/lib/governance.functions.ts` (idempotent): finds `agent_approvals` where `expires_at < now()` and `escalation_state = 'pending'`, flips to `'expired'`, and cancels the parent loop step.
- Wire it to the existing pg_cron hook pattern: new public route `src/routes/api/public/hooks/approvals-tick.ts` (signature-verified per `docs/public-api-endpoints.md`), and a pg_cron entry running every minute. The cron URL uses the stable `project--{id}.lovable.app` host.
- Default `expires_at = now() + interval '24 hours'` when an approval is created (configurable per workspace later — out of scope for this ticket).

### Step 5 — Governance UI surface (frontend slice — minimal, governance-first)
Single new route `src/routes/_authenticated.governance.tsx` with three sections, all using semantic tokens from `src/styles.css`, TanStack Query, loader + Suspense, error/not-found boundaries:
- **Kill-switch panel** — system status (read-only for non-admins) + a workspace pause toggle with required reason text. Calls `setWorkspacePause` server function.
- **Mission caps panel** — list of in-flight `agent_runs` with `spend_used / cap`, `tokens_used / cap`, and the halt reason if any. Read-only.
- **Stale approvals panel** — pending approvals with countdown to `expires_at`; admin can extend or resolve.

Add a small `BudgetBar`-adjacent indicator in `AppShell.tsx` that shows a red dot when the current workspace is paused. No deep redesign — this is the governance MVP surface.

### Step 6 — Tests + done signals
- Integration test: pause workspace → next `callModel` for that workspace throws `KillSwitchError`, `ai_events` row written with `event_type='governance_halt'`.
- Integration test: mission cap exceeded mid-loop → loop halts on the offending step, prior steps remain in `ai_events`, `agent_runs.halted_reason` set.
- Integration test: approval older than `expires_at` → cron tick flips it to `expired` and the loop does not advance.
- Manual: toggle pause in the governance UI, observe the AppShell red dot, then unpause.

### Step 7 — Closed documentation loop (same commit as the last code change)
- Update **Live status board** in `docs/feature-backlog.md`: clear "Now building" or mark 0.6 done, recompute Progress, recent log entry.
- Append to `plan.md` §4 active build log.
- Update `docs/foundation-audit.md` §0.6 verdict from 🟡 → ✅ with new evidence lines.
- Update `architecture/runtime.md` to document the four-stage pre-call check ordering.
- Update `architecture/security.md` with the kill-switch + mission cap contract.
- Add `docs/strategy/session-decisions.md` entry only if a non-obvious decision is made during build (e.g. defaulting expires_at = 24h).
- Delete `active-task.md` from repo root (created at session start, removed on completion).

---

## Technical notes for engineers

- **Tenancy.** Every new table/column is keyed by `workspace_id` and gated by RLS using the existing `has_workspace_membership(auth.uid(), workspace_id)` helper. The system-scope kill-switch row uses `workspace_id IS NULL` and is service-role-only.
- **Chokepoint shape.** New checks live inside `callModel()` and `callModelStream()` — both must enforce identically. Streaming halts emit a final SSE `event: governance_halt` frame so the client renders a halt card instead of an error.
- **Atomicity.** `tokens_used` / `spend_used_usd` updates must be in the same transaction as the `ai_events` insert; otherwise a crash between the two leaks budget.
- **No client-trusted state.** All caps and the kill-switch are evaluated server-side from the DB; the UI is purely a viewer + admin control surface.
- **Cron security.** Approvals-tick endpoint verifies an HMAC header (`docs/public-api-endpoints.md` pattern). Secret added via `secrets--add_secret` as `APPROVALS_TICK_SECRET`.
- **Migrations.** Single migration file under `supabase/migrations/`, CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY in that order, per the public-schema grants rule.

---

## Out of scope (will be follow-ups)
- Durable resume after a kill-switch lift (needs FND-RUNTIME 0.9).
- Per-tool cost ceilings (FND-BLAST 0.5).
- Email/Slack escalation transport on approval expiry (transport plumbing comes with Epic E).

---

## Done when
- All four foundation-audit gaps are checkable in code + DB.
- The three integration tests above pass.
- A workspace pause visibly halts a running mission within one step.
- Foundation-audit §0.6 flipped to ✅, status board updated, plan.md §4 has the dated entry, `active-task.md` removed.
