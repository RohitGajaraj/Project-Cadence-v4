# v9 - The Decision Wedge and the Build-Next Plan (decision lens + sharpened wedge + audit + what to build next)

**Date: 2026-06-17. Status: CURRENT decision-lens + build-next canon.** This doc sits on top of v7 (positioning + market) and v8 (structure + build-order). It does not replace them. It adds four things they do not yet state plainly: (1) the first-principles reason the "Cursor for PM" category is real but the obvious product is a trap, (2) a sharper single launch wedge, (3) a clean competitor posture map (integrate / absorb / race / ignore), and (4) an honest audit of the current build with a concrete "what I would build next" plan grounded in the live feature dashboard.

> Born from a founder brainstorm (2026-06-16/17): a holistic read of Andrew Miklas's "Cursor for Product Managers" essay, played through the lenses of operator, PM-customer, investor, and marketer, then reconciled against what Cadence has actually shipped. Where positioning and v9 disagree, v7 wins. Where structure / surface / build-order and v9 disagree, v8 wins. v9 governs the launch wedge, the competitor posture, and the build-next priority call.

---

## 0. What v9 adds, and what it explicitly does not change

| Stays the canon | Where | v9's relationship to it |
| --- | --- | --- |
| Positioning, market, pricing, GTM, investor narrative | [`v7`](./v7-agentic-product-os-2026-06-14.md) | v9 strengthens v7's "memory is the moat" from first principles; does not alter the position. |
| Surface map, the Engine Room door, the hybrid Build spine, 4-phase sequencing | [`v8`](./v8-calm-front-deep-engine-2026-06-16.md) | v9 confirms v8 Fork 1 (hybrid Build) and explains the end-to-end workflow it implies; does not re-map surfaces. |
| Engine / 19-agent mesh / handoff contract / HITL gates | [`v4`](./v4-feature-map-2026-06-11.md) | unchanged. |
| Live build status (the audit baseline) | [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) | v9's audit reads from it (reconciled with file evidence 2026-06-16); v9 adds the strategic read, not new status. |

**v9 is additive. It is the conceptual foundation + the launch wedge + the competitor posture + the build-next call.** Nothing here contradicts v7 or v8; where it sharpens them, it says so.

---

## 1. The conceptual foundation: why "Cursor for PM" is the right category and the wrong product

The Miklas essay is a good category-naming essay and a naive product essay. It is directionally right: once "how to build" is cheap, "what to build" becomes the bottleneck. That is just conservation of bottleneck. But it describes the product as a **synthesis pipeline** (upload interviews and usage data, get a feature outline plus UI / data-model / workflow changes plus tasks for a coding agent). That is the seductive demo. It is not the business. The gap between the two is where most entrants will die, and the reason is one structural asymmetry:

> **Code has a fast oracle. "What to build" does not.**

Cursor works because code is verifiable in seconds: it compiles or it does not, tests pass or they do not, you read the diff and reject it in two clicks, and a wrong edit costs nothing. That tight, cheap, ground-truth loop is *why* AI coding exploded. "What to build" has no such oracle. Feedback on a product decision arrives in weeks to quarters, it is confounded by ten other variables, and a wrong call costs a team a quarter and a PM their credibility.

Everything strategic follows from that one fact:

1. **You cannot sell autopilot.** There is no cheap way to know the autopilot was wrong before the damage is done. This is exactly why v7's "ambient plus governed, not autonomous" correction is right, and it means the essay's autopilot framing actually over-claims relative to where Cadence has already landed.
2. **The only way to manufacture a feedback signal is to close the loop and remember the outcome:** decision, then what shipped, then what happened, then was the reasoning right. This is not a feature. It is the whole defensibility. So "memory is the moat" is not a positioning preference; it is the *only* thing that turns this category into a business instead of a wrapper. v9 grounds v7 correction #2 in this first principle.
3. **The product is a judgment amplifier with an audit trail, not a "Cursor for PM."** The PM's grunt work (triage, synthesis, drafting, status, task graphs) gets removed; the PM's judgment gets made faster and defensible. Sell the second thing. The first is only the on-ramp.

**What the essay under-weights, and Cadence must not:** ingestion is 80% of the unglamorous work ("upload your data" hides that real signal is sparse, scattered across 15 tools, and biased to loud customers), and accountability is the adoption gate (a wrong PR is auto-caught; a wrong roadmap bet is a career event, so the human must stay accountable, which is precisely the governed model). Both validate Cadence's existing emphasis and flag SENSE plus LEARN as the un-commoditizable ends of the loop.

---

## 2. The sharpened launch wedge: the Critic teardown

The most dangerous thing in the current plan is the tension between the README's maximalist vision ("your product org, running itself," six stations, 19-agent mesh) and v7's honest "70% of a v1, last mile unfinished." A horizontal everything-platform with no addictive single loop is the most common way ambitious agentic products die in this market. Cursor did not launch as "the IDE that runs your eng org." It launched as autocomplete that was just better: one tight loop a developer felt in 60 seconds.

So the only question that matters for launch: **what does a PM feel in the first 10 minutes that makes them never go back?**

**The answer v9 commits to: the Critic teardown.**

> **"Cadence will tell you why your pet feature is wrong, with receipts."** Point it at a feature you are already attached to. Watch it red-team your reasoning using evidence pulled from your own signals.

Why this wins as the wedge:
- It leads with **judgment**, not paperwork. Everyone else leads with PRD generation because paperwork demos well and judgment is hard. Paperwork is not differentiated and not shareable.
- It is **emotionally sticky and a little scary** (ego-death with evidence), which is exactly what makes it shareable. The shareable artifact for the viral loop (v7 §10, F-SHARE) should be the *Critic teardown*, not the PRD. "Watch an AI demolish my pet feature, then admit it was right" is a build-in-public post people actually share.
- It **does not require the full loop to work.** It needs signals in plus the Critic, both of which exist (DEC-02, F-DEC-CARD, runCritic). The rest of the loop is the expansion you grow into, not the thing a new user meets.

This refines v5 ("evidence-to-decision ritual") and v7 (general decide-ritual) to a single, demoable, first-run moment. It also sits cleanly under v8's two-heroes model: Today is where the Critic teardown lands ("your calls today"), Build is the ship-hero you grow into.

**Marketing implication:** do not try to create a category. "Agentic Product OS" is a strong internal north star and a terrible tagline (nobody searches for it). Enter an existing emotional category: *the AI that red-teams your roadmap*. Category creation is a tax a pre-PMF company cannot afford.

**Persona implication (sharpening v7 §5):** keep the dual-persona *destination* and the serial-with-overlap *motion*, but collapse the *narrative* to the individual PM (P2) until the single-player loop is addictive. "We are for everyone" is what pre-PMF companies say. The team tier is expansion, not a co-equal launch story.

---

## 3. The competitor posture map: integrate / absorb / race / ignore

In an agentic world where orchestration is commoditizing (MCP at ~97M installs, A2A, Agent Skills, MS Agent Framework), the buy / partner / build / ignore map *is* the strategy. The rule: **own the ends of the loop (SENSE, LEARN/memory), integrate the middle, absorb the thin wrappers, and only race the players chasing the same closed loop.**

| Posture | Players | Why |
| --- | --- | --- |
| **Integrate and orchestrate** (be Switzerland on top of them) | Linear, Jira, GitHub, Cursor / Devin / Factory, Figma, Notion docs | They own a workspace or an execution surface you cannot dislodge. Speak MCP / A2A both ways; let Cadence be the decision-and-memory brain that drives them. Fighting them for the surface is suicide; sitting above them is leverage. |
| **Absorb as a feature** (their whole product is one of your steps) | ChatPRD, generic AI-PRD tools, prompt-library PM GPTs | A PRD generator is one step in DEFINE. Their defensibility is distribution, not the artifact. You out-feature them by connecting the PRD to the signal that justified it and the outcome that judged it, which they structurally cannot. |
| **Race on the moat** (same ambition; you must out-data them) | Productboard (Spark), Atlassian Rovo, Dovetail / Enterpret, Notion AI agents | The real fight. They have the data and distribution you lack. Your only durable edge is the outcome-memory flywheel and being cross-tool-neutral. |
| **Ignore / let plug in** | Foundation labs shipping a horizontal "PM agent" | A lab's PM agent is a model you route to, not a competitor, *iff* your value lives in proprietary outcome data plus governance plus PM-domain depth. The model-agnostic chokepoint already encodes this. |

**The strategic punchline (sharpening v7 §14):** the existential threat is not the labs. It is that **Linear / Notion / Productboard / Atlassian already own the workspace, the data, and the distribution, and "discovery to spec to tickets" is a natural feature extension for all of them.** Productboard Spark and Linear-for-Agents are the canary. Plan for the short end of v7's 6-to-18-month window. The only two defenses that survive a bundled-feature attack are (a) the outcome-memory data they cannot backfill, and (b) being the neutral brain across tools so you are more valuable than any one of them locked-in.

**The implication that changes sequencing:** the MCP server plus public API (Q1 / F-MCP-V1) is currently filed under M-D / "later." Being the neutral brain across tools is a *moat*, not a late feature. Pull a thin read-only MCP surface forward (see §6). This is the single biggest sequencing change v9 argues for.

---

## 4. The Build engine, reconciled: the hybrid spine and the end-to-end workflow

v8 Fork 1 already settled the Build question as a **hybrid spine**, and that is the right answer, more right than a binary "build it all" or "build none of it":

- **Cadence owns the common 80% path:** plan, file tree plus read plus search, multi-file diff review, per-hunk accept/reject, mid-run steering, CI read plus self-correct, review-gated in-platform merge, cost/model panel. This is built and Cursor-grade today (F-STUDIO, I1, I2, I3, J1, J2, K1 all done per the dashboard).
- **Cadence rents the heavy 20%:** delegate-out to external coding agents (Claude Code / Cursor / Devin) under the same governance and handoff contract (BLD-04, not yet built).
- **The correction to a naive "freeze ours and orchestrate" call:** do not freeze a working, differentiated 80% path; it is your loop-closing demo. Just **stop adding new heavy engineering to compete with Devin on the 20%.** The one justified new build (v8 Phase 3) is the sandbox plus live-preview environment, and that unblocks *your own* loop (tests + preview), it does not fight Cursor. The hybrid rule tells you exactly which 20% you never build, so you carry none of the "maintain two engines" overhead the founder rightly worried about.

### The end-to-end workflow (the founder's question: signal to code to back, seamless, zero-friction?)

Honest answer: **the spine from signal to shipped PR is largely built and seamless; the two gaps are capability gaps (delegate-out and outcome learning), not friction gaps.** The user touches the loop at exactly two governance gates, not a dozen juggling points.

```
  SIGNAL            DECIDE                 DEFINE            BUILD (hybrid spine)        LEARN
  ───────           ──────                 ──────            ───────────────────        ─────
  webhook/        Scout clusters →       approved opp →    dispatchStudioSession →     merged PR →
  connector  ──►   ICE re-score →    ──►  cited PRD    ──►  plan, branch-isolate,  ──►  outcome →
  (KI-10 ✅)       Critic red-team →       (H1 ✅) →         per-hunk diff, tests,       memory
                   Decision card on        Critic-on-spec    CI gate, gated merge,       rescore
                   Today (F-DEC-CARD ✅)    (DEF-03 ✅)        release notes               (W1 ✅,
                        │                        │           (I1/I2/I3/J1/J2/K1 ✅)        LRN-02 ⬜)
                   GATE 1: the human         (auto)         GATE 2: the human
                   makes the call                          approves the merge
                                                                │
                                            heavy 20% → delegate-out to Devin/Cursor (BLD-04 ⬜)
```

- **The seam from PRD to coding mission is already one approval** (`dispatchStudioSession`, with a `prd -> mission` lineage edge). That is the zero-friction handoff the founder asked about, and it exists.
- **Gap A (capability):** delegate-out to external agents for the heavy 20% (BLD-04). Until built, everything runs through the in-house engine, which is fine for the 80%. This is the rent-the-20% half of the hybrid.
- **Gap B (capability, and this is the moat):** the merged outcome rescoring memory is wired (W1), but real predicted-vs-actual outcome reviews (LRN-02) and cohort analytics (F-ANALYTICS) are not built. This is what actually *closes* the loop and makes memory compound. It is v8 Phase 4 and it is the highest-leverage unbuilt work.

So: zero-friction at the seams that exist; the work left is adding the two capabilities, not removing juggling.

---

## 5. The honest audit: what is good, what is not

Build-state sourced from the reconciled [feature dashboard](../planning/feature-dashboard.md) (file-evidence reconciled 2026-06-16). The strategic read is v9's.

**What is genuinely good (protect and lean on these):**
- **The autonomous engine is real and verified** (G0: 11/11 done). The loop advances unattended, memory threads and compounds (W1), governance is honest (executed-unattended audit, kill-switch, spend caps). This is better than most "agentic" vendors ship, and it is the substrate the moat needs.
- **The Build spine is Cursor-grade and complete** (G3: 8 done). Branch isolation, per-hunk curation, live cockpit, CI gate, release notes. This is the loop-closing demo. Protect it; do not over-invest further.
- **The decide-ritual exists** (Critic on opportunities DEC-02, decision card F-DEC-CARD, shareable link F-SHARE). The launch wedge (§2) is buildable from parts that already exist.
- **The structure doctrine is sound** (v8 calm-front, Engine Room door). The product was drifting into a control room; v8 corrects it.

**What is not good yet (the honest gaps, in priority order):**
1. **The loop does not yet close on real data.** SENSE is webhook-only in practice (F-CONN parked pending OAuth registration; only 1 live ingest path). LEARN's outcome reviews (LRN-02) and analytics (F-ANALYTICS) are unbuilt. The moat cannot compound until both ends are fed. **This is the single most important gap.**
2. **The wedge is not yet packaged.** The Critic teardown exists as parts, not as a first-run, 10-minute, shareable moment. No persona onboarding (W6), no PLG funnel (PLG).
3. **Interop is mis-sequenced.** MCP/API (Q1) is "later," but §3 argues it is a moat against the workspace incumbents and should be pulled forward.
4. **Monetization rails are built but dark** (M-C-PRICE needs Stripe secrets; M-C-EXPIRY dormant). Real, but not switched on.
5. **Over-investment risk in Build.** It is the most complete station; further heavy build there is misallocation. Freeze at clean-handoff plus the sandbox; redeploy energy to SENSE and LEARN.

**The one-line verdict:** the engine and the spine are real; the *ends* of the loop (real ingestion, real outcome learning) and the *packaging* (the wedge, onboarding, interop) are the unfinished, highest-leverage work. Per the market, the last mile is the moat; closing it is the work, not catch-up.

---

## 6. What I would build next, as the founder, from the current state

Sequenced by leverage, mapped to existing dashboard IDs and v8 phases. This is a priority call, not a new backlog. It assumes the v8 Phase 1 calm-front regroup is in flight.

**Tier 1 - close the loop on real data (this is the moat; nothing matters more).**
- **Land a second live ingest source** (SEN-01): register one connector OAuth client, or lean on the webhook plus a manual import, so SENSE has >=2 real sources. Unblocks "the loop closes on a partner's real data."
- **Build real outcome reviews** (LRN-02): predicted-vs-actual, Historian verdicts, feeding memory rescore. This is v8 Phase 4 and the literal moat object becoming visible. Pair with the existing N3 "referenced N prior decisions" view so the compounding is *seen*.

**Tier 2 - package the wedge (this is what gets a PM to stay).**
- **Ship the Critic-teardown first-run** (§2): a guided "point Cadence at a feature you believe in" flow that produces an evidence-backed teardown in the first session. Compose from DEC-02 + F-DEC-CARD; add the onboarding wrapper (W6) and make the teardown the shareable artifact on F-SHARE.
- **Turn on the PLG funnel** (PLG): public onboarding to first-win to upgrade. Flip monetization live (M-C-PRICE secrets, M-C-EXPIRY) only once first-win is reliable.

**Tier 3 - defend the moat against the workspace incumbents (pull this forward from M-D).**
- **Ship a thin read-only MCP surface** (slice of Q1 / F-MCP-V1): expose read signals/opps/PRDs and append-decision over MCP. Being the neutral brain across tools is the defense against Linear/Notion/Productboard bundling the loop. A read-only slice is cheap and buys the position early.

**Tier 4 - complete the hybrid spine (only the justified new build).**
- **Sandbox + live preview** (v8 Phase 3): the one real new build engineering, unblocks in-platform tests and preview.
- **Delegate-out contract** (BLD-04): rent the heavy 20% to external coding agents under governance. Deliberately *after* Tiers 1 to 3, because the 80% path already ships code; this is breadth, not loop-closure.

**What I would explicitly NOT build next:** more in-house Build horsepower beyond the sandbox; the full 19-agent mesh; team/RBAC features (G6 beyond the MCP slice); outcome-based pricing machinery (ship simple seat/usage first, treat outcome pricing as a later experiment, not a launch pillar, since the "outcome unit" is unsolved per v7 §14).

---

## 7. Open forks still owed (founder calls)

- **Critic as a routable agent vs. inline** (v7/v8 open): the wedge raises the Critic's importance; deciding this affects whether the teardown is a first-class loop step (DEC-02-LOOP).
- **How far to pull MCP forward:** read-only slice now (v9 recommends) vs. wait for M-D.
- **Outcome-pricing unit:** still TBD (v7 §14); v9 recommends deferring it out of the launch story entirely.
- **Naming reconciliation:** product is **Cadence** (the 2026-06-10 rebrand was reverted 2026-06-16). The full repo was swept back to Cadence on 2026-06-17, so the retired name is removed everywhere (only the unrelated engineering terms remain); no naming pass is outstanding.

---

## 8. Relationship to canon and the cascade

- **Positioning + market:** [`v7`](./v7-agentic-product-os-2026-06-14.md) wins.
- **Structure + surfaces + build-order:** [`v8`](./v8-calm-front-deep-engine-2026-06-16.md) wins.
- **Launch wedge + competitor posture + build-next priority:** v9 (this doc).
- **Engine / mesh / contract:** [`v4`](./v4-feature-map-2026-06-11.md).
- **Live status (audit baseline):** [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md).

Cascade applied this session: strategy [`README.md`](./README.md) index, the session-decisions log, and the [`CLAUDE.md`](../../CLAUDE.md) read-order pointer. The README/v7 naming pass and any backlog re-priority from §6 are noted as follow-ups, not silently applied.
