# v8 — Calm Front, Deep Engine (structure & build canon)

**Date: 2026-06-16. Status: CURRENT structure / IA / build-order canon.** This doc operationalizes v7's positioning ("simple front, powerful engine") into a concrete surface map, the hybrid build spine, and the forward sequencing. [`v7-agentic-product-os-2026-06-14.md`](./v7-agentic-product-os-2026-06-14.md) remains the positioning + market canon; v8 governs HOW the product is structured and built. Where a surface/structure decision and v8 disagree, v8 wins; where positioning and v8 disagree, v7 wins.

> Born from a founder reflection (2026-06-16): the product had drifted into a heavy, technical control room, quietly violating its own first law ("complexity in the engine, not the experience"). v8 re-anchors on one doctrine and two settled forks, and lays out the path back to a calm front over a powerful engine.

---

## 0. The law and the two forks (all founder rulings, 2026-06-16)

- **Law #1 — the Engine-Room Doctrine** ([`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md)): calm front, deep engine. Complexity lives in the engine, never in the experience; all machinery lives behind one "Engine Room" door, revealed on demand; user-facing labels name the outcome, not the mechanism. This outranks every surface decision below.
- **Fork 1 — the Build engine is a HYBRID spine.** Cadence owns a real, Cursor-feeling build engine for the common 80% path (plan, diff, steer, tests, preview, CI gate, ship) and rents external coding agents (Claude Code / Cursor / Devin) for the heavy 20%. We are not rebuilding an IDE; we are the OS with a build spine. Memory stays the moat.
- **Fork 2 — two heroes, one loop.** We SELL on the decide-ritual (Today) and BUILD toward the ship-engine (Build). Same loop, two high-value moments. Center of gravity = decide -> ship; memory compounds under both.

---

## 1. Cadence on one page

**One sentence:** Cadence is where a PM decides what is worth doing and watches it get built and shipped: a calm front over a powerful engine, where every decision and outcome compounds into memory the team can trust.

```
┌─────────────────────  CALM FRONT  (what the user touches)  ──────────────────────┐
│                                                                                   │
│   TODAY ───────────────────────── loop ───────────────────────────► BUILD        │
│   hero: DECIDE                                                       hero: SHIP   │
│   "your calls today,            ASK · PRODUCT · MEMORY              "what's       │
│    what changed"                (research) (the work) (what we       shipping" —  │
│                                              learned)               feels like    │
│        ▲                                                             Cursor       │
│        └───────────────── memory compounds under everything ───────────┘         │
│                                                                                   │
├───────────────────────────  ONE DOOR  ►  ENGINE ROOM  ────────────────────────────┤
│         (reveal on demand — the 95% never open it; the operator/auditor can)      │
├─────────────────────  DEEP ENGINE  (the machinery, hidden by default)  ──────────┤
│   19-agent mesh · orchestrator · handoff contract · traces · evals · prompts ·    │
│   budgets · guardrails · CI · branch isolation · the autonomy dial · BYO connectors│
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The calm front (the only top-level surfaces)

| Surface | What it is to the user | Loop role |
| --- | --- | --- |
| **Today** (hero: decide) | The calls that need your judgment this morning, and what changed while you were away | decide |
| **Build** (hero: ship) | What is shipping right now: live builds, diffs, ship. Feels like Cursor | build / ship |
| **Ask** | Ask anything; web-grounded research + workspace answers | sense / cross-cut |
| **Product** | The work: signals -> opportunities -> specs -> releases | sense / decide / define / launch |
| **Memory** | What we have learned and what we remember (outcome-named; no "lineage" jargon on the label) | learn |

Approvals are surfaced as "your calls" on Today plus a badge, not a separate technical surface. Connectors are one **Connect** button (OAuth, no key paste).

---

## 3. The one door — the Engine Room (recessed, not removed)

Everything technical collapses behind a single Engine Room door, renamed to outcomes. **Critical: nothing is deleted or locked away. Each item is fully visible and drillable on demand.** Default state is a calm one-line outcome on the front; one click into the Engine Room gives the full depth, fully interactive.

**Engine Room tab labels: before to after (applied 2026-06-16). The `?tab=<id>` ids are the routing contract and never change; only the display label changes.**

| Before (mechanism) | After (outcome) | id (unchanged) |
| --- | --- | --- |
| Guardrails | **Safety** | `guardrails` |
| Budgets | **Spend** | `budgets` |
| Evals | **Quality checks** | `evals` |
| Gauntlet | **Loop health** | `gauntlet` |
| Traces | **Activity** | `traces` |
| Drift | **Trends** | `drift` |
| Controls | Controls (kept, already clear) | `controls` |
| Approvals | Approvals (kept, user-facing action) | `approvals` |
| Prompts | Prompts (kept, operator-deep tool) | `prompts` |
| Analytics | Analytics (kept) | `analytics` |

Also applied in the same pass: the surface header **Govern -> Engine Room** (matching the Trust-row door); the sidebar spend bar + Trust-row label **Budgets -> Spend** (and the lingering "open budgets" hover fixed, plus its banned em dash); the Build surface **CI -> Checks** (stage chip + status + toast); the command palette and runtime cap messages updated to the new labels. Drill-in is unchanged: each tab still opens its full surface (the complete audit trail under Activity, full diffs under Changes, full token/cost under Spend, etc.) — recessed, not removed.

**Why the audit trail stays first-class:** trust and verification is the #1 reported PM pain with AI (Lenny's survey, 92%). For the enterprise persona (P1), a complete governed audit trail is a selling point, not clutter. We make it excellent; we just do not make it the default surface a first-time user trips over.

The two-state rule for every machine surface:

| State | Where | What the user sees |
| --- | --- | --- |
| Default (calm) | On the front | A one-line outcome, or nothing |
| On demand (deep) | One click into the Engine Room | The full thing, fully interactive, complete audit trail |

---

## 4. The spine — the hybrid Build engine

The Build engine is the most genuinely-built node today: it reads the bound repo, plans, stages multi-file diffs, isolates a `studio/<mission>` branch, opens a PR, reads CI, self-corrects, and merges behind a sticky human gate. An approved, cited PRD already flows straight into a coding mission (`dispatchStudioSession`).

- **What Cadence owns (the 80% path):** plan, file tree + read + search, multi-file diff review, per-hunk accept/reject, mid-run steering, CI read + self-correct, review-gated in-platform merge, cost/model panel.
- **What Cadence rents (the heavy 20%):** delegate-out to external coding agents (Claude Code / Cursor / Devin) under the same governance + handoff contract.
- **How the loop feeds it:** signals -> opportunities (ICE) -> Critic-checked PRD -> approval -> coding mission, with a `prd -> mission` lineage edge. Market and sales insights enter at signal intake (Phase 4).
- **The one real new engineering this commits us to:** sandboxed test execution + a live preview environment. The Cloudflare Worker runtime cannot host on-disk worktrees or run tests, so today CI is the only test runner and there is no live preview. A sandbox service (Cloudflare Sandbox SDK / E2B / Vercel Sandbox) closes this. This is scoped, not a rebuild.

---

## 5. The forward sequencing (what we build next)

Each phase: real data only (no mocks), every new surface carries its `Engine-Room:` line, claim the row on the [feature dashboard](../planning/feature-dashboard.md) before coding.

- **Phase 1 — The calm front + the one door (IA: mostly regroup + rename).** Collapse the technical top-level/Govern surfaces into ONE Engine Room surface with outcome-named tabs; rename front surfaces to outcomes; surface approvals as "your calls" on Today. Most of this exists already as the Govern/Engine Room cluster, so it is regrouping + renaming + a single door, not new engine work. Highest leverage, lowest risk, delivers the "it feels simple now" win immediately.
- **Phase 2 — The Build hero (finish the Cursor-grade feel).** Finish the in-flight I-series (per-hunk accept/reject I1, live build view I2), polish the diff / steer / CI / cost experience, make Build a true top-level hero. Mostly completion + polish. **Status (2026-06-16): largely complete.** Recon found Build already Cursor-grade (live cockpit, two-pane, conditional polling, merge gate); shipped a live "what's it doing now" caption + outcome-named polish (I2 ✅). True SSE streaming deferred as a nice-to-have.
- **Phase 3 — The spine horsepower (the one real new engineering).** Sandboxed test execution + live preview env via a sandbox service; the delegate-out contract to external coding agents for the heavy 20%.
- **Phase 4 — Close the loop (the moat compounds).** Wire merged-PR outcomes back into memory rescoring; feed market/sales insights into signal intake so the front of the loop is fed by more than internal signals. This is what makes the two-heroes loop actually compound.

---

## 6. The gate (from v7 §13, unchanged)

Structure serves the proof gauntlet, not dates: at least 10 PMs paying at least $150/mo; the loop closes once on a partner's real data; autonomy ticks up on a real account. Every phase above is judged by whether it moves these.

---

## 7. Relationship to existing canon

- **Positioning + market:** [`v7-agentic-product-os-2026-06-14.md`](./v7-agentic-product-os-2026-06-14.md) (wins on positioning).
- **Engine / agent mesh / handoff contract / HITL gates:** [`v4-feature-map-2026-06-11.md`](./v4-feature-map-2026-06-11.md).
- **Wedge UX:** [`v5-chief-of-staff-2026-06-11.md`](./v5-chief-of-staff-2026-06-11.md).
- **The law:** [`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md); surface placement: [`../conventions/home-and-today-ia.md`](../conventions/home-and-today-ia.md).
