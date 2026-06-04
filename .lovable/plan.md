
## What you're asking for

Two real gaps:

1. **PRDs feel half-wired.** The list page (`/prds`) shows no GitHub / Builder actions on the cards, and the detail page hides the most important actions in a tiny chip above the title. There's no clear "open as full document → edit → ship" flow.
2. **Build Console is too narrow.** It only knows how to receive a mission dispatched from a PRD that already has a linked GitHub issue. A user with a paragraph of intent, a link to a doc, or just an existing PRD reference should be able to kick off a build right from `/build`.

This plan keeps changes UI-shaped (frontend + one thin server fn) and does not touch the Builder agent's tool contract.

---

## 1 · Fix PRD structure & actions

### `/prds` (list page)
Add a small actions row on each PRD card with the right action for its state:

- No issue linked → **Create GitHub issue** (violet) + **Open PRD** (ghost)
- Issue linked → **Open issue ↗** + **Send to Builder** (cyan) + **Open PRD**
- Always present: **Generate tasks** (existing) and **Lineage** (existing)

Status chip next to the title also shows `#123` when an issue is linked, so you can see lineage at a glance without opening the doc.

### `/prds/$id` (detail page) — proper full-doc view
Restructure the header into a real document layout:

```
┌────────────────────────────────────────────────────────────┐
│  ← All PRDs           [status] [updated]                   │
│  ─────────────────────────────────────────────────────────  │
│  Title (large, editable inline)                            │
│  ─────────────────────────────────────────────────────────  │
│  Actions bar (sticky):                                     │
│   [Edit/Preview toggle]  [Save]                            │
│   [Create GitHub issue]  OR  [Open issue #N ↗][Send to Builder] │
│   [Generate tasks]  [Push to Linear]  [Lineage]            │
│   [AI assist: rewrite · expand · shorten · critique]       │
└────────────────────────────────────────────────────────────┘
                       Document body
```

Concretely:
- Promote the GitHub / Builder controls into the **primary actions bar** (not a chip above the back link).
- Make the bar **sticky** while you scroll the doc, so actions are always reachable.
- Preview mode renders as a real article (already exists) — just widen and clean spacing so it looks like a finished spec.
- Add a thin metadata row (status pill, last updated, linked issue, linked tasks count) so the PRD reads as a document, not a form.

No business-logic change — same `createGithubIssueForPrd`, `runAgent`, `promotePrdToTasks`, `savePrd`, `prdAssist` server fns. Just visible, well-placed actions.

---

## 2 · Build Console accepts free-form input

Replace the empty-state-only Build Console with a **"Start a build" composer** at the top of `/build`, always visible:

```
┌─ Start a build ────────────────────────────────────────────┐
│  Goal (required)                                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ What should the Builder ship? Be specific.            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Reference PRD (optional)  [ Select PRD ▾ ]                 │
│  Reference links (optional)                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ https://… (one URL per line)                           │ │
│  └────────────────────────────────────────────────────────┘ │
│  GitHub issue (optional)  ( ) Use linked PRD issue          │
│                           ( ) Issue # [____]                │
│                           (•) Auto-create issue from goal   │
│                                                             │
│             [ Dispatch Builder ]  scope: single-file, gated │
└────────────────────────────────────────────────────────────┘
```

Behavior:
- **Goal alone** is enough to dispatch. If "Auto-create issue" is selected and a PRD isn't picked, we create a lightweight GitHub issue from the goal + reference links and feed its number to the Builder.
- **Reference PRD** — when picked, we use its `github_issue_url` if present; otherwise we offer to create one. The PRD title + body get included as context in the Builder's goal prompt.
- **Reference links** — appended to the Builder goal as a `Context:` block. No fetching, no scraping — they're hints for the agent.
- The composer collapses into a compact "+ New build" button once you have any runs, to keep the Kanban above the fold.

Below the composer, the existing 5-column Kanban stays exactly as-is.

### Server fn changes (minimal)

- **New:** `dispatchBuilderMission` in `src/lib/build.functions.ts` — takes `{ goal, prdId?, issueNumber?, autoCreateIssue?, referenceLinks?[] }`. Resolves the issue number using one of three paths (linked PRD → explicit number → auto-create via the existing `createGithubIssueForPrd`-style helper, generalized to accept a free-form title/body), then calls the existing `runAgent({ agentSlug: "builder", asMission: true, … })`. Same idempotency contract as today.
- **Reused:** `runAgent`, `createGithubIssueForPrd` logic (extract its issue-creation core into a small `createGithubIssue({ title, body })` helper inside `discovery.functions.ts` so the Build Console can use it without going through a PRD).

No database migration. No new tables. No tool registry changes. The Builder agent still calls `github.pr.open` with the same allow-list + idempotency.

---

## 3 · Empty state & copy fixes

- Build Console empty state changes from "Go to PRDs" to "Start your first build above ↑".
- PRD list empty state already exists — leave it.
- Update one line in `architecture/orchestration.md` and the Build Console entry in `docs/feature-backlog.md` to note that builds can be dispatched from `/build` directly, not only from PRDs. Update `active-task.md`.

---

## Out of scope (intentionally)

- Attaching real files (PDFs, images) to a build — links only for now; file attachments are a bigger Storage + RAG change.
- Loosening the Builder agent's "single-file, confirm-gated" scope (you chose Tight last round; keeping it).
- Touching `prototypes` tables or anything related to the removed Prototype Sandbox.

---

## Files I'll touch (in build mode)

- `src/routes/_authenticated.prds.tsx` — add per-card actions row
- `src/routes/_authenticated.prds.$id.tsx` — restructured doc header + sticky actions bar
- `src/routes/_authenticated.build.tsx` — composer at top, updated empty state
- `src/lib/build.functions.ts` — new `dispatchBuilderMission` server fn
- `src/lib/discovery.functions.ts` — extract `createGithubIssue({title, body})` helper so Build Console can auto-create issues without a PRD
- `docs/feature-backlog.md`, `architecture/orchestration.md`, `plan.md`, `active-task.md` — close the doc loop

Want me to proceed?
