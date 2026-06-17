#!/usr/bin/env bash
# Verify every migration file under supabase/migrations/ is applied to the
# Lovable Cloud database. Exits non-zero (blocking builds / CI / deploys) when
# any file has no matching row in supabase_migrations.schema_migrations.
#
# Run locally after `git pull` and automatically before `bun run build` via the
# `prebuild` npm hook. Requires PG* env vars (present in the Lovable sandbox
# and any CI configured with managed DB credentials); skips with a warning when
# they are absent so contributor laptops without DB access aren't blocked.
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
applied_versions=$(psql -At -c \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version" \
  2>/dev/null | sort -u)

pending=$(comm -23 <(echo "$file_versions") <(echo "$applied_versions"))

if [ -n "$pending" ]; then
  echo "[migrations] PENDING migrations detected — apply before deploying:"
  echo "$pending" | sed 's/^/  - /'
  exit 1
fi

echo "[migrations] all $(echo "$file_versions" | wc -l | tr -d ' ') migrations applied"