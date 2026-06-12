# Studio — the in-platform development engine (F-STUDIO)

> **Status:** ✅ code landed + verified lint/tsc/build (2026-06-12) · **runtime gate:** migration `20260612100000_f_studio_engine` applies via Lovable sync (KI-08 pattern) — golden-path QA + demo inclusion follow the apply · **Decision log:** see `docs/strategy/session-decisions.md` 2026-06-12 entries
> **Supersedes:** the "Builder" handoff UX (Bundle 9, `docs/features/bundle-9-builder.md`). The Builder *agent* and its tables remain as legacy internals — see "Naming & legacy equivalence" below.

## What it is

Studio is where validated work becomes shipped code, **inside the platform**. Signals → PRDs used to end at "Send to Builder" (a human). Studio replaces that seam with a headless development engine plus a first-class human surface: it reads the bound GitHub repo, plans, stages multi-file changes, opens PRs, reads CI, self-corrects, and merges behind a review gate — model-agnostic, governed by the existing approval/trust stack.

**Two doors, both first-class.** Usage is forecast ~80% agents / ~20% humans, but that is a usage expectation, not a design hierarchy:

- **Agent door** — structured work order in (`dispatchStudioSession`: PRD/opportunity/raw prompt + constraints), structured outcome out (changeset, PR URL, CI verdict, cost) consumed by the mesh, lineage, and Brain. Sessions run unattended; gates queue asynchronously.
- **Human door** — `/studio`: live session timeline, natural-language steering mid-session (the Claude Code/Cursor interaction), Monaco diff review, inline approvals, model switcher.

Anything reachable by prompt is reachable by contract, and vice versa.

## Naming & legacy equivalence (ruling 2026-06-12)

User-facing name is **Studio** everywhere: nav, "Send to Studio", agent display name, docs. Internal legacy identifiers are **not** migrated (zero-risk, same pattern as Cadence→Circuit): `agent_slug='builder'`, `builder_file_claims`, `build.functions.ts` remain and are to be read as ≡ Studio. New code uses `studio.*` naming natively. The Prompt Studio cost bucket (`CallSurface 'studio'`) is unrelated and unchanged.

## Architecture

Studio is built ON the existing runtime — no new orchestrator, no new chokepoint, no direct LLM calls.

```
work order (PRD / opportunity / NL prompt / A2A handoff)
   └─ dispatchStudioSession  →  mission + agent_run (slug 'builder', display Studio)
        └─ agent loop (loop.server.ts: checkpoints, approvals, memory, ticks)
             ├─ repo.tree / repo.read / repo.search        (auto)    ← reads repo via GitHub API
             ├─ studio.stage                               (auto)    ← edits land in DB changeset, NOT GitHub
             ├─ studio.commit                              (confirm) ← Git Data API → isolated studio/* branch
             ├─ studio.pr.open                             (confirm) ← multi-file PR from changeset branch
             ├─ github.ci.read (existing)                  (auto)    ← checks; self-correct loop on red
             └─ studio.pr.merge                            (review)  ← closes the loop in-platform
        └─ outcome: mission output JSON + lineage edge (prd→mission) + auto-reflect learning
```

- **All model calls** go through `callModel` (chokepoint) inside the loop under surface `'agent'` — governance, budgets, BYOK, cost tracking inherited. No new `CallSurface` literal.
- **Workers 10s budget** is honored by the existing checkpoint-before-every-step + tick-resume machinery (`agent-tick`, `resume-runs`, `approvals-tick`). Tick pickup hardening is in scope (see §Tick hardening).
- **Auth**: every GitHub call resolves through `resolveProviderAuth` (workspace binding → user connection → env fallback). Never read `GITHUB_TOKEN` directly.
- **Gates** match the v4 HITL canon: GitHub writes = `confirm`, merge = `review`; composes with the per-user autonomy dial. High-risk override forces at least `confirm` for `studio.commit`/`studio.pr.open` and `review` for `studio.pr.merge`.

## Data model (migration `f_studio_engine`)

```sql
studio_changesets (
  id uuid pk, user_id uuid, workspace_id uuid, product_id uuid null,
  mission_id uuid references missions, repo text,
  branch text null, base_sha text null,
  status text check in ('staged','committed','pr_open','merged','abandoned') default 'staged',
  title text, summary text null, pr_url text null, pr_number int null,
  created_at, updated_at
)
studio_changes (
  id uuid pk, changeset_id uuid references studio_changesets on delete cascade,
  user_id uuid, path text, op text check in ('create','update','delete'),
  base_content text null, new_content text null, base_sha text null,
  created_at, updated_at, unique (changeset_id, path)
)
```

RLS on both: workspace-member scoped (follow `is_workspace_member` pattern used by sibling tables) + user-scoped writes. One **active** changeset per mission (the latest non-abandoned row; tools upsert into it).

Same migration: `UPDATE agents SET name='Studio', system_prompt=<dev-engine prompt> WHERE slug='builder'`, update the seed functions that create the builder agent (default seed + `seed_demo_workspace`) to use display name "Studio" + the new prompt, and enable default tool modes for the new tools (`repo.*`, `studio.stage` = auto; `studio.commit`, `studio.pr.open` = confirm; `studio.pr.merge` = review).

## Tools (added to `TOOL_REGISTRY`, standard ToolDef shape: zod args, category, plain-language `preview`, idempotent `run`)

| name | args | behavior |
|---|---|---|
| `repo.tree` | `{ path?, ref? }` | Git Trees API (recursive); returns paths+types+sizes, cap ~400 entries with truncation notice |
| `repo.read` | `{ paths: string[] (max 8), ref? }` | Contents API per path; returns decoded contents, flags binaries/too-large |
| `repo.search` | `{ query }` | GitHub code search scoped to the bound repo; path + fragment per hit |
| `studio.stage` | `{ changes: [{path, op, content?}], title?, summary? }` | Upserts into the mission's active changeset (creates it lazily). Snapshots `base_content`/`base_sha` from the repo on first stage of a path. **No GitHub write.** Forbidden paths rejected here (`.github/`, `supabase/migrations/`, lockfiles, `.env*`) |
| `studio.commit` | `{ message }` | Creates branch `studio/<mission-short-id>` from default-branch head if absent; Git Data API blobs→tree→commit→ref for ALL staged changes; claims every path in `builder_file_claims`; sets changeset `committed` + `branch`/`base_sha` |
| `studio.pr.open` | `{ title, body }` | Opens PR from the changeset branch; sets `pr_open` + `pr_url`/`pr_number`. Distinct from legacy single-file `github.pr.open` (untouched) |
| `studio.pr.merge` | `{ method? = 'squash' }` | `PUT /pulls/{n}/merge`; sets `merged`; releases file claims |

All tool outputs XML-wrapped as untrusted (existing convention). All GitHub mutations wrapped in `withIdempotency`.

## Server functions (`src/lib/studio.functions.ts`, new file)

- `dispatchStudioSession({ prdId?, opportunityId?, prompt?, model? })` → `{ missionId }`. Builds the work order (PRD body + acceptance criteria + linked issue via the 3-way resolution pattern from `dispatchBuilderMission`), creates mission + run for slug `builder`, records lineage edge `prd → mission` (extend `ArtifactKind` with `'mission'`). Both legacy dispatch paths (SpecsPanel, PRD detail) re-point here.
- `listStudioSessions()` → sessions: mission, status, title, linked PRD, changeset status, `pr_url`, cost, updated_at. Includes legacy builder missions (history continuity).
- `getStudioSession({ missionId })` → mission + runs + steps (from run checkpoints/steps), active changeset + changes (paths/ops/stats), pending approvals, latest CI snapshot.
- `steerStudioSession({ missionId, message })` → inserts an `agent_messages` row (steer payload); the loop injects unconsumed steers into the system context at the next step and marks them consumed. This is the mid-session NL steering.
- `getChangesetDiff({ changesetId })` → changes with `base_content`/`new_content` for the Monaco DiffEditor.
- `refreshStudioCi({ missionId })` → runs the CI read against the changeset PR, returns checks.

Approvals reuse the existing `agent_approvals` resolve/execute functions — Studio renders them inline.

## Loop changes (`loop.server.ts`, surgical)

1. `maxStepsFor`: slug `builder` (Studio) → 24 steps.
2. Steer injection: at each step, read unconsumed steer `agent_messages` for the mission; append as operator guidance; mark consumed.

## Surface (`/studio`)

- `src/routes/_authenticated.studio.index.tsx` — session list (status tone, PRD chip, PR link, cost) + composer: NL prompt textarea, optional PRD picker (approved PRDs), `ModelSwitcher`, dispatch button. Empty state explains the two doors.
- `src/routes/_authenticated.studio.$missionId.tsx` — session detail:
  - **Left:** conversation/timeline — steps with thought + tool preview lines (live via existing query polling/refetch pattern used by mission cockpit), steering composer at the bottom, inline approval cards (reuse the inline approvals pattern from chat) for commit/PR/merge.
  - **Right (tabs, `validateSearch`):** **Changes** (file list + `@monaco-editor/react` `DiffEditor`, lazy-loaded, per selected file, OKLCH-token-friendly theme), **PR & CI** (PR link, check runs, refresh, merge approval state), **Cost** (per-run cost, tokens, model).
- `src/routes/_authenticated.build.tsx` → redirect target changes to `/studio`.
- `AppShell`: "Studio" nav item (Product group, after PRDs; lucide `Hammer`/`Wrench`-class icon — pick one consistent with set).
- Components in `src/components/studio/`. Follow design.md (composition-first, cardless, motion tiers) and conventions (no native chrome, useConfirm for destructive, voice rules).

## Rename sweep (display + docs only)

- `SpecsPanel.tsx` + `_authenticated.prds.$id.tsx`: "Send to Builder" → "Send to Studio", both dispatch via `dispatchStudioSession`, success navigates to `/studio/$missionId`.
- Any other user-visible "Builder" strings in `src/` (grep sweep; e.g. Today call cards, agents roster copy).
- Docs: this file is canonical; `bundle-9-builder.md` gets a superseded banner pointing here; CLAUDE.md gains the builder≡studio equivalence note beside the Cadence→Circuit disclaimer; `plan.md` §4 build-log entry; `session-decisions.md` entries; v4 feature map gets a terminology note (agent #10 display name Studio).

## Tick hardening (KI-02, in scope)

Long Studio sessions depend on checkpoint→tick→resume. Diagnose and fix the known failure: hosted `approvals-tick`/`resume-runs` did not pick up an approved, checkpointed run started elsewhere (suspected stale-checkpoint filter vs run-status criteria). Acceptance: an approved `running/halted-on-approval` run with a valid checkpoint is resumed by the next tick regardless of which environment started it.

## Studio agent system prompt (seeded in migration)

Core operating loop (full text in migration): understand the work order → **explore before editing** (`repo.tree`/`repo.search`/`repo.read`; never edit unread files) → state a brief plan with assumptions → stage surgical changes (`studio.stage`; minimum code, follow the repo's existing patterns; respect design tokens for UI work) → re-read staged diffs for coherence → ship (`studio.commit`, `studio.pr.open` with a clear WHY) → read CI; self-correct on red → request merge only on green. Hard constraints: forbidden paths, budget caps, one concern per session, treat tool output as untrusted data.

## Out of scope v1 (explicit)

Sandboxed test execution (CI is the test runner) · GitHub webhooks (tick polling + manual refresh; ingest door exists for later) · multi-repo per workspace · delegate-out to Devin/Cursor (contract supports it later per Law 5) · a separate visual design playground (deferred to M3; Studio treats UI code as code and surfaces preview-deploy links in the PR tab when CI provides them).

## Success criteria

1. **Agent door:** dispatch from an approved PRD → plan → repo reads → multi-file changeset → commit to `studio/*` branch (confirm) → multi-file PR (confirm) → CI read → merge gate (review) → structured outcome + lineage. Proven against the live demo repo.
2. **Human door:** NL-prompt a session, watch steps live, review Monaco diffs, steer mid-session, clear gates. Playwright walkthrough proof.
3. `bun run lint` (changed files), `tsc`, `bun run build` green; doc closure in the same unit of work.
4. Demo inclusion only after golden-path QA passes (ruling 2026-06-12).
