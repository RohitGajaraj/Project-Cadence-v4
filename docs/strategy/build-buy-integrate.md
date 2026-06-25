# Build vs Buy vs Integrate (BBI) - the decision canon

> _Created: 2026-06-20._ The standing decision framework for whether any Cadence capability is **BUILT** (our moat), **BOUGHT** (a commodity API), or **INTEGRATED** (a provider wrapped behind our own swappable abstraction), plus the worked build-vs-buy decision for the memory / Decision-Brain stack. Founder-directed 2026-06-20: surface this question at a higher level on every new build. Canon it touches: [`moat.md`](./moat.md), [`../features/decision-brain.md`](../features/decision-brain.md), the model-agnostic/BYOK mandate in [`../../Ai_Cofounder.md`](../../Ai_Cofounder.md), and the operating rule in [`../../AGENTS.md`](../../AGENTS.md).

---

## Why this exists

The founder asked the right first-principles question: _why build all this (embeddings, memory graph, contradiction engine) from the core? Can't we use providers - Mem0, Zep, Cognee, ZeroEntropy, OpenAI embeddings - and buy or integrate instead?_

The answer is not "build everything" or "buy everything." It is a **split**: build the moat, buy the commodity, integrate the high-lock-in substrate behind a seam with a native default. This doc makes that split explicit, names the providers, and turns the rule into a gate every future build must pass.

---

## The headline

**Build the moat, buy the commodity, integrate behind a seam.** The Decision Brain runs **free and autonomous** on Supabase/pgvector by default; commodity inputs (embeddings, rerank) are bought through the existing model chokepoint; memory engines (Mem0/Zep/Cognee) are opt-in BYOK adapters behind one abstraction that **always falls back to native**. Storage is not the moat. The typed **decision ontology**, the human-gated **outcome label**, **outcome-labeled supersession**, and the **adversarial Critic** are the moat, and they are Cadence-specific and unpurchasable.

---

## Per-layer decision (the memory / Decision-Brain stack)

| Layer | Verdict | Why | What we do |
| --- | --- | --- | --- |
| **Embeddings** | **BUY** | Commodity racing to zero (~$0.02/M, fungible OpenAI-format calls). Sits under the moat, never in it. | Route through `runtime.server.ts` via a new `embedding` CallSurface (never call the provider directly). Default OpenAI `text-embedding-3-small`; swap Voyage `voyage-3.5`; OSS fallback BGE-M3 / Qwen3-Embedding for the autonomy floor. Stamp model-id + dimension on every vector so re-embed is a background migration, not a rewrite. |
| **Rerank** | **INTEGRATE** | A cheap precision booster on the semantic-match step, stateless (zero switching cost). | A `rerank` CallSurface, ZeroEntropy `zerank-2` via API by default; self-host the **Apache-2.0** `zerank-1-small` for the floor (NOT the CC-BY-NC `zerank-2` weights). Gated to multi-hop / precedent retrieval only. |
| **Vector store** | **BUILD / in-house** | pgvector is free on every Supabase tier, RLS-native, provider-neutral, one tenancy + residency + backup boundary. | Stay on pgvector (+ pgvectorscale/DiskANN for headroom). Do NOT adopt Pinecone/Weaviate for v1-v4; a PM-decision corpus is thousands of rows per tenant, not billions. |
| **Graph storage** | **BUILD-in-Postgres** | "Storage is not the moat" but it is residency-critical and autonomy-critical; an external graph DB fractures RLS, account-pooling, residency, export-anytime, and one backup boundary. | Typed bi-temporal node/edge tables + `valid_at`/`invalid_at` + recursive CTEs in Postgres. DBR-1 v1 read-surface already ships at `/knowledge?tab=graph`. Crossover (only if forced): Apache AGE / SQL-PGQ (graph IN Postgres) BEFORE any external Neo4j. |
| **Memory-extraction / orchestration pipeline** | **INTEGRATE** (native default) | The generic substrate is borrowable, not buyable as the moat; every credible engine is OSS + BYOK + high-switching-cost, so it belongs behind a swappable seam with a native default, never a hard BUY. | BUILD the native extract -> embed -> reconcile in Postgres, borrowing the patterns the canon already names (Graphiti's per-edge invalidation prompt; Cognee's ontology-resolver + Temporal-Cognify; Mem0's auto-extraction). Mem0/Zep/Cognee = opt-in BYOK adapters, **deferred** until a workspace actually wants one. |
| **Typed decision ontology** | **BUILD** | THE moat, Cadence-specific. No provider supplies the PM decision schema (Signal -> Assumption -> Decision -> Outcome). | Own it end to end; never wrap a provider's generic entity layer. |
| **Outcome-labeled supersession** | **BUILD** | The outcome LABEL (validated/missed, weeks after ship via the human-gated `recordOutcome` loop) is a judgment no provider can infer at ingest time. | Invalidate, never delete - preserve the superseded trail. Copy Graphiti's `valid_at`/`invalid_at` + invalidation-prompt design; the label stays human-gated and Cadence-owned. |
| **The adversarial Critic** | **BUILD** | Walks outcome-labeled precedent to challenge a new decision; the felt product and pure moat, on our own agent loop. | Own it (`loop.server.ts` + `decision-precedent.server.ts`). Letta (an agent runtime) is redundant on what we have and absent on what we need - do not adopt. |

---

## The provider landscape (2026, web-grounded)

- **Mem0** - OSS + SaaS, BYOK, low lock-in, but its graph is **paywalled** (~$249/mo) and weak on the exact temporal/multi-hop queries we need, and its reconcile **deletes/overwrites** by default, violating our non-negotiable "invalidate, don't delete." **Reference-only** (borrow the auto-extraction pattern).
- **Zep / Graphiti** - Graphiti (Apache-2.0) is the **gold-standard reference** for the supersession mechanic (bi-temporal `valid_at`/`invalid_at` + a per-edge invalidation prompt). But it requires a separate graph DB (Neo4j/FalkorDB/Kuzu) outside RLS, and the self-hostable full Zep stack was deprecated. **Reference-only**; documented cross-over engine if graph scale ever demands it (the `nango/` pattern: stand up a separate service only if breadth forces it).
- **Cognee** - the best architectural match (ontology resolver + Temporal-Cognify + contradiction-resolve) and the only one that natively holds the autonomy floor (in-process SQLite+LanceDB+Kuzu, BYOK). Still **reference-only**: bolting on a second data plane conflicts with minimum-code, and its contradiction-resolve is generic entity-level, not outcome-labeled supersession.
- **Letta (MemGPT)** - an agent runtime, the wrong layer; we already have our loop. **Reference-only.**
- **ZeroEntropy** - a reranker, not a memory engine. Accuracy leader + cheapest ($0.025/M), open weights self-hostable. The one **INTEGRATE** here.
- **Embeddings (OpenAI / Voyage / Cohere / Jina)** - all **BUY** via the gateway; the only real switching cost is the index re-embed, mitigated by stamping model-id + dimension and keeping source text as system-of-record.
- **Neo4j** - **AVOID** as the substrate (GPLv3 copyleft hazard for closed-source SaaS; $800-3,000/mo+ paid floor breaks the autonomy mandate; data leaves the RLS boundary). **Kuzu** - sponsor-abandoned Oct 2025; avoid.

---

## The provider seam (target architecture - documented now, built incrementally)

The same pattern already proven in the codebase: `resolveProviderAuth` (workspace binding -> user connection -> env fallback) + the `CallSurface` union behind `runtime.server.ts`. Memory gets the identical treatment.

```
interface MemoryProvider {
  id: 'native' | 'mem0' | 'zep' | 'cognee'
  extract(input, workspaceId): Promise<ExtractedNodes>       // text -> typed candidate nodes
  upsertWithSupersession(nodes, edges): Promise<WriteResult>  // contradiction-on-write; MUST invalidate-not-delete
  recall(query, opts): Promise<Precedent[]>                   // vector + optional graph multi-hop
  rerank?(query, candidates): Promise<Precedent[]>            // optional precision step
  health(): Promise<'ok' | 'degraded' | 'down'>
}
```

- **Native default** (`id:'native'`, always available, zero external paid deps): pgvector recall + the relational bi-temporal graph + Cadence's own extract/reconcile. This is the structural autonomy floor and the fallback target for every other provider; it is never removed.
- **BYOK adapters** (opt-in, per-workspace, cost-metered): Mem0/Zep/Cognee implement the same interface, selected only when a workspace binds the provider AND supplies its own key. Adapter contract gates: must map onto invalidate-don't-delete, must not call a model out-of-band (everything routes through the chokepoint), must keep the outcome label + ontology Cadence-owned.
- **Graceful fallback (load-bearing):** the seam wraps every adapter call; on `health()=='down'`, timeout, error, missing key, or a tripped cost cap, it transparently falls back to native and logs a degraded-mode trace. The product never hard-fails on a provider outage and never requires an external paid dep to run.

> **Build order (the critique's adjustment, folded in - do NOT pre-build the seam):** the full adapter seam is **premature** at ~42% completion (YAGNI / minimum-code). Build now: (1) the `embedding` + `rerank` CallSurfaces (thin BUY glue through the existing chokepoint), and (2) the **native** supersession engine in Postgres (the moat). Add the `MemoryProvider` interface + the first external adapter only when a workspace actually demands Mem0/Zep. The interface above is the target shape so the native engine is written behind a thin internal boundary, not the full multi-adapter machinery on day one.

---

## Cost-control + autonomy mechanisms

1. **Native floor is structural, not optional** - pgvector + relational graph + native extract/reconcile run with zero external paid deps; the product is always free + autonomous.
2. **Single chokepoint for every model call** - embedding / rerank / extraction route through `runtime.server.ts` via typed CallSurfaces; no out-of-band provider model calls (preserves BYOK routing, cost tracking, token logging).
3. **Credit-metered providers** - every memory method bills through the existing credit system; BYOK adapters are opt-in per-workspace and cost-capped.
4. **Hybrid query routing (never graph-only)** - vectors for fuzzy recall; only multi-hop / contradiction / decision queries hit the graph (graph indexing is ~10-40x the cost and ~2.3x the latency of vectors and loses ~13% on simple lookups).
5. **Cost-cap downgrade ladder** - on a tripped per-workspace cap: graph -> vector-only, then external-provider -> native, automatically.
6. **Re-embed is a migration, not a rewrite** - model-id + dimension stamped on every vector + source text as system-of-record; no index lock-in.
7. **License hygiene on the floor** - self-host only permissive (MIT/Apache/BSD) weights/code; never self-host CC-BY-NC `zerank-2` or GPLv3 Neo4j Community.
8. **Invalidate-don't-delete enforced at the seam** - adapters that delete-on-reconcile (Mem0 default) are wrapped to soft-invalidate or rejected; the superseded trail (and the moat) is never destroyed by a provider's data model.
9. **Moat in-house, substrate swappable** - the ontology, outcome label, supersession, and Critic are BUILT and owned; providers supply only extraction/embeddings/edges/recall and are one swap away.

---

## The BBI Gate (the standing rule - run before building ANY capability from core)

> Operative copy lives in [`../../AGENTS.md`](../../AGENTS.md) (the manual agents follow) and is registered as a founder ruling in [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) §1. Carry a greppable `BBI:` stamp on the deciding doc/PR.

**Run the 7 questions:**
1. **IS-IT-THE-MOAT?** Does owning it deepen the typed decision ontology / outcome-labeled supersession / adversarial Critic / system-of-record? -> if YES, **BUILD**, full stop.
2. **IS-IT-COMMODITY?** Fast oracle, many interchangeable providers, price racing to zero (LLM inference, embeddings, rerank, OCR, email, OAuth)? -> if YES and not the moat, **BUY** or **INTEGRATE**.
3. **COST-CONTROL?** Does it add a recurring paid floor / per-seat / per-GB / per-core SKU we cannot meter through credits or turn off? -> pushes toward **BUILD-thin** or **INTEGRATE-behind-a-seam**.
4. **AUTONOMY / BYOK FLOOR?** Can the product still run with zero external paid deps if this vanishes or the user is offline? -> if a dep breaks the floor it must be **INTEGRATE (swappable, native fallback)** or **BUILD**, never a hard **BUY**.
5. **LOCK-IN / SWITCHING COST?** Could a vendor hold our data/format hostage or break export-anytime? -> high -> **INTEGRATE** behind our own typed abstraction.
6. **DATA-RESIDENCY / PRIVACY?** Does it move tenant decision data outside our single-region RLS Postgres / subprocessor disclosure? -> anything touching the outcome-memory corpus stays **BUILD-in-our-store** or strictly-scoped **INTEGRATE**.
7. **TIME-TO-VALUE?** Would building it burn moat-build time on a non-moat problem? -> non-moat + slow-to-build -> **BUY/INTEGRATE** to stay fast.

**Decision rule (one line):**
- moat = YES -> **BUILD** (own it end to end; never wrap a provider's generic layer).
- moat = NO + commodity + low-lock-in + residency-safe -> **BUY** (route through the chokepoint / a CallSurface; never call the provider directly).
- moat = NO + (high-lock-in OR autonomy-floor-risk OR residency-sensitive OR likely-to-be-swapped) -> **INTEGRATE** behind a typed internal seam with a NATIVE default + graceful fallback, cost-metered through credits.

**Two non-negotiable side-constraints on any BUY/INTEGRATE:**
- It routes every model call through `runtime.server.ts` (a new capability needs a valid `CallSurface`; no out-of-band LLM calls).
- It preserves the autonomy floor: a native, zero-external-paid-dep default must exist and be the automatic fallback. License hygiene: self-host only permissive weights/code; flag GPL/AGPL/BSL/CC-BY-NC before it lands.

**Worked examples:** AI inference / embeddings / rerank -> commodity -> **BUY/INTEGRATE** via the gateway. Graph-viz rendering -> commodity, fast -> **BUILD-thin** (the dependency-free SVG canvas O1 already shipped). Typed decision graph + outcome-labeled supersession + the Critic -> THE moat -> **BUILD**. Graph storage engine -> not the moat but residency + autonomy-critical -> **BUILD-in-Postgres**, external engine reserved as an enterprise-only **INTEGRATE** escape hatch.

---

## The STRENGTHENED doctrine (default-to-BUILD; founder ruling 2026-06-20)

> Founder course-correction: do not reflexively buy the commodity. **Build anything that makes the platform more defensible. Only the irreducible commodity leaves.** This section is the operative doctrine; the per-layer analysis above is the worked memory-stack example.

**The platform is NOT an assembly of external products. We are a builder, not an integrator.** The default verdict for every capability is **BUILD**. The USP lives in-house, end to end, and is never wrapped on top of a vendor's generic layer. A capability only leaves the building when ALL of: (a) it is an irreducible commodity (a fast oracle, many interchangeable providers, price racing to zero), (b) it is not the moat and not moat-adjacent (does not touch the typed decision ontology / outcome-labeled supersession / the Critic / system-of-record / the orchestration position / governance-audit), (c) building it would burn moat-time on a solved non-differentiating problem, AND (d) it is cleanly meterable through credits (a per-use commodity, never a per-seat / per-GB / per-core subscription floor we cannot turn off).

**Minimize external spend + reliance, structurally.** Prefer one provider that covers several needs over several single-purpose ones; prefer a provider already in the stack (Cloudflare, Supabase, the Lovable gateway) over a new vendor; no subscription floor where usage-metered billing exists. Standing target: single-digit-to-low-tens-of-dollars/month of external recurring spend across the whole product; anything that adds a fixed monthly SKU is escalated, not absorbed.

**Every bought/integrated commodity has a self-host/BYOK fallback (the autonomy floor is structural).** A native, zero-external-paid-dep default exists for every external dep and is the automatic fallback on missing-key / cost-cap / provider-down / offline. License hygiene: self-host only permissive (MIT / Apache-2.0 / BSD); flag GPL / AGPL / BSL / SSPL / CC-BY-NC before it lands.

**The agent owns the call, from its own research - not the founder.** The agent runs the 7-question gate itself, web-grounds pricing/licenses itself, picks the verdict + the single recommended player itself, and ships it. The founder is consulted ONLY for: a genuine spend approval (a new metered cost line going live), a secret / OAuth-client registration, or a real taste/policy call. A routine commodity-vs-moat classification is never deferred to the founder.

**Applies forward AND retroactively.** Governs every new capability before build, AND is the lens to re-audit everything already shipped or in the pipeline. A violation already built (a direct provider call bypassing the chokepoint, an external dep with no native fallback, a wrapped commodity masquerading as moat, a redundant second provider) is a finding to correct, not grandfather. Re-run the gate over the register on every doctrine shift.

**The moat boundary (sharpened by the adversarial pass).** Build the JUDGMENT, borrow the PLUMBING. The bi-temporal storage mechanics (`valid_at`/`invalid_at`, recursive-CTE traversal, invalidate-don't-delete machinery) are a solved, copyable Postgres pattern - borrow Graphiti's per-edge invalidation-prompt design or Apache AGE; do not artisanally re-derive them. The unpurchasable moat is: the **outcome LABEL** (the human-gated validated/missed verdict weeks after ship); the **typed normalization of raw heterogeneous signal INTO the decision ontology** (Signal -> Assumption -> Decision - the part a competitor cannot backfill); and the **precedent-salience ranking the Critic uses** (outcome-weighted, Cadence-owned - a commodity reranker may order recall, but the "which prior decision most challenges this one" score is ours).

## Register categorization (the whole build bible, bucketed + verdict'd)

A full pass over the ~100-row master register (feature-dashboard + SSOT §3) under the strengthened doctrine. **Result: ~95 of ~100 rows are BUILD** - the moat, the decision layer, the foundation/governance spine, and all tenancy/credit/entitlement logic are unpurchasable and in-house. Only a handful of irreducible commodities UNDER the moat leave the building, each routed through the chokepoint with a native/OSS fallback.

| Bucket | Verdict mix | Note |
| --- | --- | --- |
| Foundation (loop spine, chokepoint, auth/tenancy, A2A, fallback resolvers) | ~22 BUILD | The whole autonomous-loop spine + the chokepoint are owned + moat-adjacent; the chokepoint can never be outsourced (everything routes through it). Only embeddings/rerank inside DBR leaves. |
| Moat / Decision Layer (PRD/spec gen, Critic, decision cards, outcome roadmap, teardown wedge, scheduling) | ~13 BUILD | Pure moat, no fast oracle; unbuyable by definition. |
| Governance (Trust Dial, injection defense, blast-radius, kill-switch/spend caps, eval/drift/incidents, prompt studio, sanitizer) | ~12 BUILD | The governance/audit moat; outsourcing traces/evals fails residency + splits the RLS schema. |
| Sense (connectors, brain/research, discovery, knowledge graph, drift, audio) | ~12 BUILD + 2 INTEGRATE | The connector engine + the signal->ontology mapping are the moat. Firecrawl web (already wired) + F-AUDIO-1 ASR are the INTEGRATEs, both with self-host floors. |
| Build (Build station, multi-file, branches, gates, release/rollback, repo binding, sandbox) | ~14 BUILD + ~5 INTEGRATE | The governed Build-to-Ship loop is owned; git hosting + runtime + sandbox are swappable substrate behind RepoProvider. SANDBOX = Cloudflare Sandbox SDK. |
| Interop (MCP, A2A, export, RBAC/invites, handoff) | ~6 BUILD | Open protocols we implement, not products we buy. |
| Launch (cohort metrics, impact eval, product-memory, launch-kit, support triage) | ~7 BUILD | The post-release outcome loop is the moat; analytics = thin BYO connector ($0). |
| Cockpit / Ops (notifications, settings, cost roll-up, IA, health, flow mode) | ~18 BUILD | Calm-front surfaces over our own data; nothing buyable. |
| Monetization + Credit (pricing, gates, credit unit/grant/debit/attribution, margin levers, PLG, billing) | ~24 BUILD + 2 INTEGRATE | All credit/entitlement LOGIC is moat substrate; only the payment processor (Stripe) + top-up leave. |
| Workspace-Tenancy + Knowledge + Data/Privacy (RLS, RBAC, invites, pooling, knowledge graph, retention, subprocessors) | ~20 BUILD | Residency-critical, in our Postgres; compliance artifacts are in-house registries. Only invite EMAIL (Resend) is a thin INTEGRATE. |

## What leaves the building (the complete BUY/INTEGRATE shortlist)

The ENTIRE external surface, with my recommended player + cost. **Total recurring external spend today: ~$16-83/mo (Firecrawl) + $0-20/mo (Resend; free tier covers MVP) + cents/month metered.** Every line is a meterable commodity with a self-host/BYOK floor; no fixed subscription floor beyond the web tier.

| Capability | Verdict | Recommended player | Cost | Self-host floor |
| --- | --- | --- | --- | --- |
| Embeddings | BUY (via `embedding` CallSurface) | OpenAI text-embedding-3-small (swap Voyage voyage-3.5-lite) | ~$0.02/1M tok, metered | BGE-M3 (MIT) |
| Rerank (deferred) | INTEGRATE (via `rerank` CallSurface, multi-hop only) | ZeroEntropy zerank-2 | ~$0.025/1M tok, cents/mo | zerank-1-small (Apache-2.0); native = skip rerank |
| Web research (wired) | INTEGRATE (KEEP) | Firecrawl (search+scrape+crawl in one) | $16-83/mo | SearXNG (BUILD now - see audit) |
| Transcription (F-AUDIO, greenfield) | INTEGRATE (via `transcription` CallSurface) | Groq Whisper-Turbo (same model as floor) | ~$0.04/hr audio | whisper.cpp (same model, zero drift) |
| Sandbox / preview | INTEGRATE (own seam) | Cloudflare Sandbox SDK (no new vendor) | $0.00002/vCPU-s | edge-native |
| Billing | INTEGRATE (dormant seam) | Stripe (cheapest non-MoR) | 2.9%+$0.30/txn, $0 fixed | Paddle/LemonSqueezy (MoR) if tax forces |
| Transactional email | INTEGRATE (`email.server.ts`) | Resend (best DX) | $0 free / $20 Pro past 3k/mo | Amazon SES |
| Git hosting | INTEGRATE (RepoProvider) | GitHub (user's own org, BYO) | $0 | GitLab adapter next |
| Analytics ingest | BUILD-thin connector (NOT a buy) | BYO PostHog/Mixpanel export | $0 | n/a |

## Retroactive audit (what we have already built)

- **Moat layers: correctly built, nothing over-built.** The precedent engine, the outcome loop, the Critic (all via `callModel`), and the O1 knowledge graph (in-house, Postgres) align with the doctrine. No external memory engine adopted; the supersession engine is correctly deferred (build later in Postgres via the chokepoint, invalidate-not-delete).
- **ONE retroactive violation: embeddings bypass the chokepoint.** `src/lib/ai/embed.server.ts` calls the gateway directly, skipping `ai_events` cost, credit debit, BYO routing, and token logging - and the `embed` CallSurface literal exists in the union but is dead/unwired. **Fix (build-now #1):** route `embed.server.ts` through `callModel` via the `embed` surface, keep `text-embedding-3-small`, and add `model_id` + `dimension` columns to the vector store + backfill (a real migration, offline-gateable per standing ruling 1). This brings every embedding under the metered, BYOK, fail-safe path.
- **One live autonomy-floor gap:** `src/lib/ai/tools/firecrawl.server.ts` hard-fails (throws) on a missing key - no native fallback, violating the "always run free + autonomous" rule TODAY. Fix = build the SearXNG self-host sibling (build-now).

## Build-now (the BUILD-by-us queue, prioritized; chokepoint items are attended)

1. **FIX embeddings routing** (the retroactive violation, #1): re-route `embed.server.ts` through the chokepoint + stamp model-id/dimension. _(chokepoint; attended / main worktree.)_
2. **SearXNG self-host floor** next to `firecrawl.server.ts` (closes the live autonomy-floor gap). _(AI-tools; attended / main worktree.)_
3. **Native supersession engine** in Postgres (the moat center): typed bi-temporal edges + invalidate-not-delete, borrowing Graphiti's invalidation-prompt; build the THIN judgment seam (ontology types + outcome-label gate + the Critic's outcome-weighted precedent-salience score), NOT artisanal CTE machinery. _(chokepoint + recurring spend; attended.)_
4. **PROVIDER-FALLBACK + MODEL-REGISTRY-DEPRECATION resolvers** at the chokepoint (these ARE the autonomy floor). _(chokepoint; attended.)_
5. **Credit debit engine end-to-end** (WM-M12 fills the WM-M4 seam) + attribution (WM-M14). _(WM lane.)_
6. **Outcome-impact loop** (post-release cohort -> Product Memory -> auto-ICE) over BYO analytics. _(Launch.)_

> WM-M15 (cost-aware routing + response cache) is ALREADY shipped at the chokepoint - removed from the queue (the synthesis double-listed it).

## Where I need the founder (the short gate list)

- **Spend approvals:** Stripe go-live (WM-M3/M13; 2.9%+$0.30, $0 fixed) + confirm Stripe over a Merchant-of-Record (Paddle/LemonSqueezy); the Sandbox compute cost (+ confirm Cloudflare Sandbox SDK); the recurring-AI-cost crons (the F3 discovery feed + any always-on crawl). The metered commodity rates (embeddings/rerank/transcription) do NOT need per-item approval.
- **Secrets / OAuth:** register the OAuth client(s) for the 2nd ingest source + analytics/support channels (F-CONN / SEN-01 / SEN-05); confirm/provide the embedding key (or reuse the OpenAI key), the Groq key (when F-AUDIO ships), the Resend key (when email goes external).
- **Taste / policy:** the WM-M9 BYOK-retirement ruling (enterprise-only); the tier-identity glyph (design pass); the A2A outward-exposure posture (BLD-04 / Q2).

---

## AI inference provider analysis: embeddings + completions (2026-06-25)

> **Why this section exists.** The founder asked: are there better/cheaper alternatives to OpenAI for embeddings? What is "completions" and does it matter for us? Should we use AWS Bedrock credits? When does self-hosting make sense? What happens when no user brings a BYO key? This section is the web-grounded, constraint-aware answer — a permanent reference so the decision never has to be re-researched from scratch.

---

### What each term means for Cadence

**Embeddings** convert text into a dense numerical vector (1536 numbers in our case). Every time Cadence stores a memory, indexes a signal, or does a semantic search — that is an embedding call. The result is stored in `vector(1536)` Supabase columns and queried via pgvector. Embeddings do NOT generate text; they are a fast, cheap, deterministic index operation. Our current provider: OpenAI `text-embedding-3-small` at $0.02/1M tokens.

**Completions** are when an AI model reads input text and generates output text. In Cadence, every completion is one "thinking step." This powers:
- **The agent planning loop** (`loop.server.ts`): when a user triggers an agent, it reasons step-by-step — up to 6 steps, each step reading context + tool results and deciding the next action. Each step is one completion call. This is the primary cost driver.
- **Chat / Ask** (`api/chat.ts`): every streaming AI response the user sees.
- **The Critic** (`critic.server.ts`): challenging a decision against outcome-labeled precedents.
- **Reflections, draft support replies, decision narration**: any text the product generates.

Embeddings are cheap (sub-cent per session). Completions on GPT-4o can cost $0.066 per full 6-step planning loop. At scale, the completion cost dwarfs the embedding cost by 10-100x — **completions are the primary cost lever, not embeddings.**

---

### The dimension question: why 1536 and should we change it?

The current `vector(1536)` column definition was **not a principled decision**. OpenAI text-embedding-3-small outputs 1536 dimensions by default, and the schema was written to match. There is nothing special about 1536. It is an artifact of the default provider choice.

**The real constraint is not dimensions — it is token input limits.** This is the factor that matters most for Cadence's specific use case. If a model truncates a 5,000-word PRD at the 2,048-token mark, you are embedding only the first third of the document. The embedding vector misrepresents the whole document. The Critic then retrieves "relevant" precedents based on a fragment. The MTEB benchmark score (measured on short passages) does not capture this failure mode.

**Input token limits by provider (web-grounded, 2026):**

| Model | Token limit | Behaviour at limit |
|---|---|---|
| Cohere embed-v4 | 128,000 | Designed for full docs |
| Voyage voyage-3 | 32,000 | Designed for long-context RAG |
| OpenAI text-embedding-3-small (current) | 8,191 | Truncates long PRDs |
| OpenAI text-embedding-3-large | 8,191 | Same ceiling as small |
| Nomic embed-text-v1.5 | 8,192 | Same as OpenAI |
| **Google gemini-embedding-001** | **2,048** | **Silent truncation — no error raised** |

**Critical implication:** A Cadence PRD document at 4,000 words is approximately 5,300 tokens. At OpenAI's 8,191-token limit, most PRDs fit but large ones get cut. At Google Gemini's 2,048-token limit, virtually every full PRD gets silently truncated to roughly its introduction and first section. The MTEB score of 67.71 that made Gemini look attractive is measured on benchmark passages — not on full product documents. For Cadence's actual workload, Gemini's token limit makes it a poor fit despite its headline retrieval score.

**Changing dimensions requires a migration, but NOW is the cheapest time.** At demo scale with essentially zero production data, the migration consists of:
- A SQL file altering vector column sizes (30–45 min)
- Updating `EMB_DIMS` and the model string in `embed.server.ts` (10 min)
- A re-embed backfill (near-instant at zero production rows)
- Total: ~2.5 hours, zero data at risk

At production scale with millions of rows, the same migration requires careful offline scheduling and can take hours. **The time to change dimensions is now.**

**Dimension options and their tradeoffs:**

| Dims | Provider | Quality | Token limit | Cost/1M | Migration from 1536 |
|---|---|---|---|---|---|
| 768 | Nomic / Fireworks | Same as current | 8,192 | $0.008 | Required; no quality gain |
| 1,024 | Voyage voyage-3 | Better than current | 32,000 | $0.06 (200M free) | Required; quality + context gain |
| 1,536 | Cohere embed-v4 | Better than current | 128,000 | $0.12 | No column migration needed |
| 3,072 | OpenAI text-emb-3-large | Better than current | 8,191 | $0.13 | Required; no context gain |
| 3,072 (set to 1536) | Google gemini-emb-001 | Highest MTEB | **2,048 truncates** | $0.15 | No column migration; but bad for long docs |

**The Matryoshka optimization available today:** OpenAI text-embedding-3-small supports Matryoshka truncation. Setting `dimensions=768` in API calls produces 97% quality at half the storage with no model change. This would require a column migration (vector(1536) → vector(768)) and re-embed of existing rows, but no provider or API key change. Free storage and query speed improvement. Not done yet.

This makes provider switching for embeddings a non-trivial migration, not a config change.

**Providers that work with 1536 dims without migration:**
- OpenAI `text-embedding-3-small` (1536 native) — current provider, $0.02/1M
- OpenAI `text-embedding-3-large` (3072 native, Matryoshka truncatable to 1536) — $0.13/1M
- Google `gemini-embedding-001` (`output_dimensionality=1536` parameter, Matryoshka supported) — $0.15/1M
- Cohere `embed-v4` (1536 native) — $0.12/1M

**Providers that require a dimension migration:**
- Fireworks `nomic-embed-text-v1.5` — 768 dims (migration to `vector(768)`)
- Jina `jina-embeddings-v3` — 1024 dims (migration to `vector(1024)`)
- Voyage `voyage-3` / `voyage-3-lite` — 1024/512 dims (migration)
- Nomic direct — 768 dims (migration)

---

### Embedding provider comparison (2026, full analysis — corrected)

> **Correction from earlier analysis:** Google gemini-embedding-001 was previously recommended based on its MTEB score (67.71, highest of any API model). This was wrong for Cadence's use case. Its input token limit is **2,048 tokens**, and it truncates silently. A full PRD or decision narrative at 4,000–10,000 words exceeds this limit and gets silently cut to its first ~1,500 words. The MTEB score is measured on short benchmark passages; it does not reflect long-document retrieval quality. Google Gemini is disqualified for this use case at this limit.

| Provider | Model | Cost/1M | MTEB retrieval | Input token limit | Dims | Fit for Cadence |
|---|---|---|---|---|---|---|
| **Voyage AI** | voyage-3 | $0.06 (200M free) | Strong (~65+) | **32,000** | 1,024 | **Best fit** — purpose-built for RAG, long docs, free for demo |
| **Cohere** | embed-v4 | $0.12 | ~65–66 | **128,000** | 1,536 | Strong — handles the longest docs; higher cost; no completion deal |
| **OpenAI** (current) | text-emb-3-small | $0.02 | 62.26 | 8,191 | 1,536 | Acceptable; current default; hits ceiling on long PRDs |
| **Nomic / Fireworks** | nomic-embed-v1.5 | **$0.008** | ~62.28 | 8,192 | 768 | Cheapest, same quality as current, good for cost-priority deployments |
| **OpenAI** | text-emb-3-large | $0.13 | Better than small | 8,191 | 3,072 | Same token limit as small; costs 6.5x more; no context advantage |
| ~~**Google**~~ | ~~gemini-emb-001~~ | ~~$0.15~~ | ~~67.71~~ | ~~**2,048 (silently truncates)**~~ | ~~3,072~~ | **Disqualified** — truncates all long PRDs without warning |

**Verdict on embeddings (corrected):** Migrate to **Voyage AI voyage-3** at 1,024 dims. Rationale:
1. 32,000 token limit handles complete PRDs and decision narratives without chunking
2. Better MTEB retrieval than current OpenAI-small (stronger Critic recall)
3. 200M free tokens per account — entire demo and early users cost $0
4. 1,024 dims is smaller than current 1,536 (faster pgvector ANN queries, less storage)
5. Migration: ~2.5 hours at demo scale, zero production data at risk now — cheapest moment to do it

**If Voyage is not available / fallback:** Nomic embed-text-v1.5 via Fireworks ($0.008/1M, 768 dims, 8K limit) is the cost-optimized fallback. Same MTEB quality as current. Requires migration to `vector(768)`.

**For future scale when long-context becomes critical:** Cohere embed-v4 at 128,000 tokens handles entire product documentation corpora in a single embedding call. No chunking, no averaging. Worth reassessing when workspace knowledge bases grow large.

---

### Completion provider comparison (2026)

These are the models that power the agent loop, chat, Critic, and all text generation.

| Provider | Model | Input $/1M | Output $/1M | Quality tier | Notes |
|---|---|---|---|---|---|
| **OpenAI** (current via Lovable gateway) | GPT-4o | ~$5.00 | ~$15.00 | Best-in-class | Current default via gateway; most expensive option |
| **OpenAI** | GPT-4o-mini | $0.15 | $0.60 | Good | 94% cheaper than GPT-4o; same tier as Llama 4 Maverick |
| **Fireworks AI** | Llama 4 Maverick | **$0.15** | **$0.60** | Good | Same quality tier as GPT-4o-mini; Apache 2.0 open model; best latency in class (sub-100ms TTFT); JSON structured output + streaming — exactly what the planning loop needs |
| **Fireworks AI** | Llama 4 Scout | $0.18 | $0.85 | Good | Slightly pricier than Maverick; lighter than Maverick on reasoning |
| **Together AI** | Llama 4 Maverick | $0.27 | $0.85 | Good | Same open model as Fireworks; Fireworks wins on price and latency |
| **Groq** | Llama 3.3 70B | $0.59 | $0.79 | Good | Ultra-fast LPU inference; lowest latency of any provider for streaming; no native embeddings |
| **Google** | Gemini 2.5 Flash-Lite | **$0.10** | **$0.40** | Good | Cheapest credible model from a major provider; 1M context; part of a Google all-in-one play |
| **Anthropic** | Claude Sonnet 4.6 | $3.00 | $15.00 | Best-in-class | Best reasoning; use selectively for high-stakes Critic / decision steps; no native embeddings |
| **AWS Bedrock** | Any model | ~2–3x direct price | ~2–3x direct price | — | Bedrock prices every model higher than going direct; only viable with free credits |
| **Azure OpenAI** | GPT-4o | Same as OpenAI | Same as OpenAI | Best-in-class | No price saving; adds compliance / data residency layer for enterprise |

**The cost reality per full 6-step planning loop** (2,000 input + 600 output tokens × 6 steps):

| Route | Cost per loop |
|---|---|
| GPT-4o via Lovable gateway (current) | ~$0.066 |
| Fireworks Llama 4 Maverick | ~$0.004 |
| Google Gemini 2.5 Flash-Lite | ~$0.003 |
| GPT-4o-mini | ~$0.004 |

Fireworks or Gemini Flash saves ~94% per loop run. At 100 loop executions/day: current = ~$6.60/day vs Fireworks = ~$0.40/day.

---

### All-in-one platforms (embeddings + completions under one billing account)

| Platform | Embed support? | Completion support? | Embed cost/1M | Completion cost/1M (in/out) | Notes |
|---|---|---|---|---|---|
| **Fireworks AI** | Yes (768 dims — needs migration) | Yes | $0.01 | $0.15 / $0.60 | Best speed-to-price; one API key; open models Apache 2.0; dimension migration needed |
| **Together AI** | Yes (768 dims — needs migration) | Yes | $0.008 | $0.27 / $0.85 | Cheapest raw price; same quality as Fireworks; Fireworks edges it on latency |
| **Google Gemini API** | Yes (1536 dims via param — no migration) | Yes | $0.15 | $0.10 / $0.40 | One vendor, highest embed quality, cheapest completions; embed cost is 7.5x OpenAI |
| **Cohere** | Yes (1536 dims native) | Yes | $0.12 | $2.50 / $10.00 | Built for RAG (embed + reranker + Command R+); expensive on completions |
| **Groq** | No | Yes | N/A | $0.05–$0.79 | Completions only; ultrafast LPU; pair with a separate embed provider |

---

### AWS Bedrock + startup credits: is it worth it?

AWS Activate for startups offers up to $5,000 in AWS credits (including Bedrock). The appeal is real — free inference for the demo period.

**Problems:**
1. Bedrock's native embedding model (Titan Embed Text v2) outputs 1024 dims — requires a dimension migration to `vector(1024)`.
2. Bedrock prices all models HIGHER than going to providers direct (e.g., Claude Sonnet 4 via Bedrock costs more than via Anthropic API direct). Credits are worth less in real inference than it appears.
3. The credits deplete and the billing relationship shifts to full Bedrock rates. Migrating away requires re-testing all model routing code.
4. IAM permission complexity, region availability issues, and latency overhead for a Cloudflare Workers deploy.

**Verdict:** For a $5–10 demo budget, the Lovable gateway already covers everything at near-zero marginal cost. AWS Bedrock credits add operational complexity with no meaningful quality or cost advantage at demo scale. Reassess only if AWS partnership terms become strategically important (e.g., AWS Marketplace listing, enterprise procurement through AWS).

---

### Self-hosting open models: when yes, when no

| Scenario | Verdict |
|---|---|
| Demo / pre-revenue | Never self-host. GPU costs + reliability > API costs at this scale. |
| First 1,000 users | Never self-host. API cost at <1M tokens/day is $5–20/day max with Fireworks. |
| 100K+ users, >100M tokens/month | Evaluate: open model on owned A100 GPU becomes cost-competitive. |
| Dedicated ML engineer on the team | Prerequisite before self-hosting is operationally viable. |

**Best open models for when self-hosting is eventually viable:**
- **Embeddings:** `Qwen3-Embedding-8B` (Apache 2.0, MTEB 70.6 — beats ALL API models including Google) requires ~16GB VRAM. `BGE-M3` (MIT, MTEB ~63, 512MB, runs on CPU) is the operational floor.
- **Completions:** `Llama 4 Maverick` (Apache 2.0) runs on a single A100; matches GPT-4o-mini quality.

The BYOK architecture Cadence has already built makes self-hosting a configuration change, not a product change. When the time comes, the chokepoint (`resolveEmbedRoute`, `runtime.server.ts`) gets a new provider type — the product features don't change.

---

### Where BYOK lives: the architecture explained

This is a critical distinction: **the AI provider does NOT give you memory recall, decision indexing, reflections, or any other Cadence feature. The provider is a dumb API that takes text and returns vectors or completions. All features are Cadence-built.**

Here is the exact layering:

```
USER PROVIDES A KEY (optional)
         ↓
[Cadence BYO Vault]  ← encrypts + stores the key (AES-256-GCM)
src/lib/byokeys-vault.server.ts
         ↓
[Embedding chokepoint]          [Completion chokepoint]
src/lib/rag/embed.server.ts     src/lib/ai/runtime.server.ts
  resolveEmbedRoute():            callModel() / callModelStream():
  1. explicit BYO override         1. BYO key (user's OpenAI/Anthropic)
  2. user's OpenAI BYO key         2. Lovable gateway (default)
  3. Lovable gateway (default)     3. [Fireworks — to be added]
         ↓                                  ↓
   [Provider API]                     [Provider API]
   (OpenAI / Google /               (OpenAI / Fireworks /
    Fireworks / etc.)                 Anthropic / etc.)
         ↓                                  ↓
[Cadence features — ALL built by us]
- Memory recall (memory.server.ts)
- Outcome memory (rememberOutcome)
- Decision indexing (outcome-memory.ts)
- RAG retrieval (retriever.server.ts)
- Reflections (reflection.server.ts)
- Support triage clustering (support-triage.functions.ts)
- The Critic (critic.server.ts)
- The planning loop (loop.server.ts)
```

**What the provider supplies:** raw model inference only. Text in → vector out (embeddings) or text in → text out (completions).

**What Cadence supplies:** everything else. The memory schema, the decision ontology, the supersession engine, the BYOK vault, the cost tracking, the guardrails, the agent loop, the Critic, the governance layer. None of that changes when you swap providers.

**Switching a provider** = change one URL + one API key in the chokepoint. All features continue working.

**When no user brings a BYO key:** the chokepoint falls back to the Lovable gateway (current default) or a designated default provider (Fireworks AI, once wired). The product always runs — the fallback is structural.

---

### The phased provider recommendation (corrected 2026-06-25)

**Phase 1: Demo → first users (NOW)**
→ **Embeddings: migrate to Voyage AI voyage-3** (1,024 dims, 32K token limit). 200M free tokens. ~2.5 hours migration work. Zero production data at risk today — the cheapest this migration will ever be. Better long-document retrieval for the Critic immediately.
→ **Completions: add Fireworks AI** (`Llama 4 Maverick`, $0.15/$0.60) as the default no-key completion provider in `runtime.server.ts`. 94% cheaper than GPT-4o. Lovable gateway stays as fallback.
→ Provider chain for embeddings: BYO OpenAI key → Voyage (new default) → Lovable gateway fallback.
→ Provider chain for completions: BYO key → Fireworks default → Lovable gateway fallback.

**Phase 2: Growing user base**
→ Embeddings stay on Voyage voyage-3 (still within free tier or minimal cost at $0.06/1M past 200M).
→ Completions: evaluate routing high-stakes Critic steps selectively to Claude Sonnet (better reasoning for the decision-challenge logic) while keeping Fireworks for the faster planning loop steps.
→ Add Voyage BYO key to the BYOK vault so enterprise users can bring their own Voyage key.

**Phase 3: Scale (100K+ users, large knowledge bases)**
→ Evaluate Cohere embed-v4 for workspaces with very large knowledge bases (128K token limit embeds entire product documentation in one call; no chunking artifacts in the recall layer).
→ If Google raises the Gemini embedding token limit above 8K, reassess — the MTEB quality (67.71) is genuinely the best available and worth the switch if the truncation problem is resolved.

**Phase 4: Self-host (>100M tokens/month, dedicated ML engineer)**
→ `Qwen3-Embedding-8B` for embeddings (MTEB 70.6, Apache 2.0, beats ALL API models including Google, requires 16GB VRAM).
→ `BGE-M3` (MIT) as the CPU/edge fallback for embedding (dense + sparse in one model, runs on CPU).
→ `Llama 4 Maverick` for completions (Apache 2.0, GPT-4o-mini quality, single A100).
→ BYOK architecture makes this a config change, not a product change.

---

### Why not a single all-in-one provider

No provider is cleanly all-in-one for Cadence's constraints:
- **Fireworks** (embed + completions): embed model is 768 dims, 8K token limit — better cost but same context problem as current OpenAI; completions are the best choice.
- **Google** (embed + completions): embed silently truncates at 2,048 tokens — disqualified for embeddings; completions (Flash-Lite) are genuinely good.
- **Cohere** (embed + completions): embed is best for long docs (128K limit), completions (Command R+) are expensive ($2.50/$10); not cost-effective for the planning loop.
- **Voyage** (embed only): no completions. Best embedding fit, paired with Fireworks for completions.

**The practical two-provider setup:** Voyage AI (embeddings) + Fireworks AI (completions). Two API keys, two billing lines, but the best fit for both tasks at the lowest combined cost. The chokepoint architecture already supports multiple providers; adding a second is a config change.

---

## Sourcing discipline + founder Q&A folded into doctrine (2026-06-20)

**Sourcing discipline (new standing rule).** For any BUY/INTEGRATE, never stop at the incumbent or the obvious name: also source the **newest-generation** entrants AND the **cheaper / more-efficient** alternative, and name the top 3 with trade-offs. This layer commoditizes fast (prices race down, new players appear monthly), so a BUY/INTEGRATE verdict is **re-evaluated periodically, not set once** - the cheapest-credible + self-hostable option wins, and the seam keeps every pick one swap away.

**On the Sandbox "SDK" (clarification - NOT current scope).** A compute-isolation/sandbox SDK is needed ONLY for the future **Build station** (running/previewing the agent's *generated code* in isolation - F-STUDIO / the autonomous Build-to-Ship loop). The current decision-OS scope does not execute untrusted generated code, so **sandbox is DEFERRED** until the Build station ships. It was listed only for register-completeness; it is not a near-term buy. ("SDK" here just means a client library for that isolation runtime; we adopt it only if/when we run generated code, behind our own swappable seam, and Cloudflare is the pick only because we already run on Cloudflare Workers = no new vendor.)

**On payments: Stripe vs Paddle, and where to integrate (Cloud Code vs Lovable).**
- **Stripe vs Paddle:** Stripe is a payment *processor* - you own the merchant relationship and remit your own tax; cheapest (2.9% + $0.30), most control, no lock-in. Paddle is a *Merchant of Record* (MoR) - the legal seller that handles global VAT/sales-tax remittance for you; simpler for worldwide SaaS but higher effective fees (~5%+) and it holds more of the customer/billing relationship. **Recommendation: Stripe now** (control + cheapest + the dormant seam already exists in the repo). Paddle/LemonSqueezy is the **escape hatch** only if global tax compliance becomes a real operational burden - and because it sits behind our own billing seam, switching later is a seam swap, not a rebuild.
- **Cloud Code vs Lovable = ONE repo, it reflects in both.** Cloud Code and Lovable edit the SAME codebase (the git repo is the source of truth; pushes to `main` propagate to Lovable's hosted build). Integrating here and pushing **reflects at Lovable** after sync, and vice versa. Do the integration at the **code level in the repo** (the `WM-M3` dormant `billing.functions.ts` + webhook seam already exists), not by clicking Lovable's "add payment" connector.
- **Keys + the lock-in concern (the important part).** Per the env-var split, payment secrets are **LOCAL-FIRST**: the Stripe secret key + webhook signing secret are **wrangler secrets / env vars YOU control**, NOT pasted into a Lovable-held connector vault. That way Lovable hosts the *runtime* but never *holds your payment keys* - migrating off Lovable later is just re-hosting the repo + re-pointing the same keys, never a hostage situation. (If Lovable's "integrate Stripe" flow would store the key in its vault, prefer the secrets path; confirm via the Lovable MCP if unsure.)
