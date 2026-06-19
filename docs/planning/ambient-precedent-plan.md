# Ambient Precedent Implementation Plan

> _Created: 2026-06-20 · Last updated: 2026-06-20_

> **Status: PLAN (2026-06-20).** Granular, cold-buildable task-by-task build plan for the Decision Brain (H1) increment 1, Ambient Precedent. Spec: [`../features/ambient-precedent.md`](../features/ambient-precedent.md); feature parent: [`../features/decision-brain.md`](../features/decision-brain.md); strategy: [`../strategy/horizon-bets.md`](../strategy/horizon-bets.md) (H1). Status board: [`feature-dashboard.md`](./feature-dashboard.md) row 148 (DBR); build queue: [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) §3.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first increment of the Decision Brain (H1): a proactive precedent nudge that surfaces a workspace's own past shipped outcomes ("you reasoned this way before; here is how it went") wherever a decision is called out, powered by a semantic match over the outcome memories we already store.

**Architecture:** One shared server-side `decision-precedent` engine does a semantic recall over `agent_memory` rows of kind `outcome` (already embedded by `rememberOutcome`), filters by a similarity threshold, and returns a small ranked list. One reusable `PrecedentNudge` UI primitive renders it. It is wired at the three densest decision seams (the Critic, the opportunity detail, the spec/PRD view). Migration-free, best-effort, and fail-safe (no precedent renders nothing).

**Tech Stack:** TanStack Start server functions, Supabase (`match_agent_memory` RPC + pgvector), `embedOne` (the existing embedder), React 19 + shadcn/Ember UI, `bun test`.

## Global Constraints

- **Bun** is the runner: tests `bun test`, typecheck `bunx tsc --noEmit`, build `bun run build`. All three green before any commit.
- **House style:** no em/en dashes, no AI-cliche phrasing, in code comments and any user-facing copy.
- **Migration-free:** this increment adds NO `supabase/migrations/*`. It reads existing data and stores nothing new except optional `jsonb` metadata fields (forward-only, no schema change).
- **Fail-safe:** every seam degrades to rendering nothing; a precedent failure must never break the Critic or a decision surface (wrap reads in try/catch returning `[]`).
- **`.server.ts` files run only in the Worker** and must never be imported by a client component.
- **Design rule (founder, 2026-06-20):** any front-end build actively INVOKES the design skills (`impeccable`, `emil-design-eng`, the taste skills) and obeys the Engine-Room Doctrine + Ember system (`docs/conventions/design-context.md`); reuse `.bento` / `.mono-label` / verdict-chip patterns, invent no colors.
- **Spec:** [`../features/ambient-precedent.md`](../features/ambient-precedent.md). **Status discipline:** mark a deliverable ◐ (not ✅) until behaviorally verified on a publish; the engine's pure logic is ✅ once unit-tested.
- **Reference APIs (verified in-repo):**
  - `embedOne(text: string): Promise<number[]>` from `@/lib/rag/embed.server`.
  - RPC `match_agent_memory(query_embedding, for_user uuid, for_agent_slug text, match_count int, for_workspace uuid, for_account uuid)` returns rows `{ id, content, kind, importance, agent_slug, similarity }` (similarity = `1 - cosine_distance`, higher is closer), ordered closest-first. The trailing `for_workspace` / `for_account` overloads can 404 pre-migration with PostgREST code `PGRST202` (handled by the fallback below).
  - Outcome memories: `agent_memory` rows with `kind = 'outcome'`, `scope = 'global'`, `metadata = { source:'outcome', verdict, prior_ice, new_ice, prd_id, opportunity_id, workspace_id, ... }`, written by `rememberOutcome` (`src/lib/ai/memory.server.ts`).
  - `DecisionPrecedentRow` + `formatDecisionPrecedent(rows)` already exist and are unit-tested in `src/lib/ai/outcome-memory.ts`.

---

### Task 1: Persist clean titles on outcome memories (so precedent renders a real spec name)

**Why:** outcome memories store `prd_id` / `opportunity_id` in metadata but not the human titles, and `match_agent_memory` does not return metadata anyway. Storing the titles forward-only lets the engine render `"Smart Off-Hours Routing"` instead of the fallback "an untitled spec", with no migration (it is a `jsonb` field) and no backfill (old rows fall back gracefully).

**Files:**
- Modify: `src/lib/ai/memory.server.ts` (the `rememberOutcome` insert's `metadata` object)
- Modify: `src/lib/outcome.functions.ts` (the `rememberOutcome(...)` call in `recordOutcome`, pass the titles)

**Interfaces:**
- Consumes: nothing new.
- Produces: outcome memories whose `metadata` includes `prd_title: string | null` and `opp_title: string | null`.

- [ ] **Step 1: Add the title fields to `rememberOutcome`'s args + metadata.** In `src/lib/ai/memory.server.ts`, extend the `args` type with `prdTitle: string | null; oppTitle: string | null;` and add them to the inserted `metadata`:

```ts
        metadata: {
          source: "outcome",
          workspace_id: args.workspaceId,
          prd_id: args.prdId,
          opportunity_id: args.opportunityId,
          learning_id: args.learningId,
          verdict: args.verdict,
          prior_ice: args.priorIce,
          new_ice: args.newIce,
          prd_title: args.prdTitle,
          opp_title: args.oppTitle,
        },
```

- [ ] **Step 2: Pass the titles at the call site.** In `src/lib/outcome.functions.ts`, in the `rememberOutcome(db, { ... })` call inside `recordOutcome`, add:

```ts
      prdTitle: (prd.title as string | null) ?? null,
      oppTitle,
```

(`oppTitle` is already computed above the call; `prd.title` is already selected.)

- [ ] **Step 3: Verify typecheck + build.**

Run: `bunx tsc --noEmit && bun run build`
Expected: exit 0, build ok.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/ai/memory.server.ts src/lib/outcome.functions.ts
git commit -m "feat(decision-brain): persist prd/opp titles on outcome memories for clean precedent rendering"
```

---

### Task 2: The precedent engine (semantic recall over outcome memories)

**Files:**
- Create: `src/lib/ai/decision-precedent.server.ts`
- Test: `src/lib/ai/decision-precedent.test.ts`

**Interfaces:**
- Consumes: `embedOne`, `match_agent_memory`, the `agent_memory` table, `DecisionPrecedentRow` from `outcome-memory.ts`.
- Produces:
  - `type PrecedentMatch = DecisionPrecedentRow & { id: string; prdId: string | null; opportunityId: string | null; score: number }`
  - `const PRECEDENT_THRESHOLD = 0.3` (exported, tunable)
  - `function rankPrecedent(candidates: RawPrecedentCandidate[], threshold?: number, max?: number): PrecedentMatch[]` (PURE: filter to outcomes above threshold, sort by score desc, cap)
  - `async function loadDecisionPrecedent(supabase, { userId, workspaceId, text, excludeId? }): Promise<PrecedentMatch[]>` (the live engine; best-effort, returns `[]` on any failure)

Where `RawPrecedentCandidate = { id: string; kind: string; similarity: number; metadata: { verdict?: string; prior_ice?: number|null; new_ice?: number|null; prd_id?: string|null; opportunity_id?: string|null; prd_title?: string|null; opp_title?: string|null } | null; content: string }`.

- [ ] **Step 1: Write the failing test for the pure ranker.**

```ts
import { describe, expect, test } from "bun:test";
import { rankPrecedent, PRECEDENT_THRESHOLD } from "./decision-precedent.server";

const cand = (over: Partial<{ id: string; kind: string; similarity: number; metadata: Record<string, unknown>; content: string }> = {}) => ({
  id: over.id ?? "m1",
  kind: over.kind ?? "outcome",
  similarity: over.similarity ?? 0.9,
  content: over.content ?? "Outcome on the spec.",
  metadata: over.metadata ?? { verdict: "missed", prd_title: "Bet A", opp_title: null, prior_ice: 6, new_ice: 4, prd_id: "p1", opportunity_id: "o1" },
});

describe("rankPrecedent", () => {
  test("keeps only outcome-kind candidates above the threshold, sorted by score, capped", () => {
    const rows = rankPrecedent(
      [
        cand({ id: "a", similarity: 0.9 }),
        cand({ id: "b", similarity: 0.1 }),                 // below threshold -> dropped
        cand({ id: "c", kind: "reflection", similarity: 0.95 }), // not an outcome -> dropped
        cand({ id: "d", similarity: 0.5 }),
      ],
      PRECEDENT_THRESHOLD,
      3,
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "d"]);
    expect(rows[0].verdict).toBe("missed");
    expect(rows[0].title).toBe("Bet A");
  });

  test("caps the result count", () => {
    const many = Array.from({ length: 6 }, (_, i) => cand({ id: `m${i}`, similarity: 0.9 - i * 0.05 }));
    expect(rankPrecedent(many, PRECEDENT_THRESHOLD, 3)).toHaveLength(3);
  });

  test("maps title/verdict/ICE from metadata and falls back when title is absent", () => {
    const [row] = rankPrecedent([cand({ id: "x", metadata: { verdict: "validated", prior_ice: 6, new_ice: 7 } })], PRECEDENT_THRESHOLD, 3);
    expect(row.verdict).toBe("validated");
    expect(row.title).toBeNull();
    expect(row.priorIce).toBe(6);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails** (`rankPrecedent` not defined).

Run: `bun test src/lib/ai/decision-precedent.test.ts`
Expected: FAIL ("export named 'rankPrecedent' not found").

- [ ] **Step 3: Implement the engine.** Create `src/lib/ai/decision-precedent.server.ts`:

```ts
/**
 * Decision precedent engine (Decision Brain, increment 1 / Ambient Precedent).
 *
 * Semantic recall over the workspace's OUTCOME memories (the rows rememberOutcome
 * writes to agent_memory with embeddings), gated by a similarity threshold, so a
 * decision surface can show "you reasoned this way before; here is how it went."
 * Best-effort + fail-safe: any failure returns []. Migration-free: reuses the
 * existing match_agent_memory RPC + a cheap id-keyed metadata read.
 *
 * .server.ts - Worker-only; never bundled to the client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "@/lib/rag/embed.server";
import { OUTCOME_MEMORY_KIND, type DecisionPrecedentRow, type OutcomeVerdict } from "./outcome-memory";

/** Similarity floor (1 - cosine distance). Tunable; START conservative and tune on live data. */
export const PRECEDENT_THRESHOLD = 0.3;
/** Max outcomes surfaced at any decision point. */
export const PRECEDENT_MAX = 3;
/** Semantic candidate pool pulled before filtering to outcomes. */
const CANDIDATE_POOL = 20;

export type PrecedentMatch = DecisionPrecedentRow & {
  id: string;
  prdId: string | null;
  opportunityId: string | null;
  score: number;
};

type RawPrecedentCandidate = {
  id: string;
  kind: string;
  similarity: number;
  content: string;
  metadata: {
    verdict?: string;
    prior_ice?: number | null;
    new_ice?: number | null;
    prd_id?: string | null;
    opportunity_id?: string | null;
    prd_title?: string | null;
    opp_title?: string | null;
  } | null;
};

const VERDICTS: OutcomeVerdict[] = ["validated", "missed", "mixed"];

/** PURE: outcome-kind candidates above the threshold, score-sorted, capped, mapped to rows. */
export function rankPrecedent(
  candidates: RawPrecedentCandidate[],
  threshold = PRECEDENT_THRESHOLD,
  max = PRECEDENT_MAX,
): PrecedentMatch[] {
  return candidates
    .filter((c) => c.kind === OUTCOME_MEMORY_KIND && c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, max)
    .map((c) => {
      const m = c.metadata ?? {};
      const verdict: OutcomeVerdict = VERDICTS.includes(m.verdict as OutcomeVerdict)
        ? (m.verdict as OutcomeVerdict)
        : "mixed";
      return {
        id: c.id,
        title: m.prd_title?.trim() || m.opp_title?.trim() || null,
        verdict,
        summary: c.content,
        priorIce: typeof m.prior_ice === "number" ? m.prior_ice : null,
        newIce: typeof m.new_ice === "number" ? m.new_ice : null,
        prdId: m.prd_id ?? null,
        opportunityId: m.opportunity_id ?? null,
        score: c.similarity,
      };
    });
}

/** Live engine: embed the decision text, semantic-match outcomes, threshold + cap. */
export async function loadDecisionPrecedent(
  supabase: SupabaseClient,
  args: { userId: string; workspaceId: string | null; text: string; excludeId?: string },
): Promise<PrecedentMatch[]> {
  const text = args.text?.trim();
  if (!text) return [];
  try {
    const v = await embedOne(text);
    if (!Array.isArray(v) || v.length === 0) return [];
    const base = {
      query_embedding: v as unknown as string,
      for_user: args.userId,
      for_agent_slug: "critic", // global-scope outcome rows surface regardless of slug
      match_count: CANDIDATE_POOL,
    };
    const withWs = { ...base, for_workspace: args.workspaceId };
    let res = await supabase.rpc("match_agent_memory", withWs);
    if (res.error?.code === "PGRST202") res = await supabase.rpc("match_agent_memory", base);
    const hits = (res.data ?? []) as Array<{ id: string; content: string; kind: string; similarity: number }>;
    const outcomeHits = hits.filter((h) => h.kind === OUTCOME_MEMORY_KIND && h.id !== args.excludeId);
    if (!outcomeHits.length) return [];

    // match_agent_memory does not return metadata; fetch it for the surviving ids.
    const meta = await supabase
      .from("agent_memory")
      .select("id,metadata")
      .in("id", outcomeHits.map((h) => h.id));
    const metaById = new Map(
      ((meta.data ?? []) as Array<{ id: string; metadata: unknown }>).map((r) => [r.id, r.metadata]),
    );
    const candidates: RawPrecedentCandidate[] = outcomeHits.map((h) => ({
      id: h.id,
      kind: h.kind,
      similarity: h.similarity,
      content: h.content,
      metadata: (metaById.get(h.id) as RawPrecedentCandidate["metadata"]) ?? null,
    }));
    return rankPrecedent(candidates);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the test, verify it passes.**

Run: `bun test src/lib/ai/decision-precedent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + full tests + commit.**

```bash
bunx tsc --noEmit && bun test
git add src/lib/ai/decision-precedent.server.ts src/lib/ai/decision-precedent.test.ts
git commit -m "feat(decision-brain): semantic decision-precedent engine over outcome memories"
```

---

### Task 3: Upgrade the Critic to the semantic engine (seam 1, replaces DBR-0's recency query)

**Why:** DBR-0 gave the Critic a recency-based `learnings` query. Swap it for the semantic engine so the Critic cites *relevant* precedent, and delete the now-superseded recency helper to avoid dead code.

**Files:**
- Modify: `src/lib/ai/critic.server.ts` (remove `loadDecisionPrecedent` + `PrecedentQueryRow`; call the engine)

**Interfaces:**
- Consumes: `loadDecisionPrecedent` (Task 2), `formatDecisionPrecedent` (existing).
- Produces: no new exports.

- [ ] **Step 1: Replace the import + delete the local recency helper.** In `src/lib/ai/critic.server.ts`, replace the `formatDecisionPrecedent` import line and remove the local `PrecedentQueryRow` type + `loadDecisionPrecedent` function (the whole DBR-0 block):

```ts
import {
  formatDecisionPrecedent,
  type DecisionPrecedentRow,
} from "@/lib/ai/outcome-memory";
import { loadDecisionPrecedent } from "@/lib/ai/decision-precedent.server";
```

- [ ] **Step 2: Call the engine with the row's text.** Replace the DBR-0 precedent block (the `const precedent = formatDecisionPrecedent(await loadDecisionPrecedent(supabase, ...workspace_id...))` lines) with:

```ts
  // DBR / Ambient Precedent: semantic precedent over the workspace's past outcomes.
  const precedentRows = await loadDecisionPrecedent(supabase, {
    userId,
    workspaceId: (row.workspace_id as string | null) ?? null,
    text: subject,
    excludeId: undefined,
  });
  const precedent = formatDecisionPrecedent(precedentRows as DecisionPrecedentRow[]);
```

(The `userContent` / `systemContent` lines that consume `precedent` stay unchanged.)

- [ ] **Step 3: Typecheck + build + full tests.**

Run: `bunx tsc --noEmit && bun run build && bun test`
Expected: exit 0 / build ok / all pass (no test references the deleted helper).

- [ ] **Step 4: Commit.**

```bash
git add src/lib/ai/critic.server.ts
git commit -m "feat(decision-brain): Critic uses the semantic precedent engine (supersedes DBR-0 recency)"
```

---

### Task 4: A server function the UI seams call

**Files:**
- Create: `src/lib/decision-precedent.functions.ts`

**Interfaces:**
- Consumes: `loadDecisionPrecedent` (Task 2).
- Produces: `getDecisionPrecedent` (a `createServerFn` returning `PrecedentMatch[]` for a target opportunity or PRD).

- [ ] **Step 1: Implement the server fn.** Mirror the auth + untyped-client pattern in `src/lib/outcome.functions.ts` (`requireSupabaseAuth`, `context.supabase`, `context.userId`). It loads the target row, builds the query text from its fields, and calls the engine excluding the target's own past outcome:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/lib/auth-middleware"; // match outcome.functions.ts import
import { loadDecisionPrecedent } from "@/lib/ai/decision-precedent.server";

export const getDecisionPrecedent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ kind: z.enum(["opportunity", "prd"]), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;
    const table = data.kind === "opportunity" ? "opportunities" : "prds";
    const { data: row } = await db.from(table).select("*").eq("id", data.id).single();
    if (!row) return [];
    const text =
      data.kind === "opportunity"
        ? [row.title, row.problem, row.hypothesis].filter(Boolean).join(". ")
        : [row.title, (row.body_md ?? "").slice(0, 2000)].filter(Boolean).join(". ");
    return loadDecisionPrecedent(db, {
      userId,
      workspaceId: (row.workspace_id as string | null) ?? null,
      text,
    });
  });
```

> Before implementing, confirm the exact middleware import path/name used by `src/lib/outcome.functions.ts` (e.g. `requireSupabaseAuth`) and copy it verbatim.

- [ ] **Step 2: Typecheck + build.**

Run: `bunx tsc --noEmit && bun run build`
Expected: exit 0, build ok.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/decision-precedent.functions.ts
git commit -m "feat(decision-brain): getDecisionPrecedent server fn for UI seams"
```

---

### Task 5: The `PrecedentNudge` UI primitive

**Design gate:** before coding, load `docs/conventions/design-context.md` + `docs/conventions/engine-room-doctrine.md` and INVOKE the `impeccable` skill on the component (founder ruling). Mirror the existing `src/components/governance/CriticBadge.tsx` for the verdict-chip + Ember styling pattern.

**Files:**
- Create: `src/components/decision/PrecedentNudge.tsx`

**Interfaces:**
- Consumes: `getDecisionPrecedent` (Task 4) via `useServerFn` + `useQuery`.
- Produces: `<PrecedentNudge kind="opportunity" | "prd" targetId={string} />`.

- [ ] **Step 1: Implement the component.** It fetches precedent for the target, renders nothing while empty/loading, and otherwise shows a calm, dismissible block: a `.mono-label` header ("Precedent"), then up to 3 rows of `verdict chip + summary + link`. Verdict chip colors reuse the role-color law (moss = validated, madder = missed, neutral = mixed); invent no colors. Dismiss is local `useState` (session-only, no persistence in v1).

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDecisionPrecedent } from "@/lib/decision-precedent.functions";

const CHIP: Record<string, string> = {
  validated: "text-moss-foreground bg-moss/10",
  missed: "text-madder-foreground bg-madder/10",
  mixed: "text-muted-foreground bg-muted",
};

export function PrecedentNudge({ kind, targetId }: { kind: "opportunity" | "prd"; targetId: string }) {
  const [dismissed, setDismissed] = useState(false);
  const fetchPrecedent = useServerFn(getDecisionPrecedent);
  const { data } = useQuery({
    queryKey: ["decision-precedent", kind, targetId],
    queryFn: () => fetchPrecedent({ data: { kind, id: targetId } }),
    staleTime: 60_000,
  });
  if (dismissed || !data || data.length === 0) return null;
  return (
    <aside className="bento" aria-label="Decision precedent">
      <div className="flex items-center justify-between">
        <span className="mono-label">Precedent &mdash; you reasoned this way before</span>
        <button className="text-xs text-muted-foreground" onClick={() => setDismissed(true)}>Dismiss</button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {data.map((p) => (
          <li key={p.id} className="text-sm">
            <span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${CHIP[p.verdict] ?? CHIP.mixed}`}>
              {p.verdict}
            </span>
            {p.title ? <strong>{p.title}: </strong> : null}
            {p.summary}
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

> Match the actual Ember chip classes used by `CriticBadge.tsx` (the `CHIP` map above is the intent; copy the project's real moss/madder utility classes). Replace `&mdash;` with the house-style word if the humanization gate flags it.

- [ ] **Step 2: Typecheck + build.**

Run: `bunx tsc --noEmit && bun run build`
Expected: exit 0, build ok.

- [ ] **Step 3: Commit.**

```bash
git add src/components/decision/PrecedentNudge.tsx
git commit -m "feat(decision-brain): reusable PrecedentNudge UI primitive"
```

---

### Task 6: Wire the nudge into the opportunity + spec seams

**Why:** the two remaining v1 decision seams. Mirror where `CriticBadge` is already rendered (it sits on opportunity detail + PRD detail), and drop `PrecedentNudge` beside it.

**Files:**
- Modify: the opportunity detail surface (find via `grep -rn "CriticBadge" src/` and the opportunity route/component)
- Modify: the PRD/spec detail surface (same grep)

**Interfaces:**
- Consumes: `<PrecedentNudge>` (Task 5).
- Produces: nothing.

- [ ] **Step 1: Locate the seams.** Run `grep -rn "CriticBadge" src/components src/routes` to find the opportunity-detail and PRD-detail render sites.

- [ ] **Step 2: Render the nudge on the opportunity detail.** Beside the opportunity's `CriticBadge`, add `<PrecedentNudge kind="opportunity" targetId={opportunity.id} />` (use the real id prop name in that component).

- [ ] **Step 3: Render the nudge on the spec/PRD detail.** Beside the PRD's `CriticBadge`, add `<PrecedentNudge kind="prd" targetId={prd.id} />`.

- [ ] **Step 4: Typecheck + build.**

Run: `bunx tsc --noEmit && bun run build`
Expected: exit 0, build ok.

- [ ] **Step 5: Commit.**

```bash
git add -p   # stage only the two seam files
git commit -m "feat(decision-brain): show PrecedentNudge on opportunity + spec surfaces (3 seams live)"
```

---

## Verification (end to end)

- **Unit:** `bun test src/lib/ai/decision-precedent.test.ts` passes; full `bun test` green.
- **Gates:** `bunx tsc --noEmit` exit 0, `bun run build` ok.
- **Behavioral (on next publish, since this reads live embedded data):** on the seeded demo workspace, open an opportunity/spec that resembles a past shipped outcome and confirm the nudge shows the relevant past verdict with a link; open one with no similar history and confirm it shows nothing. The Critic verdict on a similar bet should reference the past outcome in its risks/missing-evidence.
- **Threshold tuning:** `PRECEDENT_THRESHOLD` (0.3) is a starting value for the `1 - cosine` metric; tune against live precision/recall after the first publish. Log dropped-vs-shown counts if tuning proves noisy.
- **Status:** mark the engine + ranker ✅ (unit-verified); mark the Critic + UI seams ◐ until render-verified on a publish.

## Self-review notes (done)

- **Spec coverage:** engine (Task 2) = spec unit 1; primitive (Task 5) = unit 2; seams (Tasks 3 + 6) = unit 3; noise control = threshold + cap + dismiss (Tasks 2 + 5). Migration-free + fail-safe constraints honored. Titles (Task 1) close the one gap between the spec's "clean render" and the data we actually store.
- **Type consistency:** `PrecedentMatch extends DecisionPrecedentRow`; `loadDecisionPrecedent` and `rankPrecedent` signatures are used identically in Tasks 3 and 4; `getDecisionPrecedent` returns `PrecedentMatch[]` consumed by Task 5.
- **Open confirmations flagged inline:** the auth-middleware import path (Task 4) and the real Ember chip classes (Task 5) must be copied from the named reference files at implementation time.
