# Decision + design: three-key tenancy retrofit

> Status: **DESIGN NOTE (ready to implement).** Date: 2026-05-30. Owner: founder. Implements `FND-TENANCY` (backlog [`../feature-backlog.md`](../feature-backlog.md) 0.1) per the [`../foundation-audit.md`](../foundation-audit.md) finding that the DB is single-key (`user_id`) today. Stack/Lovable context: [`tech-stack.md`](./tech-stack.md). Data rules (forward-only, additive migrations): [`../../architecture/data.md`](../../architecture/data.md).
>
> **Purpose:** make the actual migration safe to hand to either Claude Code or Lovable — table-by-table scope (now vs later), the RLS pattern, the backfill shape, and the convention new code must follow so the debt doesn't re-accumulate.
>
> Table inventory below is from the 2026-05-30 audit; **confirm column names against the live schema before writing the migration.**

---

## Decisions captured

1. **Retrofit now, incrementally** — scaffolding + foundation + first-slice tables get the keys now; later-epic tables get them when those epics are built (and new tables get them from birth via the convention). Rationale: every table built single-key is migration debt; scaffolding-now stops the bleed without migrating 43 tables before they're reused.
2. **Key RLS on membership, not `user_id`.** A `workspace_members` table backs all policies. Single operator today = one owner row; teams later (Epic A6/S6) = more rows, **no new migration**.
3. **Keep the physical table name `projects`** (semantically "product"); add `workspace_id`; `product_id` is a FK to `projects.id`. Avoids a rename storm across `src/lib/*.functions.ts` + Lovable-generated `.from("projects")` calls. _(Optional later: rename `projects`→`products` behind a view. Founder call — see open item O1.)_
4. **Keep `user_id` columns** on all tables as `created_by`/audit; RLS security key shifts to `workspace_id` + membership. Don't drop `user_id`.
5. **Three sequenced, forward-only migrations** (A→B→C): nullable → backfill → tighten. Nothing halts mid-flight.

---

## Two new tables (the scaffolding)

```sql
-- A1. workspaces — top-level tenancy boundary
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

-- A2. workspace_members — membership backs all RLS (RBAC-ready)
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null default 'owner',           -- owner|admin|member|viewer (enforced later)
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
```

`products` = existing `projects` + `workspace_id` (added in migration B).

---

## The RLS pattern (membership helper — recursion-safe)

```sql
-- SECURITY DEFINER ⇒ bypasses RLS on workspace_members ⇒ no policy recursion
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;
```

Domain-table policy (one representative; repeat per table):

```sql
alter table public.signals enable row level security;
drop policy if exists "own signals all" on public.signals;     -- remove the user_id-only policy

create policy "ws members read signals" on public.signals
  for select using (public.is_workspace_member(workspace_id));
create policy "ws members write signals" on public.signals
  for all using (public.is_workspace_member(workspace_id))
        with check (public.is_workspace_member(workspace_id));
```

**`workspace_members`'s own policies must NOT call the helper** (that would recurse). Use direct checks:

```sql
alter table public.workspace_members enable row level security;
create policy "see own membership" on public.workspace_members
  for select using (user_id = auth.uid());
create policy "owner manages members" on public.workspace_members
  for all using (exists (select 1 from public.workspaces w
                         where w.id = workspace_id and w.owner_id = auth.uid()))
        with check (exists (select 1 from public.workspaces w
                            where w.id = workspace_id and w.owner_id = auth.uid()));
```

**RAG isolation (critical):** the `SECURITY DEFINER` `match_rag_chunks` / `match_agent_memory` / `match_signals` functions currently force `auth.uid()`. After retrofit they must **also filter `workspace_id` (and `product_id` where relevant)** — otherwise RAG leaks across a user's own products. Add the param + `where` clause in migration C.

---

## Table-by-table scope

`WS` = gets `workspace_id` · `PROD` = gets `product_id` · `nullable?` = key may be null (workspace-level rows).

### NOW — foundation

| Table                             | WS  | PROD | Notes                                      |
| --------------------------------- | :-: | :--: | ------------------------------------------ |
| `workspaces`, `workspace_members` |  —  |  —   | new (scaffolding)                          |
| `projects` (→ product)            | ✅  |  —   | `id` is the `product_id` target            |
| `profiles`                        |  —  |  —   | user identity; RLS stays `auth.uid() = id` |

### NOW — first slice (Discover→Define→Plan) + RAG

| Table                  | WS  |     PROD     | Notes                                        |
| ---------------------- | :-: | :----------: | -------------------------------------------- |
| `signals`              | ✅  |      ✅      |                                              |
| `themes`               | ✅  |      ✅      |                                              |
| `opportunities`        | ✅  |      ✅      |                                              |
| `prds`                 | ✅  |      ✅      |                                              |
| `docs`, `doc_versions` | ✅  | ✅(nullable) | versions can inherit product via parent doc  |
| `tasks`                | ✅  |      ✅      |                                              |
| `decisions`            | ✅  |      ✅      |                                              |
| `artifact_lineage`     | ✅  |      ✅      |                                              |
| `rag_chunks`           | ✅  |      ✅      | **isolation-critical**; update `match_*` fns |

### NOW — trust stack (chokepoint runs in the first slice, so its writes must be scoped from day 1)

| Table                                                                    | WS  |     PROD     | Notes                                                                                  |
| ------------------------------------------------------------------------ | :-: | :----------: | -------------------------------------------------------------------------------------- |
| `ai_events`                                                              | ✅  | ✅(nullable) | workspace-level chat allowed                                                           |
| `ai_evals`, `ai_feedback`, `guardrail_hits`, `tool_calls`, `prompt_runs` | ✅  |      —       | **denormalize `workspace_id`** (don't join to `ai_events` in the policy — high-volume) |
| `ai_budgets`, `ai_surface_budgets`, `ai_budget_alerts`                   | ✅  | ✅(nullable) | caps are workspace-level; per-product optional                                         |

### NOW — optional (founder call)

| Table                       | WS  |     PROD     | Notes                                                                          |
| --------------------------- | :-: | :----------: | ------------------------------------------------------------------------------ |
| `conversations`, `messages` | ✅  | ✅(nullable) | AI Chat is a pinned surface; include now if it stays active in the first slice |

### LATER — apply when the owning epic is built

| Tables                                                                         | Owning epic                                                                        |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `agents`, `agent_runs`, `agent_memory`, `agent_tools`, `agent_approvals`       | C/D/E (agents + orchestration)                                                     |
| `prototypes`, `prototype_files`, `prototype_messages`, `prototype_attachments` | I (Build/Studio)                                                                   |
| `eval_suites`, `eval_cases`, `eval_runs`, `eval_case_results`                  | P4 (eval harness)                                                                  |
| `drift_snapshots`, `drift_baselines`, `drift_incidents`                        | P5 (drift)                                                                         |
| `prompt_templates`, `prompt_versions`, `prompt_assignments`                    | P3 (prompt studio)                                                                 |
| `meetings`, `calendar_events`, `user_integrations`, `sync_mappings`            | R2 (connectors) / Discover meetings                                                |
| `user_api_keys`                                                                | stays **user-scoped** (BYO keys are personal); revisit for workspace sharing in A6 |

---

## Backfill migration shape (A → B → C, forward-only)

**Migration A — scaffolding + seed**

1. Create `workspaces`, `workspace_members`, `is_workspace_member()`.
2. One default workspace per existing distinct `user_id` (from any user-scoped table); insert owner membership.
3. Ensure each user has ≥1 `projects` row; if none, create a "Default product".

**Migration B — add keys nullable + backfill (no policy change yet)** 4. `alter table … add column workspace_id uuid` (nullable) + `product_id uuid` (nullable) on the NOW tables. 5. Backfill `workspace_id` = the row owner's default workspace (join via `user_id`). 6. Backfill `product_id` = the row's existing project link if any, else the user's default product. 7. Add FKs (`workspace_id → workspaces`, `product_id → projects`, `on delete restrict`) + indexes `(workspace_id)` and `(workspace_id, product_id)`.

**Migration C — tighten + swap policies** 8. Verify zero null `workspace_id` on NOW tables (assert counts), then `set not null` on `workspace_id`. 9. Drop the `user_id`-only RLS policies; create the membership-based policies. 10. Update `match_rag_chunks` / `match_agent_memory` / `match_signals` to take + filter `workspace_id` (+ `product_id`).

> Apply A→B→C in one PR; verify between B and C. Per [`../../architecture/data.md`](../../architecture/data.md), migrations are additive/forward-only — no in-place edits of prior migration files.

---

## The convention (paste into Lovable project knowledge + follow in Claude Code)

So new tables/inserts carry tenancy from birth and the debt never returns:

> **Cadence tenancy convention.** Every product-scoped table has: `user_id` (created_by/audit), `workspace_id uuid NOT NULL` (FK `workspaces`), and `product_id uuid` (FK `projects`, nullable only for workspace-level rows). Enable RLS and gate every policy with `public.is_workspace_member(workspace_id)` — never `auth.uid()` alone (except `profiles`). Index `(workspace_id)` and `(workspace_id, product_id)`. In server functions, **always set `workspace_id` + `product_id` from the request's current-workspace/product context — never trust the client.** High-volume child tables (telemetry) denormalize `workspace_id` rather than joining in the policy.

New-table template:

```sql
create table public.<name> (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  workspace_id uuid not null references public.workspaces(id),
  product_id uuid references public.projects(id),
  -- … domain columns …
  created_at timestamptz not null default now()
);
create index on public.<name> (workspace_id);
create index on public.<name> (workspace_id, product_id);
alter table public.<name> enable row level security;
create policy "<name> read"  on public.<name> for select using (public.is_workspace_member(workspace_id));
create policy "<name> write" on public.<name> for all    using (public.is_workspace_member(workspace_id))
                                                          with check (public.is_workspace_member(workspace_id));
```

---

## Lovable co-development guardrails (during the retrofit window)

- **Freeze Lovable schema generation** while A/B/C land — concurrent migrations cause ordering conflicts. Pull Lovable's latest before starting and after merging.
- Tenancy is plain Supabase migrations + RLS (the Lovable-native mechanism) — **no Lovable/Supabase per-feature charge**; cost is engineering time, not money ([`tech-stack.md`](./tech-stack.md) §2).
- After landing, add the convention block above to Lovable's project knowledge so its generations set the keys.

---

## Open items (decide before writing migration A)

- **O1 — Rename `projects`→`products`?** Recommend **no** for now (keep table name, treat as product) to avoid breaking app + Lovable references; revisit behind a view later.
- **O2 — App-layer context plumbing:** where does "current workspace/product" live? Proposed: a server-side context resolved from the request (header or session) + a client `WorkspaceProvider`; the workspace/product switcher (backlog B1/B3) writes it. Needed so server functions can set the keys.
- **O3 — Include `conversations`/`messages` in the NOW set?** Yes if AI Chat stays active in the first slice.

> When A/B/C land, flip 0.1 in [`../foundation-audit.md`](../foundation-audit.md) to ✅ and add the entry to [`../../plan.md`](../../plan.md) §4.
