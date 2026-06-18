# Active Task (the live cursor)

> Read first (per CLAUDE.md / AGENTS.md). Update in the same unit of work as the change.

## Now: Workspace, Accounts & Tenancy + Monetization initiative (founder-directed 2026-06-19)

- **Build source of truth (per-ID specs):** [`docs/planning/workspace-tenancy-and-monetization-plan.md`](./docs/planning/workspace-tenancy-and-monetization-plan.md)
- **Live board:** group **G10** in [`docs/planning/feature-dashboard.md`](./docs/planning/feature-dashboard.md) · **Queue:** [`docs/planning/SOURCE-OF-TRUTH.md`](./docs/planning/SOURCE-OF-TRUTH.md) section 3
- **Status:** planning + docs landed (build bible + refinements, master/task-sheet registration, BYOK-removal cascade, the MOAT canon `docs/strategy/moat.md`, cross-links). **Credit engine `WM-M10` to `WM-M16` specified + the two monetization threads merged into the build bible (2026-06-19, §4.2.1).** No feature code yet. Branch: `feat/workspace-account-tenancy`.

### Next to pick (critical path; build top-down per G10)
- [ ] **WM-M1** Entitlements core (5 account tiers + matrix). Effort S. No deps. `src/lib/entitlements.ts` (+ test).
- [ ] **WM-F1** Scope agent memory/runs/roster to workspace. Effort L. No deps. New migration + `src/lib/ai/memory.server.ts`.
- [ ] **WM-M2** accounts table + billing relocation + credit/decay migrations. Effort L. Needs WM-M1.
- [ ] **WM-M10** Credit unit + cost-to-credit conversion + legibility layer. Effort S. Needs WM-M1 (no DB). `src/lib/ai/pricing.ts` (+ test). First piece of the credit engine (§4.2.1).
- [ ] then WM-F3 / WM-M5 / WM-F2 / WM-F9 (parallel), then WM-F4/F5 + WM-M3/M4, then WM-F7/F8 + WM-M6/M7/M8/M9 (M9 = remove self-serve BYOK), then WM-F6. The **credit engine** (`WM-M10` to `WM-M16`, plan §4.2.1) builds on the `WM-M4` seam + `WM-M2` pool: `WM-M10` can start with `WM-M1`; `WM-M12` (the debit engine) is the keystone once the seam exists, then `WM-M13`/`M14`/`M16`, with `WM-M15` (margin levers) any time after `WM-M10`.

### Hard gates (every tool, every commit)
`bun run lint` + `tsc --noEmit` + `bun run build` green before commit. No em/en dashes. RLS-aware timestamped migrations. Branch off `main`; explicit-path commits with a WHY.

### Deferred (do NOT build now)
WM-S1..S5 (showcase: sample workspace, guided tour, onboarding concierge, steward, demo population). Gate: platform ~50 to 60 percent complete. Resurface at each milestone.

### Founder gates (need you; see plan §7)
Crescendo/Galaxy prices; Stripe secrets for WM-M3; flip `credits_enabled()` when the credit engine lands; confirm the final tier display names + motif (Constellation is the default).
