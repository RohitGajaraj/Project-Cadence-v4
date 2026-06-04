## What's next

Per the Live status board and Build-order rollup, Bundle 5 (E6 Mission Graph) just shipped. The mechanical "next up" is **Bundle 6 — Discover→Define→Plan lifecycle slice + N1 `github.issue.create`** (GitHub secrets `GITHUB_TOKEN` + `GITHUB_REPO` are already staged from FND-RUNTIME 0.9, so we are unblocked).

After Bundle 6, the queue is fixed: Bundle 9 → 10 → 11 → 12 (Build/Test → Ship → Launch → Support+Learn). Bundle 12 is where the full PM lifecycle loop closes.

---

## Plan — Bundle 6: Discover→Define→Plan slice on real data

### Goal
Run the first end-to-end *lifecycle* mission on real Cadence signals and have the Plan step write a **real GitHub issue** on this repo. Closes capability claim C3 ("one governed loop") for the first three lifecycle stages.

### Scope (in)
1. **`N1 github.issue.create` tool** — agentic write tool in `src/lib/ai/tools/registry.server.ts`.
   - Mode: `confirm` (default; arc-gated like any write tool).
   - Allow-listed to the single `GITHUB_REPO` env (no arbitrary-repo writes).
   - Idempotent via caller-supplied `idempotency_key` (e.g. `prd:{prd_id}`) using the existing `withIdempotency` helper — re-execution NEVER double-creates an issue.
   - Input: `{ title, body, labels?, idempotency_key }`. Output: `{ issue_url, issue_number }`.
   - Seeded for new signups via `seed_default_agent_tools` + backfilled for every existing user in the same migration.
2. **`prd.link_issue` wiring on the happy path** — the tool already exists (shipped Bundle 2). After `github.issue.create` returns, the Strategist/Planner agent calls `prd.link_issue` with the new `issue_url` so `prds.github_issue_url` is set and the Mission Graph + PRD page surface the link.
3. **Discover→Define→Plan mission script** — a canonical operator dispatch from `/agents` ("Start as mission") that exercises:
   - Discovery Scout: `research.synthesize` over real ungrouped signals → writes a theme.
   - Strategist (PRD Writer): `prd.draft` → writes a real `prds` row in `draft`.
   - Planner: `backlog.prioritize` (re-score) + `github.issue.create` (gated) + `prd.link_issue`.
   - Handoffs use the existing `agent.handoff` tool (Bundle 4) so each hop appears in the Mission Graph (Bundle 5) with labelled edges.
4. **PRD page link-back surface** — on `/prds/$id`, if `github_issue_url` is set, show a "GitHub issue #N" link next to the title. (Tiny UI add; no new server fn.)
5. **Forced-restart verification** — restart the worker mid-mission and confirm `resumeAgentLoop` picks up from the latest checkpoint without double-billing or duplicate issue creation (validates FND-RUNTIME 0.9 end-to-end against a real write tool). This is the step-1 ◑ item still owed on the status board.
6. **Docs loop (mandatory, same commit)**:
   - Flip Live status board: *Now building → Bundle 6*, then on completion *Next up → Bundle 9 (Build+Test)*.
   - Append entry to `plan.md` §4 and `docs/feature-backlog.md` Recent log.
   - Update N1 + F1–F3 entries with verification checklist + "How to use" block (where to dispatch, what to approve, where the issue appears).
   - Cross-link from `architecture/integrations.md` (GitHub connector) and `architecture/orchestration.md` (lifecycle slice now real).

### Scope (out — explicit deferrals)
- **PR-opening (Bundle 9, I-thin / J-thin)**: `github.pr.open` + CI read. Issues only in Bundle 6.
- **Approval UI polish**: re-use the existing Decision Queue surface; no new approval UX.
- **Multi-repo writes**: single `GITHUB_REPO` only.
- **Issue updates/closes**: create-only for v1.

### Technical approach
- One small migration: register the new tool + seed/backfill for existing users (same shape as previous `seed_default_agent_tools` migrations). No new tables.
- `github.issue.create` implementation: thin `fetch` to `api.github.com/repos/{GITHUB_REPO}/issues` with the PAT; wrap the call in `withIdempotency('tool', idempotency_key, ...)`. Returns the GitHub response slice the loop needs.
- Wire into `TOOL_REGISTRY` next to existing write tools; mode `confirm`; category `write`; allow-list metadata so the registry can render its risk badge.
- Files to touch (estimate):
  - `src/lib/ai/tools/registry.server.ts` — new tool entry + handler (or a sibling `github.server.ts` helper if it grows).
  - `src/routes/_authenticated.prds.$id.tsx` — surface `github_issue_url` link.
  - New migration `supabase/migrations/<ts>_seed_github_issue_create.sql`.
  - Docs: `feature-backlog.md`, `plan.md`, `architecture/integrations.md`, `architecture/orchestration.md`.

### Success criteria (verify before declaring done)
1. From `/agents`, dispatching the Orchestrator with "Start as mission" against a real signal produces a 3-hop mission (Discovery → Strategist → Planner) visible on `/missions/$id` Mission Graph.
2. Approving the `github.issue.create` gate creates a **real GitHub issue** on the configured repo.
3. The resulting PRD row has `github_issue_url` populated; `/prds/$id` shows the link.
4. Re-running the exact same mission step (or restarting the worker mid-call) does **not** create a duplicate issue (idempotency proven).
5. The mission's Trace shows `research.synthesize → prd.draft → github.issue.create → prd.link_issue` with costs/latencies; the Mission Graph shows 3 nodes connected by 2 labelled handoff edges.
6. Status board + `plan.md` §4 + N1/F1–F3 entries all updated in the same commit.

### After Bundle 6
Pick up **Bundle 9 (Build + Test)** — `github.pr.open` against this repo + CI read into the Mission Graph. Then Bundle 10 (Ship/deploy webhook), 11 (Launch/changelog + one outbound channel), 12 (Support→Learn + Analyst re-score) — the lifecycle loop closes at Bundle 12.

---

Want me to proceed with Bundle 6 as scoped, or would you rather (a) first do the forced-restart verification on its own to harden FND-RUNTIME 0.9 before any new write tool, or (b) jump straight to Bundle 9 PR-opening (more visible end product, but skips the simpler issue-write proof point)?
