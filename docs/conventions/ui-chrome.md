# Convention: No native browser chrome

**Rule.** Never use `window.alert`, `window.confirm`, `window.prompt`, `window.open`, `window.onbeforeunload`, or the native HTML `<dialog>` element anywhere in `src/**`. ESLint enforces this in [`../../eslint.config.js`](../../eslint.config.js) (`no-restricted-globals` + `no-restricted-syntax`). Allow-listed exception: [`../../src/lib/error-page.ts`](../../src/lib/error-page.ts) (pre-bootstrap fallback only).

**Use instead.**

| Need                        | Use                                                     | Where                                                          |
| --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Confirm                     | `useConfirm()`                                          | [`src/hooks/use-confirm.tsx`](../../src/hooks/use-confirm.tsx) |
| Typed-name confirm          | `useConfirm({ destructive: true, typedConfirm: name })` | same                                                           |
| One-field prompt            | `usePrompt()`                                           | same                                                           |
| Multi-field / richer dialog | shadcn `<Dialog>`                                       | `src/components/ui/dialog.tsx`                                 |
| Non-blocking feedback       | `toast.success` / `toast.error` from `sonner`           | global                                                         |
| Errors that need attention  | inline shadcn `<Alert>`                                 | `src/components/ui/alert.tsx`                                  |
| Unsaved-changes guard       | TanStack Router `useBlocker` wired to `useConfirm`      |                                                                |
| Cross-route navigation      | TanStack `<Link>` / `navigate()`                        | not `window.open`                                              |

`ConfirmProvider` is mounted once in [`../../src/routes/__root.tsx`](../../src/routes/__root.tsx) inside `ThemeProvider`.

**Why.** Native chrome breaks the theme, breaks keyboard nav, blocks SSR, and reads as "the team didn't finish this." It was an operator-flagged trust blocker on 2026-06-06.

**How to apply.** Before shipping any new dialog/confirm/prompt, search the codebase for the primitive first. If `useConfirm`/`usePrompt` doesn't fit, build a shadcn `<Dialog>` — never reach for the native API.

**Verify.**

```bash
rg "window\.(alert|confirm|prompt|open|onbeforeunload)|\balert\(|\bconfirm\(|\bprompt\(" src
```

Should return zero hits outside the allow-list.

## Related

- [`../../architecture/frontend.md`](../../architecture/frontend.md) — "Confirmation, toasts & dialogs" (contract restatement + primitive paths).
- [`./destructive-actions.md`](./destructive-actions.md) — typed-name match pattern for irreversible deletes.
- [`../strategy/archive/v3-audit-language-voice-2026-06-06.md`](../strategy/archive/v3-audit-language-voice-2026-06-06.md) §4 — the popup sweep (12 call sites replaced).
