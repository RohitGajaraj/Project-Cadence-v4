# L2 — Customer announcements (backend + approval-to-publish governance)

> Status · ✅ Feature-complete 2026-06-22 (Lane 2). Backend + governance shipped 2026-06-21 (lane 3) and **live-verified on prod 2026-06-22 (lane 2, no drift)**; the **public announcement page shipped 2026-06-22 (lane 2)** on `/p/$slug`; the **in-app authoring UI (L2b-2) shipped 2026-06-22 (lane 2)** on Product > Releases. Only remaining is the visual live-render of the new authoring UI on the founder's next publish (standard for freshly-built UI). · Route(s): `/product?tab=releases` (authoring) · `/p/$slug` (public read; shared with prototype shares) · Owner: the Launch lane

## What it does

Lets a workspace publish customer-facing **announcements** through a governed lifecycle: any member drafts an announcement and submits it for approval; only a workspace **owner/admin** can publish it; once published it is **publicly readable** (the future public page), while drafts and pending items are never visible outside the workspace. This increment ships the **backend + the governance**: the table, the row-level security, the approval state machine, the publish RPC, and the authenticated server functions. The public read route + the authoring UI are deferred to L2b.

## Why it exists

"Customer pages / announcements" (board item L2) is the M2 launch surface for telling users what shipped. The defensible part is the **approval-to-publish governance** (you cannot accidentally publish a draft, and only owners/admins can publish), so that is built first and enforced at the database layer, not just the UI.

## Where to find it

- **`src/lib/announcements.ts`** (pure, no IO): the `AnnouncementStatus` + `WorkspaceRole` types, `applyTransition` (the `draft -> pending -> published` state machine + which role may perform each), `isPubliclyVisible`, and `generateSlug` / `isValidSlug`. The single shared governance rule.
- **`supabase/migrations/20260621200000_l2_announcements.sql`**: the `announcements` table, the RLS policies, and the `publish_announcement` RPC.
- **`src/lib/announcements.functions.ts`**: `listAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `submitForApproval`, `approveAndPublish`.
- **`src/routes/p.$slug.tsx`** (L2b public page): resolves a slug to a public prototype share OR, on miss, a `status='published'` announcement, rendering a calm reader layout. Reuses the existing public route (no new file = no `routeTree.gen.ts` churn). The pure `publicAnnouncementView(row)` in `announcements.ts` is the third published-only guard (after the RLS policy and the query filter).
- **`src/components/product/AnnouncementsManager.tsx`** (L2b-2 authoring UI): the in-app list/create/edit/submit/publish surface, rendered on the **Product > Releases** tab (the "Ship" station per the `home-and-today-ia` rubric). Wires the existing server fns; role gates (New/Submit for owner/admin/member, Publish for owner/admin, viewer read-only) are derived from the SAME `TRANSITION_ROLES` table the DB mirrors, so the UI and DB cannot disagree — and the gate is UX-only defense-in-depth (the publish RPC + RLS are the real enforcement). Published rows link to `/p/<slug>`. Wired in `src/routes/_authenticated.product.tsx` (existing route → no `routeTree.gen.ts` churn).

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

- ~~**Public read + route:**~~ **SHIPPED 2026-06-22 (lane 2)** — the published-announcement page renders on the existing `/p/$slug` route via a client-side anon read (the RLS published-only policy gates it; no separate anon server fn needed), guarded a third time by the pure `publicAnnouncementView`. A draft/pending row can never render.
- ~~**Authoring/approval UI (L2b-2)**~~ **SHIPPED 2026-06-22 (Lane 2)** — `AnnouncementsManager` on the Product > Releases tab: list (newest-first, status chips), create-draft composer, inline edit of draft/pending, submit-for-approval, and the owner/admin publish action, plus a View link to the public page for published rows. Wires the existing `announcements.functions.ts` fns onto the existing `/product` route (no new route / `routeTree.gen.ts` churn). Announcements are now authored from a product surface, not only the server functions.
- **Column-immutability + transition-guard trigger** (a `BEFORE UPDATE` trigger rejecting `pending -> draft` reverse transitions and changes to `workspace_id`/`created_by`/`slug`). These are bounded soft edges today (a member can only move a row between workspaces they already belong to, and the publish gate + draft-safety are unaffected); the trigger would make the DB fully mirror `applyTransition`.
- Scheduled/expiring announcements, categories, per-announcement audience.

## Verification checklist

- [x] `bunx tsc --noEmit` clean; `bun test` green (`src/lib/announcements.test.ts`, 17 cases: the full transition matrix incl. role gating + reverse/no-op rejection, public-visibility, slug generation/validation/bounds; 947 in the full suite). Build "red" is the known pre-existing Lovable vite-config ESM baseline, not this change.
- [x] Adversarial review (security/RLS draft-safety + correctness/governance; the L2b-2 UI got a 2-lens governance + React-runtime adversarial pass).
- [x] Backend live-verified on prod 2026-06-22 (Lane 2): the `announcements` table is RLS-on with all 4 policies + the publish RPC exactly as source; anon SELECT is `status='published'`-only; the member UPDATE with-check forbids self-publish; `publish_announcement` is SECURITY DEFINER + anon_exec=false. Table is queryable (0 rows), so the authoring surface renders its empty state cleanly.
- [ ] On the founder's next publish: visual-verify the authoring UI renders on Product > Releases (owner sees New/Submit/Publish; create→submit→publish round-trip; the published row's View link opens `/p/<slug>`). The server fns + governance are already live-verified; this is the new component's render check.
