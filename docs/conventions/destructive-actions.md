# Convention: Destructive action pattern

**Rule.**

| Action class | Pattern |
|---|---|
| Delete workspace · delete product · any irreversible action with peer impact | `useConfirm({ destructive: true, typedConfirm: <exact name> })`. Operator types the exact name; action button stays disabled until match. |
| Other destructive flows (delete eval case, delete guardrail rule, delete doc, delete mission) | `useConfirm({ destructive: true })`. No typed-name required. |
| Reversible flows (archive, hide, mark complete) | No confirm. Show an Undo toast for ~5s. |

**Copy pattern.** Name the effect. *"This deletes 3 missions. Continue?"* — not *"Are you sure you want to proceed?"*.

**Why.** One operator-typed string is the difference between "I deleted the wrong workspace" and a non-issue. Cheap insurance. "Are you sure?" on reversible actions is an anti-pattern (see [`../../design.md`](../../design.md) anti-patterns) — Undo respects flow.

**How to apply.** When introducing a delete/remove flow:

1. Decide: irreversible with peer impact → typed-name; destructive but scoped → confirm; reversible → Undo toast.
2. Use `useConfirm` from [`../../src/hooks/use-confirm.tsx`](../../src/hooks/use-confirm.tsx) (never `window.confirm`, see [`./ui-chrome.md`](./ui-chrome.md)).
3. Apply the voice rules from [`./ui-voice.md`](./ui-voice.md) to the confirm copy.

## Related

- [`./ui-chrome.md`](./ui-chrome.md) — `useConfirm` / `usePrompt` primitives.
- [`./inline-management.md`](./inline-management.md) — workspace/product delete flows that already follow this pattern.
- [`../../architecture/security.md`](../../architecture/security.md) — server-side owner gating for destructive workspace/product mutations.