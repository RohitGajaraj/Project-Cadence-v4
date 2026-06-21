// Public-egress secret floor.
//
// The guardrails engine (`evaluateGuardrails`) already detects secrets, but today it
// only runs at the AI chokepoint (runtime.server.ts) for model input/output. It does
// NOT see content on its way out to a PUBLIC boundary. So a user can paste a live API
// key into an announcement body and publish it world-readable (L2 announcements are
// anon-readable via RLS), and no guardrail ever fires.
//
// This module closes that gap by REUSING the engine (the matching, ReDoS-safety, and
// block semantics are shared, not re-implemented) with a focused, self-contained set
// of high-confidence secret rules. It is deliberately owned here, not loaded from the
// per-workspace `guardrail_rules` table, so the floor holds even for a workspace that
// never configured guardrails - a security floor must not depend on opt-in config.
//
// Discipline (the FND-0.7 over-redaction lesson): every rule is a STRUCTURAL,
// near-zero-false-positive credential format, so a hard `block` is safe. We never
// block on an ambiguous or lexical pattern.
//
// Spec: docs/features/egress-secret-guard.md

import { evaluateGuardrails, type GuardrailRule } from "./ai/guardrails.server";

function secretRule(id: string, name: string, pattern: string): GuardrailRule {
  return { id, name, kind: "secret", pattern, action: "block", applies_to: "both", enabled: true };
}

/**
 * High-confidence credential formats. The first three mirror the `secret`-kind
 * entries in the built-in guardrail catalog (`guardrails.functions.ts` BUILTIN_SEED);
 * the rest extend it with other unambiguous provider key shapes. Each is structural
 * enough that a match is a real secret, not prose that happens to mention one.
 */
export const EGRESS_SECRET_RULES: GuardrailRule[] = [
  // The base rule stays strict (no hyphen in the class) ON PURPOSE: a hyphen breaks
  // the run, so "risk-management-system-overview" can never match it. The modern
  // hyphenated OpenAI formats (sk-proj-/sk-svcacct-/sk-admin-) are caught by a
  // SEPARATE prefix-anchored rule, which keeps the broad rule false-positive-safe.
  secretRule("egress-openai", "OpenAI API key", "sk-[A-Za-z0-9]{20,}"),
  secretRule(
    "egress-openai-scoped",
    "OpenAI scoped key",
    "sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}",
  ),
  secretRule("egress-aws-akid", "AWS access key id", "AKIA[0-9A-Z]{16}"),
  secretRule("egress-github", "GitHub token", "gh[pousr]_[A-Za-z0-9]{30,}"),
  secretRule("egress-github-pat", "GitHub fine-grained token", "github_pat_[A-Za-z0-9_]{30,}"),
  secretRule("egress-stripe-live", "Stripe live secret key", "sk_live_[A-Za-z0-9]{20,}"),
  secretRule("egress-slack", "Slack token", "xox[baprs]-[A-Za-z0-9-]{10,}"),
  secretRule("egress-google", "Google API key", "AIza[0-9A-Za-z_-]{35}"),
  secretRule(
    "egress-private-key",
    "Private key block",
    "-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----",
  ),
];

export type EgressSecretScan = {
  /** True when at least one high-confidence secret rule matched. */
  blocked: boolean;
  /** The DISTINCT secret TYPES found (rule names). Never the secret value. */
  ruleNames: string[];
};

/**
 * Scan outbound text for high-confidence secrets, reusing the guardrails engine so
 * the matching, ReDoS-safety, and zero-width guarding are shared with the chokepoint.
 * Returns only the rule names that matched, never the matched secret value.
 */
export function scanEgressForSecrets(text: string): EgressSecretScan {
  if (!text) return { blocked: false, ruleNames: [] };
  const res = evaluateGuardrails(text, EGRESS_SECRET_RULES, "output");
  const ruleNames = [...new Set(res.hits.map((h) => h.rule_name))];
  return { blocked: res.blocked, ruleNames };
}

/**
 * A user-facing message that names the secret TYPES found (never the values), so the
 * author knows what to remove without the error itself echoing the credential.
 */
export function describeEgressSecrets(ruleNames: string[]): string {
  if (ruleNames.length === 0) return "";
  return `This content looks like it contains a secret (${ruleNames.join(", ")}). Remove it before saving.`;
}
