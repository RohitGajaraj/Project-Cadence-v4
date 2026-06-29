# MODEL-AGNOSTIC (MA-1) — Model-agnostic AI backend + capability routing

> Status · Engine shipped 2026-06-30 (Lane 2) · runtime/chokepoint + catalog + Settings/chat UI · Owner: platform
> Twin of BLD-04 / [`build-driver-and-dispatch.md`](../strategy/build-driver-and-dispatch.md) (the code-gen path). This doc is the **chat/AI chokepoint** path.
> Reconciles WM-M9 — see [Governance](#governance--guardrails). Build log: [`../../plan.md`](../../plan.md) §4.

## What it does

Cadence's AI backend is now **model-agnostic**: every internal AI action (agent steps, daily briefs, idea bucketing/clustering, research synthesis, chat) can be powered by **any** model from **any** provider — Anthropic, OpenAI, Google, DeepSeek, xAI, Moonshot, Qwen, MiniMax, Mistral, Groq, OpenRouter, Together, Fireworks, Perplexity, a self-hosted vLLM/Ollama, or anything else that speaks the OpenAI Chat Completions shape (Anthropic Messages is also handled). The platform operator plugs a provider in by setting two env vars — no code change, no closed list. On top of that, a **Perplexity-style capability router** sends each call to the model **best at the task** (code, reasoning, vision, long-context, fast chat), "optimized by us," plus a consumer-facing **Auto** mode in the model picker.

## Why it exists

Before this, the catalog was a closed 7-provider union and the chokepoint resolved provider endpoints by a hardcoded prefix switch (`byoConfig`) that returned `null` for anything it did not recognize — so a model like `qwen/...` silently fell through to the managed gateway and 400'd, and a stored `base_url` was honored only on the Settings "Test" path, never on real calls. The platform was effectively locked to ~5 providers. The founder's mandate (2026-06-29): the platform's own AI must be pluggable with any model/token + base URL, and routed to the best model per task for output quality and cost/token efficiency. See [`../../plan.md`](../../plan.md) §4.

## Where to find it

- **Model picker** (chat composer · `ModelSwitcher`): a full, provider-grouped catalog with **Auto** at the top.
- **Settings → AI & models** (`/settings?section=ai`): default-model selector now offers **Auto**; the BYO-key form ("Test" supports a custom model id).
- **Backend** (no UI): all internal AI routing happens at the chokepoint; the platform operator configures providers via env.

## How it works

- **One dispatch resolver** — [`src/lib/ai/provider-route.ts`](../../src/lib/ai/provider-route.ts) (pure): `providerRoute(modelId, {baseUrl, style})` turns `"<provider>/<model>"` + an optional base URL into a concrete `{ provider, model, url, style }`. Unknown providers route generically as OpenAI-compatible (no more `null` → gateway 400); a base URL is normalized to a full completions endpoint; Anthropic is the one non-OpenAI wire shape.
- **Key precedence** — `resolveCallKey` in [`runtime.server.ts`](../../src/lib/ai/runtime.server.ts): `byoOverride` (Test) → user vault (enterprise BYO, `user_api_keys`) → **platform env** (`AI_PROVIDER_<P>_KEY` / `_BASE_URL`, [`platform-keys.server.ts`](../../src/lib/ai/platform-keys.server.ts)) → managed gateway. Resolved per-attempt-model, so a cross-provider fallback uses the right key. `loadBYOKey` now returns `base_url`, so a custom endpoint works on the **live + streaming** paths, not just Test. The resolved URL is re-checked by `assertSafeBaseUrl` (SSRF guard) at call time.
- **Capability routing** — [`src/lib/ai/capability.ts`](../../src/lib/ai/capability.ts) (pure): `CAPABILITY_PREFERENCES` is the platform's policy (ordered best→worst model per capability — the single control surface). `capabilityRoutedModel(...)` engages for (a) `model: "auto"`, (b) a caller `task` hint, or (c) an internal system surface (`SURFACE_CAPABILITY`: agent→reasoning, brief/scheduler→fast-chat, discovery→reasoning). It picks the best **available** (gateway-live or platform/BYO-keyed) capable model.
- **Composition order** at the chokepoint: `activeModelId` (deprecation) → `capabilityRoutedModel` (best-for-task) → `costRoutedModel` (WM-M15 cost downgrade). Capability routing runs first so the cost layer downgrades *within* the chosen capability.
- **Catalog** — [`src/lib/ai/models.ts`](../../src/lib/ai/models.ts): `provider` is now an open `string`; each model carries a `capabilities[]` axis; the catalog expanded with Qwen / MiniMax / Mistral / Groq / OpenRouter / Together (+ `modelsByProvider` grouping, `AUTO_MODEL` sentinel).
- **Cost** — [`pricing.ts`](../../src/lib/ai/pricing.ts): explicit rates for the new models; unknown custom models degrade safely to a neutral default (cost math never crashes); self-hosted Ollama is zero-cost.

## Governance & guardrails

- **WM-M9 reconciliation:** this is the **platform** AI backend on **our** keys/config — fully consistent with "model-agnostic preserved, on our keys." It is **not** consumer self-serve BYOK (which WM-M9 keeps enterprise-only). Platform provider keys live in env/wrangler (never the client bundle, never a DB row), per the env-var split.
- **Quality gate:** capability routing **never** overrides a consumer's explicit, capable model pick. It engages only on Auto, a task hint, or an internal system surface.
- **Benchmark integrity:** the `eval` subject call and the `judge` (Critic) surface are **never** routed.
- **Kill-switch:** `AI_CAPABILITY_ROUTING` is ON by default (founder ruling); set to `off`/`0`/`false` to make routing byte-identical to pinned-model behavior.
- **SSRF:** every resolved base URL passes `assertSafeBaseUrl` (https anywhere; http only for localhost; private IP ranges **and** internal-resolvable hostnames — `*.cluster.local`/`*.internal`/`*.corp`/metadata hosts — blocked). Provider error bodies are key-masked before they reach `ai_events`. A user base URL is only ever paired with that same user's key, never a platform key (audited 2026-06-30: 5/6 SSRF vectors not exploitable, the 6th hardened).
- **Sub-processor disclosure:** platform-added providers ARE Cadence sub-processors and are disclosed; [`subprocessors.ts`](../../src/lib/compliance/subprocessors.ts) is now open (any provider gets a humanized name; never silently dropped). Self-hosted (Ollama) stays excluded.

## Verification checklist

- `bunx tsc --noEmit` → 0; `bun test src/lib/ai` → green (incl. `provider-route.test.ts`, `capability.test.ts`).
- With no extra env: internal surfaces route to live gateway models by **value-ordered** capability (code→`openai/gpt-5.4`, reasoning→`google/gemini-2.5-pro` — a top reasoner at ~1/6th the premium cost, NOT `gpt-5.5-pro`, fast-chat→`google/gemini-2.5-flash-lite`). Tune the per-capability order in `CAPABILITY_PREFERENCES` — it is the single control surface.
- Set `AI_PROVIDER_GROQ_KEY` (+ optional `_BASE_URL`) → a `groq/...` model is reachable on live + streaming paths; chat no longer shows "add key".
- Pick **Auto** in the chat model switcher → a code question routes to a coder; a one-liner routes to a fast model.
- `AI_CAPABILITY_ROUTING=off` → behavior reverts to the requested/default model.

## Known limits / out of scope

- **Embeddings are untouched** — they run on their own governed 1536-dim pipeline ([`rag/embed.server.ts`](../../src/lib/rag/embed.server.ts)) and must never be routed to a chat model. No per-user embedding provider.
- **Image generation:** the `image-gen` capability exists but the chat catalog has no image model yet (routes fall back to the default). Extensible via `CAPABILITY_PREFERENCES`.
- **Custom model registry UI** (per-user custom model ids with pricing/capabilities in a DB table) is designed but not built — the platform path is code+env defined. MiniMax's compat endpoint is non-standard; drive it via an explicit base URL.
- Auto-fallback still degrades to the cheapest live model (not yet capability-aware); historical `ai_events` are not backfilled.

## Related

- [`../../plan.md`](../../plan.md) §4 build log · [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (MA-1 row)
- [`../strategy/build-driver-and-dispatch.md`](../strategy/build-driver-and-dispatch.md) (the code-gen twin) · [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md) (WM-M9)
- [`subprocessor-disclosure.md`](./subprocessor-disclosure.md) · [`pricing.md`](./pricing.md)
- [`../strategy/session-decisions.md`](../strategy/session-decisions.md) (2026-06-30 entry)
