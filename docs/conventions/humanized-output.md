# Convention: humanized output, zero AI fingerprints

> **What this is.** The master rule that no text we ship carries a machine fingerprint. It governs two levels, and both are mandatory:
>
> 1. **What we author.** Every string a human or tool writes into this repo: UI copy, code comments, docs, commit messages, error text, seed data, marketing copy. Applies to every co-development tool equally (Claude Code, Lovable, Gemini, Antigravity, and any future one).
> 2. **What the platform generates.** Every output the product produces for a user through an AI feature: PRDs, drafts, chat replies, research summaries, decision rationales, anything a model writes. The end user's outcome must read as if a sharp human wrote it.
>
> [`ui-voice.md`](./ui-voice.md) is the UI-string application of this rule (length budgets + the buzzword denylist). This file is the umbrella and adds the parts that rule does not cover: it extends scope to all authored text and to runtime-generated output, bans invisible characters, and specifies the runtime enforcement.

---

## The rule

Ship text that reads human and reads like *this* product. Two failure modes are banned: the **fingerprint** (mechanical tells that say "a model wrote this") and the **template** (generic phrasing that reads like one in a thousand AI apps). Remove the first. Beat the second with a point of view.

## Banned fingerprints (remove every one)

**Punctuation.**
- No em dash (`—`) or en dash (`–`) anywhere in shipped or generated text. Replace with a period, comma, colon, parentheses, or a line break. Plain hyphens stay only inside compound words (`role-based`, `auto-confirm`) and code.
- No "smart" dash sequences as separators. No trailing `!`. No `...` filler.

**Invisible and look-alike characters.** These are the silent giveaway. Strip them entirely:
- Zero-width: `U+200B` zero-width space, `U+200C` ZWNJ, `U+200D` ZWJ, `U+2060` word joiner, `U+FEFF` BOM / zero-width no-break.
- No-break and exotic spaces: `U+00A0` non-breaking space, `U+202F` narrow no-break, the range `U+2002` to `U+200A` (en, em, thin, hair spaces). Use a normal space.
- Soft hyphen `U+00AD`. Directional marks `U+200E` / `U+200F`. Replacement char `U+FFFD`.
- No trailing whitespace, no double spaces, no stray tabs in prose.

**Phrasing and structure (the template tells).**
- Buzzwords: the full denylist lives in [`ui-voice.md`](./ui-voice.md) (`seamless`, `leverage`, `empower`, `robust`, `unlock`, `delve`, `elevate`, `supercharge`, `cutting-edge`, and the rest). Do not duplicate it here. Honor it everywhere, not just in UI.
- Triple-pattern listicles ("faster, smarter, better"). Preamble ("In today's fast-paced world"). Hedging in confirms ("might", "could potentially"). Filler ("Let's dive in", "Feel free to", "It's worth noting that", "Certainly!"). Decorative emoji in body copy. Title Case Everywhere (use sentence case except product and page names).
- Over-uniform rhythm: every sentence the same length, every paragraph three sentences, every list exactly three items. Human writing varies.

## What "humanized and distinctive" means (do this)

- **Vary the rhythm.** Mix short and long sentences. Let a one-word line land.
- **Concrete over abstract.** Name the thing, the number, the effect. "This deletes 3 missions" beats "This action may affect your data."
- **Have a point of view.** The product has a voice (see `ui-voice.md`: clear, lightly playful in safe places, dry in governance and errors). Generic neutrality is the tell.
- **Product texture.** Use our nouns (calls queue, the loop, decision card, Chief of Staff), not stock SaaS nouns. The goal is that a screenshot reads as Circuit and nothing else.

## Level 2: enforce it on runtime AI output (spec)

The platform's generated text must clear the same bar. Two layers, both required:

1. **Instruction layer.** The humanization directive ships inside the system prompt assembled in `src/lib/ai/prompts.server.ts`, so every model call (drafting, chat, research, reflection) is told to write human, avoid the banned fingerprints, and never emit dashes or invisible characters. Cheap, but not sufficient on its own (models drift).
2. **Sanitizer layer (the hard gate).** A pure `humanizeText()` pass runs on model output at the chokepoint (`src/lib/ai/runtime.server.ts`, both `callModel` and the streamed `callModelStream`) before the text reaches the user. It normalizes em/en dashes to honest punctuation, strips every invisible character above, collapses exotic spaces, and trims trailing whitespace. It must not touch fenced code blocks or inline code (a dash inside a code sample is legitimate). For streaming, sanitize on a buffered boundary so a multi-byte sequence is never split.

The sanitizer is the boundary; the prompt directive is convenience. Treat the sanitizer the way `runtime.server.ts` already treats guardrails and cost: a chokepoint everything passes through.

## How to apply (build time)

Before shipping any text change (code, copy, docs, generated-output prompts):

```bash
# 1. Dashes: must return 0 (outside code).
rg "—|–" <changed files>

# 2. Invisible characters: must return 0.
rg -nP "[\x{200B}\x{200C}\x{200D}\x{2060}\x{FEFF}\x{00A0}\x{202F}\x{00AD}\x{200E}\x{200F}\x{FFFD}]" <changed files>

# 3. Buzzwords (see ui-voice.md for the full list).
rg -i "seamless|leverage|empower|unlock|delve|elevate|supercharge|cutting-edge|at the intersection" <changed files>
```

A pre-commit / hook check enforcing 1 and 2 on staged text files is the durable backstop (see [`../operations/hooks.md`](../operations/hooks.md)). The existing backend, written before this rule, gets a one-time full sweep (tracked separately, run as a codebase-wide pass).

## Why

Two reasons, both load-bearing. First, trust: AI fingerprints make a product read as low-effort and machine-made, which is the opposite of the craft a PM pays for. Second, the platform's promise is that its *generated* output is good enough to use as-is. A PRD with em dashes and zero-width spaces betrays the machine and breaks that promise. Operator ruling, 2026-06-14.

## Related

- [`ui-voice.md`](./ui-voice.md) - the UI-string application (length budgets, buzzword denylist).
- [`../../design.md`](../../design.md) - the "Voice & language" contract section.
- [`../operations/hooks.md`](../operations/hooks.md) - where the build-time trace check plugs in.
- [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md) - the "look different, not one in a thousand" positioning this serves.
