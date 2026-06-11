# Known issues — live tracker

> **What this is.** The live register of open bugs, blockers, and workarounds — with stable `KI-` IDs. This is the repo's `KNOWN_ISSUES.md` (per the constitution concordance in [`../../Ai_Cofounder.md`](../../Ai_Cofounder.md)) and, until 2026-06-22, it doubles as the **M1 Golden Path demo punch list**.
>
> **Update rule.** Add a row the moment an issue is confirmed; flip status in the same commit that resolves it. An issue is not "known" until it is in this table. Standing design gaps (not bugs) stay in [`considerations.md`](./considerations.md).
>
> **Related:** [`feature-backlog.md`](./feature-backlog.md) (Live status board · Blocked/stuck), [`considerations.md`](./considerations.md) (gap register), [`foundation-audit.md`](./foundation-audit.md) (point-in-time audit), [`../operations/fnd-runtime-restart-playbook.md`](../operations/fnd-runtime-restart-playbook.md), [`../../plan.md`](../../plan.md) §4.

## Open

| ID    | Issue                                                                                                                                                          | Impact                                                                              | Unblocks when                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| KI-01 | Calendar per-user OAuth is blocked — awaiting two provider client-ID secrets (Google/Microsoft) to be set as wrangler secrets.                                  | Calendar tab of `/knowledge` can't connect per-user accounts; demo uses seeded data. | Founder provisions the two provider client IDs and sets the secrets.                                              |
| KI-02 | FND-RUNTIME durable-resume is unverified — the foundation-audit row stays amber until an operator-run kill-test proves checkpoint resume with no duplicate writes. | Long missions may not survive a worker restart; risk for live demos.                 | Operator runs [`../operations/fnd-runtime-restart-playbook.md`](../operations/fnd-runtime-restart-playbook.md). |
| KI-03 | Lovable's Knowledge field is stale — `.lovable-config.txt` was updated 2026-06-11 (constitution + read order) but takes effect only when re-pasted into Lovable Settings → Knowledge. | Lovable sessions won't see the constitution or updated read order until re-pasted.    | Founder re-pastes the file contents into Lovable Settings → Knowledge.                                            |

## Resolved

| ID    | Issue                                                                                                                                       | Resolution                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| KI-04 | `plan.md` §6 heading was corrupted — spliced mid-line into a legacy-log bullet at ~line 396, clobbering that bullet's tail.                   | 2026-06-11 — heading restored to its own line; lost tail noted inline (recoverable from git history).                  |
| KI-05 | 18 redirect stubs (root + `docs/`) pointed into the retired `project-Cadence-v3` repo via absolute `file://` links.                          | 2026-06-11 — all retargeted to live in-repo relative paths; anti-rot rule added to [`../../AGENTS.md`](../../AGENTS.md) §7. |
