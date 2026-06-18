# Agent experience: the roster model, faces, identity, and the relay

> **What this is.** The canonical plan for how Cadence models, names, shows, and manages its agents: the resolution of the long-standing "19 agents vs 6" confusion, the cast-vs-crew exposure model, the friendly naming + visual-identity system, and the live "relay" that shows agents working (in parallel) under each station. This builds ON the shipped agent substrate (orchestrator, memory, reactor, swarm HUD) documented in [`agent-ecosystem-plan.md`](./agent-ecosystem-plan.md); it does not replace it. It turns that substrate into a calm, legible, branded surface that honors the Engine-Room Doctrine.
>
> **Status (2026-06-18):** BUILT, both phases. Gate green: `tsc --noEmit` clean, `bun run build` clean (24.8s), humanized (zero em/en dashes), and lint-clean on every changed file (0 errors). Founder ruling 2026-06-18: the standing design-last rule does NOT apply to this initiative, so both phases shipped under its own authority (see section 8). On `worktree-agent-experience` (off the overnight tip); pending merge to main + live-verify on the next publish.
>
> **Why this exists.** The strategy canon described "19+ agents that drill down to 6," but how that resolves in the product was never clear, and the code carried three un-reconciled agent vocabularies (a 4+1 live seed, a 5-face display map written against different slugs, and 6 "stations" that exist only as copy). The result: several seeded agents (including the primary `discovery-scout`) leak raw-ish names because they map to no face. This plan resolves the model once, cleans the seam, populates every station, tightens every prompt, and gives agents a modern identity, while keeping the front calm.

---

## 1. The decision model (and the visibility answer)

Three numbers, three jobs, one rule:

- **19+ (growable) = the engine's specialist catalog.** A backend library of specialists. It can grow by domain and stakeholder (PM, growth, support, data, design). It is never a menu the user picks from. It is moat capacity, not UI.
- **6 stations = the map the user navigates.** Sense, Decide, Define, Build, Ship, Learn. Phases, not personnel. The stable, always-on spine.
- **5 faces = the cast shown in motion.** Named characters that appear as the work narrates itself. The user meets agents only when they act, grouped under the station they serve, and the work collapses to the artifact when done.

The governing law is the Engine-Room Doctrine ([`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md)): calm front, deep engine; name the outcome, not the mechanism; reveal on demand; one door.

```
        WHAT THE END USER SEES                       WHAT WE (PLATFORM) SEE
 +--------------------------------------+   +---------------------------------+
 |  THE LOOP, always-on spine (Product) |   |  ENGINE ROOM > Team (one door)  |
 |  Sense > Decide > Define > Build >   |   |  - every agent: CAST + CREW     |
 |         Ship > Learn                 |   |  - each agent's prompt          |
 |                                      |   |    (versioned, A/B, rollback)   |
 |  Inside a station, while work runs,  |   |  - trust dial (arc) per agent   |
 |  the CAST agents appear IN MOTION:   |   |  - runs, memory, eval score     |
 |   Scribe   drafting the PRD          |   |  - cost, latency, drift         |
 |   Sketch   mapping the flow          |   |                                 |
 |   Planner  breaking into tasks       |   |  our admin console + the        |
 |       (collapses to the artifact)    |   |  power-user "under the hood"    |
 +--------------------------------------+   +---------------------------------+
   names + outcomes only. No roster,         CREW agents (Reactor, Archivist)
   no prompts, no config on the front.        live ONLY here, never on the front.
```

**Visibility tiers (founder-confirmed 2026-06-18): Cast vs Crew.**
- **Cast** = can surface in the relay when it acts (the user sees it in motion, never as a managed roster).
- **Crew** = pure engine/infrastructure (event fan-out, memory consolidation). Never shown to the end user. We see and manage it only in the Engine Room.

The end-user/platform split is the direct answer to "are the new agents visible to the user, and where do we see them": cast agents are visible only in motion; crew agents are never visible to the user; both are fully managed by us in Engine Room > Team.

---

## 2. The refined roster (clubbed from 19, all six stations populated)

Internal DB slugs are never renamed (the rename-disclaimer rule). Naming and identity are a display layer over the slug. Names below are the proposed friendly-archetype set (section 4) and are easy to change.

| Station | Agent (face) | slug | Tier | One-liner (outcome-framed) |
| --- | --- | --- | --- | --- |
| **Sense** | Scout | `discovery-scout` | cast | Watches your connected sources and surfaces what changed. |
| Sense | Researcher | `researcher` (re-enable) | cast | Digs into a question across the web and your workspace. |
| Sense | Voice | `voice` (NEW) | cast | Clusters what customers are saying into themes. |
| **Decide** | Strategist | `strategist` | cast | Ranks and re-scores the bets by impact. |
| Decide | Critic | `critic` (NEW agent row) | cast | Red-teams the call before you commit. |
| **Define** | Scribe | `prd-writer` | cast | Turns the decision into a clear spec. |
| Define | Sketch | `ux-architect` (re-enable) | cast | Maps the experience and the flows. |
| Define | Planner | `sprint-planner` (re-enable) | cast | Breaks the spec into sprint-ready work. |
| **Build** | Maker | `builder` (display "Studio" today) | cast | Writes the change in your codebase. |
| Build | Reviewer | `reviewer` (NEW; or re-enable `qa`) | cast | Checks the diff before it ships. |
| **Ship** | Herald | `herald` (NEW) | cast | Announces what shipped: notes, changelog, post. |
| **Learn** | Echo | `echo` (NEW) | cast | Reads the outcome against the bet and feeds memory. |
| (conductor) | Chief of Staff | `orchestrator` | cast (special) | Runs the loop and brings you only what needs you. |
| - | Reactor | `reactor` | **crew** | Engine event fan-out (hidden). |
| - | Archivist | `archivist` (NEW) | **crew** | Memory consolidation (hidden). |

Clubbed / deprecated (map-only: render a face on historical runs, never seeded): `operations` -> Chief of Staff; `growth-strategist` / `data-analyst` -> Strategist; `customer-insights` / `competitor-watcher` -> Scout; `engineer` -> Maker; `copilot` -> Chief of Staff; `stakeholder` / `release` -> Herald.

The catalog is the one growable axis: adding a specialist later is one entry (slug, face, station, tier, hue, glyph), and it auto-folds into a face and station with no other code change.

---

## 3. What the code carries today (the seam this fixes)

Verified in the codebase (so an implementer does not work from a stale premise):

- The live seed is `discovery-scout`, `strategist`, `prd-writer`, `builder` (+ `orchestrator` seeded separately), NOT the historical 17. A roster cut (`supabase/migrations/20260606185608_*`, "F-AGENTS-ROSTER-CUT") disabled the rest for every user.
- `handle_new_user` no longer calls `seed_default_agents` (`20260617140000`), a latent gap where a brand-new user can get zero specialists until a backfill migration re-runs. This plan re-adds the seed call resiliently.
- `src/lib/agent-vocabulary.ts` `SLUG_TO_FACE` is written against aspirational slugs (`discovery`, `scout`, `planner`, `marketer`), so the actually-seeded `discovery-scout` and `growth-strategist` map to no face and leak raw-ish names. This is the visible "agents that still sit" symptom.
- The 6 stations exist in code only as stray copy strings, never as structure.
- A second display path, `src/lib/memory-view.ts` `agentLabel()`, title-cases slugs independently of the faces and must be reconciled.

The fix: a single three-tier catalog in `agent-vocabulary.ts` (stations, faces, specialists) from which the slug maps are derived, made total so no canonical slug ever leaks. The catalog is the SINGLE source for station/face/tier/hue/glyph (imported on both client and server), so NO database columns are added: the `agents` table keeps slug/name/role/system_prompt/color/enabled and everything else derives from the catalog by slug. Two safe migrations carry the rest: the canonical seed (new names, roles, prompts) plus the `handle_new_user` seed fix, then an idempotent backfill that re-seeds every existing user and re-asserts the roster cut. No slug rename, no row delete, no schema change, so history and in-flight missions are untouched.

---

## 4. Naming and visual identity

**Names: friendly archetypes** (the modern, relatable, non-technical direction). Research finding: human first-names now read as "AI slop" and over-promise; cold mechanism names ("Discovery") violate the outcome-naming law; short warm role-archetypes test best for a premium B2B tool. The "Discovery" fix is "Scout" (note: collides with a Microsoft agent, so "Lookout" or "Radar" are collision-safe alternates, founder call). Each agent carries a one-line, outcome-framed description (section 2).

**Visual identity: per-agent hue + unique glyph, from a purpose-built agent palette** (founder ruling 2026-06-18). The hue is drawn from a categorical palette carved deliberately out of the violet -> magenta -> plum -> indigo -> orchid range, explicitly EXCLUDING the reserved semantic colors (ember = needs-you, green = done, blue = running, red/madder = failed), so an agent's color can never be mistaken for a status. Chief of Staff anchors on the canonical orchid. Each agent also carries a unique geometric glyph (rounded-square mark), so identity survives in monochrome and for color-blind users: color is never the only signal. No lettered avatar tiles (too person-y for the premium north-stars). This is a deliberate extension of the color law and is documented in [`../conventions/design-context.md`](../conventions/design-context.md).

**Called-out treatment** (one reusable component, used everywhere an agent acts): `<mark> <Name> . <present-tense verb> [. outcome]`, e.g. "Scribe . drafting the PRD". Identity is always disclosed (never mistaken for a person), the human stays accountable, and the reasoning is one click away (Linear's Agent Interaction Guidelines as the reference).

---

## 5. The relay: showing agents working (in parallel) under a station

The founder's requirement: the six stations are the stable top layer, and UNDER each station several agents operate, visibly, because multi-agent is the value. The research-validated way to show that calmly (so 3 to 4 parallel agents read as calm rows, not noise):

- Under a working station, the active cast agents render as **rows in one list** (station = parent, agents = sub-tasks). This is the task-list-with-sub-tasks layout that reads best for parallel work with dependencies (LukeW).
- Each agent row shows **only its single latest line** (thought or action), **self-replacing / ephemeral** (Linear's `AgentSession` activity model). Four agents in parallel = four quiet rows, not four scrolling logs.
- The handoff reads as a sentence built from each face's verb: "Strategist ranked 12 -> Critic is challenging the top 3 -> over to you." The terminal "over to you" segment is the needs-you color and links to the gate.
- **On completion, the stream collapses to a one-line summary + the artifact link**, so the user ends looking at the PRD / roadmap / release, not at agent logs.
- The raw tool-calls, thoughts, and payloads stay in a "Full execution trace" disclosure (the existing per-hop trace), collapsed by default: reveal on demand.

This relay reuses the shipped data and components: `getSwarmHud` / `getMission` for data; `HandoffFeed` and the per-hop `TraceHop` (with its inbound/outbound handoff chips) as the raw material to promote into one calm `<AgentRelay>` component (variants: `full` on mission/build detail, `mini` as one live line on Today). It is seeded across ALL six stations, not just Build (the founder's point): the orchestrator already plans a DAG of specialist steps by task type, and a station-grouped planner prompt makes parallel specialists in one station explicit.

**Anti-patterns to avoid** (from the competitive scan): the live orchestration graph / node-canvas as the primary surface (the engineer's control room, e.g. LangGraph Studio's auto-edge hairball); the data-dump of every log line (notification blindness); a roster of running bots with internals exposed at once plus per-step approval modals (Cursor 2.0's "absurd" multi-agent chrome). The calm default with depth one click away is the resolution; the show-vs-hide tension is genuinely unresolved in the field, so calm-by-default and user-controllable depth is the safe stance.

---

## 6. Prompts: tight, proofread, provably valuable

Every cast agent's system prompt is rewritten to a fixed industry skeleton, then verified, not asserted:

**Skeleton:** Role; Objective (the one job); Inputs it can rely on; Step instructions; Output contract (structured, what the next station consumes); Guardrails (what it must NOT do); Handoff contract (what it emits); Voice (the humanized-output convention, zero AI fingerprints).

**Quality pipeline:** (1) draft to the skeleton; (2) an adversarial proofread / red-team pass against "does this reliably deliver its one outcome, with evidence, in the contract the next agent needs"; (3) land in Engine Room > Prompts (the existing versioning, A/B, rollback), gated by Quality checks (evals). This is also where we, the platform, see and manage prompts. The end user never sees them.

---

## 7. Engine Room is the platform control surface

Nothing is deleted, only relocated to the one door. Engine Room > Team holds: the full roster grouped by station (cast and crew); the per-agent trust dial (observing -> proving -> trusted -> ambient); the agent inspector (runs + memory); per-agent throughput, cost, latency, and drift. The current standing roster grid on the calm front (the missions Agents tab) is retired; its still-useful pieces relocate here or to their single homes (approvals -> Today + Engine Room > Approvals).

This is the answer to "where should we (platform) see these things": one door, on demand, named for the outcome ("Team"), never on the calm front.

---

## 8. Phasing (build order, not a gate)

There is a standing founder ruling (SSOT section 1, 2026-06-18) that the design / UX-polish pass is LAST, done ONCE, and founder-triggered. **The founder explicitly waived that rule for this initiative (2026-06-18): Claude Code has full authority to plan and execute the agent-experience UX now.** So the two phases below are a sensible build ORDER (foundation before the surfaces that consume it), not a gate, and both build in this initiative:

**Phase 1, agent foundation (buildable now, no founder taste needed):**
1. The three-tier catalog in `agent-vocabulary.ts` (stations, faces, specialists; total resolvers; fixes the leak). Reconcile `memory-view.ts`.
2. The naming + identity tokens (the agent palette + glyphs as data; the called-out component spec).
3. Migration A (canonical seed incl. the new `critic` agent + the `handle_new_user` seed fix; no schema change) and Migration B (idempotent backfill: re-seed every user + re-assert the cut). Smoke-test signup.
4. The prompt rewrite + the adversarial proofread pass + at least one eval per cast agent.
5. Orchestrator station-aware planning (group the roster by station in the planner prompt; persist `mission_steps.station`).

**Phase 2, agent experience UX (greenlit now; builds after Phase 1's foundation lands):**
6. The `<AgentRelay>` component (full + mini) with the ephemeral-line, collapse-to-artifact behavior.
7. The 6-station loop spine on Product.
8. The Today mini relay (replacing the standing agent rail).
9. Engine Room > Team (relocate roster, trust dial, inspector, throughput).
10. Retire the missions Agents tab + the roster grid; repoint the `/agents` redirect to `/govern?tab=team`.
11. Apply the identity system (hues + glyphs) across the surfaces; Engine-Room stamp every touched surface.

Both phases are greenlit (founder, 2026-06-18). Phase 1 lands first because Phase 2's surfaces consume the catalog model, the identity tokens, and the station-aware planning it produces.

---

## 9. Safe-cycle and collision notes

- Built in `worktree-agent-experience`, branched off the overnight-build tip, so it carries the latest agent work and never works on a stale base.
- Forward-integration only: the overnight branch's latest is merged INTO this branch periodically; this branch is never pushed onto the overnight branch. The final merge is then trivial.
- File partition: this initiative owns `agent-vocabulary.ts`, the relevant routes, `govern`, `AgentsPanel`, `orchestrator`, the new migrations, and these docs. The two shared code files (`registry.server.ts`, `missions.functions.ts`) and the high-churn SSOT files are edited minimally / append-only to keep merges clean.
- No slug renames, no row deletes: in-flight missions and run history are safe by construction.

---

## 10. Related

- Substrate this builds on: [`agent-ecosystem-plan.md`](./agent-ecosystem-plan.md) (F-AGENT-1..4), [`f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md), [`f-agent-4-swarm-hud.md`](./f-agent-4-swarm-hud.md), [`a2a-handoff.md`](./a2a-handoff.md), [`trust-and-autonomy.md`](./trust-and-autonomy.md), [`critic-agent.md`](./critic-agent.md), [`agents-mentionable.md`](./agents-mentionable.md).
- Governing conventions: [`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md), [`../conventions/design-context.md`](../conventions/design-context.md), [`../conventions/home-and-today-ia.md`](../conventions/home-and-today-ia.md), [`../conventions/humanized-output.md`](../conventions/humanized-output.md).
- Strategy: [`../strategy/v8-calm-front-deep-engine-2026-06-16.md`](../strategy/v8-calm-front-deep-engine-2026-06-16.md) (structure canon this operationalizes), [`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md) (the original 6-station / 19-mesh map), [`../strategy/session-decisions.md`](../strategy/session-decisions.md) (the decision entry).
- Status: [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md), [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md), [`../../plan.md`](../../plan.md) section 4.
