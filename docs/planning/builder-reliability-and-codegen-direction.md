# Builder reliability + the codegen direction — proposal (pick up later)

> _Created: 2026-06-26 · Status: PROPOSAL, not started. Author: Lane 3. Decision owner: founder._
> _Raised when the live Build agent failed end-to-end and the founder asked whether to harden the in-house Builder, given the broader intent to "deal with codes and tools."_

## TL;DR / recommendation

There are two layers here, and they should be weighted very differently:

1. **Tactical (small, optional):** harden the in-house Builder so a *cheap* model can't silently produce an unusable build. Worth doing **only** if the in-house Builder must demo reliably in the very near term. ~half a day, but touches the pinned AI chokepoint (attended change).
2. **Strategic (the real call):** **do not over-invest in our own codegen agent.** The durable direction — already named in the canon (`ORCH-DELEGATE`, `BLD-04`, the sourcing map) — is **"build = orchestration of external coding agents, not codegen."** Delegate the actual code-writing to capable external agents (Claude Code, OpenHands, Cursor, etc.) and keep Cadence as the **governing + decision/memory layer on top.** That sidesteps the cheap-model-capability problem entirely and is where the moat is.

**My recommendation:** treat the in-house Builder as a **$0 floor for trivial single-file changes only.** Put real investment into the **delegation path (`BLD-04` / `ORCH-DELEGATE`)**, which is both the reliable answer for "codes and tools" and the on-moat one. Only do the tactical hardening if you need a believable in-house-Builder demo before the delegation path is ready.

---

## The problem (live evidence, 2026-06-26)

A real Build run on the published app sat at "QUEUED · starting up" forever. Root cause was infra (the `resume-runs` cron was unscheduled — now fixed). But once the engine ran, a deeper issue surfaced: on the free **Gemini 3 Flash**, the agent's `studio.stage` call came through as `{op:"create", path:"index.html"}` with **no file content**. `studio.stage` requires the full contents per path, so it would error on execution. The build can run but can't produce a file.

This is a **model-capability ceiling**, not a bug: a cheap model on an agentic file-building task doesn't reliably emit large tool arguments. It is structural — it will recur on any weak model, and building a from-scratch codegen agent that's reliable on strong models is a large, ongoing investment that is **not our moat** (the moat is the decision / memory / trust layer).

---

## Layer 1 — Tactical hardening (if we keep an in-house Builder)

Make weak models self-correct instead of failing silently. Two small changes, both in **chokepoint-pinned files** (`src/lib/ai/tools/registry.server.ts`, `src/lib/ai/loop.server.ts`), so this is an **attended core change**, not an autonomous-lane edit:

1. **Make `content` required-for-create at the schema layer.** Today `studio.stage`'s `content` is `z.string().optional()`, validated as present only at `run()` time (which throws *after* the call is gated/approved). Refine the schema so `op: "create" | "update"` requires `content` — then the agent gets an **immediate validation error** and the loop's existing error-feedback path makes it retry *with* content, in-loop, before any gate.
2. **A one-line prompt nudge** in the Builder system prompt: "When you call `studio.stage`, always include the FULL file contents in `content` for every create/update — never a path alone."

Net: a cheap model gets one corrective round-trip and usually succeeds, at ~one extra cheap call. Low effort, removes the silent dead-end. **But it only makes the in-house Builder marginally more reliable — it does not make it a strong code generator.**

---

## Layer 2 — The strategic direction (recommended investment)

The canon already says this is the answer; the live failure just makes it concrete.

- **`ORCH-DELEGATE` (#15 in the dashboard):** "build = orchestration of external coding agents, not codegen."
- **`BLD-04`:** a dormant `DelegateProvider` seam + OpenHands adapter already exists (`src/lib/delegate/**`), governed (evidence-id gate, `HIGH_RISK_FORCE_REVIEW`, blast-radius cap). It just needs the result-callback increment + a founder endpoint/key.
- **Sourcing map / BBI doctrine:** codegen is a commodity racing to capability; we **INTEGRATE** capable agents behind our own seam, we don't **BUILD** a codegen competitor.

**Why this is the right call for "codes and tools":**
- **Reliability for free.** External coding agents (Claude Code, OpenHands, Cursor) are already strong at exactly the task our in-house loop is weak at, and they improve without our effort. We stop fighting model capability.
- **It's on-moat.** Cadence's defensibility is the **governance + decision/memory** layer. "We govern and orchestrate the best coding agents, with full decision lineage and trust receipts" is a moat; "we wrote our own mediocre codegen agent" is not.
- **It matches the BYO / tools posture.** Users plug in the coding agent they trust; Cadence is the control plane (specs in, governed PRs out, outcomes fed back to the brain).

**The tradeoff to weigh:** delegation adds an external dependency + integration surface (auth, callbacks, cost attribution per the procurement inventory) and means the "build" isn't fully inside our walls. The in-house Builder keeps a $0, fully-owned floor for trivial changes. So the likely end-state is **both:** in-house Builder as the trivial-change floor; external delegation as the real engine — with Cadence governing both identically.

---

## Suggested sequencing (for whoever picks this up)

1. **Decide the posture** (founder): in-house Builder as floor + delegation as the real engine — yes/no. This proposal recommends yes.
2. If a near-term in-house-Builder demo is needed: do **Layer 1** (attended chokepoint change, ~half a day).
3. The real work: finish **`BLD-04`** (result-callback + job persistence) and wire **`ORCH-DELEGATE`** to a live external agent, governed end-to-end. Cost/vendor choices belong in [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md).
4. Keep the model-choice lever visible: for any in-house agentic step, default to a model strong enough to emit complete tool calls, or accept the Layer-1 self-correction tax.

## Cross-links

- Direction canon: [`../strategy/v11-guiding-star.md`](../strategy/v11-guiding-star.md), [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md) (BUILD/BUY/INTEGRATE), `ORCH-DELEGATE` + `BLD-04` rows in [`feature-dashboard.md`](./feature-dashboard.md).
- The live diagnosis + the infra fixes from the same session: [`../strategy/session-decisions.md`](../strategy/session-decisions.md) (2026-06-26 entries).
- Spend/vendor implications of delegation: [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md).
