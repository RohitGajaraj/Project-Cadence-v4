# Shareable public links (the viral loop): decisions (/d) + teardowns (/t)

> _Created: 2026-06-14 · Last updated: 2026-06-19_

> Status · Decision links `/d/$slug` shipped 2026-06-14 (migration `20260614170000`) · Teardown links `/t/$slug` shipped 2026-06-17 (migration `20260617130000`) · Both migrations apply on next Lovable sync · Owner: the operator (you make the call / name the feature; the link carries it)

Cadence ships two public, read-only share surfaces that turn the swarm's reasoning into a brand-carrying artifact an operator can post: **decision links** (`/d/<share_slug>`) and **Critic-teardown links** (`/t/<share_slug>`). Both are the §7 / wedge growth loop: the reasoning behind a product call travels, carrying the brand. They are deliberately built to the same shape and security model; the teardown link (`/t`) mirrors the decision link (`/d`).

---

## Security model + rate limit (shared by /d and /t)

Both share surfaces use one identical security posture. This is the app's first public surface, and the rules below apply to both routes.

- **Private by default.** A decision or teardown is shared only when its owner/operator explicitly toggles it.
- **Anonymous-read is gated at the DATABASE WIRE, not in app code.** The anon key ships in the browser bundle, so a direct PostgREST call would bypass any app-side projection. Three DB-enforced gates protect both surfaces:
  1. A COLUMN-scoped anon grant (`GRANT SELECT (safe cols) … TO anon`) exposing only the safe columns; `user_id`/`workspace_id`/`*_id` (and, for teardowns, `project_id`/problem/target_user/hypothesis) are never granted, so a `?select=user_id` probe is denied.
  2. An RLS policy scoped `TO anon` (`FOR SELECT TO anon USING (is_public = true)`), so it cannot widen authenticated reads.
  3. The table (`decisions` / `opportunities`) removed from the Realtime publication.
  Owner RLS is unchanged in both cases. The public server read additionally projects only the safe fields with NO joins (per-surface column lists below).
- **Revocable.** Unshare flips `is_public` back to false; the public link immediately reads "private".
- **Per-IP rate limit (one shared bucket across /d and /t):** the public read runs a per-IP guard *before* the read. 600 reads / 1-hour rolling window per client IP. Implemented in `src/lib/decisions-ratelimit.server.ts` + migration `20260616190000_p3_public_decision_ratelimit.sql` (a service-role `public_decision_rate_limits` table, the same rolling-window shape as KI-10's ingest limiter). The IP key is `cf-connecting-ip` (Cloudflare-set, unspoofable on the Workers deploy; `x-forwarded-for`/`x-real-ip` are dev fallbacks). The pure window/limit policy (`decidePublicReadRateLimit`) is unit-tested; the wrapper **fails open** on any DB error. The shared bucket (same limiter across `/d` and `/t`) is acceptable: it is more conservative anti-DoS, not anti-enumeration (slugs are unguessable). A botnet rotating real IPs is out of scope; the budgets/kill-switch + Cloudflare remain the backstop for that.
- **Slug shape (both):** `share_slug` is a unique CSPRNG `gen_random_uuid` 32-hex token, backfilled, plus `is_public` (default false).
- **Pre-migration tolerance (both):** until the next Lovable sync applies the migration, the Share control shows "share · after sync" and the public route returns "not available", by design (the authed share-state and toggle server fns are pre-migration tolerant).
- **OG image (both):** the static brand card (no per-decision / per-teardown generated image yet).
- **Verification (both):** `bun run build` green and the public route registered; a normal share-link open succeeds; hammering one shared link from a single IP past 600 reads/hour returns the "not available" page until the window rolls over.

---

## Decision links (/d)

### What it does

Any decision in Knowledge → Decisions can be made public and shared via a read-only link `/<origin>/d/<share_slug>`. The public page shows just the decision: its title, the "why" (rationale), its status, who made the call (in the five-agent vocabulary), and the date, wrapped in a "Made with Cadence" frame with a quiet CTA. The decision plus its rationale is the most self-contained, brand-safe artifact to share.

### Why it exists

v6 §7 names a shareable decision link as the viral mechanism: proof of the swarm's work that an operator can post. See [`../../plan.md`](../../plan.md) §4 (2026-06-14 · viral loop).

### Where to find it

- **Make one:** Knowledge → Decisions → open a decision → **Share** (top-right of the detail). Sharing makes it public and copies the link; **Copy link** / **Unshare** appear once public.
- **The public page:** `/d/<share_slug>`. Works with no login, on any device.

### Demo script (≤ 90s)

1. Knowledge → Decisions → open any decision.
2. Click **Share**, the link copies to your clipboard and the control flips to **Copy link · Unshare**.
3. Paste the link in a private/incognito window (no session). The decision renders read-only with "Made with Cadence".
4. Paste it into Slack/X. The preview shows the decision title + rationale (dynamic OG tags).
5. Click **Unshare**, reload the public link. It now reads "private or no longer valid".

### How it works (unique wiring)

- **Schema** (`supabase/migrations/20260614170000_p3_decisions_share.sql`): `decisions` gains `share_slug` + `is_public`. Anon read is gated at the DB wire (see the shared Security model); the COLUMN-scoped grant exposes the 7 safe columns (`title`, `rationale`, `status`, `decided_by_agent_slug`, `created_at`, plus `is_public`, `share_slug`).
- **Server fns** (`src/lib/decisions-share.functions.ts`): `setDecisionShared` / `getDecisionShareState` (authed; RLS guarantees ownership; pre-migration tolerant) and `getPublicDecision` (PUBLIC, no auth), the read behind the route. `getPublicDecision` projects only `{title, rationale, status, decided_by_agent_slug, created_at}` with NO joins.
- **Public route** (`src/routes/d.$slug.tsx`): SSR loader → `getPublicDecision` → dynamic `head()` (og:title = the decision, og:description = the rationale snippet; static brand og:image). The app's first per-route dynamic-meta page.
- **Share UI** (`src/components/knowledge/DecisionDetail.tsx`): the `ShareDecisionButton` in the detail header.
- **Rate limit:** see the shared Security model + rate limit section above.

### Verification checklist

- After the migration applies: open a decision → **Share** → paste the link in an incognito window → the decision renders; the network response carries only the safe fields (no `user_id`/`workspace_id`/linked ids).
- **Unshare** → the public link reads "private or no longer valid".
- A random/guessed `/d/<slug>` → "private or not found" (no enumeration leak of private decisions).
- `bun run build` green; the `/d/$slug` route is registered.
- Rate limit (after the migration applies): a normal share-link open succeeds; hammering one shared link from a single IP past 600 reads/hour returns the "not available" page until the window rolls over. `bun test src/lib/decisions-ratelimit.test.ts` covers the policy edges.

### Known limits / out of scope

- **OG image is the static brand card** (no per-decision generated image yet).
- **Rate limiting is in place** (per-IP, shared bucket - see Security model). It is anti-DoS, not anti-enumeration (slugs are unguessable), and a botnet rotating real IPs is out of scope.
- **Until the next Lovable sync** applies the migration, the Share control shows "share · after sync" and the public route returns "not available", by design (pre-migration tolerant).
- No attribution (owner/workspace name) on the public page, deliberately omitted for privacy; an opt-in "show my name" is a future enhancement.

---

## Teardown links (/t)

### What it does

Any WEDGE Critic-teardown result in Today can be made public and shared via a read-only link `/t/<share_slug>`. The public page shows the verdict (Ship / Revise / Kill) with its summary, plus three sections: **Risks**, **What would kill it**, and **What you cannot prove yet**, wrapped in a "Made with Cadence" frame with a quiet CTA. The teardown is Cadence's sharpest brand artifact - evidence-backed reasoning that a PM believed in something, then got an honest red-team.

### Why it exists

The wedge (WEDGE / v9-wedge) names the Critic-teardown as the launch artifact and acquisition hook. A PM posts "here's the feature I believe in, here's the honest adversarial red-team" - the reasoning travels. Strategy canon: [`v9-decision-wedge-and-build-next`](../strategy/v9-decision-wedge-and-build-next.md) (the wedge as acquisition), [`v10-master-blueprint`](../strategy/v10-master-blueprint.md) §16 (monetize & growth lane).

### Where to find it

- **Make one:** Today → the "See why your idea might be wrong" WEDGE card → type an idea → **Run the teardown** → once the verdict lands, click **Share** (in the footer, first icon). Sharing makes it public and copies the link; **Copy link** / **Unshare** appear once public.
- **The public page:** `/t/<share_slug>`. Works with no login, on any device.

### Demo script (≤ 90s)

1. On Today (cold-start or anytime), find the WEDGE teardown card.
2. Type an idea (e.g. "Add an AI summary to the top of every report"), optionally add the problem and target user.
3. Click **Run the teardown**. Wait ~a minute for the Critic verdict (Ship / Revise / Kill) to land.
4. Once the verdict appears, click **Share** (footer, first icon). The link copies to your clipboard and the button flips to **Copy link · Unshare**.
5. Paste the link in a private/incognito window (no session). The verdict renders read-only with "Made with Cadence".
6. Paste it into Slack/X. The preview shows the idea title + verdict + summary snippet (dynamic OG tags).
7. Click **Unshare**, reload the public link. It now reads "private or no longer valid".

### How it works (unique wiring)

- **Schema** (`supabase/migrations/20260617130000_fshare_teardown_opportunity_share.sql`): `opportunities` gains `share_slug` + `is_public`, mirroring the shareable-decisions schema. Anon read is gated at the DB wire (see the shared Security model); the COLUMN-scoped grant exposes the safe cols (`title`, `critic_review`, `created_at`, `is_public`, `share_slug`; never `user_id`/`workspace_id`/`project_id`/problem/target_user/hypothesis).
- **Server fns** (`src/lib/opportunities-share.functions.ts`): `setTeardownShared` / `getTeardownShareState` (authed; RLS guarantees ownership; pre-migration tolerant) and `getPublicTeardown` (PUBLIC, no auth), the read behind the route. `getPublicTeardown` projects `{title, verdict, summary, risks, kill_criteria, missing_evidence, confidence, created_at}` with NO joins.
- **Critic-review JSONB safety:** `getPublicTeardown` validates the untyped `critic_review` jsonb: checks verdict ∈ {ship|revise|kill}, coerces arrays (risks/kill_criteria/missing_evidence), clamps confidence to [0,1], returns null if absent/malformed (→ "not available" on the public page).
- **Public route** (`src/routes/t.$slug.tsx`): SSR loader → `getPublicTeardown` → dynamic `head()` (og:title = verdict + idea, og:description = verdict + summary snippet; static brand og:image). Mirrors the `/d/$slug` pattern.
- **Share UI** (`src/components/today/WedgeTeardown.tsx`): the `ShareTeardownButton` in the teardown result footer (mirrors `ShareDecisionButton`).
- **Rate limit:** reuses the shared per-IP limiter (`src/lib/decisions-ratelimit.server.ts` + migration `20260616190000_p3_public_decision_ratelimit.sql`); `getPublicTeardown` runs the same guard before the read. See the shared Security model + rate limit section above.

### Verification checklist

- After the migration applies: on Today, run a teardown → **Share** → paste the link in an incognito window → the verdict renders; the network response carries only the safe fields (no `user_id`/`workspace_id`/linked ids).
- **Unshare** → the public link reads "private or no longer valid".
- A random/guessed `/t/<slug>` → "private or not found" (no enumeration leak of private teardowns).
- `bun run build` green; the `/t/$slug` route is registered.
- Rate limit (after the migration applies): a normal share-link open succeeds; hammering one shared link from a single IP past 600 reads/hour returns the "not available" page until the window rolls over.

### Known limits / fast-follows

- **OG image is the static brand card** (no per-teardown generated image yet).
- **Rate limiting is shared with `/d` links** (one per-IP bucket). Acceptable trade-off (anti-DoS, not anti-enumeration).
- **Until the next Lovable sync** applies the migration, the Share control shows "share · after sync" and the public route returns "not available", by design (pre-migration tolerant).
- The teardown is revealed in full publicly. A "teaser + signup gate" curiosity-gap variant is a future growth experiment.
- The share trigger lives on the WEDGE result (first-run, viral moment). Dropping the same control onto opportunity-card verdicts (share any teardown, any time) is a natural fast-follow.

---

## Related

- [`wedge.md`](./wedge.md) - the Critic-teardown first-run the `/t` share feature hooks into.
- [`../../plan.md`](../../plan.md) §4: build log entries (decision-share viral loop 2026-06-14; teardown-share 2026-06-17).
- [`../strategy/archive/v6-agentic-product-os.md`](../strategy/archive/v6-agentic-product-os.md) §7: the viral loop in the GTM plan.
- [`../strategy/v9-decision-wedge-and-build-next.md`](../strategy/v9-decision-wedge-and-build-next.md): the wedge as acquisition.
- [`../strategy/v10-master-blueprint.md`](../strategy/v10-master-blueprint.md) §16 (monetize & growth).
- `src/routes/p.$slug.tsx`: the prototype-share pattern the `/d` loop mirrors.