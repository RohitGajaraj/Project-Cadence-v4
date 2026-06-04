# Active task — Restructure + Cohere editorial redesign (4 phases)

**Started:** 2026-06-04 · Lovable
**Plan:** `.lovable/plan.md`

## Phase 1 — Nav IA + design tokens + shell  ✅ DONE
- [x] Reorganize sidebar into 6 enterprise pillars (Workspace rail + Discover/Deliver/Agents/AI Ops/Govern + Settings)
- [x] Move Calendar/Meetings out of Discover into Workspace; Sync Inbox under Agents; Govern as its own pillar
- [x] Rewrite `src/styles.css` tokens from dark Nightshift → Cohere editorial light (white canvas, near-black primary, deep-green/navy bands, coral chip, action-blue links, soft-stone/pale-green/pale-blue washes, 8px base radius)
- [x] Add Cohere utilities: `mono-label`, `btn-pill`, `btn-pill-outline`, `band-deep-green/navy/stone`, `chip-taxonomy`, `link-action`, `rule-hairline`
- [x] Swap fonts: Instrument Serif (display) + Inter (UI) + JetBrains Mono (labels) via Google Fonts in `__root.tsx`
- [x] Neutralize legacy decorative utilities (`neural-gradient`, `animate-aurora`, `ring-glow-violet`, `bento`, `glass`, `indigo-grid`) so dark-theme pages don't break before per-page restyle
- [x] Restyle AppShell sidebar to editorial light (white canvas, mono-label group headings, hairline dividers, near-black active indicator, logomark workspace tile)
- [x] Update `plan.md` §4, `docs/feature-backlog.md` Live status board

## Phase 2 — High-traffic page restyles  ☐
- [ ] `/` Today — editorial card grid, mono labels, deep-green CTA band, remove `neural-gradient`/`ring-glow-violet`/`indigo-grid` direct uses
- [ ] `/briefing` — editorial layout
- [ ] `/inbox` (Approvals) — research-table list pattern (rule-separated rows, title left, status right)
- [ ] `/prds` list — research-table pattern with editorial chips
- [ ] `/prds/$id` detail — editorial document, near-black pill CTAs in sticky actions bar
- [ ] Verify no remaining direct `neural-*` / `ring-glow-*` uses in these routes

## Phase 3 — Discover + Deliver + Agents pages  ☐
- [ ] `/discovery` · `/opportunities` (Discover)
- [ ] `/docs` · `/roadmap` · `/tasks` · `/build` (Deliver)
- [ ] `/agents` · `/missions` · `/missions/$id` · `/prompts` · `/sync` (Agents)

## Phase 4 — AI Ops + Govern + remaining surfaces  ☐
- [ ] `/analytics` · `/traces` · `/traces/$id` · `/evals` · `/drift` (AI Ops)
- [ ] `/guardrails` · `/governance` · `/budgets` · `/integrations` (Govern)
- [ ] `/settings` · `/calendar` · `/meetings` · `/chat`
- [ ] `login.tsx` · `signup.tsx`
- [ ] Update `design.md` token table + `architecture/frontend.md` design-system entry

## Gotchas for the next tool
- All existing pages still consume semantic tokens (`bg-background`, `text-foreground`, `border-hairline`), so they inherit the light theme automatically. The visual breakage is concentrated where pages **directly** use `neural-gradient`, `ring-glow-violet`, `indigo-grid`, or hardcoded violet/cyan/amber color classes — grep `src/routes` for those and replace per phase.
- Legacy utilities are neutralized (not deleted) — safe fallback. Replace per-page with Cohere utilities (`band-deep-green`, `mono-label`, `btn-pill`) as you restyle.
- Dark mode deferred. Cohere is a light system. Do not add a `.dark` block unless explicitly requested.
- No route URLs were changed in Phase 1. Sidebar grouping only.

## Done criteria for the whole restructure
- Every authenticated route visually consistent with the Cohere editorial system
- No remaining direct uses of dark-theme decorative classes in route files
- `design.md` token table reflects new palette; `architecture/frontend.md` notes the redesign
- `active-task.md` deleted, Live status board flipped to next priority (resume Bundle 9 Slice 2)
