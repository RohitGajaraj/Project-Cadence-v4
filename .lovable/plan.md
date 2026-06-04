## What's next (per the status board)

The Live status board says **Now building: idle**, and **Next up: Bundle 5 — E6 Mission Graph DAG view**, followed by Bundle 6 (lifecycle close: Discover→Define→Plan slice + N1 GitHub-issues sync). E4 fan-out polish and E5 multi-mission isolation are folded into Bundle 5.

The mission page already has the *timeline strip* and *live progress panel* (just shipped). What's missing — and what the rollup explicitly calls out as Step 5 — is the **graph view**: nodes for each agent hop + edges for each `agent.handoff` message, updating live, clickable into traces/costs/approvals. This is the "Live Mission Graph" success criterion in `plan.md` §3.

## Plan — Bundle 5: Live Mission Graph

### Scope (in)
1. **Mission Graph card on `/missions/$missionId`** — a DAG view rendered above (or toggled with) the existing hops list.
   - **Nodes** = one per `agent_runs` row in the mission. Show: agent slug + name, status pill (queued / running / completed / failed), step count, elapsed time, tiny cost/tokens chip when available.
   - **Edges** = one per `agent_messages` row, drawn `from_agent_slug → to_agent_slug`, labelled with `kind` (e.g. `handoff`) and a tooltip preview of `payload.task`. Source = `source_run_id`, target = `consumed_by_run_id` (fallback: next run for that `to_agent_slug`).
   - **Live**: re-uses the existing 2s refresh while mission `status='running'`.
   - **Click a node** → opens the existing hop card (scroll/expand) and exposes the per-hop **Trace** link, cost/tokens, current approval state if any.
2. **Fan-out readiness (E4 polish)** — render correctly when one parent hop produces ≥2 outbound messages (parallel children). No new tool yet; just make sure layout + edge routing handle branching without overlap. (Explicit `agent.spawn` tool stays deferred per backlog note.)
3. **Multi-mission isolation check (E5 polish)** — quick audit that `getMission` + the new graph only ever read rows scoped by `mission_id` and the existing workspace RLS; add a test mission with two concurrent missions in the same workspace and confirm no cross-bleed.
4. **Docs loop (mandatory, same commit)**:
   - Flip board: *Now building → Bundle 5 (E6)*, then on completion *Next up → Bundle 6*.
   - Append entry to `plan.md` §4 and `docs/feature-backlog.md` Recent log.
   - Update E6 entry in `docs/feature-backlog.md` with the verification checklist + a "How to use" block (where the graph lives, what clicking does).
   - Cross-link from `architecture/orchestration.md` ("Mission graph is the live read model of `missions` + `agent_runs` + `agent_messages`").

### Scope (out — deferred)
- Dedicated `agent.spawn` tool with explicit fan-out semantics + parent merge step (kept deferred; folded forward).
- Explicit per-mission message cap / loop-guard (Bundle 5 polish item, but cheap — will add only if implementation already touches the sweeper).
- Graph editing, drag-to-rearrange, persisted layout — not needed for the success criterion.

### Technical approach
- **No new tables.** Pure read model over `missions` + `agent_runs` + `agent_messages` (+ `agent_run_checkpoints` already joined). `getMission` already returns all three — graph is a frontend transform.
- **Rendering**: lightweight in-house SVG layout (topological columns by hop depth, vertical stacking for parallel children). Avoid pulling in `reactflow`/`dagre` for v1 — the missions we're shipping have ≤6 nodes, hand-rolled layout keeps bundle + complexity down. If layout gets gnarly for fan-out, revisit.
- **Files to touch**:
  - `src/routes/_authenticated.missions.$missionId.tsx` — add `<MissionGraph>` component, wire click handler to scroll/expand the matching hop card.
  - New `src/components/cadence/MissionGraph.tsx` — pure presentational; props = `{hops, messages, onSelectHop}`.
  - `src/lib/missions.functions.ts` — only if we discover a missing field during build (e.g. cost/tokens roll-up per run); otherwise untouched.
  - Docs: `docs/feature-backlog.md`, `plan.md`, `architecture/orchestration.md`.
- **Tokens only** from `src/styles.css` (status colors, edge stroke). No hex literals.
- **A11y**: nodes are real buttons, edges have aria-labels, keyboard-focusable.

### Success criteria (verify before declaring done)
1. Dispatching a single-agent mission shows **1 node, 0 edges**, status flips live.
2. Dispatching a multi-hop mission (Orchestrator handing off to Discovery → Strategist) shows **≥3 nodes connected by labelled edges**, updating within 2s as each hop starts/finishes.
3. Clicking a node scrolls to that hop's card and the **Trace** link works.
4. Two concurrent missions in the same workspace render independently — no edges or nodes leak between them.
5. Status board + `plan.md` §4 + E6 entry all updated in the same commit.

### After Bundle 5
Pick up **Bundle 6**: Discover→Define→Plan lifecycle slice on real data + `N1 github.issue.create` (we already have `GITHUB_TOKEN` + `GITHUB_REPO` secrets staged from the FND-RUNTIME work).

Want me to proceed with this, or would you rather jump straight to Bundle 6 (GitHub-issue creation closes a more visible loop end-to-end)?
