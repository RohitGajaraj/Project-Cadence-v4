# Convention: design context loads by default

> _Created: 2026-06-16 · Last updated: 2026-06-18_

**Status: standing rule, founder ruling 2026-06-16.** Any time we touch design work (a new surface, a redesign, a visual or interaction change), this context is loaded and considered automatically. It is the standing design brief, not re-litigated each time.

## Load these, every design task

1. **The Ember Editorial system (the system of record):** [`../../DESIGN.md`](../../DESIGN.md) + `src/styles.css` tokens. Warm parchment canvas, espresso/cacao ink, the role-color law (ember = needs-human only; indigo = live/links; orchid = agent; moss/madder = outcomes), Newsreader serif display, Schibsted Grotesk UI, JetBrains Mono metadata, verdict chips, hand-sketched data marks. Reuse `.bento` / `.hero-editorial` / `.mono-label`; invent no colors.
2. **The design-craft skill toolkit (consult the WHOLE set, not one).** **Founder ruling 2026-06-20 (strengthened): on EVERY front-end build, actively INVOKE the fitting design skills, agents, and reference files, not merely `impeccable` and not merely reference them.** There are many strong design skills available; survey them and use the ones that fit the surface, so the product is right upfront instead of corrected later. Full authority to use whatever skill or agent fits. The standing per-build procedure is **"The frontend build protocol"** section below; the toolkit it draws on:
   - **Visual taste + direction:** `design-taste-frontend`, `high-end-visual-design`, `gpt-taste`, `stitch-design-taste`, `ecc:frontend-design-direction`, `frontend-design` (and `emil-design-eng` for design-engineering taste).
   - **Interaction + motion craft:** `emil-design-eng` (Emil Kowalski: easing, timing, restraint), `ecc:make-interfaces-feel-better`, and the motion skills `ecc:motion-foundations` / `ecc:motion-ui` / `ecc:motion-patterns` / `ecc:motion-advanced`.
   - **System + patterns:** `ecc:design-system`, `ecc:frontend-patterns`.
   - **Quality + review gate:** `impeccable` (the AI-slop bans: no identical card grids, no hero-metric template) is mandatory before commit; for significant surfaces also run a design-review (`gstack-design-review`, or the GAN evaluator loop) and accessibility (`ecc:accessibility` / the `ecc:a11y-architect` agent).
   - **Off-brand style packs** (`minimalist-ui`, `industrial-brutalist-ui`, `liquid-glass-design`) are consulted for TECHNIQUE only; they never override the Ember Editorial system.
3. **The reference north-stars (the founder's chosen bar):**
   - **interfacecraft.dev** - "designing with uncommon care", reduce until clear, timeless restraint, generous whitespace, color from a crafted object not from UI chrome. The bar for restraint.
   - **devouringdetails.com** (Rauno, Vercel) - the interaction-craft reference: near-white canvas, near-black ink, the orange `#fb7100` used scarcely (CTA + key marks), calm framed example blocks. "A touch of delay where it helps, no motion where it doesn't." The bar for motion as craft.
   - Local study shots: `docs/screenshots/design-refs/` (gitignored).

## The accent orange

Ember is tuned brighter and cleaner toward the reference orange (`#fb7100`), while staying warm on parchment, not neon: light `--ember: oklch(0.65 0.18 50)`, dark `oklch(0.72 0.175 50)` (`src/styles.css`). Still needs-human only; a brighter ember strengthens the role-color law (the calls pop, everything else stays calm). Re-tune only with a founder ruling.

## The agent palette (per-agent identity, an extension of the role-color law)

**Founder ruling 2026-06-18 (AGENT-EXP).** The role-color law reserves orchid for "agent". This extends it: each agent carries its own hue from a purpose-built agent palette, plus a unique geometric glyph. The palette is drawn from the violet to magenta to indigo range (the orchid family) and EXCLUDES the reserved status colors, so an agent's color can never be read as a status: never ember (needs-human), never moss/green (done), never indigo/action-blue (live/links), never madder/rose (failed). Chief of Staff anchors on the canonical orchid. Color is never the only signal: every agent also has a distinct glyph (a lucide mark in a soft rounded square), so identity survives in monochrome and for color-blind users. The hue + glyph live in the agent catalog (`src/lib/agent-vocabulary.ts`, the single source) and render through `AgentMark` / `AgentBadge` (`src/components/agents/AgentMark.tsx`). Agents are called out by mark + name + a present-tense verb ("Scout reading your sources"); identity is always disclosed, never mistaken for a person. This first pass stores hex values in the catalog; a later design pass may tokenize them into `src/styles.css`.

## Motion is craft, not decoration and not absence

**This explicitly replaces any earlier "remove animations / no animations" wording so it is never misread again.** Use subtle, purposeful, fast motion that makes the product feel considered: state changes (a call clearing, the ring filling), press / hover feedback, considered reveals, the right easing and timing (a touch of delay where it helps, none where it doesn't, per devouringdetails). Avoid the opposite failure: gratuitous or sluggish choreography, especially "every panel fades in on page load" on a surface opened 100+ times a day. The test is feel; all motion is gated by `data-motion="off"` + `prefers-reduced-motion`. Use the Ember easing `cubic-bezier(0.23,1,0.32,1)` at 140/180/260ms.

## The frontend build protocol (standing, run on EVERY front-end build)

**Founder ruling 2026-06-20.** This is the durable, repeatable procedure for any FE screen, card, or surface, going forward, for every build, not just one feature. It reconciles the founder's reference files with standard practice and the design-skill toolkit.

1. **Load the brand canon (always).** [`../../DESIGN.md`](../../DESIGN.md) (Ember Editorial, the system of record) + this file + [`engine-room-doctrine.md`](./engine-room-doctrine.md) (calm front, name the outcome) + [`home-and-today-ia.md`](./home-and-today-ia.md) (where it goes) + [`ui-voice.md`](./ui-voice.md) + [`humanized-output.md`](./humanized-output.md).
2. **Treat the reference files as INTENT, not gospel.** The founder's references (this file, the north-stars, the tuned orange) capture the brand intent, warm editorial calm, restraint, the role-color law. **They may be imperfect.** Where a reference detail conflicts with current standard UI / accessibility / interaction practice or a design skill's guidance, **follow the better practice and keep the brand intent**; note the deviation in the commit / report so the canon can be corrected. Standard practice + the skills win on technique; the brand intent wins on feel.
3. **Invoke the fitting design skills at BUILD time (more than one).** Pick from the toolkit above by what the surface needs: a taste/direction skill for the visual, an interaction/motion skill for the feel, a system/patterns skill for structure. Do not default to `impeccable` alone, that is the gate, not the build.
4. **Build to match the existing system.** Reuse Ember primitives (`.bento` / `.hero-editorial` / `.mono-label`, the role-color tokens, the `btn`/`input` classes); invent no colors; mirror a fully-wired sibling component's data-flow shape (server fn via `useServerFn` + TanStack Query, scoped `queryKey`, invalidate-on-success). Motion is craft per the rule above, gated by `data-motion`/`prefers-reduced-motion`.
5. **Gate before commit (mandatory).** Run `impeccable` (AI-slop bans). For a significant surface, also run a design-review (`gstack-design-review` or the GAN evaluator) and accessibility (`ecc:accessibility` / `ecc:a11y-architect`). Fold every real finding.
6. **Verify visually when feasible** (run the dev server, per [`../../AGENTS.md`](../../AGENTS.md) §3.6); otherwise rely on the offline correctness gate (tsc + build + lint) and flag for publish-verify.

**Relationship to the velocity ruling (no contradiction).** The deferred whole-product design-polish pass ([`../operations/autonomous-build-loop.md`](../operations/autonomous-build-loop.md) §14, standing ruling "design is LAST, done ONCE") is a final HOLISTIC sweep. It is NOT a license to ship rough FE now. "Design once" means **build each surface well the first time** with this protocol, so the final pass tunes a coherent product rather than salvaging a rough one.

## Why

Good design is the differentiator. Loading the system, the craft skills, and the founder's references by default keeps every design change on one coherent, high bar instead of drifting into generic AI-app output, and it captured the correction that motion is wanted (with restraint), not banned. The full-toolkit protocol (2026-06-20) exists because a single skill (`impeccable` alone) was being treated as the whole of design; the founder ruled that every FE build draws on the whole design toolkit and standard practice, upfront.

## How to apply

At the start of any design work, hold all three (system + skills + references) in view; tune toward the references; treat motion as craft per the rule above. Pair with [`home-and-today-ia.md`](./home-and-today-ia.md) for where things belong.

## Related

- [`home-and-today-ia.md`](./home-and-today-ia.md) · [`humanized-output.md`](./humanized-output.md) · [`ui-voice.md`](./ui-voice.md) · [`ui-chrome.md`](./ui-chrome.md).
- [`../features/command-canvas.md`](../features/command-canvas.md) - the Command Canvas bet (NL command bar + live preview). Any work on it loads this brief + the Engine-Room Doctrine first: the split-pane layout and command interaction are new structural language for the design system to resolve (how the preview blocks obey Ember; motion as craft).
- [`../../DESIGN.md`](../../DESIGN.md) (Ember Editorial system of record).
