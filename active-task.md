# Active task — Phase B: `F-OUTCOME-SURFACE`

> **Sequence context.** Operator approved A→C→B (see [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md) 2026-06-06 entry). Phase A verified substrate-complete (FND-RUNTIME 0.9 playbook operator-runnable, no code needed). Phase C shipped — all v3 audit recs graduated into F-IDs at [`docs/feature-backlog.md` § v3 Audit Triage](./docs/feature-backlog.md#v3-audit-triage-2026-06-06). **This file scopes Phase B.**

## Task ID

`F-OUTCOME-SURFACE` — ship `/outcome` (Releases · Launches · Support · Learnings) + the 5 missing right-half loop surfaces in shadow form. Maps 1:1 to Proof Platform v1.1 bundles 10 (Ship), 11 (Launch), 12 (Support→Learn) and satisfies REC-07 + LANG-NEW-OUTCOME.

## Sub-steps (any tool — claim via Live status board "Now building" before starting)

- [ ] **Read the contract.** Skim [`docs/feature-backlog.md` § Agentic Proof Platform (v1.1)](./docs/feature-backlog.md) "12 capability bundles" rows for bundles 10–12. Identify where bundles 1–9 live in code (likely `src/lib/proof/*` + a route under `src/routes/_authenticated.*`). Confirm what shape a "bundle" takes before adding three more.
- [ ] **Decide route shape.** Single `/outcome` route with internal tabs (Releases · Launches · Support · Learnings) is the audit's recommendation. Confirm by reading [`docs/strategy/v3-audit-language-2026-06-06.md`](./docs/strategy/v3-audit-language-2026-06-06.md) §9 P2 (LANG-NEW-OUTCOME) — "empty surfaces are fine if the loop is named."
- [ ] **Bundle 10 — Ship.** Proof artifact + UI for ship events (PR merged · deploy succeeded · release notes generated). Wire to existing trace/event source. No new agent logic.
- [ ] **Bundle 11 — Launch.** Proof artifact for launch/GTM moment (announcement drafted · channels posted · baseline metric captured). Approval-gated outbound; real send via MCP/connector — no mocks ([`AGENTS.md`](./AGENTS.md) §3 rule 10).
- [ ] **Bundle 12 — Support→Learn.** Proof artifact closing the loop: support signal → re-scored opportunity in Discovery. This is the loop-closer the v3 audit asked for.
- [ ] **Voice + chrome.** Follow [`docs/conventions/ui-voice.md`](./docs/conventions/ui-voice.md) (length budgets, AI-tell denylist, no em/en dashes) and [`docs/conventions/ui-chrome.md`](./docs/conventions/ui-chrome.md) (no `alert/confirm/prompt`; `useConfirm`/`usePrompt` only). Sentence-case H1; no `Bundle N` labels on the surface (`F-VOICE-VERSIONS` is P0, don't reintroduce).
- [ ] **AI-message contract.** Any AI message on the surface exposes score · model+via · latency · tokens · cost · citations · feedback · View Trace · Replay-with ([`design.md`](./design.md)).
- [ ] **Verify in preview.** Real data, no mocks. Walk each tab. Trace any AI call back to `runtime.server.ts`.
- [ ] **Close the doc loop** (same commit per [`docs/conventions/doc-closure-checklist.md`](./docs/conventions/doc-closure-checklist.md)):
  - Flip `F-OUTCOME-SURFACE` ◑ then ☑ in [`docs/feature-backlog.md` § v3 Audit Triage](./docs/feature-backlog.md#v3-audit-triage-2026-06-06).
  - Flip Proof Platform v1.1 bundles 10/11/12 to ✅ in the Live status board's Progress field.
  - Add a "How to use / verify" block to the backlog entry per the Core memory rule.
  - Append one line to [`plan.md`](./plan.md) §4 with WHY.
  - If the surface contract changed, update [`architecture/frontend.md`](./architecture/frontend.md).
  - Add a session-decisions entry only if a strategic call was made.
  - Delete this file (`active-task.md`).

## Gotchas

- **Don't bypass `runtime.server.ts`** — every AI call goes through the chokepoint ([`architecture/runtime.md`](./architecture/runtime.md)).
- **Don't add a new `Bundle 12` label to the operator UI** — that violates `F-VOICE-VERSIONS` (which is open P0). Internal bundle labels are docs-only.
- **Outbound sends are approval-gated.** Bundle 11 must queue an approval, not send directly.
- **Empty states are first-class** ([`docs/conventions/ui-voice.md`](./docs/conventions/ui-voice.md)) — design them, don't fall back to "Nothing here yet."

## Done criteria

- `/outcome` reachable from the sidebar with four tabs.
- Each tab renders real data from the existing event/trace source (no mock data).
- One end-to-end demo walk works: ship event appears in Releases → triggers a Launch proof → support signal appears in Support → Learn re-scores the linked opportunity in `/discovery`.
- Doc loop closed per checklist above.
- `active-task.md` deleted.

## Parallel-pickable (other tools)

While Phase B is in flight, any of these P0 triage F-IDs are independent and safe to claim:
`F-VOICE-LOGIN` · `F-VOICE-AINATIVE` · `F-VOICE-VERSIONS` · `F-VOICE-EMPTY-TODAY` · `F-VOICE-CASE` · `F-GOV-APPROVAL-COPY` · `F-TODAY-AUTOSEED` · `F-AGENTS-ROSTER-CUT`. Each is a few-string edit or a small data change. See [`docs/feature-backlog.md` § v3 Audit Triage](./docs/feature-backlog.md#v3-audit-triage-2026-06-06).