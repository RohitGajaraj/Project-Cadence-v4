> [!WARNING]
> **ARCHIVED — historical reference only.** Superseded by the current canon: positioning → [`../v6-agentic-product-os-2026-06-13.md`](../v6-agentic-product-os-2026-06-13.md); engine / expansion map → [`../v4-feature-map-2026-06-11.md`](../v4-feature-map-2026-06-11.md). Inline links below predate the 2026-06-13 docs reorganization and may point to pre-reorg paths. Strategy index: [`../README.md`](../README.md).

# Language, Naming & Microcopy Audit v3 — 2026-06-06

> **Companion to** [`v3-audit-2026-06-06.md`](./v3-audit-2026-06-06.md). The main audit graded the _what_; this one grades the _words_. Same operator-walk method, same evidence base (all 31 authenticated routes + auth + public surfaces), same delivery contract: audit only, no code changes, recommendations graduate to backlog F-IDs on operator sign-off.
>
> **Why this exists.** A product whose own login tagline contradicts its strategy ("AI-native" on `/login` vs. "autonomous" everywhere else), whose sidebar mixes user verbs ("Today") with internal nouns ("AI Ops"), and whose flagship feature is called _"BUILD · BUNDLE 9"_ in front of operators is not failing on capability — it's failing on language discipline. The substrate is ahead of the surface; the surface is ahead of the words.
>
> **Scope.** Naming · sidebar/IA copy · page H1s · empty states · buttons & CTAs · placeholders & labels · tooltips · approval-gate prompts · agent/AI surface vocabulary · governance verbs · marketing/public copy · system voice.
>
> **Out of scope (this pass).** Implementation, i18n, renaming the product itself (see [`../naming.md`](../naming.md)).

---

## 0. Executive summary (the one page)

**Five sharpest findings:**

1. **The login lies to the new user.** `Welcome to Cadence · The AI-native product operating system` (`src/routes/login.tsx:68–69`) directly contradicts the v2 + v3 line ("autonomous product OS" / "product-org cockpit"). The single most-seen surface in the product has not been updated. **The closed-doc loop is broken at the most expensive seam.**
2. **The sidebar speaks two languages at once.** Workspace rail uses user-time nouns (Today · Briefing · Approvals · Calendar · Meetings · AI Chat). Group rails switch to industry jargon (AI Ops · Govern) and developer nouns (Build Console · Sync Inbox · Eval Harness · Swarm HUD · Prompt Studio). The PM lands in a product they cannot read with one mental model. **Cost: every new user navigates by hovering.**
3. **"BUNDLE 9" and "Phase 2 · Reasoning engine" are internal version labels leaking onto the operator surface.** `/build`, `/discovery`, `/opportunities`, `/prds` all show "Phase N" / "Bundle N" mono-labels. These are _commit topology_, not _product structure_. A user has no map of "phases" and never will. **Delete on sight.**
4. **The naming of the work objects drifts.** The product simultaneously calls one concept _Mission_, _Run_, _Trajectory_, _Trace_, and _Steps_. Agents are _Agents_, _Specialists_, and a _Swarm_. Reviews are _Approvals_, _Inbox_, _Reactor activity_, and _Sync Inbox_. **The operator cannot form a stable mental model because the words won't hold still.**
5. **Tooltips do too much work because labels do too little.** The trust system has tooltips a paragraph long because `Trust 72 · Proving` doesn't carry the meaning, and `Autonomy dial` is a label that requires a tooltip just to define itself. **A label that needs a tooltip to be understood is a label that has failed.** The fix is rarely a better tooltip; it's a better label.

**The voice problem in one sentence:** Cadence speaks in three voices — _editorial serif_ on H1s, _enterprise SaaS_ in the nav, _engineer-debug_ in the tooltips — and no one is the operator the v2/v3 thesis says we serve.

**The single biggest naming risk:** if Cadence does not own the words _Mission · Trace · Approval · Trust · Brief_ before competitors do (Linear+Cursor, Notion+Custom Agents, Factory/Devin all have working vocabularies; Langfuse owns _Trace_), the product becomes a glossary instead of a system of record. **Pick five canonical nouns and forbid synonyms.**

**Top-10 immediate language fixes** (full at §9):

1. Rewrite `/login` headline + subhead to the v3 thesis (`LANG-01`).
2. Strip every "Phase N" / "Bundle N" mono-label from the operator surface (`LANG-02`).
3. Rename `AI Ops` → `Observe`, `Govern` → `Govern` keep, `Agents` → `Agents` keep — but rename items inside them (see §3) (`LANG-03`).
4. Pick one word per concept; ship a glossary; enforce it (`LANG-04`).
5. Replace `Build Console` → `Builder`, `Eval Harness` → `Evals`, `Swarm HUD` → `Swarm`, `Sync Inbox` → `Connectors inbox` or fold into `Integrations` (`LANG-05`).
6. Rewrite the Today empty state — no OS asks the operator to "hit refresh" (`LANG-06`).
7. Replace every `name?: "field"`/`window.prompt()` flow with proper dialogs + sentence-case labels (`LANG-07`, see `AppShell.tsx:195`).
8. Sentence-case every UI string; kill `uppercase tracking-[0.16em]` mono-labels everywhere except true taxonomy chips (`LANG-08`).
9. Approval-gate prompts must say _what will happen if I approve_ and _what gets rolled back if I reject_ (`LANG-09`).
10. Publish a one-page voice guide and link it from `design.md` (`LANG-10`).

---

## 1. Voice & tone — the one-page house style

**Persona.** A senior product operator who already runs a swarm. Reads at speed. Doesn't need to be sold. Wants the product to _report_ and _ask_ — not _celebrate_, not _explain itself_, not _whisper marketing copy in serif_.

**Reading level.** Grade 8. Sentence case. ≤14 words per UI string. No semicolons in microcopy.

**The three voices we use (and the one we don't):**

| Voice                          | Where it lives                                          | Example                                                           |
| ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------- |
| **Operator-grade** (default)   | Buttons, labels, empty states, toasts, confirms         | `Approve · Discovery will draft a PRD from this opportunity.`     |
| **Reporter** (for telemetry)   | Traces, evals, drift, budgets, swarm                    | `8 missions in flight · 2 awaiting you.`                          |
| **Coach** (for first-run only) | Today empty state, onboarding tour, briefing zero-state | `Tell Cadence what you ship. The brief writes itself from there.` |
| ❌ **Hype** (banned)           | nowhere                                                 | not: `Unlock seamless AI-native workflows.`                       |

**Banned words.** `unlock`, `seamless`, `leverage`, `empower`, `revolutionize`, `magic`, `wow`, `delightful`, `humming`, `crushing it`, `let's go`, `AI-powered`, `next-gen`, exclamation marks in non-celebratory contexts.

**Banned constructions.** No emoji in functional copy. No ALL CAPS shouting (mono-labels count). No "🎉" toasts. No tagline subheadings under page H1s (`Upcoming meetings`, `All tasks`, `The brief every agent reads` — these are all editorial flourish that costs density).

**Verbs we prefer for agent actions** (one verb per state, hold the line):

- **plan** (not draft/spec/decompose) — orchestrator only
- **draft** (not generate/produce) — content artifacts
- **dispatch** (not run/launch/kick-off) — specialist hand-offs
- **review** (not check/inspect/audit) — operator gate, manual
- **approve / reject** (not accept/decline) — approval gates
- **promote** (not graduate/escalate) — opportunity→PRD, run→mission
- **resume** (not restart/continue) — sweeper picks up a paused run
- **finalize** (not complete/close) — terminal state on missions

**Sentence case everywhere.** Page H1s, section headers, nav items, buttons, chip labels. The only legitimate ALL CAPS in the product is a 2-letter taxonomy tag (e.g. `T72` for trust score), and even those should be reconsidered.

**AI-message chip copy spec** (formalizes `design.md`):

- Model+via: `gpt-5 · gateway` (lowercase via, no parens)
- Score: `Eval 0.84` (not `Score: 84%`)
- Latency: `1.2s` (no `ms` unless <1000)
- Tokens: `1.2k in · 340 out` (k-suffix, no commas)
- Cost: `$0.014` (always 3 decimals if <$1)
- Trace link: `View trace` (sentence case, not `View Trace`)
- Replay: `Replay with…` (with the trailing ellipsis to signal a chooser)

---

## 2. Naming integrity matrix

Each row is a concept the product uses. Drift = same concept named differently across screens. Verdict = what we should do.

| Concept                 | Current names (where)                                                                                                                            | What users think it means     | Proposed canonical                                                                                                                                                                                                                                                                                    | Why                                                                | Blast radius                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| The product             | `Cadence` (everywhere); `The AI-native product operating system` (`/login`); `Autonomous product OS` (docs); `Product-org cockpit` (v3 proposal) | conflicting                   | Pick one in v3 decision; **mirror it on `/login` the same hour**                                                                                                                                                                                                                                      | The most-seen surface defines the brand                            | tiny — one tagline edit                    |
| Agent work unit         | `Mission` (`/missions`); `Run` (`/traces`); `Trajectory` (chat); `Steps` (mission DAG); `Trace` (after-the-fact)                                 | confused                      | **Mission** = the goal · **Run** = one agent's attempt at a step · **Step** = node in the mission DAG · **Trace** = the post-hoc record of one run. Forbid `Trajectory`.                                                                                                                              | One word per concept; users learn it once                          | medium — chat + traces + missions + agents |
| Agent roster collective | `Agents` (sidebar); `Swarm` (`/swarm`); `Roster` (docs); `Specialists` (planner output)                                                          | "are these the same thing?"   | **Agents** = the page · **Swarm** = the live cockpit view · **Specialists** = ephemeral roles spawned by orchestrator (delete this word from operator UI; keep in dev docs)                                                                                                                           | "Swarm HUD" is a label; "Swarm" is a page                          | small                                      |
| Operator decisions      | `Approvals` (`/inbox`); `Inbox` (rail); `Reactor activity` (`/governance`); `Sync Inbox` (`/sync`); `Attention queue` (`/swarm`)                 | five different places to look | **Approvals** = the page (rename `/inbox` → `Approvals` in sidebar — it already is, but the route is `inbox`). Fold `Reactor activity` _into_ `/approvals` as a tab. Rename `Sync Inbox` → `Connectors` and move under `/integrations`. Kill `Attention queue` as a label — it's just "Awaiting you." | One place to look                                                  | medium                                     |
| Telemetry surface       | `AI Ops` (sidebar group); `AI Analytics`; `Traces`; `Drift`; `Eval Harness`                                                                      | "what's the difference?"      | Rename group to **Observe**. Items: `Analytics`, `Traces`, `Evals`, `Drift`. Drop `AI`, drop `Harness`.                                                                                                                                                                                               | "AI Ops" is industry jargon; "Observe" is a verb the operator does | small                                      |
| Builder surface         | `Build Console`                                                                                                                                  | "is this where I write code?" | **Builder** (matches the agent name `Builder`)                                                                                                                                                                                                                                                        | The page IS the Builder agent's lane                               | tiny                                       |
| Goal-input field        | `Mission goal`; `What needs to happen today?`; `Brief…`; `What should the Builder ship?`                                                         | inconsistent                  | Always: **"What should &lt;agent&gt; do?"** for direct dispatch. **"What's the mission?"** for orchestrated work.                                                                                                                                                                                     | Two patterns, not five                                             | small                                      |
| Trust                   | `Trust 72 · Proving`; `T72`; `Autonomy dial`; `Trust arc`; `Suggested arc`                                                                       | jargon                        | Keep `Trust 72`. Rename `Autonomy dial` → **Autonomy**. Rename `Trust arc` → **Stage** (Observing → Proving → Trusted → Ambient stays).                                                                                                                                                               | One short word per axis                                            | small (mostly `/agents`)                   |
| Approval modes          | `auto`; `confirm`; `review`                                                                                                                      | three flavors of "ask me"     | Keep, but render in UI as **Auto-run · Ask first · Review queue** with one-line tooltips. Never show the bare token.                                                                                                                                                                                  | The internal name leaks                                            | medium                                     |
| Phase/Bundle labels     | `Phase 2 · Reasoning engine`; `BUILD · BUNDLE 9`; `Deliver · Phase 2 · Specs`                                                                    | "what phase am I in??"        | **Delete from operator UI.** Keep in commits + docs.                                                                                                                                                                                                                                                  | Internal version labels are not navigation                         | medium (5+ routes)                         |
| Workspace pause         | `Kill switch`; `Pause`; `Halt`; `Workspace paused`                                                                                               | unclear what it pauses        | **Pause workspace** (verb on the button) → **Workspace paused** (state). Drop `kill switch` from UI; keep in `/governance` as the heading.                                                                                                                                                            | "Kill switch" is too violent for a daily-use control               | tiny                                       |

---

## 3. Sidebar & IA rename proposal

**Current (31 routes, 5 collapsible groups + workspace rail + settings):** see `src/components/cadence/AppShell.tsx:33–94`.

**Problems:**

- `Workspace` rail mixes time-windows (`Today`, `Briefing`) with inboxes (`Approvals`) with tools (`AI Chat`, `Calendar`, `Meetings`). Five different mental models.
- `Discover`/`Deliver` are lifecycle stages but `Agents`/`AI Ops`/`Govern` are _systems_. Mixed axes.
- `Build Console` is the only label with the word "Console" in the entire app.
- `Swarm HUD` is the only label with the word "HUD".
- `Eval Harness` is the only label with the word "Harness".
- `Sync Inbox` collides with `Approvals` (which is the inbox).
- `AI Chat` collides with the agent named _Chat_.

**Proposed target IA (12 surfaces, one mental model: lifecycle on top, systems below):**

```text
 ── Today              (was: Today)
 ── Brief              (was: Briefing)
 ── Approvals          (was: Inbox + Reactor activity + Sync confirms)
 ── Chat               (was: AI Chat)

 Lifecycle
 ── Discover           (was: Discovery + Opportunities — tabs inside)
 ── Define             (was: PRDs + Docs — tabs inside)
 ── Deliver            (was: Roadmap + Tasks + Builder — tabs inside)
 ── Outcome            (NEW — currently unrepresented)

 Systems
 ── Agents             (was: Agents + Missions + Swarm — tabs inside)
 ── Observe            (was: AI Ops group → Analytics + Traces + Evals + Drift — tabs)
 ── Govern             (was: Govern group → Guardrails + Budgets + Workspace pause — tabs)
 ── Connectors         (was: Integrations + Sync Inbox + Prompt Studio — tabs)

 Settings (footer)
```

**Old→new mapping (mechanical):**

| Old route                            | Old label     | New home      | New label                                         |
| ------------------------------------ | ------------- | ------------- | ------------------------------------------------- |
| `/`                                  | Today         | top rail      | Today                                             |
| `/briefing`                          | Briefing      | top rail      | Brief                                             |
| `/inbox`                             | Approvals     | top rail      | Approvals (tab: _From agents_)                    |
| `/governance` Reactor activity panel | —             | `/approvals`  | tab: _From events_                                |
| `/sync`                              | Sync Inbox    | `/approvals`  | tab: _From connectors_                            |
| `/chat`                              | AI Chat       | top rail      | Chat                                              |
| `/discovery`                         | Discovery     | `/discover`   | tab: _Signals_                                    |
| `/opportunities`                     | Opportunities | `/discover`   | tab: _Opportunities_                              |
| `/prds`                              | PRDs          | `/define`     | tab: _Specs_                                      |
| `/docs`                              | Docs          | `/define`     | tab: _Docs_                                       |
| `/roadmap`                           | Roadmap       | `/deliver`    | tab: _Roadmap_                                    |
| `/tasks`                             | Tasks         | `/deliver`    | tab: _Tasks_                                      |
| `/build`                             | Build Console | `/deliver`    | tab: _Builder_                                    |
| `/calendar`                          | Calendar      | `/deliver`    | tab: _Calendar_ OR keep at top rail               |
| `/meetings`                          | Meetings      | `/discover`   | tab: _Meetings_ (inputs)                          |
| `/agents`                            | Agents        | `/agents`     | tab: _Roster_                                     |
| `/missions`                          | Missions      | `/agents`     | tab: _Missions_                                   |
| `/swarm`                             | Swarm HUD     | `/agents`     | tab: _Live_ (default)                             |
| `/prompts`                           | Prompt Studio | `/connectors` | tab: _Prompts_                                    |
| `/analytics`                         | AI Analytics  | `/observe`    | tab: _Analytics_                                  |
| `/traces`                            | Traces        | `/observe`    | tab: _Traces_                                     |
| `/evals`                             | Eval Harness  | `/observe`    | tab: _Evals_                                      |
| `/drift`                             | Drift         | `/observe`    | tab: _Drift_                                      |
| `/guardrails`                        | Guardrails    | `/govern`     | tab: _Guardrails_                                 |
| `/budgets`                           | Budgets       | `/govern`     | tab: _Budgets_                                    |
| `/governance` rules                  | Governance    | `/govern`     | tab: _Rules & pause_                              |
| `/integrations`                      | Integrations  | `/connectors` | tab: _Integrations_ (default)                     |
| **NEW**                              | —             | `/outcome`    | tabs: _Releases · Launches · Support · Learnings_ |

**Dies on the operator surface (kept as URLs for back-compat redirects only):** `Build Console`, `Swarm HUD`, `Eval Harness`, `Sync Inbox`, `AI Ops`, `AI Chat`, `AI Analytics`, `Prompt Studio` (the word _Studio_ — keep as a tab named _Prompts_).

---

## 4. Tooltip audit

**Sampling method:** read every `Tooltip`, `title=`, `HoverCard`, `cursor-help` instance in `src/routes` + `src/components/cadence`. Cluster: Keep / Rewrite / Delete / Add-missing.

### 4.1 Delete (label carries the meaning — tooltip is restating it)

| Where                    | Tooltip text                                                                                     | Verdict                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `/build` PR link         | `title={run.pr.url}`                                                                             | DELETE — the URL is the link target                                                                        |
| `/discovery` row actions | `title="Promote to opportunity"` / `title="Lineage"` / `title="Delete"`                          | DELETE — replace icon-only buttons with **icon + label** at sm+ breakpoints; tooltip only at narrow widths |
| `/docs` toolbar          | `title="New nested page"`, `title="Delete"`, `title="Change icon"`, `title="Import from Notion"` | DELETE — same as above                                                                                     |
| `/governance` extend-TTL | `title="Extend TTL 24h"`                                                                         | DELETE — make it a labeled button `Extend 24h`                                                             |
| Sidebar collapsed state  | tooltip = label (auto)                                                                           | KEEP — this is the canonical use of a tooltip                                                              |

**Rule:** an icon-only control needs a label, not a tooltip. Tooltips are for _additional_ meaning, never the _primary_ meaning.

### 4.2 Rewrite (tooltip exists because the label fails)

| Where                                                     | Current label + tooltip                                                                    | Proposed label                                                    | Proposed tooltip                                                                                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/agents` "Start as mission"                              | label `Start as mission` + 30-word tooltip about `agent.handoff` and Missions hops         | `Run as a mission`                                                | `Lets this agent hand off to others. Each hop is recorded in Missions.`                                                                                                                                              |
| `/agents` trust chip empty                                | `Trust —` + "No trust data yet…"                                                           | `Trust —`                                                         | `New agent · score appears after the first mission, approval, or eval.`                                                                                                                                              |
| `/agents` `Autonomy dial`                                 | label `Autonomy dial` + multi-paragraph definition of trust-arc composition                | `Autonomy`                                                        | `How much this agent can do alone. Auto → Ask → Review.`                                                                                                                                                             |
| `/agents` arc buttons (Observing/Proving/Trusted/Ambient) | full paragraph each                                                                        | keep arc names                                                    | one-liner each: `Observing — every action asks first.` `Proving — low-risk runs auto, the rest ask.` `Trusted — most runs auto, irreversible ones ask.` `Ambient — runs without asking. Reserved for proven agents.` |
| `/build` claim button                                     | `title={c.is_mine ? "Force-release this claim" : "Only the owner can release this claim"}` | button label `Release` (when own) / `Release (locked)` (disabled) | `Releases the file so another mission can edit it.` only when own                                                                                                                                                    |
| `/governance` workspace pause                             | `Kill switch` heading                                                                      | `Workspace pause`                                                 | `Stops every agent and approval. Use when something is going wrong.`                                                                                                                                                 |

### 4.3 Add (missing where the operator would ask)

- **`/build` BUNDLE label** — currently no tooltip and no meaning. Replace label entirely (see §6).
- **`/discovery` "Phase 2 · Reasoning engine" mono-label** — replace, don't tooltip.
- **`/swarm` "the swarm is humming"** — replace empty state (see §5).
- **Approval-gate rows on `/inbox`** — every row needs a one-liner: _what will happen if I approve, what gets rolled back if I reject._ Currently the agent's rationale carries this, but the _action consequence_ is implicit.
- **`/budgets` "Daily USD cap"** — add `Resets at midnight UTC. Hard stop, not a warning.` Operators need to know if it's a soft or hard cap.
- **`/traces` step rows** — token/cost chips need `Cached calls still count.` to teach the chokepoint semantics.
- **`/evals` score column** — `0–1, higher is better. Set in the eval template.` Currently the scale is implicit.

### 4.4 Tooltip discipline rule (binding if adopted)

1. **Icon-only controls get labels, not tooltips.** Exception: sidebar collapsed state.
2. **Tooltips never repeat the label.** They add _consequence_ or _definition_.
3. **Max 14 words.** If you need more, the label is wrong or the control is wrong.
4. **No links inside tooltips.** A tooltip is read-only; links belong in the page.
5. **No code blocks in tooltips.** If you need to show a tool name (`agent.handoff`), the label is wrong.

---

## 5. Empty states, errors, and toasts

### 5.1 Empty states — current vs. proposed

| Where                     | Current                                                                      | Proposed                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/` Today (no brief)      | `No brief yet — hit refresh and Cadence will draft one from your workspace.` | `Cadence is drafting your brief…` (then auto-poll). **An OS does not ask you to refresh it.** |
| `/swarm` (nothing queued) | `Nothing waiting on you. The swarm is humming.`                              | `Nothing waiting on you.` (delete "humming")                                                  |
| `/missions` (no missions) | (varies)                                                                     | `No missions yet. Start one with a goal — Cadence plans the steps.`                           |
| `/briefing` H1            | `The brief every agent reads`                                                | `Your brief` (the meta-explanation is editorial flourish)                                     |
| `/calendar` H1            | `Upcoming meetings` with serif "meetings" gradient                           | `Calendar` (page name = H1; drop the gradient)                                                |
| `/tasks` H1               | `All tasks` with serif "tasks" gradient                                      | `Tasks`                                                                                       |
| `/inbox` H1               | `Approvals` ✅ keep                                                          |
| `/discovery` H1           | (long)                                                                       | `Discover` (matches new IA)                                                                   |

### 5.2 Errors — current voice is mixed

- **Operator-actionable**: `Couldn't load brief` ✅ (good — short, no blame)
- **Tech-leak example**: any "supabase" / "RLS" / "PostgREST" string in toasts. None spotted in routes, but `client.ts` errors can bubble. **Rule: never show internal infra names to the operator.**
- **Pattern to enforce:** `<What failed>. <What to do.>` — e.g. `Couldn't load brief. Retry in a moment or check connectors.`

### 5.3 Toasts

- `toast.success("Welcome back")` ✅ keep
- Many actions toast nothing — for irreversible writes (approve, reject, dispatch, release claim) we owe a toast: `Approved · Discovery will start drafting.`
- Never toast on every keystroke or save. Only state-change confirmations.

---

## 6. The five strings that hurt the most (verbatim rewrites)

| #   | Surface                         | Current                                                                      | Proposed                                                                                                                                    |
| --- | ------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/login` headline + subhead     | `Welcome to Cadence` / `The AI-native product operating system`              | `Welcome to Cadence` / `The product-org cockpit. Agents do the work. You set intent and approve the calls that matter.` (matches v3 thesis) |
| 2   | `/` empty brief                 | `No brief yet — hit refresh and Cadence will draft one from your workspace.` | `Cadence is drafting your brief…`                                                                                                           |
| 3   | `/swarm` empty                  | `Nothing waiting on you. The swarm is humming.`                              | `Nothing waiting on you.`                                                                                                                   |
| 4   | `/build` H1 + bundle label      | `Build Console` + `BUILD · BUNDLE 9` mono-label                              | `Builder` + (delete the bundle label)                                                                                                       |
| 5   | Sidebar `Mission mode` CTA card | `Mission mode` + agent count                                                 | `Run a mission` + `<n> agents ready`                                                                                                        |

---

## 7. Agent / AI surface vocabulary spec

Canonical terms — pick once, hold the line everywhere.

**Agent states** (live status pill):

- `Idle` (not `Standing by`, not `Resting`)
- `Running · step k/n` (not `Working`, not `Thinking`)
- `Paused` (not `Halted`)
- `Waiting on you` (not `Awaiting approval`, not `Blocked on operator`)
- `Done` (not `Completed`, not `Finished`)
- `Failed` (not `Errored`, not `Crashed`)

**Trust stages** (the arc — keep, they're good):

- `Observing` · `Proving` · `Trusted` · `Ambient` ✅ keep all four

**Approval modes** (operator-facing labels for the internal `auto|confirm|review`):

- `Auto-run` (was `auto`)
- `Ask first` (was `confirm`)
- `Review queue` (was `review`)

**Trace step labels** (in `/traces/$traceId`):

- `Thought` (model reasoning step) — keep
- `Tool call: <tool>` (not `Action: <tool>`)
- `Tool result` (not `Observation`)
- `Handoff → <agent>` (not `Transferred to`)
- `Approval requested` (not `Gate hit`)
- `Finalized` (not `Completed`)

**Model+via chip:** `gpt-5 · gateway` (already in `design.md`; enforce lowercase `via`).

**Score label:** `Eval 0.84` not `Score 84%`. Cost is `$0.014`.

---

## 8. Marketing / public surfaces

- `/login` + `/signup` — see §6 fix #1. The signup subhead should match.
- `__root.tsx` `<title>` — currently the route H1; **set page-specific titles** (`Today · Cadence`, `Approvals · Cadence`, `Trace abc1234 · Cadence`).
- **Meta descriptions** — there is no per-route `head()` description for the authenticated app (correct — they're behind auth). For `/p/$slug` and any future public pages, every page needs its own `<60-char title` and `<160-char description`. Currently the published preview shows the generic Cadence title.
- **OG image** — set per public route, not at root (per the TanStack head() rule in the stack guide).

---

## 9. Prioritized rewrite roadmap

Each row: `Impact × Effort × Horizon × Strategic × Benefit`. Effort is the rewrite + the rename + the redirect, not the underlying feature.

### P0 — Ship in week 1 (zero engineering risk, maximum first-impression lift)

| ID        | Change                                                                                                              | I × E × H × S × B                         |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `LANG-01` | Rewrite `/login` headline + subhead to v3 thesis                                                                    | 9 × 1 × Now × 9 × Brand truth             |
| `LANG-02` | Delete every `Phase N` / `Bundle N` mono-label from operator UI (`/build`, `/discovery`, `/opportunities`, `/prds`) | 8 × 1 × Now × 7 × Professionalism         |
| `LANG-06` | Rewrite Today empty state (drop "hit refresh") + Swarm empty state (drop "humming")                                 | 8 × 1 × Now × 6 × Reduces "what do I do?" |
| `LANG-08` | Sentence-case every page H1; drop the serif gradients on `Upcoming meetings` / `All tasks`                          | 6 × 2 × Now × 5 × Voice consistency       |

### P1 — Ship in weeks 2–3 (renames + tooltip cleanup)

| ID            | Change                                                                                                                                                                                                | I × E × H × S × B                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `LANG-05`     | Rename `Build Console`→`Builder`, `Eval Harness`→`Evals`, `Swarm HUD`→`Swarm`, `AI Ops`→`Observe`, `AI Chat`→`Chat`, `AI Analytics`→`Analytics`, `Prompt Studio`→`Prompts`, `Sync Inbox`→`Connectors` | 8 × 3 × Wk2 × 8 × IA legibility    |
| `LANG-07`     | Replace `window.prompt()` flows in `AppShell.tsx` (workspace + product creation) with proper dialogs + sentence-case labels                                                                           | 6 × 3 × Wk2 × 5 × Professionalism  |
| `LANG-09`     | Rewrite all approval-gate row copy to lead with consequence (`Approve · <what happens>`)                                                                                                              | 7 × 3 × Wk2 × 7 × Trust            |
| `TOOLTIP-DEL` | Apply §4.1 (delete restating tooltips) — about 15 sites                                                                                                                                               | 5 × 2 × Wk2 × 4 × Density          |
| `TOOLTIP-REW` | Apply §4.2 (rewrite to consequence-first) — about 8 sites, mostly `/agents`                                                                                                                           | 6 × 3 × Wk3 × 6 × Trust legibility |

### P2 — Ship in weeks 4–6 (IA restructure)

| ID                 | Change                                                                                                                  | I × E × H × S × B                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `LANG-IA-12`       | Apply §3 — collapse 31 routes → 12 surfaces with old→new redirects                                                      | 9 × 8 × Wk6 × 9 × Cognitive load                   |
| `LANG-NEW-OUTCOME` | Ship `/outcome` (Releases · Launches · Support · Learnings) — empty surfaces are fine if the loop is named              | 8 × 6 × Wk6 × 9 × Closes the loop (also v3 REC-07) |
| `LANG-04`          | Publish the glossary; add a CI script that flags banned synonyms (`Trajectory`, `Run` for missions, `Specialist` in UI) | 5 × 3 × Wk5 × 7 × Discipline                       |

### P3 — Continuous (voice enforcement)

| ID          | Change                                                                                                                               | I × E × H × S × B                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `LANG-10`   | Publish one-page voice guide; link from `design.md`; add to onboarding for every tool (Lovable / Claude Code / Antigravity / Gemini) | 6 × 2 × Wk4 × 8 × Drift prevention |
| `LANG-CHIP` | Enforce AI-message chip spec (§1) via component prop types — `<AiCallChip model via score latency tokens cost />`                    | 5 × 4 × Wk5 × 6 × Consistency      |

---

## 10. Open questions for the operator (≤5)

1. **Binding rename?** Should LANG-05 (the renames) be treated as binding (auto-graduated to backlog F-IDs) or advisory? Default: advisory.
2. **Cadence the product name itself.** v3 didn't reopen [`../naming.md`](../naming.md); do you want me to stress-test the name against the three personas in a sibling memo, or hold?
3. **Outcome surface scope.** §9 P2 ships `/outcome` as an empty named surface to close the loop in language even before the feature ships. Acceptable, or wait until the actual feature lands?
4. **Voice anchor.** §1 picked operator-grade from first principles. Want me to instead benchmark against Linear (terse-precise), Vercel (confident-minimal), or Paxel (machine-mode-explicit)?
5. **Glossary enforcement.** §9 P2 proposes a CI check that flags banned synonyms (`Trajectory`, etc.). Worth a hook, or trust the operator?

---

## Related

- Main audit: [`v3-audit-2026-06-06.md`](./v3-audit-2026-06-06.md)
- Current positioning: [`v2-positioning-2026-06-02.md`](./v2-positioning-2026-06-02.md)
- Strategy index: [`README.md`](./README.md)
- Decision log: [`session-decisions.md`](./session-decisions.md)
- UI/AI-message contract: [`../../design.md`](../../design.md)
- Sidebar nav source: [`../../src/components/cadence/AppShell.tsx`](../../src/components/cadence/AppShell.tsx)

---

## Triage status (2026-06-06)

✅ **Triaged.** All language recs graduated into [`../feature-backlog.md` § v3 Audit Triage](../feature-backlog.md#v3-audit-triage-2026-06-06). Mapping:

- LANG-01 → folded into `F-VOICE-LOGIN` (P0, with REC-01)
- LANG-02 → folded into `F-VOICE-VERSIONS` (P0, with REC-18)
- LANG-03 → folded into `F-IA-RENAMES` (P1) — sidebar rename batch
- LANG-04 → `F-VOICE-GLOSSARY` (P1)
- LANG-05 → `F-IA-RENAMES` (P1)
- LANG-06 → `F-VOICE-EMPTY-TODAY` (P0)
- LANG-07 → ☑ **shipped** as `F-VOICE-DIALOGS` (2026-06-06 `useConfirm`/`usePrompt` rollout)
- LANG-08 → `F-VOICE-CASE` (P0)
- LANG-09 → folded into `F-GOV-APPROVAL-COPY` (P0, with REC-08 approval-copy aspect)
- LANG-10 → ☑ **shipped** as `F-VOICE-GUIDE` ([`../conventions/ui-voice.md`](../conventions/ui-voice.md) + cross-tool wiring)
- TOOLTIP-DEL · TOOLTIP-REW → `F-VOICE-TOOLTIPS` (P1)
- LANG-IA-12 → subsumed by `F-COCKPIT-MERGE` (P1) + the four `F-IA-*` merge entries
- LANG-NEW-OUTCOME → folded into `F-OUTCOME-SURFACE` (Phase B target)
- LANG-CHIP → `F-VOICE-CHIP` (P2)

Operator answers to §10 open questions (defaults applied where not explicit): (1) LANG-05 graduated to a binding F-ID (`F-IA-RENAMES`). (2) Cadence name not reopened. (3) `/outcome` ships as named empty surface as part of Phase B. (4) Operator-grade voice anchor kept. (5) Glossary CI check captured in `F-VOICE-GLOSSARY`.
