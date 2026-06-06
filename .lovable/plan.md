# Make project memory cross-tool durable

## The problem

The 6 memory files I just created live at `mem://…` — Lovable's private virtual filesystem. They are:
- Not in `git`, so Claude Code / Antigravity / Gemini never see them.
- Not referenced from `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or the Lovable Knowledge field.
- Only the `mem://index.md` Core lines are auto-injected, and only into Lovable sessions.

Result: the rules ("no native browser chrome", "no em dashes", voice anchor, destructive-action pattern, inline-mgmt feature, doc-loop checklist) will silently disappear the moment another tool picks up the repo. The cross-tool contract in `AGENTS.md` §10 is broken.

## The fix: one git-tracked conventions home, referenced from every tool's entry point

### 1. Create `docs/conventions/` — the canonical, git-tracked home for durable rules

```
docs/conventions/
├── README.md                      # index + how to add a new convention
├── ui-voice.md                    # voice anchor, length budgets, AI-tell denylist (mirrors mem://preference/voice-anchor + mem://constraint/no-em-en-dashes-in-ui)
├── ui-chrome.md                   # no native chrome rule + useConfirm/usePrompt/sonner contract (mirrors mem://constraint/no-native-browser-chrome)
├── destructive-actions.md         # typed-name match pattern + copy patterns (mirrors mem://preference/destructive-actions)
├── inline-management.md           # workspace/product inline mgmt feature (mirrors mem://feature/inline-workspace-product-mgmt)
└── doc-closure-checklist.md       # the 8-step per-feature checklist (mirrors mem://preference/doc-loop-checklist)
```

Each file is short, one rule, one "Why", one "How to apply", and a "Related" cross-link block. These become the **source of truth**; `mem://` becomes a thin per-tool cache that points to the git file.

### 2. Wire into the four tool entry points

- **`AGENTS.md` §3 Engineering rules** — add 3 new one-liners with links to `docs/conventions/ui-chrome.md`, `docs/conventions/ui-voice.md`, `docs/conventions/destructive-actions.md`. Add row to §5 update matrix ("Voice / UI-chrome / destructive change → update `docs/conventions/*`").
- **`AGENTS.md` §1 Pre-action protocol** — add `docs/conventions/` to "scan first" list.
- **`CLAUDE.md`** — add `docs/conventions/` to the read-order list (after `docs/strategy/`).
- **`GEMINI.md`** — same one-line addition.
- **Lovable Knowledge field block at the end of `AGENTS.md` (the section starting `CADENCE — LOVABLE KNOWLEDGE`)** — add `docs/conventions/` to the "SPECIFIC LOOKUPS" table and to "SOURCE OF TRUTH HIERARCHY".

### 3. Update `docs/README.md` index — add the `conventions/` folder row so future agents can find it.

### 4. Reduce `mem://` to thin pointers, not duplicate content

Rewrite each of the 6 `mem://` files to a 2-line body that points to the git file:

```
This rule lives in docs/conventions/ui-chrome.md. Always read that file; never edit content here.
```

This way:
- Lovable's auto-injected Core line still applies in my sessions.
- The substance lives in git, so every tool sees it.
- No drift risk from two copies — `mem://` explicitly defers to git.

Keep `mem://index.md` Core lines as-is (they're terse one-liners, useful as a constant nudge inside Lovable).

### 5. Tie the audit doc + architecture docs to `docs/conventions/`

- `architecture/frontend.md` "Confirmation, toasts & dialogs" and "Inline workspace & product management" subsections — add `docs/conventions/ui-chrome.md` and `docs/conventions/inline-management.md` as the canonical rule sources; this file is the contract, conventions is the standalone rule.
- `design.md` "Voice & language" — link `docs/conventions/ui-voice.md` as the canonical rule, with the section here as the contract restatement.
- `docs/strategy/v3-audit-language-voice-2026-06-06.md` — add `docs/conventions/` to its Related block.

### 6. Add a one-liner to `docs/conventions/README.md` and to `AGENTS.md` §5 about the loop

When a memory-worthy rule is identified in any tool:
1. Write it as a `docs/conventions/<name>.md` file (git-tracked).
2. Reference it from `AGENTS.md` §3 if it's a hard engineering rule.
3. Optionally mirror to `mem://` as a thin pointer for Lovable's auto-injection.

That order — git first, then memory — guarantees cross-tool visibility.

## Out of scope

- No product code changes.
- No new behavior — only the rules' *home* changes.
- Existing `mem://` index Core lines stay (they're terse and useful inside Lovable).

## Verification

- `ls docs/conventions/` shows 6 files.
- `rg "docs/conventions" AGENTS.md CLAUDE.md GEMINI.md docs/README.md` returns hits in every file.
- Each `mem://` file body is ≤ 3 lines and points to its `docs/conventions/` twin.
- A fresh Claude Code session reading only `CLAUDE.md` → `AGENTS.md` would land on the voice + UI-chrome rules without ever touching `mem://`.

## Open questions (defaults in brackets — say "go" to accept all)

1. Folder name: `docs/conventions/` or `docs/rules/`? [`conventions/` — softer, fits "voice anchor" and "checklist" entries that aren't strict rules]
2. Should I also fold the conventions into `AGENTS.md` §3 directly (one-line per rule with link) rather than create a folder? [keep folder — §3 stays scannable; the folder holds the *why* and *how to apply*]
3. After this lands, should I run a sweep for any other Lovable-only state (project knowledge field, etc.) that should also be mirrored to git? [yes, but as a follow-up — out of scope here]
