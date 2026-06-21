# FND-0.7 — Prompt-injection defense (learned classifier + hard quarantine)

> Status · ◐ Classifier + hard-quarantine seam shipped 2026-06-21 (lane 3); **cross-chunk aggregation (FND-0.7-b) shipped 2026-06-21 (lane 3)**; live on next publish · Route(s): none (runtime, behind the RAG retriever) · Owner: the AI runtime / RAG pipeline

## What it does

Untrusted content that the agent pulls into a prompt (retrieved workspace context, ingested signals, tool output) can carry a prompt-injection payload. The already-shipped first layer wraps that content in an `<untrusted_context_chunk>` fence, XML-escapes it, and tells the model to treat it as passive data. FND-0.7 adds a second layer: a deterministic, offline **classifier** that scores each untrusted chunk for injection likelihood from many weighted lexical and structural signals, and **hard-quarantines** (replaces with a content-free placeholder) any chunk that is an unambiguous in-band injection, before it ever reaches the model.

## Why it exists

Regex-only injection rules (one pattern per `guardrail_rules` row) catch exact strings and miss everything else. FND-0.7 raises the floor from "one regex per rule" to "weighted evidence across the whole message", so paraphrased and multi-signal attacks accumulate score instead of slipping through a single pattern. It is defense in depth layered behind the fence, not the sole defense. Build-log entry: [`../../plan.md`](../../plan.md) §4 (2026-06-21, lane 3).

## Where to find it

Runtime only — there is no operator surface in this increment. The seam fires inside `formatContextBlock` in the RAG retriever every time the agent assembles retrieved context. A quarantined chunk shows up to the model as `<untrusted_context_chunk ... quarantined="true">[quarantined: ...]</untrusted_context_chunk>` and emits a server-side `[injection-defense]` warning (signal names + score, never the content) so over-redaction can be monitored.

## How it works

- **`src/lib/injection-classifier.ts`** (pure, no I/O, no AI): `classifyInjection(text)` returns `{ score, severity, decision, signals }`. The score is `sigmoid(BIAS + Σ weightᵢ·present(featureᵢ))` over ~14 feature detectors (instruction-override, role-reassignment, system-prompt probe, secret exfiltration, exfiltration channel, fence breakout, forged turn marker, tool-invocation lure, destructive action, exfil URL, jailbreak vocabulary, encoding evasion, urgency). Each feature counts as **presence** (cap 1) so repetition never dominates; corroboration across distinct families is what raises the score. Weights are hand-tuned heuristics (this is a weighted-evidence classifier, not a trained model).
- **Decision bands:** `allow` < 0.45 ≤ `flag` < 0.72 ≤ `quarantine`. `quarantineText(verdict)` builds the content-free placeholder; `assessAndQuarantine(text)` swaps it in only for a quarantine decision.
- **Over-redaction guard (the load-bearing design choice):** hard quarantine additionally requires a **structural** signal — a literal fence breakout (`</untrusted_context_chunk>`, `</system>`, …) or a forged `System:`/`Assistant:` turn at line start. Benign first-party prose that merely discusses or quotes an attack (a PRD about "dropping the legacy table", a bug report quoting "ignore previous instructions", a red-team doc) lacks those markers, so it can at most `flag` (kept, still fenced) and is **never stripped**. This is deliberate: silently losing the user's own context is the worst real-world failure for a PM/eng corpus.
- **Homoglyph resistance:** the classifier inspects an NFKC-normalized copy with common Cyrillic/Greek Latin look-alikes folded to ASCII (the stored/embedded content is never altered, only the throwaway scan copy).
- **ReDoS-safe:** every detector uses bounded, non-nested quantifiers and a 20k-char scan cap; the adversarial review confirmed single-digit-ms runtime on hostile input.
- **`src/lib/ai/guardrails-injection.server.ts`** (server-only seam): `quarantineUntrusted(text)` wraps the classifier and is **fail-open** — any internal error returns the original text so the pipeline never breaks. `quarantineUntrustedCorpus(texts[])` (FND-0.7-b) is the corpus-aware wrapper: it runs the per-chunk quarantine AND escalates a structural injection split across an adjacent chunk boundary; also fail-open (on any error every chunk passes through unchanged). It is a wrapper only; it does not modify the existing guardrails engine or the AI chokepoint.
- **Cross-chunk aggregation (FND-0.7-b), `assessCorpusInjection(chunks[])` in the pure classifier:** two passes, both preserving the over-redaction guard. (1) **Adjacent-boundary reconstruction** — a 256-char window straddling each chunk seam is classified; the pair is escalated to quarantine only if that window's decision is `quarantine` (a structural marker AND score ≥ 0.72) **AND it carries a lexical injection signal** (an override / probe / exfil instruction), while neither chunk was quarantined alone. The lexical co-signal requirement is load-bearing: a bare structural tag alone clears the quarantine score by itself, so without it a benign first-party doc that merely mentions a fence tag (`</system>`, `</context>`, `</untrusted_context_chunk>`, …) and is chunked mid-tag would be stripped. A real cross-chunk breakout always pairs the tag with an instruction, so this catches real attacks while never stripping a benign tag mention. (A full tag contained in one chunk is handled by the per-chunk pass — its `decision==="quarantine"` skips the boundary — so this branch only ever sees markers genuinely split across the seam.) (2) **Whole-corpus classification** — the concatenation (length-capped) is scored to surface a distributed lexical instruction spread across chunks; lexical-only corpus evidence only raises a `flag` for observability and never strips content.
- **Accepted residuals (false-negative only; the fence + treat-as-data instruction remain the primary defense, and none can over-redact):** a structural marker whose halves land more than 256 chars from the seam, a marker split three-ways, and an empty/whitespace chunk sitting between the two fragments (it breaks the strict-adjacent pairing).
- **`src/lib/rag/retriever.server.ts`** (`formatContextBlock`): calls `quarantineUntrustedCorpus` once over all chunk contents, then escalation-aware quarantines each chunk. Benign chunk sets are byte-identical to the prior behaviour (no quarantine, no extra attribute). A distributed-corpus `flag` (nothing stripped) emits a separate `[injection-defense] corpus-level …` warning for tuning.

## Governance & guardrails

- Read-only over content; no writes, no AI calls, no spend, no chokepoint edit.
- Fail-open by design (availability over strictness): a classifier fault degrades to today's fence-and-escape behaviour.
- The classifier inspects content only; it never logs raw chunk content (telemetry carries signal names + score).

## Known limitations (documented, not gaps to hide)

- **False negatives:** heavily paraphrased instructions outside the lexical vocabulary score low; the fence + treat-as-data instruction still applies to flagged content.
- **Cross-chunk split:** SHIPPED as **FND-0.7-b** (`assessCorpusInjection`) — a structural injection split across an adjacent chunk boundary is now reconstructed and quarantined, and a distributed lexical instruction across chunks is flagged for observability (never stripped, preserving the over-redaction guard). Residual: a structural payload split across NON-adjacent chunks, or fragments landing >256 chars from the seam, is still not reconstructed (an accepted residual; real splits land at the seam).
- **Flag is not stripped:** flag-class content is embedded unchanged (behind the fence). Quarantine, which strips, is reserved for structural in-band injections.
- **Reactor coverage:** ingested `untrusted_signal` content (`reactor.functions.ts`) is still fence-only; applying `quarantineUntrusted` there is follow-up **FND-0.7-c** (and ingested external content arguably warrants a *more* aggressive bar than first-party RAG).
- **Operator surface:** no governance UI yet to view/tune the classifier; the `/govern` surface owner can wire one later (follow-up **FND-0.7-d**).

## Verification checklist

- [x] `bunx tsc --noEmit` clean; `bun test` green (734 pass, 39 in `injection-classifier.test.ts` incl. 10 cross-chunk FND-0.7-b cases). Build "red" is the known pre-existing Lovable vite-config ESM baseline (config-load fails before any source compiles), not this change.
- [x] Adversarial 3-lens review (security / correctness / integration): 0 blockers; over-redaction guard verified — benign migration/PRD/bug-report/red-team content all `allow`/`flag`, never `quarantine`; FND-0.7-b cross-chunk escalation requires a structural boundary marker at quarantine score, so a benign seam is never stripped.
- [ ] On next publish: confirm a real fence-breakout chunk (and a fence breakout split across two chunks) is quarantined in a live `/chat` answer and a `[injection-defense]` warning is logged; confirm benign retrieved context is unaffected.
