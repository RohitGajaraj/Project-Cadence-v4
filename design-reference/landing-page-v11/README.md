# Cadence public landing page (v11) — design reference & handoff

> Created 2026-06-28. For any future session, agent, or designer that picks up the public
> landing page (`src/routes/index.tsx`). This is **not** a file dump — it captures the
> *ideology* of what was built, *why*, *which reference applies where*, and *what to pick
> up next*. Read this first before changing the landing page or revamping it.

The founder plans to revamp this page after a while. When that happens, start here.

---

## 1. What this page is

The public marketing landing page for **Cadence — the agent-native product OS**. One dark
canvas, scroll-through narrative, from first signal to shipped outcome. It must read as a
**serious, enterprise-grade** product and at the same time feel **modern and alive** — never
playful, never templated, never "designed by AI."

Single source file: **`src/routes/index.tsx`** (design tokens in the `C` object, all
keyframes/classes in the `STYLES` constant, fonts loaded via a Google Fonts `<link>`).

---

## 2. The ideology (the non-negotiable intent)

1. **Positioning = judgment, not automation.** Cadence is NOT "automate your workflows, then
   come back and approve." It **makes the call the way your team would**, backed by the memory
   of every past decision and outcome. Never frame it as an automation/workflow tool. The
   differentiator is the **decision layer + outcome memory** (the moat), not the autonomy.
2. **Warm spine, cool machinery (the colour law).**
   - **Ember orange `#fb7100`** = Cadence itself: brand, wordmark, CTAs, the memory/brain core,
     section kickers, key numbers, the moat. This ties the page to the app's primary colour.
   - **Violet `#a78bfa`** = agents / the machinery of the loop (consistent with the app, where
     agents own the orchid hue).
   - **Cyan / green / rose / amber** = signal / success / failure / build states, used inside
     system output (the terminal, the flow log, the ledger) where colour encodes meaning.
   - Do not let violet dominate (an earlier version did and read as "a purple AI site").
3. **Three deliberate type voices** (see §4 fonts):
   - **Serif** (the app's display serif) = headings. Serious, editorial. NOT a playful display
     font. A Bricolage Grotesque experiment was rejected by the founder as "playful, not
     enterprise" — do not reintroduce a playful display face on headings.
   - **IBM Plex Mono** = all **system / machine output**: the terminal, the trust ledger,
     metrics, orbit labels, mono kickers. It must read differently from prose, like a terminal.
   - **Silkscreen (pixel)** = **one** signature accent only (the brand band kicker). Innovative,
     used sparingly. Never a whole heading.
4. **Calm front, deep engine.** Name the outcome, not the mechanism. No PM jargon in UI copy.
5. **Zero AI fingerprints.** No em dashes (—), no en dashes (–), no AI-cliché phrasing, in code
   comments OR user-facing copy. (Hyphen `-` is fine.)
6. **Motion is craft, not noise.** Liveliness through the live terminal, the orbit, the cosmic
   brand band. But motion must never (a) hijack page scroll or (b) cause layout jump. Two real
   bugs were fixed for exactly this — see §6.

---

## 3. Page structure (top to bottom) and what each section is for

1. **Hero** — "Product teams don't build anymore. / Agents do." + a **live typing terminal**
   (perpetual session: types each line, loops, session timer, LIVE pulse, scanline).
2. **Orbit** — the six stations orbit a glowing **Ember "Cadence" brain core** they feed into;
   a write-pulse travels the active spoke; one live status line. **Opens on Sense** the first
   time it scrolls into view, then loops.
3. **Stats strip** — 6 / 0 / D+14 / 100%, in ember.
4. **Manifesto** — centred statement: "Your stack runs the work. / It forgets the thinking."
5. **Six stations** — Sense / Decide / Define / Build / Ship / Learn cards.
6. **Engine in motion** (founder favourite) — sequential flow log + a decision card + a **live
   agent-mesh run** (Scout/Architect/Builder/Sentry → running/done). Execution, deliberately
   distinct from the audit ledger below.
7. **Trust Ledger** — every call graded by its outcome; table fills the frame; one calm ember
   **trust chip** ("proven, not argued") + the impact in plain text. Reused column shows
   precedent reuse.
8. **Moat** (the differentiator, spotlit on a slab) — three layers as **vertical tabs**
   (Decision layer / Outcome memory / Compounding edge), auto-cycling + clickable, each with an
   expanded context window AND a small **system visual** showing how it works.
9. **Guerrilla** — "Building used to be the hard part. / Now it's the easy part." New problem
   framing: building got cheap; the hard part is knowing *what* to build and *why* the last
   thing shipped. Positive, system-led close (never "replace your people").
10. **Brand band** (the artistic peak — founder loves this, wants to enhance it later) — a
    cosmic morphing gradient + film grain + drifting particles, a giant **hollow "Cadence"
    outline wordmark**, and the **Silkscreen pixel** kicker "SIGNAL TO SHIPPED."
11. **CTA** — "Decisions made the way your team would make them." (judgment, not automation).
12. **Footer.**

---

## 4. Reference images in this folder — and where each one applies

### External inspirations (the feeling to evolve toward; do NOT copy exactly)
| File | What it is | Where it landed / how to use it |
|---|---|---|
| `inspiration-01-pixel-display-font.png` | Gharage "From Function to Feeling" — chunky **pixel/bitmap display font** | Became the **Silkscreen pixel kicker** in the brand band. Keep pixel type as a *sparing accent*, never a heading. |
| `inspiration-02-perplexity-answer-engine.png` | Perplexity launch — painterly portrait, "We're an answer engine." | The *feeling* target: artistic, alive, emotional. Informs the brand band. |
| `inspiration-03-perplexity-surreal-portal.png` | Perplexity — surreal book-portal on Mars | Imaginative / premium mood reference. |
| `inspiration-04-perplexity-outline-wordmark.png` | Perplexity — **hollow/outline wordmark** over artwork | Became the **hollow "Cadence" outline wordmark** (`-webkit-text-stroke`) in the brand band. |
| `inspiration-05-perplexity-comet-cosmic.png` | Perplexity Comet — **cosmic gradient** swirl | Became the **cosmic morphing gradient + particles + grain** in the brand band. |

**Founder direction on these:** bring the *artistic touch / portrait form / liveliness* into
the platform; do **not** clone Perplexity. The current brand band achieves this with **CSS art
only** (gradients, grain, particles, outline + pixel type) — no commissioned imagery. A future
revamp could push it further with real painterly/portrait art if assets exist.

### In-progress feedback screenshots (context for the iteration, not targets)
| File | What it showed | What it became |
|---|---|---|
| `feedback-01-moat-section.png` | Moat as three flat cards | Vertical tabs + per-layer system visuals (more spotlight). |
| `feedback-02-manifesto-essay.png` | Manifesto reading like an essay/slide-deck | Centred, tight statement. |
| `feedback-03-guerrilla-essay.png` | Guerrilla reading like an essay + odd bullet | Centred; shorter lead; clean close, no bracket-bullet. |
| `feedback-04-trust-ledger-indent.png` | Ledger table left-indented; shimmer everywhere | Table fills the frame; one calm trust chip + plain-text impact. |

---

## 5. Decision log (what changed and why) — the short version

- **Colour:** brown (bad) → electric violet (read as "purple AI site") → **warm Ember spine**
  with violet reserved for agents. This is the current law (§2.2).
- **Fonts:** default → a **Bricolage Grotesque** display experiment (founder: "playful, not
  enterprise" — rejected) → **serif headings restored** + **IBM Plex Mono** for system output
  + **Silkscreen** pixel as one accent.
- **Positioning:** drifted toward "automation tool" → corrected to **judgment / decision /
  memory** language everywhere, especially the CTA.
- **Structure:** essays / slide-deck crescendos → **centred editorial statements**; the moat
  got a **vertical-tab spotlight**; the ledger got a **trust chip**; the engine got a **live
  agent-mesh** panel distinct from the ledger.
- **Alignment:** sections each had a different left edge (drifted right) → unified to a single
  **1120px frame** (header, footer, all sections share one left edge); centred statement
  sections stay deliberately centred.
- **Liveliness:** added the **live typing terminal**, the **brand band**, and the orbit
  **write-pulse**.
- **Texture:** founder chose to **keep it restrained** — hero dot-grid + brand-band grain +
  terminal scanline only. A fuller geometric/blueprint grid was deliberately NOT added.

---

## 6. Gotchas a future agent MUST know (these caused real bugs)

- **Never use `scrollIntoView` for in-page animation.** It scrolls *every* scrollable ancestor
  including the document. The live terminal did this on every typed char and hijacked the whole
  page scroll (page felt frozen, snapped to the orbit, drifted). Auto-scroll a component's own
  container with `el.scrollTop = el.scrollHeight` instead.
- **Reserve full height for sequential reveals.** The flow log added rows to the DOM one by one,
  growing the section and shoving everything below it down. Render all rows up front and reveal
  with opacity, so height is constant.
- **Orbit must open on Sense.** `useActiveStation(total, ms, run)` stays at 0 until `run` (the
  section's in-view state) is true, so the cycle starts at Sense the first time it's seen.
- **Zero em/en dashes** anywhere (a sanitiser convention; founder is strict on it).

---

## 7. What the founder explicitly liked (keep, and enhance — don't discard)

- **The brand band** (cosmic gradient + **hollow "Cadence" wordmark** + the font) — "really
  good and great ... the thought process is good, the font is great." **Enhance on top of this**
  in any revamp; it's the agreed artistic peak.
- **The engine-in-motion** section.
- **The orbit** with Cadence at the centre.
- The **warm Ember spine** and the **three-voice type system**.

---

## 8. Where to start in a revamp

1. Read this file + `DESIGN.md` + `docs/conventions/design-context.md` (Ember system, the tuned
   orange `#fb7100`, motion-as-craft) + `docs/conventions/humanized-output.md` (no fingerprints).
2. Open `src/routes/index.tsx`. Tokens are in `C`; keyframes/classes in `STYLES`; fonts in the
   Google Fonts `<link>` inside `LandingPage`.
3. Keep the ideology in §2. Evolve the brand band (§7) rather than replacing it.
4. If introducing real imagery, this is where the Perplexity-style portrait/painterly direction
   (§4) would finally be realised beyond CSS art.
