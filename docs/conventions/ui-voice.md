# Convention: UI voice & language

**Voice anchor.** Human, clear, lightly playful in safe places (empty states, success toasts). Dry in governance, errors, and destructive flows. Contractions on. Active voice. One idea per sentence. Linear-leaning, warmer in empty states.

**Length budgets.**

| Surface | Budget |
|---|---|
| H1 | ≤ 6 words |
| Subhead | ≤ 14 words |
| Button label | ≤ 3 words |
| Tooltip | ≤ 10 words |
| Toast | ≤ 12 words |
| Empty-state copy | ≤ 2 sentences |

**Banned (AI tells).**

- **Dashes.** No em (`—`) or en (`–`) dashes in any user-facing string. Replace with period, comma, parentheses, colon, or line break. Hyphens stay only inside compound words (`role-based`, `auto-confirm`).
- **Buzzwords.** `seamlessly`, `leverage`, `empower`, `robust`, `powerful`, `next-gen`, `AI-native`, `revolutionary`, `unlock`, `unleash`, `delve`, `navigate the landscape of`, `at the intersection of`, `elevate`, `supercharge`, `game-changing`, `cutting-edge`.
- **Patterns.** Triple-pattern listicles (*"faster, smarter, better"*). Preamble (*"In today's…"*). Hedging in confirms (*"might"*, *"could potentially"*). Filler (*"Let's dive in"*, *"Feel free to…"*). Decorative emoji (🚀 ✨ 🎉) in body copy. Title Case Everywhere (sentence case except product/page names). Trailing `!`.

**Confirm copy pattern.** Direct, name the effect: *"This deletes 3 missions. Continue?"* — not *"Are you sure you want to proceed?"*. For reversible actions, prefer an Undo toast over a confirm.

**How to apply.** Before shipping any copy change:

```bash
rg "—|–" <changed files>     # must return 0
rg -i "seamless|leverage|empower|unlock|delve|at the intersection" <changed files>
```

**Why.** "Remove em dashes" was treated as the whole task; the buzzword list is what actually moves the brand needle. Operator-flagged on 2026-06-06.

## Related

- [`../../design.md`](../../design.md) — "Voice & language" contract section (restatement that authors hit when designing).
- [`../strategy/v3-audit-language-voice-2026-06-06.md`](../strategy/v3-audit-language-voice-2026-06-06.md) — full AI-tell audit + P1 sweep targets.
- [`../strategy/v3-audit-language-2026-06-06.md`](../strategy/v3-audit-language-2026-06-06.md) — naming integrity matrix, tooltip audit.