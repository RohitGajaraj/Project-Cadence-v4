# Convention: screenshot and image placement (no clutter at the root)

> Standing rule. Images never live at the repo root or at the `docs/` top level. Every captured image has exactly one logical home by scenario, an explicit retention window, and an automatic sweep so the working tree never accumulates clutter. This is enforced, not advisory.

## Why this exists

Tools (Playwright, the verify and run skills, the browser MCP) capture screenshots constantly. Left unmanaged they spill into the repo root and pile up (one sweep found 444 scratch files in `.playwright-mcp/` and nine loose PNGs at the root). Git already ignores them, so they never pollute version control, but they clutter the local tree the founder works in. This convention fixes the local hygiene: where each image goes, how long it stays, and how the tree self-cleans.

## The one hard rule

**No image at the repo root. No image at the `docs/` top level.** Both are swept into `docs/screenshots/verify/` by `scripts/clean-screenshots.sh` (run it with `bun run clean:screenshots`; it is safe any time). When you capture a screenshot, always pass an explicit path into the right bucket below. Never use a bare filename (it lands in the current directory, which is usually the root).

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
- **Zero tolerance:** the repo root and `docs/` top level. Swept on sight.

## How it is enforced (three layers)

1. **`.gitignore`** ignores `*.png` / `*.jpg` / `*.jpeg` / `*.gif` / `*.webp` and `docs/screenshots/` and `.playwright-mcp/` repo-wide, re-including only `design-reference/**`. So no stray image ever enters git.
2. **`scripts/clean-screenshots.sh`** relocates root / `docs/`-top-level strays into `verify/` and purges the ephemeral buckets past retention. Idempotent and safe (only touches images in scratch / ephemeral locations; never `design-reference/`, `public/`, `src/`, or the durable buckets). Run it any time with `bun run clean:screenshots`.
3. **A Claude Code Stop hook** (one line in `.claude/settings.json` that calls the sweep at session end, so the tree self-heals without anyone remembering to). This is the one piece still pending: editing `.claude/settings.json` is gated as agent self-modification, so it needs the founder's explicit approval or a `/update-config` pass. Until it is wired, run `bun run clean:screenshots` (the same sweep) by hand. Layers 1 and 2 are already in force.

## When you capture a screenshot

- Pass an explicit path into the right bucket, for example `docs/screenshots/verify/login-step-1.png`, not `login-step-1.png`.
- If you only need it to debug right now, `docs/screenshots/verify/` (or the MCP default) is correct; it will be purged automatically.
- If it documents a shipped surface for a feature doc, put it in `docs/screenshots/app-ui/` and reference it from the doc.
- Only commit an image if it is a canonical `design-reference/` asset.

## Related

- [`README.md`](./README.md) (conventions index)
- [`../README.md`](../README.md) § "Repository map & file-placement policy" (the parent anti-rot rule)
- [`../../.gitignore`](../../.gitignore) (the ignore rules)
- `scripts/clean-screenshots.sh` (the sweep)
