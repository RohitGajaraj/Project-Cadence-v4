# Plan — Extend v3 Audit with Language, Naming & Microcopy Layer

Add a dedicated copy/IA-language workstream on top of the in-flight v3 product audit. No code changes in this pass — audit + recommendations only, landed as a committed doc plus an in-chat summary, same delivery contract as the parent audit.

## 1. Scope of the language audit

Cover every surface where words shape the product:

- **Naming** — product name (Cadence), module names (Discovery, Strategist, Builder, Growth, Analyst, Orchestrator, Swarm, Missions, Traces, Evals, Guardrails, Drift, Memory, Lineage, Governance, Build, etc.), route names in the URL bar, sidebar labels in `AppShell`, page H1s.
- **Navigation & IA copy** — sidebar groupings, section headers, breadcrumbs, empty-state titles.
- **Microcopy** — buttons, CTAs, form labels, placeholders, helper text, validation errors, toast messages, confirm dialogs, approval-gate prompts.
- **Tooltips & info popovers** — every `Tooltip`, `HoverCard`, `?` icon, "What is this?" affordance across the 31 authenticated routes.
- **Agent / AI surface language** — agent names, role descriptions, status verbs (Observing/Proving/Trusted/Ambient), trace step labels, tool-call labels, model+via chips, score labels, "Replay-with" / "View Trace" affordances.
- **Governance language** — approval gate copy, autonomy dial labels, risk/severity wording, "block / warn / allow" guardrail verbs, drift watcher copy.
- **Onboarding & empty states** — first-run, zero-data, loading, error, not-found, permission-denied screens.
- **Marketing / public surfaces** — `/p/*` public pages, landing hero, meta titles + descriptions, OG copy.
- **System voice** — does the product talk like an operator, a copilot, a dashboard, or an OS? Is it consistent?

## 2. Evaluation lenses

Each surface graded against:

1. **Clarity** — would a new Solo PM / Founder / Technical Founder understand it in 3 seconds?
2. **Verbosity** — is it the shortest version that still teaches?
3. **Consistency** — same concept, same word, every screen (no Mission/Run/Trajectory/Trace drift).
4. **Voice** — agent-native, operator-grade, governance-aware — not generic SaaS, not copilot-cute, not enterprise-stiff.
5. **Naming integrity** — does the name describe what the thing *does* for the persona, or is it internal jargon leaking?
6. **Information scent** — does the label predict what's behind the click?
7. **Tooltip discipline** — tooltip exists only where the label can't carry the meaning; never restates the label.
8. **Accessibility** — sentence case, no ALL CAPS shouting, screen-reader-friendly, no icon-only controls without `aria-label`.
9. **i18n-readiness** — no concatenated strings, no English idioms baked into UI logic.

## 3. Method (evidence walk)

- Walk all 31 authenticated routes + `AppShell` + public `/p/*` + auth screens in the live preview as a first-time operator, capturing every label, tooltip, empty state, toast, and error.
- Cross-read against `design.md` (voice/tone if any), `docs/strategy/` latest positioning (persona language + USP wording), `README.md` (thesis vocabulary), and `docs/feature-backlog.md` (feature names).
- Diff in-product names against doc names — flag every place the UI says one thing and docs say another (e.g. Mission vs Run vs Trajectory, Trace vs Lineage, Agent vs Specialist, Swarm vs Roster).
- Sample every distinct tooltip in the app; cluster as Keep / Rewrite / Delete / Add-missing.
- Pull the existing AI message UI contract from `design.md` and grade actual implementation copy against it.

## 4. Deliverables

### Committed doc
`docs/strategy/v3-audit-language-2026-06-06.md` — companion to the main v3 audit. Sections:

1. Executive summary (5 sharpest copy/naming findings).
2. Naming integrity matrix — every module/route/agent/concept × current name × what users think it means × proposed name × rationale × blast radius.
3. Sidebar & IA rename proposal — current 31-route labels → target ~8–12 surface labels, with old→new mapping.
4. Tooltip audit — Keep / Rewrite / Delete / Missing, per route, with proposed rewrites.
5. Microcopy rewrites — buttons, empty states, approval gates, toasts, errors — current vs proposed, side-by-side.
6. Voice & tone guide — one-page house style: persona, reading level, sentence case rules, banned words (e.g. "leverage", "seamless", "unlock"), preferred verbs for agent actions, governance vocabulary, AI message chip copy spec.
7. Agent/AI surface language spec — canonical names for agent states, trace steps, tool calls, trust arc, autonomy dial.
8. Marketing/public copy pass — landing, meta, OG.
9. Prioritized rewrite roadmap — P0 (rename + IA), P1 (tooltips + empty states), P2 (microcopy polish), P3 (voice guide enforcement).
10. Open questions for the founder (≤5).

### Updates to the main v3 audit
Cross-link section in `docs/strategy/v3-audit-2026-06-06.md` pointing at the language companion; merge naming findings into the Top-10 critical findings if any rise to that bar.

### In-chat executive summary
~1 page: 5 sharpest language findings, top-10 renames with one-line rationale each, the proposed voice in 3 sentences, and the single biggest naming risk to the thesis.

### Closed doc loop
Same turn as delivery: update `docs/feature-backlog.md` Live status board (Last updated + Recent log), append a one-liner to `plan.md` §4, and add a `session-decisions.md` entry if any rename is recommended as binding.

## 5. Out of scope (this pass)

- Actual code/string changes — audit only; rewrites graduate into backlog F-IDs only if the user approves.
- Localization implementation.
- Renaming the product itself beyond flagging if "Cadence" tests poorly against personas (already partially covered in `docs/naming.md`).

## 6. Decisions needed from you before I start

1. **Binding vs advisory** — should the rename proposals be treated as binding (auto-graduated into backlog F-IDs ready to implement) or advisory (you triage)?
2. **Voice anchor** — do you want me to pick the voice from first principles (operator-grade, agent-native, terse) or benchmark against a specific reference (Linear's terse-precise, Vercel's confident-minimal, Stripe's warm-technical, Paxel's machine-mode-explicit)?
3. **Tooltip philosophy** — aggressive ("tooltip only when label fails, delete the rest") or generous ("every governance control gets a tooltip explaining the risk")?

Default if you stay silent: advisory, operator-grade voice from first principles, aggressive tooltip philosophy.
