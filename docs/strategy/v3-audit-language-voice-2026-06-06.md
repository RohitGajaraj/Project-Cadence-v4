# v3 Audit — Language, Voice, Popups & Inline Workspace Management

Date: 2026-06-06 · Companion to `v3-audit-2026-06-06.md` and `v3-audit-language-2026-06-06.md`.
Status: P0 execution landed. P1 sweep open.

## 1. Mandate

Three coordinated course-corrections, in one pass:

1. Strip every AI-tell from user-facing copy (em dashes are one symptom, not the whole list).
2. Kill every browser-native popup (`alert`, `confirm`, `prompt`, unload blockers). Everything happens in-app.
3. Make workspace and product management inline. Operators should never leave the surface they're on to rename, switch, or remove something.

## 2. Voice

Human, clear, lightly playful where it's safe (empty states, confirmations). Dry in governance, errors, and destructive flows. Contractions on. Active voice. One idea per sentence.

Length budgets:
- H1 ≤ 6 words. Subhead ≤ 14. Button ≤ 3. Tooltip ≤ 10. Toast ≤ 12.

## 3. The full AI-tell list (banned)

Em dashes (`—`) and en dashes (`–`) are the most visible tell, but these patterns leak the same machine flavor and all go:

| Tell | Replace with |
|---|---|
| `—`, `–` in UI strings | period, comma, parentheses, line break, or rewrite |
| "It's not just X, it's Y" / "not only… but also" | one direct sentence |
| "In today's fast-paced world…", "In the era of…" | delete preamble, start with the verb |
| "Seamlessly", "leverage", "empower", "robust", "powerful", "next-gen", "AI-native", "revolutionary", "unlock", "unleash", "delve", "navigate the landscape of", "at the intersection of", "elevate", "supercharge", "game-changing", "cutting-edge" | concrete verb or delete |
| "Let's dive in", "Let's explore", "Ready to…?", "Imagine…" | delete |
| "I hope this helps", "Feel free to…", "Don't hesitate to…" | delete |
| "As an AI…", "I'm just an AI…", "I cannot…" anywhere it leaked into strings | rewrite as product voice |
| Triple-pattern listicles ("faster, smarter, better") | one specific claim |
| Over-hedging in confirms ("might", "could potentially", "may help you") | direct ("This deletes 3 missions. Continue?") |
| Decorative emoji in body copy | remove (icon components only) |
| Title Case Everywhere | sentence case (except product/page names) |
| Trailing `!` | period |
| 🚀 / ✨ / 🎉 sprinkles in toasts | remove |

Lint guardrail: planned regex sweep in CI as P1. For now, code review enforces.

## 4. Popup sweep (P0 — landed)

Every `window.alert`, `window.confirm`, `window.prompt`, and bare `confirm(...)/prompt(...)` call has been replaced. Future ones are blocked at lint time.

### Primitives added

- `src/hooks/use-confirm.tsx` — exports `ConfirmProvider`, `useConfirm()`, `usePrompt()`. Promise-based, themed via shadcn `AlertDialog` and `Dialog`, keyboard-friendly, focus-trapped. Supports `destructive` styling and `typedConfirm` (type the name to enable the button).
- Provider mounted once in `src/routes/__root.tsx` inside `ThemeProvider`.

### ESLint guardrail (added)

`eslint.config.js` now bans the four globals (`alert`, `confirm`, `prompt`, `window.onbeforeunload`) with a clear error message pointing to `useConfirm` / `usePrompt` / `toast`. New popup calls fail lint.

### Call sites replaced

| File | Before | After |
|---|---|---|
| `src/components/cadence/AppShell.tsx` | `window.prompt` (new workspace) | `usePrompt` dialog |
| `src/components/cadence/AppShell.tsx` | `window.prompt` (new product) | `usePrompt` dialog |
| `src/components/cadence/AppShell.tsx` | `window.confirm` (delete product) | `useConfirm` with typed-name guard |
| `src/routes/_authenticated.evals.tsx` | `confirm()` × 2 (delete suite, delete case) | `useConfirm` |
| `src/routes/_authenticated.guardrails.tsx` | `confirm()` (delete rule) | `useConfirm` |
| `src/routes/_authenticated.docs.tsx` | `window.prompt` (Google Docs import) | `usePrompt` |
| `src/routes/_authenticated.docs.tsx` | `window.prompt` (icon picker) | `usePrompt` |
| `src/routes/_authenticated.docs.tsx` | `window.confirm` (delete doc) | `useConfirm` |
| `src/components/cadence/DocEditor.tsx` | `window.prompt` × 3 (link, figma toolbar, figma slash) | `usePrompt` |

### Rules going forward

- Destructive flows: `useConfirm({ destructive: true })`. For workspace/product delete, also pass `typedConfirm: name`.
- Non-blocking feedback: `toast.success / toast.error` from sonner.
- Inputs: `usePrompt({ title, label, placeholder })`. For richer forms, build a proper `Dialog` — `usePrompt` is for one-field cases.
- Unsaved-changes guards: TanStack Router `useBlocker` wired to `useConfirm`. (Not yet needed; will land when the first form needs it.)

## 5. Inline workspace & product management (P0 — landed)

### Server functions added

- `src/lib/workspaces.functions.ts`: `renameWorkspace`, `deleteWorkspace`, `leaveWorkspace`, `listWorkspaceMembers`, `removeWorkspaceMember`. All RLS-scoped (owner-only manage, member-only read).
- `src/lib/projects.functions.ts`: added `updateProject` (name, north_star, target_date, status).

### UI changes in `AppShell`

- Workspace switcher (top-left popover) now has a Manage section: Rename, Workspace settings, Leave, Delete. All inline.
- Each product row in the sidebar gets a `MoreHorizontal` dropdown: Set active, Rename, Delete. The bare trash icon is gone.
- Destructive workspace and product deletes require typed-name confirmation.
- All flows produce sonner toasts, never browser popups.

### Rules going forward

- Any "manage X" affordance lives in a dropdown next to the item, or a sheet that opens over the current page. Never a separate route just to delete or rename.
- Owners can't leave their own workspace. The server rejects it with a clear message; the UI surfaces it as a toast.

## 6. Em-dash sweep (P1 — open)

Em dashes are still present in many UI strings (login subhead, Today brief empty state, AppShell comments, agent roster blurbs). P1 batch will sweep these route-by-route:

- `/login`, `/signup`, `/forgot-password`, `/reset-password`
- `/` (Today): empty states, brief copy, agent rail
- `/agents`, `/missions`, `/swarm`, `/approvals`
- `/traces`, `/evals`, `/governance`, `/guardrails`, `/budgets`, `/drift`
- Public `/p/*` pages

Each sweep records before/after in this doc.

## 7. Out of scope (still)

- Product rename ("Cadence") — flagged in main v3 audit.
- IA restructure from 31 → 12 routes — main v3 audit, separate decision.
- Invite-by-email — needs a server function with admin lookup of `auth.users` by email; deferred to P2 with workspace settings sheet.
- Billing surfaces.
- Localisation.

## 8. Verification

- `rg "window\.(alert|confirm|prompt)|^\s*(alert|confirm|prompt)\("` across `src/` returns zero hits (only a comment in `use-confirm.tsx`).
- ESLint config blocks future regressions.
- Workspace switcher and product dropdowns render in preview; every action confirms via in-app dialog or toast.

## Related

- `docs/strategy/v3-audit-2026-06-06.md` — main audit.
- `docs/strategy/v3-audit-language-2026-06-06.md` — prior language pass.
- `architecture/frontend.md` — UI contract.
- `design.md` — tokens and AI message contract.