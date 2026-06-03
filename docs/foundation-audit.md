# docs/foundation-audit.md — Foundation gap audit (2026-05-30)

> **What this is.** A point-in-time grade of the **Epic 0 — Foundation** items in [`feature-backlog.md`](./feature-backlog.md) against the *actual code* (migrations, AI runtime, auth, frontend, CI). Method: three parallel read-only code audits over `supabase/migrations/*`, `src/lib/ai/*`, `src/lib/*.functions.ts`, `src/routes/*`, `src/styles.css`, `.github/workflows/*`, `wrangler.jsonc`, `supabase/config.toml`. Evidence is `file:line`.
>
> **Headline:** the **AI trust stack + product data model are largely built and reusable**; **every material gap is in the "autonomous + enterprise" foundations** — multi-tenancy, durable runtime, chokepoint coverage of streaming, injection quarantine, global kill-switch, sandbox/review, CI/CD, monitoring/DR. Build order step 1 is therefore *less "harden what's there"* and *more "add the tenancy + runtime + safety spine the legacy build never had."*

Legend: ✅ present · 🟡 partial (exists, needs work) · ❌ absent.

---

## Scorecard — Epic 0

| ID | Item | Verdict | Evidence (short) |
|----|------|:------:|---|
| 0.1 | Three-key tenancy + RLS | ✅ | **Scaffolded & Plumbed.** `workspaces` + `workspace_members` schemas created. React layout wrapped with `WorkspaceProvider`, AppShell sidebar integrated with selectors, and server functions scoped. DB migrations pending remote push by Lovable. |
| 0.2 | AI chokepoint | ✅ | Both standard completions (`callModel()`) and streaming completions (`callModelStream()`) are routed through the central AI chokepoint to enforce budgets, guardrails, and telemetry. |
| 0.3 | Trust-stack tables | ✅ | `ai_events`(+`parent_event_id`), `ai_evals`, `ai_feedback`, `guardrail_rules`/`_hits`, `prompt_templates`/`_versions`/`_assignments`/`_runs`, `ai_budgets`, `ai_surface_budgets`, `eval_suites`/`_cases`/`_runs`/`_case_results`, `tool_calls`, `drift_*`. Comprehensive. (Not yet 3-key scoped — ties 0.1.) |
| 0.4 | Design tokens | 🟡 | Full OKLCH token set in `src/styles.css` (~90%), motion/gradient/shadow utilities. **But light is the `:root` default — no dark palette**, and `design.md` is **dark-first**. Token names also drift from `design.md` (code: `--neural-gradient`; doc: `--gradient-aurora`). |
| 0.5 | Blast-radius / tool allow-list | 🟡 | `agent_tools` allow-list enforced at call-time via `TOOL_REGISTRY` (`loop.server.ts`, `tools/registry.server.ts`). **No resource/product scoping; no pre-filter before tool names enter the prompt.** |
| 0.6 | Spend caps + kill-switch | 🟡 | Per-user + per-surface caps enforced **before** spend (`runtime.server.ts`); `MAX_STEPS=6` loop cap; approval gates. **Missing: global kill-switch/pause; per-mission(workspace) caps; per-loop token budget; approval timeout/escalation.** |
| 0.7 | Prompt-injection defense | ✅ | Context chunks and tool results are XML-escaped and isolated in quarantine tags with strict system warning rules. Programmatic override enforces all injection rules to block immediately. |
| 0.8 | Provider/model fallback | ✅ | Model-agnostic gateway + BYO keys (anthropic/openai/deepseek/xai); retry w/ backoff; `fallbackModel`. **Missing: circuit breaker / provider health tracking** (otherwise solid). |
| 0.9 | Durable runtime | ❌ | No Durable Objects, queue, or checkpoint (`wrangler.jsonc` has only `main`). Long missions are in-request → exposed to Workers timeout. **This blocks everything autonomous + parallel.** |
| 0.10 | Sandbox + review gate for agent code | ❌ | Studio writes **virtual** files (`prototype_files`); no sandboxed execution, no supply-chain allow-list, no merge/deploy review gate. |
| 0.11 | App monitoring + backups/DR | ❌ | Good SSR error-capture + branded 500 (`server.ts`, `error-capture.ts`) — but **no external monitoring/alerting**, and **no backup/restore/DR config** (`supabase/config.toml` is bare). |
| 0.12 | CI/CD + environments | ❌ | `.github/workflows/` are **Claude-assist only** (`claude.yml`, `claude-code-review.yml`). **No test/lint/build gating, no staging/prod, no deploy/rollback.** |

### Adjacent foundations already strong (reuse, don't rebuild)
| Item | Verdict | Evidence |
|---|:--:|---|
| A1/A2 Auth + session | ✅ | Email+pw + Google OAuth; global gate on `_authenticated.tsx:5`; Bearer attach (`auth-attacher.ts`) + server validate (`auth-middleware.ts`). *(No `Last-Event-ID` SSE resume yet.)* |
| O2 pgvector / RAG | ✅ | `vector(1536)`, HNSW cosine on `rag_chunks`/`agent_memory`/`signals`; `match_*` fns hardened with `SECURITY DEFINER` forcing `auth.uid()`. |
| D1 pg_cron triggers | ✅ | 3 jobs (indexer :07 hourly, eval 3am, drift 4am) → `/api/public/hooks/*`; agent `cron_schedule` columns. |
| D2 Planner/executor loop | 🟡✅ | plan→tool→observe→reflect, `MAX_STEPS=6`, approval gates queue `agent_approvals`. *(No checkpoint/resume — ties 0.9.)* |
| R1 ⌘K + AppShell | ✅ | `CommandPalette.tsx` (⌘K + vim `g` goto), `AppShell.tsx` (sidebar groups, BudgetBar, products). |
| Core product tables | ✅ | signals/themes/opportunities, prds, tasks, decisions, agents(+runs/memory/tools/approvals), prototypes(+files/messages), docs(+versions), meetings, artifact_lineage, integrations. |

---

## The one decision that gates step 1: tenancy

**0.1 is absent and everything in `plan.md` X2 (multi-product/workspace) + isolation tests depend on it.** Two paths:

- **(A) Retrofit now** — add `workspace_id` + `product_id` to all 43 tables + rebuild all RLS policies to key on membership + the three keys, before building more features. Higher upfront cost; avoids a second migration of a larger schema later.
- **(B) Defer to step 5** — keep single-key (`user_id`) through the first slice (Discover→Define→Plan), retrofit when multi-product is built.

`plan.md` §3 sequencing rule ("architecture built right from step 1 so later stages are additions, not rewrites") argues for **(A)**. The cost is real but it compounds the longer it waits — every new table and policy added under single-key is more to migrate. **Recommend (A), scoped as the first ticket.** *(Decision needed — see open question Q-T1 below.)*

---

## Step-1 ticket list (ordered, derived from the gaps)

P0 unless noted. IDs reference `feature-backlog.md`.

1. **`FND-TENANCY` (0.1)** — Add `workspace_id` + `product_id` to all product-scoped tables; `workspaces` + `products` tables (or extend `projects`→`products`); rebuild RLS to key on membership + 3 keys; tenancy helper + assertion in chokepoint/orchestrator; **isolation integration test** as the done-signal. **Design + table-by-table plan: [`decisions/tenancy-retrofit.md`](./decisions/tenancy-retrofit.md) (decided: retrofit-now-incrementally, membership-keyed RLS, A→B→C backfill).**
2. **`FND-CHOKEPOINT-STREAM` (0.2)** — Route `/api/chat` + `/api/studio-chat` through `callModel()` (or a shared streaming variant) so budgets, guardrails, full telemetry, and `guardrail_hits` apply to streaming. **Highest-value safety fix** — today the most-used surfaces are unguarded.
3. **`FND-INJECTION` (0.7)** — Quarantine/escape RAG chunks + tool results before they enter context; flip built-in injection guardrails from `warn`→`block`; require approval for high-risk actions regardless of agent mode.
4. **`FND-KILLSWITCH` (0.6)** — Global pause/kill-switch (per workspace + system); per-mission spend caps; per-loop token budget; approval timeout/escalation.
5. **`FND-RUNTIME` (0.9)** — Decide + implement durable runtime (queue/Durable Objects/checkpoint) so multi-step + parallel missions survive Workers limits. *(Architecture decision — gates Epic E + I/J/K.)*
6. **`FND-CACHE` (0.2)** — Add tenant-salted response cache stage to the chokepoint (cost + latency; cache hit logs `$0.0000`).
7. **`FND-TOKENS-DARK` (0.4)** — Add dark-first palette + reconcile token names with `design.md` (update whichever is wrong — close the drift).
8. **`FND-CI` (0.12)** — App CI (test/lint/build gates) + staging/prod + deploy/rollback. Prereq for autonomous Ship (Epic K).
9. **`FND-OBS-DR` (0.11)** — External monitoring/alerting + Supabase backup/PITR + a restore drill.
10. **`FND-SANDBOX` (0.10)** — Sandboxed exec + supply-chain allow-list + merge/deploy review gate. *(Can land alongside Epic I/K.)*
11. **`FND-FALLBACK+` (0.8)** — Add circuit-breaker/provider-health to the existing fallback (small).
12. **`FND-BLAST` (0.5)** — Resource/product scoping on tool allow-list; pre-filter before prompt injection.

**Cheapest first wins (low effort, high safety):** #2 (stream→chokepoint), #3 (injection block), #7 (dark tokens), #11 (circuit breaker).
**Heaviest / decision-gated:** #1 (tenancy), #5 (durable runtime).

---

## New open questions surfaced by the audit
- **Q-T1 — Tenancy timing:** ✅ resolved → retrofit now, incrementally. See [`decisions/tenancy-retrofit.md`](./decisions/tenancy-retrofit.md).
- **Q-T2 — Streaming chokepoint shape:** refactor `callModel()` to support streaming, or a thin shared `streamModel()` that reuses budget/guard/persist? Pick before #2.
- **Q-T3 — Durable runtime substrate** (was backlog Q2): Cloudflare Queues vs Durable Objects vs external worker. Blocks #5 and Epic E.
- **Q-T4 — Token-name source of truth:** is `design.md` (`--gradient-aurora`, `--shadow-glass`) or the code (`--neural-gradient`) canonical? Reconcile one direction.

> Re-run this audit (or update verdicts in place) as step-1 tickets land; promote completed items into [`../plan.md`](../plan.md) §4 active build log.
