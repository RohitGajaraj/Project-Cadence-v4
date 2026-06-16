# Flow mode (OPS-01)

> A calm operating stance you turn on from the sidebar footer. The chrome
> recedes, an ambient soundscape plays, a focus timer runs, and non-urgent
> notifications wait quietly until you come back. Status: shipped 2026-06-16.

**Engine-Room:** Web Audio decode/loop/crossfade graph + toast hold/summary buffer + countdown internals -> hidden inside `src/lib/flow/*` and `src/lib/notify.ts` (no UI exposes the machinery) -> surfaced to the user as "Flow mode: quiet focus with ambient sound and a timer".

## Why it exists

A one-click way to drop into focused work without leaving the app. It is a near-pure expression of the [Engine-Room Doctrine](../conventions/engine-room-doctrine.md): turning it on makes the workspace quieter, with every moving part (audio graph, notification buffer, timer) behind a single named control.

## How it presents (ambient calm-state)

No new route. Flow mode is a global stance, so per the [home-and-today IA rubric](../conventions/home-and-today-ia.md) it lives in the chrome, not on Today. The control sits in the `AppShell` sidebar footer beside the theme toggle.

- **Idle:** a quiet `Waves` icon. Click opens a small panel: ambient sound (Rain / Ocean / Forest / Lo-fi / Heartbeat / Off), a volume slider, and a focus length (25 / 50 / 90 / Open chips, plus a custom minutes field). "Start focus" begins.
- **Active:** the sidebar and TopBar dim (`html.flow`, lifting back on hover); the icon breathes and shows the remaining time; an inline exit ends it. Main content stays at full strength.
- **Reload:** an in-flight session resumes (state + remaining time). Audio cannot auto-start under the browser autoplay policy, so the panel offers "Resume sound" (one tap re-arms it).

## Ambient sound (real audio)

The first cut synthesized the sound (filtered white noise), which came out harsh. It was replaced with real looped recordings, one file per preset, decoded once and looped without a gap via Web Audio (an HTMLAudioElement loop leaves an audible seam); switching presets crossfades. The files live in `public/soundscape/<preset>.mp3` and are sourced separately (royalty-free / CC0 only, with per-file provenance recorded in `public/soundscape/README.md`) so the repo never carries audio of unknown license. Until a file is present, that preset shows "This sound has no track yet" and stays silent; everything else in Flow mode still works. `start()` resolves a boolean so the UI can show that hint.

## Notification quieting (hold, then summarize)

While flow is on, non-urgent toasts (success / info / message / default) are held silently and replayed as one line on exit: `While you were focused · N updates` (or `Focus block done. N updates ...` when the timer completes). Urgent toasts (`error` / `warning`, or any call passing `{ critical: true }`) always show.

This is implemented as a facade, not by intercepting sonner: `src/lib/notify.ts` re-exports a `toast` with sonner's exact API. Every app file imports `toast` from `@/lib/notify` instead of `sonner`, so the quieting is centralized with no per-call-site changes. The `<Toaster>` (`src/components/ui/sonner.tsx`) and the facade itself still import from `sonner`. New code should import `toast` from `@/lib/notify`.

## Files

| Concern | File |
| --- | --- |
| Notification facade (hold/summary) | `src/lib/notify.ts` (+ `notify.test.ts`) |
| Pure session/timer/preset helpers | `src/lib/flow/session.ts` (+ `session.test.ts`) |
| Real-audio soundscape player (Web Audio buffer loop + crossfade) | `src/lib/flow/soundscape.ts` |
| Audio files (drop-in) | `public/soundscape/*.mp3` (+ `README.md` for sourcing + license) |
| Completion chime | `src/lib/flow/chime.ts` |
| State + persistence (context, localStorage, `html.flow`) | `src/hooks/use-flow-mode.tsx` |
| The control | `src/components/cadence/FlowWidget.tsx` |
| Provider wiring | `src/routes/_authenticated.tsx` |
| Footer placement | `src/components/cadence/AppShell.tsx` |
| Dim treatment + pulse | `src/styles.css` (`html.flow`, `flowBreathe`) |

Preferences persist client-side only (`cadence.flow.config`, `cadence.flow.session`), mirroring how theme and active-workspace are stored. No server table.

## Deferred (not built)

Per-soundscape EQ, a "what I'm focusing on" label, server-synced preferences, a full notification inbox, and a richer (expandable) summary instead of a count line.

## Verify

- Add at least one file (e.g. `public/soundscape/rain.mp3`) per `public/soundscape/README.md`.
- Footer Flow icon -> panel -> pick Rain, set volume, choose 25m or type a custom length, Start. Chrome dims, sound plays, timer counts down.
- A preset with no file shows "This sound has no track yet" and stays silent; the rest still works.
- Fire a success toast: it does not show. Fire an error: it does. Exit: a `While you were focused · N` summary appears.
- Re-enter, reload: session + timer resume; "Resume sound" re-arms audio.
- `prefers-reduced-motion`: the dim is instant, no fade.
