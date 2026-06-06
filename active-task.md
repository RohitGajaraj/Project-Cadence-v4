# Active task — P0 voice + governance batch

Approved plan: `.lovable/plan.md` (8 P0 F-IDs from v3 audit triage).

## Sub-steps

- [x] F-VOICE-LOGIN — rewrite `/login` headline + subhead
- [x] F-VOICE-AINATIVE — replace "AI-native" copy in operator UI
- [x] F-VOICE-VERSIONS — strip Phase/Bundle/Slice from operator routes
- [x] F-VOICE-EMPTY-TODAY — Today + Swarm empty states
- [x] F-VOICE-CASE — sentence-case H1s, drop serif gradients on Upcoming meetings / All tasks
- [x] F-GOV-APPROVAL-COPY — approval rows lead with consequence
- [x] F-TODAY-AUTOSEED — auto-generate Today brief on first dashboard load
- [x] F-AGENTS-ROSTER-CUT — migration to cut seeded roster from 9 → 4 (+ Orchestrator)
- [x] Doc-closure: flip F-IDs in `docs/feature-backlog.md`, log in `plan.md` §4, status board
- [x] Security fix: tighten `prompt_runs_ws_write` WITH CHECK to scope by `auth.uid()`
- [x] Delete `active-task.md` on completion

## Gotchas
- No em/en dashes in UI copy
- No native browser chrome — `useConfirm`/`usePrompt` + sonner only
- No mocks, no `runtime.server.ts` bypass
- Roster cut = data change via new migration; keep spawn pipeline untouched