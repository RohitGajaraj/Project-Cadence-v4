# Convention: working-tree hygiene (no clutter at the root)

> _Created: 2026-06-16 · Last updated: 2026-06-16_

> Standing rule. The repo working tree stays clean: no images at the root or `docs/` top level, and no macOS FS-duplication artifacts anywhere. Every captured image has one logical home by scenario with a retention window, and stray images + `" 2"`-style duplicates are swept by one janitor. This is enforced, not advisory.

## Why this exists

Tools (Playwright, the verify and run skills, the browser MCP) capture screenshots constantly, and a case-insensitive macOS filesystem plus cloud sync quietly create `<name> 2.<ext>` duplicates. Left alone they pile up in the working tree the founder sees (one sweep found nine loose PNGs at the root, 444 scratch files in `.playwright-mcp/`, and `agentdb 2.rvf` / `agentdb.rvf 2.lock` dups). Git already ignores most of it, so version control stays clean, but the local tree clutters. This convention fixes the local hygiene: where each image goes, how long it stays, and how the tree self-cleans, both for images and for FS-dup artifacts.

## The hard rules

1. **No image at the repo root. No image at the `docs/` top level.** When you capture a screenshot, always pass an explicit path into the right bucket below. Never use a bare filename (it lands in the current directory, which is usually the root). Strays are swept into `docs/screenshots/verify/`.
2. **No macOS FS-duplication artifacts.** Files or directories named `<name> 2.<ext>` or `<name> 2` (a space + digit inserted before the extension or at the end) are case-insensitive-FS / sync junk. Never edit, import from, or `cd` into them (see CLAUDE.md). The janitor removes them, but only when the canonical `<name>.<ext>` / `<name>` exists, so a legitimately-named file is never deleted.

## Where each image goes (scenario to location)

| Scenario | Location | Committed? | Retention |
| --- | --- | --- | --- |
| Automated test / verify run (Playwright, the verify skill) | `docs/screenshots/verify/` | No (local) | 14 days, then auto-purged |
| Browser MCP default scratch (`browser_take_screenshot` with no path) | `.playwright-mcp/` (hidden) | No (local) | 7 days, then auto-purged |
| Documenting a shipped feature / app UI (for a feature doc or demo) | `docs/screenshots/app-ui/` | No (local) | Kept (no auto-purge) |
| Per-screen design-port reference | `docs/screenshots/screen-<n>/` | No (local) | Kept |
| Before / after a fix | `docs/screenshots/fixes/` | No (local) | Kept |
| Design inspiration / reference | `docs/screenshots/reference/` | No (local) | Kept |
| Build-in-public capture | `docs/screenshots/brand-feed/` | No (local) | Kept (feeds the brand engine; see [[brand-feed-capture-rule]]) |
| Canonical design reference a parallel build must match | `design-reference/**` | **Yes (committed)** | Permanent |
| Anything at the repo root or `docs/` top level | swept to `docs/screenshots/verify/` | No | 0 (immediate) |

`design-reference/**` is the ONLY place a committed image belongs (one curated image per screen, never a bulk dump). Everything under `docs/screenshots/` is local-only by design.

## Retention policy (how long things stay)

- **Ephemeral (auto-purged by the sweep):** `docs/screenshots/verify/` at 14 days; `.playwright-mcp/` at 7 days. Override per-run via `SCREENSHOT_VERIFY_RETENTION_DAYS` / `SCREENSHOT_MCP_RETENTION_DAYS`.
- **Durable but local (kept, never committed):** `docs/screenshots/{app-ui,reference,fixes,screen-*,misc,design-refs,brand-feed}`. These document the product; prune by hand when a screen is retired.
- **Committed and permanent:** `design-reference/**`.
- **Zero tolerance (swept on sight):** the repo root, the `docs/` top level, and every `" 2"`-style FS-dup artifact.

## How it is enforced (three layers)

1. **`.gitignore`** ignores `*.png` / `*.jpg` / `*.jpeg` / `*.gif` / `*.webp`, `docs/screenshots/`, `.playwright-mcp/`, and the recurring `" 2"` dups that actually occur (the `agentdb*` state files, `src/routeTree.gen 2.ts`), re-including only `design-reference/**`. So no stray image enters git; the janitor (layer 2) removes any other `" 2"` artifact from the working tree.
2. **`scripts/clean-workspace.sh`** (`bun run clean:workspace`) is the janitor: it relocates root / `docs`-top-level image strays into `verify/`, purges the ephemeral buckets past retention, and removes `" 2"` FS-dup artifacts whose canonical twin exists. Idempotent and safe (never `design-reference/`, `public/`, `src/` assets, or the durable buckets). Safe to run any time.
3. **A Claude Code Stop hook** (one line in `.claude/settings.json` that calls the janitor at session end, so the tree self-heals without anyone remembering to). This is the one piece still pending: editing `.claude/settings.json` is gated as agent self-modification, so it needs the founder's explicit approval or a `/update-config` pass. Until it is wired, run `bun run clean:workspace` by hand. Layers 1 and 2 are already in force.

## When you capture a screenshot

- Pass an explicit path into the right bucket, for example `docs/screenshots/verify/login-step-1.png`, not `login-step-1.png`.
- If you only need it to debug right now, `docs/screenshots/verify/` (or the MCP default) is correct; it will be purged automatically.
- If it documents a shipped surface for a feature doc, put it in `docs/screenshots/app-ui/` and reference it from the doc.
- Only commit an image if it is a canonical `design-reference/` asset.

## Related

- [`README.md`](./README.md) (conventions index)
- [`../README.md`](../README.md) § "Repository map & file-placement policy" (the parent anti-rot rule)
- [`../../CLAUDE.md`](../../CLAUDE.md) (the `" 2"`-suffixed FS-dup-artifact rule: never edit / import / `cd` into them)
- [`../../.gitignore`](../../.gitignore) (the ignore rules)
- `scripts/clean-workspace.sh` (the janitor)
