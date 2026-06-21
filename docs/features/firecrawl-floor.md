# FIRECRAWL-FLOOR — the web-search autonomy floor (native SearXNG fallback)

> _Created: 2026-06-21 · Owner: the loop (Lane 1) · Build Sequence #6 (Tier 1, Foundational, BBI autonomy-floor fix)_

> Status · Shipped ◐ 2026-06-21 (lane 1). Code + unit tests green offline; the live SearXNG path activates when the operator self-hosts an instance and sets `SEARXNG_URL` (deployment config, not a gated decision).

## What it does

The agent's `web.search` tool must not hard-depend on a single paid provider. Before this change, `webSearch` (in `src/lib/ai/tools/firecrawl.server.ts`) called Firecrawl unconditionally and **hard-threw** when `FIRECRAWL_API_KEY` was missing — so on any deployment without a paid Firecrawl key, the agent's web search was simply broken. FIRECRAWL-FLOOR makes `webSearch` provider-agnostic with a native, zero-external-paid-dependency fallback:

1. **`FIRECRAWL_API_KEY` set** → the existing Firecrawl path, **byte-identical** to before.
2. **else `SEARXNG_URL` set** → a self-hosted **SearXNG** metasearch instance (the autonomy floor). SearXNG is open-source the operator runs themselves; no paid dependency.
3. **else** → a clear error that names **both** options (set a Firecrawl key, or self-host SearXNG and set `SEARXNG_URL`), instead of the old Firecrawl-only message.

This is the BBI doctrine made real: *a zero-external-paid-dep native default that must always be able to hold the floor.* See [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md) (`SELF-HOST` / FIRECRAWL-FLOOR is the worked example) and the Sourcing Map.

## Scope (and deliberate non-scope)

- **In scope:** `webSearch` only. SearXNG is a **search** engine (it returns result snippets), so it is a fallback for search, the most common agent web need.
- **Out of scope (Firecrawl-only):** `webFetch` (single-URL scrape), `webMap` (URL discovery), and `webCrawl` (bounded crawl) have **no SearXNG equivalent** (SearXNG does not scrape page bodies). They keep the Firecrawl path and its error. A native scrape fallback (plain `fetch` + HTML-to-text) is a possible later follow-up, not this row.
- **Known boundary:** `research.server.ts` gates its web-research leg on `FIRECRAWL_API_KEY` being present, so the deep-research orchestrator will not yet exercise the SearXNG floor until that gate is widened to also accept `SEARXNG_URL`. That is a documented follow-up (FIRECRAWL-FLOOR-b); the agent's direct `web.search` tool — the primary autonomy-floor primitive — uses the floor today.

## How it works

- **`src/lib/ai/tools/web-search-fallback.ts`** (pure, client-safe, unit-tested): the provider-agnostic core, kept out of the `.server` shell so it is testable with no network or env.
  - `selectWebBackend(env)` → `"firecrawl" | "searxng" | "none"`, by precedence (a blank/whitespace value counts as unset, so a stray empty env var never selects a backend that will then fail every call).
  - `buildSearxngQueryUrl(base, opts)` → the SearXNG JSON search URL: trims a trailing slash, caps the query at 300 chars (mirrors the Firecrawl path), url-encodes every param (so a query can never inject extra params or a path), and adds `time_range` only for a valid recency window.
  - `normalizeSearxngResults(raw, opts)` → `WebSearchHit[]`: defensive against the `unknown` wire shape (a non-array `results`, missing/non-string fields, and url-less rows are all dropped rather than throwing). It maps SearXNG's `results[].{url,title,content}` to `{url,title,description}` and **never fabricates a `markdown` field** (SearXNG returns snippets, not scraped bodies), so the agent gets honest search results.
  - `WebSearchHit` is defined here and **re-exported** from `firecrawl.server.ts`, so existing importers (`research.server.ts`) are unaffected.
- **`src/lib/ai/tools/searxng.server.ts`** (server-only): the thin HTTP shell. Reads `SEARXNG_URL` from `process.env` on every call (Cloudflare Workers must not capture a stale value at module load), fetches `…/search?format=json`, and delegates parsing to the pure helpers. A non-OK response or unreachable instance throws a clear `SearXNG <status>` error, surfaced to the agent loop exactly like a Firecrawl error.
- **`src/lib/ai/tools/firecrawl.server.ts`**: `webSearch` resolves the backend before any I/O and routes accordingly; the Firecrawl branch (and `webFetch`/`webMap`/`webCrawl`) is unchanged.

## Governance & guardrails

- **The untrusted-input contract is preserved.** SearXNG results flow through the same `webSearch` return shape into the agent loop, so the next `callModel`'s pre-guardrails (prompt-injection / PII / secret-keyword) treat them as untrusted exactly as they treat Firecrawl results. The fallback adds a backend, not a bypass.
- **No new outbound paid dependency.** SearXNG is operator-self-hosted; the platform makes no paid call on the floor path.
- **Additive and low blast-radius.** A leaf web tool only; the agent loop, the tool registry (`registry.server.ts`), the runtime chokepoint, and the guardrails are untouched.

## Verification

- `bun test src/lib/ai/tools/web-search-fallback.test.ts` (19 tests: env precedence + blank handling, recency mapping, limit clamping, URL building + query-injection encoding, SearXNG wire-shape normalization including hostile/null input). `tsc --noEmit` 0; `bun --bun run build` green; full suite green.
- ◐ **live-verify on a deployment with `SEARXNG_URL`**: point it at a self-hosted SearXNG instance, unset the Firecrawl key, and confirm `web.search` returns results from SearXNG.

## Related

- [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md) — the BBI gate (FIRECRAWL-FLOOR is the named SELF-HOST autonomy-floor example).
- [`../strategy/sourcing-map.md`](../strategy/sourcing-map.md) — the per-cluster sourcing verdicts.

## Update: FIRECRAWL-FLOOR-b (the /research pipeline inherits the floor)

_2026-06-21 (Lane 3)._ The parent above wired the floor into the agent's `web.search` tool. The deep `/research` pipeline (`runResearch` in `src/lib/ai/research.server.ts`) had a separate web gate that still keyed on `FIRECRAWL_API_KEY` alone, so a SearXNG-only deployment got NO web research from `/research` even though the floor existed one layer down.

**Fix (surgical):** the gate now reads `selectWebBackend({ FIRECRAWL_API_KEY, SEARXNG_URL }) !== "none"` — the SAME selector `webSearch` already uses to pick its backend, so the gate can never drift from the backend actually chosen. `gatherWeb` calls `webSearch`, which routes Firecrawl-first then the SearXNG floor, so widening only the gate is sufficient; no call-site rewrite. Firecrawl deployments are byte-identical (the selector returns `"firecrawl"`, non-`"none"`). A SearXNG-only deployment now reaches the web leg, and `gatherWeb`'s existing `.catch` still degrades to `[]` if the instance is down.

**Verification:** `tsc --noEmit` 0; the gate predicate is covered transitively by `web-search-fallback.test.ts` (selectWebBackend: SearXNG-only → `"searxng"`, neither → `"none"`, blank-value handling); full suite green. Single-agent adversarial review: **APPROVE, 0 findings** (no Firecrawl regression, graceful degradation intact, gate/selector drift impossible, no orphaned raw `FIRECRAWL_API_KEY` guard left behind, no new injection surface — SearXNG returns snippets not scraped bodies, and web sources are already fenced as UNTRUSTED). ◐ live-verify on a `SEARXNG_URL`-only deployment: run `/research` in web/both mode and confirm web hits come from SearXNG.
