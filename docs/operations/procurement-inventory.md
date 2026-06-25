# Procurement inventory — what Cadence buys, why, what it costs

> _Created: 2026-06-25 · Owner: founder (spend decisions) + any session that adds a paid dependency._

> **The single shopping list.** Every paid / metered / vendor dependency Cadence may buy, with **what it's for, why, the cost, the vendor options, and a recommendation** — so spend decisions can be picked up cold close to demo day or go-live. This is the concrete cost companion to the **doctrine** in [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md) (which decides _whether_ a capability is BUILT / BOUGHT / INTEGRATED) and the founder-pickup list in [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) §4.

> [!IMPORTANT]
> ## STANDING RULE — keep this sheet live (founder-set 2026-06-25)
> **Whenever a build surfaces a new paid dependency, vendor choice, or spend decision — or an existing one's cost/plan changes — update THIS file in the same unit of work.** A new "we'll need to buy X" is not captured until it has a row here with: what it's for, why, the cost (with a source), the vendor options, a recommendation, and a "when to buy". This is the standing anti-surprise rule: no spend decision should be re-derived from scratch at demo/launch time. (Canonical home of this rule: [`../../AGENTS.md`](../../AGENTS.md) §5.)
>
> Pricing below was web-verified on **2026-06-25**; re-verify any figure before you actually pay (vendors reprice). Confidence + source URLs are noted per item.

---

## The headline: the demo runs at ~$0

Cadence is **model-agnostic with BYO-key**, hosted on **Lovable-managed Cloudflare Workers + Supabase**, and most commodity inputs sit on **free tiers** at demo scale. **Nothing must be bought to demo.** The only genuinely optional demo polish is a custom domain (~$10) + Lovable Pro ($25/mo, which is what unlocks a custom domain). Everything else is deferred to real usage / revenue.

### Demo-day shopping list (buy before the demo)
| Buy? | Item | Cost | Why |
| --- | --- | --- | --- |
| Optional | Lovable **Pro** plan | ~$21/mo annual (~$25/mo monthly) | Only if you want a **custom domain** for the demo (Free tier = `*.lovable.app` only) + more build credits |
| Optional | Custom domain (`.com`) via Cloudflare Registrar | ~$10.46/yr | Branded URL for the demo |
| — | Everything else | **$0** | BYO AI keys + free tiers + the $0 sandboxed-iframe preview cover the demo |

### Go-live shopping list (buy when you have users / revenue, not before)
| Trigger | Item | Cost |
| --- | --- | --- |
| Want live repo-build previews | **Cloudflare Sandbox SDK** (Workers Paid + Containers) | ~$12/mo (range $8–20) |
| First paid customer | **Stripe** (processing + Billing) | 2.9% + $0.30 per charge + 0.7% Billing; $0 until you charge |
| Email volume > free tier | **Resend Pro** | $20/mo (50k emails) |
| Ingestion > 1,000 pages/mo | **Firecrawl Hobby** | ~$16/mo annual |
| AI cost not covered by BYO keys | OpenAI/Voyage embeddings + cheap inference | ~$10–30/mo blended |

---

## Full inventory (verified 2026-06-25)

### 1. Execution sandbox / build preview — SANDBOX #23 · INTEGRATE
- **What & why:** run a build's checks + serve a **live preview of a full repo build** before merge, in an isolated microVM. Today the **$0 floor** (GitHub Actions CI + a sandboxed-iframe preview of standalone output) covers the demo; the microVM is the paid upgrade for live full-build previews and running untrusted code. Spec: [`../features/sandbox-spine.md`](../features/sandbox-spine.md).
- **Recommendation: Cloudflare Sandbox SDK (Workers Paid + Containers).** Native to our existing Cloudflare stack — no new vendor. Buy **only** when we want live previews or hit a repo-without-CI user.
- **Cost:** **~$12/mo all-in** (est.) = $5/mo Workers Paid base + ~$7 usage at ~30 builds/day on a `standard-1` instance; range **$8–20/mo**. CPU is active-only ($0.00002/vCPU-s since 2025-11-21); the cost lever is **wall-clock awake time** (memory/disk bill while a container is warm), so aggressive auto-sleep keeps it cheap. _Confidence: rates high, dollar estimate medium._
- **Alternatives:** **E2B** — $0 to start (one-time $100 credit ≈ 850 sandbox-hrs), then ~$0.117/sandbox-hr; the $150/mo Pro tier is forced by the **20-concurrent-sandbox** cap, not by cost. Firecracker-based, self-hostable. **Vercel Sandbox** — $0–15/mo at our scale, but pulls us into a Vercel account/billing despite hosting nothing else there (single-region `iad1`). **OSS floor:** self-host Firecracker/gVisor microVMs.
- **Verdict:** Cloudflare first (stack-native, cheapest integration); E2B is the strong portable second. Defer the buy; the `ExecProvider` seam makes the swap zero-rework.
- _Sources: developers.cloudflare.com/containers/pricing, e2b.dev/pricing, vercel.com/docs/sandbox/pricing._

### 2. LLM inference — BUY (via the AI chokepoint) · **already live**
- **What & why:** the agent loop + chat. Routed through `runtime.server.ts` (the chokepoint); model-agnostic with BYO-key, so an end user's own key bears the cost (vendor cost to us → $0 for BYO users). Lovable's AI gateway is the managed default.
- **Recommendation:** keep BYO-key as the default; for our own metered usage, cheapest current model is **OpenAI `gpt-4.1-nano`** ($0.10 in / $0.40 out per 1M tokens) — better on price + recency than the now-legacy `gpt-4o-mini` ($0.15/$0.60).
- **Cost:** a typical call (~2K in + 500 out) ≈ $0.0006; ~20K calls/mo ≈ **~$12/mo**. Blended with embeddings, **~$10–30/mo** for the whole pre-revenue fleet, or **~$0** under BYO. _Confidence: high._
- _Source: developers.openai.com/api/docs/pricing._

### 3. Embeddings — BUY (via the AI chokepoint) · **EMBED-CHOKEPOINT ✅ — provider decision updated 2026-06-26**
- **What & why:** vectors for the Decision Brain / RAG. The routing chokepoint is done (all 8 callers pinned); only the provider choice and API key remain.
- **Recommendation: Cohere `embed-v4`** ($0.12/1M tokens; OpenAI-compatible API; 1536 dims native — zero schema migration from current `vector(1536)`; 128K token limit handles full PRDs; EU inference region available for GDPR compliance). Full analysis + data privacy posture: [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md) — "AI inference provider analysis" section.
- **Cost:** ~$0.12 for 1M tokens (~10,000 average PRDs); **< $5/mo** at demo scale. _Confidence: high._
- **Why not Voyage AI (free 200M tokens):** voyage-3 has FIXED 1024 dims — switching from current `vector(1536)` REQUIRES a schema migration. Then switching BACK to Cohere = a second migration. The 200M free tokens saves cents at demo scale while costing 2+ hours of migration work. Also: acquired by MongoDB Feb 2025 (roadmap risk), US-only servers (GDPR risk), non-OpenAI-compatible SDK. Disqualified. Full details in BBI doc.
- **Fallback:** OpenAI `text-embedding-3-small` ($0.02/1M, same 1536 dims, already wired in `resolveEmbedRoute`). **OSS floor:** BGE-M3 (MIT) self-hosted.
- **Founder action needed:** Cohere API key → add to `.env` as `COHERE_API_KEY`; update `EMB_MODEL` in `embed.server.ts`. 30 minutes of implementation.
- _Sources: cohere.com/pricing, BBI doc (2026-06-26 research)._

### 4. Rerank — INTEGRATE (precision booster, multi-hop retrieval only) · **updated 2026-06-26**
- **What & why:** a cross-encoder rerank on the semantic-match step, gated to multi-hop / precedent retrieval. Stateless, zero switching cost.
- **Recommendation: Cohere Rerank 4** (~$0.001-0.002/search; same billing account as embed-v4; best for business/finance documents, +400 ELO over Rerank v3.5 on that category). **OSS floor:** `zerank-1-small` (Apache-2.0, 1.7B) self-hosted.
- **⚠️ ZeroEntropy zerank-2 WARNING:** zerank-2 model weights are released under a **non-commercial license (CC-BY-NC)**. Commercial use of the API requires verifying terms with ZeroEntropy directly before production use. Do NOT use zerank-2 in production without this confirmation. Use Cohere Rerank 4 as the safe production pick.
- **Cost:** **~$0–2/mo** (20-candidate rerank ≈ $0.001-0.002/call; 5,000/mo ≈ $5-10); free tier covers evaluation. _Confidence: medium (Cohere Rerank 4 PAYG pricing not fully confirmed from primary source; re-verify)._
- _Sources: cohere.com/pricing, BBI doc (2026-06-26 research)._

### 5. Payments / billing — Stripe · revenue-gated
- **What & why:** subscriptions + metered credit billing (the monetization engine is built, dormant behind `credits_enabled()`; go-live runbook: [`credit-engine-go-live.md`](./credit-engine-go-live.md)).
- **Cost:** **$0 at pre-revenue** (test mode free; no platform fee). At first charge: **2.9% + $0.30** processing + **0.7%** Stripe Billing. Illustrative at ~$3,000 MRR: ~$138/mo (~4.6% effective); ~$117/mo if you self-manage billing and skip the 0.7% layer. _Confidence: high._
- **Founder action:** live Stripe keys + flip `credits_enabled` (SSOT §4). Not a demo dependency.
- _Source: stripe.com/pricing, stripe.com/billing/pricing._

### 6. Web ingestion — Firecrawl · usage-gated
- **What & why:** scrape/crawl external sources for ingestion (BYO-key, so cost can pass to the user).
- **Cost:** **Free 1,000 pages/mo** covers demo; **Hobby ~$16/mo annual** (5,000 pages) is the next step; Standard ~$83/mo (100k pages) is well beyond current needs. **Gotcha:** the Extract/FIRE-1 agent bills even on failed runs — the top surprise-bill source. **OSS floor:** Firecrawl is self-hostable. _Confidence: high._
- _Source: firecrawl.dev/pricing._

### 7. Transactional email — Resend · usage-gated
- **What & why:** app notifications ([`../features/r3-notifications.md`](../features/r3-notifications.md)).
- **Cost:** **Free 3,000 emails/mo** — but a **100/day cap** is the real binding constraint (a single broadcast to a few hundred users blows it). Step up: **Pro $20/mo** (50k emails, no daily cap). **OSS/cheapest floor:** Amazon SES (~$0.10 / 1,000 emails) direct from the Worker. _Confidence: high._
- _Source: resend.com/pricing._

### 8. App builder / hosting / AI gateway — Lovable · partly demo-relevant
- **What & why:** Lovable builds + hosts the app (Cloudflare Workers + Supabase) and offers an AI gateway. We're on it today.
- **Cost:** **Free** (30 build-credits/mo, `*.lovable.app` only, **no custom domain**) is fine for a bare demo. **Pro ~$21/mo annual (~$25/mo monthly)** is the cheapest tier that unlocks a **custom domain** + a 100-credit/mo pool. BYO-key keeps end-user inference off Lovable's metered gateway, so credit burn is mostly dev/build edits → expect **$25–50/mo** in heavy build months. **Escape hatch:** the app is standard React/TS on Cloudflare + Supabase — exportable/self-hostable if Lovable's credits ever outweigh convenience. _Confidence: medium (hosting overage math is usage-dependent)._
- _Source: lovable.dev/pricing, docs.lovable.dev/introduction/plans-and-credits._

### 9. Custom domain — Cloudflare Registrar · optional demo polish
- **What & why:** a branded URL for the demo / launch.
- **Recommendation: Cloudflare Registrar** — sells at registry **wholesale, zero markup**, same price at renewal, free WHOIS privacy; and we're already on Cloudflare.
- **Cost:** `.com` **~$10.46/yr**; `.ai` **~$80/yr but a registry-mandated 2-year minimum** → **~$160 upfront**. Namecheap runs ~$15/yr more long-term (esp. `.ai`). _Confidence: high._
- _Source: cloudflare.com/products/registrar, cfdomainpricing.com._

### 10. Product analytics + session replay + feature flags — PostHog EU · INTEGRATE (AFD initiative, founder-gated)
- **What & why:** the commodity product-usage layer (page views, funnels, retention, replay, A/B, flags). One SDK covers four capabilities. Spec'd by the **AFD initiative** ([`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md), task **AFD-01..04**). Vendor ADR: [`../decisions/analytics-vendor-selection.md`](../decisions/analytics-vendor-selection.md). EU-resident.
- **Recommendation: PostHog EU Cloud (free tier)** — 1M events/mo + 5k recordings + unlimited team members. MIT core (self-host escape if pricing turns); Cloudflare Worker SDK; reverse-proxy to survive ad-blockers.
- **Cost:** **$0** at our scale (demo + early users). First paid trigger ~$0.00031/event past free. _Confidence: high · re-verify before paying._
- **When to buy:** when the founder unblocks AFD §10 (inbox + on-call + status-page domain confirmation).
- _Source: posthog.com/pricing (2026-06-25)._

### 11. Error capture + Worker performance — Sentry EU · INTEGRATE (AFD initiative, founder-gated)
- **What & why:** the commodity error-capture + performance layer (server / route / Worker errors, source-maps, release tracking, transaction tracing). Best Cloudflare Worker SDK. Spec'd by **AFD-05..06**. EU-resident.
- **Recommendation: Sentry EU Cloud (Developer free)** — 5k errors/mo + 10k performance units + 50 replays + 1 user. Team plan $26/mo when we cross.
- **Cost:** **$0** at our scale. _Confidence: high._
- **When to buy:** at AFD activation.
- _Source: sentry.io/pricing (2026-06-25)._

### 12. Uptime + on-call + status page — Better Stack · INTEGRATE (AFD initiative, founder-gated)
- **What & why:** one vendor that covers uptime probes (HTTP / heartbeat), on-call rotation (phone / SMS / Slack), and a public status page. Replaces the PagerDuty + Statuspage + UptimeRobot tri-vendor stack. Spec'd by **AFD-08 + AFD-13**. EU-resident. Status-page domain `status.cadence.app` for now, renameable later via DNS.
- **Recommendation: Better Stack Free** — 10 monitors + 3-min checks + 1 status page + unlimited team. Team plan $25/mo for upgrades.
- **Cost:** **$0** at our scale. _Confidence: high._
- **When to buy:** at AFD activation. Sev-1 phone-call escalation is included on free.
- _Source: betterstack.com/pricing (2026-06-25)._

---

## Total cost picture

| Stage | Monthly run-rate | One-time |
| --- | --- | --- |
| **Demo (bare)** | **$0** | $0 |
| **Demo (polished)** | ~$25/mo (Lovable Pro) | ~$10 (.com domain) |
| **Early go-live (some users, no revenue)** | ~$25–60/mo (Lovable Pro + Cloudflare Sandbox ~$12 + AI ~$10–30 if not all BYO; email/ingest on free tiers) | + ~$160 if a `.ai` domain |
| **Revenue stage** | the above + Stripe ~4.6% of MRR + Resend/Firecrawl paid tiers as volume grows | — |

**Bottom line:** the demo is free; the first meaningful recurring spend is **Lovable Pro (~$25/mo, for a custom domain)** and **Cloudflare Sandbox (~$12/mo, only when you want live build previews)**. Stripe and the rest follow real usage. None of it is a moat — it's all commodity plumbing behind swappable seams, so we fund it on the demo/revenue schedule, not ahead of it. (Doctrine: [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md).)

## The Lovable path for the sandbox (for later)
Lovable is **not** a sandbox/compute provider (its connector catalog is 17 MCP integrations, zero code-execution). It only **hosts** our app — which is automatic and free. So there is nothing to "ask Lovable to provision" for the sandbox: the $0 demo preview is the in-app sandboxed iframe (built behind the seam), and the paid live-preview microVM is a Cloudflare account we own. If we ever want Lovable's agent to build a preview surface, the scoped prompt + caveat are recorded in the 2026-06-25 entry of [`../strategy/session-decisions.md`](../strategy/session-decisions.md).
