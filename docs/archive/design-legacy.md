# design.md — Design system & AI surface contract

> _Created: 2026-06-19 · Last updated: 2026-06-19_

> The visual, motion and interaction contract for Cadence. Product framing: [`README.md`](./README.md). Operating/engineering rules: [`AGENTS.md`](./AGENTS.md). Build log: [`plan.md`](./plan.md). Repo map: [`ENTRY.md`](./ENTRY.md).

---

## Design mandate (read before designing)

The product must feel like a **light, calm, super modern, fast single-purpose app** sitting on top of a **heavy reasoning engine** — the "should feel like light surface, but powerful engine behind it" promise from [`README.md`](./README.md). It must read as a genuine enterprise-grade, AI-native product — not a card-grid SaaS template, and not a copy of any one site , but you can get inspired from get products out there.

**This is a directive, not a suggestion:** before locking visual decisions, do real design research using the available design skills, plugins, and MCPs (e.g. `/emil-design-eng`, `/impeccable` , `/design-taste-frontend`, `/frontend-design-direction` , `/frontend-design`, `/gstack-design-review`, `/ecc:a11y-architect` , `/gstack-design-consultation` , and many more avaialble in the installed library, the design-system and Figma skills). Pull from a wide menu of references and **mix to a unique result**. Reach for the full modern toolkit where it earns its place: shaders, hero compositions, AI-chat components, gradient and text effects, glassmorphism/neumorphism used sparingly, liquid effects, hover/floating interactions, motion and so on. The pillars and tokens below are the _foundation and guardrails_, not a ceiling — improve on them when you can justify it.

### Reference menu (inspiration, never copy)

- VoltAgent awesome-design-md / getdesign.md — curated unicorn design references (the menu).
- impeccable.style (Emil Kowalski) — subtraction, intentionality, restraint.
- 21st.dev community components — current AI-native component patterns.
- Framer 2026 State of Sites — 2026 design direction.
- motion.dev — animation principles.
- Anything & everything you feel that would be a good fit.

### Anti-references (do not mimic)

Generic five-feature-card SaaS landing pages; decorative shadow+gradient layering as a substitute for hierarchy; confetti/celebration animations; stacked-section "document" layouts where every section is the same shape; purposeless carousels.

---

## Three governing pillars

1. **Composition-first, poster-not-document.** Every screen is a curated composition with intentional hierarchy, not a stack of identical sections. The brand voice (calm, modern, unique, futuristic, intentional) lives in the composition, not the chrome.
2. **Motion as hierarchy, not decoration.** Animation tells the eye what matters: primary action moves first, secondary elements stagger, ambient motion communicates state. Never animate for its own sake. Always honor `prefers-reduced-motion`.
3. **Cardless and confident.** Strip the card-grid default. Cards exist only when content needs a container (an item in a list, a discrete artifact). Where most SaaS uses four cards in a 2×2, Cadence uses one composition that tells the same story with hierarchy.

The foundation craft inheritance — Apple's craftsmanship, Linear's clarity, Notion's flexible document primitive, Cursor's inline AI co-presence, Claude Code's auditability — is the starting point, not the limit.

---

## Tokens

**All colors, gradients, and shadows are CSS custom properties in `src/styles.css`. Components consume tokens, never hex literals.** Enforced by [`AGENTS.md`](./AGENTS.md), section 3. Use **OKLCH** — it is perceptually uniform, which removes the class of dark-mode bugs where two colors look balanced in light mode but one disappears in dark.

**Semantic colors:** `--background`, `--foreground`, `--card`/`--card-foreground`, `--primary`/`--primary-foreground`/`--primary-glow`, `--secondary`, `--accent`, `--muted`/`--muted-foreground`, `--destructive`, `--border`, `--input`, `--ring`.

**Gradients:** `--gradient-aurora` (hero), `--gradient-card` (rare elevation), `--gradient-trace` (trace waterfall wash).
**Shadows:** `--shadow-glass`, `--shadow-elevated`, `--shadow-focus`.

If a value is needed and no token fits, **add a token** — never inline. The review threshold is low; drift is the enemy, not new tokens.

The theme is **dark-mode first** (a Google Products-inspired "Neural Expressive" base) with warmth shifts in OKLCH for depth. Light mode is supported but secondary. Treat the palette as authoritative starting values with full authority to evolve toward a more distinctive, appealing result.

**That said you have full autonomy to pick the patterns, colours and design on your what would look good and makes sense here. Looking forward to dark background, preferably a shade of black and certain accent colours complimenting it.**

### Active palette: Carbon & Ember (2026-06-03)

Supersedes "Midnight Indigo." Factory.ai-adjacent industrial dark — carbon-black canvas, molten Pantone Orange 021 C as the signature accent, with amber warmth and a thin ice counterpoint for data viz. Conveys "heavy reasoning engine" without the generic AI-blue trope.

| Role               | Token                                      | Pantone                     | OKLCH                  | Notes                                    |
| ------------------ | ------------------------------------------ | --------------------------- | ---------------------- | ---------------------------------------- |
| Background (paper) | `--paper`                                  | Black 6 C (~#101820)        | `oklch(0.13 0.006 60)` | Warm carbon, never pure #000             |
| Elevated surface   | `--paper-elevated`                         | —                           | `oklch(0.17 0.008 60)` | Graphite plate for cards                 |
| Foreground (ink)   | `--ink`                                    | Cool Gray 1 C               | `oklch(0.97 0.004 75)` | Bone white, faint warmth                 |
| Muted ink          | `--ink-muted`                              | Cool Gray 7 C               | `oklch(0.64 0.012 65)` | Concrete                                 |
| **Primary accent** | `--violet` _(retained name)_ / `--primary` | **Orange 021 C (~#FE5000)** | `oklch(0.70 0.22 38)`  | Signature ember — CTAs, rings, gradients |
| Warm halo          | `--amber`                                  | 7548 C                      | `oklch(0.84 0.16 78)`  | Gradient companion                       |
| Cool counterpoint  | `--cyan`                                   | 7541 C                      | `oklch(0.82 0.08 220)` | Charts, info states                      |
| Success            | `--emerald`                                | 7480 C                      | `oklch(0.78 0.16 158)` |                                          |
| Alert              | `--rose` / `--destructive`                 | Red 032 C                   | `oklch(0.70 0.22 22)`  | Reads warm next to ember                 |

Token names `--violet`, `--indigo-grid`, `.ring-glow-violet`, `.neural-*` are retained for backwards compatibility — only their values shifted to the Carbon & Ember language. WCAG AA: ember (`0.70 .22 38`) on carbon (`0.13 .006 60`) ≈ 7.4:1 for text and large UI.

### AI Color Selection Protocol (for agents, Lovable, and designers)

**When selecting or evolving the color palette, follow this protocol:**

1. **Use Pantone as the reference authority** — all accent colors must be mapped to Pantone tones for consistency, accessibility audit, and vendor communication.
   - Base dark background: **Pantone 19-0301** (near-black, cool underTone) or **Pantone Black C**
   - Accents: pick from the Pantone Plus Series (modern, distinctive, industry-standard)

2. **Allow AI agents to autonomously propose palettes**
   - Agents may invoke `/design-taste-frontend` or `/emil-design-eng` or `/frontend-design-direction` to research current trends
   - Agents may propose 3–5 accent Pantone tones that complement the dark base and differentiate Cadence
   - Criteria: distinctiveness (avoid generic tech blues), appeal to enterprise operators, perceptual uniformity in dark mode

3. **Palette proposal template** (for agents submitting color suggestions)

   ```
   Background: Pantone 19-0301 (near-black, cool tone)
   Primary accent: Pantone [####] — reason (e.g., "modern, high contrast, enterprise-familiar")
   Secondary accent: Pantone [####] — reason (e.g., "complements primary, reads well in dark mode")
   Alert/destructive: Pantone [####] — reason (e.g., "red with warmth, accessible on dark")
   Success: Pantone [####] — reason (e.g., "green, accessible, distinct from primary")
   Neutral (muted): Pantone [####] — reason (e.g., "slate, de-emphasizes metadata")

   Rationale: [2–3 sentences on why this palette achieves "light surface, powerful engine" brand promise]
   WCAG AA check: [contrast ratios for all foreground/background pairs]
   Tool used: [which design skill/MCP was consulted]
   ```

4. **Approval gate**
   - Submit palette proposals to [`docs/feature-backlog.md`](./docs/feature-backlog.md) "Blocked / stuck" or in a design PR comment
   - Include link to this protocol + the Pantone reference numbers
   - Humans review for brand alignment + accessibility
   - Approved palettes move into `src/styles.css` tokens immediately after review

5. **Update documentation in the same commit**
   - Add Pantone tone to `DESIGN.md` §Tokens (this section)
   - Update `src/styles.css` with new `--color-*` tokens (never hardcoded hex)
   - Document in [`AGENTS.md`](./AGENTS.md) §4 if a new color selection pattern emerges

**Why this matters:** Pantone grounds design decisions in industry standard language; agent autonomy accelerates iteration; documentation keeps future tools aligned.

---

## Type ramp

System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, …`); monospace `ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo`.

| Role    | Weight | Size         | Line height | Use                          |
| ------- | ------ | ------------ | ----------- | ---------------------------- |
| Display | 600    | text-4xl     | 1.1         | Hero, login. Rare.           |
| H1      | 600    | text-3xl     | 1.2         | Route titles.                |
| H2      | 600    | text-2xl     | 1.3         | Section headers.             |
| H3      | 500    | text-xl      | 1.35        | Sub-sections.                |
| Body    | 400    | text-base    | 1.6         | Default.                     |
| Body-sm | 400    | text-sm      | 1.5         | Lists, table cells.          |
| Caption | 400    | text-xs      | 1.4         | Metadata badges, timestamps. |
| Code    | 400    | text-sm mono | 1.6         | Inline code, blocks.         |

Default to `text-sm` on dense surfaces. Reserve `text-2xl`+ for true hierarchy. Numerals in tables use `tabular-nums`.

---

## Layout, spacing, radii

Tailwind 4px base. Common rhythm: 2/4/8/12/16/24/32/48px. Radii: `rounded-sm` (badges) · `rounded-md` (buttons/inputs) · `rounded-lg` (cards/dropdowns) · `rounded-xl` (widgets/modals) · `rounded-2xl` (hero) · `rounded-full` (avatars/dots). App shell: fixed collapsible left sidebar; content flex-fluid, `max-w-7xl` on dense routes, full-bleed for analytics. Modals `max-w-2xl`; Studio and trace viewer use full-screen overlays.

## Iconography

**Lucide** only. No mixed icon sets. No emoji-as-icon in functional UI (emoji are fine in user content). Default size `1em`; stroke 1.5. Status uses small colored dots, not icons.

---

## Motion language

**Framer Motion** is canonical (CSS transitions ok for trivial hover).

| Token             | Duration | Easing    | Use                        |
| ----------------- | -------- | --------- | -------------------------- |
| motion-instant    | 80ms     | easeOut   | Hover, focus ring.         |
| motion-quick      | 160ms    | easeOut   | Dropdown, tooltip.         |
| motion-default    | 240ms    | easeInOut | Modal, page transition.    |
| motion-deliberate | 480ms    | easeInOut | Hero entrance, onboarding. |
| motion-glacial    | 1200ms   | easeInOut | Aurora pulse, skeleton.    |

Patterns: stagger-fade (60ms) on dashboards; spring on drag (`stiffness 360, damping 28`); streaming text uses a CSS-blinking cursor (not Framer — high-frequency Framer animation janks); trace spans expand L→R with a soft pop. **Reduced motion:** any `animate` prop lives in a component that checks `useReducedMotion()` and degrades to instant. Essential fades stay; stagger and aurora pulse are removed. Skeleton pulse stays (it signals state).

---

## Product behavior reference (trust arc)

The trust arc — how the operator-agent relationship evolves from close governance to greater autonomy as agents earn trust — is a **product behavior and feature specification**, not a design system concern. It lives in:

- Feature C6 (Agent Trust Score + Autonomy Dial) in [`docs/feature-backlog.md`](./docs/feature-backlog.md)
- Strategic rationale in [`docs/strategy/archive/v2-positioning.md`](./docs/strategy/archive/v2-positioning.md) §7

The design system (this file) focuses on tokens, typography, motion, and component contracts. Feature-level behavior specifications belong in the feature backlog and strategy docs.

## Component patterns

Built on **shadcn/ui** (Radix). Bespoke components in `src/components/cadence/`.

- **AppShell** — pinned + collapsible sidebar groups, breadcrumb, ⌘K, BudgetBar, workspace switcher. Same on every authenticated route.
- **CommandPalette (⌘K)** — resolves every destination, create action, and recent artifact via `cmdk`. Keyboard-first.
- **BudgetBar** — thin top bar: today's burn vs daily cap, month burn vs monthly cap; color shifts muted → accent → destructive; hover popover with per-surface breakdown.
- **DocEditor (Tiptap)** — inline `/ai` slash menu, 1.5s autosave to `prd_versions`, inline citation pills, side-anchored comments.
- **CitationList** — `[1][2]` references with hover preview; the only approved way to expose retrieval grounding.
- **TraceWaterfall** (`/traces/$traceId`) — one row per span, color-coded by surface, depth indentation from `parent_event_id`; click for input/output/citations/judge/guardrail hits.
- **DecisionQueue card** — `awaiting_review` runs with summary + proposed action + approve/reject; approve resumes from checkpoint.
- **Toast** — used sparingly, for confirmation only. Errors live inline near their cause, never in a toast.

---

## Information architecture (v4 contract — 2026-06-11)

> Canonical spec: [`docs/strategy/archive/v4-feature-map.md`](./docs/strategy/archive/v4-feature-map.md) §7. The rule: **≤7 user-facing surfaces; the engine is never primary navigation.** Every absorbed legacy route becomes a `beforeLoad` redirect (established pattern). No new top-level routes without a session decision.

- **Pinned rail (3):** Home · Chat · Missions.
- **Loop group:** Product (tabs: Signals · Opportunities · Specs · Roadmap · Releases) · Knowledge (Memory · Decisions · Docs · Calendar) · Learn (Support · Outcomes · Learnings).
- **Engine room (1):** Govern (tabs: Approvals policy · Budgets · Guardrails · Traces · Evals · Drift · Prompts).
- **Below divider:** Settings (workspace/products · Staff/agent config · Connectors · Models/BYOK · Profile).
- Sidebar behavior unchanged: single-open accordion, `localStorage` persistence, active-group auto-open, ⌘K resolves everything.
- Vocabulary on all chrome: Mission · Agent · Approval · Trace (feature map §6); banned labels list in the v3 language audit applies.

## Mission Control composition

Five widgets, each with its own skeleton/empty/error, none blocking page render: Product Health → AI Activity (sparkline) → Decision Timeline (`supersedes` chains as soft arrows) → Today's Focus (daily brief) → Recent Insights.

## **Note:** This sectioning and features listed here may / may not change based on how we progress. so you have authority to see how the features needs to listed on the application. But whatever that comes through as part of develelopment process, make sure you capture and update here.

## The AI message UI contract (non-negotiable)

Every AI message — chat, copilot, PRD `/ai`, Studio chat, agent summaries, daily brief — exposes the same contract, rendered by one shared component. No surface invents its own. If you cannot fit the contract, redesign the surface, not the contract. Enforced by [`AGENTS.md`](./AGENTS.md), rule 9.

| Element      | Purpose                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Score badge  | LLM-as-judge composite; green/amber/red ramp; tooltip shows groundedness/relevance/coherence/hallucination. |
| Model + via  | e.g. `model-x · gateway` or `claude-… · byo`.                                                               |
| Latency      | e2e and ttft if streamed (`1.4s · 240ms ttft`).                                                             |
| Tokens       | in / out, tabular.                                                                                          |
| Cost         | `$0.0042` (4 dp under 1¢, 2 dp above); show `$0.0000` for cache hits — explicit zero beats blank.           |
| Citations    | `[1][2]` via CitationList; render nothing (not an empty box) if `retrieval=false`.                          |
| Feedback     | 👍/👎 writes `ai_feedback`; 👎 opens a one-line comment.                                                    |
| View Trace   | deep-link to `/traces/$traceId`.                                                                            |
| Replay with… | re-run from this exact input against a different model/prompt; show the diff.                               |

## Inline Mission Cockpit UI contract

When a chat message dispatches an autonomous multi-agent execution mission (`mission_id` is present on the assistant message), the standard text bubble is augmented with an inline progress card (the **Inline Mission Cockpit**). This cockpit hides the raw agent complexity and presents a clean, calm, and interactive status grid aligning with the Cohere editorial light design system:

1. **Header:** Displays a small "Mission Cockpit" mono-label, the mission title, and a status badge with themed color washes (`bg-pale-green` for completed, `bg-rose` for failed, `bg-pale-blue` with pulse for running/dispatched).
2. **Steps List:** A simplified 1-to-N list of planned specialist agent runs (`discovery`, `strategist`, `prd_writer`, `builder`, `orchestrator`). Each row has a progress indicator dot (blinks/pulses active blue when running) and displays the agent's slug and sub-goal.
3. **Governance Gates (Inline Approvals Panel):** When a specialist hits a governance gate (e.g. requires PR creation or issue creation approval), it renders a warning box in `bg-coral/10` with a loud `ShieldAlert` icon. Consequence-first action controls (e.g., `Approve · run` in deep green, `Reject · nothing runs` in coral outline) are displayed inline to prompt immediate action.
4. **Trace Toggle:** A collapsible section "Show/Hide raw trace" allows technical operators to inspect raw hop timelines and thought logs without leaving the conversation pane.
5. **Open Mission Page Link:** A link pointing directly to `/missions/$missionId` with an external link icon to jump into the full detail view if needed.

## Surface color coding

Used in traces and analytics. Starting palette (full authority to refine for a more distinctive look): chat=violet (brand), agent=teal, copilot=amber, prd=indigo, discovery=rose, studio=cyan, brief=gold, judge=slate, embedding=stone. Tokens live as `--surface-*` in `src/styles.css`. Use the tokens, not hardcoded colors.

---

## States, accessibility, anti-patterns

**States (every route renders all three):** Loading — skeletons with glacial pulse; SSE streams show a typing cursor, no skeleton. Empty — friendly instructive copy + one useful CTA, never "No data". Error — per-route `errorComponent` + root default; friendly message + Retry; stack traces never leak; long ops link to `/traces/$traceId` rather than inlining raw errors.

**Accessibility (WCAG 2.2 AA baseline):** 4.5:1 contrast on all foreground/background pairs (spot-check after every token edit via `ecc:a11y-architect`); full keyboard reachability with visual-order tab order + skip-to-content; always-visible `--ring` focus; `aria-label` on every icon-only button; `<th scope>` on tables; reduced motion respected absolutely; color is never the only signal (status uses color + icon + text).

**Anti-patterns (never, no matter how tempting):** decorative gradients over data; confetti; toasts for errors needing attention; modal stacking; hex literals in components; hidden streaming state in `useEffect`; AI messages without the full contract; emoji-as-icon; auto-play sound or theatrical onboarding; "Are you sure?" on reversible actions (offer undo instead).

> When in doubt: build for the working operator at 9pm on a Tuesday. Calm. Fast. Trustworthy. Every screen should reduce cognitive load, not add to it.

---

## Voice & language (non-negotiable)

Canonical rule: [`docs/conventions/ui-voice.md`](./docs/conventions/ui-voice.md). Evidence + audit: [`docs/strategy/archive/v3-audit-language-voice.md`](./docs/strategy/archive/v3-audit-language-voice.md). This section is the contract restatement that authors hit while designing.

**Voice anchor.** Human, clear, lightly playful in safe places (empty states, success toasts). Dry in governance, errors, and destructive flows. Contractions on. Active voice. One idea per sentence. Linear-leaning, warmer in empty states.

**Length budgets.**

| Surface          | Budget        |
| ---------------- | ------------- |
| H1               | ≤ 6 words     |
| Subhead          | ≤ 14 words    |
| Button label     | ≤ 3 words     |
| Tooltip          | ≤ 10 words    |
| Toast            | ≤ 12 words    |
| Empty-state copy | ≤ 2 sentences |

**Banned (AI tells).** Em dashes (`—`) and en dashes (`–`) anywhere in UI copy. Replace with period, comma, parentheses, or a line break. Hyphens stay only inside compound words. Buzzword denylist: _seamlessly · leverage · empower · robust · powerful · next-gen · AI-native · revolutionary · unlock · unleash · delve · navigate the landscape of · at the intersection of · elevate · supercharge · game-changing · cutting-edge_. Also banned: triple-pattern listicles ("faster, smarter, better"), preamble ("In today's…"), hedging in confirms ("might", "could potentially"), filler ("Let's dive in", "Feel free to…"), decorative emoji (🚀 ✨ 🎉), Title Case Everywhere (use sentence case except product/page names), trailing `!`.

**Confirm copy pattern.** Direct, name the effect: _"This deletes 3 missions. Continue?"_, not _"Are you sure you want to proceed?"_. For reversible actions, prefer an Undo toast over a confirm. Confirmation primitives live in [`architecture/frontend.md`](./architecture/frontend.md) (Confirmation, toasts & dialogs).

**Author check before shipping copy.** Run `rg "—|–"` and the buzzword regex against changed files. Voice change → update this section + the audit doc in the same turn.
