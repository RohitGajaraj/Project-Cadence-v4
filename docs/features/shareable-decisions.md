# F-V6-SHARE: Shareable decision links (the viral loop)

> Status · Shipped 2026-06-14 (migration `20260614170000` applies on next Lovable sync) · Route `/d/$slug` (public) · Owner: the operator (you make the call; the link carries it)

## What it does

Any decision in Knowledge → Decisions can be made public and shared via a read-only link `/<origin>/d/<share_slug>`. The public page shows just the decision: its title, the "why" (rationale), its status, who made the call (in the five-agent vocabulary), and the date, wrapped in a "Made with Cadence" frame with a quiet CTA. It is the §7 growth loop: the reasoning behind a product call travels, carrying the brand.

## Why it exists

v6 §7 names a shareable decision link as the viral mechanism: proof of the swarm's work that an operator can post. The decision plus its rationale is the most self-contained, brand-safe artifact to share. See [`../../plan.md`](../../plan.md) §4 (2026-06-14 · viral loop).

## Where to find it

- **Make one:** Knowledge → Decisions → open a decision → **Share** (top-right of the detail). Sharing makes it public and copies the link; **Copy link** / **Unshare** appear once public.
- **The public page:** `/d/<share_slug>`. Works with no login, on any device.

## Demo script (≤ 90s)

1. Knowledge → Decisions → open any decision.
2. Click **Share**, the link copies to your clipboard and the control flips to **Copy link · Unshare**.
3. Paste the link in a private/incognito window (no session). The decision renders read-only with "Made with Cadence".
4. Paste it into Slack/X. The preview shows the decision title + rationale (dynamic OG tags).
5. Click **Unshare**, reload the public link. It now reads "private or no longer valid".

## How it works

- **Schema** (`supabase/migrations/20260614170000_p3_decisions_share.sql`): `decisions` gains `share_slug` (a unique CSPRNG `gen_random_uuid` 32-hex token, backfilled) + `is_public` (default false). Anon read is gated at the DB wire: a COLUMN-scoped `GRANT SELECT (safe cols) … TO anon` + an RLS policy `FOR SELECT TO anon USING (is_public = true)` + `decisions` dropped from the Realtime publication; owner RLS is unchanged.
- **Server fns** (`src/lib/decisions-share.functions.ts`): `setDecisionShared` / `getDecisionShareState` (authed; RLS guarantees ownership; pre-migration tolerant) and `getPublicDecision` (PUBLIC, no auth), the read behind the route.
- **Public route** (`src/routes/d.$slug.tsx`): SSR loader → `getPublicDecision` → dynamic `head()` (og:title = the decision, og:description = the rationale snippet; static brand og:image). The app's first per-route dynamic-meta page.
- **Share UI** (`src/components/knowledge/DecisionDetail.tsx`): the `ShareDecisionButton` in the detail header.
- **Per-IP rate limit** (`src/lib/decisions-ratelimit.server.ts` + migration `20260616190000_p3_public_decision_ratelimit.sql`): `getPublicDecision` runs a per-IP guard *before* the read. 600 reads / 1-hour rolling window per client IP (a service-role `public_decision_rate_limits` table, the same rolling-window shape as KI-10's ingest limiter). The IP key is `cf-connecting-ip` (Cloudflare-set, unspoofable on the Workers deploy; `x-forwarded-for`/`x-real-ip` are dev fallbacks). The pure window/limit policy (`decidePublicReadRateLimit`) is unit-tested; the wrapper **fails open** on any DB error.

## Governance & guardrails

- **Private by default.** A decision is shared only when its owner explicitly toggles it.
- **Anonymous-read is the app's first public surface**, gated at the DATABASE WIRE, not in app code (the anon key ships in the browser bundle, so a direct PostgREST call bypasses any app-side projection). Three DB-enforced gates: a COLUMN-scoped anon grant (only the 7 safe columns; `user_id`/`workspace_id`/`*_id` are never granted, so a `?select=user_id` probe is denied), an RLS policy scoped `TO anon` (`is_public = true`, so it can't widen authenticated reads), and `decisions` removed from the Realtime publication. `getPublicDecision` additionally projects only `{title, rationale, status, decided_by_agent_slug, created_at}` with NO joins.
- **Revocable.** Unshare flips `is_public` back to false; the public link immediately reads "private".

## Verification checklist

- After the migration applies: open a decision → **Share** → paste the link in an incognito window → the decision renders; the network response carries only the safe fields (no `user_id`/`workspace_id`/linked ids).
- **Unshare** → the public link reads "private or no longer valid".
- A random/guessed `/d/<slug>` → "private or not found" (no enumeration leak of private decisions).
- `bun run build` green; the `/d/$slug` route is registered.
- Rate limit (after the migration applies): a normal share-link open succeeds; hammering one shared link from a single IP past 600 reads/hour returns the "not available" page until the window rolls over. `bun test src/lib/decisions-ratelimit.test.ts` covers the policy edges.

## Known limits / out of scope

- **OG image is the static brand card** (no per-decision generated image yet).
- **Rate limiting is now in place** (per-IP, see "How it works"). It is anti-DoS, not anti-enumeration (slugs are unguessable), and a botnet rotating real IPs is out of scope; the budgets/kill-switch + Cloudflare remain the backstop for that.
- **Until the next Lovable sync** applies the migration, the Share control shows "share · after sync" and the public route returns "not available", by design (pre-migration tolerant).
- No attribution (owner/workspace name) on the public page, deliberately omitted for privacy; an opt-in "show my name" is a future enhancement.

## Related

- [`../../plan.md`](../../plan.md) §4: build log entry
- [`../strategy/v6-agentic-product-os-2026-06-13.md`](../strategy/v6-agentic-product-os-2026-06-13.md) §7: the viral loop in the GTM plan
- `src/routes/p.$slug.tsx`: the prototype-share pattern this mirrors
