# Migration drift check

> _Created: 2026-06-17 · Last updated: 2026-06-17_

Automated gate that verifies every file under `supabase/migrations/` has a
matching row in `supabase_migrations.schema_migrations`. Blocks deploys when
anything is pending.

## Wired in

- **`bun run build` / `build:dev`** — runs `scripts/check-migrations.sh` via
  the `prebuild` / `prebuild:dev` npm hooks. Non-zero exit fails the build.
- **`git pull` / `git merge`** — `.git/hooks/post-merge` (installed by
  `scripts/install-git-hooks.sh`, which runs on `postinstall`) prints a
  warning when new files arrived that aren't applied yet.
- **Manual** — `bun run db:check` any time.

## Behavior

- Reads file versions (the leading numeric prefix of each `*.sql` filename).
- Reads applied versions from `supabase_migrations.schema_migrations` via `psql`.
- Exits **1** with the list of pending versions when any file is missing.
- Exits **0** with a warning when DB access or schema permission is absent
  (contributor laptops, sandboxes), so it never blocks local dev. CI must run
  with credentials that have `SELECT` on `supabase_migrations.schema_migrations`
  for the gate to actually fire.

## When it trips

Apply the listed migrations through the standard flow (the `supabase--migration`
tool on Lovable, or `supabase db push` on a connected project), then re-run
`bun run db:check` to confirm.