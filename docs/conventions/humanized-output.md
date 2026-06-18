# Convention: humanized output, zero AI fingerprints

> **What this is.** The master rule that no text we ship carries a machine fingerprint. It governs two levels (see **Priority and scope** below for how strictly each is enforced, and apply it at authoring time):
>
> 1. **What we author.** Every string a human or tool writes into this repo: UI copy, code comments, docs, commit messages, error text, seed data, marketing copy. Applies to every co-development tool equally (Claude Code, Lovable, Gemini, Antigravity, and any future one).
> 2. **What the platform generates.** Every output the product produces for a user through an AI feature: PRDs, drafts, chat replies, research summaries, decision rationales, anything a model writes. The end user's outcome must read as if a sharp human wrote it.
>
> [`ui-voice.md`](./ui-voice.md) is the UI-string application of this rule (length budgets + the buzzword denylist). This file is the umbrella and adds the parts that rule does not cover: it extends scope to all authored text and to runtime-generated output, bans invisible characters, and specifies the runtime enforcement.

---

## Priority and scope (apply at authoring time, read this first)

Write clean from the first keystroke. This rule is an authoring habit invoked **before** you write, not a QA step after. Do not write text with fingerprints and then scan, correct, and rescan it: that four-step cycle wastes time and tokens. Know the banned set up front and just author without them.

Enforcement is tiered (founder ruling, 2026-06-16):

- **Tier 1, hard gate, non-negotiable: platform output and user-facing UI copy.** Anything the product generates or shows an end user (PRDs, chat replies, research summaries, decision rationales, drafts, and the in-app UI strings) is the verbatim that actually matters. The runtime sanitizer at the AI chokepoint (`humanizeText` in `runtime.server.ts`) is the real gate for generated text; UI copy is authored clean.
- **Tier 2, write clean by habit, no enforcement pass: internal docs, code comments, commit messages, build logs.** Write these clean because it is the house style, but they do **not** warrant a dedicated detect-fix-rescan pass or a token spend chasing a stray dash. A residual fingerprint in an internal doc is acceptable; there is no required scan loop and no separate doc-cleanup stage for Tier 2.

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
- **Product texture.** Use our nouns (calls queue, the loop, decision card, Chief of Staff), not stock SaaS nouns. The goal is that a screenshot reads as Cadence and nothing else.

## Level 2: enforce it on runtime AI output (spec)

The platform's generated text must clear the same bar. Two layers, both required:

1. **Instruction layer.** The humanization directive ships inside the system prompt assembled in `src/lib/ai/prompts.server.ts`, so every model call (drafting, chat, research, reflection) is told to write human, avoid the banned fingerprints, and never emit dashes or invisible characters. Cheap, but not sufficient on its own (models drift).
2. **Sanitizer layer (the hard gate).** A pure `humanizeText()` pass runs on model output at the chokepoint (`src/lib/ai/runtime.server.ts`, both `callModel` and the streamed `callModelStream`) before the text reaches the user. It normalizes em/en dashes to honest punctuation, strips every invisible character above, collapses exotic spaces, and trims trailing whitespace. It must not touch fenced code blocks or inline code (a dash inside a code sample is legitimate). For streaming, sanitize on a buffered boundary so a multi-byte sequence is never split.

The sanitizer is the boundary; the prompt directive is convenience. Treat the sanitizer the way `runtime.server.ts` already treats guardrails and cost: a chokepoint everything passes through.

**Status (2026-06-14): wired.** The sanitizer lives in `src/lib/ai/humanize.ts` (pure `humanizeText` + `isFenceOpen`) and runs in `runtime.server.ts` on both `callModel` (output) and `callModelStream` (a line-buffered, fence-aware boundary) for prose responses. JSON responses (`responseFormat: 'json_object'`) are never sanitized, so structured output and the agent loop stay byte-exact. The soft directive is `HUMANIZE_DIRECTIVE` in `prompts.server.ts`. The build-time author-side guard now exists too: `scripts/check-humanized.sh` (warn-only, opt-in to strict) flags banned dashes and invisible characters in staged text additions. See "How to apply" below.

## How to apply (build time)

The runtime sanitizer (above) is the gate for Tier 1 generated output. The `rg` checks below are an **optional** spot-check for Tier 1 surfaces (UI copy, prompt templates) when you want to confirm by hand. They are not a required loop, and not for Tier 2 internal docs (see "Priority and scope"):

```bash
# 1. Dashes: must return 0 (outside code).
rg "—|–" <changed files>

# 2. Invisible characters: must return 0.
rg -nP "[\x{200B}\x{200C}\x{200D}\x{2060}\x{FEFF}\x{00A0}\x{202F}\x{00AD}\x{200E}\x{200F}\x{FFFD}]" <changed files>

# 3. Buzzwords (see ui-voice.md for the full list).
rg -i "seamless|leverage|empower|unlock|delve|elevate|supercharge|cutting-edge|at the intersection" <changed files>
```

A pre-commit / hook check enforcing 1 and 2 on staged text files is the durable backstop. It now exists at `scripts/check-humanized.sh`: it scans the staged diff for the banned dashes and the invisible-character set, skips fenced and inline code, and prints each hit as `file:line`. It is warn-only by default (always exits 0, never blocks a commit) and opt-in to strict with `STRICT=1` (exit non-zero on any hit). Run `scripts/check-humanized.sh` on the staged diff, or pass file paths to scan specific files whole. The ready-to-enable hook config and a plain git pre-commit snippet live in [`../operations/hooks.md`](../operations/hooks.md) (the "Humanized-output guard" section). It is not registered as a live blocking hook yet, in line with the deferred-sweep ruling below.

**The retroactive full-product sweep is deferred to a pre-launch gate (founder ruling 2026-06-14).** The docs were swept 2026-06-14 (README, strategy, feature docs), but existing static product text (UI strings, seed data, components, code-level user-facing copy) is swept once only, when the product is near-final, so churn in screens and features does not force a re-sweep. This is NOT a relaxation of the rule: all new authored text is built clean now, and generated output is already sanitized at runtime by `humanizeText()`. **Cutoff date: 2026-06-14.** The sweep covers only work authored before 2026-06-14 (the date this rule and the `humanizeText()` sanitizer landed); anything built on or after 2026-06-14 is authored under the rule and passes through the runtime sanitizer, so it is treated as already clean and is not re-scanned or re-fixed, to save time and tokens. Claude prompts the founder to run the full scan at that gate. Tracked in [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) (founder pickup list, the pre-launch humanization sweep, section 4).

## Why

Two reasons, both load-bearing. First, trust: AI fingerprints make a product read as low-effort and machine-made, which is the opposite of the craft a PM pays for. Second, the platform's promise is that its *generated* output is good enough to use as-is. A PRD with em dashes and zero-width spaces betrays the machine and breaks that promise. Operator ruling, 2026-06-14.

## Related

- [`ui-voice.md`](./ui-voice.md) - the UI-string application (length budgets, buzzword denylist).
- [`../../design.md`](../../design.md) - the "Voice & language" contract section.
- [`../operations/hooks.md`](../operations/hooks.md) - where the build-time trace check plugs in.
- [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md) - the "look different, not one in a thousand" positioning this serves.
