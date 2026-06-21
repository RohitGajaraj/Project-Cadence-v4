// Static migration SQL apply-safety linter.
//
// The existing `scripts/check-migrations.sh` only checks that every migration FILE
// has been applied to the DB; it needs DB access and says nothing about whether a
// file's SQL will actually apply. This module fills that gap: a pure, OFFLINE,
// deterministic linter that catches apply-time-fatal SQL patterns BEFORE a migration
// ships, so a broken migration never fails on the founder's publish.
//
// Motivation (real, recurring): this project repeatedly shipped migrations that would
// fail to apply, e.g. `CREATE POLICY ... IF NOT EXISTS` (Postgres ERROR 42601 -
// CREATE POLICY has never supported IF NOT EXISTS; the safe idiom is DROP POLICY IF
// EXISTS then CREATE POLICY). Those are detected here with ZERO false positives,
// because the construct is ALWAYS invalid SQL, never a legitimate choice.
//
// Spec: docs/features/migration-lint.md

export type MigrationLintSeverity = "error" | "warn";

export interface MigrationLintFinding {
  severity: MigrationLintSeverity;
  rule: string;
  /** 1-based line number in the original SQL. */
  line: number;
  message: string;
}

/**
 * Replace SQL comment characters with spaces while preserving length and newlines, so
 * a match offset still maps to the right ORIGINAL line and a commented-out statement
 * never trips a rule. String literals are tracked only so a `--` inside one does not
 * start a comment; their contents are left intact (a credential-like phrase inside a
 * string is not our concern here, and migrations rarely embed rule text in strings).
 */
function blankComments(sql: string): string {
  const chars = sql.split("");
  const n = chars.length;
  let i = 0;
  let inLine = false;
  let inBlock = false;
  let inString = false;
  while (i < n) {
    const c = chars[i];
    const c2 = i + 1 < n ? chars[i + 1] : "";
    if (inLine) {
      if (c === "\n") inLine = false;
      else chars[i] = " ";
      i++;
      continue;
    }
    if (inBlock) {
      if (c === "*" && c2 === "/") {
        chars[i] = " ";
        chars[i + 1] = " ";
        i += 2;
        inBlock = false;
        continue;
      }
      if (c !== "\n") chars[i] = " ";
      i++;
      continue;
    }
    if (inString) {
      if (c === "'") inString = false;
      i++;
      continue;
    }
    // Dollar-quoted body ($$...$$ or $tag$...$tag$, e.g. a plpgsql function): blank
    // the whole body so free text inside it (a RAISE NOTICE or comment that mentions
    // a forbidden phrase) can never trip a rule. A bare `$1` positional param is not a
    // dollar-quote (no closing `$`), so it is left intact.
    if (c === "$") {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(chars[j])) j++;
      if (j < n && chars[j] === "$") {
        const tag = sql.slice(i, j + 1);
        const close = sql.indexOf(tag, j + 1);
        const end = close === -1 ? n : close + tag.length;
        for (let k = i; k < end && k < n; k++) {
          if (chars[k] !== "\n") chars[k] = " ";
        }
        i = end;
        continue;
      }
    }
    if (c === "-" && c2 === "-") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      inLine = true;
      continue;
    }
    if (c === "/" && c2 === "*") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      inBlock = true;
      continue;
    }
    if (c === "'") {
      inString = true;
      i++;
      continue;
    }
    i++;
  }
  return chars.join("");
}

/** 1-based line number of a character offset. */
function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

type RegexRule = { rule: string; severity: MigrationLintSeverity; re: RegExp; message: string };

// Patterns that are ALWAYS invalid SQL (apply-fatal). Zero false positives: the
// construct cannot legitimately appear, so a hard error is safe.
const REGEX_RULES: RegexRule[] = [
  {
    rule: "create-policy-if-not-exists",
    severity: "error",
    re: /\bcreate\s+policy\s+if\s+not\s+exists\b/gi,
    message:
      'CREATE POLICY does not support IF NOT EXISTS (Postgres ERROR 42601 on apply). Use: DROP POLICY IF EXISTS "name" ON table; CREATE POLICY ...',
  },
  {
    rule: "create-trigger-if-not-exists",
    severity: "error",
    re: /\bcreate\s+trigger\s+if\s+not\s+exists\b/gi,
    message:
      "CREATE TRIGGER does not support IF NOT EXISTS (fails on apply). Use: DROP TRIGGER IF EXISTS name ON table; CREATE TRIGGER ...",
  },
];

/**
 * Lint one migration's SQL for apply-safety problems. Pure and deterministic; no DB,
 * no clock. `error`-severity findings are apply-fatal (the migration would not apply);
 * `warn`-severity are advisory risks a human should confirm.
 */
export function lintMigrationSql(sql: string): MigrationLintFinding[] {
  const findings: MigrationLintFinding[] = [];
  if (!sql) return findings;
  const clean = blankComments(sql);

  // 1. Always-invalid constructs (apply-fatal).
  for (const r of REGEX_RULES) {
    r.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.re.exec(clean)) !== null) {
      findings.push({
        severity: r.severity,
        rule: r.rule,
        line: lineOf(clean, m.index),
        message: r.message,
      });
      if (r.re.lastIndex === m.index) r.re.lastIndex++;
    }
  }

  // 2. A new PUBLIC-schema table with no RLS enabled in the SAME file (the repo
  //    requires RLS on tenant tables). Advisory: RLS may be enabled in a later
  //    migration. A table in a non-public schema (e.g. app_private) is intentionally
  //    service-role-only, so it is skipped rather than flagged.
  const tableRe = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:("?[\w]+"?)\.)?("?[\w]+"?)/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(clean)) !== null) {
    const idx = tm.index;
    if (tableRe.lastIndex === idx) tableRe.lastIndex++;
    const schema = (tm[1] ?? "").replace(/"/g, "").toLowerCase();
    const name = tm[2].replace(/"/g, "");
    if (schema && schema !== "public") continue; // non-public table: intentionally RLS-exempt
    const rlsRe = new RegExp(
      `alter\\s+table\\s+(?:public\\.)?"?${name}"?\\s+enable\\s+row\\s+level\\s+security`,
      "i",
    );
    if (!rlsRe.test(clean)) {
      findings.push({
        severity: "warn",
        rule: "new-table-no-rls",
        line: lineOf(clean, idx),
        message: `New table "${name}" has no ENABLE ROW LEVEL SECURITY in this migration. Confirm RLS is intended (tenant tables must enable it).`,
      });
    }
  }

  // 3. ADD COLUMN ... NOT NULL without a DEFAULT (fails on a populated table).
  //    Per-statement so the DEFAULT must be in the SAME statement to clear it.
  for (const stmt of splitStatements(clean)) {
    if (
      /\badd\s+column\b/i.test(stmt.text) &&
      /\bnot\s+null\b/i.test(stmt.text) &&
      !/\bdefault\b/i.test(stmt.text)
    ) {
      findings.push({
        severity: "warn",
        rule: "add-column-notnull-no-default",
        line: lineOf(clean, stmt.index),
        message:
          "ADD COLUMN ... NOT NULL without a DEFAULT fails on a table that already has rows. Add a DEFAULT, or backfill then SET NOT NULL.",
      });
    }
  }

  return findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

/** Split SQL into statements on top-level semicolons, tracking each one's start offset. */
function splitStatements(clean: string): Array<{ text: string; index: number }> {
  const out: Array<{ text: string; index: number }> = [];
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === ";") {
      out.push({ text: clean.slice(start, i), index: start });
      start = i + 1;
    }
  }
  if (start < clean.length) out.push({ text: clean.slice(start), index: start });
  return out;
}

export function hasBlockingError(findings: MigrationLintFinding[]): boolean {
  return findings.some((f) => f.severity === "error");
}

export function summarizeMigrationLint(findings: MigrationLintFinding[]): string {
  if (findings.length === 0) return "No migration apply-safety issues.";
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.length - errors;
  const parts: string[] = [];
  if (errors) parts.push(`${errors} apply-fatal error${errors === 1 ? "" : "s"}`);
  if (warns) parts.push(`${warns} warning${warns === 1 ? "" : "s"}`);
  return parts.join(", ") + ".";
}
