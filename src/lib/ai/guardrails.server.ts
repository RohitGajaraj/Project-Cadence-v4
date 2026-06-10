/**
 * Server-side guardrail evaluation. Pure functions over a list of rules
 * loaded from `guardrail_rules`. Never imported by client code.
 */

export type GuardrailRule = {
  id: string;
  name: string;
  kind: "regex" | "keyword" | "pii" | "injection" | "secret";
  pattern: string;
  action: "block" | "warn" | "redact";
  applies_to: "input" | "output" | "both";
  enabled: boolean;
};

export type GuardrailHit = {
  rule_id: string;
  rule_name: string;
  kind: string;
  action: "block" | "warn" | "redact";
  side: "input" | "output";
  matched: string;
};

export type GuardrailResult = {
  text: string; // possibly redacted
  hits: GuardrailHit[];
  blocked: boolean;
};

function safeRegex(pattern: string, kind: string): RegExp | null {
  try {
    // `keyword` rules treat pattern as literal substring (case-insensitive)
    if (kind === "keyword") {
      const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(esc, "gi");
    }
    return new RegExp(pattern, "gi");
  } catch {
    return null;
  }
}

export function evaluateGuardrails(
  text: string,
  rules: GuardrailRule[],
  side: "input" | "output",
): GuardrailResult {
  let out = text;
  const hits: GuardrailHit[] = [];
  let blocked = false;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.applies_to !== side && rule.applies_to !== "both") continue;
    const re = safeRegex(rule.pattern, rule.kind);
    if (!re) continue;

    let m: RegExpExecArray | null;
    let hadMatch = false;
    while ((m = re.exec(out)) !== null) {
      hadMatch = true;
      hits.push({
        rule_id: rule.id,
        rule_name: rule.name,
        kind: rule.kind,
        action: rule.action,
        side,
        matched: (m[0] ?? "").slice(0, 80),
      });
      if (re.lastIndex === m.index) re.lastIndex++; // guard zero-width
    }
    if (!hadMatch) continue;

    if (rule.action === "block" || rule.kind === "injection") {
      blocked = true;
    } else if (rule.action === "redact") {
      out = out.replace(safeRegex(rule.pattern, rule.kind)!, `[REDACTED:${rule.kind}]`);
    }
    // warn: just logged
  }

  return { text: out, hits, blocked };
}
