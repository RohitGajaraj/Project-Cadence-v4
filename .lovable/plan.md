## What's next

Phase B (`F-OUTCOME-SURFACE`) shipped last turn. The Live status board points unambiguously at the **P0 voice/copy + governance batch** from the v3 audit triage. These are 8 small F-IDs — most are pure copy/UI, two touch data. They're the highest-leverage next step because they make every existing surface speak the v3 thesis before we add more surfaces.

### Batch: P0 voice + governance + seed (8 F-IDs)

Bundle into one short sequence, in this order (cheapest → highest blast radius), one commit per F-ID with a WHY:

1. **F-VOICE-LOGIN** — rewrite `/login` headline + subhead to the v3 thesis ("Your product org, run by a swarm of agents…"). Pure copy in `src/routes/login.tsx` (or wherever the auth screen lives).
2. **F-VOICE-AINATIVE** — repo-wide grep/replace of `AI-native` → v3 language in operator UI + marketing meta + sidebar tagline. Keep `architecture/` and `docs/` historical refs intact.
3. **F-VOICE-VERSIONS** — strip `Phase N` / `Bundle N` / `Slice N` from `/build`, `/discovery`, `/opportunities`, `/prds`. Docs keep them.
4. **F-VOICE-EMPTY-TODAY** — rewrite Today empty state (drop "hit refresh") + Swarm empty state (drop "humming"). Voice-anchor compliant, no em/en dashes, length budgets respected.
5. **F-VOICE-CASE** — sentence-case every page H1; remove `uppercase tracking-[0.16em]` mono-labels and serif gradients on `Upcoming meetings` / `All tasks`.
6. **F-GOV-APPROVAL-COPY** — approval-gate rows lead with consequence: `Approve · <what happens> · Reject · <what rolls back>`. Touch inbox + decision queue + mission detail components.
7. **F-TODAY-AUTOSEED** — server fn change: auto-generate the Today brief on first sign-in (no operator seed click). Lives in the existing `today.functions.ts` (or equivalent) — through `runtime.server.ts` chokepoint, RLS-scoped, no new mocks.
8. **F-AGENTS-ROSTER-CUT** — data change: cut seeded roster 18 → 5 (Discovery Scout · Strategist · PRD Writer · Builder · Orchestrator). Update seed SQL + the agent roster server fn. Spawn pipeline untouched.

### Doc-closure (same turn, mandatory)

- Flip each F-ID to ☑ in `docs/feature-backlog.md` v3 triage table; update Live status board (Last updated · Recent log · Now building/Next up).
- Append one line per F-ID to `plan.md` §4 with the WHY.
- Add "How to verify" blocks to the F-IDs that ship user-visible surfaces (login, Today, approvals).
- No new convention docs needed — voice rules already live in `docs/conventions/ui-voice.md`.

### Guardrails

- No em/en dashes in UI copy; no AI-tell buzzwords; length budgets (H1 ≤ 6, subhead ≤ 14, button ≤ 3).
- Semantic tokens only — no hex literals.
- No native browser chrome — `useConfirm`/`usePrompt` + sonner only.
- No new agent logic; no `runtime.server.ts` bypass; no mocks.

### Out of scope (defer)

- P1 IA merges (`F-IA-MERGE-OBSERVE`, `F-COCKPIT-MERGE`, etc.) — bigger structural moves, separate phase.
- P2 platform depth (`F-MCP-V1`, `F-BUILDER-MULTIFILE`) — later.
- Operator-only FND-RUNTIME 0.9 forced-restart proof — only the operator can run it.

### Handoff at end

- If batch ships clean: status board "Now building" → idle, "Next up" → P1 IA merges starting with `F-IA-MERGE-OBSERVE`.
- If paused mid-batch: `active-task.md` left true with remaining F-IDs checked/unchecked.

**Estimated scope:** 8 small commits, ~60–90 min of in-flight work. Stop and surface if it exceeds that.
