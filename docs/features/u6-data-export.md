# U6 · Workspace data export (data portability)

> Status · Core shipped 2026-06-18 (autonomous overnight cycle 1) · Route: `/settings?section=data` · Owner: operator-triggered

## What it does

One click in Settings > Data downloads the entire workspace as a single JSON file: every project, signal, opportunity (carrying its decision and Critic review), spec, task, outcome (learning), and the user's agent memory. It is the trust escape-hatch and the no-lock-in promise made real: your data, yours to keep or move anywhere.

## Why it exists

Data portability is a trust requirement, not a nicety: a PM will not pour their product thinking into a tool they cannot get it back out of. It complements B5 (per-product export) by exporting the whole workspace footprint at once. Build note: [`plan.md`](../../plan.md) §4.

## Where to find it

Settings (`/settings`) > the **Data** tab > "Download workspace export".

## Demo script (<= 90s)

1. Open Settings, click the **Data** tab.
2. Read the one-line promise: everything in this workspace, yours, no lock-in.
3. Click **Download workspace export**. A `cadence-workspace-export-<date>.json` file downloads.
4. Open it: a single JSON object with per-section arrays and a `counts` summary, plus `workspace_id`, `exported_by`, and `exported_at`.

## How it works

- `exportWorkspace` server fn in `src/lib/projects.functions.ts` (mirrors B5 `exportProduct` at workspace scope). GET, `requireSupabaseAuth` middleware.
- Resolves the active workspace (passed from the client, falling back to the user's first membership).
- Gathers projects by `workspace_id`; signals / opportunities / specs (`prds`) / tasks by `project_id` across the workspace's projects (guarded so a workspace with no projects never issues an empty `in()` query); the user's own `learnings` and `agent_memory` by `user_id`.
- Returns a JSON-safe shape with a `counts` map. RLS scopes every read to the caller, so it can only ever export the user's own rows.
- `DataExportCard.tsx` in `src/components/settings/` consumes the fn, serializes to a Blob, and triggers a download; it toasts the total record count.

## Governance & guardrails

- Read-only. No writes, no migration.
- RLS-scoped to the caller; a user can only export their own rows even if they pass another workspace's id.
- Calm-front: the surface names the outcome ("Export your data"), not the mechanism, and exposes no engine internals.

## Verification checklist

- [x] `tsc --noEmit` clean, `eslint` clean, `bun run build` green (2026-06-18).
- [x] Adversarial review folded: empty-projects `.in()` guard; active-workspace-id pass-through.
- [ ] **Pending published-app verification (needs the founder to publish first):** open Settings > Data on the live app, download the export, confirm the JSON contains the expected sections with non-zero counts on a seeded workspace, and confirm a second workspace's data is not present.

## Known limits / out of scope

- Per-section selective export shipped (cycle 6): the card has checkboxes to choose which sections to include (output-filtered server-side). Remaining: an export audit-log (and richer format choices). Tracked as the partial remainder on the U6 dashboard row.
- The standalone `decisions` and `lineage` edge tables are not yet exported separately (decisions travel with opportunities and specs via `critic_review`); a documented fast-follow.

## Related

- [`plan.md`](../../plan.md) §4 build log · [`projects.functions.ts`](../../src/lib/projects.functions.ts) (B5 `exportProduct` sibling) · feature-dashboard U6 row · [autonomous-build-loop playbook](../operations/autonomous-build-loop.md) (cycle 1).
