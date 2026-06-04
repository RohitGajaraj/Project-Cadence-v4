# Active task — Bundle 9 Build lane

_Last updated: 2026-06-04 · Lovable. Slice 1 done + Build Console upgraded to accept free-form input (PRD optional). PRD list & detail surfaces now expose GitHub/Builder actions prominently. Slices 2 and 3 still in flight; next session, pick the lowest-numbered unchecked box and resume._

## Slice 1 — Builder agent + scoped PR — DONE ✓

- [x] Migration: seed `builder` agent (tight operator prompt) for every profile + new signups
- [x] Migration: add `github.pr.open` to `seed_pm_lifecycle_tools` at write/confirm + backfill
- [x] Tool handler `github.pr.open` in `src/lib/ai/tools/registry.server.ts` (REST-only PR pipeline, idempotency, path allow-list)
- [x] Nav patch: rename Code Studio → **Prototype Sandbox** (move to Discover); add **Build Console** → `/build`
- [x] Server fn `listBuilderRuns` in `src/lib/build.functions.ts`
- [x] New `/build` route — 5-column Kanban, 2s refresh
- [x] `/prds/$id` **Send to Builder** chip (dispatches Builder mission via `runAgent({ asMission: true })`)
- [x] Docs closed loop: status board, plan §4, architecture/orchestration.md
- [x] Discoverability: PRD detail page now shows a **Create GitHub issue → unlock Builder** button when `github_issue_url` is null (server fn `createGithubIssueForPrd` in `discovery.functions.ts`). Eliminates "I can't find a PRD with a linked issue" dead-end.
- [x] Removed Prototype Sandbox (`/studio`, `studio.functions.ts`, `studio-chat.ts`, nav + palette entries). Kept stack lean — Build Console is the only build surface.
- [x] PRD list cards expose **Create GitHub issue / Open issue / Send to Builder** actions inline (no need to open the doc first); status row shows `#N` chip when an issue is linked.
- [x] PRD detail rebuilt as a real document view: metadata row + **sticky actions bar** (Edit/Preview, Save, GitHub issue, Send to Builder, AI assist all in one place).
- [x] Build Console now has a **"Start a build" composer**: free-form goal + optional PRD reference + optional links + 3 issue-resolution modes (use PRD issue / explicit issue # / auto-create from goal). New server fn `dispatchBuilderMission` in `build.functions.ts`. Builder agent contract unchanged (single-file, gated, idempotent).
- [ ] Operator end-to-end smoke (you, not the agent): open a PRD with a linked issue → Send to Builder → approve the `github.pr.open` gate → confirm a real PR opens on `RohitGajaraj/Test-Project-Cadence` from a `builder/issue-…` branch, one file changed, body says `Closes #N`. (Cannot be done from the sandbox — needs your approval click.)

## Slice 2 — CI read + failure loop — TODO

- [ ] New tool `github.ci.status({pr_number})` — read/auto. GET `/repos/{repo}/commits/{head_sha}/check-runs` + `/status`. Returns `{ state: 'pending'|'success'|'failure', checks: [{name, status, conclusion, html_url}] }`.
- [ ] New tool `github.commit.append({pr_number, path, contents})` — write/confirm. Append a single-file follow-up commit to the existing PR branch (do NOT open a new PR). Idempotency key = `commit:<pr_number>:<content_hash>`.
- [ ] Builder system prompt update: after `github.pr.open`, poll `github.ci.status` up to 2 times (with delay); on `failure`, propose ONE `github.commit.append` then stop. Max 2 fix iterations before final answer requesting human help.
- [ ] Render CI status node on the Mission Graph (consume `tool_calls` where `tool_name='github.ci.status'`).
- [ ] `/build` Kanban: new "CI failed" column + amber pulse badge on cards with last `github.ci.status.result.state='failure'`.
- [ ] Closed doc loop.

## Slice 3 — Conflict-aware Build Console — TODO

- [ ] Server fn `listBuildConflicts` — flags (a) two open PRs touching the same file path, (b) two Builder hops in-flight with the same `issue_number`, (c) Builder proposing changes to a path another Builder is mid-edit on. Reads `tool_calls.args` of `github.pr.open` + `github.commit.append`. Returns `[{ kind, runIds[], detail }]`.
- [ ] On conflict detection, insert a row into `agent_messages` with `kind='conflict'` so it threads into the Mission Graph (no auto-resolve — surface only).
- [ ] `/build` cards: red pulse + tooltip listing the colliding run; click → open both Mission Graphs side-by-side.
- [ ] Mini Mission Graph inside each `/build` card (re-use `MissionGraph.tsx`, shrink wrapper).
- [ ] Backfill index/column for fast conflict lookup (probably one expression-index on `tool_calls.args->>'path'` filtered to `github.pr.open`). TBD.
- [ ] Closed doc loop.

## Notes & gotchas for the next session

- The Worker runtime has **no native git** — `github.pr.open` is REST-only. Do not try to add `simple-git` or `isomorphic-git` for Slice 2/3.
- `Buffer` is available (nodejs_compat); use `Buffer.from(text, 'utf8').toString('base64')` for file content, not `btoa` (unicode-unsafe).
- `agent_approvals` has **no `run_id` column** — join to runs through `trace_id` (see `build.functions.ts`).
- `tool_calls.result` is jsonb and stores the tool handler's return value; that's where the PR url + branch + path live for the `/build` chip.
- Path allow-list in `github.pr.open` blocks `.github/`, `supabase/migrations/`, `.env`, lockfiles. If the Builder needs to touch any of these later, widen the list with an explicit confirm-then-allow gate, not a silent removal.
- The renamed Code Studio keeps the `/studio` route so existing bookmarks/links don't break — only the nav label and group changed.