# Agent blast-radius limits (FND-0.5)

> Per-agent tool allow-list + scope so an agent cannot reach beyond its remit. Governance / AI-safety, Tier 3. Register row R4-adjacent `FND-0.5`. Status: ✅ **LIVE-VERIFIED on the published app 2026-06-22** (Lane 1). The full feature is built and its surfaces proven live: (1) the per-agent **"Tool reach"** selector (Unrestricted / Low / Medium / High reach) renders on EVERY agent in Settings → Staff (Studio, Copilot, Researcher, Strategist, Engineer, QA Reviewer, Orchestrator, Critic, …) — Playwright; (2) the migration is **applied** in production — `agents.max_tool_risk` (text) exists on the live DB (queried directly); (3) the runtime **enforcement is wired at the chokepoint** — `loop.server.ts` calls `capToolsByRisk(...)` at BOTH tool-resolution sites (fresh dispatch :259 and resume :926), reading the agent's `max_tool_risk` so over-cap tools are dropped from the tool list, `modeOf`, and the system prompt before the agent can call or even see them; (4) the pure model + `filterToolsByRisk`/`capToolsByRisk` + the global high-blast min-confirm floor are unit-tested (736 tests). The one remaining item is a gold-standard behavioral A/B (cap an agent low, run it, watch a high-blast tool disappear) — an optional live confirmation, not a build gap; the filter is provably wired in both loop paths.

## Why

An autonomous agent that can call any enabled tool has an unbounded blast radius: a single mis-step can merge a PR, write to a tracker, or change a calendar. FND-0.5 makes the blast radius of each tool an explicit, static property and gives the platform a pure building block to cap what any one agent may do.

## The model: blast radius = reversibility x scope

Blast radius is two STATIC axes (safe to state plainly — never model output, so the claim never outruns the wiring):

1. **Reversibility** (already catalogued in `src/lib/tool-consequences.ts`): `reversible` / `partial` / `irreversible`.
2. **Scope**: does the effect reach a system OUTSIDE the Cadence workspace (a repo, a tracker, a calendar)? An external write is wider blast than an internal workspace write even when reversible — so the two axes are genuinely independent (opening a PR is *reversible* yet *external*).

`toolRisk(name)` folds them into one tier:

| | internal | external |
| --- | --- | --- |
| reversible | **low** | **medium** |
| partial | **medium** | **high** |
| irreversible | **high** | **high** |

An uncatalogued tool is **medium** (unknown blast radius → prompt review, never silently low or loud high).

## What shipped (as built)

All in `src/lib/tool-consequences.ts` (pure, client-safe; 19 unit tests in `tool-consequences.test.ts`):

- `toolRisk(name) -> "low" | "medium" | "high"` and `isHighRiskTool(name)`.
- `isExternalTool(name)` over an `EXTERNAL_TOOLS` set (the github/studio/calendar/tracker writers).
- `RISK_RANK` (low<medium<high) + `RISK_LABEL` ("Low/Medium/High blast radius").
- `filterToolsByRisk(tools, maxRisk) -> { allowed, blocked }` — the **allow-list pre-filter**: the pure building block for per-agent scoping. A high-blast agent keeps every tool; a `maxRisk: "low"` agent is held to reversible internal writes. De-dups while preserving order so a caller can hand it the raw enabled-tool list; blocked tools carry their tier so a caller can explain the cap.

**Driven surface:** the human approval card (`src/components/today/DecisionCard.tsx`) now shows a "High blast radius" chip (ShieldAlert, `--rose`) on a gate whose tool is high-risk, beside the existing reversibility chip — distinct information (reaches-outside / high-stakes vs can't-undo), surfaced only for the loudest tier to keep the front calm.

## Enforcement: the systematic min-confirm floor (shipped)

The agent loop's existing high-risk approval floor (`src/lib/ai/loop.server.ts`) now uses the systematic classifier: a tool is held to at least human `confirm` when `HIGH_RISK_MIN_CONFIRM.has(tool) OR isHighRiskTool(tool)`. This connects the blast-radius model to the live gate, so **every** high-blast tool — and any future side-effecting tool — can never run unattended (`auto`), with no hand-maintained list to drift. It closed a real gap: `github.commit.append` (external + partial → high) was missing from the manual set and could previously auto-run. Safe-by-construction — the branch only raises `auto`→`confirm`, never lowers a gate. This is a GLOBAL floor (applies to every agent); live agent-run verification is deferred until API keys/gateway credits are available.

## Per-agent cap (shipped)

A per-agent `max_tool_risk` ceiling (`agents.max_tool_risk`, nullable = unrestricted) — stricter than the global floor: a scoped agent's over-cap tools are dropped from its tool list, `modeOf`, and system prompt entirely (it cannot call or even see them), at both loop tool-resolution sites (fresh dispatch + resume). Set per agent in Settings → Staff ("Tool reach": Unrestricted / Low / Medium / High) via the RLS-scoped `setAgentToolCap`. The filter is the pure tested `capToolsByRisk` (`src/lib/agent-tool-cap.ts`), guarded so a null cap is byte-identical to today. Uncatalogued tools fail **closed** (treated as `high`), so an un-vetted tool can never slip a low/medium cap. Migration applies + live filtering verifies on the founder's next publish (deferred per the build-now/test-later ruling).

## What remains (not autonomous)

- **Live verification** of the migration + the loop filter + the approval-card chip (needs the founder's publish + API keys).
- **Catalogue completeness**: keep every `TOOL_REGISTRY` tool entered in `CONSEQUENCES` so the fail-closed `high` default never over-gates a genuinely low-risk new tool.
