
## Goal

Keep every Phase 1–2 layout/IA change (6-pillar nav, restructured pages, mono-labels, pill CTAs, research-table rows) but introduce **two switchable themes**:

- **Dark — "Nightshift"** (the original pre-Cohere theme) → **default on first load**
- **Light — "Cohere editorial"** (what's currently in `src/styles.css`) → opt-in via toggle

Toggle lives in the **sidebar footer** in `AppShell.tsx`. Choice persists in `localStorage` (`cadence.theme`).

## Approach

### 1. Restore Nightshift token values into `.dark` block of `src/styles.css`

Current `src/styles.css` only defines the Cohere light palette under `:root`. I'll:

- Keep the entire current `:root` block exactly as-is → this becomes the **light** theme.
- Add a `.dark { ... }` block that overrides the same token names with the **original Nightshift values** (deep near-black canvas, ink-on-dark, violet/cyan/amber/emerald/rose accents, gradient-aurora, ring-glow, neural-gradient as the saturated dark hero, etc.).
- Restore the original decorative utilities (`.neural-gradient`, `.ring-glow-violet`, `.animate-aurora` keyframes content, `.glass`, `.bento` shadows) so they look correct under `.dark` while remaining neutralized under light.

Source for the original values: prior `src/styles.css` from git history (the version before Phase 1 token rewrite).

### 2. Theme runtime

- Add `src/hooks/use-theme.tsx`: reads `localStorage["cadence.theme"]` (`"dark" | "light"`), defaults to `"dark"`, toggles by adding/removing the `dark` class on `<html>`. Applied synchronously in `__root.tsx` before paint to avoid flash.
- Tailwind v4 `@custom-variant dark (&:is(.dark *));` is already in `styles.css`, so `.dark` overrides cascade correctly.

### 3. Sidebar footer toggle

In `src/components/cadence/AppShell.tsx`, add a small Sun/Moon icon button in the sidebar footer area (next to / under the workspace selector). Uses `lucide-react` icons + `mono-label` styling. Tooltip: "Switch to light / Switch to dark".

### 4. Keep everything else

- IA (6 pillars), navigation, page restyles, fonts (Instrument Serif / Inter / JetBrains Mono), Cohere utility classes (`btn-pill`, `mono-label`, `band-deep-green`, `chip-taxonomy`, `rule-hairline`, `link-action`) are unchanged.
- Pages that hardcode light-only colors (e.g. `bg-white`, `text-[var(--ink)]`) remain readable in dark because the semantic tokens (`--ink`, `--canvas`, `--hairline`, `--soft-stone`, `--deep-green`, etc.) will resolve to dark-appropriate values under `.dark`. Anywhere a Phase 2 page used a raw hex or `bg-white` literal, I'll swap to the semantic token in the same pass.

## Technical details

**Files touched:**

- `src/styles.css` — add `.dark { ... }` block with Nightshift values for every token already declared in `:root`; restore real `--gradient-aurora`, `.neural-gradient`, `.ring-glow-violet`, `.animate-aurora` definitions gated to `.dark` (light keeps the neutralized versions).
- `src/hooks/use-theme.tsx` — new file. `ThemeProvider` + `useTheme()` hook.
- `src/routes/__root.tsx` — wrap app in `ThemeProvider`; inline `<script>` in `<head>` sets `.dark` class pre-hydration based on `localStorage` (default dark) to avoid FOUC.
- `src/components/cadence/AppShell.tsx` — add theme toggle button in sidebar footer.
- Sweep Phase 2 pages (`_authenticated.index.tsx`, `briefing.tsx`, `inbox.tsx`, `prds.tsx`, `prds.$id.tsx`) for any `bg-white`, `text-black`, or hex literals introduced and replace with `bg-canvas` / `text-ink` / token equivalents so they flip cleanly.

**Token mapping for `.dark` (Nightshift, restored):**

```text
--canvas         → near-black (oklch ~0.13)
--paper          → var(--canvas)
--paper-elevated → slightly lifted dark
--surface-1/2/3  → layered dark surfaces
--ink            → near-white
--ink-muted      → mid-light slate
--hairline       → subtle dark border
--primary-ink    → light (so btn-pill becomes light-on-dark)
--deep-green     → original violet/indigo brand
--coral          → amber/ember accent
--action-blue    → cyan
--violet/cyan/emerald/amber/rose → original Nightshift palette
--gradient-aurora → original radial violet/cyan saturated gradient
```

**Defaults & persistence:**

- First visit → `dark`.
- User toggle → write `"light"` or `"dark"` to `localStorage`.
- No system-preference auto-follow (user explicitly chose "Dark by default").

**No backend / data changes.** No new dependencies. Purely CSS + a hook + a button.

## Out of scope

- Per-page dark-mode QA of every secondary surface (analytics, traces, governance, etc.). Phase 1 neutralized the legacy decorative classes; this plan restores them under `.dark` so those pages should look correct again, but I won't re-touch each page in this pass. Any leftover hardcoded color literals discovered later get fixed surgically.
- Updating the strategy / backlog markdown beyond a one-line entry noting the dual-theme system.
