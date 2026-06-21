import { expect, test, describe } from "bun:test";
import { lintMigrationSql, hasBlockingError, summarizeMigrationLint } from "./migration-lint";

describe("apply-fatal errors: CREATE POLICY/TRIGGER IF NOT EXISTS", () => {
  test("flags CREATE POLICY ... IF NOT EXISTS (the real WM-F3 bug, ERROR 42601)", () => {
    const sql = `alter table public.t enable row level security;
create policy if not exists "t read" on public.t for select using (true);`;
    const f = lintMigrationSql(sql);
    const err = f.find((x) => x.rule === "create-policy-if-not-exists");
    expect(err).toBeTruthy();
    expect(err!.severity).toBe("error");
    expect(err!.line).toBe(2);
    expect(hasBlockingError(f)).toBe(true);
  });

  test("flags CREATE TRIGGER ... IF NOT EXISTS", () => {
    const sql = `create trigger if not exists trg before insert on public.t for each row execute function f();`;
    const f = lintMigrationSql(sql);
    expect(f.some((x) => x.rule === "create-trigger-if-not-exists" && x.severity === "error")).toBe(
      true,
    );
  });

  test("the SAFE idiom (DROP ... IF EXISTS then CREATE) is clean", () => {
    const sql = `drop policy if exists "t read" on public.t;
create policy "t read" on public.t for select using (true);
drop trigger if exists trg on public.t;
create trigger trg before insert on public.t for each row execute function f();`;
    const f = lintMigrationSql(sql);
    expect(f.filter((x) => x.severity === "error")).toEqual([]);
  });

  test("case-insensitive + extra whitespace still matches", () => {
    const sql = `CREATE   POLICY   IF   NOT   EXISTS p ON public.t USING (true);`;
    expect(hasBlockingError(lintMigrationSql(sql))).toBe(true);
  });

  test("a commented-out invalid statement does NOT trip (comment-blanking)", () => {
    const sql = `-- create policy if not exists "old" on public.t using (true);
/* create trigger if not exists trg on public.t ... */
drop policy if exists "p" on public.t;
create policy "p" on public.t for select using (true);`;
    expect(lintMigrationSql(sql).filter((x) => x.severity === "error")).toEqual([]);
  });
});

describe("dollar-quoted bodies do not false-positive (build-gating guard)", () => {
  test("a forbidden phrase inside a $$ function body is NOT a build error", () => {
    const sql = `create or replace function f() returns void language plpgsql as $$
begin
  raise notice 'create policy if not exists is invalid';
end;
$$;`;
    expect(lintMigrationSql(sql).filter((x) => x.severity === "error")).toEqual([]);
  });

  test("a tagged dollar-quote ($body$) is also neutralized", () => {
    const sql = `do $body$ begin perform 'create trigger if not exists x'; end $body$;`;
    expect(lintMigrationSql(sql).filter((x) => x.severity === "error")).toEqual([]);
  });

  test("a real invalid statement OUTSIDE a function body still errors", () => {
    const sql = `create function f() returns void language sql as $$ select 1 $$;
create policy if not exists "p" on public.t using (true);`;
    expect(hasBlockingError(lintMigrationSql(sql))).toBe(true);
  });
});

describe("warn: new table without RLS", () => {
  test("a non-public schema table is skipped, not wrongly flagged", () => {
    const sql = `create table if not exists app_private.hook_secrets (id uuid primary key);`;
    const f = lintMigrationSql(sql);
    expect(f.some((x) => x.rule === "new-table-no-rls")).toBe(false);
  });

  test("warns on a new public table with no RLS enable in the same file", () => {
    const sql = `create table public.widget (id uuid primary key);`;
    const f = lintMigrationSql(sql);
    expect(f.some((x) => x.rule === "new-table-no-rls" && x.severity === "warn")).toBe(true);
  });

  test("no warn when RLS is enabled for that table in the same file", () => {
    const sql = `create table if not exists public.widget (id uuid primary key);
alter table public.widget enable row level security;`;
    const f = lintMigrationSql(sql);
    expect(f.some((x) => x.rule === "new-table-no-rls")).toBe(false);
  });
});

describe("warn: ADD COLUMN NOT NULL without DEFAULT", () => {
  test("warns when NOT NULL has no DEFAULT (fails on a populated table)", () => {
    const sql = `alter table public.t add column flag boolean not null;`;
    const f = lintMigrationSql(sql);
    expect(f.some((x) => x.rule === "add-column-notnull-no-default" && x.severity === "warn")).toBe(
      true,
    );
  });

  test("no warn when a DEFAULT is provided in the same statement", () => {
    const sql = `alter table public.t add column flag boolean not null default false;`;
    const f = lintMigrationSql(sql);
    expect(f.some((x) => x.rule === "add-column-notnull-no-default")).toBe(false);
  });

  test("no warn for a nullable add column", () => {
    const sql = `alter table public.t add column note text;`;
    expect(lintMigrationSql(sql).some((x) => x.rule === "add-column-notnull-no-default")).toBe(
      false,
    );
  });
});

describe("a realistic valid migration is clean", () => {
  test("a DROP-then-CREATE migration with RLS + defaults has no errors", () => {
    const sql = `create table if not exists public.note (
  id uuid primary key default gen_random_uuid(),
  body text not null default '',
  created_at timestamptz not null default now()
);
alter table public.note enable row level security;
drop policy if exists "note read" on public.note;
create policy "note read" on public.note for select using (true);
drop trigger if exists trg_note on public.note;
create trigger trg_note before update on public.note for each row execute function set_updated_at();`;
    const f = lintMigrationSql(sql);
    expect(hasBlockingError(f)).toBe(false);
    expect(f.filter((x) => x.severity === "error")).toEqual([]);
  });
});

describe("summary + empty", () => {
  test("empty/clean SQL yields no findings", () => {
    expect(lintMigrationSql("")).toEqual([]);
    expect(summarizeMigrationLint([])).toContain("No migration apply-safety issues");
  });

  test("summary counts errors and warnings", () => {
    const sql = `create policy if not exists p on public.t using (true);
create table public.x (id uuid);`;
    const f = lintMigrationSql(sql);
    const s = summarizeMigrationLint(f);
    expect(s).toContain("apply-fatal error");
    expect(s).toContain("warning");
  });
});
