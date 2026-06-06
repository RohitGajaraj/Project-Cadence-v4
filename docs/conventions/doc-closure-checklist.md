# Convention: Doc-closure checklist (per feature)

**Rule.** After any shipped feature or strategic decision, in the SAME turn, run this 8-step checklist. A change is not done until every step is true.

1. **Audit / feature doc** — add a "How to use / verify" block: route + nav path, what each control does, server enforcement points, verification checklist.
2. **`architecture/*.md`** — add or update the relevant contract (frontend pattern, security invariant, data shape, runtime hook).
3. **`design.md`** — add or update the token / voice / UI-contract entry if the feature touches visual or copy rules.
4. **`docs/feature-backlog.md`** Live status board — flip the status mark, update "Last updated", append a "Recent log" one-liner.
5. **`plan.md` §4** — append a dated one-liner with a clear WHY (not just WHAT).
6. **`docs/strategy/session-decisions.md`** — add an entry if a strategic decision or tradeoff was resolved.
7. **`docs/conventions/`** — write a new convention file if the learning is a durable rule. Reference it from [`../../AGENTS.md`](../../AGENTS.md) §3 if it is a hard engineering rule.
8. **Cross-links** — add a "Related" block at the bottom of any new doc.

**Optional.** Mirror to tool-private memory (`mem://`, Claude project memory, etc.) only as a *thin pointer* (≤ 2 lines, "see `docs/conventions/<file>.md`"). Never duplicate body — that creates drift.

**Why.** The loop has historically closed at steps 4–5 and stopped, leaving contracts silent. The next session then reintroduces the exact thing the feature removed (a `confirm()`, an em dash, a settings-route-for-rename). This checklist is the antidote.

## Related

- [`../../AGENTS.md`](../../AGENTS.md) §5 — Cross-document update protocol (matrix view of the same idea).
- [`./README.md`](./README.md) — how to add a new convention.