# F-SHARE-TEARDOWN: Shareable Critic-teardown links (the wedge viral loop)

> Status · Shipped 2026-06-17 (migration `20260617130000` applies on next Lovable sync) · Route `/t/$slug` (public) · Owner: the operator (you name a feature; the link carries the honest red-team)

## What it does

Any WEDGE Critic-teardown result in Today can be made public and shared via a read-only link `/t/<share_slug>`. The public page shows the verdict (Ship / Revise / Kill) with its summary, plus three sections: **Risks**, **What would kill it**, and **What you cannot prove yet**, wrapped in a "Made with Cadence" frame with a quiet CTA. The teardown is Cadence's sharpest brand artifact — evidence-backed reasoning that a PM believed in something, then got an honest red-team.

## Why it exists

The wedge (WEDGE / v9-wedge) names the Critic-teardown as the launch artifact and acquisition hook. A PM posts "here's the feature I believe in, here's the honest adversarial red-team" — the reasoning travels. Strategy canon: [`v9-decision-wedge-and-build-next`](../strategy/v9-decision-wedge-and-build-next-2026-06-17.md) (the wedge as acquisition), [`v10-master-blueprint`](../strategy/v10-master-blueprint-2026-06-17.md) §16 (monetize & growth lane).

## Where to find it

- **Make one:** Today → the "See why your idea might be wrong" WEDGE card → type an idea → **Run the teardown** → once the verdict lands, click **Share** (in the footer, first icon). Sharing makes it public and copies the link; **Copy link** / **Unshare** appear once public.
- **The public page:** `/t/<share_slug>`. Works with no login, on any device.

## Demo script (≤ 90s)

1. On Today (cold-start or anytime), find the WEDGE teardown card.
2. Type an idea (e.g. "Add an AI summary to the top of every report"), optionally add the problem and target user.
3. Click **Run the teardown**. Wait ~a minute for the Critic verdict (Ship / Revise / Kill) to land.
4. Once the verdict appears, click **Share** (footer, first icon). The link copies to your clipboard and the button flips to **Copy link · Unshare**.
5. Paste the link in a private/incognito window (no session). The verdict renders read-only with "Made with Cadence".
6. Paste it into Slack/X. The preview shows the idea title + verdict + summary snippet (dynamic OG tags).
7. Click **Unshare**, reload the public link. It now reads "private or no longer valid".

## How it works

- **Schema** (`supabase/migrations/20260617130000_fshare_teardown_opportunity_share.sql`): `opportunities` gains `share_slug` (a unique CSPRNG `gen_random_uuid` 32-hex token, backfilled) + `is_public` (default false), mirroring the shareable-decisions schema. Anon read is gated at the DB wire: a COLUMN-scoped `GRANT SELECT (safe cols) … TO anon` (title, critic_review, created_at, is_public, share_slug; never `user_id`/`workspace_id`/`project_id`/problem/target_user/hypothesis) + an RLS policy `FOR SELECT TO anon USING (is_public = true)` + `opportunities` dropped from the Realtime publication; owner RLS is unchanged.
- **Server fns** (`src/lib/opportunities-share.functions.ts`): `setTeardownShared` / `getTeardownShareState` (authed; RLS guarantees ownership; pre-migration tolerant) and `getPublicTeardown` (PUBLIC, no auth), the read behind the route.
- **Public route** (`src/routes/t.$slug.tsx`): SSR loader → `getPublicTeardown` → dynamic `head()` (og:title = verdict + idea, og:description = verdict + summary snippet; static brand og:image). Mirrors the `/d/$slug` pattern.
- **Share UI** (`src/components/today/WedgeTeardown.tsx`): the `ShareTeardownButton` in the teardown result footer (mirrors `ShareDecisionButton`).
- **Per-IP rate limit** (reuses `src/lib/decisions-ratelimit.server.ts` + migration `20260616190000_p3_public_decision_ratelimit.sql`): `getPublicTeardown` runs the same per-IP guard *before* the read. 600 reads / 1-hour rolling window per client IP. The shared bucket (same limiter across `/d` and `/t`) is acceptable (more conservative anti-DoS, not anti-enumeration; slugs are unguessable).

## Governance & guardrails

- **Private by default.** A teardown is shared only when its operator explicitly toggles it.
- **Anonymous-read is at the DATABASE WIRE, not in app code** (the anon key ships in the browser bundle, so a direct PostgREST call bypasses any app-side projection). Three DB-enforced gates: a COLUMN-scoped anon grant (only safe columns; never `user_id`/`workspace_id`/`project_id`/problem/target_user), an RLS policy scoped `TO anon` (`is_public = true`), and `opportunities` removed from the Realtime publication. `getPublicTeardown` additionally projects `{title, verdict, summary, risks, kill_criteria, missing_evidence, confidence, created_at}` with NO joins.
- **Critic-review JSONB safety:** `getPublicTeardown` validates the untyped `critic_review` jsonb: checks verdict ∈ {ship|revise|kill}, coerces arrays (risks/kill_criteria/missing_evidence), clamps confidence to [0,1], returns null if absent/malformed (→ "not available" on the public page).
- **Revocable.** Unshare flips `is_public` back to false; the public link immediately reads "private".

## Verification checklist

- After the migration applies: on Today, run a teardown → **Share** → paste the link in an incognito window → the verdict renders; the network response carries only the safe fields (no `user_id`/`workspace_id`/linked ids).
- **Unshare** → the public link reads "private or no longer valid".
- A random/guessed `/t/<slug>` → "private or not found" (no enumeration leak of private teardowns).
- `bun run build` green; the `/t/$slug` route is registered.
- Rate limit (after the migration applies): a normal share-link open succeeds; hammering one shared link from a single IP past 600 reads/hour returns the "not available" page until the window rolls over.

## Known limits / fast-follows

- **OG image is the static brand card** (no per-teardown generated image yet).
- **Rate limiting is shared with `/d` links** (one per-IP bucket). Acceptable trade-off (anti-DoS, not anti-enumeration).
- **Until the next Lovable sync** applies the migration, the Share control shows "share · after sync" and the public route returns "not available", by design (pre-migration tolerant).
- The teardown is revealed in full publicly. A "teaser + signup gate" curiosity-gap variant is a future growth experiment.
- The share trigger lives on the WEDGE result (first-run, viral moment). Dropping the same control onto opportunity-card verdicts (share any teardown, any time) is a natural fast-follow.

## Related

- [`wedge.md`](./wedge.md) — the Critic-teardown first-run the share feature hooks into.
- [`shareable-decisions.md`](./shareable-decisions.md) — the `/d` viral loop this mirrors in shape and security model.
- [`../../plan.md`](../../plan.md) §4: build log entry.
- [`../strategy/v9-decision-wedge-and-build-next-2026-06-17.md`](../strategy/v9-decision-wedge-and-build-next-2026-06-17.md): the wedge as acquisition.
- [`../strategy/v10-master-blueprint-2026-06-17.md`](../strategy/v10-master-blueprint-2026-06-17.md) §16 (monetize & growth).
