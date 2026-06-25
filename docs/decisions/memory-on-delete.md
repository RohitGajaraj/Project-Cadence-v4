# Memory on delete — how run/session deletion interacts with the memory moat

> _Created: 2026-06-26 · Decision owner: founder + Lane 3. Status: adopted, shipped with SESSION-ORG (Build run management)._

## The question

Run management (archive / delete on a Build session) raised a real design question: **memory is our moat. If a user deletes a build, what happens to the memory derived from it?** If deletion silently cascades into the decision/outcome memory, the moat erodes every time someone tidies their list — which is unacceptable. But users also need to organize, and (eventually) genuinely forget things. So: should delete erase memory, preserve it, or should the user consciously curate memory separately?

## The decision: a three-tier model — memory is durable by default, forgetting is deliberate

1. **Archive (soft) — the safe default.** Hides a session from the Build list, fully reversible, **keeps everything** (the run, its artifacts, and all derived memory + provenance). This is the primary "stay organized" action and carries zero memory risk. Make this the easy, obvious choice.

2. **Delete (hard) — removes the working artifacts, never the learning.** Deleting a build removes its **working product** — the execution log, staged files, messages — but the **typed decision/outcome memory survives**. A build that produced a decision is like a meeting that produced a decision: deleting the recording must not delete the decision. The only thing lost is the provenance link back to the now-gone build (the decision detaches), which is the expected, conscious consequence of choosing delete over archive.

3. **Forget (separate, deliberate) — not a side effect of housekeeping.** Genuinely removing knowledge from the brain (a wrong belief, a right-to-be-forgotten request) is its own explicit, warned action — never the default, never bundled into "delete this build." This keeps memory curation a conscious choice the user owns, exactly as it should be for a memory-as-moat product. (Shipped as a future/opt-in step, off by default.)

## Why this is the right practice

- **The moat is the distilled knowledge, not the raw activity.** Decisions, outcomes, supersession, lineage are a first-class, durable layer that should **outlive** the raw artifacts they were distilled from. Coupling their lifetime to a disposable run would make the moat as fragile as a session list.
- **Durable-by-default protects the asset; explicit-forget respects agency.** Users get full control to organize (archive) and to delete clutter (delete) without ever accidentally damaging the brain, and a deliberate path to forget when they truly mean it (and for compliance).
- **It matches user mental models.** "Delete this build" should mean "remove this build," not "erase what I learned from it."

## How the schema already enforces it (verified 2026-06-26)

The FK rules on `missions(id)` already encode exactly this contract, so deletion is moat-safe at the database layer, not just the UI:

| Child of a deleted mission | `ON DELETE` rule | Meaning |
| --- | --- | --- |
| `mission_steps` | **CASCADE** | working log — removed |
| `studio_changesets` → `studio_changes` | **CASCADE** | staged files — removed |
| `agent_messages` | **CASCADE** | working chatter — removed |
| **`decisions`** | **SET NULL** | **memory moat — PRESERVED** (detaches from the build) |
| `builder_file_claims` | SET NULL | preserved/detached |

`agent_runs` has no FK to `missions`, so `deleteStudioSession` deletes the mission's runs explicitly (their checkpoints + idempotency keys cascade) to avoid orphans. Net effect of a hard delete: the build's working product is gone; **what was decided/learned remains in the Brain.**

## Implementation (SESSION-ORG)

- `missions.archived_at timestamptz` (migration `20260626000000_session_archive.sql`); the Build list filters to active by default, with a "Show archived" toggle.
- `setStudioSessionArchived` / `deleteStudioSession` server fns (`studio.functions.ts`), owner-scoped by the existing "Owners can write their missions" RLS policy.
- A three-dots menu (Archive / Unarchive / Delete) on each session row; Delete routes through a confirm dialog whose copy states plainly that **decisions stay in the Brain** and points the user to Archive for mere tidying.

## Open / future

- An explicit **"Forget from memory"** action (delete the detached decisions too), off by default, clearly warned — the deliberate tier-3 path, for compliance and genuine correction.
- Apply the same archive/delete + memory-preservation model to other deletable surfaces (PRDs, missions outside Build) so the practice is consistent platform-wide.
