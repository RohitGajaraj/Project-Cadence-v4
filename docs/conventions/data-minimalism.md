# Convention: Data minimalism — every field earns its place

> _Created: 2026-06-18 · Last updated: 2026-06-18_

**Status: standing rule, founder ruling 2026-06-18.** Applies to every captured field, stored column, and pixel of screen real estate, across the whole build. It is the data-and-input sibling of the [Engine-Room Doctrine](./engine-room-doctrine.md): the doctrine keeps the _machinery_ off the front; this rule keeps _unearned data capture and clutter_ off it.

> Shorthand: **capture nothing by default.** A field exists only because a named consumer needs it. If the honest answer to "where is this used?" is "it just gets stored," the field does not ship.

## The law

We do not capture, ask for, render, or store anything unless it delivers value. The default is **no field, no input, no stored datum, no extra step**. Every single word, field, and piece of screen real estate must earn its place by delivering value to the user — not by sitting in a column "in case."

Capturing data that nobody consumes is never free. It costs:

- **the user's time and attention** — every field is a few seconds and a small decision, spent before they reach value;
- **trust and friction** — each unexplained ask makes the product feel heavier and more bureaucratic;
- **storage and money** — we pay to store and carry data forever;
- **privacy surface** — data we hold is data we must protect and could leak;
- **maintenance** — every field is code, migrations, types, and review weight that never pays itself back.

So the burden of proof is on _adding_ a field, never on omitting one.

## The failure mode it prevents (name it so you catch it)

**Form creep / data-pack-rattery.** The instinct to "grab it while we're here" — collect role, company size, team, use-case, phone, referral source on signup because a form is already open. Left unchecked, onboarding becomes a survey, the profile table fills with columns no surface reads, and the user pays the friction with no return. The moment a field is added without a consumer, form creep has started.

## The Value Test (apply to every field, input, column, and screen element)

Ask, before adding anything:

1. **What value does this deliver, and to whom?** Name it in one sentence (user-facing or operational).
2. **Where is it consumed?** Point to the exact surface, prompt, behavior, or report that reads it. Not "the profile" — the specific place it changes what the user sees or what the system does.
3. **Does it change anything if absent?** If the experience is identical without it, it fails the test.

If you cannot answer 2 with a real consumer, **do not capture it.** Capture it later, in the same change that introduces the consumer.

## The wiring rule (the hard gate)

**A captured field ships in the same change as its consumer.** You may not land "collect X now, use X later." If the screen/prompt/behavior that reads X is not in the same PR, X is not added. This is what keeps the test honest — it forces the value to be real and present, not promised.

## The future-use clause (the only exception, and it is narrow)

Speculative capture is allowed **only** when there is a _named, credible, documented_ near-term consumer — not a vague "might be useful someday." If you capture ahead of the consumer, you must, at the point of capture:

- name the specific future feature that will read it and why it must be collected now rather than then (e.g. it is unrecoverable later, or backfill is impossible);
- write that justification next to the field (code comment + the relevant feature/spec doc).

Absent that, the default wins: do not capture. "It might be useful in future" without a named consumer is form creep wearing a nicer coat.

## How this composes with the calm front

This rule and the [Engine-Room Doctrine](./engine-room-doctrine.md) point the same direction: the user meets only what they act on. The doctrine hides _mechanism_; this rule removes _unearned asks and storage_. Together: the front is calm because nothing on it — visible control or captured field — exists without delivering value. Pair with [`home-and-today-ia.md`](./home-and-today-ia.md) (where a surface belongs) and [`ui-voice.md`](./ui-voice.md) (every word is tight) — both are this rule applied to placement and copy.

## How to apply

On any form, input, migration column, settings field, or panel: run the Value Test, then satisfy the wiring rule. If a field fails, cut it. When in doubt, capture less — the cost of omitting a field is a later one-line addition wired to its consumer; the cost of capturing a dead field is paid by every user, forever, until someone notices and removes it.

## Worked example — the onboarding `role` field (2026-06-18)

The first cut of the onboarding basic-details step captured first name, last name, **and role**. Audit against this rule:

- **Name** passes: it is shown (the greeting addresses the user; the AppShell chip; it signs decisions). Real, immediate consumer.
- **Role** fails: tracing every reader showed it was never mapped to anything — no role-based agent config, no settings, no feature gating. Its only "use" was being incidentally swept into the 6000-char chat-grounding JSON blob alongside the rest of the profile. The persona that actually customizes the workspace is the **onboarding track selector** (Solo PM / Founding PM / Tech Founder), which seeds different data — not a free-text role string.

So `role` was removed from the capture step. It returns only when a real consumer is designed (e.g. role-based agent tone or examples), wired in the same change. Result: the step asks only for the name, the user is a few seconds faster, and nothing dead is stored. (Build log: [`../../plan.md`](../../plan.md) §4, 2026-06-18.)

## Related

- [`engine-room-doctrine.md`](./engine-room-doctrine.md) — the first UX law (calm front, deep engine); this is its data-capture sibling.
- [`home-and-today-ia.md`](./home-and-today-ia.md) — the same discipline applied to surface placement (Today is not a dashboard).
- [`ui-voice.md`](./ui-voice.md) / [`humanized-output.md`](./humanized-output.md) — the same discipline applied to words (length budgets, no filler).
- [`../../Ai_Cofounder.md`](../../Ai_Cofounder.md) ("Complexity exists in the engine, not in the user experience") and [`../../AGENTS.md`](../../AGENTS.md) §4 (behavioral guidelines: "Nothing speculative").
