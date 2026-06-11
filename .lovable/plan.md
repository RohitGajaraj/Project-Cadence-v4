
# F-DECISIONS-CAPTURE — plan

## Current state (what already works)

- `decisions` table exists with workspace-scoped RLS, columns: `id, user_id, workspace_id, product_id, project_id, title, rationale, status, meeting_id, created_at`. Realtime is enabled.
- Server fns exist: `listDecisions` (last 20, workspace-scoped), `createDecision`, `updateDecision`.
- **Meetings** already emit decisions: `extractMeeting({commit:true})` writes one row per AI-extracted decision, linked via `meeting_id`.
- The **Today** page (`/`) already shows a "Recent decisions" list with approve/reject + manual add.
- `/knowledge?tab=decisions` renders a stub (`DecisionsPanel`).

## Gaps to close

1. **No source link for missions or specs.** `decisions` has `meeting_id` but no `mission_id` or `prd_id`. Missions never write decision rows; PRDs/specs never do either.
2. **No real Decisions UI.** The Knowledge tab is a stub; the Today list is the only surface.
3. **No "capture as decision" affordance** on mission detail or PRD detail pages, so an operator can't pin a choice they just made.

## Scope (what this ticket ships)

### A. Schema (one migration)

Add to `decisions`:
- `mission_id uuid NULL` → `missions(id) ON DELETE SET NULL` + index
- `prd_id uuid NULL` → `prds(id) ON DELETE SET NULL` + index
- `source_kind text NULL` with check constraint `IN ('meeting','mission','prd','manual')` (denormalized for fast filter; meeting backfill = `'meeting'` where `meeting_id IS NOT NULL` else `'manual'`)
- `decided_by_agent_slug text NULL` (for agent-initiated captures; future-proofs the Trust score loop)

No new policies — existing workspace-scoped RLS covers it.

### B. Server fns (extend `src/lib/decisions.functions.ts`)

- `listDecisions` → return joined source labels (mission title, prd title, meeting title) via separate cheap selects; accept optional `{ source?: 'meeting'|'mission'|'prd'|'manual', status?, q? }` filters. Cap at 100.
- `createDecision` → accept optional `mission_id | prd_id | meeting_id` + `source_kind`. Derive `source_kind` from whichever id was passed (defaults `'manual'`).
- Add `getDecisionContext({ id })` → returns the decision + linked source summary (for the side sheet).

### C. Auto-capture hooks (sources → decisions)

- **Missions**: in `src/lib/missions.functions.ts`, when a mission transitions to `status='completed'` (find the existing update path), insert one decision row `{ title: "Mission completed: <goal>", rationale: <final output summary>, mission_id, source_kind: 'mission', status: 'approved' }`. Idempotent: skip if a `mission_id`-linked row already exists.
- **PRDs / specs**: in `src/lib/discovery.functions.ts` (or wherever PRD status updates live), when `prds.status` flips to `'approved'`, insert `{ title: "Spec approved: <prd title>", rationale: first 500 chars of body, prd_id, source_kind: 'prd', status: 'approved' }`. Same idempotency.
- **Meetings**: already wired; just stamp `source_kind='meeting'` on the existing insert.

### D. DecisionsPanel UI (replace stub)

`src/components/knowledge/DecisionsPanel.tsx` rewrite:
- Header with source filter chips (All · Meetings · Missions · Specs · Manual) + status filter (All · Pending · Approved · Rejected) + search.
- List rows: title, source badge (icon + label linking to `/missions/$id` | `/prds/$id` | meeting sheet via `/knowledge?tab=calendar&meeting=$id`), status pill, age, owner avatar.
- Empty state per filter.
- Side sheet on row click: full rationale, source context, approve/reject, manual edit.
- "Log decision" CTA opens a small dialog using `usePrompt`-style modal (title + rationale + optional source picker).
- No native chrome; semantic tokens only; voice rules.

### E. Capture affordances on source pages

- Mission detail (`/missions/$id`): "Capture as decision" button in the page header → opens the same dialog pre-filled with mission context (title + goal as rationale).
- PRD detail (`/prds/$id`): same button in the sticky actions bar.
- Meeting sheet: already covered by `extractMeeting`; no change.

### F. Today page

Today's "Recent decisions" stays as a 5-item glance, but the empty state now points to `/knowledge?tab=decisions` and the "View all" link points there too.

## Out of scope

- Decision threads / comments / collaboration.
- Decision templates.
- Workflow rules ("decisions of type X auto-create a task").
- Re-litigation / supersedence chains.

These can be follow-up tickets (`F-DECISIONS-THREADS`, `F-DECISIONS-TEMPLATES`).

## Doc closure (same turn)

- Flip `F-DECISIONS-CAPTURE` to ✅ in `docs/planning/feature-backlog.md` with a "How to use / verify" block (routes, controls, what each source does, verification checklist).
- Append one-liner to `plan.md` §4.
- Update `architecture/frontend.md` Knowledge section: Decisions is now live with source filters + side sheet.
- Update `architecture/data.md` (if it exists) for the schema additions.
- Delete `active-task.md` if this is the only in-flight item.

## Open question for you

**How aggressive should auto-capture be?**

- **(default in this plan) Conservative**: only mission completion + PRD approval auto-write decisions. Everything else is operator-triggered via "Capture as decision".
- **Aggressive**: also auto-write on mission approval gates, every agent run that crosses a confidence threshold, every PRD section flagged "decision".

I'd ship Conservative first (smaller blast radius, easier to reason about, cheap to add Aggressive later). Say "go aggressive" if you want me to flip it before I start.

## Files (estimate)

- new: 1 migration in `supabase/migrations/`
- edit: `src/lib/decisions.functions.ts`, `src/lib/missions.functions.ts`, `src/lib/discovery.functions.ts` (PRD status updater), `src/lib/meetings.functions.ts` (stamp source_kind)
- rewrite: `src/components/knowledge/DecisionsPanel.tsx`
- edit: `src/routes/_authenticated.missions.$missionId.tsx`, `src/routes/_authenticated.prds.$id.tsx` (add capture button)
- docs: `feature-backlog.md`, `plan.md`, `architecture/frontend.md`
