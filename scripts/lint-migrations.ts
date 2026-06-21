#!/usr/bin/env bun
// Offline migration SQL apply-safety lint.
//
// Runs the pure `lintMigrationSql` over every file in supabase/migrations/ and exits
// non-zero on any apply-FATAL error (a migration that would fail on apply). Needs NO
// database access, so it complements `check-migrations.sh` (which verifies applied
// status and needs PG* creds) by catching broken SQL BEFORE it is ever applied.
//
// Run: `bun scripts/lint-migrations.ts`  (wired into check-migrations.sh).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lintMigrationSql, type MigrationLintFinding } from "../src/lib/migration-lint";

const DIR = "supabase/migrations";

let files: string[];
try {
  files = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
} catch {
  console.log(`[mig-lint] no ${DIR} directory; skipping`);
  process.exit(0);
}

let errorCount = 0;
let warnCount = 0;
for (const f of files) {
  let findings: MigrationLintFinding[];
  try {
    findings = lintMigrationSql(readFileSync(join(DIR, f), "utf8"));
  } catch (e) {
    console.error(`[mig-lint] could not read ${f}: ${e instanceof Error ? e.message : e}`);
    continue;
  }
  for (const x of findings) {
    if (x.severity === "error") errorCount++;
    else warnCount++;
    const tag = x.severity === "error" ? "ERROR" : "warn ";
    console.log(`${tag}  ${f}:${x.line}  [${x.rule}] ${x.message}`);
  }
}

console.log(
  `[mig-lint] ${files.length} migrations scanned: ${errorCount} apply-fatal error(s), ${warnCount} warning(s)`,
);
if (errorCount > 0) {
  console.error("[mig-lint] FAILED: fix the apply-fatal migration error(s) above before shipping.");
  process.exit(1);
}
process.exit(0);
