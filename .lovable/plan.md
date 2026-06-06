# Documentation closure pass

Goal: leave the doc loop fully true for the work just shipped (language/voice sweep, popup removal, inline workspace/product management, `useConfirm` + ESLint guardrail) and bank durable learnings so the same mistakes don't recur.

No product code changes. Docs + memory only.

## 1. Primary audit doc — expand and cross-link
`docs/strategy/v3-audit-language-voice-2026-06-06.md`
- Add "How to use / verify" block per the Core rule: where each new surface lives (workspace switcher in `AppShell` top-left, product row actions, `useConfirm` API, sonner toasts), server enforcement points (owner-gated server fns, `requireSupabaseAuth`), and a verification checklist (no `alert/confirm/prompt` in `src/**`, ESLint guardrail passes, em-dash count = 0 in swept files, switcher renames without reload).
- Add a "Phased rollout" section: P0 shipped (10 high-traffic screens + primitives), P1 remaining (21 routes), P2 (tooltip + microcopy discipline).
- Add a "Related" block at the bottom linking: `architecture/frontend.md`, `architecture/security.md`, `design.md`, `docs/feature-backlog.md`, `docs/strategy/session-decisions.md`, `plan.md` §4, the prior `v3-audit-2026-06-06.md` and `v3-audit-language-2026-06-06.md`.

## 2. Architecture + design contracts
- `architecture/frontend.md`: add a short "Confirmation, toasts, and dialogs" subsection — rule: no `window.alert/confirm/prompt/open/onbeforeunload`, use `useConfirm()` + `sonner` + shadcn `<Dialog>/<AlertDialog>`; reference the ESLint guardrail and the hook path.
- `architecture/frontend.md`: add "Inline workspace & product management" subsection — switcher location, server fns list, invalidation pattern (no reload), destructive-action typed-name-match rule.
- `design.md`: add "Voice & language" subsection — em/en dash ban, AI-tell buzzword list, length budgets (H1 ≤6, subhead ≤14, button ≤3, tooltip ≤10, toast ≤12), voice anchor (Linear-leaning, warmer empty states), decorative-emoji ban. Link back to the audit doc as the source.
- `architecture/security.md`: one-liner noting workspace mutation server fns are owner-gated via `has_role`/owner check; link the functions.

## 3. Status board + log (closed-loop mandate)
- `docs/feature-backlog.md`: flip `LANG-VOICE-01..04` and `INLINE-MGMT-01..` to the right marks, update Live status board (Last updated, Now building cleared, Recent log entry), and add the "How to use / verify" block per Core rule.
- `plan.md` §4: append a dated one-liner with WHY ("ship voice rules + popup ban + inline mgmt so the product stops sounding like a brochure and stops shoving users to native chrome").
- `docs/strategy/session-decisions.md`: add an entry capturing the three decisions (em-dash → period default, Linear-leaning voice, advisory→shipped F-IDs, typed-name-match for destructive, switcher in top-left popover).
- `docs/strategy/README.md`: index the new audit doc version if not already.

## 4. Learnings → memory (so we don't repeat)
Save as project memory files and reference from `mem://index.md`:
- `mem://constraint/no-native-browser-chrome` — never use `window.alert/confirm/prompt/open/onbeforeunload` or native `<dialog>`; use `useConfirm()` + `sonner` + shadcn. **Why:** breaks theme, breaks keyboard nav, feels un-owned, blocks SSR.
- `mem://constraint/no-em-en-dashes-in-ui` — zero `—` and `–` in user-facing copy; hyphens only inside compound words. **Why:** classic AI tell, reads as generated.
- `mem://preference/voice-anchor` — Linear-leaning, warmer empty states, contractions on, one idea per sentence, length budgets. Buzzword denylist (seamlessly, leverage, empower, robust, powerful, next-gen, AI-native, revolutionary, unlock, unleash, delve, elevate, supercharge, game-changing, cutting-edge, at the intersection of). **How to apply:** run `rg` for the denylist before shipping any copy change.
- `mem://preference/destructive-actions` — typed-name-match for delete workspace/product; `useConfirm()` for all other confirms.
- `mem://feature/inline-workspace-product-mgmt` — switcher top-left of `AppShell`, popover, product rows with `MoreHorizontal` menu, invalidate queries (no full reload).
- `mem://preference/doc-loop-checklist` — after any feature: audit doc "How to use / verify" block, `architecture/*` rule, `design.md` token/voice rule, backlog status + log, `plan.md` §4 one-liner, session-decisions entry, memory file if durable. **Why:** the loop has been closing only partially; this is the explicit checklist.

Update `mem://index.md` Core with two new one-liners: "No native browser chrome (alert/confirm/prompt/open/onbeforeunload) — use useConfirm + sonner + shadcn" and "No em/en dashes in UI copy; kill AI-tell buzzwords per voice anchor."

## 5. Verification before declaring done
- `rg "—|–" src/routes src/components src/lib | rg -v node_modules` on swept files returns 0.
- `rg "window\.(alert|confirm|prompt|open|onbeforeunload)|\\balert\\(|\\bconfirm\\(|\\bprompt\\(" src` returns 0 outside allowlist.
- ESLint passes with the new `no-restricted-globals/syntax` rule.
- Every doc above has a "Related" cross-link block at the bottom.
- `mem://index.md` shows the two new Core lines and 6 new memory references.

## Out of scope
- P1 sweep of the remaining 21 routes (tracked, not executed here).
- Any product/code edits — this pass is doc + memory only.

## Open questions (defaults in brackets — say "go" to accept all)
1. Memory granularity: 6 separate files as above, or collapse into 2 (`constraints` + `voice-feature`)? [6 separate — easier to retrieve individually]
2. Should the voice rules also land in `CLAUDE.md` / `GEMINI.md` / Lovable Knowledge field, or stay solely in `design.md` + audit doc and let the tool pointers reference them? [stay in `design.md`, pointers reference — single source of truth]
3. Add a one-line "voice check" to the PR/commit checklist in `docs/git-discipline.md`? [yes — cheap guardrail]
