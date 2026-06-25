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
| **Embeddings** | **BUY** | Commodity racing to zero (~$0.02/M, fungible OpenAI-format calls). Sits under the moat, never in it. | Route through `runtime.server.ts` via a new `embedding` CallSurface (never call the provider directly). Default **Cohere `embed-v4`** (1536 dims native, 128K token limit, OpenAI-compatible API); OSS fallback BGE-M3 / Qwen3-Embedding for the autonomy floor. Stamp model-id + dimension on every vector so re-embed is a background migration, not a rewrite. |
| **Rerank** | **INTEGRATE** | A cheap precision booster on the semantic-match step, stateless (zero switching cost). | A `rerank` CallSurface, **Cohere Rerank 4** via API by default (best on business/finance docs; pairs with embed-v4, same billing). Self-host **Apache-2.0 `zerank-1-small`** for the autonomy floor. **CRITICAL: `zerank-2` is non-commercial licensed — do NOT use in production without commercial license from ZeroEntropy.** Gated to multi-hop / precedent retrieval only. |
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
| Embeddings | BUY (via `embedding` CallSurface) | **Cohere embed-v4** (1536 dims native, 128K token limit, OpenAI-compatible) | **$0.12/1M tok**, metered | BGE-M3 (MIT) |
| Rerank (deferred) | INTEGRATE (via `rerank` CallSurface, multi-hop only) | **Cohere Rerank 4** (best on business/finance; ~$0.001-0.002/search) | cents/mo at demo scale | zerank-1-small (**Apache-2.0** floor only; zerank-2 is **non-commercial** — not for production) |
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
| ~~**Voyage AI**~~ | ~~voyage-3~~ | ~~$0.06 (200M free)~~ | ~~Strong (~65+)~~ | ~~32,000~~ | ~~1,024~~ | **DISQUALIFIED** — no 1536 dims support (fixed 1024 only); MongoDB acquisition = roadmap risk; US-only servers = GDPR risk; non-OpenAI-compatible SDK. See research trail section. |
| **Cohere** | embed-v4 | $0.12 | 65.2 (MTEB) | **128,000** | **1,536** | **RECOMMENDED** — 1536 dims native (zero migration!), 128K token limit, OpenAI-compatible API, EU servers, independent company |
| **OpenAI** (current) | text-emb-3-small | $0.02 | 62.26 | 8,191 | 1,536 | Acceptable; current default; hits ceiling on long PRDs |
| **Nomic / Fireworks** | nomic-embed-v1.5 | **$0.008** | ~62.28 | 8,192 | 768 | Cheapest, same quality as current, good for cost-priority deployments |
| **OpenAI** | text-emb-3-large | $0.13 | Better than small | 8,191 | 3,072 | Same token limit as small; costs 6.5x more; no context advantage |
| ~~**Google**~~ | ~~gemini-emb-001~~ | ~~$0.15~~ | ~~67.71~~ | ~~**2,048 (silently truncates)**~~ | ~~3,072~~ | **Disqualified** — truncates all long PRDs without warning |

**Verdict on embeddings (FINAL — corrected twice, 2026-06-26):** Switch to **Cohere embed-v4** at 1,536 dims. Rationale:
1. **ZERO schema migration** — 1536 is its native output; the `vector(1536)` pgvector columns stay unchanged
2. **128,000 token limit** — handles the longest PRDs, full decision histories, entire knowledge bases in one embedding call; 15x more context than current OpenAI-small
3. **Better MTEB quality** — 65.2 vs 62.26 for OpenAI-small (3-point gain, translates to stronger Critic recall)
4. **OpenAI-compatible API** — drop-in change in `embed.server.ts`: swap `base_url` to Cohere's compatibility endpoint, update model string to `embed-v4`, update API key. 30 minutes of code change.
5. **EU data residency** available (eu-west-1) — no GDPR risk for European customers
6. **Independent company** (not acquired as of research date) — not at MongoDB's roadmap mercy
7. **Cohere Rerank 4** pairs naturally — same billing account, best-in-class for business/finance documents specifically (+400 ELO on that category vs Rerank v3.5)
8. **Re-embed cost**: at demo scale with essentially zero rows, re-embedding existing data is near-instant. Cost at $0.12/1M: the first 10M tokens (enough for thousands of PRDs) = $1.20.

**Why Voyage AI is no longer recommended (research round 3, 2026-06-26):** voyage-3 has FIXED 1024 dims — there is no Voyage model that outputs 1536 dims. Switching to Voyage would require migrating `vector(1536)` → `vector(1024)`. Additionally: acquired by MongoDB in Feb 2025 ($220M) — roadmap is now MongoDB's; US-only API servers with no native EU endpoint (GDPR risk); Voyage's own SDK is not OpenAI-compatible (the Batch API is, but not the standard embedding API). The 200M free tokens are attractive but do not outweigh these constraints.

**If Cohere is unavailable / fallback:** Nomic embed-text-v1.5 via Fireworks ($0.008/1M, 768 dims, 8K limit) is the cost-optimized fallback. Requires migration to `vector(768)`.

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
→ **Embeddings: switch to Cohere embed-v4** (1536 dims native — zero schema migration). Update `embed.server.ts`: swap base_url to Cohere compatibility endpoint, update model string, add Cohere API key. ~30 minutes. Immediate quality improvement (65.2 MTEB vs 62.26) and 128K token limit for full PRDs.
→ **Completions: add Fireworks AI** (`Llama 4 Maverick`, $0.15/$0.60) as the default no-key completion provider in `runtime.server.ts`. 94% cheaper than GPT-4o. Lovable gateway stays as fallback.
→ Provider chain for embeddings: BYO OpenAI key → Cohere embed-v4 (new default) → Lovable gateway fallback.
→ Provider chain for completions: BYO key → Fireworks default → Lovable gateway fallback.

**Phase 2: Growing user base**
→ Embeddings stay on Cohere embed-v4.
→ Add Cohere Rerank 4 (same billing account) for the Critic's retrieval step — highest impact quality improvement for business/finance documents.
→ Completions: route high-stakes Critic steps selectively to Claude Sonnet 4 (better reasoning for decision-challenge logic) while keeping Fireworks for the faster planning loop steps.
→ Add Cohere BYO key to the BYOK vault so enterprise users can bring their own Cohere key.

**Phase 3: Scale (100K+ users, large knowledge bases)**
→ Cohere embed-v4 already handles entire product corpora at 128K tokens — no provider switch needed.
→ Add `Qwen3-Embedding-8B` (Apache 2.0, MTEB 70.6, beats ALL API models) as self-host option for enterprise-tier workspaces.

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

**The practical two-provider setup (REVISED 2026-06-26):** Cohere (embeddings + reranking) + Fireworks AI (completions). Two vendors, one Cohere billing account covering both embed and rerank, one Fireworks account for completions. Best fit for all three tasks at the lowest combined cost with zero dimension migration. The chokepoint architecture already supports multiple providers; adding a second is a config change.

---

### Data privacy, compliance, server locations, and operational risks (2026-06-26)

> **Why this matters for Cadence.** Embedding calls send the actual content of user workspace data — PRDs, decision narratives, signals, support conversations — to the provider's servers. This is real customer data, not metadata. Every provider Cadence uses for AI inference is a **data subprocessor** under GDPR Article 28. This section documents the compliance posture of every provider in the stack so the privacy/legal review is not re-derived from scratch.

#### What data leaves Cadence's servers on each inference call

| Call type | Data sent to provider | Privacy sensitivity |
|---|---|---|
| Embedding a PRD / signal / decision | Full document text, up to the token limit | High — contains customer's product strategy |
| Embedding a memory / outcome | Outcome narrative (e.g. "we shipped X, it missed ICE by Y") | High — strategic business context |
| Completion (agent loop / Critic) | System prompt + user context + tool results | High — decision content + workspace history |
| Rerank | Query text + candidate document excerpts | High — same as above |

This data classification means the provider's data residency, retention, and GDPR posture directly affect Cadence's own privacy obligations to its customers.

#### Per-provider compliance matrix

| Provider | Server locations | GDPR EU option | SOC 2 | HIPAA | Data training opt-out | DPA available | Self-host option | Acquisition/continuity risk |
|---|---|---|---|---|---|---|---|---|
| **Cohere embed-v4** (recommended) | `us-east-1`, **`eu-west-1`**, APAC | **Yes** — EU inference region routes data within EU | Type II | Yes | Standard API: yes (API inputs not used for training per DPA) | Yes | "Cohere North" on-prem enterprise (requires enterprise contract); API-only for standard tiers | Low — independent company, enterprise-partnered (SAP, AWS, Azure) |
| **Cohere Rerank 4** (recommended) | Same as embed-v4 | Same | Same | Same | Same | Same | Same | Same |
| **Fireworks AI** (completions) | US-based | **Unknown** — not confirmed in research; no EU server documentation found | **Unknown** | **Unknown** | **Unknown** | **Unknown** | Llama 4 Maverick is Apache 2.0 — full self-host option | Low — established company; open model means no provider lock-in |
| **OpenAI** (current default / fallback) | US | Enterprise: EU Data Residency API available; Standard API: US processing | Type II | Yes | Zero Data Retention (ZDR) available via API headers | Yes | Not available | Very low — industry standard |
| **Voyage AI** (disqualified) | **US-only** (api.voyageai.com + ai.mongodb.com) | **No native EU endpoint** — VPC deployment via AWS/Azure Marketplace is the only option (runs containerized model in your cloud account/region; not self-hosted weights) | Unknown | Unknown | Zero-day retention opt-out available (SCCs-based transfer for GDPR) | Unknown | voyage-4-nano only (HuggingFace); all other models API-only | **High** — acquired by MongoDB Feb 2025 ($220M); roadmap now MongoDB's |
| **ZeroEntropy zerank-2** (API) | Unknown | Unknown | Unknown | Unknown | Unknown | **Non-commercial license on weights** — API commercial use may require separate agreement | Apache-2.0 `zerank-1-small` is safe; **zerank-2 weights are CC-BY-NC** | Unknown/startup |
| **BGE-M3 / Qwen3-Embedding** (OSS floor) | **Self-hosted** (in your Cloudflare Worker or sidecar) | Full data control — data never leaves your infrastructure | N/A — you own it | N/A | N/A — no data sent to any provider | N/A | MIT / Apache-2.0 | None — you own the weights |

#### GDPR specifics for current + recommended providers

**Cohere (embed + rerank):**
- EU inference region (`eu-west-1`) means data can stay within EU — satisfies GDPR data transfer requirements without SCCs
- Standard Contractual Clauses (SCCs) also available for US-based inference where EU routing is not selected
- SOC 2 Type II + HIPAA certified (strong subprocessor profile for enterprise customers)
- "Cohere North" program provides on-premises deployment (enterprise contract; runs in customer's VPC; full data sovereignty)
- For standard API use, Cohere's DPA confirms API inputs are not used to train their models

**Fireworks AI (completions) — verification required:**
- No EU infrastructure confirmed in available documentation
- Before enabling Fireworks as a production default for EU customers: verify DPA existence and US-to-EU data transfer mechanism (SCCs typically available for US API providers)
- Mitigation: Llama 4 Maverick is Apache 2.0 — self-hostable on Cloudflare Workers via GGUF/WASM or a sidecar. If GDPR becomes a blocker for Fireworks, self-hosting the completion model is the escape hatch.

**OpenAI (current default):**
- Standard API processes data in US; EU Data Residency API is enterprise-tier only
- Zero Data Retention (ZDR) headers can prevent storage of any inputs (relevant for Critic conversations containing sensitive decision context)
- Well-established DPA + SCCs

#### License risks (non-obvious)

| Asset | License | Commercial use? | Risk |
|---|---|---|---|
| zerank-2 API usage | CC-BY-NC on weights | **Unclear** — API use may differ from weight use; contact ZeroEntropy | Do not use in production without confirming commercial terms |
| zerank-1-small (self-host) | Apache-2.0 | Yes | Safe for commercial use |
| zerank-2 weights (self-host) | CC-BY-NC | **No** — non-commercial only | Never self-host in production |
| Llama 4 Maverick | Apache-2.0 | Yes | Safe for commercial use |
| BGE-M3 | MIT | Yes | Safe |
| Qwen3-Embedding-8B | Apache-2.0 | Yes | Safe |
| voyage-4-nano | Apache-2.0 | Yes | Only open-weight Voyage model |
| All other Voyage models | Proprietary | API use only | No self-hosting possible |

#### Acquisition and service-continuity risks

| Provider | Risk | Mitigation |
|---|---|---|
| **Voyage AI** (MongoDB-owned) | MongoDB controls the roadmap; could pivot away from standalone embedding API to favor Atlas Search | Already disqualified. Don't build dependency on it. |
| **ZeroEntropy** | Small company, unknown funding, compliance posture unverified | Use Cohere Rerank 4 for production; zerank-1-small for self-host floor only |
| **Cohere** | Independent, enterprise-contracted, not acquired as of 2026-06-26 | Low risk; monitor |
| **Fireworks AI** | Established, open models mean worst-case is just switching the API endpoint | Low risk; Apache 2.0 Llama 4 = no lock-in |
| **OpenAI** | Industry standard; any degradation is widely visible immediately | Very low risk |

#### What Cadence must do before launching to EU customers

1. **Verify subprocessor list**: add Cohere, Fireworks AI, and OpenAI (or whichever providers are live) to Cadence's privacy policy subprocessor list
2. **Cohere**: route EU workspace embeddings to `eu-west-1` endpoint (set `api-region: eu` header or use the EU base URL) — this is a single config param
3. **Fireworks AI**: obtain a DPA and confirm SCCs before enabling for EU workspaces, OR self-host Llama 4 Maverick as the EU completion default
4. **Enable ZDR headers on OpenAI** (if still in the fallback chain): add `OpenAI-ZeroRetention: true` header in `runtime.server.ts` for any calls involving sensitive content
5. **Document in Cadence's own DPA**: "We use Cohere (EU) for embedding and reranking, and Fireworks AI (US) or self-hosted Llama 4 for completions"

#### Rate limits and operational resilience

| Provider | Rate limit (free/standard) | Upgrade path | Outage mitigation |
|---|---|---|---|
| Cohere embed-v4 | Trial: 40 calls/min; Pay-as-you-go: 1,000 calls/min | Contact support for higher limits | Fallback: OpenAI text-emb-3-small (already wired in resolveEmbedRoute) |
| Cohere Rerank 4 | Pay-as-you-go: varies | Contact support | Fallback: native = skip reranking (graceful degradation) |
| Fireworks AI | No published per-account limit at standard tier | Enterprise SLA available | Fallback: Lovable gateway (already wired) |
| OpenAI | Tier-based (starts at 500 RPM / 30K TPM) | Credit spend increases tier | Fallback: Fireworks or Lovable gateway |
| Voyage AI | Tier 1: 2,000 RPM / 8M TPM | Tier 2 at $100 cumulative spend | N/A — disqualified |

---

## Sourcing discipline + founder Q&A folded into doctrine (2026-06-20)

**Sourcing discipline (new standing rule).** For any BUY/INTEGRATE, never stop at the incumbent or the obvious name: also source the **newest-generation** entrants AND the **cheaper / more-efficient** alternative, and name the top 3 with trade-offs. This layer commoditizes fast (prices race down, new players appear monthly), so a BUY/INTEGRATE verdict is **re-evaluated periodically, not set once** - the cheapest-credible + self-hostable option wins, and the seam keeps every pick one swap away.

**On the Sandbox "SDK" (clarification - NOT current scope).** A compute-isolation/sandbox SDK is needed ONLY for the future **Build station** (running/previewing the agent's *generated code* in isolation - F-STUDIO / the autonomous Build-to-Ship loop). The current decision-OS scope does not execute untrusted generated code, so **sandbox is DEFERRED** until the Build station ships. It was listed only for register-completeness; it is not a near-term buy. ("SDK" here just means a client library for that isolation runtime; we adopt it only if/when we run generated code, behind our own swappable seam, and Cloudflare is the pick only because we already run on Cloudflare Workers = no new vendor.)

**On payments: Stripe vs Paddle, and where to integrate (Cloud Code vs Lovable).**
- **Stripe vs Paddle:** Stripe is a payment *processor* - you own the merchant relationship and remit your own tax; cheapest (2.9% + $0.30), most control, no lock-in. Paddle is a *Merchant of Record* (MoR) - the legal seller that handles global VAT/sales-tax remittance for you; simpler for worldwide SaaS but higher effective fees (~5%+) and it holds more of the customer/billing relationship. **Recommendation: Stripe now** (control + cheapest + the dormant seam already exists in the repo). Paddle/LemonSqueezy is the **escape hatch** only if global tax compliance becomes a real operational burden - and because it sits behind our own billing seam, switching later is a seam swap, not a rebuild.
- **Cloud Code vs Lovable = ONE repo, it reflects in both.** Cloud Code and Lovable edit the SAME codebase (the git repo is the source of truth; pushes to `main` propagate to Lovable's hosted build). Integrating here and pushing **reflects at Lovable** after sync, and vice versa. Do the integration at the **code level in the repo** (the `WM-M3` dormant `billing.functions.ts` + webhook seam already exists), not by clicking Lovable's "add payment" connector.
- **Keys + the lock-in concern (the important part).** Per the env-var split, payment secrets are **LOCAL-FIRST**: the Stripe secret key + webhook signing secret are **wrangler secrets / env vars YOU control**, NOT pasted into a Lovable-held connector vault. That way Lovable hosts the *runtime* but never *holds your payment keys* - migrating off Lovable later is just re-hosting the repo + re-pointing the same keys, never a hostage situation. (If Lovable's "integrate Stripe" flow would store the key in its vault, prefer the secrets path; confirm via the Lovable MCP if unsure.)

---

## Research trail: how the embedding recommendation evolved (2026-06-25 → 2026-06-26)

> This section documents the full research process so the decision trail is transparent and future pivots are informed, not re-derived.

### Round 1 — initial analysis (WRONG)

First pass recommended **Google gemini-embedding-001** based on its MTEB score (67.71, highest of any API model). This was incorrect. The MTEB benchmark is measured on short passages. The 2,048-token input limit was not checked, and it was not disclosed in marketing materials.

**What was missed:** For Cadence's workload (full PRDs at 4,000–15,000 words, decision narratives, large context windows), Google Gemini truncates silently at ~1,500 words of input. The embedding vector represents only the first third of the document. The Critic then retrieves "relevant" precedents based on a fragment. The MTEB score is meaningless in this context.

### Round 2 — correction (PARTIAL)

Google Gemini disqualified. New recommendation: **Voyage AI voyage-3** at 1,024 dims (32K token limit, 200M free tokens). Rationale: better long-document fit, free for demo phase.

**What was missed:** voyage-3 outputs 1,024 dims ONLY. Switching from the current `vector(1536)` columns requires a full dimension migration (ALTER TABLE, re-embed all rows). Additionally, the Voyage AI company stability question was not researched: they were acquired by MongoDB for $220M in February 2025.

### Round 3 — deep research (FINAL, 2026-06-26)

Background research agent verified all providers. Key findings:

**Voyage AI restrictions — full picture (disqualifying):**
- **No 1536 dims support**: voyage-3 = fixed 1024 dims. voyage-3-large, voyage-3.5, voyage-4 series = Matryoshka at 256/512/1024/2048 dims. NO Voyage model supports 1536 dims. The only legacy model with 1536 is `voyage-code-2` (code-specific, fixed, no Matryoshka). This means switching to ANY Voyage model requires a dimension migration.
- **MongoDB acquisition (Feb 2025, $220M)**: Voyage AI is now a MongoDB business unit. Roadmap is controlled by MongoDB. Models are being served from `ai.mongodb.com/v1/` alongside the legacy `api.voyageai.com` domain. Risk: MongoDB could deprioritize embedding APIs that don't serve Atlas customers.
- **US-only API servers**: No native EU API endpoint. European users asked about EU deployment in the community forum; Voyage did not announce EU infrastructure. For GDPR compliance, the only option is VPC deployment via AWS/Azure Marketplace (runs inside your cloud account in the region you choose) — which works but adds infrastructure complexity.
- **Non-OpenAI-compatible SDK**: The standard Voyage API uses the `voyageai.Client` Python SDK, not the OpenAI format. Only the Batch API is explicitly OpenAI-compatible. This means switching to Voyage is not a drop-in change.

**ZeroEntropy zerank-2 — non-commercial license (CRITICAL FIX):**
The existing BBI doc listed zerank-2 as a `$0.025/1M` commercial API. This is wrong. zerank-2 is released under a **non-commercial license** on HuggingFace. Using it in a commercial product (Cadence is commercial) requires a separate license agreement with ZeroEntropy. Contact ZeroEntropy before any production use. The **safe floor** is `zerank-1-small` which is Apache-2.0. The **correct commercial pick** for the managed API is **Cohere Rerank 4** (same vendor as embeddings, best on business/finance documents at +400 ELO over Rerank v3.5 on that category, ~$0.001-0.002/search).

**Cohere embed-v4 — confirmed:**
- 128,000 token limit: confirmed from official changelog.
- 1536 dims: confirmed as the maximum and native output (not a truncation from a larger dim). `output_dimension=1536` returns full-resolution embeddings.
- MTEB: 65.2 overall (vs OpenAI-small 62.26). Retrieval subtask: ~56.10 nDCG@10 (single source; verify against live MTEB leaderboard before finalizing).
- OpenAI-compatible API: YES. Cohere maintains `https://api.cohere.ai/compatibility/v1`. Set `base_url` to this URL, use OpenAI SDK, swap API key. embed-v4.0 is explicitly available through this endpoint.
- EU data residency: confirmed. Inference regions include `eu-west-1`. "Cohere North" on-premises enterprise option also available.
- Company: independent, enterprise-partnered (SAP, AWS, Azure), not acquired. Stable profile.

**Final verdict: Cohere embed-v4 + Fireworks Llama 4 Maverick + Cohere Rerank 4.**

---

## Founder Q&A answered (2026-06-26)

### Q: Are there other Voyage AI restrictions we have not considered?

Yes — four serious ones beyond the token limit:
1. **Dimension lock-in**: No Voyage model supports 1536 dims. Every Voyage model requires a schema migration from current `vector(1536)`.
2. **MongoDB acquisition**: Voyage roadmap is now MongoDB's. Risk of deprioritization if it doesn't serve Atlas Search customers.
3. **US-only servers**: No native EU endpoint. GDPR compliance requires VPC deployment workaround.
4. **Non-OpenAI-compatible SDK**: Standard embedding API requires Voyage's own client. Switching cost is higher than for OpenAI-drop-in providers.

Combined verdict: Voyage is disqualified for Cadence's use case. The 200M free tokens are attractive but do not outweigh these four constraints.

### Q: What are alternative embedding providers?

Ranked for Cadence's specific constraints (long-document RAG, 1536 dims preferred, managed API):

| Rank | Provider | Model | Dims | Token limit | Why |
|---|---|---|---|---|---|
| 1 (pick this) | **Cohere** | embed-v4 | 1536 | 128K | Zero migration, best long-doc fit, OpenAI-compatible, EU servers |
| 2 (fallback) | **OpenAI** | text-emb-3-small | 1536 | 8,191 | Current provider; acceptable; hits ceiling on large PRDs |
| 3 (cost tier) | **Fireworks** | nomic-embed-v1.5 | 768 | 8,192 | Cheapest ($0.008/1M), same quality as current, but requires migration to vector(768) |
| Disqualified | **Voyage AI** | voyage-3 | 1024 | 32K | MongoDB-owned, US-only, no 1536 dims, non-OAI SDK |
| Disqualified | **Google Gemini** | gemini-emb-001 | 3072 | **2,048** | Silently truncates all full PRDs |

### Q: Is the embedding migration one-time or recurring?

**With Cohere embed-v4: this is a one-time change, and it may be the last.** There are two operations when switching embedding providers:
1. **Schema migration** (ALTER vector column dims): only needed if the new model outputs different dims than current. Cohere embed-v4 outputs 1536 natively — same as current. **Zero schema migration.**
2. **Data re-embed** (re-run all existing rows through the new model): always required when changing models (the vectors from model A are not comparable to vectors from model B). This is a background job, non-destructive, runs in parallel with live traffic. At demo scale with near-zero rows: near-instant.

Future migrations: only if you switch providers again. With Cohere as a stable, well-funded, independent company with a 128K token limit (there's nowhere to upgrade to), the probability of needing to switch again is low. This is the last migration for the foreseeable future.

### Q: Should we do the migration now or later?

**Now, with Cohere.** The reasons:

- **Zero schema migration risk**: Cohere embed-v4 stays at 1536 dims. The "migration" is a 30-minute code change in `embed.server.ts` (swap base_url, model string, API key). No SQL ALTER TABLE.
- **Data re-embed cost at demo scale**: near-instant. The cost at $0.12/1M is approximately $1.20 for the first 10M tokens — enough for thousands of PRDs.
- **Quality improvement is immediate**: the Critic gets better recall from the first query after the switch. The 3-point MTEB improvement and the 128K token limit both show up immediately in retrieval quality.
- **Never gets easier**: as users add data, a re-embed job takes longer. Do it at zero rows.

### Q: Should we exit Lovable at the same time?

**No. Keep these two decisions separate.** The Lovable exit is a 1.5–2.5 week engineering project (detailed below). The Cohere provider switch is a 30-minute code change. Bundling them creates unnecessary risk — if either goes wrong, it's unclear which caused the problem. Do the Cohere switch now; plan the Lovable exit for after first revenue.

---

## Lovable exit: full analysis (2026-06-26)

> This section covers what Lovable actually manages for Cadence, what exiting involves, the realistic effort, and the right timing.

### What Lovable manages right now

Lovable is not just a code editor. For Cadence, it currently manages:

| What | What Lovable does | Self-manage equivalent |
|---|---|---|
| **Application hosting** | Deploys to Cloudflare Workers on every push to the connected branch | GitHub Actions + `wrangler deploy` (manual CI/CD) |
| **SSL/TLS + CDN** | Provided automatically through Cloudflare global network | Cloudflare remains (Lovable uses Cloudflare Workers; moving off Lovable keeps Cloudflare Workers) |
| **Custom domain** | DNS routing through Lovable's subdomain or your own domain | Point domain's DNS A/CNAME records to Cloudflare directly |
| **Supabase database** | Lovable Cloud Supabase instance — **owned and managed by Lovable, not by you** | Export schema + data → create new Supabase project under your own account |
| **Authentication** | Auth flows via `@lovable.dev/cloud-auth-js` bound to the Lovable Supabase instance | Swap to native `@supabase/supabase-js` auth against your own Supabase project |
| **OAuth provider registration** | OAuth clients (GitHub, Google, etc.) are registered against Lovable Supabase's redirect URIs | Re-register OAuth apps with new redirect URIs pointing at your Supabase |
| **CI/CD pipeline** | Auto-builds on GitHub push, runs checks, deploys | GitHub Actions with Wrangler action (write once, maintain yourself) |
| **Secrets management** | Stores env vars / secrets in Lovable's vault | Wrangler secrets (`wrangler secret put KEY value`) + GitHub Actions secrets |
| **Lovable AI editor** | The AI agent that generates code changes | Claude Code (already in use), Lovable can still be used optionally post-migration |

**Critical finding**: When using Lovable Cloud, the Supabase database is owned by Lovable — not visible in your personal Supabase dashboard. Lovable's own documentation confirms: "If your project is already connected to Lovable Cloud, there is currently no way to disconnect it and switch to an external Supabase project." There is no automated ejection tool.

**How to verify which type you have**: Log into supabase.com. If the Cadence project appears under your account, it's self-provisioned (you own it — the exit is simpler). If it does NOT appear, it's Lovable Cloud.

### Tech stack portability assessment

| Layer | Portable? | Notes |
|---|---|---|
| Application code (TanStack Start + Vite + Cloudflare Workers) | **Yes, fully** | The entire codebase is in git under your control. GitHub sync means you already own it. |
| `wrangler.toml` + Cloudflare Workers config | **Yes** | Already present and configured. `wrangler deploy` works from the repo today. |
| Supabase schema (DDL) | **Yes, extractable** | Export via `mcp__supabase__execute_sql` or `pg_dump`. All migrations are in `supabase/migrations/`. |
| Supabase data | **Yes, but manual** | Row-level CSV export or `COPY` commands. At demo scale (small data volume) this is straightforward. |
| RLS policies | **Yes, they're in migrations** | Already written in `supabase/migrations/`. Re-apply to new Supabase project. |
| `@lovable.dev/cloud-auth-js` | **No, needs swap** | Must be replaced with `@supabase/supabase-js` native auth. This is the most code-invasive change. |
| OAuth app registrations | **No, needs re-provisioning** | New OAuth apps must be created (GitHub, Google) with new redirect URIs pointing at the new Supabase project's auth endpoint. |
| AI gateway proxy (Lovable gateway) | **Partially** | Already routed around for BYO keys. Adding Fireworks + Cohere direct routing removes the Lovable gateway dependency entirely for AI calls. |
| Secrets / env vars | **Yes, yours already** | Local `.env` + wrangler secrets are already under your control per the env-var split. |

### Exit effort by component

| Component | Effort | Complexity | Notes |
|---|---|---|---|
| Create new Supabase project (self-managed) | 1–2 hours | Low | Click-to-create; copy over env vars |
| Export schema SQL and re-apply | 2–4 hours | Medium | `supabase db dump` or manual DDL assembly from migrations; apply to new project |
| Export data from Lovable Cloud Supabase | 2–6 hours | Medium–High | No automated tool; CSV export or scripted `COPY TO`. Depends on data volume. auth.users table needs special handling. |
| Replace `@lovable.dev/cloud-auth-js` with Supabase native auth | **2–5 days** | **High** | Must trace all usage of Lovable auth (session provider, token verification in server functions, auth guards). Each reference needs a native Supabase equivalent. This is the largest unknown. |
| Re-provision OAuth apps (GitHub, Google) | 2–4 hours | Low | Create new OAuth apps in each provider's developer console; update redirect URIs; update env vars. |
| GitHub Actions CI/CD + Wrangler deploy | 1–2 days | Low–Medium | Write the workflow once; add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub secrets; test preview + production deployments. |
| DNS cutover (custom domain) | 1–2 hours | Low | Update A/CNAME records; 5–15 min propagation. |
| End-to-end testing after migration | 1–2 days | Medium | Full auth flows (login, OAuth, session persistence), all API routes, agent loop, RLS assertions. |

**Total realistic estimate: 1.5 to 2.5 weeks of focused engineering** (assuming one experienced engineer). The range depends primarily on how deeply `@lovable.dev/cloud-auth-js` is embedded in server-side auth verification.

### What you gain from exiting Lovable

| Benefit | Impact |
|---|---|
| Full database ownership | See, backup, and query your own data directly. No Lovable intermediary for schema changes. |
| Direct Supabase access | Studio UI, direct DB connection strings, pgbouncer, direct service role key usage. |
| CI/CD control | Deploy on any push policy you want (branches, PR previews, staging envs). |
| No Lovable credit dependency | Build sessions on Lovable consume credits. Post-exit: unlimited code changes via Claude Code. |
| Self-managed secrets | Already mostly true (env-var split ensures this), but fully true post-exit. |
| Freedom to change any layer | New auth providers, different edge runtime, different CDN — no Lovable constraints. |

### What you lose

| Cost | Impact |
|---|---|
| Lovable AI editor | Must use Claude Code exclusively (already the primary tool). |
| Auto-deploy on push | Must maintain GitHub Actions yourself (one-time setup, ~1 day). |
| Managed infrastructure | Database backup, monitoring, scaling = your responsibility. Supabase's own tooling handles most of this. |
| Lovable's project-level features | Knowledge base, project analytics, Lovable-specific connectors — unused by Cadence, not a real loss. |

### The right timing: when to exit Lovable

**Do NOT exit during the demo/MVP phase.** The Lovable platform provides:
- Zero-effort hosting with global delivery (you don't have to think about it)
- Auto-deploy that keeps the app running while you focus on features
- A working Supabase setup you can query via MCP

These are valuable at the current stage. The cost (Lovable credits) is low relative to the opportunity cost of 1.5–2.5 weeks of migration engineering.

**Exit when ALL of the following are true:**
1. **First paying customer** — you have revenue, the product is validated, migration disruption is worth the control gain.
2. **Technical co-founder or second engineer** — migration is complex enough to need a dedicated person; doing it solo while also building features is too expensive.
3. **Lovable costs are material** — at high build volume, credit spend becomes noticeable. That's the right trigger.
4. **Data volume is still manageable** — the longer you wait past first revenue, the larger the Supabase data export gets. Earlier is easier on the data side, but the engineering trade-off above dominates.

**The single action to do NOW** (before exiting): verify whether your Supabase is Lovable Cloud or self-provisioned by logging into supabase.com. If it's already self-provisioned, much of the exit work evaporates (schema/data export is trivial, no Lovable-specific Supabase lock-in).

### The right way to position the exit

The Lovable exit is not a crisis or an emergency. It is a **planned infrastructure graduation**:
- Phase 1 (now → first revenue): Use Lovable; keep all secrets local-first; avoid Lovable connector vault for any credentials; do all real work via Claude Code + git.
- Phase 2 (post first revenue): Plan the exit. Two-week sprint. One dedicated engineer. Database migration first, auth swap second, CI/CD third.
- Phase 3 (post-exit): Fully self-managed on Cloudflare Workers + your own Supabase. No vendor owns your data or your deploy pipeline.

The codebase is already structured for this. `wrangler.toml` is already present. The env-var split already ensures secrets are not in Lovable's vault. The migration is hard because of the auth layer, not because the codebase is entangled with Lovable.
