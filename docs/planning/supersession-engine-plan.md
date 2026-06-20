# Supersession Engine Implementation Plan (Decision Brain, increment DBR-1.5)

> _Created: 2026-06-20 · Last updated: 2026-06-20_

> **Status: PLAN (2026-06-20, cycle 58).** Cold-buildable, task-by-task build plan for the Decision Brain (H1) **supersession engine** — the moat's signature mechanic (outcome-labeled, invalidate-don't-delete). Produced by a 4-agent design workflow (3 parallel surveys + an opus synthesis) on 2026-06-20, grounded against the live code. Parent: [`../features/decision-brain.md`](../features/decision-brain.md); read surface it fits: [`../features/knowledge-graph-explorer.md`](../features/knowledge-graph-explorer.md); strategy: [`../strategy/horizon-bets.md`](../strategy/horizon-bets.md) (H1) + [`../strategy/moat.md`](../strategy/moat.md). Build queue: [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) §0/§3.

> **For agentic workers:** execute task-by-task (superpowers:subagent-driven-development or executing-plans). Steps use checkbox (`- [ ]`) syntax.

**Goal:** ship the first increment of the Decision Brain's supersession engine: when a human records an outcome, infer and WRITE typed `supersedes`/`contradicts` edges (with bi-temporal validity, invalidate-don't-delete) between the workspace's own past decisions/outcomes, so the graph can later answer "what contradicts this / what did this outcome invalidate" — the queries that make outcome-labeled judgment structurally un-backfillable (the moat). **Flag-gated OFF by default** (zero AI spend, byte-identical) until the founder activates + tunes it.

**Why this increment (DBR-1.5):** DBR-1 v1 (the read-side graph explorer) shipped in the knowledge lane over `artifact_lineage` with "an empty-but-ready supersession seam." Ambient Precedent (DBR-0 + increment 1) gives the Critic *precedent* but cannot express *contradiction/supersession*. This increment fills the write-side seam. It does NOT yet make the Critic reason over the edges multi-hop — that is DBR-2 (deferred, avoids read-side AI spend now).

## Architecture (write-only this increment)

`recordOutcome` (human-gated, fires weeks after ship) → best-effort `inferSupersession()` (the new gated orchestrator) → `loadDecisionPrecedent` (the already-shipped semantic candidate finder; the ONLY AI cost: one `embedOne`, surface `embed`) → PURE `classifySupersession(newVerdict, priorVerdict, score, threshold)` → write a typed edge into `artifact_lineage` + stamp `valid_to`/`invalidated_by` on the retired prior edge (invalidate-don't-delete). The existing explorer renders any edge by its `relation` wholesale, so written edges are renderable with NO read-surface change. Honest: write-only + dormant-with-no-data until the flag flips.

## Confirmed facts (grounded against the live code, 2026-06-20)

- **`artifact_lineage` DDL** (`supabase/migrations/20260528134847_*.sql:1-14`): `id, user_id, parent_kind, parent_id, child_kind, child_id, relation TEXT DEFAULT 'promoted', rationale, created_by_agent, ai_event_id, created_at`; `UNIQUE(user_id, parent_kind, parent_id, child_kind, child_id, relation)`; indexes on `(user_id,parent_kind,parent_id)` and `(user_id,child_kind,child_id)`. RLS `FOR ALL USING auth.uid()=user_id` (column-agnostic, so new columns are covered). **It is `user_id`-scoped — NO `workspace_id`** (corrects the design-workflow note; supersession edges inherit `user_id` scoping, no workspace tag needed).
- **`relation` is in the unique key**, so a `supersedes`/`contradicts` edge coexists with a `promoted` edge for the same pair — no constraint collision.
- **`recordLineage`** (`src/lib/lineage.functions.ts:23-51`): upserts on the unique key; takes `{parent_kind, parent_id, child_kind, child_id, relation?, rationale?, created_by_agent?, ai_event_id?}`. It does NOT set the new bi-temporal columns, so the orchestrator writes them directly (a direct `.from('artifact_lineage')` upsert/update) and leaves `lineage.functions.ts` UNTOUCHED.
- **The explorer reads an EXPLICIT column list** (`knowledge-graph-explorer.functions.ts:48`: `select('parent_kind,parent_id,child_kind,child_id,relation,rationale,created_at')`), so the 3 new columns are invisible to it — byte-identical read surface.
- **Candidate finder:** `loadDecisionPrecedent(supabase, {userId, workspaceId, text, excludeId})` (`src/lib/ai/decision-precedent.server.ts`) returns `PrecedentMatch[]` (`{id, title, verdict, summary, prdId, opportunityId, score}`). One `embedOne` inside = the only AI cost.
- **Flag idiom:** `costRoutingEnabled()` / `providerFallbackEnabled()` (`runtime.server.ts`): `const v = process.env.X; return v === '1' || v === 'true';`.
- **Hook point:** `recordOutcome` (`src/lib/outcome.functions.ts:161`), immediately after the `rememberOutcome(...)` call (~line 252-272), before the `return` (~274); `db`, `userId`, `prd`, `data.verdict`, `data.summary` are in scope.

## Global Constraints

- **Dormant-by-default:** env flag `DECISION_BRAIN_SUPERSESSION` (default OFF). `inferSupersession`'s FIRST line is `if (!supersessionEnabled()) return;` → zero `embedOne`, zero DB write, zero AI spend, `recordOutcome` byte-identical. Also gate any test-data seeding (the explorer renders written edges wholesale, so a dormant edge must never appear).
- **Invalidate-don't-delete:** only INSERT new typed edges and UPDATE `valid_to`/`invalidated_by` on the retired prior edge; NEVER `DELETE`, never mutate a `promoted` edge.
- **Additive migration:** 3 nullable columns, NO default, NO NOT NULL, no index/lock change.
- **Fail-safe:** the whole orchestrator is wrapped so it can NEVER throw into `recordOutcome` (mirror `rememberOutcome`'s "never let a memory write break the outcome").
- **Fit the seam, don't edit it:** do NOT edit `knowledge-graph-explorer.*`, `GraphPanel.tsx`, `_authenticated.knowledge.tsx` (knowledge lane), or the chokepoint/agent-core (`runtime.server.ts`, `loop.server.ts`, `tools/registry.server.ts`, `cache.server.ts`, `memory.server.ts`). Do NOT modify `lineage.functions.ts` (use it read-only / call it). New code lives in the AI-lane namespace `src/lib/ai/supersession.*` (file-disjoint from both lanes).
- **Offline-verifiable:** `classifySupersession` is PURE (no db/network), fully unit-tested. The live edge-write verifies on a publish/dry-run when DB access is available.
- **Honest claim:** ship as "write-path wired + renderable by the existing explorer, dormant-with-no-data until the flag flips." Mark ◐.
- **House style:** no em/en dashes; Bun runner (`bun test`, `bunx tsc --noEmit`, `bun run build`).

---

### Task 1: additive bi-temporal migration on `artifact_lineage`

**File:** create `supabase/migrations/<ts>_decision_brain_supersession_bitemporal.sql` (timestamp newer than all existing).

- [ ] Add three nullable columns, additive only (no default, no NOT NULL, no index change):
```sql
ALTER TABLE public.artifact_lineage
  ADD COLUMN IF NOT EXISTS valid_to timestamptz,        -- bi-temporal: when the belief stopped being true; NULL = currently valid
  ADD COLUMN IF NOT EXISTS invalidated_by uuid,         -- the lineage/learning row that retired this edge
  ADD COLUMN IF NOT EXISTS inference jsonb;             -- {verdict, score, source:'supersession-engine', ai_event_id}
```
- [ ] Comment the columns. RLS already covers them (`FOR ALL`). No index needed for v1 (avoid a table lock; revisit if read-side filtering by `valid_to` is added in DBR-2).
- [ ] **Live dry-run when DB access is available** (founder/publish step): `BEGIN; <alter>; ROLLBACK;` on prod via the Lovable/Supabase MCP to confirm a clean apply (offline this cycle: the migration is additive + idempotent, so it is safe by construction).

### Task 2: the PURE classifier `src/lib/ai/supersession.ts` (TDD)

- [ ] `export type SupersessionRelation = "supersedes" | "contradicts";`
- [ ] `export function classifySupersession(newVerdict: string, priorVerdict: string, score: number, threshold = SUPERSESSION_THRESHOLD): SupersessionRelation | null` — PURE. Proposed default matrix (conservative, mirrors the precedent engine's 0.3 floor):
  - below `threshold` → `null` (noise control).
  - `newVerdict==='missed'` and `priorVerdict` in `{validated, mixed}` → `contradicts` (a fresh failure contradicts a prior success-belief).
  - `newVerdict==='validated'` and `priorVerdict==='missed'` → `supersedes` (a fresh success supersedes the prior failure-belief on the revisited approach).
  - otherwise (same verdict, `mixed` as the new verdict, etc.) → `null`.
- [ ] `export const SUPERSESSION_THRESHOLD = 0.3;` and `export const SUPERSESSION_MAX = 2;` (cap edges per outcome — one outcome never spams the graph).
- [ ] A pure edge-shape builder if helpful (maps a `PrecedentMatch` + relation → the edge fields). No db imports.

### Task 3: `src/lib/ai/supersession.test.ts` (the offline-verifiable gate)

- [ ] Test the full matrix: `missed`-vs-`validated` → `contradicts`; `validated`-vs-`missed` → `supersedes`; same-verdict → `null`; `mixed`-as-new → `null`; below-threshold → `null`; cap at `SUPERSESSION_MAX`. Pure, no network/db.

### Task 4: the gated orchestrator `src/lib/ai/supersession.server.ts`

- [ ] `function supersessionEnabled(): boolean` — env `DECISION_BRAIN_SUPERSESSION`, the `'1' || 'true'` idiom, default OFF.
- [ ] `export async function inferSupersession(supabase, { userId, prdId, opportunityId, text, verdict, summary, aiEventId }): Promise<void>`:
  1. `if (!supersessionEnabled()) return;` (FIRST line).
  2. wrap the rest in try/catch returning void (never throws).
  3. candidates = `await loadDecisionPrecedent(supabase, { userId, workspaceId: null, text, excludeId: <this prd/opp> })`.
  4. for each candidate (capped at `SUPERSESSION_MAX`): `rel = classifySupersession(verdict, candidate.verdict, candidate.score)`; if null, skip.
  5. write the typed edge directly: `supabase.from('artifact_lineage').upsert({ user_id: userId, parent_kind, parent_id (the NEW outcome/prd), child_kind, child_id (the prior decision/prd), relation: rel, rationale: summary?.slice(0,500), created_by_agent: 'supersession-engine', inference: { verdict, score: candidate.score, source: 'supersession-engine', ai_event_id: aiEventId } }, { onConflict: 'user_id,parent_kind,parent_id,child_kind,child_id,relation' })`. (Confirm the parent/child direction with founder-decision-point #1; proposed: new-outcome `parent` → prior-belief `child` for `contradicts`.)
  6. invalidate-don't-delete: `UPDATE artifact_lineage SET valid_to = now(), invalidated_by = <new lineage/learning id> WHERE user_id = userId AND <the prior belief's still-current edge> AND valid_to IS NULL` (bounded; idempotent — re-run no-ops because `valid_to` is already set).
- [ ] Use the `ArtifactKind` values + the real prd/opportunity ids from the precedent match + the current outcome (confirm the id mapping, open-confirmation #2). Resolve the edge endpoints to real `artifact_lineage` parent/child ids.

### Task 5: hook `inferSupersession` into `recordOutcome`

- [ ] In `src/lib/outcome.functions.ts`, immediately after the `rememberOutcome(...)` call (~line 252-272) and before the `return` (~274), add ONE best-effort call:
```ts
      // DBR-1.5: best-effort, flag-gated supersession-edge inference (never breaks the outcome).
      try {
        await inferSupersession(db, {
          userId,
          prdId: prd.id,
          opportunityId: (prd.opportunity_id as string | null) ?? null,
          text: [prd.title, data.summary].filter(Boolean).join(". "),
          verdict: data.verdict,
          summary: data.summary,
          aiEventId: null,
        });
      } catch (e) {
        console.error("inferSupersession failed (non-fatal):", e);
      }
```
(`inferSupersession` is itself fail-safe; the outer try is belt-and-suspenders. Confirm `prd.title`/`prd.opportunity_id` are selected at the hook, open-confirmation #2.)

### Task 6: `.env.example` + doc-loop

- [ ] Add `DECISION_BRAIN_SUPERSESSION=` to `.env.example` with an OFF/comment (the AI-spend gate; default off).
- [ ] Doc-loop: `decision-brain.md` (flip the deferred-write-path note → "DBR-1.5 shipped ◐, dormant-with-no-data until the flag flips"); `knowledge-graph-explorer.md` (note the supersession seam now has a write-path); SSOT §0/§3/§6; `feature-dashboard.md` (the DBR row 148 sub-task or a new row); `plan.md` §4; `session-decisions.md`; the overnight report. Honest: write-path wired + logic unit-verified; no data until the founder enables.

---

## Founder-decision-points (proposed defaults applied; founder tunes at ACTIVATION)

These are graph-taste/sequencing calls. The increment ships flag-OFF, so NONE block the build — the defaults are recorded and the founder tunes them when flipping `DECISION_BRAIN_SUPERSESSION` on:
1. **Edge direction:** `contradicts` points new-outcome → prior-belief (proposed). Visible via the renderer's arrowheads.
2. **Aggressiveness:** `SUPERSESSION_THRESHOLD=0.3` + `SUPERSESSION_MAX=2` (proposed, conservative; tune live to avoid false-contradiction graph pollution — the append-only-graph-rots risk).
3. **Verdict→edge matrix:** `missed`-vs-prior-`validated/mixed`→`contradicts`; `validated`-vs-prior-`missed`→`supersedes`; `mixed`-as-new never asserts (proposed).
4. **Sequencing vs DBR-2:** this increment WRITES + renders edges but does NOT make the Critic reason over them (proposed: defer read-reasoning to DBR-2 to avoid read-side AI spend now).
5. **Embed-only heuristic vs an LLM judge:** v1 uses verdict-conflict + semantic-similarity (no extra `callModel`, no new `CallSurface`). An LLM "is this really a contradiction?" judge is a later enrichment (proposed).

## Open confirmations (verify at implementation time)

1. ~~`workspace_id` on `artifact_lineage`~~ — RESOLVED: there is none; the table is `user_id`-scoped. No workspace tag needed.
2. `recordOutcome` selects `prd.title` + `prd.opportunity_id` at the hook (it selects `id,workspace_id,opportunity_id,title` per the WM-F1 work — confirm) so the edge endpoints + query text are available.
3. `loadDecisionPrecedent` ids (`prdId`/`opportunityId`) map to real `artifact_lineage` parent/child `(kind,id)` pairs so the retire-prior UPDATE targets real edges; choose the edge endpoints accordingly.
4. `embedOne` rides surface `embed` (excluded from provider-fallback) so the gated spend is exactly one cheap embed per recorded outcome (only when the flag is on).
5. Idempotency on re-record: the edge upsert (onConflict incl. `relation`) + the `valid_to`-already-set UPDATE are both idempotent.
6. Live `artifact_lineage` shape vs the committed DDL: confirm no out-of-band drift before applying (Lovable/Supabase MCP dry-run when DB access is available).
7. File-naming non-collision: `src/lib/ai/supersession.*` is claimed by no other lane (the knowledge lane owns `knowledge-graph*`/`lineage*`).

## Verification (the gate)

- **Unit:** `bun test src/lib/ai/supersession.test.ts` (the pure matrix) + full `bun test` green.
- **Gates (correctness-only, velocity ruling):** `bunx tsc --noEmit` 0, `bun run build` ok, `bunx eslint <touched files>` 0, the adversarial runtime-fatal review (the dormant guard truly no-ops; invalidate-don't-delete holds; the explorer read surface is byte-identical; the hook is fail-safe; the migration is additive/idempotent).
- **Dormant proof:** with `DECISION_BRAIN_SUPERSESSION` unset, `inferSupersession` returns on line 1 → zero embed, zero write, `recordOutcome` byte-identical.
- **Status:** the pure classifier marks ✅ (unit-verified); the write-path + migration mark ◐ (live edge-write + the migration apply verify on a publish/dry-run with DB access; dormant-with-no-data until the founder enables).
