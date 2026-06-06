## F-IA-MERGE-OBSERVE — Run group + Observe merge

### Final sidebar structure

```
Discover    Discovery · Opportunities
Deliver     PRDs · Docs · Roadmap · Tasks · Build Console
Agents      Agents · Missions · Swarm HUD · Prompt Studio · Sync Inbox
Outcome     Outcome
Run         Observe · Evals                       ← was "AI Ops" (4 items)
Govern      Guardrails · Governance · Budgets · Integrations   ← unchanged
```

Run shrinks from 4 → 2. Govern is not touched. Watching ≠ governing — two groups, two mental models.

### New surface: `/observe`

One page, three tabs with live counts in the labels:

- `Analytics` — today's spend/tokens/latency rollup (lift from `/analytics`)
- `Traces · {n} today` — trace list + waterfall (lift from `/traces`)
- `Drift · {n} flagged` — baselines + incidents (lift from `/drift`)

Tab state in URL: `/observe?tab=analytics|traces|drift`. Default `analytics`. H1 = `Observe`. Sentence-case, no kickers.

### Steps

1. **New route** `src/routes/_authenticated.observe.tsx` — Tabs shell, reads `?tab=`, default `analytics`. Lifts the existing page bodies of `_authenticated.analytics.tsx`, `_authenticated.traces.tsx`, `_authenticated.drift.tsx` into three local panel components (no logic changes, no new server fns). Trace detail stays at `/traces/$traceId` and is linked from the Traces tab.
2. **Counts in tab labels** — reuse data already fetched by each panel (today's trace count from `getDriftOverview`/traces query; open-drift count from `drift_overview.openIncidents.length`). No new server fn.
3. **Redirects** — replace `_authenticated.analytics.tsx`, `_authenticated.traces.tsx` (index only, keep `_authenticated.traces.$traceId.tsx`), `_authenticated.drift.tsx` with `beforeLoad: () => redirect({ to: "/observe", search: { tab: "analytics|traces|drift" } })`. Preserves old bookmarks and command-palette entries.
4. **Sidebar** in `src/components/cadence/AppShell.tsx`:
   - Rename group `aiops` label `"AI Ops"` → id `run`, label `"Run"`.
   - Replace its 4 items with: `{ to: "/observe", label: "Observe", icon: Activity }`, `{ to: "/evals", label: "Evals", icon: FlaskConical }`.
   - `Govern` group untouched.
5. **Command palette** (`CommandPalette.tsx`) — add `Observe` entry, drop the three old ones (or point them to `/observe?tab=…`).
6. **Voice pass** on the new page only — sentence-case H1, no em/en dashes, no "Phase/Bundle" kickers, v3 empty states.
7. **Doc closure (same turn):**
   - `docs/feature-backlog.md` — add `F-IA-MERGE-OBSERVE` row, flip ☑, update Live status board + Recent log + Last updated. Add "How to use / verify" block (route, tabs, redirects, sidebar nav path).
   - `plan.md` §4 — one-liner WHY ("Run + Observe merge: shrink AI Ops 4→2, kill 'observability' jargon, keep Govern intact").
   - `architecture/frontend.md` — note `/observe` tabs pattern + the three redirects.

### Out of scope (explicit)

- Govern group, Guardrails, Governance, Budgets, Integrations — no changes.
- Evals — stays its own route (authoring ≠ observation).
- No server-function changes. No DB migrations. No new tokens.
- No rename of `Agents` or any other group.

### Verification

- `/observe` loads on the Analytics tab; tab switching updates the URL.
- Old URLs `/analytics`, `/traces`, `/drift` redirect to the matching tab.
- `/traces/$traceId` still works (deep-link from the Traces tab).
- Sidebar shows `Run › Observe · Evals` and `Govern › Guardrails · Governance · Budgets · Integrations`.
- ⌘K resolves "Observe".

Awaiting approval to implement.
