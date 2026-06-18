# F-V5-INGEST-WEBHOOK — The public continuous-ingest door

**Status:** Shipped (webhook endpoint deployed 2026-06-11 · KI-10 rate limiting added 2026-06-16)  
**Unblocks:** M-0 (one live ingest source) · M-A (real data loop)  
**Related:** [`../operations/demo-credentials.md`](../operations/demo-credentials.md) (test tokens), [`../planning/archive/v7-trd-2026-06-14.md`](../planning/archive/v7-trd-2026-06-14.md) (architecture; archived, superseded by v10), [`../planning/known-issues.md`](../planning/known-issues.md) (KI-10)

---

## What it is

The public ingest webhook turns any external system (Zapier, Slack outgoing webhooks, forms, scripts, custom integrations) into signals rows inside a workspace. Signals flow through the `signals_reactor_fanout` trigger into `event_queue`, where the event-reactor processes them (the SENSE observation path).

**Entry point:** `POST /api/public/ingest-signals`  
**Auth:** Per-workspace ingest token (Bearer token or `x-ingest-token` header)  
**Payload:** Single signal `{ title, content?, source? }` or batch `{ signals: [...] }`  
**Limits:** 100 signals/hour per token (rolling window, KI-10)

---

## Architecture

```
External system (Zapier, Slack, form, script)
  ↓
  POST /api/public/ingest-signals
    ├─ Auth: Bearer token → lookup in ingest_tokens table
    ├─ Rate limit: token_id check in ingest_rate_limits table (rolling 1-hour window)
    └─ Payload: Validate { title, content?, source? } or { signals: [...] }
  ↓
  signals table (insert: user_id, workspace_id, title, content, source)
  ↓
  signals_reactor_fanout trigger
  ↓
  event_queue + event_subscriptions (signal.created events fan to all subscribers)
  ↓
  Event reactor processes SENSE observations
```

### Tables

- **`ingest_tokens`** — per-workspace bearer tokens for public webhook access (created via `rotateIngestToken()`)
- **`ingest_rate_limits`** — rolling-window request counters per token (updated on each request)
- **`signals`** — signal rows (title, content, source, workspace_id)
- **`event_queue`** — event bus (signal.created events trigger the reactor)

### Key files

- **`src/routes/api/public/ingest-signals.ts`** — the webhook handler (POST only)
- **`src/lib/ingest.functions.ts`** — token management (get, rotate, revoke)
- **`src/lib/ingest-ratelimit.server.ts`** — rate limit checker (KI-10)
- **`supabase/migrations/20260611190000_f_v5_ingest_webhook_tokens.sql`** — ingest_tokens table
- **`supabase/migrations/20260616180000_ki10_ingest_rate_limits.sql`** — ingest_rate_limits table

---

## How to use

### 1. Create or get an ingest token

As an authenticated workspace member, call `rotateIngestToken()` to mint a fresh token:

```typescript
const { token } = await rotateIngestToken();
// token = 64-char hex string, e.g. "a1b2c3d4..."
```

Or retrieve the active token:

```typescript
const { token } = await getIngestToken();
```

### 2. POST a signal

From any external system, send:

```bash
curl -X POST https://cadence-flow-beta.lovable.app/api/public/ingest-signals \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Customer complaint via Slack",
    "content": "User reports bug in Settings page navigation",
    "source": "slack-outgoing-webhook"
  }'
```

**Batch:**

```bash
curl -X POST https://cadence-flow-beta.lovable.app/api/public/ingest-signals \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "signals": [
      { "title": "Bug report #1", "source": "github-issues" },
      { "title": "Bug report #2", "source": "github-issues" }
    ]
  }'
```

### 3. Verify signals flow through

In the `/discovery` tab, you should see new signals appear in the signal list. They flow to the event-reactor and trigger SENSE observations.

---

## Rate limiting (KI-10)

**Limit:** 100 signals per 1 hour per token (rolling window)

The `checkIngestRateLimit()` function:
1. Checks if the token has an active rate-limit record
2. If the window has expired (> 1 hour old), resets the counter to 1
3. If the counter ≥ 100 in the active window, returns HTTP 429 with `Retry-After` seconds
4. Otherwise, increments the counter and allows the request

**Response format (rate limited):**

```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "retryAfterSeconds": 1800
}
```

---

## Security

- **Authentication:** Tokens are 256-bit cryptographically random (non-predictable)
- **Column-level access:** The webhook inserts only `user_id`, `workspace_id`, `title`, `content`, `source` — no other columns
- **RLS:** `ingest_tokens` and `ingest_rate_limits` are RLS-protected; unauthenticated users cannot read/modify tokens
- **Token revocation:** Tokens can be revoked via `revokeIngestToken()` (sets `revoked_at`); revoked tokens are rejected immediately
- **Rate limit enforcement:** Per-token cap prevents abuse and excessive load

---

## Testing

### Unit tests

```bash
bun test src/lib/ingest-ratelimit.test.ts
```

Tests the rate-limiting decision logic (allowed, retry-after calculation, window expiration).

### Integration test (manual)

1. Create a test workspace or use the demo workspace
2. Mint an ingest token: `rotateIngestToken()`
3. POST 5–10 signals to the webhook
4. Verify signals appear in `/discovery` within a few seconds
5. POST 150 signals rapidly to trigger rate limiting (expect 429 on excess)

### Demo account

The demo accounts (`demo@redcadence.app`, `demo2@redcadence.app`) ship with the `Demo workspace` pre-seeded. You can mint a token for the demo workspace and test the webhook:

```bash
# Get the demo token (as the demo user)
const { token } = await getIngestToken();

# Then POST a signal using that token
curl -X POST https://cadence-flow-beta.lovable.app/api/public/ingest-signals \
  -H "Authorization: Bearer $token" \
  -d '{"title": "Test signal"}'
```

---

## Known limitations

- **Realtime subscription:** The webhook is fire-and-forget; there is no webhook callback or delivery confirmation
- **Batch size:** Up to 50 signals per request (enforced by Zod validation)
- **Payload size:** Title ≤ 500 chars, content ≤ 5000 chars, source ≤ 40 chars
- **Rate limiting:** 100 signals/hour per token (can be increased if needed)

---

## Roadmap

### ✅ Done (2026-06-16)

- Webhook handler deployed and verified live
- Ingest token management (create, rotate, revoke)
- Rate limiting (KI-10) implemented and tested
- Database migrations applied

### Later (M-A and beyond)

- **Connector activation:** Wire one real OAuth connector (Slack, GitHub, etc.)
- **Second ingest source:** Deploy another connector or webhook variant
- **Observability:** Webhook request logs, error tracking, latency metrics
- **Webhook signature verification:** Optional HMAC signing for certain sources (Zapier, Slack)

---

## Related docs

- [`docs/operations/demo-credentials.md`](../operations/demo-credentials.md) — demo workspace logins
- [`docs/planning/archive/v7-trd-2026-06-14.md`](../planning/archive/v7-trd-2026-06-14.md) (archived, superseded by v10), B.4 · Connector activation
- [`docs/planning/known-issues.md`](../planning/known-issues.md) — KI-10, KI-12 (OAuth setup)
