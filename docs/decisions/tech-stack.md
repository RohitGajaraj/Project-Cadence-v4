# Decision: Tech stack — keep, change, and the open-source question

> _Created: 2026-06-03 · Last updated: 2026-06-11_

> Status: **DECISION BRIEF (for the founder to confirm).** Date: 2026-05-29. Owner: founder. Rules: [`../../AGENTS.md`](../../AGENTS.md), section 9 (open-source discipline). Stack as implemented: [`../../plan.md`](../../plan.md).

This brief answers four questions you asked directly:

1. Is there an alternative to the current stack? What is the recommendation?
2. If we keep the current stack, is there any impact — given you also build in Lovable?
3. If we change the stack, does that affect Lovable?
4. Open source: can it be built fully open-source? Cross-impacts, pros and cons?

---

## Recommendation (one line)

**Keep the current stack and build the full intended scope on it — now, production-grade. Do not rewrite.** The stack is the Lovable-native stack, so it co-develops seamlessly across Lovable and Claude Code. The only thing ever worth changing is the _agent-runtime tier_, and only if a hard technical limit forces it (below) — never the whole app, and not on a milestone schedule. (Founder direction 2026-05-29: keep this stack; the earlier "rewrite to production-grade elsewhere" idea is retired.)

---

## 1. The current stack, and is there an alternative?

**Current:** TanStack Start (React 19 + Vite) on Cloudflare Workers · Supabase Postgres (RLS + pgvector + pg_cron) · TypeScript end-to-end · shadcn/ui + Framer Motion + Tiptap · Lovable AI Gateway (default) + BYO keys.

| Layer                                    | Keep?                                             | Why / alternative                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase (Postgres, RLS, pgvector, cron) | **Keep**                                          | Battle-tested, multi-tenant from day one, open-source core, self-hostable. No reason to move.                                                                                                                                                                                                                               |
| TypeScript end-to-end                    | **Keep**                                          | Type-safety across the chokepoint pays compounding dividends for a solo+agents team.                                                                                                                                                                                                                                        |
| shadcn/ui + Framer Motion + Tiptap       | **Keep**                                          | Permissive licenses (MIT), strong craft baseline.                                                                                                                                                                                                                                                                           |
| TanStack Start on Cloudflare Workers     | **Keep for app; design the agent tier carefully** | Great for the app surface. **Risk:** Workers has execution-time limits; long-running, stateful, parallel agent missions may not fit. Address this in the orchestration design now (durable queue/worker tier) — see [`../../architecture/orchestration.md`](../../architecture/orchestration.md) — not as a future rewrite. |
| Lovable AI Gateway                       | **Keep as default, keep BYO as the escape hatch** | Convenient and zero-key, but it is the main lock-in (see below). Model-agnostic adapters already make this swappable.                                                                                                                                                                                                       |

**The one architectural question to design for now** is the **agent-runtime tier** for long-running, parallel, stateful missions ([`../../architecture/orchestration.md`](../../architecture/orchestration.md)). Build it into the design from the start (it is part of the foundation, not a later phase). Options:

- Add a complementary worker tier for long-running steps (a durable-execution service) alongside Workers — least disruptive, recommended.
- Move stateful agent workloads to Node/Bun on a long-running host (Fly.io / Railway) if Workers limits bite.
- A Go/Elixir gateway is defensible only for very high-concurrency A2A much later — not now.

**Change the agent-runtime tier only on a hard technical limit** (e.g. a mission must run longer than the Workers limit and cannot be decomposed into resumable steps). Not on a customer or milestone trigger — we build the full scope on this stack regardless.

---

## 2. If we keep the stack — impact, given you build in Lovable

Keeping the stack is the **lowest-friction path for Lovable co-development**, because the current stack _is_ the Lovable-native stack (Supabase + TanStack + Workers + the Lovable gateway, env auto-provisioned). Impact of keeping:

- **Positive:** Lovable and Claude Code both operate on the same files with no translation — the seamless cross-tool co-development you require. Take any part to either tool; nothing is tool-specific.
- **Watch:** the Lovable AI Gateway and Lovable Cloud provisioning are the lock-in surface. Mitigations already in the design: BYO keys + model-agnostic adapters mean you can route around the gateway; Supabase is portable/self-hostable. **Action:** keep an exportable migration set and confirm you can run on a vanilla Supabase project without Lovable Cloud. That preserves your exit option without slowing you down now.

## 3. If we change the stack — does it affect Lovable?

**Yes — proportionally to how far you move from the Lovable-native stack.**

- Swapping _within_ the family (e.g. self-hosted Supabase, BYO gateway instead of Lovable's) — **low impact**; Lovable can still co-develop, you just lose some auto-provisioning convenience.
- Replacing the framework (e.g. TanStack → Next.js) or moving agents to Go/Elixir — **high impact**; Lovable's leverage drops and you would lean more on Claude Code / Antigravity / Gemini for those parts. That is acceptable _later_, for the agent-runtime tier only, not for the whole app.
- **Net:** any change you make should preserve the app surface on the Lovable-native stack and isolate non-Lovable pieces (a separate agent-runtime service) behind a clean API so Lovable keeps working on the parts it is good at.

---

## 4. Open source — can it be fully OSS? Cross-impacts, pros/cons

**Can it be built fully open-source? Yes — the dependency stack is already overwhelmingly permissive (MIT/Apache/BSD): React, Vite, TanStack, Tailwind, shadcn/ui, Framer Motion, Tiptap, Postgres, pgvector, Supabase core.** Nothing in the core forces a copyleft or source-available obligation. The two things to watch are **vendor services** (the Lovable gateway and Lovable Cloud — these are conveniences, not open-source components) and **any future dependency** with a GPL/AGPL/BSL/SSPL license (flag before adding — see [`../../AGENTS.md`](../../AGENTS.md), section 9).

This is two separate decisions — do not conflate them:

**(a) Open-source _dependencies_ (license hygiene):** Already the default. Keep it. Cost: near zero. Just enforce the license check before adopting anything new.

**(b) Open-sourcing _your own product_ (a business-model choice):**

| Model                    | What it means                                                                                                                           | Pros                                                                                                                                               | Cons                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Closed / proprietary** | Source private; hosted SaaS only.                                                                                                       | Simplest; no copycat risk; full pricing control.                                                                                                   | No OSS distribution flywheel; less developer trust.                                                                                |
| **Open-core**            | OSS engine (chokepoint, agent loop, connectors) under MIT/Apache; paid hosted + enterprise tier (SSO, audit, governance, multi-tenant). | Developer adoption + trust; distribution; agents/MCP audience aligns with your "built for agents" thesis; you still monetize hosting + enterprise. | Must draw the open/paid line carefully; some self-host instead of pay; more maintenance overhead.                                  |
| **Source-available**     | Visible source, restrictive license (e.g. BSL) preventing competing hosting.                                                            | Transparency without enabling competitors.                                                                                                         | Not true OSS; some community friction; you'd be _consuming_ permissive deps while not granting the same — fine, but be deliberate. |

**Cross-impacts of going open-core:**

- **Moat:** open-sourcing the engine does **not** give away the moat. Per [`../../README.md`](../../README.md), the moat is owning + orchestrating the _end-to-end governed lifecycle loop_, the trust/governance layer, the switching cost of being system-of-record-and-action, and agent-native interop + hosting — **not the code, and not raw data**. Open code can even strengthen distribution while the moat stays in the orchestration, governance, and hosted tier.
- **Frontier-model risk:** open-core + MCP/A2A interop reinforces "Cadence orchestrates the models; it does not compete with them" — you become infrastructure others build on.
- **Build effort:** can I build it fully myself (with the agent swarm)? The _technical_ answer is yes on this stack. The real constraint is **scope discipline** — open-sourcing adds packaging, docs, license, and community-support work. That is the part to defer, not the product itself.

**Recommendation on OSS:** keep dependency licenses permissive now (free, do it). **Do not open-source the product pre-PMF** — it adds work and gives away nothing useful yet (founder-endorsed). Design the engine/app boundary cleanly now so open-core stays _possible_ later without committing to it.

---

## What to do now

1. Keep the stack. Build the **full intended scope** on it ([`../../plan.md`](../../plan.md)) — production-grade, no MVP gating, no rewrite.
2. Design the durable agent-runtime tier into the orchestration layer up front ([`../../architecture/orchestration.md`](../../architecture/orchestration.md)) so long/parallel missions are an addition, never a rewrite.
3. Confirm the app runs on a vanilla Supabase project (export migrations) so Lovable-Cloud lock-in stays optional; keep BYO keys + model-agnostic adapters as the gateway escape hatch.
4. Co-develop freely across Claude Code and Lovable — nothing is tool-specific.
5. Enforce the permissive-license check on any new dependency ([`../../AGENTS.md`](../../AGENTS.md) section 9).
6. Keep the open-core-vs-closed decision open; revisit only when there are real users.

---

## HyperAgent library reference (2026-06-03)

> Reference input from the user: HyperAgent (by Airtable) is built on an open-source stack under MIT/Apache/ISC licenses.

**Their stack (relevant for comparison):** React, Next.js, Radix UI Primitives, Zustand, Zod, Recharts, Mermaid, Motion, react-markdown, react-syntax-highlighter, remark-gfm, react-zoom-pan-pinch, cmdk, sonner, next-themes, date-fns, nanoid, clsx, tailwind-merge, @dnd-kit/core, @tanstack/react-virtual, @sentry/nextjs, fuse.js, class-variance-authority, lucide-react.

**Decision for Cadence:**

1. **No stack change needed.** Our stack (TanStack Start + Vite + shadcn/ui + Framer Motion + Supabase + Cloudflare Workers) is production-grade and already chosen deliberately — see this file above. HyperAgent's choices confirm we are using the right primitives (Radix, cmdk, lucide, dnd-kit, Zod, Recharts all overlap).

2. **Key differences that are intentional:** We use TanStack Start (SSR, full-stack) vs Next.js; Framer Motion vs Motion (more expressive for our animation contract); Supabase vs their unspecified backend; Cloudflare Workers vs their deployment target. These are deliberate choices that should not change.

3. **Coexistence with Lovable:** This reference has no impact on the Lovable workflow. Lovable operates on the same frontend stack (React + shadcn/ui + Tailwind + Framer Motion). No conflict.

4. **What to watch:** Their open-source posture. If they open-source agent orchestration logic, that becomes a reference implementation worth studying — not copying, but learning from. Monitor their GitHub repo when evaluating architecture choices for Epic E (agent communication) and Q (interop).

5. **Potential additions from their stack:** `@tanstack/react-virtual` (virtual scrolling — useful for long signal feeds and trace waterfalls) and `fuse.js` (fuzzy search — could supplement the cmdk palette). Both are MIT-licensed and safe to adopt if there is a concrete need.

**No immediate action required.** This is a reference data point for future architecture reviews, not a trigger for any current build change.
