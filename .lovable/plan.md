## Execution plan: A → C → B

### A. Close FND-RUNTIME 0.9 (forced-restart proof)

Goal: flip foundation row to ☑ by proving a mission survives a worker restart mid-step.

1. **Read state** — `architecture/runtime.md`, `architecture/orchestration.md`, `docs/foundation-audit.md` (FND-RUNTIME row), and `src/lib/ai/loop.server.ts` to confirm checkpoint shape + resume entrypoint.
2. **Write the playbook** — new file `docs/playbooks/fnd-runtime-0.9-forced-restart.md`:
   - Prereqs (workspace, demo login, which mission to run)
   - 5-min operator steps (start mission → observe checkpoint → force restart → observe resume → assert final state)
   - Pass/fail criteria + where to look (trace ID, DB checkpoint row, logs)
3. **Verify gaps** — if loop/checkpoint code is missing anything the playbook needs (e.g. resume endpoint, idempotent step replay, checkpoint row write), add the minimum patch. No new features beyond what the proof requires.
4. **Run it once** myself via `stack_modern--invoke-server-function` + log inspection to confirm the playbook is executable end-to-end. If a real worker-kill isn't reproducible from here, stop at "operator-runnable" and mark the audit row ◑→☑ contingent on operator run.
5. **Close the loop** — flip FND-RUNTIME 0.9 in `foundation-audit.md`; update `feature-backlog.md` Live status board + Recent log; append `plan.md` §4 line; cross-link playbook from `architecture/runtime.md`.

### C. v3 audit triage → backlog F-IDs

Goal: graduate REC-01..22 + LANG-01..10 + TOOLTIP-DEL/REW + LANG-IA-12 + LANG-NEW-OUTCOME + LANG-CHIP into addressable backlog entries other tools can pick up.

1. **Re-read** both audits: `docs/strategy/v3-audit-2026-06-06.md` and `docs/strategy/v3-audit-language-2026-06-06.md`.
2. **Score each rec** — Keep / Defer / Drop, with one-line rationale. Decide owner (Lovable / Claude Code / Antigravity / any).
3. **Mint F-IDs** in `docs/feature-backlog.md` for every "Keep" — minimal entry: ID, title, source rec, owner, P0/P1/P2, link back to audit.
4. **Update Build-order rollup** — slot the new F-IDs into the right step (most land in step 1 cross-cutting or step 2 polish).
5. **Close the loop** — Live status board: clear triage from "Next up", add the new top-priority F-ID; Recent log + `plan.md` §4 line; mark the audit doc's "Headline ask" sections as triaged with date.

### B. Proof Platform v1.1 bundles 10–12 (Ship · Launch · Support→Learn)

Goal: complete the proof platform across the lifecycle right-half. Also satisfies REC-07 + LANG-NEW-OUTCOME.

1. **Read** the existing v1.1 contract — find where bundles 1–9 live (likely `src/lib/proof/*` + a route under `_authenticated.*`), confirm shape of a "bundle" before adding three more.
2. **Bundle 10 (Ship)** — proof artifact + UI surface for ship events (PR merged, deploy succeeded, release notes generated). Wire to existing trace/event source; no new agent logic.
3. **Bundle 11 (Launch)** — proof artifact for launch/GTM moment (announcement drafted, channels posted, metrics baseline captured).
4. **Bundle 12 (Support→Learn)** — proof artifact closing the loop from support signal → re-scored opportunity in Discovery. This is the loop-closer.
5. **Verify** each bundle in preview: real data, no mocks, matches `design.md` AI-message contract.
6. **Close the loop** — flip each bundle in `feature-backlog.md`; Recent log; `plan.md` §4; update `architecture/runtime.md` or `frontend.md` only if the contract changed.

### Cross-cutting discipline (applies to all three)

- Create `active-task.md` at each phase boundary with the live sub-step checklist; delete when the phase ships.
- Set Live status board "Now building" before code, clear it before pausing.
- One commit per coherent step with a one-line WHY.
- No new tokens/hex literals; no native browser chrome (`useConfirm`/`usePrompt` only); voice anchor + length budgets; no em/en dashes.
- Pause and ask before: schema changes that aren't strictly needed; touching `nango/` boundary; any AI-call path that bypasses `runtime.server.ts`.

### Handoff between A → C → B

- After A ships, I'll post a one-line status and start C without re-asking, unless A surfaces something that changes priority (e.g. C reveals a P0 that should jump the queue).
- Same for C → B.
- If any phase exceeds ~90 min of in-flight work without a clear close, I'll stop, leave `active-task.md` true, and surface the blocker.
