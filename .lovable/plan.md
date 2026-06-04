## What I found

**Why the demo workspace is empty on login**

Both demo users (`demo@redcadence.app`, `demo2@redcadence.app`) exist, but each only has an empty "My Workspace" — no "Demo workspace" with seeded content.

Root cause: `public.workspaces.slug` has a global unique constraint, and the slug `'demo'` is already taken by another (older) workspace:

```
id: 0b9b2dc2-...  name: "Demo workspace"  slug: "demo"  owner: 45a746ff-...
```

`seed_demo_workspace()` hardcodes `slug => 'demo'` (line 41 of the function), so its INSERT fails with a unique-constraint violation. The credential migration wrapped the `PERFORM seed_demo_workspace(...)` call in an `EXCEPTION WHEN OTHERS` block, so the failure was swallowed silently — leaving the demo users with only the empty "My workspace" the `handle_new_user` trigger created.

## Fix plan

### 1. Repair seed + re-seed demo users (migration)
- Update `public.seed_demo_workspace(_user_id)` so the slug is unique per owner: use `'demo-' || substr(_user_id::text, 1, 8)` instead of hardcoded `'demo'`. (Keeps the slug human-ish, avoids global collisions for any future demo user too.)
- In the same migration, delete the empty `'My workspace'` rows for the two demo users (only if they have no child content) so re-seeding produces a clean state, then call `seed_demo_workspace()` for both demo user IDs.
- Verify after migration: each demo user should own a `Demo workspace` populated with the Lumen project, themes, signals, agents, missions, etc.

### 2. Document the demo credentials
Create `docs/demo-credentials.md` with:
- The two emails and shared password (`Cadence!Demo2026`)
- What each account ships with (seeded Demo workspace contents)
- Note that they're created by migration `20260604203338_*.sql` and re-seeded by the new migration
- A link from `docs/README.md` index so it's discoverable

Also add a one-line entry to `docs/feature-backlog.md` Live status board log per the closed-doc-loop rule, and a §4 line in `plan.md`.

### 3. Favicon for the published site
- Generate a small Cadence mark (the violet neural-gradient square used on the login card) at 512×512 as a PNG, plus an SVG version, and store via `lovable-assets` → `src/assets/favicon.{svg,png}.asset.json`.
- Wire it in `src/routes/__root.tsx` via the root route's `head().links`:
  - `{ rel: "icon", type: "image/svg+xml", href: favicon.svg.url }`
  - `{ rel: "icon", type: "image/png", sizes: "512x512", href: favicon.png.url }`
  - `{ rel: "apple-touch-icon", href: favicon.png.url }`
- Verify in the preview that the browser tab shows the icon.

## Technical notes

- The slug change is backward-compatible: existing rows aren't touched, only future inserts get the new pattern. The migration explicitly re-seeds the two known demo users.
- `seed_demo_workspace` is `SECURITY DEFINER` and idempotent (early-exits if a "Demo workspace" already exists for the user) — safe to call repeatedly.
- Favicon `links` go in the root route's `head()`, not a per-page route, so it applies everywhere including `/login`.
- No changes to RLS, auth flow, or any client code beyond the root-route `head()` favicon links.
