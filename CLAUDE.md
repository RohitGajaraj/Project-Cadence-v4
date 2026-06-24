# CLAUDE.md — Claude Code entry point

> _Created: 2026-06-03 · Last updated: 2026-06-19_

> **Claude Code reads this file. The operating rules live in [`AGENTS.md`](./AGENTS.md) — read it first; it is the canonical, tool-agnostic manual.** This file holds only Claude-Code-specific overrides so we never duplicate (and drift) the rules.

---

> [!IMPORTANT]
> **PRODUCT NAME: CADENCE.** The product is **Cadence**, and that is the only name to use. A brief 2026-06-10 rename experiment to a different brand was reverted on 2026-06-16; the retired name must not be reintroduced anywhere (code, docs, DB, env, caches, APIs). Any stray legacy token from that experiment is to be read as equivalent to `cadence`/`Cadence`.

> [!IMPORTANT]
> **BUILDER ➔ STUDIO ➔ BUILD RENAME DISCLAIMER (2026-06-12, twice):**
> _The Builder agent/surface became **Studio** (morning), then **Build** (night, screen-9 Ember port — founder ruling). User-facing name is **Build** everywhere and the canonical routes are `/build` + `/build/$missionId` (`/studio/*` now redirects to `/build/*`, reversing the morning's mothball redirect). Legacy internal identifiers are intentionally NOT migrated across EITHER rename — `agent_slug='builder'`, `builder_file_claims`, `studio.functions.ts`, `src/components/studio/`, the `studio.*` engine tools, and `studio_changesets` are all to be read as equivalent to Build. The `CallSurface 'studio'` literal (Prompt Studio cost bucket) predates both and is unrelated. Spec: `docs/features/studio.md`._

---

## MANDATORY: Scan skills, agents, plugins, and MCPs before every task (non-negotiable)

**This fires before every task — code, docs, design, analysis, any action. No exceptions.**

1. Check the session reminder for the full library of available skills, agents, plugins, and MCP servers
2. Shortlist candidates across ALL types and ALL namespaces equally (skills, agents, plugins, MCPs — not just skills)
3. Invoke the best fit before acting from scratch

You do not wait for the user to ask. "Simple" tasks do not skip this. Full protocol: [`AGENTS.md`](./AGENTS.md) §2.

---

## Read order for Claude Code

-1. **`git pull origin main`** - before anything else, sync the latest from all other tools. Never work on a stale codebase. The repository is the single source of truth; this file is orientation only.

0. **[`docs/planning/SOURCE-OF-TRUTH.md`](./docs/planning/SOURCE-OF-TRUTH.md)** - the ONE file to read first. Section 0 is the live cursor (what is in flight + the next picks; this folded in the old root `active-task.md` on 2026-06-19), then the build queue (section 3) and the founder pickup list (section 4). The full doc model (the map, the session loop, the new-initiative rule) is in [`AGENTS.md`](./AGENTS.md) "The Documentation Operating System".

0.5. [`Ai_Cofounder.md`](./Ai_Cofounder.md) — the **founding constitution**: co-founder operating posture, north star, agentic-first + model-agnostic (BYOK) mandates, documentation-first development. Its **Repo Concordance** section maps its 13 mandated living docs onto this repo's canon — never create those root files; update the mapped equivalents. For scope/agents/IA/sequencing, the v4 feature map (1.5) governs.

1. [`AGENTS.md`](./AGENTS.md) — pre-action protocol, engineering rules, escalation, session-friction loop, founding principles.
   1.45. **⭐ [`docs/strategy/v11-guiding-star.md`](./docs/strategy/v11-guiding-star.md) is the CURRENT GUIDING STAR (2026-06-23) — read it FIRST for direction, moat, defense, the core-user lens, market/pricing, and the agentic build plan; its execution items (what to build next) live in the [`feature dashboard`](./docs/planning/feature-dashboard.md) (the v11 build front, ranked #1-21, each with a one-line Why). It consolidates v7 to v10 + moat.md from a code-and-live-DB-verified outsider teardown; when v11 and an older strategy doc disagree on direction, v11 wins. The older docs below remain valid for their detailed reference role.**
   1.5. [`docs/strategy/v7-agentic-product-os.md`](./docs/strategy/v7-agentic-product-os.md) — **CURRENT positioning + build canon (read first for any feature/UX/positioning work; supersedes v6, which is retained as the engine/IA + market-evidence reference)**: the Agentic Product OS umbrella (PM Chief of Staff felt entry + Decision-System moat), genuine autonomous end-to-end execution as the North Star (claim-never-outruns-wiring), the phased build, founder rulings (§10), and market evidence. **For structure / IA / surface placement and build-order, [`docs/strategy/v8-calm-front-deep-engine.md`](./docs/strategy/v8-calm-front-deep-engine.md) is the CURRENT structure/build canon (calm front + one Engine Room door; the hybrid Build spine; the 4-phase sequencing) — it operationalizes v7 and wins on structure decisions.** **For what to build next, how the product should look and behave, priority, and the disjoint build lanes, [`docs/strategy/v10-master-blueprint.md`](./docs/strategy/v10-master-blueprint.md) is the CURRENT master blueprint - pick this first; its execution order (build loop, sprints, milestone gates) lives in [`docs/planning/v10_implementation-plan.md`](./docs/planning/v10_implementation-plan.md). The strategy folder's role map ([`docs/strategy/README.md`](./docs/strategy/README.md)) is the single arbiter of which doc to pick for what.** **For the launch wedge, the competitor posture (integrate / absorb / race / ignore), and the what-to-build-next priority call, [`docs/strategy/v9-decision-wedge-and-build-next.md`](./docs/strategy/v9-decision-wedge-and-build-next.md) is the CURRENT decision-lens canon (the Critic-teardown wedge; memory-as-moat from first principles; the tiered build-next plan); it wins on wedge / competitor / priority calls. v7 still wins positioning, v8 still wins structure.** **The raw brainstorm reasoning behind the canon, and the source narrative for YC / accelerator / investor applications, lives in [`docs/strategy/strategic-inputs-log.md`](./docs/strategy/strategic-inputs-log.md) (a living, append-forward log); major decisions in [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md). Standing rule: every strategy doc is interlinked both ways and never orphaned - a new strategic input is captured in the inputs log, distilled into the canon, and logged in decisions, in the same session.** Engine / expansion map (7 laws · 6 stations · 19-agent mesh · handoff contract · HITL gates · M1–M5): [`docs/strategy/archive/v4-feature-map.md`](./docs/strategy/archive/v4-feature-map.md). Wedge UX detail: [`docs/strategy/archive/v5-chief-of-staff.md`](./docs/strategy/archive/v5-chief-of-staff.md). Personas: [`docs/strategy/archive/v3-positioning-cadence.md`](./docs/strategy/archive/v3-positioning-cadence.md). **For the repo model (product-level, provider-agnostic, BYO-or-managed), the calm-front autonomous Build to Ship reframe, and the all-in-one platform positioning, [`docs/strategy/byo-build-and-cadence-cloud.md`](./docs/strategy/byo-build-and-cadence-cloud.md) is the CURRENT spec; its phased execution (P1-P5, work items + tasks) lives in [`docs/planning/byo-build-implementation-plan.md`](./docs/planning/byo-build-implementation-plan.md) (board group G11).** Index + archive (superseded v1/v2/v3-audit*): [`docs/strategy/README.md`](./docs/strategy/README.md).
   1.55. **Repository map & file-placement policy** — before creating ANY file, follow [`docs/README.md`](./docs/README.md) § "Repository map & file-placement policy": every new doc goes in the right subfolder and is linked from that folder's index in the same commit; nothing new at repo root or `docs/` top level; no duplicates or redirect stubs; screenshots are local-only under `docs/screenshots/`. This is the standing anti-rot rule — honor it so we never re-do a repo cleanup.
   1.6. [`docs/conventions/`](./docs/conventions/): durable, cross-tool rules applied automatically (rules, not guidance). **Top of the list: [`humanized-output.md`](./docs/conventions/humanized-output.md).** Zero AI fingerprints (no em/en dashes, no invisible Unicode, no AI-cliché phrasing) in BOTH what we author AND what the platform generates for users; the runtime sanitizer at the AI chokepoint is the hard gate. Plus UI chrome, voice ([`ui-voice.md`](./docs/conventions/ui-voice.md)), destructive actions, inline management, doc-closure. **Any design work loads — FIRST — [`engine-room-doctrine.md`](./docs/conventions/engine-room-doctrine.md) (the product's first UX law: calm front, deep engine; all machinery behind one Engine Room door, revealed on demand; name the outcome not the mechanism; BYO sources via one Connect button; the Engine-Room Test + greppable `Engine-Room:` stamp gate every new surface), then [`design-context.md`](./docs/conventions/design-context.md) (Ember system + design-craft skills + the founder's reference north-stars interfacecraft.dev/devouringdetails.com + the tuned orange; motion is craft, NOT absence) and follows [`home-and-today-ia.md`](./docs/conventions/home-and-today-ia.md) (Today is not a dashboard; the surface-placement rubric for where any new panel belongs, so Today never re-clutters).**
   1.65. **Build-in-public brand system: moved to a separate PRIVATE repo** (`RohitGajaraj/build-in-public`), split out 2026-06-15 so the founder's personal brand, voice, drafts, and social tokens never live in this product repo (which may be shared). **Standing rule (one-way insight feed):** when a genuinely postable build insight surfaces here (high bar, only what would make a real social post, NOT a build log, high signal and low noise), append it to [`docs/brand-feed.md`](./docs/brand-feed.md), including a **capture cue** (the screenshot, short video, link, or handle to tag that would strengthen the eventual post). That file is the single source the build-in-public engine reads first; it defines what qualifies as postable, the voice, and the entry format — follow it when capturing. The engine then drafts in the founder's voice and auto-stages **Buffer drafts** for his review (it never publishes; full plumbing in the brand repo's `how-it-works.md`). Keep it public-safe, no secrets. Never post to the founder's accounts without his explicit approval. Do not recreate `docs/brand/` in this repo.
2. [`README.md`](./README.md) — product thesis, positioning, MOAT, who it is for.
3. [`plan.md`](./plan.md) — what is built, what is planned, the milestone roadmap. Sub-feature-level scope: [`docs/planning/archive/feature-backlog.md`](docs/planning/archive/feature-backlog.md). **Current build initiative (workspace / accounts / tenancy + monetization), the cross-tool build bible:** [`docs/planning/workspace-tenancy-and-monetization-plan.md`](./docs/planning/workspace-tenancy-and-monetization-plan.md) (live board group G10 in [`docs/planning/feature-dashboard.md`](./docs/planning/feature-dashboard.md)). **Moat / competition / positioning canon (lead with the decision layer; memory is one layer; YC objection Q&A):** [`docs/strategy/moat.md`](./docs/strategy/moat.md).
4. Then the doc you need: [`DESIGN.md`](./DESIGN.md), [`architecture/`](./architecture/) (runtime · orchestration · security · data · frontend · integrations), [`docs/operations/skills.md`](./docs/operations/skills.md), [`docs/operations/subagents.md`](./docs/operations/subagents.md), [`docs/operations/tools.md`](./docs/operations/tools.md), [`docs/operations/hooks.md`](./docs/operations/hooks.md), [`docs/operations/permissions.md`](./docs/operations/permissions.md), [`docs/operations/memory.md`](./docs/operations/memory.md), [`docs/operations/commits.md`](./docs/operations/commits.md), and cross-cutting gaps in [`docs/planning/considerations.md`](./docs/planning/considerations.md).
5. **Demo accounts** (for demos / screen recordings / any flow that needs a working login): [`docs/operations/demo-credentials.md`](./docs/operations/demo-credentials.md) — two pre-provisioned logins + shared password + seeded workspace contents.

## Commands

**Bun is the package manager / runner** (`bun.lock`, `bunfig.toml`). The lingering `package-lock.json` is not canonical.

- `bun install` — deps. `bunfig.toml` enforces a 24h supply-chain guard (`minimumReleaseAge`); never add to `minimumReleaseAgeExcludes` without asking the user.
- `bun run dev` — Vite dev server (TanStack Start). Use this to verify UI changes — see [`AGENTS.md`](./AGENTS.md) §3 and [`architecture/frontend.md`](./architecture/frontend.md).
- `bun run build` / `bun run build:dev` — production / dev-mode build (Vite → Cloudflare Worker). `bun run preview` — serve the built worker.
- `bun run lint` — ESLint. `bun run format` — Prettier.
- `bun run cost:track` — capture the current Claude Code session's token spend into the `cost-tracking` namespace (consumed by the ruflo `cost-report` / `cost-optimize` skills). Wraps the ruflo-cost-tracker plugin's `track.mjs`; [`scripts/cost-track.sh`](./scripts/cost-track.sh) works around two of its bugs — its path encoder doesn't handle the spaces in this repo's path, and its memory-store omits `--upsert` so same-session re-runs fail. Run it after a chunk of work or at session end.
- `bun run cost:summary` — print a cost summary across all sessions in the `cost-tracking` namespace. Wraps the ruflo-cost-tracker plugin's `summary.mjs` with `CLI_CORE=1` for fast backend. Use to verify recorded spend or export as JSON (`bun run cost:summary -- --format json`). See [`scripts/cost-summary.sh`](./scripts/cost-summary.sh).
- DB changes go in `supabase/migrations/` as timestamped SQL (RLS-aware). Migration safety is hook-enforced — see [`docs/operations/hooks.md`](./docs/operations/hooks.md).

## Stack & architecture at a glance

- **TanStack Start** (full-stack React 19) + **Vite 7**, deployed to **Cloudflare Workers**. The SSR entry is rerouted to [`src/server.ts`](./src/server.ts), which wraps `@tanstack/react-start/server-entry` to catch h3-swallowed 500s (invisible to plain `try/catch`) and render a branded error page. Treat `src/server.ts` as load-bearing.
- **Routing** is file-based in `src/routes/`. `_authenticated.*` is the gated app shell — one route per surface (discovery, prds, roadmap, agents, traces, evals, guardrails, drift, …). `p.$slug.tsx` = public pages; `src/routes/api/*` = server routes (`chat.ts`, the `public/*` cron hooks and ingest, the A2A card). `src/routes/routeTree.gen.ts` is generated — do not hand-edit.
- **Server logic** lives in `src/lib/*.functions.ts` — one TanStack server-function module per domain. AI/RAG code is in `src/lib/ai` and `src/lib/rag`.
- **`.server.ts` convention** — files with this suffix run in the Cloudflare Worker process only and are never bundled to the client. Importing a `.server.ts` from a client component will fail at build time. Key server-only files: `src/lib/ai/runtime.server.ts`, `src/lib/rag/*.server.ts`, `src/integrations/supabase/client.server.ts`.
- **AI runtime chokepoint** — all AI calls go through `src/lib/ai/runtime.server.ts`. It handles guardrails, cost tracking, BYO key routing, and token logging. Two variants: `callModel` (awaited JSON, used by the agent loop) and `callModelStream` (SSR streaming, used by `chat.ts`). Adding a new AI surface requires a valid `CallSurface` literal from the exported union type — don't call the AI gateway directly.
- **Agent loop** — `src/lib/ai/loop.server.ts` implements the agentic planning loop: up to 6 steps, pulls user-enabled tools from `TOOL_REGISTRY`, iterates `{thought, action}` JSON, and enforces per-tool approval modes (`auto` / `confirm` / `review`). New agentic tools go in `src/lib/ai/tools/registry.server.ts`; wire them there, not ad-hoc.
- **UI**: shadcn/ui (new-york, slate base) + Tailwind v4 + Radix; lucide icons; tiptap + monaco editors; recharts; framer-motion/motion. Aliases (`@/components`, `@/lib`, `@/hooks`, …) defined in `components.json`.
- **Data / auth**: Supabase (`@supabase/supabase-js`, RLS migrations) + `@lovable.dev/cloud-auth-js`. Client wiring in `src/integrations/`. This backend (DB, auth, OAuth, hosting) is provisioned and managed by Lovable; read live config, schema, and data from the Lovable MCP (`mcp__lovable__*`) or the Supabase MCP (`mcp__supabase__*`), never guess. Secret values are local-first (this project's git-ignored `.env` + wrangler secrets, per the env-var split below). See the Lovable rule in [`AGENTS.md`](./AGENTS.md) §0.
- **Integrations engine**: the connector platform lives in `src/lib/connectors/` — a typed provider registry + adapters + the `resolveProviderAuth` credential chain (workspace binding → user connection → env fallback). Account-level connections UI in Settings → Connected accounts; workspace-level resource bindings on `/sync`. OAuth via the GitHub App / Lovable connector gateway; pasted keys encrypted (AES-256-GCM, service-role-only vault). `nango/` was removed 2026-05-30 — if breadth ever demands it, run Nango as a separate service.
- **Python `.venv` + `requirements.txt`** are dev tooling only — the graphify knowledge-graph indexer (tree-sitter, transformers, torch). Not part of the deployed runtime.

## Git Discipline (Non-Negotiable)

**Every git interaction — commit, push, pull, merge — requires a clear one-line WHY.** See [`docs/operations/git-discipline.md`](./docs/operations/commits.md) for the canonical cross-tool standard. Hooks enforce this.

- Use a commit skill — `gstack-ship`, `commit-commands:commit`, or similar if available. Always include the WHY in the message, not just the WHAT.
- Push with a one-liner: `git push — FND-KILLSWITCH design audit done`
- Pull with intent: `git pull — syncing latest; checking active-task.md for conflicts`

## Conventions & gotchas (so you work faster)

- **Adding a feature = two files in lockstep.** Put server logic in `src/lib/<domain>.functions.ts` (TanStack server functions), then consume it in the matching `src/routes/_authenticated.<domain>.tsx` via TanStack Query (`useQuery`/`useMutation` with `queryKey`s). Follow an existing pair (e.g. `prds` ↔ `discovery.functions.ts`/`lineage.functions.ts`) rather than inventing a new data-flow shape.
- **Ignore the "space-2"-suffixed directories** (`src/components 2`, `src/integrations 2`). They are empty macOS case-insensitive-FS duplication artifacts — never edit, import from, or `cd` into them; the real code is in `src/components` and `src/integrations`. (Background: [`AGENTS.md`](./AGENTS.md) §7.)
- **Don't hand-edit generated files**: `src/routes/routeTree.gen.ts` (regenerated by the router plugin) and migration SQL once applied.
- **Env var split** — client-side uses `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (Vite prefix, safe to expose in the browser bundle). Server-side uses plain `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `LOVABLE_API_KEY` (wrangler secrets, never in the client bundle). Never add a `VITE_` prefix to a secret.
- **API routes** — `src/routes/api/` files use `createFileRoute` with `server.handlers.{POST|OPTIONS}` objects, not React components (no `loader`/`component` exports). This pattern is different from all other routes — follow `chat.ts` as the reference.
- **Cost discipline.** This is a large, doc-heavy repo — read the targeted doc/file you need, not everything. Don't grep blindly when the read-order map or a `*.functions.ts` name already points you to the answer.

## Behavioral guidelines (source: AGENTS.md §4)

Before writing code: **Think. State assumptions. Surface tradeoffs.**
While coding: **Surgical changes only — every line traces to the task.**
Goals: **Minimum code. Simplicity first. Nothing speculative.**
Success: **Define success criteria upfront. Verify before declaring done.**
Velocity: **Ship features fast. Per cycle, gate on correctness only (tsc + build + tests + runtime-fatal review). Batch non-trivial deferrable quality passes (authored-content humanization scanning, lint/prettier style cleanup, AI-trace polish, deep prose-polish, design) to a founder-prompted pre-launch stage; do not burn time on them mid-build.** _(Founder velocity ruling 2026-06-19; canonical: [`AGENTS.md`](./AGENTS.md) §3.)_

Full detail: [`AGENTS.md`](./AGENTS.md), section 4. These apply equally to Claude Code, Antigravity, Gemini, and Lovable.

## The closed documentation loop (always on)

Every time you build a feature, make a decision, or learn something non-obvious, **update the relevant docs in the same unit of work** — and append to the active build log in [`plan.md`](./plan.md) (section 4). A change is not done until its documentation is true. Full mandate + the update matrix: [`AGENTS.md`](./AGENTS.md), section 5.

**Skill-generated documents rule:** When any skill (gstack-office-hours, gstack-document-release, to-prd, etc.) generates new files or folders, do NOT leave them in arbitrary new locations. Check if an existing document serves the same purpose — merge if yes, place in the correct folder if no. Never leave a positioning or strategy document in a generated folder (e.g., `docs/office-hours/`) when `docs/strategy/` already exists for that purpose. See [`AGENTS.md`](./AGENTS.md) §5.

**Session decisions rule:** When a session produces a major strategic decision or significant tradeoff, add an entry to [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md) in the same session. This is a continuous obligation — not a one-time activity.

## Claude-Code-specific notes

- **Skills, agents, plugins, MCP servers.** The active list appears in the session reminder — it is the source of truth; never invoke from training memory. **Before any task: scan available skills/agents/plugins/MCP, shortlist candidates across ALL namespaces, pick the best fit.** Full protocol: [`AGENTS.md`](./AGENTS.md) section 2. Selection logic: [`docs/operations/skills.md`](./docs/operations/skills.md) and [`docs/operations/subagents.md`](./docs/operations/subagents.md). **All namespaces have equal priority — no bias to any vendor.**
- **Lovable is the first checkpoint for everything; query it directly, never guess.** Cadence was built on, is hosted on, and is published through Lovable, the live system of record for the whole project (Supabase DB, auth/OAuth, connectors, edge functions, hosting, deploys, analytics, logs, source). When you hit any gap, error, or unknown (a backend/infra/OAuth/connector/deployment fact, a data point, an error or log, an analytics number, a SQL result), check Lovable directly first via the connected **Lovable MCP** (`mcp__lovable__*`); use the **Supabase MCP** (`mcp__supabase__*`) for SQL (`execute_sql`), logs (`get_logs`), and advisors. Do not assume or fabricate. One exception, secrets and env are local-first: key secrets live in this project's git-ignored `.env` and as wrangler secrets under the env-var split below, so check local first for those. Canonical rule: the Lovable callout in [`AGENTS.md`](./AGENTS.md) section 0.
- **Commits.** Use a commit skill — scan available options (`gstack-ship`, `commit-commands:commit`). Full discipline: [`docs/operations/commits.md`](./docs/operations/commits.md).
- **Memory.** Auto-memory + project-local `.remember/`: [`docs/operations/memory.md`](./docs/operations/memory.md). **Session handoff: read `.remember/remember.md` first at session start; overwrite it at milestones and before session end** (full rule: [`AGENTS.md`](./AGENTS.md) ⚡ standing order).
- **Tools.** Read/Edit/Write/Bash/Task conventions: [`docs/operations/tools.md`](./docs/operations/tools.md).
- **Hooks.** Claude Code hooks enforce repo invariants (commit policy, migration safety, session context). Setup and rationale: [`docs/operations/hooks.md`](./docs/operations/hooks.md).
- **Session-friction patterns** (fact-forcing gate, case-insensitive FS, `git mv` read-tracking, cost discipline) are documented once in [`AGENTS.md`](./AGENTS.md), section 7. Add to that loop, not here.

## Knowledge-graph note (graphify)

Current state: the graph is stored in `ruvector.db` at repo root; `graphify-out/` is **not** generated, so don't expect the `graphify-out/wiki/` files below to exist until you run a build. If `graphify-out/graph.json` exists, run `graphify query "<question>"` for codebase questions before raw grep; `graphify path "<A>" "<B>"` for relationships; `graphify explain "<concept>"` for focused concepts. Use `graphify-out/wiki/index.md` for broad navigation. After modifying code, run `graphify update .` to keep the graph current.

> Everything else: [`AGENTS.md`](./AGENTS.md). Do not restate its rules here.
