# F-AGENTS-MENTIONABLE: @-mention an agent in chat

> Type `@strategist draft a PRD for off-hours routing` in Ask and the mission starts with the Strategist directly, skipping the orchestrator's planning step. The named specialist is the lead; the rest of the mission machinery (dispatch, handoffs, approvals, completion, decision capture) is unchanged.

**Status:** ✅ Shipped 2026-06-18 (server) + 2026-06-18 cycle 21 (composer picker + case-insensitive parse). Live-verify on the next publish. **Surface:** `/chat` (Ask). **Spec source:** SSOT §3 (strategic rank #2, "felt agentic command"); v10 master blueprint Missions row ("@-mentionable agents").

---

## What it does

In Ask, an explicit `@agentslug` is treated as an unambiguous command to run that specialist. Cadence:

1. Parses the first resolvable `@slug` in the message against the user's **enabled** agent roster (the orchestrator is excluded, it is the implicit default).
2. Skips the intent classifier entirely (one fewer model call) and dispatches a mission led by the named agent.
3. Replies inline with the mission card so the user can track progress and approve decisions, exactly like an orchestrated mission.

A bare `@agent` with no task falls back to regular chat. An `@slug` that does not match an enabled agent is left as plain text and the normal classifier path runs, so a typo never blocks the message.

## Why a single-step DAG (not "just run the agent")

The mission lifecycle is driven by the deterministic, model-free `advanceMissionCore` cron (dispatch ready steps → reflect child-run status → finalize). The only thing the orchestrator uniquely contributes is the `mission_steps` DAG; everything downstream keys off the steps, not off "did an orchestrator run". Critically, `maybeCompleteMission` completes a mission when its steps are terminal (it keys off `steps.length > 0`); a mission with **zero** steps and **no** orchestrator run never finalizes and would hang at `running` forever.

So a mention does not bypass the lifecycle, it **pre-plans** it: it writes one `mission_steps` row (`idx 0`, `agent_slug` = the mentioned agent, `sub_goal` = the cleaned goal, `depends_on []`, `status 'planned'`), the exact row shape `mission.plan` persists, then fires `advanceMissionCore` once to dispatch it immediately (idempotent; the `resume-runs` cron also advances it). This is **cheaper and faster** than the orchestrator path (no planning round-trip) while honoring the named agent exactly, and it completes correctly because `steps.length > 0`.

## How it works (wiring)

**Server (`src/routes/api/chat.ts`):**
- `parseAgentMentions(text)` extracts candidate `@slug` tokens. The match requires a leading word boundary, so email addresses (no preceding whitespace before `@`) never match. Case-insensitive, lowercased to the `agents.slug` charset; a dangling hyphen is dropped.
- `stripMention(text, slug)` removes the chosen `@slug` token so the dispatched goal reads as a clean instruction.
- The roster is fetched once (`agents` where `user_id` + `enabled = true`, excluding `orchestrator`); the first candidate that matches an enabled slug wins.
- Pre-flight for a mention only requires a workspace (the agent was already resolved as enabled). Dispatch inserts the single `mission_steps` row + fires `advanceMissionCore`. Reply text: "On it. I've dispatched **‹title›** to ‹agent name›."

**Composer (`src/routes/_authenticated.chat.tsx`):**
- `detectMentionQuery(value, caret)` returns the partial slug under the caret when it sits inside an open `@token` (null the moment a space closes it, which is what keeps the picker from ever hijacking Enter-to-send).
- An agent picker floats above the composer (reuses `listAgents`, filtered to enabled non-orchestrator agents by slug/name). Arrow keys move the highlight, Enter/Tab/click insert `@slug `, Escape dismisses. When the picker is closed the keydown path is byte-identical to before, so message sending can never be hijacked.
- Placeholder + helper line advertise the affordance ("type @ to assign an agent").

## How to verify (on the next publish)

1. Open Ask. Type `@` and the agent picker appears with your enabled specialists. Arrow + Enter (or click) inserts `@strategist `.
2. Finish the message (`@strategist draft a one-page PRD for smart off-hours routing`) and send. The reply reads "On it. I've dispatched …", with an inline mission card.
3. Open the mission: it has one step led by the Strategist, dispatches on the next `resume-runs` tick, runs, and completes (status flips off `running`), capturing a decision.
4. Type a bare `@strategist` with no task and send: it answers as regular chat, not a mission.
5. Type `@nope do something` (no such agent): regular chat, the `@nope` is just text.

## Related

- [`f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md), the orchestrated-mission path this reuses.
- [`brain.md`](./brain.md), the Ask surface.
- `src/lib/ai/mission-advance.server.ts` (`advanceMissionCore`, `maybeCompleteMission` in `handoff.server.ts`), the deterministic lifecycle.
- [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) §3, the strategic rank and build queue.
