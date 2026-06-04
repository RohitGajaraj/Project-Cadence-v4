## Restructure + Cohere redesign

### Part 1 — Information architecture (my recommendation)

The current sidebar has 6 daily-pinned items + 4 collapsible groups (Discover/Build/AI Ops/Interop) with cross-purpose items mixed in (Calendar and Meetings under Discover, Sync Inbox under Build, etc.). For an enterprise agent platform, the cleanest mental model separates **what the human does daily** from **what the agents are doing** from **what governs the agents**. Six top-level groups:

```text
WORKSPACE   (your daily surfaces — always visible at top, not collapsible)
  Today · Briefing · Inbox (Approvals) · Calendar · Meetings · AI Chat

DISCOVER    (signal → opportunity)
  Discovery · Opportunities

DELIVER     (decide → ship)
  PRDs · Docs · Roadmap · Tasks · Build Console

AGENTS      (the workforce)
  Agents · Missions · Prompt Studio · Sync Inbox

AI OPS      (observe + measure)
  AI Analytics · Traces · Eval Harness · Drift

GOVERN      (control + safety)
  Guardrails · Governance · Budgets · Integrations

  Settings (footer, separate)
```

Why this is right for enterprise: Workspace is the constant rail (matches Linear/Notion/Asana mental models); the four phase-groups (Discover/Deliver/Agents/AI Ops) map to the Cadence lifecycle from the README; Govern is its own pillar because in an agent-native product, governance is a peer to product work, not a sub-tab. Calendar/Meetings leave Discover (they're inputs to *every* phase, not just discovery). Sync Inbox moves under Agents because that's where agents resolve external state.

### Part 2 — Design system overhaul (Cohere editorial light)

Cohere is a **light, editorial, monochrome-with-deep-green** system — opposite of the current Nightshift dark+violet. Full overhaul means rewriting tokens at the source so every existing component inherits, then restyling shell + key page chrome patterns.

**Token rewrite** (`src/styles.css`):
- Canvas `#ffffff`, ink `#212121`, muted slate `#93939f`, hairline `#d9d9dd`
- Brand primary near-black `#17171c`, deep-green band `#003c33`, dark-navy `#071829`
- Coral `#ff7759` for editorial/taxonomy chips only, action-blue `#1863dc` for links
- Soft-stone `#eeece7` + pale-green `#edfce9` + pale-blue `#f1f5ff` surface washes
- Radius scale: 4 / 8 / 16 / 22 / 30 / 32px (current is 12px base — Cohere needs the 22px signature media radius)
- Drop all neural gradients, aurora, ring-glow, grain — Cohere is flat
- Shadows minimal; depth comes from surface contrast + hairlines
- Add mono-label utility (uppercase + 0.28px tracking)

**Typography** (editorial swap):
- Display: **Instrument Serif** (closest free analog to CohereText's carved, tight feel)
- UI/body: **Inter** (Unica77 fallback already in Cohere's spec)
- Mono labels: **JetBrains Mono**
- Add Google Fonts links in `__root.tsx` head

### Part 3 — Phased build

**Phase 1 (this session)** — nav restructure + token rewrite + shell restyle
- Rewrite `AppShell.tsx` with the 6-group structure above
- Rewrite `src/styles.css` to Cohere tokens (light canvas, near-black primary, removed gradients)
- Add fonts in `__root.tsx`
- Restyle sidebar: white canvas, mono-label group headings, hairline dividers, no gradient ring
- Verify all existing pages still render (token-driven, should inherit)
- Update `architecture/frontend.md` + `design.md` + `docs/feature-backlog.md` log

**Phase 2 (next session)** — high-traffic pages
- Today / Briefing / Inbox: editorial card grid, mono labels, deep-green CTA bands
- PRDs list + detail: research-table list pattern, near-black pill CTAs

**Phase 3** — Discover + Deliver + Agents pages
- Discovery, Opportunities, Roadmap, Build, Missions

**Phase 4** — AI Ops + Govern + remaining surfaces
- Traces, Evals, Guardrails, Governance, Analytics, Drift, Budgets, Integrations, Settings

Each phase ends with the doc-loop closed (status board, plan.md §4, architecture entry).

### Technical details

- No route URLs change — only the sidebar grouping. All existing `to=...` links keep working.
- Tokens swap is non-breaking because every component already consumes semantic tokens (`bg-background`, `text-foreground`, `border-hairline`, etc.). Pages that hardcode violet/gradient classes (the dashboard hero, some bento cards) will need targeted edits in Phase 2.
- Dark mode: deferred — Cohere is a light system by design. If you want dark mode later, we add it as a `.dark` override in Phase 5.
- `BudgetBar`, `MissionGraph`, and other shell widgets will need light-theme passes — handled in Phase 1.
- Removing `.animate-aurora`, `.neural-gradient`, `.ring-glow-violet` will visually break anywhere they're used directly; I'll grep and replace in Phase 1.

**Approve and I start Phase 1.**