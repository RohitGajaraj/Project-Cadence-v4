# LCH-01 / L1 (launch-kit drafting)

> _Created: 2026-06-18 · Last updated: 2026-06-18_

**Status:** ◐ Partial (drafting shipped 2026-06-18; a full launch *mission* template + governed outbound send remain). **Lane:** G4 Launch & Learn.

## What it delivers

On the Build **Changes** tab (the build detail, `/build/$missionId`), a **"Launch kit"** panel turns a shipped changeset into five ready-to-use launch artifacts in one click:

- **Changelog** (one or two factual lines)
- **Blog** (120 to 180 words)
- **Email** (subject + 80 to 120 word body)
- **Social** (three short variants: Twitter, LinkedIn, a team channel)
- **Docs** ("How to use it", 100 to 150 words)

Each is shown with a **copy** button. It is **draft-only**: nothing is sent. Outbound delivery (email/social/changelog publish) is a separate, founder-gated step, so this stays safe to run unattended.

## How it works

`generateLaunchKit({ changesetId })` in `src/lib/studio.functions.ts`:
- Reads the changeset (`title`, `summary`, `release_notes`), its changed files, and the linked mission's goal as grounding.
- One `callModel` pass (`surface: "studio"`, JSON mode) drafts all five artifacts, instructed to ground every claim only in the provided material (no invented features/numbers).
- Runs each artifact through `humanizeText` so the JSON-mode output (which the runtime humanizer skips for structured values) still clears the no-AI-fingerprint gate.
- Returns the `LaunchKit` object. **Ephemeral**: no persistence, no migration, no `CallSurface` change (reuses `studio`); regenerate any time.

UI: `ChangesPanel.tsx` holds the result in local state and renders the copyable panel beside the K1 release notes; the panel appears once the changeset has release notes or commits.

## Files

- `src/lib/studio.functions.ts` - `generateLaunchKit` + `LaunchKit` type.
- `src/components/studio/ChangesPanel.tsx` - the Launch kit panel.

## Verify (live, after publish)

1. Open a Build session with a committed changeset that has release notes. Click **Draft launch kit**; confirm five grounded artifacts render, each copyable, with no em dashes / AI clichés.
2. Confirm nothing is sent (drafts only) and that **Redraft** regenerates.

## Not built (LCH-01 remainder)

- A launch *mission* template (one mission orchestrates the whole launch end to end).
- Governed outbound send (publish changelog / send email / post social) behind approval gates - founder-gated (accounts + spend + outward-facing).
