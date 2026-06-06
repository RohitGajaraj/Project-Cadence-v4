# docs/conventions — Durable, cross-tool rules

> **What this is.** The git-tracked, source-of-truth home for durable conventions every tool (Claude Code · Antigravity · Gemini · Lovable) must follow. One rule per file. Short. With a clear *why* and *how to apply*.
>
> **Why a folder, not memory?** Tool-private memory (Lovable's `mem://`, Claude's project memory, etc.) is invisible to other tools and is not in `git`. The repo is the only shared substrate ([`../../AGENTS.md`](../../AGENTS.md) §10). Rules live here so every tool sees them. Tool-private memory may *mirror* a rule for fast injection, but the body of the rule lives here.

## Conventions

| File | Rule |
|---|---|
| [`ui-chrome.md`](./ui-chrome.md) | No native browser chrome (`alert/confirm/prompt/open/onbeforeunload`, native `<dialog>`). Use `useConfirm()` / `usePrompt()` + `sonner` + shadcn. |
| [`ui-voice.md`](./ui-voice.md) | Voice anchor, length budgets, AI-tell denylist, em/en dash ban. |
| [`destructive-actions.md`](./destructive-actions.md) | Typed-name match for irreversible deletes; `useConfirm` for other destructive flows; Undo over confirm for reversible ones. |
| [`inline-management.md`](./inline-management.md) | Workspace + product management is inline (popover / dropdown / sheet), never a dedicated route. |
| [`doc-closure-checklist.md`](./doc-closure-checklist.md) | The 8-step per-feature checklist that closes the documentation loop. |

## How to add a new convention

1. **Write the rule here first.** One file per rule, in this folder. Format: rule · why · how to apply · related.
2. **Reference it from the canonical contracts** that already touch the topic — `architecture/*.md`, `design.md`, `docs/feature-backlog.md`. The contract restates the rule and links here for the *why*.
3. **Wire it into the entry points** so every tool lands on it: add a one-liner to [`../../AGENTS.md`](../../AGENTS.md) §3 (engineering rules) and a row to [`../../AGENTS.md`](../../AGENTS.md) §5 (cross-document update protocol).
4. **Optional: mirror to tool memory** as a *thin pointer* (≤ 2 lines, "see `docs/conventions/<file>.md`"). Never duplicate the body — drift will follow.
5. **Update this index** with the new row.

## Why this folder exists

On 2026-06-06 the operator caught that durable rules were being saved to Lovable-only `mem://` files that other tools never see. This folder is the fix: rules in git, referenced from every entry point, tool memory thinned to pointers.

## Related

- [`../../AGENTS.md`](../../AGENTS.md) §3 (engineering rules) · §5 (cross-document update protocol) · §10 (cross-tool co-development).
- [`../../CLAUDE.md`](../../CLAUDE.md) · [`../../GEMINI.md`](../../GEMINI.md) · [`../../.lovable-config.txt`](../../.lovable-config.txt) — tool entry points.
- [`../strategy/v3-audit-language-voice-2026-06-06.md`](../strategy/v3-audit-language-voice-2026-06-06.md) — the audit that produced the first batch of conventions here.