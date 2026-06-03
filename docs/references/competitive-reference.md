# Competitive reference (deferred — for inspiration, not a scorecard)

> Status: **DEFERRED / REFERENCE ONLY.** Moved out of [`../../plan.md`](../../plan.md) at the founder's request — plan.md absorbs the *inspiration* into Cadence's own features; this file keeps the raw study for later reading. Not a maintained competitive analysis. Date: 2026-05-29.

## Why this exists
We studied a few products to learn what good looks like and where the open ground is. The takeaways are baked into the feature catalog in [`../../plan.md`](../../plan.md) (section 2). This page just retains the underlying notes.

## The pattern
Each reference product owns one band of the lifecycle. **Nobody owns the whole loop (discover → define → plan → build → test → ship → launch → support → learn) as one governed autonomous system.** That whitespace is Cadence's position and moat ([`../../README.md`](../../README.md)).

## Reference notes

| Capability | factory.ai | hyperagent | Linear | Cadence's take |
|---|---|---|---|---|
| Core | Autonomous SWE "Droids" run the SDLC; multi-day "Missions" | Build a team of agents (own tools/memory/budget); watch them live | Product system of record (issues/projects/roadmaps); agents as first-class users | The full lifecycle as one governed autonomous loop |
| Autonomy | High — merge-ready PRs, incident response | High — multi-step workflows, self-improving skills | Emerging — assignable/@mentionable agents, coding agent on roadmap | Fully autonomous super-agents across all stages, gated |
| Parallelism | Parallel droids/missions | Team of agents in parallel | — | Many sub-agents + many sessions in parallel, live view |
| Multi-project | Per-repo missions | Per-workflow | Multiple teams/projects | Products A/B/C under workspaces, isolated |
| Enterprise | GitHub/Linear/Notion/Slack/Sentry; self-host, SSO, SOC2 | Slack-triggerable; business automation | Skills + event automations (Business/Enterprise) | Connectors + MCP/A2A + governance + audit |
| Self-improvement | — | Sessions generate skills/memories | — | Product Memory: decisions→outcomes graph + skill packs |
| Target customer | Enterprise eng teams | Business/ops teams | Product + eng teams | The native product team of one |
| Live "watch it work" | Mission view | Real-time terminal | In-app diffs | "Watch the agents build/ship" across the whole loop |

## What we took (now in plan.md features)
- **From factory.ai:** autonomous build/ship + a live mission view — extended *past code* into launch and support.
- **From hyperagent:** a team of agents with per-agent budgets + self-improving memory.
- **From Linear:** agents as first-class, assignable, @mentionable; saved-workflow skills; event-triggered automations.
- **Our win:** the band none own — the governed end-to-end loop with multi-product orchestration.

## Other autonomous-agent platforms (context)
Devin/Cognition (autonomous SWE in a cloud env, parallel runs); Replit Agent (plan/write/test/deploy apps, can build other agents); OpenAI Codex (terminal-native agentic coding); Cursor (AI-native IDE, interactive); Gemini CLI (free frontier, 1M context). All own *engineering*; none own the full product lifecycle.

Sources: factory.ai, hyperagent (Airtable), linear.app changelog/agent, plus general 2025-2026 agent-platform coverage. Treat as directional, not freshly re-verified.
