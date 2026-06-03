## Goal

Two things, both lightweight:

1. **Make the governance feature self-documenting going forward** — the code-side of FND-KILLSWITCH is already logged in `docs/foundation-audit.md` §0.6 and the Live status board recent log, but there is no entry that tells a future operator (or another tool/session) *where the UI lives, what each panel does, and how to verify it*. That's the gap your question exposed.
2. **Stop re-asking me to follow the documentation loop** — promote the rules to project memory (`mem://index.md` Core) so every future Lovable session applies them automatically without you reminding me.

I won't touch product code. Docs + memory only.

---

## Changes

### A. Documentation updates (committed to git, so all tools see them)

1. **`docs/feature-backlog.md` — add a usage block under FND-KILLSWITCH (0.6)**
   New "How to use / verify" subsection covering:
   - Where to find it: `/_authenticated/governance` (sidebar → AI Ops → Governance)
   - The three panels: Kill Switch · Mission Caps · Approvals — what each controls
   - Paused-state banner in `AppShell`
   - Verification checklist (toggle pause → mission blocks; low cap → auto-halt; >24h pending → cron expires)
   - Server enforcement points: `callModel` / `callModelStream` throw `GovernanceHaltError`; cron at `/api/public/hooks/approvals-tick`

2. **`architecture/security.md`** — add a short "Governance surface" pointer (1 paragraph) that links to the backlog entry above, so the architecture doc tells readers where the user-facing controls live, not just the data model.

3. **`docs/feature-backlog.md` Live status board** — refresh "Last updated" line and add a one-liner to Recent log noting the documentation pass.

4. **`plan.md` §4 (active build log)** — append the same one-liner so the append-only history stays true (per AGENTS.md §5 closed-loop rule).

No new files; no `active-task.md` since this isn't an in-flight multi-session task.

### B. Standing instructions → project memory

Write `mem://index.md` Core rules so they auto-apply every session without you re-stating them:

- After completing any feature, update in the same turn: `docs/feature-backlog.md` Live status board + status mark, `plan.md` §4 build log, the matching `architecture/*.md` or `docs/foundation-audit.md` entry, and add a "How to use / verify" block when the feature has a user-facing surface.
- Commits to `main` only; include a one-line WHY in the message.
- Before starting work: read `active-task.md` if present, then the Live status board; pick next from the Build-order rollup.
- When pausing mid-feature: leave `active-task.md` true with remaining sub-steps; when done, delete it.
- Speak in product terms to the user ("backend", "governance page") — never expose Supabase/infra names.

These become always-in-context Core rules, so I apply them without prompting.

---

## Out of scope

- No changes to governance code, schema, or RLS.
- No new tests (governance enforcement is already covered by the runtime chokepoint).
- No rename/restructure of existing docs.

## Done when

- `docs/feature-backlog.md`, `architecture/security.md`, and `plan.md` reflect the governance UI usage + verification guide.
- Live status board "Last updated" + Recent log entry added.
- `mem://index.md` contains the standing doc-loop rules under Core.
- Single commit pushed to `main` with WHY: `docs: document FND-KILLSWITCH UI + persist doc-loop rules to memory`.
