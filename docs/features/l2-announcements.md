# L2 — Customer announcements (backend + approval-to-publish governance)

> Status · ◐ Backend + governance shipped 2026-06-21 (lane 3); live on the founder's next publish (migration applies then). Public route + UI deferred to L2b. · Route(s): none yet (server functions + DB) · Owner: the Launch lane

## What it does

Lets a workspace publish customer-facing **announcements** through a governed lifecycle: any member drafts an announcement and submits it for approval; only a workspace **owner/admin** can publish it; once published it is **publicly readable** (the future public page), while drafts and pending items are never visible outside the workspace. This increment ships the **backend + the governance**: the table, the row-level security, the approval state machine, the publish RPC, and the authenticated server functions. The public read route + the authoring UI are deferred to L2b.

## Why it exists

"Customer pages / announcements" (board item L2) is the M2 launch surface for telling users what shipped. The defensible part is the **approval-to-publish governance** (you cannot accidentally publish a draft, and only owners/admins can publish), so that is built first and enforced at the database layer, not just the UI.

## Where to find it

- **`src/lib/announcements.ts`** (pure, no IO): the `AnnouncementStatus` + `WorkspaceRole` types, `applyTransition` (the `draft -> pending -> published` state machine + which role may perform each), `isPubliclyVisible`, and `generateSlug` / `isValidSlug`. The single shared governance rule.
- **`supabase/migrations/20260621200000_l2_announcements.sql`**: the `announcements` table, the RLS policies, and the `publish_announcement` RPC.
- **`src/lib/announcements.functions.ts`**: `listAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `submitForApproval`, `approveAndPublish`.

## How it works

- **Two-layer governance (cannot drift).** The pure `applyTransition` is the rule the server functions validate against; the **same** rule is enforced again at the DB. Contribution is role-gated at BOTH layers: a read-only **viewer** cannot draft, edit, or submit — `submitForApproval` rejects a viewer via `applyTransition`, and the insert/update RLS policies gate on `has_workspace_role(workspace_id, ['owner','admin','member'])`, so the database refuses a viewer write even through a direct PostgREST call. Publishing is owner/admin-only: `approveAndPublish` calls the `publish_announcement` SECURITY DEFINER RPC, which re-checks `can_manage_workspace` inside the transaction and requires the row to be `pending` — so publishing is owner/admin-gated at the database even if the app guard were bypassed.
- **Draft-safety is structural.** Two SELECT policies OR together: members read their own workspace's rows (all statuses, via `is_workspace_member`); the public/anon read policy carries `status = 'published'` IN the policy. Anon has no `auth.uid()`, so it never matches the member policy, and the published-only predicate means a draft/pending row can never be exposed publicly regardless of an application-layer mistake.
- **Members cannot self-publish.** The member UPDATE policy's `with check` restricts the new status to `draft`/`pending`, so a plain update can never flip a row to `published`; only the SECURITY DEFINER RPC writes that status.
- **Slug.** Generated at draft creation from the title plus a uuid-fragment entropy (the pure module owns generation + validation), stored once, `unique`.

## Governance & guardrails

- Workspace-scoped (`workspace_id` FK, `ON DELETE CASCADE`); RLS-gated reads/writes; publish is owner/admin-only and DB-enforced.
- Public exposure is published-only and structural (the predicate is in the RLS policy).
- The pure module is total (no throw) and unit-tested, so the governance rule is verifiable offline.

## Deferred (L2b / later)

- **Public read + route:** a `getPublic(slug)` server function on the anon client + a public route (`/p/...` or `/a/$slug`) — deferred to avoid touching the generated `routeTree.gen.ts` and the design pass. The DB already enforces published-only public reads.
- **Authoring/approval UI** (list, editor, the approve action) in the authenticated shell.
- **Column-immutability + transition-guard trigger** (a `BEFORE UPDATE` trigger rejecting `pending -> draft` reverse transitions and changes to `workspace_id`/`created_by`/`slug`). These are bounded soft edges today (a member can only move a row between workspaces they already belong to, and the publish gate + draft-safety are unaffected); the trigger would make the DB fully mirror `applyTransition`.
- Scheduled/expiring announcements, categories, per-announcement audience.

## Verification checklist

- [x] `bunx tsc --noEmit` clean; `bun test` green (`src/lib/announcements.test.ts`, 12 cases: the full transition matrix incl. role gating + reverse/no-op rejection, public-visibility, slug generation/validation/bounds). Build "red" is the known pre-existing Lovable vite-config ESM baseline, not this change.
- [x] Adversarial review (security/RLS draft-safety + correctness/governance).
- [ ] On the founder's next publish (migration applies): dry-run-verify that anon cannot SELECT a draft/pending row; that a member cannot flip a row to `published` via a plain update; that `publish_announcement` rejects a non-owner/admin caller and a non-pending row; that the member create/update/submit path works.
