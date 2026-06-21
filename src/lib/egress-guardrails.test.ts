import { expect, test, describe } from "bun:test";
import {
  scanEgressForSecrets,
  describeEgressSecrets,
  EGRESS_SECRET_RULES,
} from "./egress-guardrails";

describe("scanEgressForSecrets: detects high-confidence credentials", () => {
  const cases: Array<[string, string, string]> = [
    ["OpenAI key", "here is my key sk-ABCDEFGHIJ1234567890XYZ do not share", "OpenAI API key"],
    [
      "OpenAI scoped (hyphenated) key",
      "key sk-svcacct-ABCDEF1234567890ghijkl-moreXYZ in env",
      "OpenAI scoped key",
    ],
    ["AWS access key id", "AKIAIOSFODNN7EXAMPLE in the config", "AWS access key id"],
    ["GitHub token", "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", "GitHub token"],
    [
      "GitHub fine-grained PAT",
      "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuv pushed",
      "GitHub fine-grained token",
    ],
    ["Stripe live key", "sk_live_ABCDEFGHIJ1234567890abcd billing", "Stripe live secret key"],
    ["Slack token", "xoxb-123456789012-abcdefghijklm", "Slack token"],
    ["Google API key", "AIzaSyA1234567890abcdefghijklmnopqrstuv", "Google API key"],
    [
      "PEM private key",
      "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----",
      "Private key block",
    ],
  ];

  for (const [label, text, ruleName] of cases) {
    test(`blocks a ${label}`, () => {
      const r = scanEgressForSecrets(text);
      expect(r.blocked).toBe(true);
      expect(r.ruleNames).toContain(ruleName);
    });
  }
});

describe("scanEgressForSecrets: no false positives on benign content", () => {
  test("ordinary announcement prose does not block", () => {
    const r = scanEgressForSecrets(
      "We shipped the new roadmap view today. Our API keys are stored securely in the vault; reach us at the support page.",
    );
    expect(r.blocked).toBe(false);
    expect(r.ruleNames).toEqual([]);
  });

  test("a near-miss credential shape does not block", () => {
    // "sk-" with too few chars, a bare "AKIA", a short gh_ - none are real shapes.
    const r = scanEgressForSecrets("prefix sk-short, AKIA alone, gh_nope");
    expect(r.blocked).toBe(false);
  });

  test("hyphenated prose starting in 'sk-' does NOT block (the over-redaction guard)", () => {
    // The base OpenAI rule excludes hyphens on purpose, so 'risk-/task-' phrases that
    // happen to contain 'sk-<word>-<word>...' never trip the floor. The scoped rule
    // only fires on the real sk-proj-/sk-svcacct-/sk-admin- prefixes.
    const r = scanEgressForSecrets(
      "Our risk-management-system-overview and the task-tracking-workflow-rollout shipped.",
    );
    expect(r.blocked).toBe(false);
    expect(r.ruleNames).toEqual([]);
  });

  test("empty / whitespace text is safe", () => {
    expect(scanEgressForSecrets("").blocked).toBe(false);
    expect(scanEgressForSecrets("   ").ruleNames).toEqual([]);
  });
});

describe("scanEgressForSecrets: reporting", () => {
  test("dedups rule names when the same secret type appears twice", () => {
    const r = scanEgressForSecrets("sk-ABCDEFGHIJ1234567890XYZ and sk-ZYXWVUTSRQ0987654321ABC");
    expect(r.blocked).toBe(true);
    expect(r.ruleNames).toEqual(["OpenAI API key"]);
  });

  test("reports multiple distinct secret types", () => {
    const r = scanEgressForSecrets("sk-ABCDEFGHIJ1234567890XYZ then AKIAIOSFODNN7EXAMPLE");
    expect(r.ruleNames.sort()).toEqual(["AWS access key id", "OpenAI API key"]);
  });
});

describe("describeEgressSecrets", () => {
  test("names the secret TYPES, never echoes a value", () => {
    const msg = describeEgressSecrets(["OpenAI API key", "AWS access key id"]);
    expect(msg).toContain("OpenAI API key");
    expect(msg).toContain("AWS access key id");
    expect(msg).toContain("Remove it before saving");
    expect(msg).not.toContain("sk-");
  });

  test("empty list yields an empty string", () => {
    expect(describeEgressSecrets([])).toBe("");
  });
});

describe("EGRESS_SECRET_RULES integrity", () => {
  test("every rule is a high-confidence block-action secret rule", () => {
    expect(EGRESS_SECRET_RULES.length).toBeGreaterThanOrEqual(8);
    for (const r of EGRESS_SECRET_RULES) {
      expect(r.kind).toBe("secret");
      expect(r.action).toBe("block");
      expect(r.enabled).toBe(true);
    }
  });

  test("rule ids are unique", () => {
    const ids = EGRESS_SECRET_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
