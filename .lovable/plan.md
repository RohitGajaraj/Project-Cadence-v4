## Plan: "Cooking" banner across all authenticated screens

### Copy (locked in)
> **"Agents are building in the back. Your queue loads next."**

### Placement
Inside `AppShell.tsx`, right at the top of the `<main>` content wrapper (`<main className="flex-1 min-w-0">`).
- This makes it visible on every authenticated route without touching the sidebar layout
- On mobile (no sidebar), it spans the full width at the top
- On desktop, it sits cleanly above the content pane, offset from the sidebar rail

### Visual design
- **Height:** compact, ~38–42 px (`h-10`)
- **Background:** `bg-coral` with slight transparency (`bg-coral/90` or `bg-coral` depending on contrast). Coral is the editorial signal color — warm, energetic, on-brand, and unmistakably "pop" without neon flashiness.
- **Text:** `text-primary-foreground` (white/canvas) for strong contrast; `text-xs` or `text-sm`, `font-medium`
- **Icon:** small `Flame` or `Sparkles` (lucide-react, 14 px) to reinforce "cooking" energy
- **Close button:** `X` icon on the far right; `text-primary-foreground/70` hover to full opacity. Clicking it writes a flag to `localStorage` so the banner stays dismissed per browser.
- **Border:** none, or a very subtle bottom hairline (`border-b hairline`) to separate from page content
- **Animation:** optional subtle shimmer (CSS `@keyframes` sliding a highlight across the surface, 2.5s loop). Respects `prefers-reduced-motion`.

### Files to change
1. **`src/components/cadence/CookingBanner.tsx`** — new component with dismiss logic + styling
2. **`src/components/cadence/AppShell.tsx`** — import and render `<CookingBanner />` as the first child inside `<main>`

### Success criteria
- Banner renders on every authenticated route immediately after the top nav/sidebar
- Dismissal persists across navigation and reloads via `localStorage`
- No layout shift; sidebar sticky behavior and `QuickAccessDock` z-index remain intact
- `bun run lint` and `bun run build` pass green
- Copy matches the user's chosen line exactly

Ready to implement once approved.