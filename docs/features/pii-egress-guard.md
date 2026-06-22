# Public-egress PII floor (SEC-PII-EGRESS)

> _Created: 2026-06-22 · Status: built + gate-green; live-verifies on the founder's next publish_

## What it does

A security floor that refuses to **store** an announcement whose title/body contains
**high-confidence customer PII** — a Luhn-valid credit-card number or a structurally valid
US SSN — because announcements (L2) are **anon-readable** via RLS once published. It is the
PII sibling of [SEC-EGRESS-GUARD](./egress-secret-guard.md) (the secret floor) and shares the
same write-path drive points, so a public surface can never leak a secret **or** customer PII.

## Where it runs

`src/lib/announcements.functions.ts` → `createAnnouncement` + `updateAnnouncement`, right after
the existing secret scan: `scanEgressForPii(title + body)`; if blocked, the write throws
`describeEgressPii(types)` **before** the row is stored. Non-chokepoint; no founder input.

**Breadcrumb:** Engine Room / wherever announcements are authored → try to save an announcement
containing `123-45-6789` or `4242 4242 4242 4242` → it is refused with a type-named message.

## The over-redaction discipline (why a hard block is safe)

Per the FND-0.7 lesson, we block ONLY on structurally-validated, near-zero-false-positive PII:

- **Credit cards** are confirmed by the **Luhn checksum** in code (`luhnValid`), not a bare
  `\d{16}` regex — so an order id / hash chunk / random 16-digit number does **not** trip it.
- **US SSNs** require the canonical dashed `NNN-NN-NNNN` shape **and** pass the SSA validity
  rules (no `000`/`666`/`9xx` area, no `00` group, no `0000` serial) — so a date range
  (`2026-06-22`), a phone (`555-123-4567`, which is `\d{3}-\d{3}-\d{4}`), or a part number does
  not trip it.
- **Emails and phone numbers are deliberately excluded** — they legitimately appear in public
  changelogs ("contact support@acme.com"), so blocking them would be over-redaction.

The scan is pure, dependency-free, ReDoS-safe (bounded quantifiers), idempotent, totally
defined (malformed input never throws), and never returns or logs the PII **value** (only the
type). Verified by `src/lib/pii-egress.test.ts` (14 tests: Luhn precision, SSN validity,
benign-prose/email/phone/date non-matches, both-types, value-no-leak, idempotence).

## Known accepted trade-off

A user who deliberately writes a Luhn-valid test card (e.g. "use card 4242 4242 4242 4242") in
an announcement body is blocked. This is rare, recoverable (the message names the type so they
can rephrase), and the security value (blocking real card leaks on a public surface) outweighs
it. The system "Test mode" banner is not a user announcement and is unaffected.

## Remaining (not blocking)

Other public-egress surfaces (shareable Critic-teardown links, public product pages) could reuse
`scanEgressForPii` the same way; announcements is the established floor and the highest-risk
free-text public write today. Optional future: a config to downgrade block → warn per workspace.
