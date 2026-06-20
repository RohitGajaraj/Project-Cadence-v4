# The Sourcing Map: Build / Buy / Integrate / Self-host, by cluster

> _Created: 2026-06-21 · The cluster-level Build-Buy-Integrate (BBI) decision for the whole build queue._

> **Why this exists (founder ruling 2026-06-21):** BBI is a **cluster-level** decision, not a per-item label. If we buy or integrate the substrate for a whole capability cluster, most of that cluster's sub-features come for free and we should NOT build them; only the moat sub-items need building. This map makes the cluster call for the founder and tells each agent exactly what to build vs source elsewhere, with the named option behind each. Decision rule + the four sourcing types: [`build-buy-integrate.md`](./build-buy-integrate.md); operative gate in [`../../AGENTS.md`](../../AGENTS.md) §3.0c; the per-cluster pick context surfaces in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) "How to pick".

## The headline

Across 11 capability clusters (~73 distinct tracked capabilities): **~56 are true must-build moat, ~17 are obviated or sourced elsewhere** if we buy/integrate the right substrate. **No moat cluster is obviated by any vendor** - every "obviation" is a commodity sub-layer UNDER the moat, never the moat itself. Build the judgment, borrow/buy the commodity behind a seam, own the store.

**Biggest build-effort savings (one integration removes a whole category of grind):**
- **AI runtime / chokepoint** - the entire LLM-gateway feature set (multi-provider routing, retry/fallback, semantic cache, virtual keys/budgets, the embedding model, the web crawler) is already-owned-or-bought. ~6 sub-items obviated, zero new gateway to build.
- **Tenancy / auth** - the whole auth substrate (login, social OAuth, SAML SSO, SCIM) is ~5 items obviated by Supabase Auth + WorkOS behind the JWT seam. "Do not build custom auth in 2026."
- **Reliability / ops** - the generic infra-reliability half (uptime, error tracking, status page, on-call, platform dashboards, LLM-trace storage) is ~5 items obviated by Cloudflare-native observability + one uptime SaaS + an OTel emit.
- **Interop / MCP** - the transport, OAuth server, agent-card signing, and registry discovery are ~5 items obviated by adopting the MCP/A2A SDKs + Cloudflare OAuth + free registries.
- **Sense / ingestion** - the per-source connector grind + transcription + crawler are ~3 items obviated by the existing OAuth gateway + Firecrawl + Groq Whisper.
- **Analytics** - the event SDK + cohort engine + retention math are ~2 items obviated by integrating PostHog; only the moat metric + the auto-ICE loop are built.

## The Decision Brain verdict (the founder's main question, settled)

**Stop treating "adopt a graph/memory engine" as an open question. It is a settled NO.** Three layers:

1. **The JUDGMENT (BUILD, in-house, forever) - the moat.** The typed decision ontology (Signal to Assumption to Decision to Outcome), the human-gated outcome LABEL recorded weeks after ship, outcome-labeled supersession (invalidate-don't-delete, `DBR-1.5`), the Critic's outcome-weighted precedent-salience, and the visible-compounding metric (accuracy lift as one account's memory grows). Unpurchasable by definition.
2. **The SUBSTRATE (SELF-HOST, native, already shipped).** Bi-temporal node/edge storage, recursive-CTE traversal, pgvector recall, the SVG graph canvas - all in our own Supabase Postgres, live today at `/knowledge?tab=graph` over `artifact_lineage`. A solved, copyable Postgres pattern with ONE tenancy/RLS/residency/backup boundary. **Adopting an external engine would COST build, not save it.**
3. **The COMMODITIES (BUY, via the chokepoint).** Embeddings (OpenAI text-embedding-3-small; BGE-M3 self-host floor) + rerank, through `runtime.server.ts`, never called directly, stamped with model-id so a swap is a background re-embed.

External engines (Graphiti, Zep, mem0, Cognee, Neo4j, FalkorDB, Memgraph, Kuzu) are **reference-only**: we reference-borrow Graphiti's (Apache-2.0) bi-temporal `valid_at`/`invalid_at` + per-edge invalidation-prompt design to save derivation time, and adopt none (Neo4j = GPLv3 + $800-3k/mo; FalkorDB = SSPLv1; Memgraph = BSL; mem0 deletes-on-reconcile, violating invalidate-don't-delete; Kuzu sponsor-abandoned; Zep CE deprecated). The only dormant escape hatch is in-Postgres (Apache AGE / SQL-PGQ) behind a future `GraphStore` seam, enterprise-only, if graph scale ever forces it - and even then we never leave our RLS boundary. **Build the judgment, borrow the plumbing, own the store.**

## The cluster table

| Cluster | Verdict | Build (moat) | Obviated / sourced | Founder call? |
| --- | --- | --- | --- | --- |
| Decision Brain / memory-moat | HYBRID (BUILD-dominant) | 11 | 0 (substrate already self-hosted) | only the embed/rerank spend line + the `DBR-1.5` flag flip |
| Decide / Critic wedge + roadmap | BUILD (edges aside) | 10 | 0 | confirm the "no-buy" on the decision layer |
| Build / autonomy spine + execution | HYBRID | 10 | 2 | sandbox provider + cost line; A2A delegate-out posture |
| Tenancy / workspace / RBAC | HYBRID | 10 | 5 | enterprise-SSO+SCIM provider direction (no spend) |
| AI runtime / chokepoint | HYBRID | 5 | 6 | confirm embeddings-key reuse; ratify no external gateway |
| Reliability / ops / observability | HYBRID | 6 | 4 | pick the uptime/status/on-call SaaS |
| Analytics / measurement / evals | HYBRID | 5 | 2 | pick the inbound product-analytics provider |
| Data / privacy / compliance | HYBRID | 5 | 3 | enable Supabase Pro + PITR (spend); retention/erasure policy at activation |
| Interop / neutral-brain MCP | HYBRID | 5 | 5 | remote-MCP OAuth provider; outward A2A posture |
| Sense / ingestion / connectors | HYBRID | 4 | 3 | register 1 OAuth client; Merge.dev (defer) |
| Governance / safety / guardrails | HYBRID | 4 | 3 | pick the OSS injection-detector floor |

## What we SOURCE ELSEWHERE (do NOT build the obviated part; wire the named option behind the cluster's seam)

- **Decision Brain:** embeddings + rerank = BUY via the chokepoint (OpenAI / BGE-M3 floor). Graph engine = reference-only (Graphiti pattern), adopt none; substrate stays native Postgres.
- **AI runtime:** multi-provider routing + cache + budgets = already built (Lovable AI Gateway + WM-M15 + WM-M4). Embedding model = BUY (reuse the OpenAI key). Web search = Firecrawl + SearXNG floor (`FIRECRAWL-FLOOR`). Adopt NO external LLM gateway (LiteLLM/Portkey/OpenRouter), NO 2nd web-search provider.
- **Tenancy / auth:** login/social/MFA/sessions = Supabase Auth (always-on floor, never rebuild). Enterprise SSO+SAML+SCIM = WorkOS AuthKit (Supabase-native, free <1M MAU) or Clerk, behind the JWT seam, only when a deal demands it; provisioned users land in our `workspace_members` so RBAC stays ours. Do NOT build custom auth or SCIM.
- **Reliability:** uptime/status/on-call = Better Stack (free tier, point at `/api/public/health`). Platform metrics = Cloudflare Workers built-in observability. LLM traces = OTel emit to Langfuse/OpenLLMetry (self-host). Do NOT build dashboards/status-page/paging.
- **Interop / MCP:** transport = adopt the official MCP TS SDK (`@modelcontextprotocol/sdk`). Remote OAuth/DCR = Cloudflare OAuthProvider. Card signing = A2A JS SDK. Discovery = PUBLISH to the free MCP Registry / A2A Directory / PulseMCP. Do NOT hand-roll JSON-RPC, an OAuth server, or registry infra.
- **Analytics:** inbound cohort/usage = PostHog (open-source, self-hostable, free to ~1M events/mo) behind the connectors seam; build only the pull-adapter + the auto-ICE loop. Cost telemetry stays native (do NOT add Langfuse/Helicone as a cost tracker).
- **Data / privacy:** backups + PITR = managed Supabase Pro + PITR add-on (founder enables; no build). PII NER = Microsoft Presidio (self-host, deferred behind the guardrail seam); regex tier holds the floor. Do NOT buy OneTrust/Ketch/Sprinto (they split the RLS boundary).
- **Sense:** breadth OAuth = the existing Lovable connector gateway (do NOT re-adopt Nango). Transcription = Groq Whisper (BUY) / whisper.cpp floor. Watchtower = Firecrawl (already wired). Merge.dev only if >3 normalized support/CRM sources are ever needed.
- **Build / execution:** sandbox runtime = INTEGRATE Cloudflare Sandbox SDK behind a new `ExecProvider` seam (E2B/Vercel microVM kept one swap away for untrusted code; GitHub Actions = $0 floor). Delegate-out coding agent = OpenHands SDK (Apache, self-host floor) behind the A2A handoff contract; Claude Code / Devin as BYO-key opt-in adapters.
- **Governance:** injection/jailbreak classifier = SELF-HOST LlamaFirewall PromptGuard 2 + AlignmentCheck (or StackOne Defender as a zero-GPU in-process floor) behind the `GuardrailResult` seam; native regex always-on fallback. Lakera = optional BYOK enterprise upgrade, deferred (build the seam, not the adapter).
- **Decide:** LLM inference = already bought via `callModel`. Task export = already integrated (Jira/Linear/GitHub). PRD/roadmap SaaS (ChatPRD/Productboard/Linear-as-substrate) = DO NOT BUY (competitors to absorb + downstream export targets). Optional markdown-to-PDF (APITemplate) only post-launch if a user needs a downloadable PRD.

## Founder calls (the cluster-level decisions that are yours; full list mirrors into SSOT §4)

| # | Cluster | The call | Recommendation | Saving if sourced |
| --- | --- | --- | --- | --- |
| 1 | Sense | Register ONE provider OAuth client (Slack / GitHub-issues / a support tool) | Do it (unblocks `SEN-01`/`F-CONN` today); do NOT re-adopt Nango; defer Merge.dev | lights up the 2nd live source; OAuth gateway + Firecrawl + Groq obviate ~3 items |
| 2 | AI runtime | Confirm the agent reuses the existing OpenAI key for embeddings; ratify NO external LLM gateway | Reuse the key (cents/mo via credits); adopt no LiteLLM/Portkey/OpenRouter | obviates the entire gateway feature set (~6 items) |
| 3 | Data/privacy | SPEND: enable Supabase Pro + the PITR add-on on production | Enable it (satisfies `DR-BACKUP`, no build); keep the destructive-flag flips + legal copy founder-only at activation | obviates building any backup/restore engine |
| 4 | Build | Confirm the SANDBOX provider + approve its compute cost line; set the `BLD-04` delegate-out posture | Cloudflare Sandbox SDK default (no new vendor); DEFER the A2A delegate-out posture | INTEGRATE removes >80% of the sandbox build |
| 5 | Tenancy | Pick the enterprise-SSO+SCIM provider DIRECTION (no spend until a deal) | WorkOS AuthKit (Supabase-native) default; Clerk alt; no spend until a real enterprise ask | obviates the whole auth substrate (~5 items) |
| 6 | Reliability | Pick the uptime/status/on-call SaaS; approve a public status page + error tracking | Better Stack (free tier) pointed at `/api/public/health`; errors via Cloudflare Logs or Sentry free | obviates ~5 generic-infra items |
| 7 | Analytics | Pick the inbound product-analytics provider | PostHog (open-source, self-hostable, free to ~1M events/mo) | obviates the event SDK + cohort engine + retention math |
| 8 | Governance | Pick the OSS injection-detector floor + how it runs | LlamaFirewall PromptGuard 2 via a new guardrail CallSurface (or a zero-GPU in-process floor); defer Lakera | obviates building a learned injection classifier from scratch |
| 9 | Interop | Pick the remote-MCP OAuth/DCR provider (when Q2 lands); confirm the outward A2A posture | Cloudflare OAuthProvider (in-stack); external peers call us under workspace-scoped tokens, the append path stays human-approval-gated | obviates the transport + OAuth-server + card-signing + registry build |
| 10 | Decide | Confirm the strategic "no-buy" on the decision layer | Confirm (PRD/roadmap SaaS stay competitors-to-absorb + export targets) | keeps the founder's effort in deepening the moat |

The Decision-Brain cluster needs no shape call: the agent acts. The founder is consulted only for the cents/month embed+rerank line, flipping `DECISION_BRAIN_SUPERSESSION` on + tuning the threshold once `DBR-1.5` ships dormant, and a future-only taste call if graph scale ever forces the in-Postgres Apache-AGE escape hatch.

## Agent doctrine (how to use this map)

Before building any item, look up its CLUSTER here and read the verdict.

1. **On the moat-build list (true must-build):** act autonomously. Build it in-house, route every model call through `runtime.server.ts` via a typed `CallSurface`, keep the zero-external-paid-dep native floor as the automatic fallback, never call a model SDK or external substrate directly.
2. **On the source-elsewhere list (obviated):** do NOT build the obviated part. Wire the named provider behind the cluster's existing swappable seam (`resolveProviderAuth` / `CallSurface` / `ExecProvider` / `GuardrailResult` / the JWT seam) with the native default always holding, and build ONLY the thin glue + the moat-adjacent remainder this map names.
3. **If the cluster has a pending founder call that gates the item:** do the un-gated prep autonomously (scaffold the seam, draft the adapter contract, document the provider pick, benchmark behind a flag defaulted OFF), but do NOT turn on metered spend, provision a paid account, register a secret/OAuth client, flip a live destructive flag, expose an outward surface, or relax an approval gate - those are founder-only.
4. **For a build-vs-source call not yet decided here:** web-ground the current options (these substrate layers commoditize monthly), propose the pick + the saving to the founder, and prepare the seam. Never silently adopt a new external dependency.
5. **Re-evaluate BUY picks periodically:** keep every pick one swap away behind its seam; a redundant second provider is a finding to correct (no 2nd web-search provider, no 2nd LLM gateway, do not re-adopt Nango).

Default: build the moat, borrow/buy the commodity behind a seam, own the store.

## Maintenance

This map is reviewed whenever a new cluster of work is added or a substrate layer materially changes (these commoditize monthly). It is grounded in [`build-buy-integrate.md`](./build-buy-integrate.md) (the decision rule + the worked memory-stack verdict) and feeds the dashboard "How to pick" sourcing doctrine + the SSOT §4 founder calls. Sourced from a 2026-06-21 11-cluster web-grounded analysis (workflow `cadence-bbi-cluster-sourcing`).
