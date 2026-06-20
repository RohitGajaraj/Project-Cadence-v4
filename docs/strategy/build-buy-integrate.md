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
