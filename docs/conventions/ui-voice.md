# Convention: UI voice & language

> _Created: 2026-06-06 · Last updated: 2026-06-19_

**Voice anchor.** Human, clear, lightly playful in safe places (empty states, success toasts). Dry in governance, errors, and destructive flows. Contractions on. Active voice. One idea per sentence. Linear-leaning, warmer in empty states.

**Length budgets.**

| Surface          | Budget        |
| ---------------- | ------------- |
| H1               | ≤ 6 words     |
| Subhead          | ≤ 14 words    |
| Button label     | ≤ 3 words     |
| Tooltip          | ≤ 10 words    |
| Toast            | ≤ 12 words    |
| Empty-state copy | ≤ 2 sentences |

**Banned (AI tells).**

- **Dashes.** No em (`—`) or en (`–`) dashes in any user-facing string. Replace with period, comma, parentheses, colon, or line break. Hyphens stay only inside compound words (`role-based`, `auto-confirm`).
- **Invisible characters.** No zero-width or exotic-space Unicode (`U+200B`, `U+200C`, `U+200D`, `U+2060`, `U+FEFF`, `U+00A0`, `U+202F`, `U+00AD`, directional marks). They are a silent machine fingerprint. See the umbrella rule [`humanized-output.md`](./humanized-output.md), which also covers generated (AI-output) text and the runtime sanitizer.
- **Buzzwords.** `seamlessly`, `leverage`, `empower`, `robust`, `powerful`, `next-gen`, `AI-native`, `revolutionary`, `unlock`, `unleash`, `delve`, `navigate the landscape of`, `at the intersection of`, `elevate`, `supercharge`, `game-changing`, `cutting-edge`.
- **Patterns.** Triple-pattern listicles (_"faster, smarter, better"_). Preamble (_"In today's…"_). Hedging in confirms (_"might"_, _"could potentially"_). Filler (_"Let's dive in"_, _"Feel free to…"_). Decorative emoji (🚀 ✨ 🎉) in body copy. Title Case Everywhere (sentence case except product/page names). Trailing `!`.

**Confirm copy pattern.** Direct, name the effect: _"This deletes 3 missions. Continue?"_ — not _"Are you sure you want to proceed?"_. For reversible actions, prefer an Undo toast over a confirm.

**How to apply.** Before shipping any copy change:

```bash
rg "—|–" <changed files>     # must return 0
rg -i "seamless|leverage|empower|unlock|delve|at the intersection" <changed files>
```

**Why.** "Remove em dashes" was treated as the whole task; the buzzword list is what actually moves the brand needle. Operator-flagged on 2026-06-06.

## Related

- [`../../DESIGN.md`](../../DESIGN.md) — "Voice & language" contract section (restatement that authors hit when designing).
- [`../strategy/archive/v3-audit-language-voice.md`](../strategy/archive/v3-audit-language-voice.md) — full AI-tell audit + P1 sweep targets.
- [`../strategy/archive/v3-audit-language.md`](../strategy/archive/v3-audit-language.md) — naming integrity matrix, tooltip audit.
