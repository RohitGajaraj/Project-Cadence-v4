# Cadence — Strategic Task Tracker

> **▶ Looking for the concrete next task to build?** This file is the **strategic** P0–P3 view. The canonical, addressable task queue is the **[Build-order rollup in `docs/feature-backlog.md`](./docs/feature-backlog.md#build-order-rollup-status--build-sequence)** — resolve "what's next" there (lowest-numbered `◑`/`☐` step → its feature IDs → its ticket in [`docs/foundation-audit.md`](./docs/foundation-audit.md)). The deterministic rule lives in [`AGENTS.md`](./AGENTS.md) §1. Do **not** treat the buckets below as the task queue.
>
> Living checklist. Feature scope + build order: [`plan.md`](./plan.md). Granular, build-ready scope: [`docs/feature-backlog.md`](./docs/feature-backlog.md). Operating rules: [`AGENTS.md`](./AGENTS.md). **No MVP1/2/3 gating** — we build the full scope on the current stack and ship continuously, straight into Claude Code / Lovable.

---

## P0 — Decisions to lock (cheap, unblock the build)

- [ ] **Name** — pick from [`docs/decisions/naming.md`](./docs/decisions/naming.md), then find-replace "Cadence".
- [ ] **Master tagline** — confirm current tagline from README.md (positioning v2: "your product org, running itself").
- [ ] **Stack** — confirm keep-and-build-full-scope-on-this-stack per [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md) (already your stated preference).
- [ ] **License** — placeholder is "all rights reserved"; permissive/open-core decision deferred (see tech-stack doc).
- [ ] **Pricing + GTM lane** — per-seat / per-team / usage / hybrid; SaaS vs open-core vs vertical. Not blocking the build.

## P0 — First end-to-end slice (the lead use case)

Make one full vertical slice bulletproof before widening — proves the loop + governance.

- [ ] **Foundation hardening** — auth + tenancy (`user_id`+`workspace_id`+`product_id`), chokepoint, trust-stack tables, design tokens. Reuse legacy ([`plan.md`](./plan.md) section 5).
- [ ] **Discover → Define → Plan** slice: signals → themes → ICE opportunities → cited spec → task graph. All states verified; real seed data.
- [ ] Run `/gstack-qa` (and other relevant QA skills) on the slice; fix breakers.

## P1 — The autonomous core (the differentiator — do not defer)

- [ ] **Orchestration layer** — parallel sub-agents + parallel sessions + live mission graph ([`architecture/orchestration.md`](./architecture/orchestration.md)).
- [ ] **Build → Test → Ship (autonomous)** — Studio coding agents, agent-generated tests + QA gate, PR/deploy/release behind approval, "watch the agents build" surface.
- [ ] **Multi-product / multi-workspace** — Product A/B/C under Workspaces A/B/C, isolated.
- [ ] **Agent communication + transfer/handoff** — sub-agent spawning, A2A messaging, mission handoff across stages ([`plan.md`](./plan.md) section 2E).

## P2 — Close the loop + open the platform

- [ ] **Launch/GTM/Price + Operate/Support** — agent-drafted go-to-market and support, approval-gated.
- [ ] **Learn + Product Memory** — decisions→outcomes graph, re-scoring, skill packs.
- [ ] **Interop** — MCP server/client + A2A so other agents plug in.

## P3 — Cross-cutting hardening (from the considerations review)

- [ ] Work through the gaps in [`docs/considerations.md`](./docs/considerations.md) — observability/SRE, privacy/compliance, billing/metering, abuse/safety, DR/backup, CI/CD, etc. Pull each into the build as it becomes relevant; don't let them surprise an enterprise sale.

## P3 — Design + skills

- [ ] Design system: use `/gstack-design-review` and the design skills in [`design.md`](./design.md); pilot Mission Control against the pillars.
- [ ] Keep [`plan.md`](./plan.md) section 4 (active build log) updated as we ship; supersede legacy entries (section 5) as they're rebuilt.

---

## Completed

- [x] **2026-05-29 — Documentation overhaul + strategic reframe.** Agent-first, fully-autonomous, full-lifecycle (build/ship/test/launch) positioning; MOAT rewritten (end-to-end governed loop, not data/model); `plan.md` rebuilt as full feature scope + granular catalog + build order + active/legacy logs; architecture deepened (orchestration, security/auth); `AGENTS.md` canonical with `CLAUDE.md`/`GEMINI.md` pointers; `tools.md`/`hooks.md` added; competitor study moved to deferred reference; duplicated headers removed; "wedge" terminology dropped.
- [x] Legacy build (the earlier source): discovery, specs, planning, Studio, integrations, trust stack — retained as reuse reference in [`plan.md`](./plan.md) section 5.

## Notes

- Positioning: independent AI-native product company; **fully autonomous super-agents**, governed; agent-first; no "40/60 split," no "wedge," no MVP-phase gating language.
- The earlier positioning history is archived in [`docs/strategy/archive/v1-positioning-2026-05-26.md`](./docs/strategy/archive/v1-positioning-2026-05-26.md) (frozen).
