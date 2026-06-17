# F-SHARE-TEARDOWN · Shareable Critic-teardown link (active task) — IN PROGRESS

**Date:** 2026-06-17  
**Lane:** C (DECIDE) → viral loop (also G5 Monetize)  
**Status:** Claimed; building (recon done, seam confirmed tight)

> **Parked alongside:** **W6 (persona onboarding)** is built + adversarially reviewed but **not shipped** — live UI verification (partly gated on a deploy/AI key) + docs closure remain. Its claim row stays open on the dashboard. Circle back to verify + ship.

---

## What / Pain / How

**What:** Make a WEDGE Critic-teardown result publicly shareable via a read-only link (`/t/<share_slug>`), mirroring the shipped F-SHARE shareable-decision rails.

**Pain:** Growth funnel — the teardown is the most brand-carrying artifact Cadence produces ("here's the feature I believed in, here's the honest red-team"). It should travel and pull signups (the v9 decision-wedge as acquisition).

**How:** Reuse three shipped systems verbatim in shape — (1) the WEDGE teardown already persists `critic_review` jsonb on a stable `opportunities` row; (2) F-SHARE proves the anon-public-read security model (column-scoped GRANT + RLS `TO anon` + Realtime exclusion); (3) the `/d/$slug` public SSR + OG route. F-SHARE-TEARDOWN is the assembly of these onto the teardown.

**Build accept (definition of done):** From a WEDGE teardown result, the operator toggles Share → a `/t/<slug>` link copies → opening it logged-out renders the verdict + risks + kill-criteria + evidence-gaps read-only under a "Made with Cadence" frame + CTA; the anon network response carries only safe columns (no `*_id`); Unshare flips it private.

---

## Plan (mirror the F-SHARE pair)

| # | Item | File | Reuse / new |
| --- | --- | --- | --- |
| 1 | Migration: `share_slug`+`is_public` on `opportunities`, column-scoped anon GRANT (title, `critic_review`, created_at, is_public, share_slug only), RLS `FOR SELECT TO anon USING (is_public)`, drop `opportunities` from Realtime publication | `supabase/migrations/2026…_fshare_teardown_opportunity_share.sql` | mirror of `20260614170000_p3_decisions_share.sql` |
| 2 | `getTeardownShareState(id)` / `setTeardownShared(id, isPublic)` (authed, RLS-guarded, pre-migration tolerant) + `getPublicTeardown(slug)` (PUBLIC, rate-limited) | `src/lib/opportunities-share.functions.ts` | clone of `decisions-share.functions.ts` |
| 3 | Public SSR route + dynamic `head()` (og:title = idea, og:description = verdict + summary snippet) rendering the teardown read-only | `src/routes/t.$slug.tsx` | clone of `d.$slug.tsx` |
| 4 | Per-IP rate-limit guard before the public read | `src/lib/decisions-ratelimit.server.ts` | reuse (note shared IP bucket as a known limit) |
| 5 | "Share this teardown" control on the verdict (gated on `review` present) | `src/components/today/WedgeTeardown.tsx` + small `ShareTeardownButton` | mirror `ShareDecisionButton` |
| 6 | Verify in-browser (`bun run dev`) as far as local allows (toggle + copy + pre-migration "after sync" state); full anon-read confirmed on deployed app post-sync | — | — |
| 7 | Close docs: new `docs/features/shareable-teardowns.md`, dashboard → ✅, `plan.md` §4 build-log, cross-link `wedge.md` + `shareable-decisions.md` | docs | — |

---

## Design decisions (locked)

1. **Mirror, don't generalize.** Add share columns directly to `opportunities` (same as `decisions`), not a polymorphic `shares` table. The skill mandate is "mirror an existing pair."
2. **Reveal the full teardown publicly** (verdict + risks + kill-criteria + evidence-gaps), matching F-SHARE revealing full decision rationale. The "teaser + gate behind signup" curiosity-gap variant is a future growth experiment, not the first cut.
3. **Safe anon projection:** title, `critic_review` (jsonb — verdict/summary/risks/kill_criteria/missing_evidence/confidence; no PII), created_at, share_slug, is_public. Never grant `user_id`/`workspace_id`/`product_id`/`problem`/`target_user`/`hypothesis`.
4. **Pre-migration tolerant** like F-SHARE/H2/B5: share controls show "share · after sync" and the public route returns "not available" until the next Lovable sync applies the migration.
5. **Route `/t/$slug`** (verify free before creating; `/d` = decisions, `/p` = prototype).

---

## Open questions / notes

- Rate limiter currently shares one per-IP table with `/d`; acceptable (more conservative, anti-DoS). Namespacing the bucket is a trivial fast-follow if needed.
- Share trigger lives on the WedgeTeardown result for the first cut (the viral moment). Dropping the same `ShareTeardownButton` onto the opportunity-card verdict (share any teardown, any time) is the natural fast-follow.
