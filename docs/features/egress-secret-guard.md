# Public-egress secret guard

> _Created: 2026-06-21 (Lane 3) · considerations.md Security/CISO "Secret scanning" · Tier 3_

**Status:** ◐ Shipped backend (the floor + the first egress wired + unit-verified); activates on the founder's next publish.

**One line:** a credential pasted into an announcement can no longer be stored (and so can never be published world-readable), because the existing guardrails secret-detection engine now runs as a **floor on the public-egress write path**, not only at the AI chokepoint.

---

## Why this exists (the gap)

The product already has a guardrails engine (`src/lib/ai/guardrails.server.ts` `evaluateGuardrails`) with secret/PII/injection detection and a `/guardrails` UI. But it is wired in exactly one place: the **AI chokepoint** (`runtime.server.ts`), for model input/output. It never sees content on its way to a **public boundary**.

L2 announcements are **anon-readable once published** (the RLS policy `status = 'published'`). So a user could paste a live API key into an announcement body, get it approved, and publish it world-readable, and no guardrail would ever fire. That is a real secret-leak path created by the L2 egress.

This closes it by **reusing** the existing engine (not re-implementing detection) as a write-time floor.

---

## What it does

`src/lib/egress-guardrails.ts`:
- `EGRESS_SECRET_RULES` — a self-contained set of **high-confidence, structural** credential formats (OpenAI `sk-…` legacy + the scoped `sk-(proj|svcacct|admin)-…` forms, AWS `AKIA…`, GitHub `gh[pousr]_…` + `github_pat_…`, Stripe `sk_live_…`, Slack `xox[baprs]-…`, Google `AIza…`, and PEM private-key blocks). Owned here, **not** loaded from the per-workspace `guardrail_rules` table, so the floor holds even for a workspace that never configured guardrails. A security floor must not depend on opt-in config.
- `scanEgressForSecrets(text)` — runs the rules through `evaluateGuardrails` (so the regex matching, ReDoS-safety, and zero-width guarding are the **same** code the chokepoint uses) and returns `{ blocked, ruleNames }`.
- `describeEgressSecrets(ruleNames)` — a user-facing message naming the secret **types** found, never the value.

Wired into `announcements.functions.ts` `createAnnouncement` + `updateAnnouncement`: if the title/body trips the floor, the write is rejected **before** the row is stored.

### The design rule: block only structural patterns (the FND-0.7 lesson)

Every rule is a near-zero-false-positive credential shape, so a hard `block` is safe. The broad OpenAI rule deliberately **excludes hyphens** from its character class: a hyphen breaks the run, so ordinary prose like `risk-management-system-overview` (which contains `sk-management-…`) can never match. The modern hyphenated OpenAI keys are caught by a **separate prefix-anchored rule** (`sk-(proj|svcacct|admin)-`) instead of loosening the broad one. This is the over-redaction discipline carried from the prompt-injection defense: never block on an ambiguous or lexical pattern, only on structure.

### Why the write path is the complete chokepoint

`title`/`body` are written **only** by `createAnnouncement`/`updateAnnouncement`. `submitForApproval` writes only `status`/`submitted_at`; `approveAndPublish` calls the SECURITY DEFINER `publish_announcement` RPC, which only flips `status`/`published_at`. So scanning at create/update covers every path by which content can reach the published, anon-readable state — no re-scan at publish is needed (adversarial-review-confirmed).

---

## Verification

- `tsc --noEmit` 0; `bun test src/lib/egress-guardrails.test.ts` 19 tests (each credential format blocks; benign prose + the `risk-management-…` over-redaction guard do not block; no secret value echoed in the message; rule integrity); full suite green.
- Single-agent security review (`ecc:security-reviewer`): confirmed no publish bypass, no ReDoS, correct `side`/`applies_to`, no value-leak in the error path, no false positives on prose. It flagged one real gap (the broad OpenAI rule missed hyphenated scoped keys) — folded with the **correct** fix (a prefix-anchored rule), NOT the reviewer's suggested broadening of the character class, which would have re-introduced the `risk-management-…` false positive.
- ◐ **live-verify on publish:** attempt to save an announcement containing `sk-…`/`AKIA…` and confirm the write is rejected with a type-named message.

## Follow-ups (logged)

- Apply the same floor at the other egress boundaries: the skill-pack export (`exportSkillpack`, redact rather than block since it is a read), and any future public `p.$slug` render of workspace content.
- A `@nosensitivelog` annotation on `GuardrailHit.matched` in the shared engine so a future caller cannot inadvertently log the 80-char matched value (no current leak; this control never forwards `matched`).

## Related

- [`l2-announcements.md`](./l2-announcements.md) — the egress this guards.
- [`injection-defense.md`](./injection-defense.md) — the over-redaction discipline reused here.
- [`../../architecture/security.md`](../../architecture/security.md) · [`../planning/considerations.md`](../planning/considerations.md) (Security/CISO "Secret scanning").
