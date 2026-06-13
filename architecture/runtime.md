# architecture/runtime.md — The AI chokepoint contract

> Every AI call in Cadence goes through one function. This file is its contract. Rules: [`AGENTS.md`](../AGENTS.md). Build history: [`plan.md`](../plan.md).

## The one rule

**Every model call goes through `src/lib/ai/runtime.server.ts`. There is no second path.** Agents, chat, copilot, PRD `/ai`, discovery, studio, daily brief, the judge itself, embeddings — all of it. This is what makes telemetry, safety, cost control, RAG, guardrails, and replay uniform across every surface for free.

## The entry point

```
callModel({ surface, traceId, parentEventId, model, messages, tools?, retrieval?, userId, workspaceId?, runId? })
  -> { text, tool_calls, usage, latency_ms, ttft_ms }
```

`surface` is one of the known surfaces (chat, agent, copilot, prd, discovery, studio, brief, eval, judge, embed, mcp_server, a2a). It drives per-surface defaults, color coding ([`design.md`](../design.md)), and analytics filters. `workspaceId` scopes the kill-switch check; `runId` ties the call to an `agent_runs` row for per-mission token/spend caps and atomic usage accounting.

## The pipeline (in order)

0. **Governance halt check** — `current_kill_state(workspaceId)` is read first. If `system_paused` or `workspace_paused`, throw a typed `GovernanceHaltError('kill_switch')` _before any spend_. If `runId` is set, read `agent_runs` and throw `GovernanceHaltError('mission_token_cap' | 'mission_spend_cap')` when the running totals already meet/exceed the cap, or `'kill_switch'` if the run was previously halted. On halt: log an `ai_events` row with `status='blocked'` and `error_message='governance_halt:<kind> — <msg>'`, and call `halt_agent_run()` so the mission is marked halted. **Caps and pause are sacred — see [`security.md`](./security.md).**
1. **Budget check** — if the user is over their daily/monthly cap, throw a friendly error _before any spend_. Caps are sacred.
2. **Cache lookup** — exact (`request_hash`) + near-dupe (embedding similarity). Cache key is salted with `user_id` + `workspace_id` + `surface` to prevent cross-user leakage. Cache hits are still logged (`cache_hit=true`).
3. **Pre-guardrails** — PII / prompt-injection / secret / keyword on input. `block` aborts, `redact` rewrites before the provider sees it, `warn` logs. Writes `guardrail_hits`.
4. **Retrieval (optional)** — if `retrieval=true`, embed the prompt, fetch top-k `rag_chunks` for the user, inject as a `CONTEXT:` block. See [`data.md`](./data.md).

   **PRD generation (Scribe) bypasses this flag** and calls `retrieve()` directly so it can persist the citation list onto `prds.citations` (caller-side retrieval, model still cites inline as `[n]`). See [`../docs/features/prd-rag-citations.md`](../docs/features/prd-rag-citations.md).
5. **Provider call** — gateway by default; BYO key if the user has a matching one. Capture tokens, latency, ttft. Provider adapters normalize to the uniform return shape.
6. **Post-guardrails** — toxicity / leaked-system-prompt / output PII. Groundedness-below-threshold flags a contradiction with retrieved context.
7. **Persist + usage** — write `ai_events` (+ `tool_calls`), link into the `ai_traces` span tree via `trace_id` / `parent_event_id`. On a successful, non-blocked call, increment per-user/per-surface budgets **and** call `record_mission_usage(runId, tokens, cost_usd)` to atomically bump `agent_runs.tokens_used` and `spend_used_usd`. The next call in the same mission sees the bump and can be halted by the cap check above.
8. **Async eval** — queue the event for the LLM-as-judge (`/api/public/hooks/eval-tick`).
9. **Retry / fallback** — on 429/5xx, backoff retry; if still failing, fall back to a configured backup model and record `fallback=true`.

## Provider adapters

Lovable/AI gateway (default, no user key) and BYO adapters (Anthropic, DeepSeek, Grok, Ollama, OpenAI-compatible). Each normalizes request/response and surfaces `{ text, tool_calls, usage, latency_ms, ttft_ms }`. Cadence is **model-agnostic by contract** — adding a provider means adding an adapter, not touching call sites. This is also the moat lever: the model is an input, never the product ([`README.md`](../README.md)).

**Local-dev gateway fallback (2026-06-11, KI-06).** The cloud injects `LOVABLE_API_KEY`; a local `.env` may not have it. `resolveGateway()` in `runtime.server.ts` routes `google/*` models directly to Google's OpenAI-compatible endpoint using `GEMINI_API_KEY` (free key from [AI Studio](https://aistudio.google.com)) **only when the Lovable key is absent** — cloud behavior is unchanged, and non-`google/*` models still require the Lovable gateway or a BYO key. Covers both `callModel` and `callModelStream`; embeddings (`src/lib/rag/embed.server.ts`) remain Lovable-gateway-only.

## The agent loop

`src/lib/ai/loop.server.ts`: `plan → tool calls → observe → reflect → answer`, with max-step and max-cost caps. Tools are server-validated against the agent's allow-list and every call logs to `tool_calls`. Side-effect tools honor the agent's `approval_mode` (`auto | confirm | review`). Any trace can be replayed against a different model/prompt version.

## Cost & pricing

`model_pricing` (in/out per Mtok) drives cost math (`src/lib/ai/pricing.ts`); hand-maintained, update when providers change pricing. Budgets enforced server-side; per-surface and per-agent cost surface in `/analytics`.

## Invariants (do not break)

- No direct provider calls outside the chokepoint.
- Judge/eval/embedding calls also flow through it (`surface='judge'|'eval'|'embed'`) so they are measured too.
- Cron-poked endpoints live under `/api/public/hooks/*` (`eval-tick`, `eval-suite-tick`, `indexer-tick`, `agent-tick`, `drift-tick`, `approvals-tick`).
- Trace IDs are time-sortable (UUIDv7).
- Eval failure (≥10-point regression on a "Cadence core" case, 0–100 scale — KI-14) is a deploy gate; drift is a passive watcher.
- Both `callModel()` and `callModelStream()` enforce the governance halt check identically. Streaming halts emit a `status='blocked'` event before the SSE stream is ever opened.

Change anything here and update this file + [`plan.md`](../plan.md) (see [`AGENTS.md`](../AGENTS.md), section 5).
