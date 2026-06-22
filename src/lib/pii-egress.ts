// Public-egress high-sensitivity PII floor (SEC-PII-EGRESS).
//
// Sibling of `egress-guardrails.ts` (the secret floor). The same gap applies to PII: a
// user can paste a customer's SSN or credit-card number into an announcement body and
// publish it world-readable (L2 announcements are anon-readable via RLS), and nothing
// stops it. A secret leak and a customer-PII leak on a public surface are the same class
// of harm, so they share the same write-path floor.
//
// Discipline (the FND-0.7 over-redaction lesson, applied strictly): we BLOCK only on
// near-zero-false-positive, STRUCTURALLY-VALIDATED PII. That is the whole reason this is
// PII-egress and not "PII everywhere":
//   - Credit cards are validated by the LUHN checksum, not a bare \d{16} regex, so a
//     random 16-digit id / order number / hash chunk does not trip it.
//   - SSNs require the canonical dashed `NNN-NN-NNNN` shape AND pass the SSA validity
//     rules (no 000/666/9xx area, no 00 group, no 0000 serial), so a date range or a
//     part number does not trip it.
// Emails and phone numbers are DELIBERATELY excluded: they legitimately appear in public
// changelogs ("contact support@acme.com"), so blocking them would be over-redaction.
// A hard `block` is only safe because every rule here is unambiguous.
//
// Pure + dependency-free + totally defined: malformed input never throws, no PII VALUE is
// ever returned or logged (only the TYPE), and scanning is idempotent.
//
// Spec: docs/features/pii-egress-guard.md

/** PURE. Luhn (mod-10) checksum over a digit string. False for empty / non-digit input. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48; // '0' === 48
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * PURE. True only for a STRUCTURALLY VALID US SSN per the SSA allocation rules:
 * area 001-899 except 666, group 01-99, serial 0001-9999. The dashed shape is required
 * by the caller's pattern; this validates the numeric ranges so a date or part number
 * in `NNN-NN-NNNN` shape does not count.
 */
export function isValidSsn(area: string, group: string, serial: string): boolean {
  const a = Number(area);
  const g = Number(group);
  const s = Number(serial);
  if (a === 0 || a === 666 || a >= 900) return false;
  if (g === 0) return false;
  if (s === 0) return false;
  return true;
}

export type PiiEgressScan = {
  /** True when at least one high-confidence PII rule matched. */
  blocked: boolean;
  /** The DISTINCT PII TYPES found (e.g. "credit card", "US SSN"). Never the value. */
  types: string[];
};

// Candidate credit-card runs: 13-19 digits, optionally grouped by single spaces/hyphens.
// We then strip separators and confirm with Luhn, so the regex is intentionally loose
// (catch the candidate) and Luhn is the precision gate (reject non-cards).
const CC_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g;
const SSN = /\b(\d{3})-(\d{2})-(\d{4})\b/g;

/**
 * Scan outbound text for high-confidence PII (Luhn-valid credit cards + valid US SSNs).
 * Returns only the TYPES found, never the matched value. Totally defined: never throws.
 */
export function scanEgressForPii(text: string | null | undefined): PiiEgressScan {
  if (!text) return { blocked: false, types: [] };
  const types = new Set<string>();

  // Credit cards: every candidate run, separators stripped, Luhn-validated.
  let m: RegExpExecArray | null;
  CC_CANDIDATE.lastIndex = 0;
  while ((m = CC_CANDIDATE.exec(text)) !== null) {
    const digits = m[0].replace(/[ -]/g, "");
    if (luhnValid(digits)) types.add("credit card");
  }

  // SSNs: canonical dashed shape with SSA-valid ranges.
  SSN.lastIndex = 0;
  while ((m = SSN.exec(text)) !== null) {
    if (isValidSsn(m[1], m[2], m[3])) types.add("US SSN");
  }

  const list = [...types];
  return { blocked: list.length > 0, types: list };
}

/**
 * A user-facing message naming the PII TYPES found (never the value), so the author can
 * remove it without the error echoing the sensitive data.
 */
export function describeEgressPii(types: string[]): string {
  if (types.length === 0) return "";
  return `This content looks like it contains personal data (${types.join(", ")}). Remove it before publishing — this surface is public.`;
}
