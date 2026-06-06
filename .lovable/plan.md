## Goal

One coordinated pass that course-corrects three things at once:

1. **Strip every AI-tell** from user-facing copy (em dashes are one symptom; there are more).
2. **Kill every browser-native popup** (`alert`, `confirm`, `prompt`, `window.confirm`, `beforeunload` blockers) and replace with in-app Dialog / Sheet / Drawer / Sonner.
3. **Inline workspace & product management** — add "more actions" and settings inside the workspace/product switcher so operators never leave the surface they're on.

Doc-first (audit + spec), then a tightly-scoped execution pass on the P0 items so you can see the change land in the preview.

---

## Part A — Language & "AI-tell" sweep

### What we strip (the full tell list, not just em dashes)

| Tell | Replace with |
|---|---|
| Em dash `—` and en dash `–` | period, comma, parentheses, line break, or rewrite |
| "It's not just X, it's Y" / "not only… but also" | one direct sentence |
| "In today's fast-paced world…", "In the era of…" | delete the preamble, start with the verb |
| "Seamlessly", "leverage", "empower", "robust", "powerful", "next-gen", "AI-native", "revolutionary", "unlock", "unleash", "delve", "navigate the landscape of", "at the intersection of", "elevate", "supercharge", "game-changing", "cutting-edge" | concrete verb or delete |
| "Let's dive in", "Let's explore", "Ready to…?", "Imagine…" | delete |
| "I hope this helps", "Feel free to…", "Don't hesitate to…" | delete |
| "As an AI…", "I'm just an AI…", "I cannot…" anywhere it leaked into UI strings | rewrite as product voice |
| Triple-pattern listicles ("faster, smarter, better") | one specific claim |
| Over-hedging ("might", "could potentially", "may help you") in confirmations and errors | direct ("This deletes 3 missions. Continue?") |
| Decorative emoji in body copy | remove (keep only icon components) |
| Title Case Everywhere | sentence case (except product/page names) |
| Trailing exclamation marks | period |
| "🚀 / ✨ / 🎉" sprinkled in toasts | remove |

### Voice we keep

Human, clear, lightly playful in safe spots (empty states, confirmations), dry in governance and errors. Contractions on. Active voice. One idea per sentence. Length budget: H1 ≤ 6 words, subhead ≤ 14, button ≤ 3, tooltip ≤ 10, toast ≤ 12.

### Method

1. `rg "—|–"` across `src/routes`, `src/components`, `src/lib/**`, `src/routes/p.*.tsx`, `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`.
2. `rg -i` for the buzzword list above.
3. Read each hit in context before rewriting (no blind sed).
4. Capture every change in the audit doc with before/after.

### Deliverable

`docs/strategy/v3-audit-language-voice-2026-06-06.md` — voice rules, full tell list, em-dash sweep table, buzzword kill list, before/after for the 10 highest-traffic screens, microcopy patterns for empty states / toasts / errors / confirms.

---

## Part B — No browser popups, ever

### What we hunt and replace

| Browser API | Replacement |
|---|---|
| `window.alert(...)` | `toast()` from `sonner` (info/success) or in-app `<Alert>` banner |
| `window.confirm(...)` | shadcn `<AlertDialog>` with named action button |
| `window.prompt(...)` | shadcn `<Dialog>` with `<Input>` + form |
| `window.open(...)` for our own routes | TanStack `<Link>` or `navigate()` |
| `window.onbeforeunload` / unload prompts | in-app "Unsaved changes" `<AlertDialog>` triggered by router `beforeLoad` / blocker |
| Native file pickers triggered with no UI context | in-app `<Dialog>` shell around `<input type="file">` with clear cancel |
| Native `<dialog>` element | shadcn `<Dialog>` (themed, focus-trapped, animated) |
| Auth provider redirect-only flows where popup mode is configurable | in-app routed flow |

### Method

1. `rg -n "window\.(alert|confirm|prompt|open|onbeforeunload)\b|\balert\(|\bconfirm\(|\bprompt\("` across `src/`.
2. For each hit: classify (destructive confirm / info / form / navigation / unload-guard), pick the replacement, log it in the audit, then fix it.
3. Add a lint guardrail: ESLint rule `no-restricted-globals` and `no-restricted-syntax` to forbid `alert`, `confirm`, `prompt`, `window.alert`, `window.confirm`, `window.prompt`, `window.onbeforeunload` in `src/**/*.{ts,tsx}` (allowlist `src/lib/error-page.ts` if needed).
4. Standardise on two primitives so future code doesn't drift:
   - `useConfirm()` hook wrapping `<AlertDialog>` — returns a promise, so call sites read like `if (await confirm({ title, body, destructive: true })) …`.
   - `toast.*` from `sonner` for non-blocking feedback.
5. Add `useBlocker` from TanStack Router for unsaved-changes guards, wired to the same `useConfirm()`.

### Deliverable

- `src/hooks/use-confirm.tsx` (new) — promise-based, themed, keyboard-friendly.
- ESLint rule added to `eslint.config.js`.
- All current popup call sites converted in the same pass.
- Audit table in the language-voice doc listing every replaced call site.

---

## Part C — Inline workspace & product management

### What's missing today

`use-workspace.tsx` exposes workspaces + products and an active selector, but there is no inline UI to rename, switch with confirmation, invite members, manage products, archive, or open settings without leaving the page. Today users have to navigate to `/settings` (and even there, product CRUD is thin).

### What we add (all inline, all in `AppShell`)

A single **Workspace / Product switcher** in the top-left of `AppShell` that opens a popover, not a new page. Inside the popover:

**Workspace section**
- Active workspace row with avatar, name, role chip.
- Switch to another workspace (instant, no full reload — TanStack Query invalidates).
- "More" menu (DropdownMenu inside the popover):
  - Rename workspace (in-app Dialog).
  - Workspace settings (in-app Sheet with tabs: General, Members, Billing-stub, Danger).
  - Invite members (in-app Dialog with email + role).
  - Leave workspace (AlertDialog confirm via `useConfirm`).
  - Delete workspace — owner only (AlertDialog confirm, typed-name guard).
- "Create workspace" at the bottom (in-app Dialog).

**Product section (scoped to active workspace)**
- List of products with active checkmark.
- Each row has a `MoreHorizontal` button (DropdownMenu):
  - Rename (inline edit or Dialog).
  - Edit details (Sheet: name, north star, target date, status).
  - Archive / unarchive.
  - Delete (typed-name confirm).
- "New product" CTA (in-app Dialog) — wires to existing `createProject`.

### Server functions to add / extend

Most of these already exist or are one-liners on top of existing patterns; we'll wire them as `*.functions.ts` with `requireSupabaseAuth`:

- `renameWorkspace`, `inviteWorkspaceMember`, `removeWorkspaceMember`, `leaveWorkspace`, `deleteWorkspace` (owner-gated via RLS / role check)
- `updateProject` (rename + details), `archiveProject`, `deleteProject` (already exists; keep)
- `listWorkspaceMembers`

RLS already scopes by `workspace_id` + role; we add policies only if a check is missing. No new tables expected — `workspaces`, `workspace_members`, `projects` already cover this.

### UX rules

- Every action confirms via `useConfirm()` — never `window.confirm`.
- Every destructive action requires typed name match.
- Switching workspace/product updates URL state and invalidates queries; no full page reload.
- Toasts via `sonner` for success/failure feedback.

### Deliverable

- `src/components/cadence/WorkspaceSwitcher.tsx` (replaces whatever lives in `AppShell` today for this affordance).
- `src/components/cadence/WorkspaceSettingsSheet.tsx`.
- `src/components/cadence/ProductActionsMenu.tsx`.
- `src/lib/workspaces.functions.ts` (new), extensions to `src/lib/projects.functions.ts`.
- Wired into `AppShell.tsx`.

---

## Execution order (so you see value fast)

**Phase 1 — Audit doc + foundations (single turn)**
1. Write `docs/strategy/v3-audit-language-voice-2026-06-06.md` with: voice rules, full AI-tell list, em-dash sweep table (every hit + rewrite), popup sweep table (every hit + replacement), workspace/product UX spec.
2. Add `src/hooks/use-confirm.tsx`.
3. Add ESLint guardrail against `alert`/`confirm`/`prompt`.

**Phase 2 — P0 execution pass (next turn, gated on you saying "go")**
4. Replace every `alert/confirm/prompt` call site with `useConfirm` / toast / Dialog.
5. Sweep em dashes + the AI-tell list across the 10 highest-traffic screens (login, Today, Swarm, Agents, Missions, Approvals, Traces, Evals, Governance, Settings) and the public `/p/*` + auth screens.
6. Ship `WorkspaceSwitcher` + `WorkspaceSettingsSheet` + `ProductActionsMenu` + new server functions.

**Phase 3 — P1 cleanup (follow-up turn)**
7. Sweep remaining 21 routes for em dashes + AI-tells.
8. Tooltip discipline pass.
9. Microcopy patterns rolled into shared components (empty state, error boundary, approval gate).

**Closed doc loop on every turn**: update `docs/feature-backlog.md` Live status board, append to `plan.md` §4, log in `docs/strategy/session-decisions.md`.

---

## Out of scope (this plan)

- Product rename ("Cadence") — flagged in main v3 audit, not touched here.
- IA restructure from 31 → 12 routes — that lives in the main v3 audit and is its own decision.
- Localisation.
- Billing surfaces (the workspace settings "Billing" tab is a stub label, not a real integration).

---

## One last check before I switch to build mode

I'm assuming these defaults from your message; flag now if any are wrong, otherwise I'll proceed:

1. **Confirm UX**: `useConfirm()` returns a promise, keyboard-navigable, focus-trapped, themed via shadcn — fine?
2. **Workspace switcher position**: top-left of `AppShell` (where the brand sits), single popover for both workspace + product — fine, or do you want product as a separate switcher?
3. **Destructive actions**: require typed name match (e.g. type the workspace name to delete) — fine, or simple confirm?

Default if you stay silent: yes to all three.
