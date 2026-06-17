# Auth + backend ownership runbook (leave Lovable Cloud, own Supabase + Google OAuth)

> **Status: DEFERRED, staying on Lovable Cloud for now.** Written 2026-06-17. Founder decided on
> 2026-06-17 to stay on Lovable for now and migrate later when ready, to avoid friction before the
> first demo. Keep this runbook current; execute when the founder gives the signal. This is the
> step-by-step for moving Cadence's auth and data backend off **Lovable Cloud** (Lovable's managed
> Supabase) onto **our own Supabase project + our own Google OAuth**, while optionally continuing to
> build/preview in Lovable for a few more months.
>
> **Live tax of staying (logged for the eventual go-decision):** the resilient `handle_new_user`
> auth trigger gets reverted to a fragile body every time a Lovable sync regenerates it from its
> schema model (see `supabase/migrations/20260617140000_ki13_restore_signup_resilience.sql`). Until
> we own the backend, re-verify signup and re-apply that migration after any Lovable sync that
> touches the auth trigger.

## TL;DR

We are **not** on a proprietary "Lovable auth engine." We are already on **Supabase Auth**. Lovable
Cloud is a *managed Supabase project* that Lovable provisions for us, plus a hosted OAuth broker
(`@lovable.dev/cloud-auth-js`) that runs the Google sign-in redirect and hands back a standard
Supabase session. Owning auth therefore means two small, independent moves, and it is **free** to
start.

## Why this is the right long-term call

- The app trusts only Supabase JWTs (`auth-middleware.ts` verifies with `supabase.auth.getClaims`),
  so the auth model does not change. The blast radius of leaving Lovable auth is ~3 files.
- The **only hard part of any Supabase migration is moving existing user data** (`auth.users`:
  password hashes, OAuth identities). Today we have ~0 real users, so that cost is near-zero now and
  grows with every real signup. Do it before the first demo creates real accounts.
- It de-risks the demo: infra we control cannot be broken by Lovable changing Cloud terms, pausing a
  free project, or rate-limiting mid-pitch.
- Lovable officially supports bring-your-own-Supabase, so we can keep Lovable as the builder/preview
  while our own Supabase is the single source of truth.

## What is actually wired today (repo facts, verified 2026-06-17)

| File | Role | Lovable-specific? |
| --- | --- | --- |
| `src/integrations/supabase/client.ts` | Browser Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | No (plain supabase-js) |
| `src/integrations/supabase/auth-middleware.ts` (`requireSupabaseAuth`) | Server verifies Bearer token via `supabase.auth.getClaims` | No |
| `src/integrations/supabase/auth-attacher.ts` (`attachSupabaseAuth`) | Attaches `supabase.auth.getSession()` token to server RPCs | No |
| `src/integrations/lovable/index.ts` | `createLovableAuth().signInWithOAuth('google')` then `supabase.auth.setSession(tokens)` | **Yes (the only piece)** |
| `src/routes/login.tsx:47`, `src/routes/signup.tsx:70` | Call `lovable.auth.signInWithOAuth('google')` | Import sites of the shim |

So the migration replaces the **broker** and repoints the **project**. Everything else is already
Supabase.

## The two moves

### Move 1 — Own the Supabase project (the backend)
Create our own Supabase project, run the existing `supabase/migrations/*.sql` against it (the schema
is fully reproducible from those migrations, RLS included), and repoint five env vars:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

### Move 2 — Own the Google sign-in (the OAuth broker)
Replace `lovable.auth.signInWithOAuth('google')` with native
`supabase.auth.signInWithOAuth({ provider: 'google' })` in `login.tsx` and `signup.tsx`, and retire
`src/integrations/lovable/`. This needs our **own Google OAuth credentials** (Client ID + Secret)
configured in Supabase Auth.

## Cost: $0 to start

- **Supabase free tier:** ~50,000 monthly active users for Auth, 500 MB database, 1 GB storage,
  500K edge-function invocations. One honest caveat: free projects **pause after ~7 days of
  inactivity** and cold-start on the next request (fine for build/demo). Supabase Pro is $25/month
  when we want no pausing and higher limits.
- **Google OAuth:** free.

## Lovable-specific path (verified against Lovable + Supabase docs, 2026-06-17)

- Lovable supports connecting our own Supabase via **Project settings → Integrations → Supabase →
  Connect Supabase**. When connected, Lovable manages the reserved `SUPABASE_*` env values for the
  project, so the preview/build reads our backend.
- There is **no automated transfer** of a Lovable Cloud project to our own Supabase. The schema +
  RLS are already exported with the project code (our `supabase/migrations/`), so standing up our
  own project = create project + run migrations + connect. With ~0 user data, there is nothing else
  to move.
- Connecting our own Supabase switches the project to Supabase's **native** integration, which uses
  native `supabase.auth.signInWithOAuth` rather than the Lovable Cloud broker. That is exactly Move
  2, so the two moves are done together when we flip.

## Execution checklist

### Phase 0 — Decision + accounts ([YOU], ~30 min, no code)
- [ ] Confirm go / timing.
- [ ] Create a Supabase project at supabase.com (free tier). Capture: Project URL, publishable/anon
      key, service_role key.
- [ ] Google Cloud Console → create an OAuth 2.0 Client (Web). Authorized redirect URI:
      `https://<project-ref>.supabase.co/auth/v1/callback`. Capture Client ID + Secret.
- [ ] Supabase → Authentication → Providers → Google → paste Client ID + Secret (cleaner to paste
      here directly so the secret never leaves Supabase).
- [ ] Supabase → Authentication → URL Configuration → add app origins to Site URL + Redirect URLs
      (Lovable preview URL, `http://localhost:5173`, future prod URL).

### Phase 1 — Backend stand-up ([ME])
- [ ] Run `supabase/migrations/*.sql` against the new project; confirm schema + RLS applied.
- [ ] Seed demo accounts if needed (see `demo-credentials.md`).

### Phase 2 — Code swap ([ME])
- [ ] Replace `lovable.auth.signInWithOAuth` with native `supabase.auth.signInWithOAuth` in
      `login.tsx` and `signup.tsx`.
- [ ] Remove `src/integrations/lovable/` shim and the `@lovable.dev/cloud-auth-js` dependency.
- [ ] Repoint the five `SUPABASE_*` / `VITE_SUPABASE_*` env vars (local `.env` + wrangler secrets +
      Lovable Integrations panel).

### Phase 3 — Verify ([ME], then [YOU] eyeball)
- [ ] Google sign-in → Supabase session created.
- [ ] User row exists; an authenticated server function (`requireSupabaseAuth`) succeeds.
- [ ] The "founder registers, votes first" demo step runs end to end on the new backend.
- [ ] `bun run lint` + `bun run build` green.

## Rollback
Until the old Lovable Cloud project is deleted, rollback = revert the env vars + the `login/signup`
diff. Keep the Lovable Cloud project alive (do not delete) until Phase 3 passes on the new backend.

## Sources
- Lovable: Connect to Supabase — https://docs.lovable.dev/integrations/supabase
- Lovable Cloud — https://docs.lovable.dev/integrations/cloud
- Supabase: Identifying a Lovable backend (Cloud vs Supabase) — https://supabase.com/docs/guides/troubleshooting/identify-lovable-cloud-or-supabase-backend
- Migration write-ups — https://www.staticbot.dev/deployment-guides/ai-tools/lovable-supabase-migration , https://dzone.com/articles/migration-from-lovable-cloud-to-supabase-1
