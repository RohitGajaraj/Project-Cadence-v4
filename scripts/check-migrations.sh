#!/usr/bin/env bash
# Verify every migration file under supabase/migrations/ is applied to the
# Lovable Cloud database. Exits non-zero (blocking builds / CI / deploys) when
# any file has no matching row in supabase_migrations.schema_migrations.
#
# Run locally after `git pull` and automatically before `bun run build` via the
# `prebuild` npm hook. Requires PG* env vars AND read access to
# supabase_migrations.schema_migrations (CI with service-role DB credentials,
# or local with `supabase db ...`). Skips with a warning when DB access or
# permissions are absent so contributor laptops aren't blocked.
set -euo pipefail

MIG_DIR="supabase/migrations"

if [ ! -d "$MIG_DIR" ]; then
  echo "[migrations] no $MIG_DIR directory; skipping check"
  exit 0
fi

if [ -z "${PGHOST:-}" ]; then
  echo "[migrations] PGHOST not set; skipping check (no DB access in this env)"
  exit 0
fi

# File versions: leading numeric prefix of each *.sql filename.
file_versions=$(ls "$MIG_DIR"/*.sql 2>/dev/null \
  | xargs -n1 basename \
  | sed -E 's/^([0-9]+).*/\1/' \
  | sort -u)

if [ -z "$file_versions" ]; then
  echo "[migrations] no migration files found; nothing to check"
  exit 0
fi

# Applied versions from the managed migrations table.
applied_raw=$(psql -At -c \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version" \
  2>&1) || {
  if echo "$applied_raw" | grep -qi "permission denied"; then
    echo "[migrations] no read access to supabase_migrations schema; skipping"
    echo "[migrations] (grant this role SELECT on supabase_migrations.schema_migrations in CI to enforce)"
    exit 0
  fi
  echo "[migrations] could not query DB; skipping:"
  echo "$applied_raw" | head -3 | sed 's/^/  /'
  exit 0
}
applied_versions=$(echo "$applied_raw" | sort -u)

pending=$(comm -23 <(echo "$file_versions") <(echo "$applied_versions"))

if [ -n "$pending" ]; then
  echo "[migrations] PENDING migrations detected — apply before deploying:"
  echo "$pending" | sed 's/^/  - /'
  exit 1
fi

echo "[migrations] all $(echo "$file_versions" | wc -l | tr -d ' ') migrations applied"