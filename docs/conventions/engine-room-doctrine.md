# Convention: The Engine-Room Doctrine

**Status: standing rule, founder ruling 2026-06-16. This is the product's first UX law. It outranks any single surface, feature, or metric. Where a design, a spec, or an architecture decision would expose the machinery to the user, this rule wins.**

> Shorthand: **calm front, deep engine.** The user meets the OUTPUT of the machine, never the machine.

## The law

Complexity lives in the engine, never in the experience. Everything powerful happens in the backend; the front stays calm, simple, and legible to a smart non-technical person. The operator tools that prove the machine is honest (logs, traces, evals, prompts, budgets, raw data, agent internals) still exist and stay one click away, but they live behind one clearly marked door the user opens only when they choose to. The default surface never makes the user reason about how the machine works.

This is the rule the constitution already states ("Complexity exists in the engine, not in the user experience", `Ai_Cofounder.md`) and v6 already states ("simple front, powerful engine; approve-by-exception; hide the engine room"). It is written here as an enforceable convention because it was being written and then quietly broken: capability after capability earned its own top-level surface and its own piece of jargon until the product started to feel like a technical control room. This doctrine exists so the system itself resists that drift, instead of relying on anyone to remember.

## The reference model

Lovable. A non-technical person ships real software without ever seeing the database, the deploy pipeline, or the agent loop. The tools are there the moment they go looking (logs, a SQL editor), but the default surface is calm and the machinery is invisible. The user brings their own sources, connects them with one button, and everything else comes from the platform. Cadence holds itself to that bar.

## The failure mode it prevents (name it so you catch it)

**Control-room creep.** Every new capability wants a top-level home and a precise technical name. Left unchecked, the surface fills with traces, drift, evals, prompts, budgets, handoff contracts, tool calls, agent memory, and token spend, and the product reads as a dashboard for engineers instead of a calm tool for its actual user. The moment a new surface or label describes HOW the machine works rather than WHAT the user gets, control-room creep has started.

## The Engine-Room Test (apply to every surface, panel, label, field)

Ask: **"Would a smart non-technical person feel this is for them, or does it expose how the machine works?"**

- If it exposes the machine, it goes behind the Engine Room door, or it gets renamed to the outcome it produces.
- If a daily user genuinely acts on it, it can sit on the front, named for the outcome, kept tight.

## The four operating rules

1. **The default surface is calm.** Only the surfaces a user acts on routinely earn a top-level home (decide, build and ship, ask, the few things they own). All observability, governance, and internal machinery lives behind a single Engine Room door, recessed not removed.
2. **Name the outcome, not the mechanism.** "Quality checks", not "evals". "What we have learned", not "decision lineage". "Changes", not "diff" or "drift". The user-facing label says what the user gets; the mechanism name stays in the engine. A whole *surface* obeys this too: an "Agent Manager" view of cost, API calls, and efficiency is a mechanism name and the textbook control-room-creep failure; the manager meets outcomes instead (what needs me, what shipped, what it cost for what I got), and the raw per-agent telemetry lives behind the one door (decided 2026-06-17, see [`../strategy/session-decisions.md`](../strategy/session-decisions.md)).
3. **Reveal on demand, never by default.** Power tools (traces, prompts, budgets, raw logs, agent internals) are one click away for the operator who wants them and hidden for the majority who do not. Depth is opt-in; progressive disclosure is the default interaction.
4. **Bring your own, and it comes from one place.** The user connects their own sources (repo, data, connectors) with a single Connect button and never touches keys, databases, or wiring. The platform operates the backend. This is why the connector rule is OAuth-only, no key paste.

## The symbol (how it travels through the work)

Every spec, design note, and PR that introduces or changes a user-facing surface carries one **Engine-Room line**:

```
Engine-Room: <what machinery this exposes> -> <where it hides> -> <the outcome-name the user sees>
```

Example: `Engine-Room: eval pass/fail scores -> behind Engine Room > Quality -> surfaced to the user as a single "Looks good / Needs a look" badge`.

A surface that cannot fill this line in honestly is not ready to ship. The tag is greppable: search `Engine-Room:` to audit every place the doctrine was applied.

## How we achieve it going forward (the architecture lattice)

This is not only a UI rule; it constrains solutioning and architecture so the simple front is structurally cheap to keep:

- **One door, not many.** There is exactly one Engine Room surface. New observability or governance capability lands as a tab inside it, never as a new top-level route. This extends the surface-placement rubric in [`home-and-today-ia.md`](./home-and-today-ia.md) with an explicit engine-room-vs-front axis.
- **Outcome objects, not machine objects, reach the front.** Server functions that feed user surfaces return outcome-shaped data (a verdict, a result, a recommendation), not raw machine telemetry. Telemetry stays addressable for the Engine Room but is never the default payload to a front surface.
- **Progressive disclosure is a component contract, not a per-screen decision.** The pattern (calm summary, one affordance to open depth) is built once and reused, so "reveal on demand" is the path of least resistance for the next builder.
- **The autonomy on-ramp is part of the calm.** The `observing -> proving -> trusted` arc loosens gating over time so the product feels progressively ambient, without ever exposing the gate machinery as the headline.

## How to apply

On any new surface, panel, metric, label, field, or architecture decision: run the Engine-Room Test first, then write the Engine-Room line. If it exposes the machine, hide it behind the one door or rename it to its outcome. When in doubt, the front stays calmer and the engine holds the complexity.

## Related

- [`design-context.md`](./design-context.md) - the design brief that loads by default on any design work; this doctrine is its first law.
- [`home-and-today-ia.md`](./home-and-today-ia.md) - the surface-placement rubric this extends (the engine-room-vs-front axis).
- [`ui-voice.md`](./ui-voice.md) and [`humanized-output.md`](./humanized-output.md) - outcome-naming and calm copy are how rule 2 is executed in strings.
- [`../../Ai_Cofounder.md`](../../Ai_Cofounder.md) ("Complexity exists in the engine, not in the user experience") and [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md) ("simple front, powerful engine; hide the engine room").
- [`../../AGENTS.md`](../../AGENTS.md) §3 (engineering rules, where this is wired as a non-negotiable).
