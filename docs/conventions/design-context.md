# Convention: design context loads by default

**Status: standing rule, founder ruling 2026-06-16.** Any time we touch design work (a new surface, a redesign, a visual or interaction change), this context is loaded and considered automatically. It is the standing design brief, not re-litigated each time.

## Load these, every design task

1. **The Ember Editorial system (the system of record):** [`../../design.md`](../../design.md) + `src/styles.css` tokens. Warm parchment canvas, espresso/cacao ink, the role-color law (ember = needs-human only; indigo = live/links; orchid = agent; moss/madder = outcomes), Newsreader serif display, Schibsted Grotesk UI, JetBrains Mono metadata, verdict chips, hand-sketched data marks. Reuse `.bento` / `.hero-editorial` / `.mono-label`; invent no colors.
2. **The design-craft skills (consult for taste + interaction):** `impeccable` (design quality + the AI-slop bans: no identical card grids, no hero-metric template), `emil-design-eng` (Emil Kowalski's interaction-craft: easing, timing, restraint), and the taste skills (`gpt-taste`, `design-taste-frontend`, `make-interfaces-feel-better`).
3. **The reference north-stars (the founder's chosen bar):**
   - **interfacecraft.dev** - "designing with uncommon care", reduce until clear, timeless restraint, generous whitespace, color from a crafted object not from UI chrome. The bar for restraint.
   - **devouringdetails.com** (Rauno, Vercel) - the interaction-craft reference: near-white canvas, near-black ink, the orange `#fb7100` used scarcely (CTA + key marks), calm framed example blocks. "A touch of delay where it helps, no motion where it doesn't." The bar for motion as craft.
   - Local study shots: `docs/screenshots/design-refs/` (gitignored).

## The accent orange

Ember is tuned brighter and cleaner toward the reference orange (`#fb7100`), while staying warm on parchment, not neon: light `--ember: oklch(0.65 0.18 50)`, dark `oklch(0.72 0.175 50)` (`src/styles.css`). Still needs-human only; a brighter ember strengthens the role-color law (the calls pop, everything else stays calm). Re-tune only with a founder ruling.

## Motion is craft, not decoration and not absence

**This explicitly replaces any earlier "remove animations / no animations" wording so it is never misread again.** Use subtle, purposeful, fast motion that makes the product feel considered: state changes (a call clearing, the ring filling), press / hover feedback, considered reveals, the right easing and timing (a touch of delay where it helps, none where it doesn't, per devouringdetails). Avoid the opposite failure: gratuitous or sluggish choreography, especially "every panel fades in on page load" on a surface opened 100+ times a day. The test is feel; all motion is gated by `data-motion="off"` + `prefers-reduced-motion`. Use the Ember easing `cubic-bezier(0.23,1,0.32,1)` at 140/180/260ms.

## Why

Good design is the differentiator. Loading the system, the craft skills, and the founder's references by default keeps every design change on one coherent, high bar instead of drifting into generic AI-app output, and it captured the correction that motion is wanted (with restraint), not banned.

## How to apply

At the start of any design work, hold all three (system + skills + references) in view; tune toward the references; treat motion as craft per the rule above. Pair with [`home-and-today-ia.md`](./home-and-today-ia.md) for where things belong.

## Related

- [`home-and-today-ia.md`](./home-and-today-ia.md) · [`humanized-output.md`](./humanized-output.md) · [`ui-voice.md`](./ui-voice.md) · [`ui-chrome.md`](./ui-chrome.md).
- [`../../design.md`](../../design.md) (Ember Editorial system of record).
