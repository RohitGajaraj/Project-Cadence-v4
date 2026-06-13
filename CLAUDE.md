# CLAUDE.md — Claude Code entry point

> **Claude Code reads this file. The operating rules live in [`AGENTS.md`](./AGENTS.md) — read it first; it is the canonical, tool-agnostic manual.** This file holds only Claude-Code-specific overrides so we never duplicate (and drift) the rules.

---

> [!IMPORTANT]
> **CADENCE ➔ CIRCUIT RENAME DISCLAIMER:**
> _This project has been renamed from **Cadence** to **Circuit**. Any legacy folder structures, database tables, migrations, environment variables, or APIs that still contain the string `cadence` or `Cadence` are to be treated as equivalent to `circuit` or `Circuit` to prevent breakages in existing configurations and caches._

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

-1. **`git pull origin main`** — before anything else, sync the latest from all other tools. Never work on a stale codebase. The repository is the single source of truth; this file is orientation only. 0. **`active-task.md`** (if present in root) — active sub-steps and checklist currently building. Read first!

0.5. [`Ai_Cofounder.md`](./Ai_Cofounder.md) — the **founding constitution**: co-founder operating posture, north star, agentic-first + model-agnostic (BYOK) mandates, documentation-first development. Its **Repo Concordance** section maps its 13 mandated living docs onto this repo's canon — never create those root files; update the mapped equivalents. For scope/agents/IA/sequencing, the v4 feature map (1.5) governs.

1. [`AGENTS.md`](./AGENTS.md) — pre-action protocol, engineering rules, escalation, session-friction loop, founding principles.
   1.5. [`docs/strategy/v6-agentic-product-os-2026-06-13.md`](./docs/strategy/v6-agentic-product-os-2026-06-13.md) — **CURRENT positioning + build canon (read first for any feature/UX/positioning work)**: the Agentic Product OS umbrella (PM Chief of Staff felt entry + Decision-System moat), genuine autonomous end-to-end execution as the North Star (claim-never-outruns-wiring), the phased build, founder rulings (§10), and market evidence. Engine / expansion map (7 laws · 6 stations · 19-agent mesh · handoff contract · HITL gates · M1–M5): [`docs/strategy/v4-feature-map-2026-06-11.md`](./docs/strategy/v4-feature-map-2026-06-11.md). Wedge UX detail: [`docs/strategy/v5-chief-of-staff-2026-06-11.md`](./docs/strategy/v5-chief-of-staff-2026-06-11.md). Personas: [`docs/strategy/v3-positioning-circuit-2026-06-10.md`](./docs/strategy/v3-positioning-circuit-2026-06-10.md). Index + archive (superseded v1/v2/v3-audit*): [`docs/strategy/README.md`](./docs/strategy/README.md).
   1.55. **Repository map & file-placement policy** — before creating ANY file, follow [`docs/README.md`](./docs/README.md) § "Repository map & file-placement policy": every new doc goes in the right subfolder and is linked from that folder's index in the same commit; nothing new at repo root or `docs/` top level; no duplicates or redirect stubs; screenshots are local-only under `docs/screenshots/`. This is the standing anti-rot rule — honor it so we never re-do a repo cleanup.
   1.6. [`docs/conventions/`](./docs/conventions/) — durable, cross-tool conventions (UI chrome, voice, destructive actions, inline management, doc-closure checklist). These are _rules_, not guidance — apply automatically.
2. [`README.md`](./README.md) — product thesis, positioning, MOAT, who it is for.
3. [`plan.md`](./plan.md) — what is built, what is planned, the milestone roadmap. Sub-feature-level scope: [`docs/planning/feature-backlog.md`](./docs/planning/feature-backlog.md).
4. Then the doc you need: [`design.md`](./design.md), [`architecture/`](./architecture/) (runtime · orchestration · security · data · frontend · integrations), [`docs/operations/skills.md`](./docs/operations/skills.md), [`docs/operations/subagents.md`](./docs/operations/subagents.md), [`docs/operations/tools.md`](./docs/operations/tools.md), [`docs/operations/hooks.md`](./docs/operations/hooks.md), [`docs/operations/memory.md`](./docs/operations/memory.md), [`docs/operations/commits.md`](./docs/operations/commits.md), and cross-cutting gaps in [`docs/planning/considerations.md`](./docs/planning/considerations.md).
5. **Demo accounts** (for demos / screen recordings / any flow that needs a working login): [`docs/operations/demo-credentials.md`](./docs/operations/demo-credentials.md) — two pre-provisioned logins + shared password + seeded workspace contents.

## Commands

**Bun is the package manager / runner** (`bun.lock`, `bunfig.toml`). The lingering `package-lock.json` is not canonical.

- `bun install` — deps. `bunfig.toml` enforces a 24h supply-chain guard (`minimumReleaseAge`); never add to `minimumReleaseAgeExcludes` without asking the user.
- `bun run dev` — Vite dev server (TanStack Start). Use this to verify UI changes — see [`AGENTS.md`](./AGENTS.md) §3 and [`architecture/frontend.md`](./architecture/frontend.md).
- `bun run build` / `bun run build:dev` — production / dev-mode build (Vite → Cloudflare Worker). `bun run preview` — serve the built worker.
- `bun run lint` — ESLint. `bun run format` — Prettier.
- DB changes go in `supabase/migrations/` as timestamped SQL (RLS-aware). Migration safety is hook-enforced — see [`docs/operations/hooks.md`](./docs/operations/hooks.md).

## Stack & architecture at a glance

- **TanStack Start** (full-stack React 19) + **Vite 7**, deployed to **Cloudflare Workers**. The SSR entry is rerouted to [`src/server.ts`](./src/server.ts), which wraps `@tanstack/react-start/server-entry` to catch h3-swallowed 500s (invisible to plain `try/catch`) and render a branded error page. Treat `src/server.ts` as load-bearing.
- **Routing** is file-based in `src/routes/`. `_authenticated.*` is the gated app shell — one route per surface (discovery, prds, roadmap, agents, traces, evals, guardrails, drift, …). `p.$slug.tsx` = public pages; `src/routes/api/*` = server routes (`chat.ts`, `studio-chat.ts`). `src/routes/routeTree.gen.ts` is generated — do not hand-edit.
- **Server logic** lives in `src/lib/*.functions.ts` — one TanStack server-function module per domain. AI/RAG code is in `src/lib/ai` and `src/lib/rag`.
- **`.server.ts` convention** — files with this suffix run in the Cloudflare Worker process only and are never bundled to the client. Importing a `.server.ts` from a client component will fail at build time. Key server-only files: `src/lib/ai/runtime.server.ts`, `src/lib/rag/*.server.ts`, `src/integrations/supabase/client.server.ts`.
- **AI runtime chokepoint** — all AI calls go through `src/lib/ai/runtime.server.ts`. It handles guardrails, cost tracking, BYO key routing, and token logging. Two variants: `callModel` (awaited JSON, used by the agent loop) and `callModelStream` (SSR streaming, used by `chat.ts`/`studio-chat.ts`). Adding a new AI surface requires a valid `CallSurface` literal from the exported union type — don't call the AI gateway directly.
- **Agent loop** — `src/lib/ai/loop.server.ts` implements the agentic planning loop: up to 6 steps, pulls user-enabled tools from `TOOL_REGISTRY`, iterates `{thought, action}` JSON, and enforces per-tool approval modes (`auto` / `confirm` / `review`). New agentic tools go in `src/lib/ai/tools/registry.server.ts`; wire them there, not ad-hoc.
- **UI**: shadcn/ui (new-york, slate base) + Tailwind v4 + Radix; lucide icons; tiptap + monaco editors; recharts; framer-motion/motion. Aliases (`@/components`, `@/lib`, `@/hooks`, …) defined in `components.json`.
- **Data / auth**: Supabase (`@supabase/supabase-js`, RLS migrations) + `@lovable.dev/cloud-auth-js`. Client wiring in `src/integrations/`.
- **Integrations engine**: the connector platform lives in `src/lib/connectors/` — a typed provider registry + adapters + the `resolveProviderAuth` credential chain (workspace binding → user connection → env fallback). Account-level connections UI in Settings → Connected accounts; workspace-level resource bindings on `/sync`. OAuth via the GitHub App / Lovable connector gateway; pasted keys encrypted (AES-256-GCM, service-role-only vault). `nango/` was removed 2026-05-30 — if breadth ever demands it, run Nango as a separate service.
- **Python `.venv` + `requirements.txt`** are dev tooling only — the graphify knowledge-graph indexer (tree-sitter, transformers, torch). Not part of the deployed runtime.

## Git Discipline (Non-Negotiable)

**Every git interaction — commit, push, pull, merge — requires a clear one-line WHY.** See [`docs/operations/git-discipline.md`](./docs/operations/git-discipline.md) for the canonical cross-tool standard. Hooks enforce this.

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

Full detail: [`AGENTS.md`](./AGENTS.md), section 4. These apply equally to Claude Code, Antigravity, Gemini, and Lovable.

## The closed documentation loop (always on)

Every time you build a feature, make a decision, or learn something non-obvious, **update the relevant docs in the same unit of work** — and append to the active build log in [`plan.md`](./plan.md) (section 4). A change is not done until its documentation is true. Full mandate + the update matrix: [`AGENTS.md`](./AGENTS.md), section 5.

**Skill-generated documents rule:** When any skill (gstack-office-hours, gstack-document-release, to-prd, etc.) generates new files or folders, do NOT leave them in arbitrary new locations. Check if an existing document serves the same purpose — merge if yes, place in the correct folder if no. Never leave a positioning or strategy document in a generated folder (e.g., `docs/office-hours/`) when `docs/strategy/` already exists for that purpose. See [`AGENTS.md`](./AGENTS.md) §5.

**Session decisions rule:** When a session produces a major strategic decision or significant tradeoff, add an entry to [`docs/strategy/session-decisions.md`](./docs/strategy/session-decisions.md) in the same session. This is a continuous obligation — not a one-time activity.

## Claude-Code-specific notes

- **Skills, agents, plugins, MCP servers.** The active list appears in the session reminder — it is the source of truth; never invoke from training memory. **Before any task: scan available skills/agents/plugins/MCP, shortlist candidates across ALL namespaces, pick the best fit.** Full protocol: [`AGENTS.md`](./AGENTS.md) section 2. Selection logic: [`docs/operations/skills.md`](./docs/operations/skills.md) and [`docs/operations/subagents.md`](./docs/operations/subagents.md). **All namespaces have equal priority — no bias to any vendor.**
- **Commits.** Use a commit skill — scan available options (`gstack-ship`, `commit-commands:commit`). Full discipline: [`docs/operations/commits.md`](./docs/operations/commits.md).
- **Memory.** Auto-memory + project-local `.remember/`: [`docs/operations/memory.md`](./docs/operations/memory.md). **Session handoff: read `.remember/remember.md` first at session start; overwrite it at milestones and before session end** (full rule: [`AGENTS.md`](./AGENTS.md) ⚡ standing order).
- **Tools.** Read/Edit/Write/Bash/Task conventions: [`docs/operations/tools.md`](./docs/operations/tools.md).
- **Hooks.** Claude Code hooks enforce repo invariants (commit policy, migration safety, session context). Setup and rationale: [`docs/operations/hooks.md`](./docs/operations/hooks.md).
- **Session-friction patterns** (fact-forcing gate, case-insensitive FS, `git mv` read-tracking, cost discipline) are documented once in [`AGENTS.md`](./AGENTS.md), section 7. Add to that loop, not here.

## Knowledge-graph note (graphify)

Current state: the graph is stored in `ruvector.db` at repo root; `graphify-out/` is **not** generated, so don't expect the `graphify-out/wiki/` files below to exist until you run a build. If `graphify-out/graph.json` exists, run `graphify query "<question>"` for codebase questions before raw grep; `graphify path "<A>" "<B>"` for relationships; `graphify explain "<concept>"` for focused concepts. Use `graphify-out/wiki/index.md` for broad navigation. After modifying code, run `graphify update .` to keep the graph current.

> Everything else: [`AGENTS.md`](./AGENTS.md). Do not restate its rules here.
