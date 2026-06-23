# docs/considerations.md — Holistic gap review (enterprise-architect lens)

> _Created: 2026-06-11 · Last updated: 2026-06-19_

> **SSOT first.** The single front-door tracker is [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (status, build queue, founder rulings, findings, progress). This file is the cross-cutting engineering gap register it points to, not the tracker to follow day-to-day.

> Status: **STANDING REVIEW.** A deliberate, multi-stakeholder pass over what the rest of the docs have _not_ yet called out — written wearing the hats of enterprise architect, CISO, SRE, data/privacy officer, finance, legal, GTM, support, and founder. Goal: surface what an enterprise-grade build needs so nothing blindsides us later. Operating rules: [`AGENTS.md`](../../AGENTS.md). Feature scope: [`../../plan.md`](../../plan.md). Architecture: [`../architecture/`](../architecture/).
>
> **How to use this:** each item is a _gap to close_, not a feature already built. Pull each into [`../../plan.md`](../../plan.md) (sections 2/3) as it becomes relevant.
>
> **Priority precedence — P0 is highest, P2 is lowest. Do P0 first.** **P0** = needed for a credible first real user (build into the foundation now); **P1** = needed before/at the first enterprise sale; **P2** = scale/maturity. When in doubt, sequence P0 → P1 → P2.

## Already covered (don't duplicate — pointers)

Auth, tenancy, RLS, secrets, governance, approval gates, audit → [`../../architecture/security.md`](../../architecture/security.md). Orchestration, parallelism, multi-product isolation → [`../../architecture/orchestration.md`](../../architecture/orchestration.md). AI telemetry, evals, guardrails, budgets, drift → [`../../architecture/runtime.md`](../../architecture/runtime.md). Data model, migrations, pgvector → [`../../architecture/data.md`](../../architecture/data.md). a11y, design states → [`../../design.md`](../../DESIGN.md). Stack/OSS/lock-in → [`../decisions/tech-stack.md`](../decisions/tech-stack.md). The items below are the _gaps beyond_ those.

## The five that will blindside us first (read these if nothing else)

1. **Autonomous-agent blast radius.** An agent that can build, ship, and touch external systems can do real damage. We need spend caps per mission, scope limits on what an agent can touch, a global kill-switch/pause, sandboxed code execution, and review of agent-written code before merge. (P0)
2. **Inference cost economics.** A "token-max" product can cost more to serve than it charges. We need per-customer/per-mission cost attribution, plan-limit enforcement, and a cost-to-serve vs. price model — or margins die silently. (P0/P1)
3. **Prompt injection at scale.** Ingested signals, external MCP/A2A results, and support tickets are untrusted input feeding agents that take actions. One poisoned input could trigger an unwanted autonomous action. (P0) **PARTIALLY ADDRESSED (2026-06-22, SEC-INGEST-INJECTION ◐):** the support-ticket ingest boundary is now screened — `runSupportTriage` runs the existing `classifyInjection`/`assessCorpusInjection` (the structural-gate classifier already guarding other surfaces) on each cluster's raw ticket text BEFORE it can become a Discover signal: a structural attack (fence-breakout / forged-system-turn) quarantines the cluster (never emitted), a lexical-only override is flagged for review, and a genuine ticket that merely QUOTES an injection is NOT over-dropped. **The LIVE signal-ingest webhook is now also screened (2026-06-22, SEC-SIGNAL-INGEST-INJECTION ◐):** `api/public/ingest-signals` runs the generic `screenIngestText` (`src/lib/ingest-guardrails.ts`, reuses `classifyInjection`) on each externally-POSTed item's full free text (title + content + source) BEFORE insert — a structural attack is rejected (never stored), a borderline one is tagged `needs-review`. Focused external-attack-surface review = SOUND (no bypass; rate limit charged before screening; ReDoS-safe). Remaining: the same screen on external MCP/A2A tool results (the third untrusted-input class). **RESOLVED — SEC-MCP-FILTER-INJECTION (HIGH, flagged + closed 2026-06-24):** the INTEROP-V11 read-only MCP search tools had interpolated the untrusted `query` arg into a PostgREST `.or()` filter STRING (injectable via commas/parens/backslash to add an OR branch — a SQL-injection variant; RLS kept it workspace-scoped so not a cross-tenant leak). **FIXED by lane 2** with one shared `sanitizeIlikeQuery(q)` helper (`mcp.functions.ts` L165, strips `,()\\` while keeping the intended `%`/`_` wildcards) applied at ALL four search sites (signals/opportunities/decisions/prds). **Lane 1 added the regression guard** (`src/lib/mcp-filter-injection.test.ts`, 6 tests proving the structural metacharacters are stripped and injection attempts neutralize to a literal value) so the fix can never silently regress as new MCP search tools are added. tsc 0 + green. No `${query}` interpolation remains anywhere.
4. **Provider/model outage + deprecation.** The whole product stops if the gateway or a model is down or sunset. Need fallback routing, graceful degradation, and a model-deprecation playbook. (P0/P1) **PARTIALLY ADDRESSED (2026-06-20, cycle 56, PROVIDER-FALLBACK ◐):** the chokepoint now has an ordered fallback chain (`resolveFallbackChain` + `fallback.ts`) replacing the single `fallbackModel`, with a flag-gated (`AI_PROVIDER_FALLBACK`) auto cross-model degrade to the cheapest live model. **+ the DEPRECATION playbook now shipped (2026-06-20, cycle 57, MODEL-REGISTRY-DEPRECATION ◐):** `deprecated`/`replacement`/`sunset` fields on the Model type + a pure `activeModelId` resolver wired at the chokepoint (proactively routes a deprecated requested model to its live replacement; dormant identity-function until a model is flagged). So gap #4's mechanism is now substantially closed (outage fallback + deprecation route-around both wired). Remaining: turning on the `AI_PROVIDER_FALLBACK` flag (founder weighs the cost/quality tradeoff), recording real sunsets as providers deprecate models, and the benchmark-cadence half (gated).
5. **Reliability of long-running parallel sessions on the current runtime.** Cloudflare Workers execution limits vs. multi-step missions — durability/queueing must be designed now (sequence, don't postpone). (P0)

---

## By lens

### Product lead / PM (HIGHEST-PRECEDENCE lens — the feature list derives from here)

This is the core role Cadence is built for and the lens that _generates_ the feature catalog. The product's job is to run the PM's actual day. Map the day → the features.

**A PM's real day (what the agents must run):** triage the overnight inbox (support, churn, usage anomalies, sales asks) → decide what matters today → synthesize signals into opportunities → write/refine a spec → break it into tickets → get it built, tested, shipped → write the launch/update → field stakeholder questions ("why is this on the roadmap, why not that?") → handle escalations → report status to leadership → repeat. Most of that is mechanical translation between tools — exactly what autonomous agents should own.

| Gap / need (from the PM's day)                                      | Why it matters                                                                                         | Priority |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| The whole day runnable end-to-end by agents (inbox → ship → report) | This _is_ the product; every lifecycle stage in [`../../plan.md`](../../plan.md) section 2 maps to a PM task | P0       |
| "Why is this on the roadmap?" answerable with cited evidence        | The recurring senior-PM justification burden; the Product Memory + decisions graph answers it          | P0/P1    |
| One-keystroke status/stakeholder updates from live state            | Coordination overhead is the #1 PM time-sink                                                           | P1 — ✅ PM-STATUS-UPDATE (lane 2, 2026-06-22): a "Share status" action on Today composes a paste-ready stakeholder note from live state (shipped, in flight, next, the proof metrics) via a pure deterministic composer + copy. Reference implementation of the felt-voice precedent (signal-first, interpreted metrics, honest when sparse). v1 omits the autonomy metric (deferred). Spec: composer `src/lib/stakeholder-update.ts`. |
| Outcome-oriented roadmap (not feature lists)                        | Anti-feature-factory; ties work to measurable outcomes                                                 | P1       |
| The PM stays the approver/orchestrator, never the bottleneck        | Trust + control without doing the mechanical work                                                      | P0       |

Personas detail (P1-founder, P2-lead PM, P3-technical founder) and the derived feature list: [`../../plan.md`](../../plan.md) section 1-2.

### Engineering manager / lead (secondary, but real)

Less central than the PM, but the build/ship stages must respect how an eng lead works.

| Gap / need                                                         | Why it matters                                    | Priority |
| ------------------------------------------------------------------ | ------------------------------------------------- | -------- |
| Agent-written code is reviewable, scoped, and standards-compliant  | An eng lead won't accept opaque autonomous merges | P0       |
| Clear ticket decomposition with acceptance criteria + dependencies | What eng actually consumes from a spec            | P1       |
| Visibility into what agents changed and why (diffs, traces)        | Trust in autonomous engineering                   | P0       |
| Respect for branch protection, CI gates, review policy             | Fits existing eng process, not around it          | P1       |

### Security / CISO (beyond [`security.md`](../../architecture/security.md))

| Gap                                            | Why it matters                                                             | Priority |
| ---------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| Sandboxed execution for agent-run code         | Agents that write+run code can exfiltrate or break things                  | P0       |
| Supply-chain security (agents installing deps) | Agent-installed packages are an attack surface; need allow-list + scanning | P0       |
| Secret scanning + SAST in the build pipeline   | Agent code could leak/introduce secrets or vulns                           | P1 — ◐ SEC-EGRESS-GUARD (lane 3, 2026-06-21): the existing guardrails secret-detection engine now also runs as a FLOOR on the public-egress write path (L2 announcements are anon-readable), reusing `evaluateGuardrails` with a self-contained high-confidence rule set so a credential can't be stored/published world-readable. Build-pipeline SAST on agent-written code (the original gap) stays open — its drive point is the pinned registry/build chokepoint. Spec: [`../features/egress-secret-guard.md`](../features/egress-secret-guard.md). |
| Key rotation + compromise response             | BYO keys, gateway keys, DB creds                                           | P1       |
| Pen-test + threat model for MCP/A2A surface    | External agents acting in a governed org                                   | P1       |

### SRE / Platform / Reliability

| Gap                                                     | Why it matters                                     | Priority |
| ------------------------------------------------------- | -------------------------------------------------- | -------- |
| App-level monitoring + alerting (not just AI telemetry) | Uptime, errors, latency of the platform itself     | P0       |
| SLOs/SLAs + error budgets; status page                  | Enterprise buyers ask; trust signal                | P1 — ◐ RELIABILITY-SLO (lane 1, 2026-06-21): pure SLO/error-budget engine over `ai_events` (availability · p50/p95 latency · budget burn; `blocked` halts excluded) + read-only `getReliabilitySlo`. Remaining: the Engine Room glance (wire-up) + the outward-facing status page/SLA (founder-gated). |
| Long-running job durability / queue + backpressure      | Parallel missions exceed Workers limits without it | P0       |
| Graceful degradation when a provider/model is down      | Product must not hard-fail                         | P0 — ◐ PROVIDER-FALLBACK cycle 56 (ordered fallback chain + flag-gated cross-model degrade; on-switch is the founder's) |
| Incident response runbooks + on-call                    | When (not if) something breaks                     | P1       |
| DR: backups, point-in-time restore, restore drills      | Data loss is existential                           | P0/P1    |

### Data / Privacy

| Gap                                                         | Why it matters                                                  | Priority |
| ----------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| Data retention + deletion (GDPR/CCPA right-to-be-forgotten) | Legal requirement; `ai_events` is currently unbounded           | P1       |
| Data export / portability                                   | Anti-lock-in promise; enterprise ask                            | P1       |
| Sub-processor list (model providers!) + DPA                 | Customers' data flows to LLM vendors — must disclose + contract | P1       |
| Data residency / region options                             | EU/regulated customers                                          | P2       |
| PII classification + minimization before model calls        | Reduce exposure; pairs with guardrails                          | P1       |

### AI / autonomous-agent safety (the product's defining risk)

| Gap                                                   | Why it matters                                           | Priority |
| ----------------------------------------------------- | -------------------------------------------------------- | -------- |
| Per-mission spend caps + global kill-switch/pause     | Stop runaway autonomy and cost                           | P0       |
| Blast-radius scoping (what an agent may touch)        | Limit damage of a wrong action                           | P0       |
| Review gate on agent-written code before merge/deploy | Quality + safety of autonomous shipping                  | P0       |
| Loop/runaway detection                                | Agents can spin; cap + detect                            | P1 — ◐ RUNAWAY-DETECT (lane 1, 2026-06-21): the DETECT half (KI-15/16 are the caps). Pure detector (hop/step/retry/spend thresholds calibrated to the real caps; runaway vs watch) + read-only `getRunawayMissions`; the inverse of E8's stall monitor. Remaining: the operator surface + alert/auto-pause wire-up. |
| Eval coverage targets per surface/agent               | Today coverage is partial; autonomy needs broad coverage | P1 — ◐ EVAL-COVERAGE (lane 1, 2026-06-21): pure scorer over the 7 canonical surface×prompt targets (covered / stale / uncovered) + read-only `getEvalCoverage` + a calm "Coverage" banner in the Evals panel. Completes the "is the autonomy guarded" triad with RELIABILITY-SLO + RUNAWAY-DETECT. Remaining: per-target chips + a coverage-floor deploy gate. |
| Model-deprecation + benchmark cadence                 | Models change; route to best/cheapest safely             | P1       |

### Build / ship pipeline (DevEx)

| Gap                                       | Why it matters                                           | Priority |
| ----------------------------------------- | -------------------------------------------------------- | -------- |
| CI/CD + environments (dev/staging/prod)   | Safe autonomous shipping needs real pipelines            | P0       |
| Feature flags + safe rollout/rollback     | Ship behind flags; revert fast                           | P1       |
| Migration rollback strategy               | Schema changes are risky; data.md forbids in-place edits | P1 — ◐ MIG-LINT (lane 3, 2026-06-21): a static, OFFLINE apply-safety linter (`src/lib/migration-lint.ts` + `scripts/lint-migrations.ts`, wired into `check-migrations.sh`) fails the build on a migration whose SQL would FAIL to apply (`CREATE POLICY/TRIGGER ... IF NOT EXISTS` = the recurring broken-parallel-ship class), so it never surfaces on publish. 0 false positives across all 168 migrations. Down-migration/rollback authoring stays open. Spec: [`../features/migration-lint.md`](../features/migration-lint.md). |
| Test coverage gates beyond "Cadence core" | Autonomous build must not regress                        | P1       |

### Finance / monetization

| Gap                                     | Why it matters                  | Priority |
| --------------------------------------- | ------------------------------- | -------- |
| Usage metering + plan-limit enforcement | Bill correctly; cap free abuse  | P0/P1    |
| Cost-to-serve vs. price model           | Inference-heavy product margins | P0       |
| Payments, trials, dunning, invoicing    | Revenue ops                     | P1       |
| Per-customer cost attribution           | Know unit economics             | P1       |

### Product / growth / GTM

| Gap                                                  | Why it matters                     | Priority |
| ---------------------------------------------------- | ---------------------------------- | -------- |
| Onboarding + activation + sample/templates           | Time-to-value; aha moment          | P0       |
| Product usage analytics (separate from AI telemetry) | Activation/retention/funnels       | P1       |
| Marketing site, pricing page, waitlist, SEO          | Distribution                       | P1       |
| In-app support, help center, changelog, docs         | Adoption + retention               | P1       |
| Mobile/PWA for approvals triage                      | Approvals can't block on a desktop | P2       |

### Org / collaboration

| Gap                                 | Why it matters                                 | Priority |
| ----------------------------------- | ---------------------------------------------- | -------- |
| RBAC / roles / team membership      | The expanded-stakeholder personas (P4) need it | P1       |
| Notifications + transactional email | Approvals, alerts, digests                     | P1       |
| Multiplayer / concurrent editing    | Teams on one product                           | P2       |

### Legal / compliance

| Gap                                            | Why it matters                                   | Priority |
| ---------------------------------------------- | ------------------------------------------------ | -------- |
| ToS, privacy policy, AUP, DPA                  | Required to sell                                 | P1       |
| IP ownership of agent-generated code/content   | Who owns what the agent makes?                   | P1       |
| Liability for autonomous actions               | The governance gates are part of the answer      | P1       |
| OSS license compliance of agent-installed deps | Ties to [`../../AGENTS.md`](../../AGENTS.md) section 9 | P1       |
| SOC 2 / ISO 27001 / ISO 42001 (AI) path        | Enterprise gate; substrate exists in security.md | P2       |

---

## How this feeds the plan

[`../../plan.md`](../../plan.md) section 2 carries the _product_ features; this doc carries the _cross-cutting non-functional_ requirements. The build order ([`../../plan.md`](../../plan.md) section 3) should pull P0 items into the foundation (especially agent blast-radius, cost controls, injection defense, provider fallback, and runtime durability) — they are architecture, not afterthoughts. The SSOT task queue ([`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md)) and the F-ID scope ledger ([`feature-backlog.md`](./feature-backlog.md)) point back here. Revisit this review whenever scope expands.
