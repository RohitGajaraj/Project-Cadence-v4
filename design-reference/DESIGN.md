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

**Canonical implementations live in this repo:**
- `cadence/tokens.css` — every token, theme, and utility class. NEVER invent
  colors or restate values; import or copy this file.
- `styles.css` (root) — the one-line import entry (fonts + tokens).
- `design-reference/Cadence Prototype.html` + `design-reference/cadence/*.jsx`
  — the living UI kit; every screen, component, and interaction pattern. This
  is the DESIGN OF RECORD: when building a screen that exists here, PORT it —
  match layout, positioning, hierarchy, and copy. Do not reinvent. When unsure
  how something looks, run it (see design-reference/README.md).
- `design-reference/Platform Design Blueprint.html` — the signed contract (v2).
- `design-system/README.md` + `design-system/` — the codified design system and specimens.
- `docs/design-legacy.md` — LEGACY: an analysis of Claude.com. Reference for
  craft (editorial pacing, color-block depth) but NEVER for identity. The old
  Tailwind styles in `src/` predate the guardrail — do not copy from them.

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

## How to plan and build (instructions for any AI builder)

1. **Read before designing:** this file, then `cadence/tokens.css`, then the
   relevant screen in `design-reference/` (prototype HTML + screen jsx). The
   prototype is the visual contract — PORT its screens, don't reinterpret them.
   Only design from scratch when a surface has no reference screen, and then
   follow the contracts table above.
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
