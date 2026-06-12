---
version: 2.0
name: cadence-ember-editorial
product: "Project Cadence — agentic product-operations platform"
description: >
  THE SOURCE OF TRUTH for all Cadence design work, in any tool (Claude Code,
  Lovable, Cursor, design agents). Supersedes uploads/DESIGN-claude.md, which
  was an ANALYSIS of Claude.com used only as a craft reference — Cadence is
  deliberately differentiated from it. Warm parchment canvas, espresso/cacao
  ink, burnished ember copper accent, Newsreader serif display, the bilateral
  Butterfly mark. Read "How to plan and build" before writing any UI code.

colors:
  # oklch values are CANONICAL (see cadence/tokens.css). Hex ≈ fallbacks only.
  ember: "oklch(0.60 0.155 50)"            # ≈ #c2622e — NEEDS-HUMAN ONLY
  ember-active: "oklch(0.52 0.145 48)"     # ≈ #a64f24
  ember-soft: "oklch(0.78 0.08 55)"        # ≈ #ddab88
  indigo-action: "oklch(0.47 0.10 265)"    # ≈ #4a5b9b — live state + links
  orchid-agent: "oklch(0.50 0.11 310)"     # ≈ #8a5a99 — agent actions ONLY
  saffron: "oklch(0.80 0.12 85)"           # ≈ #dfb456 — highlight/celebration
  moss-success: "oklch(0.55 0.09 145)"     # ≈ #4f8a59 — outcomes: success only
  madder-alert: "oklch(0.52 0.16 25)"      # ≈ #b14a44 — outcomes: failure only
  deep-green-approve: "oklch(0.30 0.018 75)" # ≈ #443a28 — approve button fill
  canvas: "oklch(0.977 0.007 85)"          # ≈ #faf7ef warm parchment
  surface-1: "oklch(0.962 0.009 85)"       # ≈ #f4f0e6
  soft-stone: "oklch(0.938 0.013 82)"      # ≈ #ebe4d4
  surface-3: "oklch(0.922 0.014 80)"       # ≈ #e6dfcf
  ink: "oklch(0.225 0.018 50)"             # ≈ #2b211a warm cacao
  ink-muted: "oklch(0.45 0.017 55)"        # ≈ #6b5d51
  ink-subtle: "oklch(0.56 0.016 62)"       # ≈ #8a7c6e
  ink-faint: "oklch(0.65 0.015 70)"        # ≈ #a4968a
  hairline: "oklch(0.905 0.010 80)"        # ≈ #e2dbcc whisper-light
  hero-bg: "oklch(0.27 0.03 40)"           # ≈ #45332b deep plum-umber band
  dark-canvas: "oklch(0.148 0.005 60)"     # ≈ #1d1b18 char floor (NOT brown)

typography:
  display: "Newsreader, ui-serif, Georgia, serif"        # opsz auto, wght 400–470, -0.015em
  ui: "Schibsted Grotesk, ui-sans-serif, system-ui"      # 13px base, 1.55
  mono: "JetBrains Mono, ui-monospace, Menlo, monospace" # 10px caps, 0.12em tracking

rounded:
  controls: 8px        # buttons, inputs, chips
  card: 12px           # bento, band-stone
  hero: 14px           # hero band, command palette
  pill: 99px           # toasts, badges, construction pill

motion:
  ease: "cubic-bezier(0.23, 1, 0.32, 1)"
  durations: "140ms / 180ms / 260ms"
---

# Cadence Design — "Ember Editorial" · Source of Truth

Cadence is a platform where a swarm of specialist agents (Scout, Scribe,
Builder, Marketer, Historian…) runs the product loop — signals → opportunities
→ specs → missions → outcomes — and the human governs through gates. The design
must read as a calm warm editorial publication on the human side AND make
autonomous machine work legible and trustworthy on the agent side.

**Canonical implementations live in this project:**
- `cadence/tokens.css` — every token, theme, and utility class. NEVER invent
  colors or restate values; import or copy this file.
- `styles.css` (root) — the one-line import entry (fonts + tokens).
- `Cadence Prototype.html` + `cadence/*.jsx` — the living UI kit; every screen,
  component, and interaction pattern. When unsure how something looks, open it.
- `Platform Design Blueprint.html` — the signed contract (v2).
- `design-system/README.md` + `design-system/` — the codified design system and specimens.
- `uploads/DESIGN-claude.md` — LEGACY: an analysis of Claude.com. Reference for
  craft (editorial pacing, color-block depth) but NEVER for identity. `src/` is
  also a legacy pre-guardrail generation — do not copy from it.

## Rule 0 — Differentiation guardrail (non-negotiable)

Nothing may be mistakable for Anthropic/Claude at a glance:
- **No radial flower/asterisk marks.** The Cadence Butterfly is bilateral.
- **No coral-on-cream lookalikes.** Our accent is burnished ember copper
  (hue 50) on parchment (hue 85) — warmer canvas, deeper accent, different pair.
- **No Claude-adjacent type.** Newsreader + Schibsted Grotesk + JetBrains Mono.
  Never Copernicus/Tiempos/Styrene, never Fraunces/Inter.
"Mistakable at a glance" = redesign, no exceptions.

## Color — roles, not decoration

Every accent has exactly ONE job. This is the system's trust mechanism — color
tells the user WHO is acting and WHAT is being asked:

| Accent | Exclusive job |
|---|---|
| Ember | Needs-human only: gates, calls, primary CTA. The only voice that asks for attention. |
| Indigo | Live/running state + links |
| Orchid | Agent actions only: tool calls, agent names in traces, ai-glow |
| Saffron | Highlights / celebration |
| Moss | Outcomes — success only |
| Madder | Outcomes — failure/alert only |
| Deep espresso green | The approve button fill (premium, solid) |

Surfaces: warm parchment ramp, depth from surface tints — hairlines whisper-
light, shadows rare. Dark theme: char near-black floors (hue 60, chroma ≤0.01,
never brown), sidebar one step darker for separation, warmth only in accents.
Accent variants: `data-accent="rust" | "marigold"` on `<html>`.

## Type

- **Newsreader** for display: heroes, doc titles, ICE scores (15px + 7.5px mono
  caption), specs. Weight 400–470, optical sizing on, italic `em` for the one
  emotional word ("*Three calls* are waiting on you").
- **Schibsted Grotesk** for all UI: 13px base, 1.55 line-height, 600 for
  headings, 500 for buttons.
- **JetBrains Mono** for metadata: 10px uppercase, 0.12em tracking, used for
  kickers, counts, costs, AI-message footers, status badges.
- Minimums: 24px on 1920×1080 slides, 12pt print, 44px mobile hit targets.

## Voice & copy rules

1. **Consequence-first controls:** buttons state what happens, never bare verbs.
   "Approve · opens the PR" / "Reject · nothing ships" / "Reject · stays
   drafted". House separator is the middot ` · `.
2. **Auto-titles are objectives:** 2–3 words (4 max), stopwords stripped, first
   word capitalized. Reuse `extractTitle()` from `cadence/chat.jsx` anywhere a
   title is generated (chat threads, missions, specs, docs).
3. Calm and declarative; no exclamation marks, no hype, no emoji. Sentence case
   everywhere except mono caps.
4. Every AI utterance carries its footer: judge score · model · latency ·
   tokens · cost · feedback · view-trace · replay-with. Non-negotiable.
5. Evidence is verbatim: citation chips [n] → hover card with source + exact
   quote. The atomic unit of trust.

## Motion

Ease-out `cubic-bezier(0.23,1,0.32,1)`, 140/180/260ms. Entrances animate
**transform only, never opacity** (content survives print + reduced-motion).
`.ai-glow` = breathing orchid/ember halo on containers actively
thinking/executing (static ring when motion is off). Live dots pulse; the
cooking banner sweeps; the hero aurora flows 16s alternate; butterfly wings
flutter 3.2s. ALL motion gated by `data-motion="off"` and
`prefers-reduced-motion`. No infinite decorative loops on content.

## Component contracts (must match the prototype)

| Component | Contract |
|---|---|
| Approval card | Who wants which tool, in which mission · evidence summary · expiry · consequence-labeled approve/reject · open-mission link |
| Mission Cockpit | Title + status · numbered specialist steps with live dots · inline gate when pending · raw trace toggle · `.ai-glow` while running. Identical wherever a mission renders |
| AI message footer | judge · model · latency · tokens · cost · feedback · trace · replay |
| Citation chip | [n] inline → hover card, source name + verbatim quote |
| Hero band | Plum-umber, aurora wash, engraved rings, ghost butterfly, calls-cleared ring (X/Y — never an abstract score) |
| Cooking banner | Mission ticker on every screen; ember sweep; names what's running |
| Construction pill | TEMPORARY fixed top-center mono pill ("Agents are building in the back — we'll serve you soon"). Remove at GA |
| Footer stamp | "Last build · date time" from `document.lastModified` |
| Govern observability | Drill-down, never static: list rows (eval suites, agents, traces, drift surfaces) open detail screens with sub-tabs (runs / cases / config) and time-range tabs. `cadence/govern-detail.jsx` is the pattern reference |
| Chat authorship | User = ember-ringed initials chip (right); AI = Butterfly. Legible at a glance |
| Status placement | Running status at sidebar bottom (above Trust). Topbar = breadcrumbs + date + weather only |
| Calendar | Contribution-style pixel month, ‹ › nav + Today, weekends de-emphasized (pref in Settings → Profile), quick-add syncs back |
| Docs | Notion-style: click = preview, double-click = full editor (serif title/body, Push to Signals / Share / Delete / Save·syncs-to-brain). Knowledge opens with the "Company brain" strip |

## Inline verdict chips — annotate, don't bury (founder ruling 2026-06-12)

The annotation pattern from the founder's design-review reference: small
mono-caps OUTLINE pills — `KEEP` `CORRECT` `ADD NEXT` — preceding the content
they classify. This is how Cadence makes judgments legible at a glance and
the platform feel edited, prominent, premium. It applies to EVERY current and
future screen, not one surface.

**The rule: when content carries a judgment (keep/correct/ship/kill/next/won/
missed), lead with a verdict chip instead of burying the verdict in prose.**

Anatomy (canonical primitive: `src/components/cadence/Primitives.tsx`
`VerdictChip`): JetBrains Mono 9.5px caps, 0.1em tracking, weight 600,
border-radius 99, padding 2px 9px, 1px outline at 40% color-mix of the role
color, **no fill** (selected state may carry a 10% fill), **no dot, no icon**.
The word + the role color carry the entire meaning.

| Tone | Role color | Means |
|---|---|---|
| `moss` | moss | confirmed · keep · validated · ship |
| `ember` | ember | needs correction · the human's call |
| `indigo` | indigo | next action · do this now |
| `orchid` | orchid | agent-performed |
| `saffron` | saffron | highlight · celebrate |
| `madder` | madder | failed · missed · kill |

Distinctions that keep the system honest:
- **VerdictChip ≠ StatusBadge.** StatusBadge (dot + pulse) is LIVE state —
  running, queued, at-gate. VerdictChip is a rendered judgment on content.
  Never use a verdict chip for live state or vice versa.
- Chip text is 1–2 words (3 max), consequence-flavored, sentence-meaningful:
  `SHIP`, `REVISE`, `KILL`, `KEEP`, `ADD NEXT`, `VALIDATED`, `MISSED`.
- The role-color law still governs: a moss chip may only ever mean a positive
  outcome/keep; ember only a needs-human correction. No decorative recolors.
- No filler: a chip must classify real, data-backed judgment. If there is no
  verdict in the data, there is no chip.

Where it applies today (and any new surface with a judgment): Critic reviews
(ship/revise/kill), PRD outcomes (validated/mixed/missed), eval results,
drift findings, review/feedback annotations, brief callouts, rescore deltas.

## Hand-sketched data marks (founder ruling 2026-06-12)

**Every graph of data points — trend lines, sparklines, time-series bars,
distributions — renders hand-sketched: a pencil-on-paper wobble, never a
smooth system-generated vector.** It makes machine telemetry feel authentic
and observed rather than synthetic, and it is a platform-wide pattern: any
new chart, on any current or future screen, follows it.

Canonical primitives: `src/components/cadence/Sketch.tsx` — `SketchLine`
(jittered double-pass stroke + hand-set end dot; drop-in for a sparkline)
and `SketchBar` (jittered outline with diagonal hatch shading). Extend that
file for new mark types; never draw a parallel chart style.

Rules that keep it honest and calm:
- **Jitter is deterministic** — seeded from the data series itself, so a
  chart never wobbles between renders and the underlying points stay exact.
  The sketch is a rendering style, not data distortion (no-filler law holds).
- Role colors still govern (indigo live/links, rose failure, ember
  needs-human, ink-muted neutral telemetry); the sketch changes the stroke,
  never the meaning.
- Scope: data SERIES only. Single-value meters (budget burn bars, strength
  bars, eval score bars, progress rings) stay clean utility marks — a meter
  is an instrument, not an observation.
- Applied today: Govern · Drift metric trends (SketchLine), Govern ·
  Analytics daily activity (SketchBar), Missions · Agents telemetry HUD
  buckets (SketchBar).

**Canonical tuning (founder-approved 2026-06-12 — "calm amplitude: clearly
hand-drawn, never cartoon-loose"). These numbers ARE the law; do not retune
without a founder ruling, and reuse them for any new mark type:**

| Metric | SketchLine | SketchBar |
|---|---|---|
| Wobble amplitude (px, y) | pass A **1.7** · pass B **1.1** | outline **1.2** |
| Subdivision step (px) | ~7 | ~9 (corners overshoot like crossed strokes) |
| Stroke width / opacity | 1.3 @ 0.85 over 0.9 @ 0.45 (graphite double-pass) | outline 1.4 @ 0.85 · hatch 1.0 @ 0.38 |
| Hatch | — | diagonal ↗, ~8.5u spacing, jitter ±0.8 |
| Endpoints | pinned exact (first/last point never jittered); hand-set end dot r 2.4 | bar baseline/top from the exact value |
| Determinism | seed = hash(data series) | seed = bar index |

Anatomy notes: x-jitter is half the y-amplitude (pencil drifts more vertically
along a stroke than across it); two passes use different seeds so the strokes
shadow each other like a line gone over twice. Bars stretch via a fixed-unit
viewBox + `vector-effect: non-scaling-stroke`, so geometry scales but graphite
weight never does.

## How to plan and build (instructions for any AI builder)

1. **Read before designing:** this file, then `cadence/tokens.css`, then the
   relevant screen in `Cadence Prototype.html` / `cadence/*.jsx`. The prototype
   is the visual contract — match it, don't reinterpret it.
2. **Plan against the loop:** every screen serves signals → opportunities →
   specs → missions → outcomes, with governance gates as the human touchpoints.
   Ask of any new surface: what does the agent do here, what does the human
   approve, and where does the evidence come from?
3. **Tokens only.** Use the CSS custom properties; never inline hex. If a color
   seems missing, you're probably violating a role rule — re-read Color above.
4. **Reuse, don't fork:** `.btn`, `.bento`, `.band-stone`, `.mono-label`,
   `.cite`, `.dot-*`, `.hero-editorial`, `.ai-glow`, `.cooking-banner` exist —
   extend them rather than writing parallel styles.
5. **Label every metric.** Every data table carries a `.mono-label` header row;
   numbers never render without a column header or an inline unit. The user
   should never have to guess what a value is.
6. **State is shared, never copied:** approving a gate anywhere resolves it
   everywhere. Pending gates follow the user (count badges + banner). Three
   clicks max from any signal to its mission.
7. **Verify before shipping:** light + dark (`data-theme="dark"`), compact
   density, `data-motion="off"`, keyboard focus (`:focus-visible` indigo
   outline), and the guardrail check — "could this be mistaken for Claude?"
8. **Don't add filler:** no placeholder stats, no decorative icons, no invented
   sections. Every element earns its place; ask before adding material.

## Do / Don't

**Do:** parchment canvas everywhere · serif display with italic em · mono caps
for metadata · color-block depth · ember scarce and meaningful · show real
agent work (traces, costs, evidence) rather than abstractions.

**Don't:** pure white or cool gray canvas · bold display serif · ember as
decoration · orchid on anything non-agent · moss/madder outside outcomes ·
brown dark floors · emoji · bare-verb buttons · radial marks · gradients as
decoration (the aurora and cooking sweep are the only sanctioned washes).

---

## Production mapping (Project-Cadence-v4)

> Appended when the Ember Editorial system was applied to the production app
> (2026-06-12). The sections above are verbatim from
> `Project Cadence - Design v1/DESIGN.md` — keep them in sync.

| Canonical artifact (design project) | Production equivalent (this repo) |
|---|---|
| `cadence/tokens.css` | `src/styles.css` — Tailwind v4 `@theme` + `:root`/`.dark` token blocks (Ember light + Char night). Legacy aliases: `--coral`→ember, `--violet`→orchid agent, `--cyan`→indigo, `--amber`→saffron. |
| `styles.css` font import | Google Fonts link in `src/routes/__root.tsx` (Newsreader · Schibsted Grotesk · JetBrains Mono) |
| Theme switching (`data-theme="dark"`) | `.dark` class on `<html>` via `src/hooks/use-theme.tsx` (light = default parchment, dark = char; aurora retired 2026-06-12) |
| `.bento`, `.mono-label`, `.hero-editorial`, `.ai-glow`, `.dot-*`, `.cite` | `@layer utilities` in `src/styles.css` |
| Verdict chips (founder ruling above — not yet in the design project; sync it back on the next design-project update) | `VerdictChip` in `src/components/cadence/Primitives.tsx` (applied: CriticBadge, OutcomeCard) |
| Hand-sketched data marks (founder ruling above — not yet in the design project; sync back on its next update) | `SketchLine` / `SketchBar` in `src/components/cadence/Sketch.tsx` (applied: drift trends, analytics daily bars, swarm telemetry buckets) |
| Cooking banner | `src/components/cadence/CookingBanner.tsx` (ember sweep) |
| Specimens / UI kit | `Project Cadence - Design v1/design-system/` + `Cadence Prototype.html` (not bundled into the app) |
