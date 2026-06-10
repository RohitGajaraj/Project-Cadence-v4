## Phase 1d — Knowledge + Learn surfaces

Final phase of F-IA-V4 (7-surface IA collapse). Folds Memory, Docs, Calendar, Meetings, and a new Decisions tab into `/knowledge`. Creates `/learn` with Support · Outcomes · Learnings. Pins Knowledge to the top rail.

### Decisions confirmed

1. **Calendar folds into Knowledge as a tab** (spec-literal Option B). The whole purpose of Knowledge is *one place to find anything the org knows or scheduled* — Calendar belongs there.
2. **Knowledge gets pinned in the top rail** alongside Home · Chat · Missions. Approvals + Calendar drop off the pinned rail (Approvals already lives in Govern; Calendar is now inside Knowledge).
3. **Decisions tab = stub for now.** Empty-state explains it'll hold workspace decisions sourced from missions/specs/meetings. Wiring those capture points is a follow-up ticket, not part of 1d.
4. **Learn = 3 tabs.** Outcomes is real (extracted from `/outcome`); Support + Learnings ship as "Coming soon" panels so the IA shape is locked.

### Knowledge surface (`/knowledge`)

4 tabs: **Memory · Decisions · Docs · Calendar**. Tab state in `?tab=` via `validateSearch`, default `memory`. Container `max-w-[1400px]` (Calendar's list view needs the width).

Panel extraction:
- `MemoryPanel` — extract from existing memory views (currently surfaced inside Settings/agent context). Read-only list of memory entries grouped by source.
- `DecisionsPanel` — new, stub. Empty state + "How decisions get captured" copy. No server fn yet.
- `DocsPanel` — extract body of `_authenticated.docs.tsx`.
- `CalendarPanel` — extract body of `_authenticated.calendar.tsx` (already merged Calendar+Meetings; keep `?meeting=<id>` sheet behavior intact by forwarding the search param through to the panel).

Route redirects:
- `/docs` → `/knowledge?tab=docs`
- `/calendar` → `/knowledge?tab=calendar` (preserves existing `?meeting=` if present)
- `/meetings` and `/meetings/$id` — already redirect to `/calendar`; update both to `/knowledge?tab=calendar` (with `?meeting=$id` for the deep-link variant)

### Learn surface (`/learn`)

3 tabs: **Support · Outcomes · Learnings**. Tab state in `?tab=`, default `outcomes` (the only real one).

Panel work:
- `OutcomesPanel` — extract the non-Releases slice of `_authenticated.outcome.tsx` (Releases already lives in `/product`).
- `SupportPanel` — stub. Empty state describing the loop from Discovery → Support → Discovery.
- `LearningsPanel` — stub. Empty state describing what insight memos will look like.

Route redirects:
- `/outcome` → `/learn?tab=outcomes`
- `/analytics` (already redirecting to `/govern`) — confirm the user-facing analytics slice the spec calls out for Learn is not duplicated; leave Govern's Analytics tab as-is (it's observability, not learning).

### AppShell rewrite

New pinned rail (top): **Home · Chat · Missions · Knowledge**. Drop Approvals and Calendar from the pin. Approvals is reachable via `/govern?tab=approvals` and from the Home needs-you queue (when 1d ships that).

Collapsible groups below:
- **Product** → `/product`
- **Knowledge** → `/knowledge` *(also pinned — group entry mirrors the pin, like Missions does today)*
- **Learn** → `/learn`
- **Govern** → Govern, Integrations
- **Build** → Builder, Docs *(Docs entry here just deep-links to `/knowledge?tab=docs`)*
- **Settings** → `/settings`

Remove now-empty top-level entries for Calendar, Meetings, Docs, Outcome.

CommandPalette: add `/knowledge`, `/knowledge?tab=…`, `/learn`, `/learn?tab=…`. Remove standalone Calendar/Meetings/Docs/Outcome destinations.

### Files

**Create:**
- `src/components/knowledge/{Memory,Decisions,Docs,Calendar}Panel.tsx`
- `src/components/learn/{Support,Outcomes,Learnings}Panel.tsx`
- `src/routes/_authenticated.knowledge.tsx`
- `src/routes/_authenticated.learn.tsx`

**Convert to redirects:**
- `src/routes/_authenticated.docs.tsx`
- `src/routes/_authenticated.calendar.tsx`
- `src/routes/_authenticated.meetings.tsx` (repoint)
- `src/routes/_authenticated.meetings.$id.tsx` (repoint)
- `src/routes/_authenticated.outcome.tsx`

**Edit:**
- `src/components/cadence/AppShell.tsx` — pinned rail + groups
- `src/components/cadence/CommandPalette.tsx` — destinations
- `architecture/frontend.md` — pinned rail contract (4 items now, Knowledge added, Approvals/Calendar removed), Knowledge + Learn surface contracts
- `active-task.md`, `docs/planning/feature-backlog.md`, `plan.md` §4

### What I will NOT do

- Build the unified Knowledge search bar / cross-tab Q&A (that's a Phase 2 / M2 feature).
- Wire mission/spec/meeting → Decisions capture (follow-up ticket; I'll add it to the backlog as `F-DECISIONS-CAPTURE`).
- Touch any server functions or DB. Pure routing + composition, same as Phases 1a–1c.
- Redesign any panel internals.

### Risk / open questions

1. **Pinning Knowledge** means the top rail has Home · Chat · Missions · Knowledge — four pins. Spec literally said three (Home · Chat · Missions). I'm reading your direction as overriding that and pinning Knowledge because consolidated knowledge access *is* a daily-loop job, not a reference one. Confirm.
2. **Calendar deep-link `?meeting=<id>`** must keep working after the route move. I'll forward the search param through `validateSearch` on `/knowledge` so `/knowledge?tab=calendar&meeting=abc` opens the meeting sheet. Old `/meetings/abc` and `/calendar?meeting=abc` redirect to the new shape.
3. **Memory panel content.** There's no `/memory` route today — memory is read in agent context and shown in scattered places. I'll start with a simple list view of memory entries (source + content + created-at) and we can iterate. Confirm that's fine for the stub.

Reply **"go phase 1d"** to start, or correct any of the three points first.
