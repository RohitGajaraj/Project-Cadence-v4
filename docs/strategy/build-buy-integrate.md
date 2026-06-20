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
